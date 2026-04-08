// sw-register.js — Registers the service worker without any install prompt UI.
(function () {
    'use strict';

    if (!('serviceWorker' in navigator)) return;

    function registerServiceWorker() {
        navigator.serviceWorker.register('/sw.js').catch(function () {});
    }

    function scheduleRegistration() {
        if ('requestIdleCallback' in window) {
            requestIdleCallback(registerServiceWorker, { timeout: 2000 });
            return;
        }

        window.setTimeout(registerServiceWorker, 0);
    }

    if (document.readyState === 'complete') {
        scheduleRegistration();
        return;
    }

    window.addEventListener('load', scheduleRegistration, { once: true });
})();
