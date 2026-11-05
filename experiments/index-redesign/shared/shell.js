// Shared shell behaviour for the five INDEX prototypes (exploration only, never published):
// theme toggle (the site's own key and attribute convention: dark = no attribute, light = data-theme="light"),
// mobile menu disclosure, the production search normalisation, and one fetch of the shared dataset.
(function () {
    'use strict';
    var KEY = 'f1stories-theme';
    var root = document.documentElement;

    document.querySelectorAll('[data-ix-theme]').forEach(function (button) {
        button.addEventListener('click', function () {
            var light = root.getAttribute('data-theme') !== 'light';
            if (light) root.setAttribute('data-theme', 'light'); else root.removeAttribute('data-theme');
            try { localStorage.setItem(KEY, light ? 'light' : 'dark'); } catch (_) {}
        });
    });

    var nav = document.querySelector('.ix-nav');
    var menu = document.querySelector('[data-ix-menu]');
    if (nav && menu) {
        menu.addEventListener('click', function () {
            var open = !nav.hasAttribute('data-open');
            nav.toggleAttribute('data-open', open);
            menu.setAttribute('aria-expanded', String(open));
        });
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && nav.hasAttribute('data-open')) {
                nav.removeAttribute('data-open');
                menu.setAttribute('aria-expanded', 'false');
                menu.focus();
            }
        });
    }

    // Same rule as blog-module/blog-index.js: lower case, strip accents, final sigma → sigma.
    function norm(value) {
        return String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ς/g, 'σ');
    }
    // Every query word must appear in the title; result order stays the dataset order (newest first).
    function search(stories, query) {
        var words = norm(query).split(/\s+/).filter(Boolean);
        if (!words.length) return [];
        return stories.filter(function (story) {
            var title = norm(story.title);
            return words.every(function (word) { return title.indexOf(word) !== -1; });
        });
    }

    var pending = null;
    function load() {
        if (!pending) {
            pending = fetch('/experiments/index-redesign/shared/content.json').then(function (response) {
                if (!response.ok) throw new Error('content ' + response.status);
                return response.json();
            });
        }
        return pending;
    }

    window.IX = Object.freeze({ norm: norm, search: search, load: load });
})();
