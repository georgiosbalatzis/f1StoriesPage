// background-randomizer.js
// Homepage-only background discovery with persistent caching.
(function () {
    'use strict';

    var FORMATS = ['avif', 'webp', 'jpg', 'jpeg', 'png'];
    var MAX_PROBE = 50;
    var CACHE_KEY = 'f1s-bg-v2';
    var CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

    function readCache() {
        try {
            var cached = JSON.parse(localStorage.getItem(CACHE_KEY));
            if (cached && cached.ts && Date.now() - cached.ts < CACHE_TTL && Array.isArray(cached.images) && cached.images.length) {
                return cached.images;
            }
        } catch (_) {}
        return null;
    }

    function writeCache(images) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                ts: Date.now(),
                images: images
            }));
        } catch (_) {}
    }

    function shouldSkipDiscovery() {
        if (!navigator.connection) return false;
        return navigator.connection.saveData ||
            navigator.connection.effectiveType === 'slow-2g' ||
            navigator.connection.effectiveType === '2g';
    }

    function tryPath(path) {
        return new Promise(function (resolve) {
            var img = new Image();
            img.onload = function () { resolve(path); };
            img.onerror = function () { resolve(null); };
            img.src = path;
        });
    }

    function findFormat(name) {
        return FORMATS.reduce(function (chain, format) {
            return chain.then(function (found) {
                if (found) return found;
                return tryPath('images/bg/' + name + '.' + format);
            });
        }, Promise.resolve(null));
    }

    function discoverImages() {
        var found = [];
        var index = 1;

        function probe() {
            return findFormat('bg' + index).then(function (path) {
                if (path) {
                    found.push(path);
                    index += 1;
                    if (index <= MAX_PROBE) return probe();
                }
                return found;
            });
        }

        return probe();
    }

    function applyBackground(heroOverlay, images) {
        if (!images || !images.length) return;
        var pick = images[Math.floor(Math.random() * images.length)];
        heroOverlay.style.backgroundImage = 'url("' + pick + '")';
    }

    function queueDiscovery(heroOverlay) {
        var runDiscovery = function () {
            discoverImages().then(function (images) {
                if (!images.length) return;
                writeCache(images);
                applyBackground(heroOverlay, images);
            });
        };

        if ('requestIdleCallback' in window) {
            requestIdleCallback(runDiscovery, { timeout: 2000 });
            return;
        }

        window.addEventListener('load', function () {
            window.setTimeout(runDiscovery, 0);
        }, { once: true });
    }

    function initBackground() {
        var heroOverlay = document.querySelector('.hero-overlay');
        if (!heroOverlay) return;

        heroOverlay.classList.add('image-bg');
        heroOverlay.style.backgroundImage = 'url("images/bg/bg1.webp")';

        var cachedImages = readCache();
        if (cachedImages) {
            applyBackground(heroOverlay, cachedImages);
            return;
        }

        if (shouldSkipDiscovery()) return;
        queueDiscovery(heroOverlay);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initBackground);
    } else {
        initBackground();
    }
})();
