// background-randomizer.js
// Homepage-only background selection from a fixed, optimized set.
(function () {
    'use strict';

    var CURATED_BACKGROUNDS = [
        'images/bg/bg8.avif',
        'images/bg/bg5.avif',
        'images/bg/bg6.avif',
        'images/bg/bg3.avif',
        'images/bg/bg7.avif',
        'images/bg/bg4.avif',
        'images/bg/bg1.avif',
        'images/bg/bg2.webp'
    ];

    function shouldSkipDiscovery() {
        if (!navigator.connection) return false;
        return navigator.connection.saveData ||
            navigator.connection.effectiveType === 'slow-2g' ||
            navigator.connection.effectiveType === '2g' ||
            navigator.connection.effectiveType === '3g';
    }

    function pickBackground() {
        if (shouldSkipDiscovery()) return CURATED_BACKGROUNDS[0];
        var dayIndex = Math.floor(Date.now() / 86400000);
        return CURATED_BACKGROUNDS[dayIndex % CURATED_BACKGROUNDS.length];
    }

    function initBackground() {
        var heroOverlay = document.querySelector('.hero-overlay');
        if (!heroOverlay) return;

        heroOverlay.classList.add('image-bg');
        heroOverlay.style.backgroundImage = 'url("' + pickBackground() + '")';
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initBackground);
    } else {
        initBackground();
    }
})();
