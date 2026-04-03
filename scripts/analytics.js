// analytics.js — Loads GA only after analytics consent has been granted.
(function () {
    'use strict';

    var TRACKING_ID = 'G-X68J6MQKSM';
    var STORAGE_KEY = 'f1stories-cookie-consent-v1';
    var SCRIPT_SRC = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(TRACKING_ID);
    var scriptInjected = false;
    var analyticsConfigured = false;

    window['ga-disable-' + TRACKING_ID] = true;

    function readConsent() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY));
        } catch (_) {
            return null;
        }
    }

    function ensureGtag() {
        window.dataLayer = window.dataLayer || [];
        if (typeof window.gtag !== 'function') {
            window.gtag = function () {
                window.dataLayer.push(arguments);
            };
        }
    }

    function injectScript() {
        if (scriptInjected) return;
        scriptInjected = true;

        var script = document.createElement('script');
        script.async = true;
        script.src = SCRIPT_SRC;
        document.head.appendChild(script);
    }

    function enableAnalytics() {
        window['ga-disable-' + TRACKING_ID] = false;
        ensureGtag();
        injectScript();

        if (!analyticsConfigured) {
            window.gtag('js', new Date());
            window.gtag('config', TRACKING_ID);
            analyticsConfigured = true;
            return;
        }

        window.gtag('consent', 'update', {
            analytics_storage: 'granted'
        });
    }

    function disableAnalytics() {
        window['ga-disable-' + TRACKING_ID] = true;
        if (typeof window.gtag === 'function') {
            window.gtag('consent', 'update', {
                analytics_storage: 'denied'
            });
        }
    }

    function syncAnalytics(consent) {
        if (consent && consent.analytics) {
            enableAnalytics();
            return;
        }
        disableAnalytics();
    }

    syncAnalytics(readConsent());

    window.addEventListener('f1stories:cookie-consent-changed', function (event) {
        syncAnalytics(event.detail || readConsent());
    });
})();
