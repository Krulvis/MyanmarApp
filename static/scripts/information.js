$(function () {
    $('.information').on('click', function () {
        var req = new XMLHttpRequest();
        req.open("GET", "/static/Info_text.pdf", true);
        req.responseType = "blob";

        req.onload = function (event) {
            var blob = req.response;
            console.log(blob.size);
            var link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.download = "RainMyanmar_Information.pdf";
            document.body.appendChild(link);
            link.click();
        };

        req.send();
    });
});

