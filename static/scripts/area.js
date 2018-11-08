area = {};

$(function () {

    //Get GeoJSON for all countries
    area.regions = [];
    area.districts = [];
    area.basins = [];
    $.getJSON('static/polygons/myanmar_state_region_boundaries.json', function (json) {
        json.features.forEach(function (feature) {
            area.regions.push(feature.properties.ST);
        });
    });

    $.getJSON('static/polygons/myanmar_district_boundaries.json', function (json) {
        json.features.forEach(function (feature) {
            area.districts.push(feature.properties.DT);
        });
    });

    $.getJSON('static/polygons/myanmar_basins_boundaries.json', function (json) {
        json.features.forEach(function (feature) {
            area.basins.push(feature.properties.Name);
        });
    });


    $('.area-table').on('click', '.remove-area', function () {
        var tr = $(this).closest('tr');
        var title = tr.find('.area-name').html();
        myanmar.instance.map.data.forEach(function (f) {
            if (area.getName(f) === title) {
                area.removeFromMap(f);
            }
        });
        tr.remove();
        output.reset();
    });

    $('.areas-selection input[type=radio]').change(function () {
        area.loadFeatures(this.id);
    });
});

/**
 * Resets table and removes previous loaded features (even active)
 * @param type
 * @param callback
 */
area.loadFeatures = function (type, callback) {
    myanmar.instance.map.data.forEach(function (feature) {
        // if (feature.getProperty('active') !== 'true' || feature.getProperty('ST') === 'Myanmar') {
        myanmar.instance.map.data.remove(feature);
        // }
    });

    //Clear table
    $(".area-table tbody").empty();
    output.reset();

    const areaField = $('#area-field');
    //Set auto complete
    switch (type) {
        case 'country':
            myanmar.instance.map.data.loadGeoJson('static/polygons/myanmar_country_boundaries.json');
            areaField.prop('disabled', true);
            break;
        case 'districts':
            myanmar.instance.map.data.loadGeoJson('static/polygons/myanmar_district_boundaries.json');
            areaField.prop('disabled', false);
            areaField.autocomplete({
                source: area.districts,
                select: area.handleRegionUIClick
            });
            break;
        case 'regions':
            myanmar.instance.map.data.loadGeoJson('static/polygons/myanmar_state_region_boundaries.json');
            areaField.prop('disabled', false);
            areaField.autocomplete({
                source: area.regions,
                select: area.handleRegionUIClick
            });
            break;
        case 'basins':
            myanmar.instance.map.data.loadGeoJson('static/polygons/myanmar_basins_boundaries.json');
            areaField.prop('disabled', false);
            areaField.autocomplete({
                source: area.basins,
                select: area.handleRegionUIClick
            });
            break;
    }
    //Set all to unselected style
    myanmar.instance.map.data.setStyle(function (feature) {
        if (callback != null) {
            callback();
        }
        return myanmar.App.UNSELECTED_STYLE;
    });


};

/**
 * Handles click on UI, marks and sets clicked country name
 * @param event
 * @param ui
 */
area.handleRegionUIClick = function (event, ui) {
    var name = ui.item.label;
    const feature = area.getAreaFeature(name);
    area.add(feature);
};

/**
 * Returns feature from map for given name
 */
area.getAreaFeature = function (name) {
    let feature = null;
    myanmar.instance.map.data.forEach(function (f) {
        if (area.getName(f) === name) {
            return (feature = f);
        }
    });
    return feature;
};

/**
 * Add marker to map and
 */
area.add = function (feature) {
    if (feature.getProperty('active') === 'true') {
        console.log('Already added: ');
        return;
    }

    const title = area.getName(feature);


    //Draw on map
    myanmar.instance.map.data.overrideStyle(feature, myanmar.App.SELECTED_STYLE);

    //Set to active
    feature.setProperty('active', 'true');

    //Add to table
    var tableContent = '<tr><td class="area-name">' + title + '</td><td><button class="btn btn-danger remove-area">Remove</button></td></tr>';
    $('.area-table tbody').append(tableContent);
    output.reset();
};


/**
 * Returns name of feature using the current selected filtering type
 * @param feature
 * @returns {string}
 */
area.getName = function (feature) {
    return feature.getProperty(area.getFilterSTDT());
};

area.getFilterSTDT = function () {
    return area.getSelectedAreaType() === 'basins' ? 'Name' : area.getSelectedAreaType() === 'districts' ? 'DT' : 'ST';
};

/**
 * Remove an area from map
 * @param name
 */
area.removeFromMap = function (feature) {
    console.log('Removing feature: ' + area.getName(feature));
    feature.removeProperty('active');
    //Remove draw
    myanmar.instance.map.data.overrideStyle(feature, myanmar.App.UNSELECTED_STYLE);
};

/**
 * Returns id of selected radio-checkbox
 * @returns {id}
 */
area.getSelectedAreaType = function () {
    return $('.areas-selection input:radio:checked').attr('id');
};

/**
 * Return the selected area names
 */
area.getSelectedAreas = function () {
    let names = [];
    myanmar.instance.map.data.forEach(function (f) {
        if (f.getProperty('active') === 'true') {
            names.push(area.getName(f));
        }
    });
    return names;
};

