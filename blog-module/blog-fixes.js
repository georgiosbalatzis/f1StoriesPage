// blog-fixes.js — article page fixes: iOS-safe copy-link and Web Share, and an early
// async decode of the cover image. Scroll-to-top, reading progress and the mobile
// menu live in shared-nav.js; the Journal archive needs none of this.

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

    }

    // ═════════════════════════════════════════════
    // PERFORMANCE FIXES
    // ═════════════════════════════════════════════

    // ── 3. ASYNC IMAGE DECODE ───────────────────
    function asyncDecodeImages() {
        if (typeof HTMLImageElement.prototype.decode !== 'function') return;
        var imgs = document.querySelectorAll('.article-header-img');
        imgs.forEach(function (img) {
            if (img.complete) return;
            img.decode().catch(function () {});
        });
    }

    // ═════════════════════════════════════════════
    // INIT
    // ═════════════════════════════════════════════

    function init() {
        enhanceShareButtons();
        asyncDecodeImages();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
