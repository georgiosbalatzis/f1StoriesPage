// web-vitals-beacon.js - lightweight consent-gated RUM reporter.
(function () {
    'use strict';

    if (!('performance' in window)) return;
    if (location.protocol === 'file:') return;

    var CONSENT_KEY = 'f1stories-cookie-consent-v1';
    var bootstrapped = false;
    var sent = {};
    var lcpValue = 0;
    var clsValue = 0;
    var inpValue = 0;
    var observers = [];

    function hasAnalyticsConsent() {
        try {
            var consent = JSON.parse(localStorage.getItem(CONSENT_KEY));
            return !!(consent && consent.analytics === true);
        } catch (_) {
            return false;
        }
    }

    function rating(name, value) {
        var thresholds = {
            CLS: [0.1, 0.25],
            FCP: [1800, 3000],
            INP: [200, 500],
            LCP: [2500, 4000],
            TTFB: [800, 1800]
        }[name] || [0, 0];
        if (value <= thresholds[0]) return 'good';
        if (value <= thresholds[1]) return 'needs-improvement';
        return 'poor';
    }

    function navigationType() {
        var entries = performance.getEntriesByType && performance.getEntriesByType('navigation');
        return entries && entries[0] && entries[0].type || 'unknown';
    }

    function sendMetric(name, value, delta) {
        if (!hasAnalyticsConsent() || sent[name]) return;
        if (typeof window.gtag !== 'function') return;

        sent[name] = true;
        try {
            window.gtag('event', 'web_vital', {
                metric_name: name,
                metric_value: Math.round(name === 'CLS' ? value * 1000 : value),
                metric_delta: Math.round(name === 'CLS' ? (delta || value) * 1000 : (delta || value || 0)),
                metric_id: name.toLowerCase() + '-' + Date.now().toString(36),
                metric_rating: rating(name, value),
                nav_type: navigationType(),
                page_path: location.pathname,
                transport_type: 'beacon'
            });
        } catch (_) {}
    }

    function observe(type, callback) {
        if (!('PerformanceObserver' in window)) return;
        try {
            var observer = new PerformanceObserver(function (list) {
                list.getEntries().forEach(callback);
            });
            observer.observe({ type: type, buffered: true });
            observers.push(observer);
        } catch (_) {}
    }

    function reportPending() {
        if (lcpValue) sendMetric('LCP', lcpValue, lcpValue);
        if (clsValue) sendMetric('CLS', clsValue, clsValue);
        if (inpValue) sendMetric('INP', inpValue, inpValue);
    }

    function reportTtfb() {
        var entries = performance.getEntriesByType && performance.getEntriesByType('navigation');
        var nav = entries && entries[0];
        if (nav && nav.responseStart) {
            sendMetric('TTFB', Math.max(0, nav.responseStart), Math.max(0, nav.responseStart - nav.requestStart));
        }
    }

    function bootstrap() {
        if (bootstrapped || !hasAnalyticsConsent()) return;
        bootstrapped = true;

        observe('paint', function (entry) {
            if (entry.name === 'first-contentful-paint') sendMetric('FCP', entry.startTime, entry.startTime);
        });
        observe('largest-contentful-paint', function (entry) {
            lcpValue = entry.startTime || entry.renderTime || entry.loadTime || 0;
        });
        observe('layout-shift', function (entry) {
            if (!entry.hadRecentInput) clsValue += entry.value || 0;
        });
        observe('event', function (entry) {
            if (entry.interactionId && entry.duration > inpValue) inpValue = entry.duration;
        });

        if (document.readyState === 'complete') reportTtfb();
        else window.addEventListener('load', reportTtfb, { once: true });

        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'hidden') reportPending();
        });
        window.addEventListener('pagehide', reportPending);
    }

    function whenIdle(fn) {
        if ('requestIdleCallback' in window) window.requestIdleCallback(fn, { timeout: 3000 });
        else setTimeout(fn, 1);
    }

    function scheduleBootstrap() {
        if (!hasAnalyticsConsent()) return;
        if (document.readyState === 'complete') whenIdle(bootstrap);
        else window.addEventListener('load', function () { whenIdle(bootstrap); }, { once: true });
    }

    scheduleBootstrap();
    window.addEventListener('f1stories:cookie-consent-changed', scheduleBootstrap);
})();
