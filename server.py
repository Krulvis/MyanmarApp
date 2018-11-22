#!/usr/bin/env python
"""Web server for the Trendy Lights application.

The overall architecture looks like:

               server.py         script.js
 ______       ____________       _________
|      |     |            |     |         |
|  EE  | <-> | App Engine | <-> | Browser |
|______|     |____________|     |_________|
     \                               /
      '- - - - - - - - - - - - - - -'

The code in this file runs on App Engine. It's called when the user loads the
web page and when details about a polygon are requested.

Our App Engine code does most of the communication with EE. It uses the
EE Python library and the service account specified in config.py. The
exception is that when the browser loads map tiles it talks directly with EE.

The basic flows are:

1. Initial page load

When the user first loads the application in their browser, their request is
routed to the get() function in the MainHandler class by the framework we're
using, webapp2.

The get() function sends back the main web page (from index.html) along
with information the browser needs to render an Earth Engine map and
the IDs of the polygons to show on the map. This information is injected
into the index.html template through a templating engine called Jinja2,
which puts information from the Python context into the HTML for the user's
browser to receive.

Note: The polygon IDs are determined by looking at the static/polygons
folder. To add support for another polygon, just add another GeoJSON file to
that folder.

2. Getting details about a polygon

When the user clicks on a polygon, our JavaScript code (in static/script.js)
running in their browser sends a request to our backend. webapp2 routes this
request to the get() method in the DetailsHandler.

This method checks to see if the details for this polygon are cached. If
yes, it returns them right away. If no, we generate a Wikipedia URL and use
Earth Engine to compute the brightness trend for the region. We then store
these results in a cache and return the result.

Note: The brightness trend is a list of points for the chart drawn by the
Google Visualization API in a time series e.g. [[x1, y1], [x2, y2], ...].

Note: memcache, the cache we are using, is a service provided by App Engine
that temporarily stores small values in memory. Using it allows us to avoid
needlessly requesting the same data from Earth Engine over and over again,
which in turn helps us avoid exceeding our quota and respond to user
requests more quickly.

"""

import json
import os
import sys
from httplib import HTTPException

import jinja2
import webapp2
from google.appengine.api import memcache
from google.appengine.api import urlfetch

import config
import ee


###############################################################################
#                             Web request handlers.                           #
###############################################################################


class MainHandler(webapp2.RequestHandler):
    """A servlet to handle requests to load the main web page."""

    def get(self):
        """Returns the main web page, populated with EE map."""
        template_values = {
            'key': config.KEY
        }
        template = JINJA2_ENVIRONMENT.get_template('index.html')
        self.response.out.write(template.render(template_values))


class OverlayHandler(webapp2.RequestHandler):

    def get(self):
        name = self.request.url
        json_data = memcache.get(name)
        print('Getting For URL: ', name)
        # If we've cached details for this URL, return them.
        if json_data is not None:
            print('From Cache:')
            print(json_data)
            self.response.headers['Content-Type'] = 'application/json'
            self.response.out.write(json_data)
            return
        start_date = self.request.get('startDate')
        end_date = self.request.get('endDate')
        targets = self.request.get('target').split(',')
        product = self.request.get('product')
        timestep = self.request.get('timestep')
        statistic = self.request.get('statistic')
        method = self.request.get('method')
        area_type = self.request.get('areaType')
        values = {}
        if method == 'area':
            features = GetMultiAreaFeatures(targets, area_type)
            # values['center'] = feature.centroid().getInfo()['coordinates']
        elif method == 'shapefile':
            features = GetShapeFileFeature(targets)
            # values['center'] = feature.centroid().getInfo()['coordinates']
        else:
            values['error'] = 'Did not set correct method!'
            self.response.headers['Content-Type'] = 'application/json'
            self.response.out.write(json.dumps(values))
            return
        values = GetOverlayFor(start_date, end_date, product, statistic, features, timestep)
        tries = 0
        while 'error' in values.keys() and values['error'] == 'Timeout, deadline exceeded' and tries < 4:
            tries = tries + 1
            values = GetOverlayFor(start_date, end_date, product, statistic, features, timestep)
        if 'error' not in values.keys():
            memcache.add(name, json.dumps(values), MEMCACHE_EXPIRATION)
        self.response.headers['Content-Type'] = 'application/json'
        self.response.out.write(json.dumps(values))


class SFHandler(webapp2.RequestHandler):

    def get(self):
        link = self.request.get('link')
        fc = ee.FeatureCollection(link)
        print(fc.getInfo())
        data = {}
        data['success'] = 'true'
        self.response.headers['Content-Type'] = 'application/json'
        self.response.out.write(json.dumps(data))


class TestHandler(webapp2.RequestHandler):

    def get(self):
        features = ee.FeatureCollection('users/joepkt/myanmar_district_boundaries')
        kayeh = features.filter(ee.Filter.eq('DT', 'Kayeh'))
        print(kayeh.getInfo())


###############################################################################
#                                Overlay                                      #
###############################################################################
def GetOverlayFor(start_date, end_date, product_name, statistic, target_feature, timestep):
    values = {}
    try:
        # collection = GetOverlayImageCollection(start_date, end_date, product)
        # calced = GetCalculatedCollection(collection, statistic)
        product = PRODUCTS[product_name]
        image = GetOverlayCalculation(start_date, end_date, product, target_feature, timestep, statistic)
        min_max = image.reduceRegion(ee.Reducer.minMax(), target_feature, product['scale'])
        min = GetMin(min_max, target_feature)
        max = GetMax(min_max, target_feature)
        print('Min', min)
        print('Max', max)
        overlay = GetOverlayImage(image, target_feature, min, max, statistic)
        data = overlay.getMapId()
        values['mapid'] = data['mapid']
        values['token'] = data['token']
        values['min'] = min
        values['max'] = max
        values['download_url'] = overlay.getDownloadURL(
            {'name': 'ImageOverlay', 'region': target_feature.geometry().bounds().getInfo()['coordinates'],
             'scale': product['scale']})
    except (ee.EEException, HTTPException) as ex:
        # Handle exceptions from the EE client library.
        e = sys.exc_info()
        print('type', type(ex).__name__)
        print('ex args', ex.args)
        if 'Deadline' in ex.args[0]:
            values['error'] = 'Timeout, deadline exceeded'
        else:
            values['error'] = ErrorHandling(e)
    finally:
        print('Returning curr values')
        return values


def GetOverlayCalculation(start_date, end_date, product, features, timestep, statistic):
    start_date = ee.Date(start_date)
    end_date = ee.Date(end_date)
    date = ee.List.sequence(0, end_date.difference(start_date, timestep).toInt())

    def GetImageForDate(advance):
        m = start_date.advance(advance, timestep)
        img = product['collection'].filterDate(m, ee.Date(m).advance(1, timestep)).filterBounds(features.geometry())
        img_calced = img.sum()
        return img_calced

    multiplied = ee.ImageCollection.fromImages(date.map(GetImageForDate).flatten()).map(
        lambda i: Multiply(i, product['multiply']))
    return GetCalculatedCollection(multiplied, statistic)


def GetOverlayImageCollection(start_date, end_date, product):
    start_date = ee.Date(start_date)
    end_date = ee.Date(end_date)
    return product['collection'].filterDate(start_date, end_date)


def GetMax(min_max, region):
    # maximum = min_max.select('max')#.reduceRegion(ee.Reducer.max(), region, 5000)
    # return ee.Number(min_max.get('max')).getInfo()
    return min_max.get(min_max.keys().get(0)).getInfo()


def GetMin(min_max, region):
    # minmum = min_max.select('min')#.reduceRegion(ee.Reducer.min(), region, 5000)
    # return ee.Number(min_max.get('min')).getInfo()
    return min_max.get(min_max.keys().get(1)).getInfo()


def GetOverlayImage(image, region, min, max, statistic):
    """Map for displaying summed up images of specified measurement"""
    return image.clip(region).visualize(min=min, max=max, palette='FF00E7, FF2700, FDFF92, 0000FF, 000000')
    # return image.reduceRegion(GetReducer(statistic), region).toImage().visualize(min=min, max=max, palette='FF00E7, FF2700, FDFF92, 0000FF, 000000')


###############################################################################
#                                Graph For Regions.                           #
###############################################################################
class GraphHandler(webapp2.RequestHandler):

    def get(self):
        name = self.request.url
        json_data = memcache.get(name)
        print('Getting For URL: ', name)
        # If we've cached details for this polygon, return them.
        if json_data is not None:
            print('From Cache:')
            print(json_data)
            self.response.headers['Content-Type'] = 'application/json'
            self.response.out.write(json_data)
            return
        print('NOT CACHE:')
        start_date = self.request.get('startDate')
        end_date = self.request.get('endDate')
        target = self.request.get('target')
        area_type = self.request.get('areaType')
        product = self.request.get('product')
        statistic = self.request.get('statistic')
        timestep = self.request.get('timestep')
        method = self.request.get('method')
        products = product.split(",")
        details = {}
        if method == 'coordinate':
            json_features = json.loads(target)
            print(json_features)
            features = json_features['features']
            details['chart_data'] = GetPointsLineSeries(start_date, end_date, products, features, timestep,
                                                        statistic)
            details['title'] = 'Markers'
        else:
            targets = target.split(",")
            details['chart_data'] = GetGraphSeries(start_date, end_date, targets, area_type, method,
                                                   products, timestep, statistic)
            details['title'] = 'ShapeFile' if method == 'shapefile' else product if len(targets) > 1 else target

        json_data = json.dumps(details)
        # Store the results in memcache.
        memcache.add(name, json_data, MEMCACHE_EXPIRATION)
        self.response.headers['Content-Type'] = 'application/json'
        self.response.out.write(json_data)


def GetGraphSeries(start_date, end_date, targets, area_type, method, products, timestep, statistic):
    """Returns data to draw graphs with for single area"""
    details = {}
    try:
        # Else build new dictionary

        if method == 'area':
            if len(targets) > 1:  # Multiple area's means one product (build dictionary of Area's with their data)
                print('Going for multiple areas: {}, with product: {}'.format(targets, products))
                details = {target: ComputeGraphSeries(start_date, end_date, GetAreaGeometry(target, area_type),
                                                      PRODUCTS[products[0]], timestep, statistic) for
                           target in targets}
            else:
                print('Going for single area: {}, with products: {}'.format(targets, products))
                region = GetAreaGeometry(targets[0], area_type)
                details = {
                    product: ComputeGraphSeries(start_date, end_date, region, PRODUCTS[product], timestep, statistic)
                    for
                    product in products}
        elif method == 'shapefile':
            region = GetShapeFileFeature(targets)
            details = {product: ComputeGraphSeries(start_date, end_date, region, PRODUCTS[product], timestep, statistic)
                       for product in products}
        print(details)
        details = OrderForGraph(details)

    except (ee.EEException, HTTPException) as ex:
        # Handle exceptions from the EE client library.
        e = sys.exc_info()
        print('type', type(ex).__name__)
        print('ex args', ex.args)
        details['error'] = ErrorHandling(e)
    finally:
        # Send the results to the browser.
        return details


def ComputeGraphSeries(start_date, end_date, region, product, timestep, statistic):
    start_date = ee.Date(start_date)
    end_date = ee.Date(end_date)
    months = ee.List.sequence(0, end_date.difference(start_date, timestep).toInt())

    # Create base months
    def CalculateTimeStep(count):
        m = start_date.advance(count, timestep)
        img_col = product['collection'].filterDate(m, ee.Date(m).advance(1, timestep))
        img_multiplied = GetCalculatedCollection(img_col.map(lambda i: Multiply(i, product['multiply'])), statistic)
        img = img_multiplied.reduceRegion(
            ee.Reducer.mean(), region,
            product['scale'])
        return ee.Feature(None, {
            'system:time_start': m.format(
                'dd-MM-YYYY' if timestep == 'day' else 'MM-YYYY' if timestep == 'month' else 'YYYY'),
            'value': img.values().get(0)
        })

    chart_data = months.map(CalculateTimeStep).getInfo()

    def ExtractMean(feature):
        return [feature['properties']['system:time_start'], feature['properties']['value']]

    chart_data = map(ExtractMean, chart_data)
    print(chart_data)
    return chart_data


###############################################################################
#                                Graph For Points.                            #
###############################################################################

def GetPointsLineSeries(start_date, end_date, products, point_features, timestep, statistic):
    point_features = map(ee.Feature, point_features)  # Map to ee.Feature (loads GeoJSON)
    details = {}

    # try:
    if len(products) > 1:
        print('Multiple products')
        details = {product: ComputeGraphSeries(start_date, end_date, point_features[0].geometry(),
                                               PRODUCTS[product], timestep, statistic) for product in products}
    else:
        product = PRODUCTS[products[0]]
        print('Multiple Features with product: ', product)
        details = {
            point.getInfo()['properties']['title']: ComputeGraphSeries(start_date, end_date, point.geometry(),
                                                                       PRODUCTS[products[0]], timestep, statistic)
            for point in point_features}
        # for point in point_features:
        #     details[point.getInfo()['properties']['title']] = GetPointData(start_date, end_date, product,
        #                                                                    point, timestep, statistic)
    print(details)
    details = OrderForGraph(details)
    # except (ee.EEException, HTTPException):
    #     # Handle exceptions from the EE client library.
    #     e = sys.exc_info()[0]
    #     details['error'] = ErrorHandling(e)
    # finally:
    # Send the results to the browser.
    print("Done getting Chart Data")
    return details


###############################################################################
#                                   Helpers.                                  #
###############################################################################
def GetReducer(statistic):
    if statistic == 'mean':
        return ee.Reducer.mean()
    if statistic == 'sum':
        return ee.Reducer.sum()
    if statistic == 'min':
        return ee.Reducer.min()
    if statistic == 'max':
        return ee.Reducer.max()


def GetCalculatedCollection(images, statistic):
    if statistic == 'mean':
        return images.mean()
    if statistic == 'sum':
        return images.sum()
    if statistic == 'min':
        return images.min()
    if statistic == 'max':
        return images.max()
    else:
        print('No statistics specified')
        return images


def GetAreaGeometry(name, area_type):
    """Returns an ee.Geometry for the area's with given names."""
    if area_type == 'regions':
        stdt = 'ST'
        path = REGIONS_PATH
    elif area_type == 'basins':
        stdt = 'Name'
        path = BASINS_PATH
    elif area_type == 'country':
        stdt = 'Name'
        path = MYANMAR_PATH
        name = name.upper()
    else:
        stdt = 'DT'
        path = DISTRICTS_PATH

    features = ee.FeatureCollection(path)
    areas = features.filter(ee.Filter.eq(stdt, name))
    return areas.geometry()


def GetMultiAreaFeatures(names, area_type):
    """Returns an ee.Geometry for the area's with given names."""
    if area_type == 'regions':
        stdt = 'ST'
        path = REGIONS_PATH
    elif area_type == 'basins':
        stdt = 'Name'
        path = BASINS_PATH
    elif area_type == 'country':
        stdt = 'Name'
        path = MYANMAR_PATH
        names = [name.upper() for name in names]
    else:
        stdt = 'DT'
        path = DISTRICTS_PATH

    features = ee.FeatureCollection(path)
    areas = features.filter(ee.Filter.inList(stdt, names))
    return areas
    # From JSON VV
    # path = os.path.join(os.path.split(__file__)[0], path)
    # with open(path) as f:
    #     data = json.load(f)
    #     areas = [ee.Feature(k) for k in data["features"]]
    #     collection = ee.FeatureCollection(areas)
    #     features = collection.filter(ee.Filter.inList(stdt, names))
    #     return features.geometry().dissolve()


def GetShapeFileFeature(shapefile):
    return ee.FeatureCollection(shapefile).geometry().dissolve()


def OrderForGraph(details):
    """Generates a multi-dimensional array of information to be displayed in the Graphs"""
    # Create first row of columns
    print("Creating the graph data::")
    first_row = ['Date']
    for i in details:
        first_row.append(i)

    # Build array of months (Assumes Month (mm-yyyy) to be first, and have the value as second element per row
    first = details[details.keys()[0]]
    months = [first[i][0] for i in range(len(first))]
    print(months)

    rows = [len(first)]
    rows[0] = first_row

    # Create rows and add to main array
    for index in range(len(months)):
        row = [months[index]]
        for i in details:
            value = details[i][index][1]
            row.append(0.0 if value is None else value)
        rows.append(row)

    print(rows)

    return rows


def ErrorHandling(e):
    print('Error getting graph data ERROR CAUGHT')
    print(str(e))
    return 'Area too large, deadline exceeded' if e is HTTPException else str(e)


###############################################################################
#                                   Constants.                                #
###############################################################################


# Memcache is used to avoid exceeding our EE quota. Entries in the cache expire
# 24 hours after they are added. See:
# https://cloud.google.com/appengine/docs/python/memcache/
MEMCACHE_EXPIRATION = 60 * 60 * 24

DISTRICTS_PATH = 'users/joepkt/myanmar_district_boundaries'
REGIONS_PATH = 'users/joepkt/myanmar_state_region_boundaries'
BASINS_PATH = 'users/joepkt/myanmar_river_basins'
MYANMAR_PATH = 'users/joepkt/myanmar_country_boundaries'

# http://webapp-improved.appspot.com/tutorials/quickstart.html
app = webapp2.WSGIApplication([
    ('/overlay', OverlayHandler),
    ('/graph', GraphHandler),
    ('/test', TestHandler),
    ('/shapefile', SFHandler),
    ('/', MainHandler),
])

###############################################################################
#                               Initialization.                               #
###############################################################################


# Use our App Engine service account's credentials.
EE_CREDENTIALS = ee.ServiceAccountCredentials(
    config.EE_ACCOUNT, config.EE_PRIVATE_KEY_FILE)

# Create the Jinja templating system we use to dynamically generate HTML. See:
# http://jinja.pocoo.org/docs/dev/
JINJA2_ENVIRONMENT = jinja2.Environment(
    loader=jinja2.FileSystemLoader(os.path.dirname(__file__)),
    autoescape=True,
    extensions=['jinja2.ext.autoescape'])

# Initialize the EE API.
ee.Initialize(EE_CREDENTIALS)
urlfetch.set_default_fetch_deadline(500)


###############################################################################
#                               Building the ImageCollections.                #
###############################################################################
# COUNTRIES = ee.FeatureCollection('ft:1tdSwUL7MVpOauSgRzqVTOwdfy17KDbw-1d9omPw')


def Multiply(i, value):
    return i.multiply(value).copyProperties(i, ['system:time_start'])


TRMM = ee.ImageCollection('TRMM/3B42').select('precipitation')
PERSIANN = ee.ImageCollection('NOAA/PERSIANN-CDR')
CHIRPS = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
CFSV2 = ee.ImageCollection('NOAA/CFSV2/FOR6H').select('Precipitation_rate_surface_6_Hour_Average')
GLDAS = ee.ImageCollection('NASA/GLDAS/V021/NOAH/G025/T3H').select('Rainf_tavg')

PRODUCTS = {
    'CHIRPS': {
        'collection': CHIRPS,
        'scale': 1000,
        'multiply': 1
    },
    'PERSIANN': {
        'collection': PERSIANN,
        'scale': 5000,
        'multiply': 1
    },
    'TRMM': {
        'collection': TRMM,
        'scale': 30000,
        'multiply': 3
    },
    'CFSV2': {
        'collection': CFSV2,
        'scale': 30000,
        'multiply': 60 * 60 * 6
    },
    'GLDAS': {
        'collection': GLDAS,
        'scale': 30000,
        'multiply': 60 * 60 * 3
    }
}
