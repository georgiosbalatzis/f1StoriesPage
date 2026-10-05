(function () {
    'use strict';

    var target = document.querySelector('meta[name="f1s-redirect-target"]');
    var url = target ? target.getAttribute('content') : '';

    if (url) {
        var targetUrl = new URL(url, window.location.href);
        targetUrl.search = window.location.search;
        targetUrl.hash = window.location.hash;
        var fallback = document.querySelector('body a');
        if (fallback) fallback.href = targetUrl.href;
        window.location.replace(targetUrl.href);
    }
})();
