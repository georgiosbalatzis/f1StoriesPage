// analytics.js — GA4 with default analytics, anonymized opt-out, and internal page click tracking.
(function () {
    'use strict';

    var TRACKING_ID = 'G-X68J6MQKSM';
    var STORAGE_KEY = 'f1stories-cookie-consent-v1';
    var SCRIPT_SRC = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(TRACKING_ID);
    var scriptInjected = false;
    var analyticsConfigured = false;
    var clickTrackingBound = false;
    var CLICK_EVENT_NAME = 'internal_page_click';
    var CLICK_EVENT_TIMEOUT = 250;

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

    function buildConsentState(consent) {
        var analyticsGranted = !(consent && consent.analytics === false);
        return {
            analytics_storage: analyticsGranted ? 'granted' : 'denied',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied'
        };
    }

    function injectScript() {
        if (scriptInjected) return;
        scriptInjected = true;

        var script = document.createElement('script');
        script.async = true;
        script.src = SCRIPT_SRC;
        document.head.appendChild(script);
    }

    function detectPageType(pathname) {
        if (pathname === '/' || pathname === '/index.html') return 'home';
        if (pathname.indexOf('/blog-module/blog-entries/') !== -1) return 'article';
        if (pathname.indexOf('/blog-module/blog/') !== -1) return 'blog_index';
        if (pathname.indexOf('/standings/') !== -1) return 'standings';
        if (pathname.indexOf('/privacy/') !== -1) return 'legal';
        return 'page';
    }

    function getArticleIdFromUrl(url) {
        var match = String(url || '').match(/\/blog-entries\/([^/]+)\/article\.html(?:$|[?#])/);
        return match ? match[1] : '';
    }

    function isInternalPageLink(anchor) {
        if (!anchor || !anchor.href) return false;
        if (anchor.hasAttribute('download')) return false;

        var rawHref = anchor.getAttribute('href') || '';
        if (!rawHref || rawHref.charAt(0) === '#') return false;
        if (/^(mailto:|tel:|javascript:)/i.test(rawHref)) return false;

        var url;
        try {
            url = new URL(anchor.href, window.location.href);
        } catch (_) {
            return false;
        }

        if (url.origin !== window.location.origin) return false;
        if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return false;
        if (/\.(pdf|zip|csv|mp3|png|jpe?g|webp|avif|svg)$/i.test(url.pathname)) return false;

        return url.pathname === '/' ||
            /\/$/.test(url.pathname) ||
            /\.html$/i.test(url.pathname) ||
            !/\.[a-z0-9]+$/i.test(url.pathname);
    }

    function getLinkText(anchor) {
        var text = (anchor.getAttribute('aria-label') || anchor.textContent || '').replace(/\s+/g, ' ').trim();
        if (text) return text.slice(0, 120);
        var img = anchor.querySelector && anchor.querySelector('img[alt]');
        return img ? String(img.getAttribute('alt') || '').trim().slice(0, 120) : '';
    }

    function classifyLink(anchor) {
        if (!anchor) return 'page';
        if (anchor.matches('.article-card, .blog-card-link, .article-nav-link, #prev-article-link, #next-article-link')) return 'article_link';
        if (anchor.closest('.blog-posts, #articles-grid, .article-navigation')) return 'article_link';
        if (anchor.closest('.blog-nav, #nav-mobile')) return 'navigation';
        if (anchor.closest('footer')) return 'footer';
        return 'page';
    }

    function trackInternalPageClick(anchor, destination, callback) {
        if (typeof window.gtag !== 'function') {
            if (typeof callback === 'function') callback();
            return;
        }

        var articleId = getArticleIdFromUrl(destination.href);
        var params = {
            link_url: destination.href,
            link_path: destination.pathname,
            link_text: getLinkText(anchor),
            link_section: classifyLink(anchor),
            source_path: window.location.pathname,
            source_type: detectPageType(window.location.pathname),
            destination_type: detectPageType(destination.pathname),
            transport_type: 'beacon'
        };

        if (articleId) params.article_id = articleId;
        if (typeof callback === 'function') {
            params.event_callback = callback;
            params.event_timeout = CLICK_EVENT_TIMEOUT;
        }

        window.gtag('event', CLICK_EVENT_NAME, params);
    }

    function bindInternalClickTracking() {
        if (clickTrackingBound) return;
        clickTrackingBound = true;

        document.addEventListener('click', function (event) {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

            var anchor = event.target && event.target.closest ? event.target.closest('a[href]') : null;
            if (!isInternalPageLink(anchor)) return;

            var destination;
            try {
                destination = new URL(anchor.href, window.location.href);
            } catch (_) {
                return;
            }

            var target = (anchor.getAttribute('target') || '').toLowerCase();
            if (target && target !== '_self') {
                trackInternalPageClick(anchor, destination);
                return;
            }

            event.preventDefault();

            var navigated = false;
            function navigate() {
                if (navigated) return;
                navigated = true;
                window.location.assign(destination.href);
            }

            trackInternalPageClick(anchor, destination, navigate);
            window.setTimeout(navigate, CLICK_EVENT_TIMEOUT);
        });
    }

    function configureAnalytics(consent) {
        ensureGtag();
        if (!analyticsConfigured) {
            window.gtag('consent', 'default', buildConsentState(consent));
            window.gtag('set', 'ads_data_redaction', true);
            injectScript();
            window.gtag('js', new Date());
            window.gtag('config', TRACKING_ID, {
                transport_type: 'beacon'
            });
            analyticsConfigured = true;
        } else {
            window.gtag('consent', 'update', buildConsentState(consent));
        }
    }

    window.f1storiesAnalytics = {
        trackEvent: function (name, params) {
            if (!name) return;
            ensureGtag();
            window.gtag('event', name, params || {});
        },
        getConsentState: function () {
            return buildConsentState(readConsent());
        }
    };

    configureAnalytics(readConsent());
    bindInternalClickTracking();

    window.addEventListener('f1stories:cookie-consent-changed', function (event) {
        configureAnalytics(event.detail || readConsent());
    });
})();
