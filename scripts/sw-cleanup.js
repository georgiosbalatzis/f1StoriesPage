// The site is browser-only: no offline mode, no installable app. Earlier versions
// registered a service worker; remove it and its caches for returning visitors.
// A new file name on purpose: the v41 worker served cached scripts by pathname.
// ponytail: delete this file (and the /sw.js stub) once old workers have aged out, a few months after 2026-09.
(function () {
    'use strict';

    if (!('serviceWorker' in navigator)) return;

    var RELOAD_FLAG = 'f1s-sw-removed';

    navigator.serviceWorker.getRegistrations().then(function (registrations) {
        return Promise.all(registrations.map(function (registration) { return registration.unregister(); }));
    }).then(function () {
        if (!('caches' in window)) return false;
        return caches.keys().then(function (keys) {
            var ours = keys.filter(function (key) { return key.indexOf('f1s-') === 0; });
            // v41 (caches named -v40) answered stamped CSS/JS with its old copies, so a page it
            // controlled can be mis-styled until one uncontrolled load. v42 served fresh assets.
            var stale = ours.some(function (key) { return !/-v42$/.test(key); });
            return Promise.all(ours.map(function (key) { return caches.delete(key); })).then(function () {
                return stale && !!navigator.serviceWorker.controller;
            });
        });
    }).then(function (reload) {
        if (!reload) return;
        try {
            if (sessionStorage.getItem(RELOAD_FLAG)) return;
            sessionStorage.setItem(RELOAD_FLAG, '1');
        } catch (e) {
            return;
        }
        window.location.reload();
    }).catch(function () {});
})();
