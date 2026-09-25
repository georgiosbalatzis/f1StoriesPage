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

    function createBannerButton(className, label, id) {
        var button = document.createElement('button');
        button.className = className;
        button.type = 'button';
        if (id) button.id = id;
        button.textContent = label;
        return button;
    }

    function appendBannerContent(banner, title, text, action) {
        var inner = document.createElement('div');
        inner.className = 'pwa-banner-inner';

        var icon = document.createElement('img');
        icon.src = '/images/logo-256.webp';
        icon.alt = '';
        icon.className = 'pwa-banner-icon';
        icon.width = 256;
        icon.height = 256;
        icon.decoding = 'async';

        var copy = document.createElement('div');
        copy.className = 'pwa-banner-text';
        var strong = document.createElement('strong');
        strong.textContent = title;
        var span = document.createElement('span');
        span.textContent = text;
        copy.append(strong, span);

        inner.append(icon, copy);
        if (action) {
            inner.appendChild(createBannerButton('pwa-banner-btn', action.label, action.id));
        }

        var close = createBannerButton('pwa-banner-close', '×');
        close.setAttribute('aria-label', 'Close');
        inner.appendChild(close);
        banner.replaceChildren(inner);
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
        appendBannerContent(banner, 'New version available', 'Reload to use the latest F1 Stories updates.', {
            id: 'sw-update-reload',
            label: 'Reload'
        });

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
})();
