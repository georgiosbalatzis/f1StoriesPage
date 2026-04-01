// shared-nav.js — Shared navbar, theme toggle, countdown, scroll-to-top, reading progress
// Replaces duplicated inline scripts in index.html, blog/index.html, blog/template.html, episodes/index.html
(function () {
    'use strict';

    // ── Navbar Hamburger & Scroll ────────────────
    var hamburger = document.getElementById('nav-hamburger');
    var mobileMenu = document.getElementById('nav-mobile');
    var blogNav = document.getElementById('blog-nav');

    if (hamburger && mobileMenu) {
        hamburger.addEventListener('click', function () {
            hamburger.classList.toggle('open');
            mobileMenu.classList.toggle('open');
            hamburger.setAttribute('aria-expanded', mobileMenu.classList.contains('open') ? 'true' : 'false');
        });
        mobileMenu.querySelectorAll('a').forEach(function (link) {
            link.addEventListener('click', function () {
                hamburger.classList.remove('open');
                mobileMenu.classList.remove('open');
                hamburger.setAttribute('aria-expanded', 'false');
            });
        });
    }

    // ── Scroll to Top ────────────────────────────
    var scrollBtn = document.getElementById('scroll-to-top');
    if (scrollBtn) {
        scrollBtn.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // ── Theme Toggle ─────────────────────────────
    var themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', function () {
            var html = document.documentElement;
            var isLight = html.getAttribute('data-theme') === 'light';
            if (isLight) {
                html.removeAttribute('data-theme');
                localStorage.setItem('f1stories-theme', 'dark');
            } else {
                html.setAttribute('data-theme', 'light');
                localStorage.setItem('f1stories-theme', 'light');
            }
        });
    }

    // ── Reading Progress Bar (article pages only) ─
    var progressBar = document.getElementById('reading-progress');
    var articleEl = progressBar ? document.querySelector('.article-content') : null;
    var articleHeight = 0;
    var articleTop = 0;

    function measureArticle() {
        if (!articleEl) return;
        var scrollY = window.pageYOffset || document.documentElement.scrollTop;
        articleHeight = articleEl.offsetHeight || 1;
        articleTop = articleEl.getBoundingClientRect().top + scrollY;
    }

    if (articleEl) {
        measureArticle();
        window.addEventListener('resize', measureArticle, { passive: true });
        window.addEventListener('load', measureArticle, { once: true });
    }

    // ── Single consolidated scroll handler ───────
    if (blogNav || scrollBtn || progressBar) {
        var scrollTicking = false;
        window.addEventListener('scroll', function () {
            if (scrollTicking) return;
            scrollTicking = true;
            requestAnimationFrame(function () {
                var scrollY = window.pageYOffset || document.documentElement.scrollTop;
                if (blogNav) {
                    blogNav.classList.toggle('scrolled', scrollY > 20);
                }
                if (scrollBtn) {
                    scrollBtn.classList.toggle('visible', scrollY > 400);
                }
                if (progressBar && articleEl) {
                    var scrolled = scrollY - articleTop + window.innerHeight * 0.3;
                    var pct = Math.max(0, Math.min(100, (scrolled / articleHeight) * 100));
                    progressBar.style.width = pct + '%';
                }
                scrollTicking = false;
            });
        }, { passive: true });

        if (progressBar && articleEl) {
            // Initialise progress on load
            var initScrollY = window.pageYOffset || document.documentElement.scrollTop;
            var initScrolled = initScrollY - articleTop + window.innerHeight * 0.3;
            progressBar.style.width = Math.max(0, Math.min(100, (initScrolled / articleHeight) * 100)) + '%';
        }
    }

    // ── Next Race Countdown (2026 Season) ────────
    var RACES = [
        { name: 'Australian GP',    flag: '\u{1F1E6}\u{1F1FA}', date: '2026-03-08T05:00:00Z' },
        { name: 'Chinese GP',       flag: '\u{1F1E8}\u{1F1F3}', date: '2026-03-15T07:00:00Z' },
        { name: 'Japanese GP',      flag: '\u{1F1EF}\u{1F1F5}', date: '2026-03-29T05:00:00Z' },
        { name: 'Bahrain GP',       flag: '\u{1F1E7}\u{1F1ED}', date: '2026-04-12T15:00:00Z' },
        { name: 'Saudi Arabian GP', flag: '\u{1F1F8}\u{1F1E6}', date: '2026-04-19T17:00:00Z' },
        { name: 'Miami GP',         flag: '\u{1F1FA}\u{1F1F8}', date: '2026-05-03T20:00:00Z' },
        { name: 'Canadian GP',      flag: '\u{1F1E8}\u{1F1E6}', date: '2026-05-24T18:00:00Z' },
        { name: 'Monaco GP',        flag: '\u{1F1F2}\u{1F1E8}', date: '2026-06-07T13:00:00Z' },
        { name: 'Catalunya GP',     flag: '\u{1F1EA}\u{1F1F8}', date: '2026-06-14T13:00:00Z' },
        { name: 'Austrian GP',      flag: '\u{1F1E6}\u{1F1F9}', date: '2026-06-28T13:00:00Z' },
        { name: 'British GP',       flag: '\u{1F1EC}\u{1F1E7}', date: '2026-07-05T14:00:00Z' },
        { name: 'Belgian GP',       flag: '\u{1F1E7}\u{1F1EA}', date: '2026-07-19T13:00:00Z' },
        { name: 'Hungarian GP',     flag: '\u{1F1ED}\u{1F1FA}', date: '2026-07-26T13:00:00Z' },
        { name: 'Dutch GP',         flag: '\u{1F1F3}\u{1F1F1}', date: '2026-08-23T13:00:00Z' },
        { name: 'Italian GP',       flag: '\u{1F1EE}\u{1F1F9}', date: '2026-09-06T13:00:00Z' },
        { name: 'Spanish GP',       flag: '\u{1F1EA}\u{1F1F8}', date: '2026-09-13T13:00:00Z' },
        { name: 'Azerbaijan GP',    flag: '\u{1F1E6}\u{1F1FF}', date: '2026-09-26T11:00:00Z' },
        { name: 'Singapore GP',     flag: '\u{1F1F8}\u{1F1EC}', date: '2026-10-11T12:00:00Z' },
        { name: 'US GP',            flag: '\u{1F1FA}\u{1F1F8}', date: '2026-10-25T19:00:00Z' },
        { name: 'Mexico City GP',   flag: '\u{1F1F2}\u{1F1FD}', date: '2026-11-01T20:00:00Z' },
        { name: 'S\u00e3o Paulo GP',flag: '\u{1F1E7}\u{1F1F7}', date: '2026-11-08T17:00:00Z' },
        { name: 'Las Vegas GP',     flag: '\u{1F1FA}\u{1F1F8}', date: '2026-11-21T06:00:00Z' },
        { name: 'Qatar GP',         flag: '\u{1F1F6}\u{1F1E6}', date: '2026-11-29T14:00:00Z' },
        { name: 'Abu Dhabi GP',     flag: '\u{1F1E6}\u{1F1EA}', date: '2026-12-06T13:00:00Z' }
    ];

    var countdownNameEl = document.getElementById('next-race-name');
    var countdownEl = document.getElementById('race-countdown');
    var countdownMobileEl = document.getElementById('race-countdown-mobile');
    var countdownFlagEl = document.getElementById('race-flag-emoji');
    var countdownTimer = null;

    RACES.forEach(function (race) {
        race.ts = new Date(race.date).getTime();
    });

    function getNextRace(now) {
        for (var i = 0; i < RACES.length; i++) {
            if (RACES[i].ts > now) return RACES[i];
        }
        return null;
    }

    function fmtCountdown(ms) {
        if (ms <= 0) return 'LIGHTS OUT!';
        var s = Math.floor(ms / 1000);
        var d = Math.floor(s / 86400);
        var h = Math.floor((s % 86400) / 3600);
        var m = Math.floor((s % 3600) / 60);
        var sec = s % 60;
        if (d > 0) return d + 'd ' + h + 'h ' + m + 'm';
        if (h > 0) return h + 'h ' + m + 'm ' + sec + 's';
        return m + 'm ' + sec + 's';
    }

    function fmtShort(ms) {
        if (ms <= 0) return 'RACE ON!';
        var s = Math.floor(ms / 1000);
        var d = Math.floor(s / 86400);
        var h = Math.floor((s % 86400) / 3600);
        var m = Math.floor((s % 3600) / 60);
        if (d > 0) return d + 'd ' + h + 'h';
        if (h > 0) return h + 'h ' + m + 'm';
        return m + 'm';
    }

    function getNextTickDelay(ms) {
        if (document.hidden) return 60000;
        if (ms > 86400000) return 60000;
        if (ms > 3600000) return 15000;
        return 1000;
    }

    function scheduleCountdown(ms) {
        if (countdownTimer) {
            window.clearTimeout(countdownTimer);
        }
        countdownTimer = window.setTimeout(tickCountdown, getNextTickDelay(ms));
    }

    function tickCountdown() {
        var now = Date.now();
        var race = getNextRace(now);

        if (!race) {
            if (countdownNameEl) countdownNameEl.textContent = 'Season Complete';
            if (countdownEl) countdownEl.textContent = '2027 TBA';
            if (countdownMobileEl) countdownMobileEl.textContent = 'Done';
            return;
        }

        var ms = race.ts - now;
        if (countdownNameEl) countdownNameEl.textContent = race.flag + ' ' + race.name;
        if (countdownEl) countdownEl.textContent = fmtCountdown(ms);
        if (countdownMobileEl) countdownMobileEl.textContent = fmtShort(ms);
        if (countdownFlagEl) countdownFlagEl.textContent = race.flag;
        scheduleCountdown(ms);
    }

    if (countdownNameEl || countdownEl || countdownMobileEl || countdownFlagEl) {
        tickCountdown();
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) {
                if (countdownTimer) {
                    window.clearTimeout(countdownTimer);
                    countdownTimer = null;
                }
                return;
            }
            tickCountdown();
        });
    }
})();
