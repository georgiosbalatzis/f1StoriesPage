// Official Web Vitals collector, loaded by the consent/load/idle gate.
import { onLCP, onINP, onCLS, onFCP, onTTFB } from 'web-vitals';

export function start(existingConsent) {
    'use strict';

    if (!('performance' in window) || location.protocol === 'file:') return;

    var CONSENT_KEY = 'f1stories-cookie-consent-v1';
    var IMPLEMENTATION = 'wv6.2.3-rum1';
    var bootstrapped = false;
    var withdrawn = false;
    var previous = {};
    var observationStart;
    var observedRestore = false;
    var viewport;

    function hasAnalyticsConsent() {
        try {
            var consent = JSON.parse(localStorage.getItem(CONSENT_KEY));
            return !!(consent && consent.analytics === true);
        } catch (_) {
            return false;
        }
    }

    function pageGroup() {
        var path = location.pathname;
        if (path === '/' || path === '/index.html') return 'home';
        if (path.indexOf('/blog-module/blog-entries/') === 0) return 'article';
        if (path.indexOf('/blog-module/blog/') === 0) return 'edition';
        if (path.indexOf('/standings/') === 0) return 'standings';
        return 'other';
    }

    function captureViewport() {
        viewport = window.innerWidth < 768 ? 'mobile_like' : 'desktop_like';
    }

    function report(metric) {
        if (!hasAnalyticsConsent()) {
            withdrawn = true;
            return;
        }
        if (withdrawn || !window.f1storiesAnalytics || !Number.isFinite(metric.value) || metric.value < 0) return;
        var last = previous[metric.name];
        if (last && last.id === metric.id && last.value === metric.value) return;
        var revision = last && last.id === metric.id ? last.revision + 1 : 1;
        previous[metric.name] = { id: metric.id, value: metric.value, revision: revision };

        // Updates share the library ID: reports must select the LAST revision per ID.
        window.f1storiesAnalytics.trackEvent('web_vital', {
            metric_name: metric.name,
            metric_value: metric.name === 'CLS' ? metric.value * 1000 : metric.value,
            metric_id: metric.id,
            metric_rating: metric.rating,
            nav_type: metric.navigationType,
            page_group: pageGroup(),
            viewport_category: viewport,
            measurement_version: IMPLEMENTATION,
            metric_revision: revision,
            nav_start_ms: Math.round(performance.timeOrigin + metric.navigationStartTime),
            measurement_coverage: observedRestore
                ? 'bfcache_observed' : existingConsent ? 'delayed_existing' : 'delayed_consent',
            observation_start_ms: observedRestore ? 0 : observationStart
        });
    }

    function bootstrap() {
        if (bootstrapped || withdrawn || !hasAnalyticsConsent()) return;
        bootstrapped = true;
        observationStart = Math.round(performance.now());
        captureViewport();
        // Default callbacks report at lifecycle boundaries, not every provisional change.
        onLCP(report);
        onINP(report);
        onCLS(report);
        onFCP(report);
        onTTFB(report);
    }

    function checkConsent() {
        if (!hasAnalyticsConsent()) withdrawn = true;
    }

    window.addEventListener('pageshow', function (event) {
        if (!event.persisted) return;
        observedRestore = true;
        captureViewport();
        checkConsent();
    }, true);
    window.addEventListener('f1stories:cookie-consent-changed', checkConsent);
    window.addEventListener('storage', function (event) {
        if (event.key === CONSENT_KEY || event.key === null) checkConsent();
    });
    bootstrap();
}
