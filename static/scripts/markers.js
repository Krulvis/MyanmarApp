markers = {};

$(function () {
    $('.markers-table').on('click', '.remove-marker', function () {
        var tr = $(this).closest('tr');
        var position = tr.find('.latlng').html();
        console.log('Removing Marker: ' + position);
        var markers = [];
        myanmar.instance.markers.forEach(function (marker) {
            if (marker.getPosition().toString() !== position) {
                markers.push(marker);
            } else {
                console.log("Removed at: " + marker.index);
                marker.setMap(null);
            }
        });
        myanmar.instance.markers = markers;
        tr.remove();
    });
});

/**
 * Enable or disable drawing the markers, used when switching styles
 * @param draw
 */
markers.draw = function (draw) {
    if (draw) {
        var map = myanmar.instance.map;
        myanmar.instance.markers.forEach(function (marker) {
            marker.setMap(map);
        });
    } else {
        myanmar.instance.markers.forEach(function (marker) {
            marker.setMap(null);
        });
    }
};

/**
 * Adds a marker for filled in values
 */
markers.addMarkerFromForm = function () {
    const lat = $('#lat').val();
    const lng = $('#lng').val();
    const title = $('#title').val();
    if (lat === '' || lng === '' || title === '') {
        $('#error-message').show().html('Please enter a valid Latitude, Longitude and Title');
    } else {
        $('#error-message').hide();
        markers.addMarker(lng, lat, title);
    }
};

/**
 * Add marker to List and Table
 */
markers.addMarkerFromLng = function (lnglat, title) {
    if (title === '') {
        title = myanmar.instance.markers.length.toString();
    }
    var marker = new google.maps.Marker({
        position: lnglat,
        map: myanmar.instance.map,
        title: title
    });
    console.log('Added marker: ' + marker.getTitle());
    myanmar.instance.markers.push(marker);
    var tableContent = '<tr><td class="LngLat">' + lnglat + '</td><td class="title">' + title + '</td><td><button class="btn btn-danger remove-marker">Remove</button></td></tr>';
    $('.markers-table tbody').append(tableContent);
    output.reset();
};

/**
 * Add marker
 */
markers.addMarker = function (lng, lat, title) {
    //nameing WTF WHY IS IT THE OPOSITE WAYY>..
    var position = new google.maps.LatLng(lat, lng);
    markers.addMarkerFromLng(position, title)
};

/**
 * Returns JSON of all markers for EE
 */
markers.getJSON = function () {
    var features = $.map(myanmar.instance.markers, function (marker) {
        var temp = {
            "type": "Feature",
            "properties": {
                "title": "Point",
                "id": "point"
            },
            "geometry": {
                "type": "Point",
                "coordinates": []
            }
        };
        temp.properties.title = marker.getTitle();
        var position = marker.getPosition();
        temp.geometry.coordinates = [position.lng(), position.lat()];
        return temp;
    });
    var data = {'features': features};
    var json = JSON.stringify(data);
    return json;
};

markers.chartData = [
    [
        "Month",
        "1",
        "2",
        "3"
    ],
    [
        "01-2017",
        2.856086600571871,
        33.24793869256973,
        0.3191777663305402
    ],
    [
        "02-2017",
        0.03792887204326689,
        100.31480434536934,
        1.6239589303731918
    ],
    [
        "03-2017",
        0.2154056765139103,
        253.93399512767792,
        2.780170165002346
    ],
    [
        "04-2017",
        0.5842667557299137,
        251.4244943857193,
        38.33665423095226
    ],
    [
        "05-2017",
        2.2078846246004105,
        212.5741709768772,
        137.94437164068222
    ],
    [
        "06-2017",
        7.848537530750036,
        36.9533856138587,
        1.8245152765884995
    ],
    [
        "07-2017",
        22.727295875549316,
        42.81465528905392,
        2.25284555926919
    ],
    [
        "08-2017",
        4.196191355586052,
        220.31073558330536,
        246.72935193777084
    ],
    [
        "09-2017",
        1.1168376579880714,
        278.2508134841919,
        180.01068380475044
    ],
    [
        "10-2017",
        9.757962703704834,
        216.72192466259003,
        21.93536625802517
    ],
    [
        "11-2017",
        1.5315435733646154,
        211.1272712647915,
        2.9051994383335114
    ],
    [
        "12-2017",
        9.426948010921478,
        29.98988765478134,
        0.3725663162767887
    ]
];

