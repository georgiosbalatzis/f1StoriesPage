(function () {
    'use strict';

    function getDayOfYear(now) {
        var current = now || new Date();
        var startOfYear = Date.UTC(current.getFullYear(), 0, 0);
        var today = Date.UTC(current.getFullYear(), current.getMonth(), current.getDate());
        return Math.max(1, Math.floor((today - startOfYear) / 86400000));
    }

    function pickBackground() {
        var curated = window.__F1StoriesHeroBackgrounds || [];
        if (!curated.length) return null;
        if (window.__F1StoriesHeroBackground) return window.__F1StoriesHeroBackground;
        var dayOfYear = getDayOfYear(new Date());
        var selected = curated[(dayOfYear - 1) % curated.length];
        window.__F1StoriesHeroBackground = selected;
        return selected;
    }

    function buildSrcSet(format, selection) {
        if (!selection || !selection.mobile || !selection.desktop) return '';
        if (!selection.mobile[format] || !selection.desktop[format]) return '';
        return selection.mobile[format] + ' ' + String(selection.mobileWidth || 768) + 'w, ' +
            selection.desktop[format] + ' ' + String(selection.desktopWidth || 1280) + 'w';
    }

    function syncPreload(selection, avifSrcSet, webpSrcSet) {
        var preload = document.getElementById('hero-image-preload');
        var preloadHref;
        var preloadSrcSet;

        if (!preload || !selection) return;

        preloadHref = selection.desktop.avif || selection.mobile.avif || selection.desktop.webp || selection.mobile.webp || '';
        preloadSrcSet = avifSrcSet || webpSrcSet || '';

        if (preloadHref) {
            preload.href = preloadHref;
        } else {
            preload.removeAttribute('href');
        }

        if (preloadSrcSet) {
            preload.setAttribute('imagesrcset', preloadSrcSet);
            preload.setAttribute('imagesizes', '100vw');
        } else {
            preload.removeAttribute('imagesrcset');
        }
    }

    function initBackground() {
        var avifSource = document.getElementById('hero-source-avif');
        var webpSource = document.getElementById('hero-source-webp');
        var heroImage = document.getElementById('hero-image');
        var selection = pickBackground();
        var avifSrcSet;
        var webpSrcSet;

        if (!avifSource || !webpSource || !heroImage || !selection) return;

        avifSrcSet = buildSrcSet('avif', selection);
        webpSrcSet = buildSrcSet('webp', selection);

        if (avifSrcSet) {
            avifSource.srcset = avifSrcSet;
        } else {
            avifSource.removeAttribute('srcset');
        }

        if (webpSrcSet) {
            webpSource.srcset = webpSrcSet;
            heroImage.srcset = webpSrcSet;
        }

        syncPreload(selection, avifSrcSet, webpSrcSet);
        heroImage.sizes = '100vw';
        heroImage.src = selection.desktop.webp || selection.mobile.webp || heroImage.src;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initBackground, { once: true });
    } else {
        initBackground();
    }
})();
