// shared-nav.js — Shared navbar, theme toggle, countdown, scroll-to-top, reading progress
// Replaces duplicated inline scripts in index.html, blog/index.html, blog/template.html, episodes/index.html
(function () {
    'use strict';

    var THEME_KEY = 'f1stories-theme';

    function storeTheme(theme) {
        try {
            localStorage.setItem(THEME_KEY, theme);
        } catch (_) {}

        try {
            sessionStorage.removeItem(THEME_KEY);
        } catch (_) {}
    }

    // ── Navbar Hamburger & Scroll ────────────────
    var hamburger = document.getElementById('nav-hamburger');
    var mobileMenu = document.getElementById('nav-mobile');
    var blogNav = document.getElementById('blog-nav');
    if (blogNav) {
        blogNav.querySelectorAll('.blog-nav-link.active, .blog-nav-mobile-link.active').forEach(function (link) {
            link.setAttribute('aria-current', 'page');
        });
    }

    function ensureNavThemeButton() {
        var navRight = document.querySelector('.blog-nav-right');
        if (!navRight || navRight.querySelector('.theme-toggle-nav-btn')) return;

        var source = document.querySelector('.theme-toggle-menu-btn, body > .theme-toggle-btn');
        if (!source) return;

        var button = source.cloneNode(true);
        button.removeAttribute('id');
        button.className = 'theme-toggle-btn theme-toggle-nav-btn';
        button.querySelectorAll('span').forEach(function (label) {
            label.remove();
        });

        if (hamburger && hamburger.parentNode === navRight) {
            navRight.insertBefore(button, hamburger);
        } else {
            navRight.appendChild(button);
        }
    }

    ensureNavThemeButton();

    // ── Navbar audio player ──────────────────────
    // [ ▶ ON AIR. ] and nothing else: the masthead's end-cap, which fills with red as the episode plays. The
    // newest episode's audio is the first enclosure of the show's public
    // podcast feed (Spotify for Podcasters / Anchor, CORS-open, ~11 KB, cached by the browser for 5 minutes) and
    // plays through a plain <audio> element created on the first click. Never a YouTube player. Nothing starts on
    // its own: only a listener who pressed play continues on the next page (sessionStorage, this tab only), and
    // only the latest episode ever plays; when it ends the player simply stops.
    var BETCAST_FEED = 'https://anchor.fm/s/101588098/podcast/rss';

    function safeAudioUrl(value) {
        try {
            var parsed = new URL(value);
            // YouTube is never an audio source.
            return parsed.protocol === 'https:' && !/(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be|googlevideo\.com|ytimg\.com)$/i.test(parsed.hostname) ? parsed.href : '';
        } catch (_) {
            return '';
        }
    }

    // Feeds list the newest episode first.
    function newestEnclosure(xml) {
        var item = new DOMParser().parseFromString(xml, 'application/xml').getElementsByTagName('item')[0];
        var tags = item ? item.getElementsByTagName('enclosure') : [];
        for (var i = 0; i < tags.length; i++) {
            var href = tags[i].getAttribute('url') || '';
            if (/^audio\//i.test(tags[i].getAttribute('type') || '') || /\.(mp3|m4a|aac|ogg)(\?|$)/i.test(href)) {
                var safe = safeAudioUrl(href);
                if (safe) return safe;
            }
        }
        return '';
    }

    function initAudioPlayer() {
        var navRight = document.querySelector('.blog-nav-right');
        if (!navRight || navRight.querySelector('.nav-audio')) return;

        function el(tag, className) {
            var node = document.createElement(tag);
            node.className = className;
            return node;
        }
        // Two identical faces: ink underneath, a red copy on top that --p opens from the left (see shared-nav.css).
        function face(extraClass) {
            var node = el('span', 'nav-audio-face' + (extraClass ? ' ' + extraClass : ''));
            node.appendChild(el('span', 'nav-audio-glyph')).setAttribute('aria-hidden', 'true');
            var word = el('span', 'nav-audio-word');
            word.appendChild(document.createTextNode('ON AIR'));
            word.appendChild(el('i', '')).textContent = '.';
            node.appendChild(word);
            return node;
        }
        var root = el('div', 'nav-audio');
        var button = el('button', 'nav-audio-btn');
        button.type = 'button';
        button.appendChild(face(''));
        var fillFace = face('nav-audio-face--fill');
        fillFace.setAttribute('aria-hidden', 'true');
        button.appendChild(fillFace);
        var note = el('span', 'nav-audio-note');
        note.setAttribute('role', 'status');
        root.appendChild(button);
        root.appendChild(note);
        navRight.insertBefore(root, navRight.firstChild);

        var STORE_KEY = 'f1stories-audio';
        var ready = false;
        var url = '';
        var audio = null;
        var active = false;
        var buffering = false;
        var leaving = false;
        var lastSave = 0;
        var resumeAt = 0;
        var ratio = 0;
        var noteTimer = 0;

        function render() {
            root.classList.toggle('is-active', active);
            // The visible word is "ON AIR", so the accessible name keeps it (label in name).
            button.setAttribute('aria-label', (active ? 'Παύση ' : 'Αναπαραγωγή ') + 'BetCast, ON AIR');
            button.setAttribute('aria-busy', String(active && buffering));
        }

        // How much of the episode has played, 0..1: the red fill of the box. instant skips the sweep on page load.
        function setProgress(next, instant) {
            ratio = next > 0 ? Math.min(next, 1) : 0;
            if (instant) root.classList.add('is-instant');
            root.style.setProperty('--p', (ratio * 100).toFixed(2) + '%');
            if (instant) {
                void root.offsetWidth;
                root.classList.remove('is-instant');
            }
        }

        function ratioOf(time) {
            return audio && isFinite(audio.duration) && audio.duration > 0 ? Math.min(time / audio.duration, 1) : ratio;
        }

        function tell(message) {
            note.textContent = message;
            clearTimeout(noteTimer);
            noteTimer = setTimeout(function () { note.textContent = ''; }, 5000);
        }

        // Pages are separate documents, so the tab's sessionStorage carries "is it playing, and where" to the next one.
        function readSaved() {
            try {
                var saved = JSON.parse(sessionStorage.getItem(STORE_KEY));
                return saved && typeof saved === 'object' ? saved : null;
            } catch (_) {
                return null;
            }
        }

        function save(playing, time) {
            if (leaving || !url) return;
            try {
                sessionStorage.setItem(STORE_KEY, JSON.stringify({ url: url, playing: playing, time: time || 0, ratio: ratioOf(time || 0), at: Date.now() }));
            } catch (_) {}
        }

        function stop() {
            active = false;
            if (audio) audio.pause();
            render();
        }

        function fail() {
            if (!active) return;
            stop();
            tell('Ο ήχος δεν είναι διαθέσιμος αυτή τη στιγμή.');
        }

        function ensureAudio() {
            if (audio) return audio;
            audio = new Audio();
            audio.preload = 'none';
            audio.loop = false; // one episode: when it ends, nothing else starts
            ['waiting', 'playing', 'pause'].forEach(function (name) {
                audio.addEventListener(name, function () {
                    buffering = name === 'waiting';
                    if (name === 'pause') {
                        // Media keys and headphone buttons can pause outside our button.
                        active = false;
                        save(false, audio.ended ? 0 : audio.currentTime);
                    }
                    render();
                });
            });
            audio.addEventListener('timeupdate', function () {
                setProgress(ratioOf(audio.currentTime));
                var now = Date.now();
                if (active && now - lastSave > 1000) {
                    lastSave = now;
                    save(true, audio.currentTime);
                }
            });
            audio.addEventListener('ended', function () {
                stop();
                setProgress(0); // finished: the box empties and nothing else starts
            });
            audio.addEventListener('error', fail);
            return audio;
        }

        // silent: a resume after navigation may be refused by the browser's autoplay rules; that just leaves it paused.
        function begin(seekTo, silent) {
            var player = ensureAudio();
            if (player.getAttribute('src') !== url) {
                player.src = url;
                if (seekTo > 1) {
                    player.addEventListener('loadedmetadata', function seek() {
                        player.removeEventListener('loadedmetadata', seek);
                        try {
                            if (!isFinite(player.duration) || seekTo < player.duration - 1) player.currentTime = seekTo;
                        } catch (_) {}
                    });
                }
            }
            function refuse() {
                if (silent) { active = false; save(false, seekTo); render(); } else fail();
            }
            active = true;
            save(true, seekTo);
            render();
            var started;
            try { started = player.play(); } catch (_) { refuse(); return; }
            if (started && started.catch) {
                started.catch(function (error) {
                    if (!error || error.name !== 'AbortError') refuse();
                });
            }
        }

        button.addEventListener('click', function () {
            if (!ready) return;
            if (active) { stop(); return; }
            if (!url) { tell('Ο ήχος δεν είναι διαθέσιμος αυτή τη στιγμή.'); return; }
            begin(resumeAt, false);
        });

        window.addEventListener('pagehide', function () {
            if (audio) save(active, audio.ended ? 0 : audio.currentTime);
            leaving = true;
        });
        window.addEventListener('pageshow', function (event) {
            if (event.persisted) leaving = false;
        });

        function accept(latest) {
            ready = true;
            url = latest;
            // Only the same (latest) episode carries over; a new episode starts fresh.
            var saved = readSaved();
            if (!url || !saved || saved.url !== url) return;
            var elapsed = saved.playing ? Math.min(Math.max((Date.now() - (saved.at || 0)) / 1000, 0), 10) : 0;
            resumeAt = Math.max(0, (Number(saved.time) || 0) + elapsed);
            setProgress(Number(saved.ratio) || 0, true);
            if (saved.playing) begin(resumeAt, true);
        }

        function loadLatest() {
            try {
                fetch(BETCAST_FEED, { credentials: 'omit' })
                    .then(function (response) { return response.ok ? response.text() : ''; })
                    .then(function (xml) { return xml ? newestEnclosure(xml) : ''; })
                    .catch(function () { return ''; })
                    .then(accept);
            } catch (_) {
                accept('');
            }
        }

        render();
        // Read the feed once the page itself has loaded, so it never competes with it.
        if (document.readyState === 'complete') loadLatest();
        else window.addEventListener('load', loadLatest, { once: true });
    }

    initAudioPlayer();

    if (hamburger && mobileMenu) {
        function closeMobileMenu() {
            hamburger.classList.remove('open');
            mobileMenu.classList.remove('open');
            hamburger.setAttribute('aria-expanded', 'false');
        }

        hamburger.addEventListener('click', function () {
            hamburger.classList.toggle('open');
            mobileMenu.classList.toggle('open');
            hamburger.setAttribute('aria-expanded', mobileMenu.classList.contains('open') ? 'true' : 'false');
        });
        mobileMenu.querySelectorAll('a').forEach(function (link) {
            link.addEventListener('click', closeMobileMenu);
        });
        mobileMenu.addEventListener('focusout', function (event) {
            if (event.relatedTarget && event.relatedTarget !== hamburger && !mobileMenu.contains(event.relatedTarget)) closeMobileMenu();
        });
        document.addEventListener('keydown', function (event) {
            if (event.key !== 'Escape' || !mobileMenu.classList.contains('open')) return;
            closeMobileMenu();
            hamburger.focus();
        });
    }

    // ── Scroll to Top ────────────────────────────
    var scrollBtn = document.getElementById('scroll-to-top');
    var footerEl = document.querySelector('footer');
    var footerInView = false;

    function isNarrowScrollTopLayout() {
        return !document.body.classList.contains('article-page') && window.matchMedia && window.matchMedia('(max-width: 1199px)').matches;
    }

    function setScrollTopButtonSuppressed(suppressed) {
        if (!scrollBtn) return;
        scrollBtn.classList.toggle('is-suppressed', suppressed);
        scrollBtn.tabIndex = suppressed ? -1 : 0;
        scrollBtn.setAttribute('aria-hidden', String(suppressed));
        if (suppressed && document.activeElement === scrollBtn) scrollBtn.blur();
    }

    function isFooterInView() {
        if (!footerEl) return false;
        var rect = footerEl.getBoundingClientRect();
        return rect.top < window.innerHeight && rect.bottom > 0;
    }

    if (scrollBtn) {
        scrollBtn.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        setScrollTopButtonSuppressed(isNarrowScrollTopLayout());
    }

    if (footerEl && window.IntersectionObserver) {
        new IntersectionObserver(function (entries) {
            footerInView = entries[0].isIntersecting;
            setScrollTopButtonSuppressed(isNarrowScrollTopLayout() || footerInView);
        }).observe(footerEl);
    }

    window.addEventListener('resize', function () {
        footerInView = isFooterInView();
        setScrollTopButtonSuppressed(isNarrowScrollTopLayout() || footerInView);
    }, { passive: true });

    // ── Theme Toggle ─────────────────────────────
    var themeButtons = Array.prototype.slice.call(document.querySelectorAll('.theme-toggle-btn'));

    function syncThemeToggleState() {
        var isLight = document.documentElement.getAttribute('data-theme') === 'light';
        themeButtons.forEach(function (themeBtn) {
            themeBtn.setAttribute('aria-pressed', String(isLight));
            themeBtn.setAttribute('aria-label', 'Φωτεινό θέμα');
        });
    }

    if (themeButtons.length) {
        syncThemeToggleState();
        themeButtons.forEach(function (themeBtn) {
            themeBtn.addEventListener('click', function () {
                var html = document.documentElement;
                var isLight = html.getAttribute('data-theme') === 'light';
                if (isLight) {
                    html.removeAttribute('data-theme');
                    storeTheme('dark');
                } else {
                    html.setAttribute('data-theme', 'light');
                    storeTheme('light');
                }
                syncThemeToggleState();
            });
        });
    }

    function getScrollTopThreshold() {
        var isMobile = window.matchMedia && window.matchMedia('(max-width: 767.98px)').matches;
        if (isMobile) return Math.max(900, Math.round(window.innerHeight * 1.2));
        return window.innerHeight * 2;
    }

    function updateScrollTopButton(scrollY) {
        if (!scrollBtn) return;
        if (!window.IntersectionObserver) footerInView = isFooterInView();
        setScrollTopButtonSuppressed(isNarrowScrollTopLayout() || footerInView);
        scrollBtn.classList.toggle('visible', scrollY > getScrollTopThreshold());
    }

    // ── Reading Progress Bar (article pages only) ─
    var progressBar = document.getElementById('reading-progress');

    function initHorizontalScrollCues() {
        var selector = '.tyre-pace-chart-scroll, .quali-race-chart-scroll, #category-strip, #author-strip, .legal-toc';
        var regions = new Map();
        var nextId = 0;
        function scan() {
            regions.forEach(function (state, scroller) {
                if (!scroller.isConnected) {
                    if (state.observer) state.observer.disconnect();
                    regions.delete(scroller);
                }
            });
            document.querySelectorAll(selector).forEach(function (scroller) {
                if (regions.has(scroller)) { regions.get(scroller).update(); return; }
                var label = scroller.matches('.tyre-pace-chart-scroll') ? 'οδηγούς'
                    : scroller.matches('.quali-race-chart-scroll') ? 'ομάδες'
                    : scroller.id === 'category-strip' ? 'θέματα'
                    : scroller.id === 'author-strip' ? 'συντάκτες' : 'ενότητες';
                var wrapper = document.createElement('div');
                wrapper.className = 'horizontal-scroll-region' + (scroller.matches('.legal-toc') ? ' legal-scroll-region' : '');
                scroller.parentNode.insertBefore(wrapper, scroller);
                var cue = document.createElement('div');
                cue.className = 'horizontal-scroll-cue';
                var description = document.createElement('span');
                description.id = 'horizontal-scroll-hint-' + (++nextId);
                description.textContent = 'Σύρε για ' + (label === 'οδηγούς' || label === 'συντάκτες' ? 'όλους τους ' : label === 'θέματα' ? 'όλα τα ' : 'όλες τις ') + label;
                cue.appendChild(description);
                var buttons = [-1, 1].map(function (direction) {
                    var button = document.createElement('button');
                    button.type = 'button';
                    button.textContent = direction < 0 ? '←' : '→';
                    button.setAttribute('aria-label', 'Κύλιση ' + (direction < 0 ? 'αριστερά' : 'δεξιά') + ': ' + label);
                    button.addEventListener('click', function () {
                        scroller.scrollBy({ left: direction * Math.max(140, scroller.clientWidth * .75), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
                    });
                    cue.appendChild(button);
                    return button;
                });
                wrapper.appendChild(cue);
                wrapper.appendChild(scroller);
                scroller.classList.add('horizontal-scroll-content');
                scroller.setAttribute('aria-describedby', ((scroller.getAttribute('aria-describedby') || '') + ' ' + description.id).trim());
                if (!scroller.matches('nav')) {
                    scroller.tabIndex = 0;
                    scroller.setAttribute('role', 'region');
                    scroller.setAttribute('aria-label', 'Οριζόντια κύλιση: ' + label);
                }
                var update = function () {
                    var maximum = scroller.scrollWidth - scroller.clientWidth;
                    cue.hidden = maximum <= 2 || !scroller.clientWidth;
                    buttons[0].disabled = scroller.scrollLeft <= 2;
                    buttons[1].disabled = scroller.scrollLeft >= maximum - 2;
                };
                scroller.addEventListener('scroll', update, { passive: true });
                var observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
                if (observer) { observer.observe(scroller); if (scroller.firstElementChild) observer.observe(scroller.firstElementChild); }
                regions.set(scroller, { update: update, observer: observer });
                update();
            });
        }
        scan();
        new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
        window.addEventListener('resize', scan);
        if (document.fonts) document.fonts.ready.then(scan);
    }
    initHorizontalScrollCues();
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
                updateScrollTopButton(scrollY);
                if (progressBar && articleEl) {
                    var scrolled = scrollY - articleTop + window.innerHeight * 0.3;
                    var pct = Math.max(0, Math.min(100, (scrolled / articleHeight) * 100));
                    progressBar.style.transform = 'scaleX(' + pct / 100 + ')';
                }
                scrollTicking = false;
            });
        }, { passive: true });

        if (progressBar && articleEl) {
            // Initialise progress on load
            var initScrollY = window.pageYOffset || document.documentElement.scrollTop;
            var initScrolled = initScrollY - articleTop + window.innerHeight * 0.3;
            progressBar.style.transform = 'scaleX(' + Math.max(0, Math.min(1, initScrolled / articleHeight)) + ')';
        }
    }

    // ── Next Race Countdown ───────────────────────
    var FALLBACK_RACES = [
        { name: 'Australian GP',    flag: '\u{1F1E6}\u{1F1FA}', date: '2026-03-08T05:00:00Z' },
        { name: 'Chinese GP',       flag: '\u{1F1E8}\u{1F1F3}', date: '2026-03-15T07:00:00Z' },
        { name: 'Japanese GP',      flag: '\u{1F1EF}\u{1F1F5}', date: '2026-03-29T05:00:00Z' },
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

    // Country → flag emoji mapping for Jolpica API responses
    var COUNTRY_FLAGS = {
        'Australia': '\u{1F1E6}\u{1F1FA}', 'China': '\u{1F1E8}\u{1F1F3}',
        'Japan': '\u{1F1EF}\u{1F1F5}',     'Bahrain': '\u{1F1E7}\u{1F1ED}',
        'Saudi Arabia': '\u{1F1F8}\u{1F1E6}', 'United States': '\u{1F1FA}\u{1F1F8}',
        'USA': '\u{1F1FA}\u{1F1F8}',       'United States of America': '\u{1F1FA}\u{1F1F8}',
        'Canada': '\u{1F1E8}\u{1F1E6}',    'Monaco': '\u{1F1F2}\u{1F1E8}',
        'Spain': '\u{1F1EA}\u{1F1F8}',     'Austria': '\u{1F1E6}\u{1F1F9}',
        'UK': '\u{1F1EC}\u{1F1E7}',        'United Kingdom': '\u{1F1EC}\u{1F1E7}',
        'Great Britain': '\u{1F1EC}\u{1F1E7}', 'Belgium': '\u{1F1E7}\u{1F1EA}',
        'Hungary': '\u{1F1ED}\u{1F1FA}',   'Netherlands': '\u{1F1F3}\u{1F1F1}',
        'Italy': '\u{1F1EE}\u{1F1F9}',     'Azerbaijan': '\u{1F1E6}\u{1F1FF}',
        'Singapore': '\u{1F1F8}\u{1F1EC}', 'Mexico': '\u{1F1F2}\u{1F1FD}',
        'Brazil': '\u{1F1E7}\u{1F1F7}',    'Qatar': '\u{1F1F6}\u{1F1E6}',
        'UAE': '\u{1F1E6}\u{1F1EA}',       'United Arab Emirates': '\u{1F1E6}\u{1F1EA}'
    };

    var RACES = FALLBACK_RACES;
    var countdownNameEl = document.getElementById('next-race-name');
    var countdownEl = document.getElementById('race-countdown');
    var countdownMobileEl = document.getElementById('race-countdown-mobile');
    var countdownFlagEl = document.getElementById('race-flag-emoji');
    var countdownMobileRootEl = document.getElementById('nav-countdown-mobile');
    var countdownMobileFlagEl = countdownMobileRootEl
        ? countdownMobileRootEl.querySelector('[data-race-flag-mobile], .countdown-flag-mobile')
        : null;
    var countdownMobileFallbackIconEl = countdownMobileRootEl
        ? countdownMobileRootEl.querySelector('.icon, i')
        : null;
    var countdownTimer = null;

    RACES.forEach(function (r) { r.ts = new Date(r.date).getTime(); });

    function getNextRace(now) {
        for (var i = 0; i < RACES.length; i++) {
            if (RACES[i].ts > now) return RACES[i];
        }
        return null;
    }

    function fmtCountdown(ms) {
        if (ms <= 0) return 'ΕΚΚΙΝΗΣΗ!';
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
        if (ms <= 0) return 'Ξεκίνησε!';
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
        if (countdownTimer) window.clearTimeout(countdownTimer);
        countdownTimer = window.setTimeout(tickCountdown, getNextTickDelay(ms));
    }

    function getCountryFlag(country) {
        var key = String(country || '').trim();
        return COUNTRY_FLAGS[key] || '\u{1F3C1}';
    }

    function getMobileFlagEl() {
        if (countdownMobileFlagEl) return countdownMobileFlagEl;
        if (!countdownMobileRootEl) return null;

        countdownMobileFlagEl = document.createElement('span');
        countdownMobileFlagEl.className = 'countdown-flag-mobile';
        countdownMobileFlagEl.setAttribute('data-race-flag-mobile', '');
        countdownMobileFlagEl.setAttribute('aria-hidden', 'true');

        if (countdownMobileEl) {
            countdownMobileRootEl.insertBefore(countdownMobileFlagEl, countdownMobileEl);
        } else {
            countdownMobileRootEl.appendChild(countdownMobileFlagEl);
        }

        if (countdownMobileFallbackIconEl) {
            countdownMobileFallbackIconEl.setAttribute('hidden', '');
        }

        return countdownMobileFlagEl;
    }

    function setMobileFlag(flag) {
        var flagEl = getMobileFlagEl();
        if (!flagEl) return;
        flagEl.textContent = flag || '\u{1F3C1}';
    }

    function tickCountdown() {
        var now = Date.now();
        var race = getNextRace(now);
        if (!race) {
            if (countdownNameEl) countdownNameEl.textContent = 'Η σεζόν ολοκληρώθηκε';
            if (countdownEl) countdownEl.textContent = '2027 προσεχώς';
            if (countdownMobileEl) countdownMobileEl.textContent = 'Τέλος';
            setMobileFlag(null);
            return;
        }
        var ms = race.ts - now;
        if (countdownNameEl) countdownNameEl.textContent = race.name;
        if (countdownEl) countdownEl.textContent = fmtCountdown(ms);
        if (countdownMobileEl) countdownMobileEl.textContent = fmtShort(ms);
        if (countdownFlagEl) countdownFlagEl.textContent = race.flag;
        setMobileFlag(race.flag);
        scheduleCountdown(ms);
    }

    // ── Fetch live schedule from Jolpica (Ergast replacement) ──
    function parseJolpicaRaces(data) {
        try {
            var races = data.MRData.RaceTable.Races;
            return races.map(function (r) {
                var country = r.Circuit.Location.country;
                var flag = getCountryFlag(country);
                var dateStr = r.date + 'T' + (r.time || '12:00:00Z');
                return { name: r.raceName.replace('Grand Prix', 'GP'), flag: flag, ts: new Date(dateStr).getTime() };
            }).filter(function (r) { return !isNaN(r.ts); });
        } catch (_) { return null; }
    }

    function loadLiveSchedule() {
        var CACHE_KEY = 'f1s-schedule-v2';
        var CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours
        try {
            var cached = JSON.parse(sessionStorage.getItem(CACHE_KEY));
            if (cached && cached.ts && Date.now() - cached.ts < CACHE_TTL && cached.races) {
                RACES = cached.races;
                tickCountdown();
                return;
            }
        } catch (_) {}

        var year = new Date().getFullYear();
        fetch('https://api.jolpi.ca/ergast/f1/' + year + '.json')
            .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
            .then(function (data) {
                var parsed = parseJolpicaRaces(data);
                if (parsed && parsed.length) {
                    RACES = parsed;
                    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), races: parsed })); } catch (_) {}
                    if (countdownTimer) window.clearTimeout(countdownTimer);
                    tickCountdown();
                }
            })
            .catch(function () { /* keep fallback */ });
    }

    if (countdownNameEl || countdownEl || countdownMobileEl || countdownFlagEl) {
        tickCountdown(); // start immediately with fallback
        loadLiveSchedule(); // update async with live data
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) {
                if (countdownTimer) { window.clearTimeout(countdownTimer); countdownTimer = null; }
                return;
            }
            tickCountdown();
        });
    }

    Array.prototype.forEach.call(document.querySelectorAll('[data-current-year]'), function (node) {
        node.textContent = String(new Date().getFullYear());
    });
})();
