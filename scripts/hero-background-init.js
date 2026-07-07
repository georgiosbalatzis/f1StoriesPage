(function () {
    'use strict';

    var HERO_BACKGROUNDS = [
        {
            desktop: { avif: '/images/bg/bg3.avif', webp: '/images/bg/bg3.webp' },
            mobile: { avif: '/images/bg/bg3-mobile.avif', webp: '/images/bg/bg3-mobile.webp' },
            desktopWidth: 1920,
            mobileWidth: 768,
            position: '61% center',
            mobilePosition: '20% center'
        },
        {
            desktop: { avif: '/images/bg/bg5.avif', webp: '/images/bg/bg5.webp' },
            mobile: { avif: '/images/bg/bg5-mobile.avif', webp: '/images/bg/bg5-mobile.webp' },
            desktopWidth: 2560,
            mobileWidth: 768,
            position: '66% center',
            mobilePosition: '56% center'
        },
        {
            desktop: { avif: '/images/bg/bg2.avif', webp: '/images/bg/bg2.webp' },
            mobile: { avif: '/images/bg/bg2-mobile.avif', webp: '/images/bg/bg2-mobile.webp' },
            desktopWidth: 1600,
            mobileWidth: 768,
            position: '68% center',
            mobilePosition: '55% center'
        },
        {
            desktop: { avif: '/images/bg/bg4.avif', webp: '/images/bg/bg4.webp' },
            mobile: { avif: '/images/bg/bg4-mobile.avif', webp: '/images/bg/bg4-mobile.webp' },
            desktopWidth: 2048,
            mobileWidth: 768,
            position: '67% center',
            mobilePosition: '56% center'
        },
        {
            desktop: { avif: '/images/bg/bg1.avif', webp: '/images/bg/bg1.webp' },
            mobile: { avif: '/images/bg/bg1-mobile.avif', webp: '/images/bg/bg1-mobile.webp' },
            desktopWidth: 1125,
            mobileWidth: 768,
            position: '74% center',
            mobilePosition: '60% center'
        }
    ];

    function getDayOfYear(now) {
        var startOfYear = Date.UTC(now.getFullYear(), 0, 0);
        var today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
        return Math.max(1, Math.floor((today - startOfYear) / 86400000));
    }

    function buildSrcSet(format, selection) {
        if (!selection || !selection.mobile || !selection.desktop) return '';
        if (!selection.mobile[format] || !selection.desktop[format]) return '';
        return selection.mobile[format] + ' ' + String(selection.mobileWidth || 768) + 'w, ' +
            selection.desktop[format] + ' ' + String(selection.desktopWidth || 1280) + 'w';
    }

    function syncPreload(selection) {
        var preload = document.getElementById('hero-image-preload');
        var srcSet = buildSrcSet('avif', selection) || buildSrcSet('webp', selection);
        var href = selection.desktop.avif || selection.mobile.avif || selection.desktop.webp || selection.mobile.webp || '';

        if (!preload) return;

        if (href) {
            preload.href = href;
        } else {
            preload.removeAttribute('href');
        }

        if (srcSet) {
            preload.setAttribute('imagesrcset', srcSet);
            preload.setAttribute('imagesizes', '100vw');
        } else {
            preload.removeAttribute('imagesrcset');
        }
    }

    function selectBackground() {
        var backgrounds = window.__F1StoriesHeroBackgrounds || [];
        var dayOfYear;
        var selected;

        if (!backgrounds.length) return null;

        dayOfYear = getDayOfYear(new Date());
        selected = backgrounds[(dayOfYear - 1) % backgrounds.length];
        window.__F1StoriesHeroBackground = selected;
        return selected;
    }

    function applyBackground(selection) {
        if (!selection) return;
        document.documentElement.style.setProperty('--f1s-hero-position', selection.position || 'center center');
        document.documentElement.style.setProperty(
            '--f1s-hero-mobile-position',
            selection.mobilePosition || selection.position || 'center center'
        );
        syncPreload(selection);
    }

    window.__F1StoriesHeroBackgrounds = HERO_BACKGROUNDS;
    applyBackground(selectBackground());
})();
