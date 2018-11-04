area = {};

$(function () {

    //Get GeoJSON for all countries
    let names = [];
    $.getJSON('static/polygons/myanmar_state_region_boundaries.json', function (json) {
        json.features.forEach(function (feature) {
            names.push(feature.properties.ST);
        });
    });
    $.getJSON('static/polygons/myanmar_district_boundaries.json', function (json) {
        json.features.forEach(function (feature) {
            names.push(feature.properties.ST);
        });
    });
    $("#area-field").autocomplete({
        source: names,
        select: area.handleRegionUIClick
    });

    $('.area-table').on('click', '.remove-area', function () {
        var tr = $(this).closest('tr');
        var title = tr.find('.area-name').html();
        console.log('Removing Area: ' + title);

        tr.remove();
    });
});

/**
 * Handles click on UI, marks and sets clicked country name
 * @param event
 * @param ui
 */
area.handleRegionUIClick = function (event, ui) {
    var name = ui.item.label;
    console.log('Clicked: ' + name);

    const feature = area.getAreaFeature(name);
    area.add(feature, name);
};

area.getAreaFeature = function (name) {
    let feature = null;
    myanmar.instance.map.data.forEach(function (f) {
        if (f.getProperty('ST') === name) {
            return (f = feature);
        }
    });
    return feature;
};

/**
 * Add marker to map and
 */
area.add = function (feature, title) {
    console.log('Adding area: ' + title);

    //Draw on map
    myanmar.instance.map.data.overrideStyle(feature, myanmar.App.SELECTED_STYLE);
    feature.setProperty('active', 'true');

    //Add to table
    var tableContent = '<tr><td class="area-name">' + title + '</td><td><button class="btn btn-danger remove-area">Remove</button></td></tr>';
    $('.area-table tbody').append(tableContent);
};

/**
 * Remove an area from selec
 * @param name
 */
area.remove = function (name) {

};

