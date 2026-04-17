(function () {
    'use strict';

    if (!('serviceWorker' in navigator)) return;

    // ── Service worker registration ─────────────
    function registerServiceWorker() {
        navigator.serviceWorker.register('/sw.js').catch(function () {});
    }

    if (document.readyState === 'complete') {
        registerServiceWorker();
    } else {
        window.addEventListener('load', registerServiceWorker, { once: true });
    }

    // ── Install prompt ──────────────────────────
    var DISMISS_KEY = 'f1s-pwa-dismiss';
    var isStandalone = window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;
    if (isStandalone) return;

    var dismissed = null;
    try { dismissed = localStorage.getItem(DISMISS_KEY); } catch (e) {}
    if (dismissed) {
        var ts = parseInt(dismissed, 10);
        if (ts && Date.now() - ts < 30 * 24 * 60 * 60 * 1000) return;
    }

    var deferredPrompt = null;
    var isIOS = /iP(hone|ad|od)/.test(navigator.userAgent)
        && !window.MSStream;

    window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault();
        deferredPrompt = e;
        showBanner(false);
    });

    function pageReady(fn) {
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            setTimeout(fn, 2500);
        } else {
            window.addEventListener('DOMContentLoaded', function () { setTimeout(fn, 2500); }, { once: true });
        }
    }

    if (isIOS) {
        pageReady(function () { showBanner(true); });
    }

    function showBanner(ios) {
        if (document.getElementById('pwa-install-banner')) return;

        var banner = document.createElement('div');
        banner.id = 'pwa-install-banner';
        banner.setAttribute('role', 'alert');
        banner.innerHTML =
            '<div class="pwa-banner-inner">' +
                '<img src="/images/icons/icon-192.png" alt="" class="pwa-banner-icon">' +
                '<div class="pwa-banner-text">' +
                    '<strong>F1 Stories</strong>' +
                    '<span>' + (ios
                        ? 'Tap <svg width="14" height="14" viewBox="0 0 50 50" style="vertical-align:-2px;fill:var(--accent,#3b82f6)"><path d="M25 1.5l-1.8 1.7L25 5v22.3h-2V5l1.8 1.8L23.2 5 25 1.5zM30.6 12H38c2.2 0 4 1.8 4 4v28c0 2.2-1.8 4-4 4H12c-2.2 0-4-1.8-4-4V16c0-2.2 1.8-4 4-4h7.4v2H12c-1.1 0-2 .9-2 2v28c0 1.1.9 2 2 2h26c1.1 0 2-.9 2-2V16c0-1.1-.9-2-2-2h-7.4v-2z"/></svg> then "Add to Home Screen"'
                        : 'Install the app for quick access') +
                    '</span>' +
                '</div>' +
                (ios
                    ? '<button class="pwa-banner-close" aria-label="Close">&times;</button>'
                    : '<button class="pwa-banner-btn" id="pwa-install-btn">Install</button>' +
                      '<button class="pwa-banner-close" aria-label="Close">&times;</button>') +
            '</div>';

        document.body.appendChild(banner);
        requestAnimationFrame(function () {
            requestAnimationFrame(function () { banner.classList.add('pwa-banner-visible'); });
        });

        var closeBtn = banner.querySelector('.pwa-banner-close');
        closeBtn.addEventListener('click', function () { dismiss(banner); });

        if (!ios) {
            var installBtn = document.getElementById('pwa-install-btn');
            if (installBtn) {
                installBtn.addEventListener('click', function () {
                    if (!deferredPrompt) return;
                    deferredPrompt.prompt();
                    deferredPrompt.userChoice.then(function (result) {
                        if (result.outcome === 'accepted') dismiss(banner);
                        deferredPrompt = null;
                    });
                });
            }
        }
    }

    function dismiss(banner) {
        banner.classList.remove('pwa-banner-visible');
        try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) {}
        setTimeout(function () { if (banner.parentNode) banner.parentNode.removeChild(banner); }, 400);
    }
})();
