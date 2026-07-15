// cookie-consent.js — Lightweight banner controller for home/blog pages.
(function () {
    'use strict';

    var banner = document.getElementById('cookie-consent');
    if (!banner) return;

    var STORAGE_KEY = 'f1stories-cookie-consent-v1';

    function getDefaultConsent() {
        return {
            essential: true,
            analytics: false,
            marketing: false
        };
    }

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
        banner.classList.remove('is-ready');
        banner.style.display = 'none';
        banner.setAttribute('aria-hidden', 'true');
    }

    function showBanner() {
        banner.classList.add('cookie-banner');
        banner.style.display = 'block';
        banner.setAttribute('aria-hidden', 'false');
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
            analytics: consent.analytics === true,
            marketing: !!consent.marketing
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
                    document.createTextNode('Απαραίτητα cookies. Προαιρετικά analytics μόνο με αποδοχή. '),
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
            intro.textContent = 'Απαραίτητα cookies. Προαιρετικά analytics μόνο με αποδοχή.';
        }
        if (analyticsTitle) {
            analyticsTitle.textContent = 'Cookies Ανάλυσης';
        }
        if (analyticsDescription) {
            analyticsDescription.textContent = 'Αν τα αποδεχτείς, φορτώνουμε Google Analytics για μέτρηση επισκεψιμότητας. Χωρίς αποδοχή δεν φορτώνεται GA.';
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
        var defaults = getDefaultConsent();

        if (analytics) analytics.checked = existingConsent ? existingConsent.analytics === true : defaults.analytics;
        if (marketing) marketing.checked = existingConsent ? !!existingConsent.marketing : defaults.marketing;

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
                saveConsent({ analytics: false, marketing: false });
            });
        }
    }

    var existingConsent = readConsent();
    updateBannerCopy(existingConsent);
    if (existingConsent) {
        hideBanner();
    } else {
        banner.classList.remove('is-ready');
        scheduleBanner();
    }

    bindSimpleBanner();
    bindAdvancedBanner(existingConsent);
})();
