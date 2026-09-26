// theme-init.js - apply the stored/preferred color theme before page paint.
(function () {
    'use strict';

    var root = document.documentElement;
    var THEME_KEY = 'f1stories-theme';

    // A filtered Journal link opens on its results: the archive hides its front page
    // before first paint (blog-index.js keeps this attribute in sync afterwards).
    if (/[?&](?:category|author)=/.test(window.location.search)) root.setAttribute('data-journal-filtered', '');

    function readStoredTheme() {
        var storedTheme = '';

        try {
            storedTheme = localStorage.getItem(THEME_KEY) || '';
        } catch (_) {}

        if (storedTheme === 'light' || storedTheme === 'dark') return storedTheme;

        try {
            storedTheme = sessionStorage.getItem(THEME_KEY) || '';
            if (storedTheme === 'light' || storedTheme === 'dark') {
                try {
                    localStorage.setItem(THEME_KEY, storedTheme);
                    sessionStorage.removeItem(THEME_KEY);
                } catch (_) {}
                return storedTheme;
            }
        } catch (_) {}

        return '';
    }

    var storedTheme = readStoredTheme();
    if (storedTheme === 'light') {
        root.setAttribute('data-theme', 'light');
        return;
    }
    if (storedTheme === 'dark') {
        root.removeAttribute('data-theme');
        return;
    }

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        root.setAttribute('data-theme', 'light');
    }
})();
