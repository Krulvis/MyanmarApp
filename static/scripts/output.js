output = {};

$(function () {

    output.type = 'graph';

    $('.create-buttons .nav-item').on('click', output.switchOutput.bind(this));
});

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