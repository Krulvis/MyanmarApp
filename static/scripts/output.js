output = {};

$(function () {


    output.type = 'graph';

    $('.create-buttons .nav-item').on('click', output.switchOutput.bind(this));

});

/**
 * Click listener for when Selection Radio-buttons are clicked
 * @param event
 */
output.switchStyle = function () {

    var overlayTab = $('#overlay-tab');
    var graphTab = $('#graph-tab');
    /*
    Change settings
     */
    switch (this.selectionMethod) {
        case 'coordinate':
            overlayTab.addClass('disabled');
            graphTab.tab('show');//Force going to graph
            this.map.data.revertStyle();
            area.draw(true);
            break;
        case 'area':
            overlayTab.removeClass('disabled');
            this.map.data.revertStyle();
            area.draw(false);
            //TODO MARK WHOLE COUNTRY
            if (this.selectedCountry != null) {
                this.map.data.overrideStyle(this.selectedCountry, myanmar.App.SELECTED_STYLE);
            }
            break;
        case 'shapefile':
            overlayTab.removeClass('disabled');
            this.map.data.revertStyle();
            break;
    }
    output.reset();
};

/**
 * Changes the option menu depending on which type= [overlay/graph] is clicked
 * @param event
 */
output.switchOutput = function (event) {
    const type = $(event.target).text().toLowerCase();
    console.log('Reset output for: ' + type);
    output.type = type;
    timesteps.reset(type);
    statistics.reset(type);
    products.reset(type);
};

/**
 * Resets the output option menu on any other event
 */
output.reset = function () {
    const type = output.getActiveOutput();
    console.log('Reset output for: ' + type);
    output.type = type;
    timesteps.reset(type);
    statistics.reset(type);
    products.reset(type);
};
/**
 *  Returns the element of the current opened tab
 * @returns {jQuery.fn.init|jQuery|HTMLElement}
 */
output.getActiveTab = function () {
    return $('.create-buttons .nav-item .show');
};

/**
 * Returns the name of the current opened output
 * @returns {string}
 */
output.getActiveOutput = function () {
    return output.getActiveTab().text().toLowerCase();
};