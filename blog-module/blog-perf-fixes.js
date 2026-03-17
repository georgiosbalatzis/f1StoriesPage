// blog-perf-fixes.js — Performance & visual bug fixes
// Load with defer after blog-loader.js and article-script.js

(function () {
    'use strict';

    // ── 1. IMAGE SHIMMER CLEANUP ────────────────────
    // Removes the CSS ::before shimmer on image containers
    // once the image has actually loaded (or errored).
    function watchImageLoads() {
        var containers = document.querySelectorAll(
            '.blog-img-container, .article-card-img-wrap'
        );
        containers.forEach(function (container) {
            var img = container.querySelector('img');
            if (!img) return;

            function markReady() {
                container.classList.add('img-ready');
            }

            // Already loaded (cached)
            if (img.complete && img.naturalWidth > 0) {
                markReady();
                return;
            }

            img.addEventListener('load', markReady, { once: true });
            img.addEventListener('error', markReady, { once: true });

            // Safety: mark ready after 5s regardless
            setTimeout(markReady, 5000);
        });
    }

    // ── 2. NATIVE LAZY LOADING UPGRADE ──────────────
    // The blog-loader uses loading="lazy" on homepage
    // cards, but blog index uses custom data-src.
    // Upgrade: If native lazy loading is supported,
    // convert data-src to src+loading=lazy immediately
    // (faster than IntersectionObserver for most browsers).
    function upgradeNativeLazy() {
        if (!('loading' in HTMLImageElement.prototype)) return;

        var imgs = document.querySelectorAll('img[data-src]');
        imgs.forEach(function (img) {
            img.setAttribute('loading', 'lazy');
            img.src = img.getAttribute('data-src');
            img.removeAttribute('data-src');
            img.addEventListener('load', function () {
                img.classList.add('loaded');
            }, { once: true });
        });
    }

    // ── 3. DECODE IMAGES OFF MAIN THREAD ────────────
    // Use img.decode() to prevent jank when large
    // images paint into the viewport.
    function asyncDecodeImages() {
        if (typeof HTMLImageElement.prototype.decode !== 'function') return;

        var imgs = document.querySelectorAll(
            '.blog-img, .article-card-img, .article-header-img'
        );
        imgs.forEach(function (img) {
            if (img.complete) return;
            img.decode().catch(function () {
                // decode failed — browser will handle it normally
            });
        });
    }

    // ── 4. PREFETCH NEXT LIKELY NAVIGATION ──────────
    // On blog index: prefetch the first visible article.
    // On article page: prefetch next/prev articles.
    // Uses <link rel="prefetch"> so it's low priority.
    function prefetchNextPages() {
        // Don't prefetch on slow connections
        if (navigator.connection) {
            var conn = navigator.connection;
            if (conn.saveData || conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g') {
                return;
            }
        }

        var prefetched = new Set();

        function addPrefetch(url) {
            if (!url || prefetched.has(url) || url === '#' || url.includes('PREV_') || url.includes('NEXT_')) return;
            prefetched.add(url);
            var link = document.createElement('link');
            link.rel = 'prefetch';
            link.href = url;
            link.as = 'document';
            document.head.appendChild(link);
        }

        // Blog index: prefetch first two article cards
        var cards = document.querySelectorAll('.article-card[href]');
        for (var i = 0; i < Math.min(2, cards.length); i++) {
            addPrefetch(cards[i].getAttribute('href'));
        }

        // Article page: prefetch prev/next
        var prev = document.getElementById('prev-article-link');
        var next = document.getElementById('next-article-link');
        if (prev) addPrefetch(prev.getAttribute('href'));
        if (next) addPrefetch(next.getAttribute('href'));
    }

    // ── 5. INTERSECTION OBSERVER FOR FADE-IN ────────
    // Replace the scroll-based .fade-in with efficient
    // IntersectionObserver. This avoids scroll event
    // listeners that cause jank.
    function setupFadeInObserver() {
        var sections = document.querySelectorAll('.fade-in');
        if (!sections.length) return;

        if (!('IntersectionObserver' in window)) {
            // Fallback: just show everything
            sections.forEach(function (s) { s.classList.add('visible'); });
            return;
        }

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            rootMargin: '0px 0px -50px 0px',
            threshold: 0.1
        });

        sections.forEach(function (s) { observer.observe(s); });
    }

    // ── 6. BLOG GRID MUTATION WATCHER ───────────────
    // After blog-loader.js fetches and renders cards,
    // we need to run our image fixes on the new DOM.
    function watchBlogGrid() {
        var targets = document.querySelectorAll('.blog-posts, #articles-grid');
        if (!targets.length) return;

        var mo = new MutationObserver(function () {
            // New cards were injected — run fixes
            watchImageLoads();
            upgradeNativeLazy();
            asyncDecodeImages();
        });

        targets.forEach(function (target) {
            mo.observe(target, { childList: true, subtree: true });
        });
    }

    // ── 7. RESOURCE HINTS ───────────────────────────
    // Preconnect to critical third-party origins that
    // are used on every page.
    function addResourceHints() {
        var origins = [
            'https://fonts.googleapis.com',
            'https://fonts.gstatic.com',
            'https://cdn.jsdelivr.net',
            'https://cdnjs.cloudflare.com'
        ];

        origins.forEach(function (origin) {
            // Don't add duplicates
            if (document.querySelector('link[rel="preconnect"][href="' + origin + '"]')) return;
            var link = document.createElement('link');
            link.rel = 'preconnect';
            link.href = origin;
            link.crossOrigin = 'anonymous';
            document.head.appendChild(link);
        });
    }

    // ── 8. PASSIVE EVENT LISTENERS AUDIT ────────────
    // Ensure scroll/touch handlers across the site
    // use { passive: true } to avoid blocking scroll.
    function auditPassiveListeners() {
        // Patch addEventListener to default passive for scroll/touch
        var origAdd = EventTarget.prototype.addEventListener;
        var passiveEvents = ['touchstart', 'touchmove', 'wheel', 'scroll'];

        EventTarget.prototype.addEventListener = function (type, handler, options) {
            if (passiveEvents.indexOf(type) !== -1) {
                if (typeof options === 'boolean') {
                    // Can't make it passive if it was { capture: true }
                } else if (typeof options === 'undefined') {
                    options = { passive: true };
                } else if (typeof options === 'object' && options !== null) {
                    if (!('passive' in options)) {
                        options.passive = true;
                    }
                }
            }
            return origAdd.call(this, type, handler, options);
        };
    }

    // ── INIT ────────────────────────────────────────
    function init() {
        addResourceHints();
        auditPassiveListeners();
        watchImageLoads();
        upgradeNativeLazy();
        asyncDecodeImages();
        setupFadeInObserver();
        watchBlogGrid();

        // Delay non-critical work
        if ('requestIdleCallback' in window) {
            requestIdleCallback(prefetchNextPages);
        } else {
            setTimeout(prefetchNextPages, 2000);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
