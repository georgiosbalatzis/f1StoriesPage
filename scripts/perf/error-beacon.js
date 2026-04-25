(function () {
    'use strict';

    if (location.protocol === 'file:') return;

    var QUEUE_KEY = 'f1s-error-queue-v1';
    var COUNT_KEY = 'f1s-err-count';
    var PRIVATE_PATH_RE = /\/(?:auth|login|session|token|oauth|pass)/i;

    function cleanUrl(value) {
        if (!value) return '';
        try {
            value = new URL(value, location.href);
            value = PRIVATE_PATH_RE.test(value.pathname) ? '/[r]' : value.pathname;
            return value.origin === location.origin ? value : value.origin + value;
        } catch (_) {
            return String(value).replace(/[?#].*$/, '');
        }
    }

    function cleanText(value, maxLen) {
        return String(value || '')
            .replace(/https?:\/\/\S+/g, cleanUrl)
            .slice(0, maxLen || 220);
    }

    function firstFrame(stack) {
        stack = String(stack || '').split('\n');
        for (var i = 0, line; i < stack.length; i++) {
            line = stack[i].trim();
            if (line && !/^error\b/i.test(line)) return cleanText(line);
        }
        return '';
    }

    function send(params) {
        if (typeof gtag === 'function') {
            try { return gtag('event', 'js_error', params); } catch (_) {}
        }
        try {
            var queue = JSON.parse(sessionStorage.getItem(QUEUE_KEY) || '[]');
            queue.push(params);
            sessionStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-20)));
        } catch (_) {}
    }

    function flushQueue() {
        if (typeof gtag !== 'function') return;
        try {
            JSON.parse(sessionStorage.getItem(QUEUE_KEY) || '[]').forEach(function (params) {
                gtag('event', 'js_error', params);
            });
            sessionStorage.setItem(QUEUE_KEY, '[]');
        } catch (_) {}
    }

    function report(message, source, lineno, colno, error) {
        var count = 0;
        try {
            count = Number(sessionStorage.getItem(COUNT_KEY) || '0') || 0;
            sessionStorage.setItem(COUNT_KEY, String(count + 1));
        } catch (_) {}
        if (count && Math.random() >= 0.1) return;

        var frame = firstFrame(error && error.stack || error);
        send({
            message: cleanText(message || 'Unknown error', 140),
            source: cleanUrl(source),
            lineno: Number(lineno) || 0,
            colno: Number(colno) || 0,
            stack: frame,
            page_path: location.pathname,
            rating: count ? 'sampled' : 'first'
        });
    }

    addEventListener('error', function (event) {
        if (event.target && event.target !== window && !event.message && !event.error) return;
        report(
            event.message || event.error && event.error.message || 'Script error',
            event.filename || event.error && (event.error.fileName || event.error.sourceURL),
            event.lineno,
            event.colno,
            event.error
        );
    }, true);

    addEventListener('unhandledrejection', function (event) {
        event = event.reason || {};
        report(
            event.message || event,
            event.fileName || event.sourceURL,
            event.line,
            event.column,
            event
        );
    });

    document.addEventListener('DOMContentLoaded', flushQueue, { once: true });
    addEventListener('f1stories:cookie-consent-changed', flushQueue);
})();
