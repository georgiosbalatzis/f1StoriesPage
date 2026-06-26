(function () {
    'use strict';

    var target = document.querySelector('meta[name="f1s-redirect-target"]');
    var url = target ? target.getAttribute('content') : '';

    if (url) {
        window.location.replace(url);
    }
})();
