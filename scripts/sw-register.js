// sw-register.js — Registers the service worker without any install prompt UI.
(function () {
    'use strict';

    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', function () {
        navigator.serviceWorker.register('/sw.js').catch(function () {});
    }, { once: true });
})();
