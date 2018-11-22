products = {};

products.reset = function (output) {
    var options = $('.create-options');
    this.removeFrom(options);
    if (output === 'graph') {
        switch (myanmar.instance.selectionMethod) {
            case 'area':
                this.addTo(output, options);
                break;
            case 'shapefile':
                this.addTo(output, options);
                break;
            case 'coordinate':
                this.addTo(output, options);
                break;
        }
    } else if (output === 'overlay') {
        switch (myanmar.instance.selectionMethod) {
            case 'area':
                this.addTo(output, options);
                break;
            case 'shapefile':
                this.addTo(output, options);
                break;
            case 'coordinate':
                break;
        }
    }
};

products.addTo = function (output, element) {
    const sm = myanmar.instance.selectionMethod;
    let radio = output === 'graph' ? 'checkbox' : 'radio';
    const rowCount = sm === 'area' ? $('.area-table tbody').find('tr').length
        : sm === 'coordinate' ? $('.markers-table tbody').find('tr').length : 0;
    console.log('Table length: ' + rowCount);
    if (rowCount > 1) {
        radio = 'radio'
    }
    if (element.find('.products-container').length === 0) {
        element.prepend(products.html(radio));
    }
};

products.removeFrom = function (element) {
    element.find('.products-container').remove();
};

products.updateTo = function (radio) {
    const remove = radio === 'radio' ? 'checkbox' : 'radio';
    const divs = $('.products-container .custom-control');
    divs.each(function (i, el) {
        $(el).removeClass('custom-' + remove);
        $(el).addClass('custom-' + radio);
        $(el).find('input').attr('type', radio);
    })
};

products.html = function (radio) {
    return '<div class="products-container form-group">\n' +
        '                            <label class="bold" for="products">Choose Product</label>\n' +
        '                            <div id="products">\n' +
        '                                <div class="custom-control custom-' + radio + ' custom-control-inline">\n' +
        '                                    <input type="' + radio + '" id="PERSIANN" name="product" class="custom-control-input">\n' +
        '                                    <label class="custom-control-label" for="PERSIANN">PERSIANN</label>\n' +
        '                                </div>\n' +
        '                                <div class="custom-control custom-' + radio + ' custom-control-inline">\n' +
        '                                    <input type="' + radio + '" id="CHIRPS" name="product" class="custom-control-input">\n' +
        '                                    <label class="custom-control-label" for="CHIRPS">CHIRPS</label>\n' +
        '                                </div>\n' +
        '                                <div class="custom-control custom-' + radio + ' custom-control-inline">\n' +
        '                                    <input type="' + radio + '" id="CFSV2" name="product" class="custom-control-input">\n' +
        '                                    <label class="custom-control-label" for="CFSV2">CFSV2</label>\n' +
        '                                </div>\n' +
        '                                <div class="custom-control custom-' + radio + ' custom-control-inline">\n' +
        '                                    <input type="' + radio + '" id="GLDAS" name="product" class="custom-control-input">\n' +
        '                                    <label class="custom-control-label" for="GLDAS">GLDAS</label>\n' +
        '                                </div>\n' +
        '                                <div class="custom-control custom-' + radio + ' custom-control-inline">\n' +
        '                                    <input type="' + radio + '" id="TRMM" name="product" class="custom-control-input">\n' +
        '                                    <label class="custom-control-label" for="TRMM">TRMM</label>\n' +
        '                                </div>\n' +
        '                            </div>\n' +
        '                        </div>';
};