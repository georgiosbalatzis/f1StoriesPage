(function () {
    'use strict';

    if (!('serviceWorker' in navigator)) return;

    var SW_BROADCAST_CHANNEL = 'f1s-sw';
    var swUpdateRequested = false;
    var reloadingForSwUpdate = false;

    function onPageReady(fn, delay) {
        var wait = typeof delay === 'number' ? delay : 0;
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            setTimeout(fn, wait);
        } else {
            window.addEventListener('DOMContentLoaded', function () { setTimeout(fn, wait); }, { once: true });
        }
    }

    function removeVisibleBanner(banner) {
        banner.classList.remove('pwa-banner-visible');
        setTimeout(function () {
            if (banner.parentNode) banner.parentNode.removeChild(banner);
        }, 400);
    }

    function showUpdateBanner(reg, worker) {
        if (document.getElementById('sw-update-banner')) return;
        if (!document.body) {
            onPageReady(function () { showUpdateBanner(reg, worker); });
            return;
        }

        var banner = document.createElement('div');
        banner.id = 'sw-update-banner';
        banner.setAttribute('role', 'alert');
        banner.innerHTML =
            '<div class="pwa-banner-inner">' +
                '<img src="/images/icons/icon-192.png" alt="" class="pwa-banner-icon">' +
                '<div class="pwa-banner-text">' +
                    '<strong>New version available</strong>' +
                    '<span>Reload to use the latest F1 Stories updates.</span>' +
                '</div>' +
                '<button class="pwa-banner-btn" id="sw-update-reload">Reload</button>' +
                '<button class="pwa-banner-close" aria-label="Close">&times;</button>' +
            '</div>';

        document.body.appendChild(banner);
        requestAnimationFrame(function () {
            requestAnimationFrame(function () { banner.classList.add('pwa-banner-visible'); });
        });

        banner.querySelector('.pwa-banner-close').addEventListener('click', function () {
            removeVisibleBanner(banner);
        });

        document.getElementById('sw-update-reload').addEventListener('click', function () {
            var waiting = reg.waiting || worker;
            if (waiting) {
                swUpdateRequested = true;
                waiting.postMessage({ type: 'SKIP_WAITING' });
            } else {
                window.location.reload();
            }
        });
    }

    function bindUpdateHandlers(reg) {
        if (!reg) return;

        if (reg.waiting && navigator.serviceWorker.controller) {
            showUpdateBanner(reg, reg.waiting);
        }

        reg.addEventListener('updatefound', function () {
            var newWorker = reg.installing;
            if (!newWorker) return;

            newWorker.addEventListener('statechange', function () {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    showUpdateBanner(reg, newWorker);
                }
            });
        });
    }

    function handleVersionMessage(data) {
        if (!data || data.type !== 'version') return;
        if (window.console && console.info) {
            console.info('[F1 Stories SW] active version:', data.value);
        }
    }

    if ('BroadcastChannel' in window) {
        try {
            var swChannel = new BroadcastChannel(SW_BROADCAST_CHANNEL);
            swChannel.addEventListener('message', function (e) {
                handleVersionMessage(e.data);
            });
        } catch (e) {}
    }

    navigator.serviceWorker.addEventListener('message', function (e) {
        handleVersionMessage(e.data);
    });

    navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (!swUpdateRequested) return;
        if (reloadingForSwUpdate) return;
        reloadingForSwUpdate = true;
        window.location.reload();
    });

    // ── Service worker registration ─────────────
    function registerServiceWorker() {
        navigator.serviceWorker.register('/sw.js')
            .then(bindUpdateHandlers)
            .catch(function () {});
    }

    if (document.readyState === 'complete') {
        registerServiceWorker();
    } else {
        window.addEventListener('load', registerServiceWorker, { once: true });
    }

    // ── Detect environment ──────────────────────
    var ua = navigator.userAgent || '';
    var isStandalone = window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;
    if (isStandalone) return;

    var isIOS     = /iP(hone|ad|od)/.test(ua) && !window.MSStream;
    var isAndroid = /Android/i.test(ua);
    var isMac     = /Macintosh|Mac OS/i.test(ua) && !isIOS;
    var isWindows = /Windows/i.test(ua);
    var isLinux   = /Linux/i.test(ua) && !isAndroid;

    var isEdge     = /Edg\//i.test(ua);
    var isFirefox  = /Firefox\//i.test(ua) && !/Seamonkey/i.test(ua);
    var isSamsung  = /SamsungBrowser/i.test(ua);
    var isOpera    = /OPR\//i.test(ua);
    var isChrome   = /Chrome\//i.test(ua) && !isEdge && !isSamsung && !isOpera;
    var isSafari   = /Safari\//i.test(ua) && !isChrome && !isEdge && !isFirefox && !isSamsung && !isOpera;

    // ── Dismiss logic: 3 strikes then 30-day cooldown ──
    var DISMISS_KEY = 'f1s-pwa-dismiss';
    var dismissCount = 0;
    var dismissTs = 0;
    try {
        var stored = JSON.parse(localStorage.getItem(DISMISS_KEY));
        if (stored && typeof stored === 'object') {
            dismissCount = parseInt(stored.count, 10) || 0;
            dismissTs = parseInt(stored.ts, 10) || 0;
        }
    } catch (e) {}

    if (dismissCount >= 3 && dismissTs) {
        if (Date.now() - dismissTs < 30 * 24 * 60 * 60 * 1000) return;
        dismissCount = 0;
        dismissTs = 0;
    }

    // ── Build instruction text per browser + OS ─
    var SHARE_ICON = '<svg width="14" height="14" viewBox="0 0 50 50" style="vertical-align:-2px;fill:var(--accent,#3b82f6)"><path d="M25 1.5l-1.8 1.7L25 5v22.3h-2V5l1.8 1.8L23.2 5 25 1.5zM30.6 12H38c2.2 0 4 1.8 4 4v28c0 2.2-1.8 4-4 4H12c-2.2 0-4-1.8-4-4V16c0-2.2 1.8-4 4-4h7.4v2H12c-1.1 0-2 .9-2 2v28c0 1.1.9 2 2 2h26c1.1 0 2-.9 2-2V16c0-1.1-.9-2-2-2h-7.4v-2z"/></svg>';
    var MENU_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" style="vertical-align:-2px;fill:var(--accent,#3b82f6)"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>';

    function getInstruction() {
        // iOS Safari
        if (isIOS && isSafari) {
            return {
                text: 'Tap ' + SHARE_ICON + ' then <b>Add to Home Screen</b>',
                hasNativePrompt: false
            };
        }
        // iOS Chrome
        if (isIOS && isChrome) {
            return {
                text: 'Tap ' + MENU_ICON + ' then <b>Add to Home Screen</b>',
                hasNativePrompt: false
            };
        }
        // iOS Firefox
        if (isIOS && isFirefox) {
            return {
                text: 'Tap the menu ' + MENU_ICON + ' then <b>Share > Add to Home Screen</b>',
                hasNativePrompt: false
            };
        }
        // iOS Edge
        if (isIOS && isEdge) {
            return {
                text: 'Tap ' + MENU_ICON + ' then <b>Add to Phone</b>',
                hasNativePrompt: false
            };
        }
        // iOS other
        if (isIOS) {
            return {
                text: 'Open in Safari, tap ' + SHARE_ICON + ' then <b>Add to Home Screen</b>',
                hasNativePrompt: false
            };
        }

        // Android Chrome / Samsung / Opera — native prompt
        if (isAndroid && (isChrome || isSamsung || isOpera)) {
            return { text: 'Install the app for quick access', hasNativePrompt: true };
        }
        // Android Edge — native prompt
        if (isAndroid && isEdge) {
            return { text: 'Install the app for quick access', hasNativePrompt: true };
        }
        // Android Firefox
        if (isAndroid && isFirefox) {
            return {
                text: 'Tap ' + MENU_ICON + ' then <b>Install</b>',
                hasNativePrompt: false
            };
        }
        // Android other
        if (isAndroid) {
            return { text: 'Install the app for quick access', hasNativePrompt: true };
        }

        // macOS Safari 17+
        if (isMac && isSafari) {
            return {
                text: 'Go to <b>File > Add to Dock</b> to install',
                hasNativePrompt: false
            };
        }
        // macOS Chrome — native prompt
        if (isMac && isChrome) {
            return { text: 'Install the app for quick access', hasNativePrompt: true };
        }
        // macOS Edge — native prompt
        if (isMac && isEdge) {
            return { text: 'Install the app for quick access', hasNativePrompt: true };
        }
        // macOS Firefox
        if (isMac && isFirefox) {
            return {
                text: 'Firefox on macOS does not support app install. Try Chrome or Safari.',
                hasNativePrompt: false,
                noAction: true
            };
        }

        // Windows Chrome — native prompt
        if (isWindows && isChrome) {
            return { text: 'Install the app for quick access', hasNativePrompt: true };
        }
        // Windows Edge — native prompt
        if (isWindows && isEdge) {
            return { text: 'Install the app for quick access', hasNativePrompt: true };
        }
        // Windows Firefox
        if (isWindows && isFirefox) {
            return {
                text: 'Firefox does not support app install. Try Chrome or Edge.',
                hasNativePrompt: false,
                noAction: true
            };
        }

        // Linux Chrome — native prompt
        if (isLinux && isChrome) {
            return { text: 'Install the app for quick access', hasNativePrompt: true };
        }
        // Linux Edge — native prompt
        if (isLinux && isEdge) {
            return { text: 'Install the app for quick access', hasNativePrompt: true };
        }
        // Linux Firefox
        if (isLinux && isFirefox) {
            return {
                text: 'Firefox does not support app install. Try Chrome or Edge.',
                hasNativePrompt: false,
                noAction: true
            };
        }

        // Fallback — assume native prompt may fire
        return { text: 'Install the app for quick access', hasNativePrompt: true };
    }

    // ── Banner logic ────────────────────────────
    var deferredPrompt = null;
    var info = getInstruction();

    window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault();
        deferredPrompt = e;
        showBanner();
    });

    // Browsers without beforeinstallprompt: show after page load
    if (!info.hasNativePrompt && !info.noAction) {
        onPageReady(showBanner, 2500);
    }

    function showBanner() {
        if (document.getElementById('pwa-install-banner')) return;

        var showInstallBtn = info.hasNativePrompt && deferredPrompt;

        var banner = document.createElement('div');
        banner.id = 'pwa-install-banner';
        banner.setAttribute('role', 'alert');
        banner.innerHTML =
            '<div class="pwa-banner-inner">' +
                '<img src="/images/icons/icon-192.png" alt="" class="pwa-banner-icon">' +
                '<div class="pwa-banner-text">' +
                    '<strong>F1 Stories</strong>' +
                    '<span>' + info.text + '</span>' +
                '</div>' +
                (showInstallBtn
                    ? '<button class="pwa-banner-btn" id="pwa-install-btn">Install</button>'
                    : '') +
                '<button class="pwa-banner-close" aria-label="Close">&times;</button>' +
            '</div>';

        document.body.appendChild(banner);
        requestAnimationFrame(function () {
            requestAnimationFrame(function () { banner.classList.add('pwa-banner-visible'); });
        });

        banner.querySelector('.pwa-banner-close').addEventListener('click', function () {
            dismissBanner(banner);
        });

        if (showInstallBtn) {
            document.getElementById('pwa-install-btn').addEventListener('click', function () {
                if (!deferredPrompt) return;
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then(function (result) {
                    if (result.outcome === 'accepted') {
                        removeBanner(banner);
                    }
                    deferredPrompt = null;
                });
            });
        }
    }

    function dismissBanner(banner) {
        dismissCount++;
        var payload = { count: dismissCount, ts: Date.now() };
        try { localStorage.setItem(DISMISS_KEY, JSON.stringify(payload)); } catch (e) {}
        removeBanner(banner);
    }

    function removeBanner(banner) {
        removeVisibleBanner(banner);
    }
})();
