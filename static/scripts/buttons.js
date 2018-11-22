buttons = {};

$(function () {
    buttons.getDownloadButton().click(function () {
        buttons.download(this);
    });
});

buttons.reset = function (output) {
    switch (output) {
        case 'graph':
            buttons.getGraphButton().show();
            buttons.getOverlayButton().hide();
            break;
        case 'overlay':
            buttons.getGraphButton().hide();
            buttons.getOverlayButton().show();
            break;
    }
};

buttons.getGraphButton = function () {
    return $('#graph-button');
};

buttons.getOverlayButton = function () {
    return $('#overlay-button');
};

buttons.getDownloadButton = function () {
    return $('#download-button');
};

buttons.disableDownload = function () {
    buttons.getDownloadButton().addClass('disabled');
    buttons.getDownloadButton().removeAttr('href');
};

buttons.activateDownload = function () {
    buttons.getDownloadButton().removeClass('disabled');
};

buttons.setDownloadButton = function (output) {
    const button = buttons.getDownloadButton();
    button.html('<i class="far fa-save fa-lg"></i> Download ' + (output === 'graph' ? 'CSV' : 'IMG'));
};

buttons.download = function (button) {
    console.log('Downloading...');
    const hrefAttr = $(button).attr('href');
    if (hrefAttr !== undefined && hrefAttr !== false) {
        console.log('Downloading ImG');
        button.href = hrefAttr;
    } else {
        console.log('Downloading CSV');
        var csvFormattedDataTable = myanmar.App.graphToCSV(myanmar.instance.chartData);
        button.href = 'data:application/csv;charset=utf-8,' + encodeURIComponent(csvFormattedDataTable);
        button.download = 'table-data.csv';
        button.target = '_blank';
    }

};