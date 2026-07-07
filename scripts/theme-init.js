// theme-init.js - apply the stored/preferred color theme before page paint.
(function () {
    'use strict';

    var root = document.documentElement;

    try {
        var storedTheme = sessionStorage.getItem('f1stories-theme');
        if (storedTheme === 'light') {
            root.setAttribute('data-theme', 'light');
            return;
        }
        if (storedTheme === 'dark') {
            root.removeAttribute('data-theme');
            return;
        }
    } catch (_) {}

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        root.setAttribute('data-theme', 'light');
    }
})();
