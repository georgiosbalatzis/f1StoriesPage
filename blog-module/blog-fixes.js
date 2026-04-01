// blog-fixes.js — Consolidated blog QoL + performance fixes
// Merges: blog-mobile-fixes.js + blog-perf-fixes.js
// Load with defer AFTER article-script.js and blog index inline script.
//
// What lives elsewhere (not duplicated here):
//   - Scroll-to-top → shared-nav.js
//   - Reading progress bar → shared-nav.js
//   - Basic share setup → article-script.js (this file adds iOS fallbacks)

(function () {
    'use strict';

    // ═════════════════════════════════════════════
    // MOBILE FIXES
    // ═════════════════════════════════════════════

    // ── 1. CLIPBOARD HELPER (iOS-safe) ──────────
    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text).then(function () {
                return true;
            }).catch(function () {
                return fallbackCopy(text);
            });
        }
        return Promise.resolve(fallbackCopy(text));
    }

    function fallbackCopy(text) {
        try {
            var input = document.createElement('input');
            input.setAttribute('value', text);
            input.style.cssText = 'position:fixed;top:0;left:0;opacity:0;width:1px;height:1px;';
            document.body.appendChild(input);
            input.focus();
            input.select();
            if (input.setSelectionRange) input.setSelectionRange(0, text.length);
            var success = document.execCommand('copy');
            document.body.removeChild(input);
            return success;
        } catch (e) { return false; }
    }

    // ── 2. SHARE BUTTON ENHANCEMENTS ────────────
    function enhanceShareButtons() {
        var copyBtn = document.getElementById('copy-link-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                copyToClipboard(window.location.href).then(function (success) {
                    if (success || success === undefined) {
                        copyBtn.classList.add('copied');
                        var icon = copyBtn.querySelector('i');
                        if (icon) icon.className = 'fas fa-check';
                        setTimeout(function () {
                            copyBtn.classList.remove('copied');
                            if (icon) icon.className = 'fas fa-link';
                        }, 2000);
                    }
                });
            });
        }

        var webBtn = document.getElementById('web-share-btn');
        if (webBtn) {
            if (navigator.share) {
                webBtn.style.display = '';
                webBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    navigator.share({
                        title: document.title,
                        text: document.querySelector('meta[property="og:description"]')?.content || '',
                        url: window.location.href
                    }).catch(function () {});
                });
            } else {
                webBtn.style.display = 'none';
            }
        }

        var igBtn = document.getElementById('instagram-dm-btn');
        if (igBtn) {
            igBtn.addEventListener('click', function (e) {
                e.preventDefault();
                copyToClipboard(window.location.href).then(function () {
                    var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                    igBtn.classList.add('copied');
                    setTimeout(function () { igBtn.classList.remove('copied'); }, 1500);
                    window.open(
                        isMobile ? 'instagram://direct-inbox' : 'https://www.instagram.com/direct/inbox/',
                        '_blank'
                    );
                });
            });
        }
    }

    // ── 3. LAZY IMAGE TIMEOUT FALLBACK ──────────
    function fixLazyImages() {
        var grid = document.getElementById('articles-grid');
        if (!grid) return;
        var scheduled = new WeakSet();
        var observer = new MutationObserver(function () {
            grid.querySelectorAll('img[data-src]').forEach(function (img) {
                if (scheduled.has(img)) return;
                scheduled.add(img);
                setTimeout(function () {
                    if (!img.classList.contains('loaded')) img.classList.add('force-show');
                }, 3000);
            });
        });
        observer.observe(grid, { childList: true, subtree: true });
    }

    // ── 4. AUTHOR CHIP DEBOUNCE ─────────────────
    function fixAuthorChips() {
        var strip = document.getElementById('author-strip');
        if (!strip) return;

        var newStrip = strip.cloneNode(true);
        strip.parentNode.replaceChild(newStrip, strip);

        var lastActivation = 0;
        var DEBOUNCE_MS = 400;

        function handleChip(e) {
            var now = Date.now();
            if (now - lastActivation < DEBOUNCE_MS) { e.preventDefault(); return; }
            var chip = e.target.closest('.author-chip');
            if (!chip) return;
            e.preventDefault();
            lastActivation = now;
            newStrip.querySelectorAll('.author-chip').forEach(function (c) { c.classList.remove('active'); });
            chip.classList.add('active');
            var author = chip.getAttribute('data-author');
            document.dispatchEvent(new CustomEvent('authorFilter', { detail: { author: author } }));
            if (window.__blogFilterByAuthor) window.__blogFilterByAuthor(author);
        }

        if ('PointerEvent' in window) {
            newStrip.addEventListener('pointerup', handleChip);
        } else {
            newStrip.addEventListener('click', handleChip);
        }
    }

    // ── 5. ARTICLE CARD TAP FIX ─────────────────
    // Cards are <a> tags — native click handles navigation.
    // touch-action: manipulation (CSS) removes the 300ms iOS delay.
    // No custom touchend handler needed; it would fire on scroll-end too.
    function fixCardTaps() {}

    // ── 6. PREVENT OVERSCROLL ON MOBILE NAV ─────
    function preventOverscroll() {
        var hamburger = document.getElementById('nav-hamburger');
        var mobileNav = document.getElementById('nav-mobile');
        if (!hamburger || !mobileNav) return;
        var obs = new MutationObserver(function () {
            var isOpen = mobileNav.classList.contains('open') ||
                mobileNav.classList.contains('active') ||
                mobileNav.style.display === 'block';
            document.body.style.overflow = isOpen ? 'hidden' : '';
        });
        obs.observe(mobileNav, { attributes: true, attributeFilter: ['class', 'style'] });
    }

    // ── 7. TTS HEADER TAP FIX ───────────────────
    // Intercepts at capture phase to prevent double-toggle
    // from both touchend and click firing.
    function fixTTSHeader() {
        var header = document.querySelector('.tts-header');
        var body = document.getElementById('tts-body');
        var toggle = document.getElementById('tts-toggle');
        if (!header || !body || !toggle) return;

        var lastToggle = 0;
        var DEBOUNCE_MS = 300;

        function doToggle() {
            var now = Date.now();
            if (now - lastToggle < DEBOUNCE_MS) return false;
            lastToggle = now;
            body.classList.toggle('open');
            toggle.classList.toggle('open');
            return true;
        }

        header.addEventListener('click', function (e) {
            if (!e.target.closest('.tts-header')) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            doToggle();
        }, true);

        header.addEventListener('touchend', function (e) {
            if (!e.target.closest('.tts-header')) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            doToggle();
        }, { capture: true, passive: false });
    }

    // ── 8. VIEWPORT HEIGHT FIX (100vh on mobile) ─
    function fixViewportHeight() {
        function setVH() {
            document.documentElement.style.setProperty('--vh', (window.innerHeight * 0.01) + 'px');
        }
        setVH();
        window.addEventListener('resize', setVH, { passive: true });
    }


    // ═════════════════════════════════════════════
    // PERFORMANCE FIXES
    // ═════════════════════════════════════════════

    // ── 9. IMAGE SHIMMER CLEANUP ────────────────
    function watchImageLoads() {
        var containers = document.querySelectorAll('.blog-img-container, .article-card-img-wrap');
        containers.forEach(function (container) {
            var img = container.querySelector('img');
            if (!img) return;
            function markReady() { container.classList.add('img-ready'); }
            if (img.complete && img.naturalWidth > 0) { markReady(); return; }
            img.addEventListener('load', markReady, { once: true });
            img.addEventListener('error', markReady, { once: true });
            setTimeout(markReady, 5000);
        });
    }

    // ── 10. NATIVE LAZY LOADING UPGRADE ─────────
    function upgradeNativeLazy() {
        if (!('loading' in HTMLImageElement.prototype)) return;
        var imgs = document.querySelectorAll('img[data-src]');
        imgs.forEach(function (img) {
            img.setAttribute('loading', 'lazy');
            img.src = img.getAttribute('data-src');
            img.removeAttribute('data-src');
            img.addEventListener('load', function () { img.classList.add('loaded'); }, { once: true });
        });
    }

    // ── 11. ASYNC IMAGE DECODE ──────────────────
    function asyncDecodeImages() {
        if (typeof HTMLImageElement.prototype.decode !== 'function') return;
        var imgs = document.querySelectorAll('.blog-img, .article-card-img, .article-header-img');
        imgs.forEach(function (img) {
            if (img.complete) return;
            img.decode().catch(function () {});
        });
    }

    // ── 12. PREFETCH NEXT PAGES ─────────────────
    function prefetchNextPages() {
        if (navigator.connection) {
            var conn = navigator.connection;
            if (conn.saveData || conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g') return;
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

        // Blog index: first two article cards
        var cards = document.querySelectorAll('.article-card[href]');
        for (var i = 0; i < Math.min(2, cards.length); i++) {
            addPrefetch(cards[i].getAttribute('href'));
        }

        // Article page: prev/next
        var prev = document.getElementById('prev-article-link');
        var next = document.getElementById('next-article-link');
        if (prev) addPrefetch(prev.getAttribute('href'));
        if (next) addPrefetch(next.getAttribute('href'));
    }

    // ── 13. FADE-IN OBSERVER ────────────────────
    // Replaces scroll-based .fade-in with IntersectionObserver.
    // Only runs on blog pages — f1-optimized.js handles homepage.
    function setupFadeInObserver() {
        // Skip if we're on the homepage (f1-optimized.js handles it there)
        if (document.getElementById('hero')) return;

        var sections = document.querySelectorAll('.fade-in');
        if (!sections.length) return;

        if (!('IntersectionObserver' in window)) {
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
        }, { rootMargin: '0px 0px -50px 0px', threshold: 0.1 });

        sections.forEach(function (s) { observer.observe(s); });
    }

    // ── 14. BLOG GRID MUTATION WATCHER ──────────
    // Re-run image fixes when blog cards are dynamically injected.
    // Debounced so rapid mutations (many cards injected at once) only trigger once.
    function watchBlogGrid() {
        var targets = document.querySelectorAll('.blog-posts, #articles-grid');
        if (!targets.length) return;

        var debounceTimer = null;
        var mo = new MutationObserver(function () {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(function () {
                watchImageLoads();
                upgradeNativeLazy();
                asyncDecodeImages();
            }, 100);
        });

        targets.forEach(function (target) {
            mo.observe(target, { childList: true, subtree: true });
        });
    }


    // ═════════════════════════════════════════════
    // INIT
    // ═════════════════════════════════════════════

    function init() {
        // Mobile fixes
        fixViewportHeight();
        enhanceShareButtons();
        fixLazyImages();
        fixCardTaps();
        preventOverscroll();
        fixTTSHeader();

        // Author chips: only on blog index
        var path = window.location.pathname;
        if (path.includes('/blog/index.html') || path.endsWith('/blog/')) {
            fixAuthorChips();
        }

        // Performance fixes
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
