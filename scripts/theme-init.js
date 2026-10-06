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

    function applyTheme() {
        var storedTheme = readStoredTheme();
        if (storedTheme === 'light') {
            root.setAttribute('data-theme', 'light');
        } else if (storedTheme === 'dark') {
            root.removeAttribute('data-theme');
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            root.setAttribute('data-theme', 'light');
        } else {
            root.removeAttribute('data-theme');
        }
    }

    applyTheme();

    // Standings embeds: flag the root before paint so CSS can match its color-scheme to the host
    // article (a mismatch makes the browser paint an opaque canvas), and follow the host's theme toggle
    // live. The toggle writes localStorage, which fires `storage` in same-origin iframes.
    if (/[?&]embed=1(?:&|$)/.test(window.location.search) && /^\/standings\//.test(window.location.pathname)) {
        root.setAttribute('data-embed', '1');
        window.addEventListener('storage', function (event) {
            if (event.key === THEME_KEY) applyTheme();
        });
    }
})();
