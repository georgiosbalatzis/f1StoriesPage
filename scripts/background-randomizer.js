// background-randomizer.js
// Dynamically picks any bg image from images/bg/ by probing bg1, bg2, bg3...
// Works regardless of format (avif/webp/jpg) or how many files exist.

document.addEventListener('DOMContentLoaded', function () {

    const heroOverlay = document.querySelector('.hero-overlay');
    if (!heroOverlay) return;

    // Apply a safe default immediately
    heroOverlay.classList.add('image-bg');
    heroOverlay.style.backgroundImage = 'url("images/bg.jpg")';

    const FORMATS = ['avif', 'webp', 'jpg', 'jpeg', 'png'];
    const MAX_PROBE = 50; // probe bg1 up to bg50, stop on first miss

    // Try to load a single path, returns a Promise<string|null>
    function tryPath(path) {
        return new Promise(function (resolve) {
            var img = new Image();
            img.onload  = function () { resolve(path); };
            img.onerror = function () { resolve(null); };
            img.src = path;
        });
    }

    // Find the first working format for a given bg name
    function findFormat(name) {
        return FORMATS.reduce(function (chain, fmt) {
            return chain.then(function (found) {
                if (found) return found;
                return tryPath('images/bg/' + name + '.' + fmt);
            });
        }, Promise.resolve(null));
    }

    // Probe bg1, bg2, bg3... until one fails — collect all that exist
    function discoverImages() {
        var found = [];
        var index = 1;

        function probe() {
            return findFormat('bg' + index).then(function (path) {
                if (path) {
                    found.push(path);
                    index++;
                    if (index <= MAX_PROBE) return probe();
                }
                return found;
            });
        }

        return probe();
    }

    function applyBackground(images) {
        if (!images.length) return;
        var pick = images[Math.floor(Math.random() * images.length)];
        heroOverlay.style.backgroundImage = "url('" + pick + "')";
    }

    var CACHE_KEY = 'f1s-bg-v1';
    var cached = null;
    try { cached = JSON.parse(sessionStorage.getItem(CACHE_KEY)); } catch (e) {}

    if (cached && cached.length) {
        applyBackground(cached);
    } else {
        discoverImages().then(function (images) {
            if (!images.length) return;
            try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(images)); } catch (e) {}
            applyBackground(images);
        });
    }

});
