// cookie-consent.js — Lightweight banner controller for home/blog pages.
(function () {
    'use strict';

    var banner = document.getElementById('cookie-consent');
    if (!banner) return;

    var STORAGE_KEY = 'f1stories-cookie-consent-v1';

    function readConsent() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY));
        } catch (_) {
            return null;
        }
    }

    function writeConsent(consent) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
        } catch (_) {}
    }

    function hideBanner() {
        banner.classList.remove('show');
        banner.style.display = 'none';
        banner.setAttribute('aria-hidden', 'true');
    }

    function showBanner() {
        banner.classList.add('cookie-banner');
        banner.style.display = 'block';
        banner.setAttribute('aria-hidden', 'false');
        requestAnimationFrame(function () {
            banner.classList.add('show');
        });
    }

    function saveConsent(consent) {
        var nextConsent = {
            ts: Date.now(),
            essential: true,
            analytics: !!consent.analytics,
            marketing: !!consent.marketing
        };
        writeConsent(nextConsent);
        window.dispatchEvent(new CustomEvent('f1stories:cookie-consent-changed', {
            detail: nextConsent
        }));
        hideBanner();
    }

    function bindSimpleBanner() {
        var accept = document.getElementById('cookie-accept');
        var decline = document.getElementById('cookie-decline');

        if (accept) {
            accept.addEventListener('click', function () {
                saveConsent({ analytics: true, marketing: false });
            });
        }

        if (decline) {
            decline.addEventListener('click', function () {
                saveConsent({ analytics: false, marketing: false });
            });
        }
    }

    function bindAdvancedBanner(existingConsent) {
        var acceptAll = document.getElementById('accept-all');
        var rejectAll = document.getElementById('reject-all');
        var acceptSelected = document.getElementById('accept-selected');
        var closeBtn = document.getElementById('close-cookie');
        var analytics = document.getElementById('analytics-cookies');
        var marketing = document.getElementById('marketing-cookies');

        if (analytics) analytics.checked = !!(existingConsent && existingConsent.analytics);
        if (marketing) marketing.checked = !!(existingConsent && existingConsent.marketing);

        if (acceptAll) {
            acceptAll.addEventListener('click', function () {
                if (analytics) analytics.checked = true;
                if (marketing) marketing.checked = true;
                saveConsent({ analytics: true, marketing: true });
            });
        }

        if (rejectAll) {
            rejectAll.addEventListener('click', function () {
                if (analytics) analytics.checked = false;
                if (marketing) marketing.checked = false;
                saveConsent({ analytics: false, marketing: false });
            });
        }

        if (acceptSelected) {
            acceptSelected.addEventListener('click', function () {
                saveConsent({
                    analytics: analytics && analytics.checked,
                    marketing: marketing && marketing.checked
                });
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', function () {
                saveConsent({
                    analytics: analytics && analytics.checked,
                    marketing: marketing && marketing.checked
                });
            });
        }
    }

    var existingConsent = readConsent();
    if (existingConsent) {
        hideBanner();
    } else {
        showBanner();
    }

    bindSimpleBanner();
    bindAdvancedBanner(existingConsent);
})();
