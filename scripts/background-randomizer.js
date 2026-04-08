(function () {
    'use strict';

    var CURATED_BACKGROUNDS = [
        { desktop: { avif: '/images/bg/bg8.avif', webp: '/images/bg/bg8.webp' }, mobile: { avif: '/images/bg/bg8-mobile.avif', webp: '/images/bg/bg8-mobile.webp' }, desktopWidth: 1617, mobileWidth: 768 },
        { desktop: { avif: '/images/bg/bg5.avif', webp: '/images/bg/bg5.webp' }, mobile: { avif: '/images/bg/bg5-mobile.avif', webp: '/images/bg/bg5-mobile.webp' }, desktopWidth: 2560, mobileWidth: 768 },
        { desktop: { avif: '/images/bg/bg6.avif', webp: '/images/bg/bg6.webp' }, mobile: { avif: '/images/bg/bg6-mobile.avif', webp: '/images/bg/bg6-mobile.webp' }, desktopWidth: 1917, mobileWidth: 768 },
        { desktop: { avif: '/images/bg/bg3.avif', webp: '/images/bg/bg3.webp' }, mobile: { avif: '/images/bg/bg3-mobile.avif', webp: '/images/bg/bg3-mobile.webp' }, desktopWidth: 1920, mobileWidth: 768 },
        { desktop: { avif: '/images/bg/bg7.avif', webp: '/images/bg/bg7.webp' }, mobile: { avif: '/images/bg/bg7-mobile.avif', webp: '/images/bg/bg7-mobile.webp' }, desktopWidth: 1200, mobileWidth: 768 },
        { desktop: { avif: '/images/bg/bg4.avif', webp: '/images/bg/bg4.webp' }, mobile: { avif: '/images/bg/bg4-mobile.avif', webp: '/images/bg/bg4-mobile.webp' }, desktopWidth: 2048, mobileWidth: 768 },
        { desktop: { avif: '/images/bg/bg1.avif', webp: '/images/bg/bg1.webp' }, mobile: { avif: '/images/bg/bg1-mobile.avif', webp: '/images/bg/bg1-mobile.webp' }, desktopWidth: 1125, mobileWidth: 768 },
        { desktop: { avif: '/images/bg/bg2.avif', webp: '/images/bg/bg2.webp' }, mobile: { avif: '/images/bg/bg2-mobile.avif', webp: '/images/bg/bg2-mobile.webp' }, desktopWidth: 1600, mobileWidth: 768 }
    ];

    function getDayOfYear(now) {
        var current = now || new Date();
        var startOfYear = Date.UTC(current.getFullYear(), 0, 0);
        var today = Date.UTC(current.getFullYear(), current.getMonth(), current.getDate());
        return Math.max(1, Math.floor((today - startOfYear) / 86400000));
    }

    function pickBackground() {
        var curated = window.__F1StoriesHeroBackgrounds || CURATED_BACKGROUNDS;
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

        heroImage.sizes = '100vw';
        heroImage.src = selection.desktop.webp || selection.mobile.webp || heroImage.src;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initBackground, { once: true });
    } else {
        initBackground();
    }
})();
