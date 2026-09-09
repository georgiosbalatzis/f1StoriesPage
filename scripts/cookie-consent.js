// cookie-consent.js — Consent controller shared by the public site.
(function () {
    'use strict';

    var banner = document.getElementById('cookie-consent');
    if (!banner) return;

    var STORAGE_KEY = 'f1stories-cookie-consent-v1';

    function getDefaultConsent() {
        return {
            essential: true,
            analytics: false
        };
    }

    function normalizeConsent(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
        return {
            ts: Number(value.ts) || 0,
            essential: true,
            analytics: value.analytics === true
        };
    }

    function readConsent() {
        var raw;
        try {
            raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
        } catch (_) {
            return null;
        }

        var consent = normalizeConsent(raw);
        if (!consent) return null;

        // Migrate older records and remove unsupported categories. The runtime
        // only supports essential + analytics.
        try {
            if (JSON.stringify(raw) !== JSON.stringify(consent)) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
            }
        } catch (_) {}
        return consent;
    }

    function writeConsent(consent) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
        } catch (_) {}
    }

    function hideBanner() {
        banner.classList.remove('show');
        banner.classList.remove('is-ready');
        banner.classList.remove('is-settings-open');
        banner.style.display = 'none';
        banner.setAttribute('aria-hidden', 'true');
    }

    function syncControls(consent) {
        var analytics = document.getElementById('analytics-cookies');
        if (analytics) analytics.checked = !!(consent && consent.analytics === true);
    }

    function showBanner(openSettings) {
        banner.classList.add('cookie-banner');
        banner.classList.toggle('is-settings-open', openSettings === true);
        banner.style.display = 'block';
        banner.setAttribute('aria-hidden', 'false');
        syncControls(readConsent());
        var details = banner.querySelector('.cookie-details');
        if (details) details.open = openSettings === true;
        requestAnimationFrame(function () {
            banner.classList.add('show');
            banner.classList.add('is-ready');
        });
    }

    function scheduleBanner() {
        var shown = false;
        var timer = null;

        function reveal() {
            if (shown) return;
            shown = true;
            if (timer) window.clearTimeout(timer);
            window.removeEventListener('scroll', onScroll);
            showBanner();
        }

        function onScroll() {
            var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
            if (scrollY > 80) reveal();
        }

        window.addEventListener('scroll', onScroll, { passive: true });
        timer = window.setTimeout(reveal, 3600);
    }

    function saveConsent(consent) {
        var nextConsent = {
            ts: Date.now(),
            essential: true,
            analytics: consent.analytics === true
        };
        writeConsent(nextConsent);
        window.dispatchEvent(new CustomEvent('f1stories:cookie-consent-changed', {
            detail: nextConsent
        }));
        hideBanner();
    }

    function updateBannerCopy(existingConsent) {
        var accept = document.getElementById('cookie-accept');
        var decline = document.getElementById('cookie-decline');

        // Simple banner used on article/legal pages.
        if (accept && decline) {
            var text = banner.querySelector('.cookie-content p');
            if (text) {
                var privacyLink = document.createElement('a');
                privacyLink.href = '/privacy/privacy.html';
                privacyLink.textContent = 'Πολιτική Απορρήτου';
                text.replaceChildren(
                    document.createTextNode('Η επιλογή σου αποθηκεύεται τοπικά. Το Google Analytics ενεργοποιείται μόνο με αποδοχή. Δεν χρησιμοποιούμε δικά μας cookies διαφήμισης. '),
                    privacyLink
                );
            }
            accept.textContent = 'Αποδοχή';
            decline.textContent = 'Απόρριψη';
            return;
        }

        // Advanced banner used on the homepage.
        var intro = banner.querySelector('.cookie-intro');
        var analyticsTitle = banner.querySelector('.cookie-toggle h4');
        var analyticsDescription = banner.querySelectorAll('.cookie-section p')[1];
        var acceptSelected = document.getElementById('accept-selected');
        var acceptAll = document.getElementById('accept-all');
        var rejectAll = document.getElementById('reject-all');
        var closeBtn = document.getElementById('close-cookie');

        if (intro) {
            intro.textContent = 'Η επιλογή σου αποθηκεύεται τοπικά. Το Google Analytics είναι προαιρετικό και ενεργοποιείται μόνο με αποδοχή. Δεν χρησιμοποιούμε δικά μας cookies διαφήμισης.';
        }
        if (analyticsTitle) {
            analyticsTitle.textContent = 'Google Analytics';
        }
        if (analyticsDescription) {
            analyticsDescription.textContent = 'Μόνο με αποδοχή φορτώνουμε GA4 για μέτρηση επισκεψιμότητας. Χωρίς αποδοχή δεν φορτώνεται κανένα Google Analytics script.';
        }
        if (acceptSelected) {
            acceptSelected.textContent = 'Αποθήκευση';
        }
        if (acceptAll) {
            acceptAll.textContent = 'Αποδοχή';
        }
        if (rejectAll) {
            rejectAll.textContent = 'Απόρριψη';
        }
        if (closeBtn) {
            closeBtn.setAttribute('aria-label', 'Κλείσιμο χωρίς analytics');
        }
    }

    function bindSimpleBanner() {
        var accept = document.getElementById('cookie-accept');
        var decline = document.getElementById('cookie-decline');

        if (accept) {
            accept.addEventListener('click', function () {
                saveConsent({ analytics: true });
            });
        }

        if (decline) {
            decline.addEventListener('click', function () {
                saveConsent({ analytics: false });
            });
        }
    }

    function bindAdvancedBanner(existingConsent) {
        var acceptAll = document.getElementById('accept-all');
        var rejectAll = document.getElementById('reject-all');
        var acceptSelected = document.getElementById('accept-selected');
        var closeBtn = document.getElementById('close-cookie');
        var analytics = document.getElementById('analytics-cookies');
        var defaults = getDefaultConsent();

        if (analytics) analytics.checked = existingConsent ? existingConsent.analytics === true : defaults.analytics;

        if (acceptAll) {
            acceptAll.addEventListener('click', function () {
                if (analytics) analytics.checked = true;
                saveConsent({ analytics: true });
            });
        }

        if (rejectAll) {
            rejectAll.addEventListener('click', function () {
                if (analytics) analytics.checked = false;
                saveConsent({ analytics: false });
            });
        }

        if (acceptSelected) {
            acceptSelected.addEventListener('click', function () {
                saveConsent({ analytics: analytics && analytics.checked });
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', function () {
                saveConsent({ analytics: false });
            });
        }
    }

    function bindSettingsTriggers() {
        var details = banner.querySelector('.cookie-details');
        if (details) {
            details.addEventListener('toggle', function () {
                banner.classList.toggle('is-settings-open', details.open);
            });
        }
        document.addEventListener('click', function (event) {
            var trigger = event.target && event.target.closest
                ? event.target.closest('[data-cookie-settings]')
                : null;
            if (!trigger) return;
            event.preventDefault();
            showBanner(true);
        });
    }

    var existingConsent = readConsent();
    updateBannerCopy(existingConsent);
    syncControls(existingConsent);
    if (existingConsent) {
        hideBanner();
    } else {
        banner.classList.remove('is-ready');
        scheduleBanner();
    }

    bindSimpleBanner();
    bindAdvancedBanner(existingConsent);
    bindSettingsTriggers();

    window.f1storiesCookieConsent = {
        key: STORAGE_KEY,
        get: readConsent,
        openSettings: function () { showBanner(true); }
    };
})();
