myanmar = {};

myanmar.boot = function (key) {
    // Load external libraries.
    //google.load('visualization', '1', {packages: ["corechart"]});
    google.load('maps', '3', {'other_params': 'key=' + key + '&libraries=drawing'});

    google.setOnLoadCallback(function () {
        google.charts.load("current", {packages: ['corechart']});
        google.charts.setOnLoadCallback(function () {
            myanmar.instance = new myanmar.App();
            myanmar.instance.initVals();
        });
    });
};

myanmar.App = function () {
    this.map = this.createMap();


    //Some styling (responsiveness of results panel)
    var results = $('.results');
    var settings = $('.settings');
    results.draggable().resizable();
    settings.draggable();
    results.on('resizestop', function () {
        console.log('Resize complete');
        myanmar.instance.showChart();
    });

    this.map.data.addListener('click', this.handleMapClick.bind(this));

    // Register a click handler to hide the panel when the user clicks close.
    $('.results .close').click(this.hidePanel.bind(this));

    //Respond to radio button clicks (switching input style)
    $('.method-container .nav-item').on('click', this.switchStyle.bind(this));

    //Adds a marker for given input
    $('.add-marker').on('click', markers.addMarkerFromForm.bind(this));

    //Validates the shape file link
    $('.check-shapefile').on('click', this.validateShapefile.bind(this));

    //Add functionality to buttons
    $('#overlay-button').on('click', function (event) {
        myanmar.instance.createOverlay();
    });

    $('#graph-button').on('click', function (event) {
        myanmar.instance.createGraph();
    });

    $('#download-csv-btn').click(function () {
        var csvFormattedDataTable = myanmar.App.graphToCSV(myanmar.instance.chartData);
        var encodedUri = 'data:application/csv;charset=utf-8,' + encodeURIComponent(csvFormattedDataTable);
        this.href = encodedUri;
        this.download = 'table-data.csv';
        this.target = '_blank';
    });

    this.map.controls[google.maps.ControlPosition.TOP_RIGHT].push(document.getElementById('legend'));
};

/**
 * Set the initial Values to use
 */
myanmar.App.prototype.initVals = function () {
    this.markers = [];
    this.selectionMethod = 'area';
    this.outputType = 'graph';
    this.chartData = null;
    this.chartTitle = 'Chart';
    timesteps.reset(this.outputType);
    statistics.reset(this.outputType);
    products.reset(this.outputType);

    //Load features after instance has been created
    area.loadFeatures('country', function () {
        //Start by selecting Myanmar
        area.add(area.getAreaFeature('Myanmar'), 'Myanmar')
    });
};

/**
 * Creates a Google Map
 * The map is anchored to the DOM element with the CSS class 'map'.
 * @return {google.maps.Map} A map instance with the map type rendered.
 */
myanmar.App.prototype.createMap = function () {
    var mapOptions = {
        backgroundColor: '#000000',
        center: myanmar.App.DEFAULT_CENTER,
        //disableDefaultUI: true,
        streetViewControl: false,
        mapTypeControl: true,
        mapTypeControlOptions: {
            position: google.maps.ControlPosition.RIGHT_BOTTOM,
            mapTypeIds: ['roadmap', 'satellite', 'terrain', 'hybrid']
        },
        zoom: myanmar.App.DEFAULT_ZOOM,
        maxZoom: myanmar.App.MAX_ZOOM,
        mapTypeId: 'terrain'
    };
    var mapEl = $('.map').get(0);
    return new google.maps.Map(mapEl, mapOptions);
};

/**
 * Adds Rainfall Overlay to map using currently set Dates and targetRegion
 */
myanmar.App.prototype.createOverlay = function () {
    const startDate = $('#startDate').val();
    const endDate = $('#endDate').val();
    const button = $('#overlay-button');
    const downloadImg = $('.download-img');
    const downloadCSV = $('.download-csv');
    const product = this.getProduct();
    const timestep = this.getTimestep();
    const statistic = this.getStatistic();
    const target = this.getTarget();
    const areaType = area.getSelectedAreaType();

    let error = $('#error-message');
    if (!this.checkSelections(product, statistic, timestep)) {
        return;
    }
    $.ajax({
        url: '/overlay?startDate=' + startDate + '&endDate=' + endDate + '&method=' + this.selectionMethod + '&product=' + product + '&statistic=' + statistic + '&target=' + target + '&areaType=' + areaType + '&timestep=' + timestep,
        method: 'GET',
        beforeSend: function () {
            button.html('Loading map overlay...');
            downloadImg.hide();
            downloadCSV.hide();
            error.hide();
            myanmar.instance.clearOverlays();
        },
        error: function (data) {
            button.html('error');
            error.show().html('Error obtaining data!');
        }
    }).done((function (data) {
        if (data['error']) {
            error.show().html('Error: ' + data['error']);
            button.html('Create overlay');
        } else {
            error.show().html('Map is being drawn... Please wait before drawing new map!');
            button.html(myanmar.App.OVERLAY_BASE_BUTTON_NAME);
            console.log('Got back from server: ');
            console.log(data);
            var mapId = data['mapid'];
            var token = data['token'];
            $('#legend-max span').html(myanmar.App.format(data['max']));
            $('#legend-min span').html(myanmar.App.format(data['min']));
            downloadImg.show();
            $('#download-img-btn').attr("href", data['download_url']);
            var legend = $('#legend');
            legend.show();
            this.addOverlay(mapId, token);
        }
    }).bind(this));
};

/**
 * Get Graph data for targetRegion
 */
myanmar.App.prototype.createGraph = function () {
    const startDate = $('#startDate').val();
    const endDate = $('#endDate').val();
    const button = $('#graph-button');
    const graph = $('#graph');
    const downloadImg = $('.download-img');
    const downloadCSV = $('.download-csv');
    const product = this.getProduct();
    const target = this.getTarget();
    const areaType = area.getSelectedAreaType();
    const statistic = this.getStatistic();
    const timestep = this.getTimestep();

    let error = $('#error-message');
    if (!this.checkSelections(product, statistic, timestep)) {
        return;
    }
    $.ajax({
        url: '/graph?startDate=' + startDate + '&endDate=' + endDate + '&method=' + this.selectionMethod
            + '&product=' + product + '&statistic=' + statistic + '&target=' + target + '&areaType=' + areaType + '&timestep=' + timestep,
        method: 'GET',
        beforeSend: function () {
            downloadCSV.hide();
            downloadImg.hide();
            error.hide();
            button.html('Loading...');
        }, error: function (data) {
            button.html('error');
            error.show().html(data['error']);
        }
    }).done((function (data) {
        if (data['error']) {
            button.html(myanmar.App.GRAPH_BASE_BUTTON_NAME);
            error.show().html(data['error']);
        } else {
            button.html(myanmar.App.GRAPH_BASE_BUTTON_NAME);
            this.chartTitle = this.selectionMethod === 'country' ? this.selectedCountry.getProperty('Country') : this.selectionMethod === 'coordinate' ? 'Markers' : 'ShapeFile';
            console.log(data);
            downloadCSV.show();
            this.chartData = data;
            this.showChart();
        }
    }).bind(this));
};

/**
 * Returns true if anything is selected
 * @returns {boolean}
 */
myanmar.App.prototype.checkSelections = function (product, statistic, timestep) {
    var error = $('#error-message');
    error.hide();
    switch (this.selectionMethod) {
        case 'area':
            if (area.getSelectedAreas().length === 0) {
                error.show().html('Select an Area first!');
                return false;
            }
            break;
        case 'coordinate':
            if (this.markers.length === 0) {
                error.show().html('Create a Marker first (or click on map)!');
                return false;
            }
            break;
        case 'shapefile':
            var link = $('#shapefile-link').val();
            if (link.length === 0) {
                error.show().html('Add a link retrieved from <a href="https://code.earthengine.google.com/">Google EE API</a>');
                return false;
            }
            break;
    }
    console.log('Prodcut: ' + product + ', statistic: ' + statistic + ', Timestep: ' + timestep);
    if (product === 'error') {
        error.show().html('Select at least one Product first!');
        return false;
    } else if (timestep === 'error') {
        error.show().html('Select a Timestep first!');
        return false;
    } else if (statistic === 'error') {
        error.show().html('Select a statistic method first!');
        return false;
    }
    return true;
};

/**
 * Handle Map Click (Places marker, Selects Country)https://soundcloud.com/discover/sets/weekly:5513946
 * @param event
 */
myanmar.App.prototype.handleMapClick = function (event) {

    if (this.selectionMethod === 'area') {
        area.add(event.feature);
    } else if (this.selectionMethod === 'coordinate') {
        markers.addMarkerFromLng(event.latLng, $('#title').val());
    }
};

/**
 * Shows a chart with the given timeseries.v
 * @param {Array<Array<number>>} timeseries The timeseries data
 *     to plot in the chart.
 */
myanmar.App.prototype.showChart = function () {
    $('.results').show();
    $('.results .title').show().text(this.chartTitle);
    var data = google.visualization.arrayToDataTable(this.chartData);
    var wrapper = new google.visualization.ChartWrapper({
        chartType: this.chartData.length > 50 ? 'ScatterChart' : 'LineChart',
        dataTable: data,
        options: {
            title: 'Precipitation over time',
            //curveType: 'function',
            legend: {position: 'bottom'},
            titleTextStyle: {fontName: 'Roboto'},
            hAxis: {title: 'Time'},
            vAxis: {title: 'Precipitation (mm)'}
        }
    });
    $('.results .chart').show();
    var chartEl = $('.chart').get(0);
    wrapper.setContainerId(chartEl);
    wrapper.draw();
};

/**
 * Adds overlay to the map with given mapId and token,
 * Fires event on done loading map
 * @param eeMapId
 * @param eeToken
 * @param statistic
 */
myanmar.App.prototype.addOverlay = function (eeMapId, eeToken) {
    console.log('MapID: ' + eeMapId + ', Token: ' + eeToken);
    //var bounds = new google.maps.LatLngBounds();
    var maxZoom = 5;
    var overlay = new google.maps.ImageMapType({
        getTileUrl: function (tile, zoom) {
            var url = myanmar.App.EE_URL + '/map/';
            maxZoom = zoom > maxZoom ? zoom : maxZoom;
            url += [eeMapId, zoom, tile.x, tile.y].join('/');
            url += '?token=' + eeToken;
            return url;
        },
        tileSize: new google.maps.Size(256, 256)
    });

    this.map.overlayMapTypes.push(overlay);
    //this.map.fitBounds(bounds);
    //this.map.setZoom(maxZoom);

};


/**
 * Removes previously added Overlay Map Types (Used to remove Map Overlay Rainfall)
 */
myanmar.App.prototype.clearOverlays = function () {
    var overlays = this.map.overlayMapTypes;
    while (overlays[0]) {
        overlays.pop().setMap(null);
    }
    this.map.overlayMapTypes.clear();
};

/**
 * Hides results panel
 */
myanmar.App.prototype.hidePanel = function () {
    $('.results').hide();
};

/**
 * Click listener for when Selection Radio-buttons are clicked
 * @param event
 */
myanmar.App.prototype.switchStyle = function (event) {
    var html = $(event.target).html();
    var style = html.substr(html.indexOf('</i>') + 4);
    this.selectionMethod = style.toLowerCase();
    console.log("Switching to: " + this.selectionMethod);
    $('.selection-group button').html(style);
    $('#error-message').hide();
    $('.download').hide();
    $('#legend').hide();

    /*
    Reset buttons
     */
    this.clearOverlays();
    $('#overlay-button').html(myanmar.App.OVERLAY_BASE_BUTTON_NAME);
    $('#graph-button').html(myanmar.App.GRAPH_BASE_BUTTON_NAME);
    this.map.data.revertStyle();
    output.switchStyle();
};

/**
 * Returns the selected Analysing Method
 * @returns {string}
 */
myanmar.App.prototype.getProduct = function () {
    var container = $('.products-container');
    if (container.length === 0) {
        return 'null';
    } else {
        var elems = container.find('input:checked');
        var ids = [];
        elems.each(function () {
            ids.push($(this).attr('id').toUpperCase());
        });
        if (ids.length === 0) {
            console.log('No Product selected!');
            return 'error';
        }
        return ids.join(',');
    }
};

/**
 * Returns the selected Analysing Method
 * @returns {string}
 */
myanmar.App.prototype.getTimestep = function () {
    var container = $('.timesteps-container');
    if (container.length === 0) {
        return 'null';
    } else {
        var id = container.find('input:radio:checked').attr('id');
        if (id === undefined) {
            console.log('No timestep collected');
            return 'error';
        }
        return id.toLowerCase();
    }
};

/**
 * Returns the selected Analysing Method
 * @returns {string}
 */
myanmar.App.prototype.getStatistic = function () {
    var container = $('.statistics-container');
    if (container.length === 0) {
        return 'null';
    } else {
        var id = container.find('input:radio:checked').attr('id');
        if (id === undefined) {
            console.log('No statistic selected');
            return 'error';
        }
        return id.toLowerCase();
    }
};

/**
 * Returns target, JSON encoded for polygons, regular for country names
 */
myanmar.App.prototype.getTarget = function () {
    switch (this.selectionMethod) {
        case "area":
            return area.getSelectedAreas().join(',');
        case 'shapefile':
            return $('#shapefile-link').val();
        case 'coordinate':
            return markers.getJSON();
        default:
            $('#error-message').show().html('Please select a method of targeting first!');
            return 'null';
    }
};

/**
 * Validates the given shapefile link
 */
myanmar.App.prototype.validateShapefile = function () {
    var link = $('#shapefile-link').val();
    console.log('Validating: ' + link);
    $.ajax({
        url: '/shapefile?link=' + link,
        method: 'GET',
        beforeSend: function () {
            $('.validated-shapefile').hide();
        }, error: function (data) {
            error.show().html(data['error']);
        }
    }).done((function (data) {
        console.log(data);
        console.log(data['success']);
        if (data['error']) {
            error.show().html(data['error']);
        } else if (data['success'] === 'true') {
            console.log('Validated Shapefile!');
            $('.validated-shapefile').show();
            //this.addOverlay(data['mapId'], data['token']);
        }
    }).bind(this));

};

/**
 * Exports the chart data to CSV cuz dataTableToCSV is fucking gone...
 * @returns {*|string}
 */
myanmar.App.graphToCSV = function (dataTable) {
    var json = dataTable;
    var fields = Object.keys(json[0]);
    var replacer = function (key, value) {
        return value === null ? '' : value
    };
    var csv = json.map(function (row) {
        return fields.map(function (fieldName) {
            return JSON.stringify(row[fieldName], replacer)
        }).join(',')
    });
    csv.unshift(fields.join(','));
    return csv.join('\r\n');
};

myanmar.App.format = function (value) {
    return parseFloat(Math.round(value * 100.0) / 100.0).toFixed(2);
};

myanmar.App.EE_URL = 'https://earthengine.googleapis.com';

myanmar.App.SELECTED_STYLE = {strokeWeight: 4};

myanmar.App.UNSELECTED_STYLE = {
    fillOpacity: 0.0,
    strokeColor: 'black',
    strokeWeight: 1
};

myanmar.App.INACTIVE_STYLE = {
    fillOpacity: 0.0,
    strokeColor: 'black',
    strokeWeight: 0
};

myanmar.App.OVERLAY_BASE_BUTTON_NAME = 'Create Overlay';

myanmar.App.GRAPH_BASE_BUTTON_NAME = 'Create Graph';

myanmar.App.DEFAULT_CENTER = {lng: 96.95112549402336, lat: 18.00746449851361};
myanmar.App.DEFAULT_ZOOM = 6;
myanmar.App.MAX_ZOOM = 14;

myanmar.App.CHIRPS_CLIMATE = 'UCSB-CHG/CHIRPS/DAILY';
myanmar.App.TERA_EVAPOTRANSPIRATION = 'MODIS/006/MOD16A2';

