// web-vitals-beacon.js — lightweight RUM reporter (LCP, INP, CLS, FCP, TTFB).
//
// After analytics opt-in, loads the web-vitals library from a CDN inside
// requestIdleCallback so it never competes with the LCP candidate or
// main-thread hydration. Forwards each vital to GA4 through analytics.js.
(function () {
    'use strict';

    if (!('performance' in window)) return;
    if (location.protocol === 'file:') return;

    var CONSENT_KEY = 'f1stories-cookie-consent-v1';
    var CDN_URL = 'https://unpkg.com/web-vitals@4?module';
    var bootstrapped = false;

    function hasAnalyticsConsent() {
        try {
            var consent = JSON.parse(localStorage.getItem(CONSENT_KEY));
            return !!(consent && consent.analytics === true);
        } catch (_) {
            return false;
        }
    }

    function buildParams(metric) {
        return {
            metric_name: metric.name,
            metric_value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
            metric_delta: Math.round(metric.name === 'CLS' ? metric.delta * 1000 : (metric.delta || 0)),
            metric_id: metric.id,
            metric_rating: metric.rating || 'unknown',
            nav_type: metric.navigationType || 'unknown',
            page_path: location.pathname,
            transport_type: 'beacon'
        };
    }

    function send(metric) {
        if (!hasAnalyticsConsent()) return;
        var params = buildParams(metric);
        if (typeof window.gtag === 'function') {
            try { window.gtag('event', 'web_vital', params); } catch (_) {}
        }
    }

    function bootstrap() {
        if (bootstrapped || !hasAnalyticsConsent()) return;
        bootstrapped = true;

        import(/* webpackIgnore: true */ CDN_URL).then(function (mod) {
            var hooks = [
                ['onLCP', mod.onLCP],
                ['onINP', mod.onINP],
                ['onCLS', mod.onCLS],
                ['onFCP', mod.onFCP],
                ['onTTFB', mod.onTTFB]
            ];
            hooks.forEach(function (pair) {
                if (typeof pair[1] === 'function') {
                    try { pair[1](send); } catch (_) {}
                }
            });
        }).catch(function () { /* web-vitals unavailable; no-op */ });
    }

    function whenIdle(fn) {
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(fn, { timeout: 3000 });
        } else {
            setTimeout(fn, 1);
        }
    }

    function scheduleBootstrap() {
        if (!hasAnalyticsConsent()) return;
        if (document.readyState === 'complete') {
            whenIdle(bootstrap);
        } else {
            window.addEventListener('load', function () { whenIdle(bootstrap); }, { once: true });
        }
    }

    scheduleBootstrap();

    window.addEventListener('f1stories:cookie-consent-changed', function () {
        scheduleBootstrap();
    });
})();
