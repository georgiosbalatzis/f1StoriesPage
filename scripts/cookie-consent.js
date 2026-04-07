// cookie-consent.js — Lightweight banner controller for home/blog pages.
(function () {
    'use strict';

    var banner = document.getElementById('cookie-consent');
    if (!banner) return;

    var STORAGE_KEY = 'f1stories-cookie-consent-v1';

    function getDefaultConsent() {
        return {
            essential: true,
            analytics: true,
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
            analytics: consent.analytics !== false,
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
                text.innerHTML = 'Χρησιμοποιούμε μέτρηση επισκεψιμότητας από προεπιλογή. Αν επιλέξεις απενεργοποίηση, συνεχίζουμε μόνο με ανώνυμη μέτρηση χωρίς analytics cookies. <a href="/privacy/privacy.html">Πολιτική Απορρήτου</a>';
            }
            accept.textContent = 'Συνέχεια';
            decline.textContent = 'Ανώνυμη μέτρηση';
            return;
        }

        // Advanced banner used on the homepage.
        var intro = banner.querySelector('.cookie-intro');
        var analyticsTitle = banner.querySelector('.cookie-toggle h4');
        var analyticsDescription = banner.querySelectorAll('.cookie-section p')[1];
        var acceptSelected = document.getElementById('accept-selected');
        var acceptAll = document.getElementById('accept-all');
        var closeBtn = document.getElementById('close-cookie');

        if (intro) {
            intro.textContent = 'Η μέτρηση επισκεψιμότητας είναι ενεργή από προεπιλογή. Μπορείς να την απενεργοποιήσεις για ανώνυμη μέτρηση χωρίς analytics cookies.';
        }
        if (analyticsTitle) {
            analyticsTitle.textContent = 'Cookies Ανάλυσης';
        }
        if (analyticsDescription) {
            analyticsDescription.textContent = 'Ενεργά από προεπιλογή. Αν τα απενεργοποιήσεις, το site θα συνεχίσει μόνο με ανώνυμη μέτρηση χωρίς analytics cookies.';
        }
        if (acceptSelected) {
            acceptSelected.textContent = existingConsent ? 'Αποθήκευση' : 'Αποθήκευση Επιλογής';
        }
        if (acceptAll) {
            acceptAll.textContent = 'Πλήρης Μέτρηση';
        }
        if (closeBtn) {
            closeBtn.setAttribute('aria-label', 'Κλείσιμο και αποθήκευση επιλογών');
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

        if (analytics) analytics.checked = existingConsent ? existingConsent.analytics !== false : defaults.analytics;
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
                saveConsent({
                    analytics: analytics && analytics.checked,
                    marketing: marketing && marketing.checked
                });
            });
        }
    }

    var existingConsent = readConsent();
    updateBannerCopy(existingConsent);
    if (existingConsent) {
        hideBanner();
    } else {
        showBanner();
    }

    bindSimpleBanner();
    bindAdvancedBanner(existingConsent);
})();
