// web-vitals-beacon.js — lightweight RUM reporter (LCP, INP, CLS, FCP, TTFB).
//
// Loads the web-vitals library from a CDN inside requestIdleCallback so it
// never competes with the LCP candidate or main-thread hydration. Forwards
// each vital to Google Analytics 4 via window.gtag (provided by analytics.js).
// If gtag is not yet available, events are queued to sessionStorage and
// flushed on the next page that sees a ready gtag.
//
// Zero impact if web-vitals fails to load: the fetch is fire-and-forget.
(function () {
    'use strict';

    if (!('performance' in window)) return;
    if (location.protocol === 'file:') return;

    var QUEUE_KEY = 'f1s-vitals-queue-v1';
    var CDN_URL = 'https://unpkg.com/web-vitals@4?module';
    var MAX_QUEUE = 40;

    function readQueue() {
        try {
            var raw = sessionStorage.getItem(QUEUE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (_) { return []; }
    }

    function writeQueue(q) {
        try { sessionStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-MAX_QUEUE))); }
        catch (_) { /* quota; drop */ }
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
        var params = buildParams(metric);
        if (typeof window.gtag === 'function') {
            try { window.gtag('event', 'web_vital', params); return; }
            catch (_) { /* fall through to queue */ }
        }
        var q = readQueue();
        q.push({ t: Date.now(), params: params });
        writeQueue(q);
    }

    function flushQueue() {
        if (typeof window.gtag !== 'function') return;
        var q = readQueue();
        if (!q.length) return;
        q.forEach(function (entry) {
            try { window.gtag('event', 'web_vital', entry.params); } catch (_) {}
        });
        writeQueue([]);
    }

    function bootstrap() {
        flushQueue();

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

    if (document.readyState === 'complete') {
        whenIdle(bootstrap);
    } else {
        window.addEventListener('load', function () { whenIdle(bootstrap); }, { once: true });
    }

    window.addEventListener('f1stories:cookie-consent-changed', flushQueue);
})();
