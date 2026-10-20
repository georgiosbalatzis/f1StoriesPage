// One consent-gated reporter; the official library stays off the initial request path.
(function () {
    'use strict';
    if (location.protocol === 'file:' || window.f1storiesVitalsScheduled) return;
    window.f1storiesVitalsScheduled = true;
    var key = 'f1stories-cookie-consent-v1';
    var scheduled = false;
    var loaded = false;
    var existing = consent();
    function consent() {
        try { return JSON.parse(localStorage.getItem(key)).analytics === true; }
        catch (_) { return false; }
    }
    function load() {
        scheduled = false;
        if (loaded || !consent()) return;
        loaded = true;
        import(RUM_COLLECTOR_URL).then(function (collector) {
            if (consent()) collector.start(existing);
        }).catch(function () { /* No telemetry when the local asset is unavailable. */ });
    }
    function schedule() {
        if (loaded || scheduled || !consent()) return;
        scheduled = true;
        function idle() {
            if ('requestIdleCallback' in window) window.requestIdleCallback(load, { timeout: 3000 });
            else setTimeout(load, 1);
        }
        if (document.readyState === 'complete') idle();
        else window.addEventListener('load', idle, { once: true });
    }
    schedule();
    window.addEventListener('f1stories:cookie-consent-changed', schedule);
    window.addEventListener('storage', function (event) {
        if (event.key === key || event.key === null) schedule();
    });
})();
