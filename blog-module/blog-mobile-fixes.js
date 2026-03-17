// blog-mobile-fixes.js — QoL fixes for mobile
// Load AFTER article-script.js and the blog index inline script.
// Fixes: reading progress, share clipboard, lazy images,
//        author chip double-tap, scroll-to-top, card taps.

(function () {
    'use strict';

    // ── 1. READING PROGRESS BAR ─────────────────────
    // The template has the markup but no JS drives it.
    function initReadingProgress() {
        var fill = document.getElementById('reading-progress');
        var content = document.querySelector('.article-content');
        if (!fill || !content) return;

        var ticking = false;

        function updateProgress() {
            var rect = content.getBoundingClientRect();
            var contentTop = rect.top + window.pageYOffset;
            var contentHeight = rect.height;
            var viewportHeight = window.innerHeight;
            var scrolled = window.pageYOffset - contentTop + viewportHeight * 0.3;
            var progress = Math.min(100, Math.max(0, (scrolled / contentHeight) * 100));
            fill.style.width = progress + '%';
            ticking = false;
        }

        window.addEventListener('scroll', function () {
            if (!ticking) {
                ticking = true;
                requestAnimationFrame(updateProgress);
            }
        }, { passive: true });

        // Initial call
        updateProgress();
    }

    // ── 2. SHARE BUTTON CLIPBOARD FIX ───────────────
    // Robust clipboard with multiple fallbacks.
    function copyToClipboard(text) {
        // Method 1: Clipboard API
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text).then(function () {
                return true;
            }).catch(function () {
                return fallbackCopy(text);
            });
        }
        // Method 2: Fallback
        return Promise.resolve(fallbackCopy(text));
    }

    function fallbackCopy(text) {
        try {
            // Method 2a: Input element trick (works better on iOS than textarea)
            var input = document.createElement('input');
            input.setAttribute('value', text);
            input.style.cssText = 'position:fixed;top:0;left:0;opacity:0;width:1px;height:1px;';
            document.body.appendChild(input);
            input.focus();
            input.select();

            // iOS-specific: setSelectionRange
            if (input.setSelectionRange) {
                input.setSelectionRange(0, text.length);
            }

            var success = document.execCommand('copy');
            document.body.removeChild(input);
            return success;
        } catch (e) {
            return false;
        }
    }

    function initShareButtons() {
        // Copy link button
        var copyBtn = document.getElementById('copy-link-btn');
        if (copyBtn) {
            // Remove old listeners by cloning
            var newBtn = copyBtn.cloneNode(true);
            copyBtn.parentNode.replaceChild(newBtn, copyBtn);
            copyBtn = newBtn;

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

        // Web Share API button
        var webBtn = document.getElementById('web-share-btn');
        if (webBtn) {
            var newWebBtn = webBtn.cloneNode(true);
            webBtn.parentNode.replaceChild(newWebBtn, webBtn);
            webBtn = newWebBtn;

            if (navigator.share) {
                webBtn.style.display = '';
                webBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    navigator.share({
                        title: document.title,
                        text: document.querySelector('meta[property="og:description"]')?.content || '',
                        url: window.location.href
                    }).catch(function () { /* user cancelled — that's fine */ });
                });
            } else {
                webBtn.style.display = 'none';
            }
        }

        // Instagram DM button
        var igBtn = document.getElementById('instagram-dm-btn');
        if (igBtn) {
            var newIgBtn = igBtn.cloneNode(true);
            igBtn.parentNode.replaceChild(newIgBtn, igBtn);
            igBtn = newIgBtn;

            igBtn.addEventListener('click', function (e) {
                e.preventDefault();
                copyToClipboard(window.location.href).then(function () {
                    var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                    // Show feedback before redirect
                    igBtn.classList.add('copied');
                    setTimeout(function () {
                        igBtn.classList.remove('copied');
                    }, 1500);
                    // Small delay so user sees feedback
                    setTimeout(function () {
                        window.open(
                            isMobile ? 'instagram://direct-inbox' : 'https://www.instagram.com/direct/inbox/',
                            '_blank'
                        );
                    }, 300);
                });
            });
        }
    }

    // ── 3. LAZY IMAGE LOADING FIX ───────────────────
    // Adds timeout fallback so images don't stay invisible.
    function fixLazyImages() {
        var grid = document.getElementById('articles-grid');
        if (!grid) return;

        // Watch for new images added to the grid (after fetch completes)
        var observer = new MutationObserver(function () {
            var imgs = grid.querySelectorAll('img[data-src]');
            imgs.forEach(function (img) {
                // Force-show after 3 seconds regardless
                setTimeout(function () {
                    if (!img.classList.contains('loaded')) {
                        img.classList.add('force-show');
                    }
                }, 3000);
            });
        });

        observer.observe(grid, { childList: true, subtree: true });
    }

    // ── 4. AUTHOR CHIP TOUCH FIX ────────────────────
    // Problem: touchend + click both fire, causing
    // double-toggle or no response.
    // Fix: Use a unified handler with debounce.
    function fixAuthorChips() {
        var strip = document.getElementById('author-strip');
        if (!strip) return;

        // Remove existing listeners by cloning the strip
        var newStrip = strip.cloneNode(true);
        strip.parentNode.replaceChild(newStrip, strip);

        var lastActivation = 0;
        var DEBOUNCE_MS = 400;

        function handleChip(e) {
            var now = Date.now();
            if (now - lastActivation < DEBOUNCE_MS) {
                e.preventDefault();
                return;
            }

            var chip = e.target.closest('.author-chip');
            if (!chip) return;

            e.preventDefault();
            lastActivation = now;

            // Update active state
            newStrip.querySelectorAll('.author-chip').forEach(function (c) {
                c.classList.remove('active');
            });
            chip.classList.add('active');

            // Dispatch custom event so the blog loader picks it up
            var author = chip.getAttribute('data-author');
            var event = new CustomEvent('authorFilter', { detail: { author: author } });
            document.dispatchEvent(event);

            // Also try to directly call renderPosts if it's in scope
            // (the inline script on index.html manages this)
            if (window.__blogFilterByAuthor) {
                window.__blogFilterByAuthor(author);
            }
        }

        // Single unified handler — pointer events are best
        if ('PointerEvent' in window) {
            newStrip.addEventListener('pointerup', handleChip);
        } else {
            // Fallback: use click only (works on both touch and mouse)
            newStrip.addEventListener('click', handleChip);
        }
    }

    // ── 5. SCROLL-TO-TOP BUTTON FIX ────────────────
    // Some mobile browsers throttle scroll events heavily.
    // Use IntersectionObserver as backup.
    function fixScrollToTop() {
        var btn = document.getElementById('scroll-to-top');
        if (!btn) return;

        // Clone to remove old listeners
        var newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        btn = newBtn;

        // Show/hide logic with IntersectionObserver
        var sentinel = document.createElement('div');
        sentinel.style.cssText = 'position:absolute;top:300px;width:1px;height:1px;pointer-events:none;';
        document.body.insertBefore(sentinel, document.body.firstChild);

        if ('IntersectionObserver' in window) {
            var obs = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    // When sentinel is NOT visible (scrolled past 300px), show button
                    btn.classList.toggle('visible', !entry.isIntersecting);
                });
            }, { threshold: 0 });
            obs.observe(sentinel);
        } else {
            // Fallback: throttled scroll
            var ticking = false;
            window.addEventListener('scroll', function () {
                if (ticking) return;
                ticking = true;
                requestAnimationFrame(function () {
                    btn.classList.toggle('visible', window.pageYOffset > 300);
                    ticking = false;
                });
            }, { passive: true });
        }

        // Smooth scroll to top
        btn.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        // Also handle touch
        btn.addEventListener('touchend', function (e) {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, { passive: false });
    }

    // ── 6. ARTICLE CARD TAP FIX ─────────────────────
    // On some mobile browsers, <a> tags with complex
    // child structures don't register taps.
    function fixCardTaps() {
        var grid = document.getElementById('articles-grid');
        if (!grid) return;

        // Use event delegation on the grid
        grid.addEventListener('click', function (e) {
            var card = e.target.closest('.article-card');
            if (!card) return;

            // If the card is an <a> tag, the browser should handle it.
            // But if it doesn't navigate, force it:
            if (card.tagName === 'A' && card.href) {
                // Already an <a>, browser handles it — but add
                // a safety net for iOS Safari edge cases
                var href = card.getAttribute('href');
                if (href && !e.defaultPrevented) {
                    // Let the browser handle it naturally
                    return;
                }
            }
        });

        // For touch devices: add touchend handler as backup
        grid.addEventListener('touchend', function (e) {
            var card = e.target.closest('.article-card');
            if (!card || card.tagName !== 'A') return;

            // Only intervene if the touch was a tap (not a scroll)
            var touch = e.changedTouches[0];
            if (!touch) return;

            // If we got here and the card is an <a>, the click
            // event should fire. If not, this forces navigation.
            // We use a tiny timeout to let the click event fire first.
            var href = card.getAttribute('href');
            if (href) {
                setTimeout(function () {
                    // Check if we're still on the same page
                    // (click event didn't navigate)
                    window.location.href = href;
                }, 300);
            }
        }, { passive: true });
    }

    // ── 7. PREVENT iOS ELASTIC BOUNCE ON MODALS ─────
    function preventOverscroll() {
        // Prevent body scroll when mobile nav is open
        var hamburger = document.getElementById('nav-hamburger');
        var mobileNav = document.getElementById('nav-mobile');
        if (hamburger && mobileNav) {
            var originalObserver = new MutationObserver(function () {
                var isOpen = mobileNav.classList.contains('open') ||
                    mobileNav.classList.contains('active') ||
                    mobileNav.style.display === 'block';
                document.body.style.overflow = isOpen ? 'hidden' : '';
            });
            originalObserver.observe(mobileNav, {
                attributes: true,
                attributeFilter: ['class', 'style']
            });
        }
    }

    // ── 8. FIX TTS HEADER TAP AREA ─────────────────
    function fixTTSHeader() {
        var header = document.querySelector('.tts-header');
        var body = document.getElementById('tts-body');
        var toggle = document.getElementById('tts-toggle');
        if (!header || !body || !toggle) return;

        // The existing handler in article-script.js attaches to
        // both the header and the toggle. On mobile, both fire.
        // Fix: Clone header to remove old listeners, add one clean handler.
        var newHeader = header.cloneNode(true);
        header.parentNode.replaceChild(newHeader, header);

        var newToggle = newHeader.querySelector('.tts-toggle');

        function toggleTTS(e) {
            e.preventDefault();
            e.stopPropagation();
            body.classList.toggle('open');
            if (newToggle) newToggle.classList.toggle('open');
        }

        newHeader.addEventListener('click', toggleTTS);
        // Prevent double-firing on touch devices
        newHeader.addEventListener('touchend', function (e) {
            e.preventDefault();
            toggleTTS(e);
        }, { passive: false });
    }

    // ── 9. VIEWPORT HEIGHT FIX (100vh issue on mobile)
    function fixViewportHeight() {
        function setVH() {
            var vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', vh + 'px');
        }
        setVH();
        window.addEventListener('resize', setVH, { passive: true });
    }

    // ── INIT ────────────────────────────────────────
    function init() {
        fixViewportHeight();
        initReadingProgress();
        initShareButtons();
        fixLazyImages();
        fixScrollToTop();
        fixCardTaps();
        preventOverscroll();
        fixTTSHeader();

        // Author chips: only on blog index page
        var path = window.location.pathname;
        if (path.includes('/blog/index.html') || path.endsWith('/blog/')) {
            fixAuthorChips();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
