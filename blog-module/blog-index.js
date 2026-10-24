// The Edition Index in the browser. Every page is static (blog-module/build/discovery.js) and reads without this
// script. It adds, on every Edition page: ΝΕΟ marks that have expired since the build, the active category in the
// phone strip, cover fallbacks and story prefetch. On index.html it also renders the *views* from the compact index:
// the legacy ?category= and ?author= links keep working, and q, sort and page are new, additive parameters.
// Every view is a URL; links are real links and Back is the browser's. Only typing in search updates in place.
(() => {
    var T = window.F1S_TAXONOMY;
    var main = document.getElementById('main');
    if (!T || !main || !main.classList.contains('edition')) return;

    var root = document.documentElement;
    var PAGE = T.EDITION_LAYOUT.page;
    var INDEX_PATH = '/blog-module/blog/index.html';
    var SECTIONS = '/blog-module/blog/section/';
    var CACHE_KEY = 'f1s-blog-index-v5';
    var CACHE_TTL = 15 * 60 * 1000;
    var DATA_PATHS = ['/blog-module/blog-index-data.json', '../blog-index-data.json', '../../blog-index-data.json'];
    var today = T.athensDay();

    function el(tag, attrs, children) {
        var node = document.createElement(tag);
        Object.keys(attrs || {}).forEach((key) => {
            var value = attrs[key];
            if (value == null || value === false) return;
            if (key === 'class') node.className = value;
            else if (key === 'text') node.textContent = value;
            else node.setAttribute(key, value);
        });
        (children || []).forEach((child) => { if (child != null) node.append(child); });
        return node;
    }
    function norm(value) {
        return String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ς/g, 'σ');
    }
    function all(selector) { return [...main.querySelectorAll(selector)]; }

    // ── Every Edition page ───────────────────────────────
    // ΝΕΟ is a story of the last seven days: the build marks them, and a page cached for days drops the marks
    // whose last day has passed (the reader's Athens calendar day, not the device's time zone).
    all('.ed-new').forEach((mark) => {
        var until = mark.getAttribute('data-new-until');
        if (!T.isDay(until) || !T.isNewStory(T.addDays(until, 1 - T.NEW_DAYS), today)) mark.remove();
    });
    // The strip scrolls sideways; the open section starts in view. Only the strip moves, never the page.
    var strip = main.querySelector('.ed-rail ol');
    // The strip fades at an edge that has more links past it.
    function railEdges() {
        strip.classList.toggle('is-before', strip.scrollLeft > 2);
        strip.classList.toggle('is-after', strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 2);
    }
    function revealRail() {
        var current = strip && strip.querySelector('[aria-current]');
        if (current && strip.scrollWidth > strip.clientWidth) {
            var box = current.getBoundingClientRect();
            var stripBox = strip.getBoundingClientRect();
            strip.scrollLeft += box.left - stripBox.left - (stripBox.width - box.width) / 2;
        }
        if (strip) railEdges();
    }
    revealRail();
    if (strip) {
        // Browsers scroll a focused link in only when it is wholly outside the strip: bring a half-clipped one fully
        // into view, its ring included (the strip's scroll-padding).
        strip.addEventListener('focusin', (event) => { event.target.scrollIntoView({ block: 'nearest', inline: 'nearest' }); });
        strip.addEventListener('scroll', railEdges, { passive: true });
        window.addEventListener('resize', railEdges);
    }
    // A missing cover never leaves a hole: the srcset, then the default image, then a text-only card.
    main.addEventListener('error', (event) => {
        var image = event.target;
        if (!image || image.tagName !== 'IMG') return;
        var fallback = image.getAttribute('data-fallback-src');
        if (image.hasAttribute('srcset')) { image.removeAttribute('srcset'); return; }
        if (fallback && image.getAttribute('src') !== fallback) { image.src = fallback; return; }
        var card = image.closest('.ed-lead, .ed-row');
        if (card) card.setAttribute('data-noimg', '');
        if (image.parentNode) image.parentNode.remove();
    }, true);
    // Fetch a story only once the reader shows intent (keyboard focus, or hover with a fine pointer), and never
    // on data-saving or slow connections.
    var prefetched = {};
    function prefetchStory(event) {
        var link = event.target.closest && event.target.closest('.edition a[href*="/blog-entries/"]');
        var connection = navigator.connection;
        if (!link || prefetched[link.href]) return;
        if (connection && (connection.saveData || /2g|3g/.test(connection.effectiveType || ''))) return;
        prefetched[link.href] = true;
        document.head.appendChild(el('link', { rel: 'prefetch', href: link.href }));
    }
    document.addEventListener('focusin', prefetchStory);
    if (window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) document.addEventListener('pointerover', prefetchStory);

    var archive = document.getElementById('journal-archive');
    var view = document.getElementById('journal-view');
    if (!archive || !view) return;

    // ── Views (index.html) ───────────────────────────────
    var searchInput = document.getElementById('blog-search');
    var posts = [];
    var loaded = false;
    var pending = null;
    var renderToken = 0;
    var searchTimer = null;
    var analyticsTimer = null;

    function authorFrom(value) {
        var wanted = norm(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        // The slug (f1-stories) or the slugified data name (f1-stories-team).
        return !wanted ? null : T.AUTHORS.filter((author) => { return author.slug === wanted || norm(author.name).replace(/[^a-z0-9]+/g, '-') === wanted; })[0] || null;
    }
    function readState() {
        var params = new URL(window.location.href).searchParams;
        return {
            category: T.normalizeCategories(params.get('category') ? [params.get('category')] : [])[0] || '',
            author: authorFrom(params.get('author')),
            q: (params.get('q') || '').trim(),
            sort: params.get('sort') === 'oldest' ? 'oldest' : 'newest',
            page: Math.max(1, parseInt(params.get('page'), 10) || 1)
        };
    }
    function isListing(state) {
        return !!(state.category || state.author || state.q || state.sort === 'oldest' || state.page > 1);
    }
    // The URL of a state: this page, other parameters (tracking tags) kept, ours set or dropped.
    function href(state, change) {
        var next = Object.assign({}, state, change);
        var url = new URL(window.location.href);
        [['category', next.category], ['author', next.author && next.author.slug], ['q', next.q],
            ['sort', next.sort === 'oldest' ? 'oldest' : ''], ['page', next.page > 1 ? next.page : '']].forEach((pair) => {
            if (pair[1]) url.searchParams.set(pair[0], pair[1]); else url.searchParams.delete(pair[0]);
        });
        return url.pathname + url.search;
    }

    // ── Data ─────────────────────────────────────────────
    function decodeFlags(flags, maxPosts) {
        var values = [];
        var runs = (flags || '').split(',');
        for (var i = 0; flags && i < runs.length; i += 1) {
            var length = parseInt(runs[i].slice(1), 36);
            if (!/^[01]/.test(runs[i]) || !length || length > maxPosts - values.length) return [];
            for (var n = 0; n < length; n += 1) values.push(runs[i].charAt(0) === '1');
        }
        return values;
    }
    function expandCompactPosts(data) {
        if (!data || data.v !== 2 || !Array.isArray(data.p)) return null;
        var cardFlags = decodeFlags(data.h, data.p.length);
        return data.p.map((row, index) => {
            var folder = '/blog-module/blog-entries/' + encodeURIComponent(row[0] || '') + '/';
            return {
                id: row[0] || '', title: row[1] || '', author: (data.a || [])[row[2]] || 'F1 Stories', date: row[3] || '',
                thumbnail: folder + (cardFlags[index] ? '1-card.webp' : '1.webp'),
                thumbnailWidth: parseInt(row[4], 10) || 400, thumbnailHeight: parseInt(row[5], 10) || 188,
                excerpt: row[6] || '', readingTime: row[7] || '',
                // The build lists the primary category first.
                categories: (row[8] || []).map((i) => { return data.c[i]; }).filter(Boolean),
                tags: (row[9] || []).map((tag) => { return typeof tag === 'number' ? data.t[tag] : tag; }).filter(Boolean)
            };
        });
    }
    function preparePosts(list) {
        // Newest first by day; the build's order breaks same-day ties (Array#sort is stable).
        return list.slice().sort((a, b) => { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }).map((post) => {
            var postTaxonomy = T.getPostTaxonomy(post);
            post.categories = postTaxonomy.categories;
            post.__search = norm([post.title, post.excerpt, post.author, T.authorLabel(post.author), post.categories.join(' '),
                post.categories.map(T.categoryLabel).join(' '), postTaxonomy.tags.join(' '), post.date].join(' '));
            return post;
        });
    }
    function fetchJson(index) {
        if (index >= DATA_PATHS.length) return Promise.reject(new Error('Unable to load blog data'));
        return fetch(DATA_PATHS[index], { cache: 'no-store', headers: { Accept: 'application/json' } })
            .then((response) => { if (!response.ok) throw new Error('not ok'); return response.json(); })
            .catch(() => { return fetchJson(index + 1); });
    }
    function ensurePosts() {
        if (loaded) return Promise.resolve(posts);
        if (pending) return pending;
        var cached = null;
        try {
            cached = JSON.parse(sessionStorage.getItem(CACHE_KEY));
            cached = cached && Date.now() - cached.ts < CACHE_TTL && Array.isArray(cached.posts) ? cached.posts : null;
        } catch (_) {}
        if (cached) { posts = preparePosts(cached); loaded = true; return Promise.resolve(posts); }
        pending = fetchJson(0).then((data) => {
            var list = expandCompactPosts(data) || (data && data.posts) || [];
            try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), posts: list })); } catch (_) {}
            posts = preparePosts(list);
            loaded = true;
            return posts;
        }).catch((error) => { pending = null; throw error; });
        return pending;
    }

    // ── Pieces (the class names of blog-module/build/discovery.js) ──
    function row(post) {
        var primary = post.categories[0] || 'News';
        var date = T.isDay(post.date) ? T.ledgerDate(post.date) : null;
        var minutes = T.formatReadingTime(post.readingTime);
        var fresh = T.isNewStory(post.date, today);
        return el('li', { class: 'ed-row', 'data-kind': T.categoryKind(primary) }, [el('a', { class: 'ed-row__link blog-card-link', href: '/blog-module/blog-entries/' + post.id + '/article.html' }, [
            date ? el('time', { class: 'ed-date ed-num', datetime: post.date }, [date.day + ' ' + date.month, el('span', { class: 'visually-hidden', text: ' ' + date.year })])
                : el('span', { class: 'ed-date', 'aria-hidden': 'true' }),
            el('div', { class: 'ed-row__text' }, [
                el('span', { class: 'ed-kicker' }, [T.greekUpper(T.categoryLabel(primary)), fresh ? el('span', { class: 'ed-new', 'data-new-until': T.newUntil(post.date), text: 'ΝΕΟ' }) : null]),
                el('h4', { class: 'ed-headline' }, [el('span', { class: 'ed-title-link', text: post.title })]),
                el('p', { class: 'ed-meta' }, [T.authorLabel(post.author), minutes].filter(Boolean).map((text) => { return el('span', { text: text }); }))
            ])
        ])]);
    }
    function monthGroups(list) {
        var groups = [];
        list.forEach((post) => {
            var key = post.date.slice(0, 7);
            if (!groups.length || groups[groups.length - 1].key !== key) groups.push({ key: key, posts: [] });
            groups[groups.length - 1].posts.push(post);
        });
        return groups.map((group) => {
            var dated = T.isDay(group.key + '-01');
            return el('section', { class: 'ed-month', 'aria-label': dated ? null : 'Χωρίς ημερομηνία' }, [
                dated ? el('h3', { class: 'ed-month__title', text: T.monthName(group.key) }) : null,
                el('ol', { class: 'ed-rows' }, group.posts.map(row))
            ]);
        });
    }
    function pager(state, total) {
        if (total <= 1) return null;
        function step(to, text, rel) {
            return to < 1 || to > total ? el('span', { class: 'ed-pages__step is-off', text: text })
                : el('a', { class: 'ed-pages__step', rel: rel, href: href(state, { page: to }), text: text });
        }
        var items = T.pageItems(state.page, total).map((item) => {
            if (item === '…') return el('li', {}, [el('span', { class: 'ed-pages__gap', 'aria-hidden': 'true', text: '…' })]);
            return el('li', {}, [item === state.page
                ? el('span', { class: 'ed-pages__num', 'aria-current': 'page' }, [el('span', { class: 'visually-hidden', text: 'Σελίδα ' }), String(item)])
                : el('a', { class: 'ed-pages__num', href: href(state, { page: item }), 'aria-label': 'Σελίδα ' + item, text: String(item) })]);
        });
        return el('nav', { class: 'ed-pages', id: 'blog-pagination', 'aria-label': 'Σελίδες' }, [step(state.page - 1, '← Νεότερες', 'prev'), el('ol', {}, items), step(state.page + 1, 'Παλαιότερες →', 'next')]);
    }
    // "Ειδήσεις · Ανάλυση · …" as links to the static section pages, for the empty and failure messages.
    function sectionNames() {
        var nodes = [];
        T.PUBLIC_CATEGORIES.forEach((name, i) => {
            if (i) nodes.push(' · ');
            nodes.push(el('a', { href: SECTIONS + T.categoryKind(name) + '/', text: T.categoryLabel(name) }));
        });
        return nodes;
    }

    // ── Rendering a state ────────────────────────────────
    function viewOf(state) { return state.author ? 'author' : state.category ? 'category' : state.q ? 'search' : 'all'; }
    function head(state, list) {
        var months = list.map((post) => { return post.date.slice(0, 7); }).filter((key) => { return T.isDay(key + '-01'); }).sort();
        var range = months.length ? T.monthName(months[0]) + ' – ' + T.monthName(months[months.length - 1]) : '';
        var facts = list.length ? T.plural(list.length, 'ιστορία', 'ιστορίες') + (range ? ' · ' + range : '') + (state.page > 1 ? ' · Σελίδα ' + state.page : '') : 'Καμία ιστορία';
        var count = el('p', { class: 'ed-section__facts ed-num', id: 'post-count', 'aria-live': 'polite', text: facts });
        var author = state.author;
        if (author) {
            return el('header', { class: 'ed-byline__head' }, [
                el('img', { class: 'ed-byline__portrait', src: author.portrait, alt: '', width: 168, height: 168 }),
                el('div', {}, [el('p', { class: 'ed-label', text: 'Υπογραφή · ' + author.desk }),
                    el('h1', { class: 'ed-section__title', id: 'journal-archive-title', text: author.label }),
                    el('p', { class: 'ed-byline__spec', text: author.specialty }), count,
                    el('p', {}, [el('a', { class: 'ed-sechead__more', href: T.authorPath(author), text: 'Το προφίλ στους Συντάκτες →' })])])
            ]);
        }
        return el('header', { class: 'ed-section__head' }, [el('p', { class: 'ed-label', text: state.category ? 'Ενότητα' : state.q ? 'Αναζήτηση' : 'Αρχείο' }),
            el('h1', { class: 'ed-section__title', id: 'journal-archive-title', text: state.category ? T.categoryLabel(state.category) : state.q ? '«' + state.q + '»' : 'Όλες οι ιστορίες' }), count]);
    }
    // With two or more filters in play each one gets a link that removes just that filter.
    function filters(state) {
        var chips = [['category', state.category && T.categoryLabel(state.category), ''], ['author', state.author && state.author.label, null], ['q', state.q && '«' + state.q + '»', '']]
            .filter((chip) => { return chip[1]; });
        return chips.length < 2 ? null : el('p', { class: 'ed-filters' }, [el('span', { text: 'Φίλτρα:' })].concat(chips.map((chip) => {
            var change = { page: 1 };
            change[chip[0]] = chip[2];
            return el('a', { href: href(state, change) }, [chip[1], el('span', { class: 'visually-hidden', text: ' — αφαίρεση φίλτρου' })]);
        })));
    }
    function sortSwitch(state) {
        return el('p', { class: 'ed-sort' }, [el('span', { class: 'visually-hidden', text: 'Σειρά: ' })].concat([['newest', 'Νεότερα'], ['oldest', 'Παλαιότερα']].map((option) => {
            return state.sort === option[0] ? el('span', { 'aria-current': 'true', text: option[1] }) : el('a', { href: href(state, { sort: option[0], page: 1 }), text: option[1] });
        })));
    }
    function render(state, list) {
        var kind = viewOf(state);
        // Oldest first is a stable ascending sort, so same-day stories keep the build's order.
        var ordered = state.sort === 'oldest' ? list.slice().sort((a, b) => { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }) : list;
        var total = Math.max(1, Math.ceil(ordered.length / PAGE));
        state.page = Math.min(state.page, total);
        var from = (state.page - 1) * PAGE;
        var slice = ordered.slice(from, from + PAGE);
        var body = slice.length ? el('section', { class: 'ed-list', 'aria-labelledby': 'ed-list-title' }, [
            el('header', { class: 'ed-sechead' }, [el('h2', { id: 'ed-list-title', class: 'ed-label', text: 'Όλες οι ιστορίες' }),
                el('p', { class: 'ed-sechead__note ed-num', text: (from + 1) + '–' + (from + slice.length) + ' από ' + ordered.length }), sortSwitch(state)]),
            el('div', { id: 'articles-grid' }, monthGroups(slice)), pager(state, total)])
            : el('p', { class: 'ed-empty', role: 'status' }, ['Δεν βρέθηκε ιστορία' + (state.q ? ' για «' + state.q + '»' : '') + '. Δοκίμασε άλλη λέξη ή άνοιξε μια ενότητα: '].concat(sectionNames()));
        view.replaceChildren(el('section', {
            class: kind === 'author' ? 'ed-byline' : 'ed-section',
            'data-kind': kind === 'category' ? T.categoryKind(state.category) : null,
            'data-author-slug': state.author ? state.author.slug : null
        }, [head(state, list), filters(state), el('div', { class: 'ed-columns' }, [body])]));
        return kind;
    }

    // ── Chrome that follows the state ────────────────────
    function setMastTitle(asHeading) {
        var title = main.querySelector('.ed-title');
        if (!title || (title.tagName === 'H1') === asHeading) return;
        var next = el(asHeading ? 'h1' : 'p', { class: 'ed-title' });
        next.append(...title.childNodes);
        title.replaceWith(next);
    }
    function syncChrome(state) {
        var listing = isListing(state);
        var section = listing && state.category && !state.author;
        root.toggleAttribute('data-journal-filtered', listing);
        main.classList.toggle('ed-page--section', !!section);
        setMastTitle(!listing);
        if (searchInput && searchInput.value !== state.q) searchInput.value = state.q;
        all('.ed-contents__list a, .ed-rail a').forEach((link) => {
            var kind = (/\/section\/([^/]+)\//.exec(link.getAttribute('href')) || [])[1];
            var current = section ? kind === T.categoryKind(state.category) : link.getAttribute('href') === INDEX_PATH;
            if (current) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
        });
        var label = main.querySelector('.ed-contents__current');
        if (label) label.textContent = section ? T.categoryLabel(state.category) : 'Όλες οι ενότητες';
        revealRail();
    }

    var baseTitle = document.title;
    var scrollKey = () => { return 'f1s-edition-scroll:' + location.pathname + location.search; };
    var restore = (performance.getEntriesByType && (performance.getEntriesByType('navigation')[0] || {}).type) === 'back_forward';
    // The view renders after the data arrives, so the browser cannot restore the scroll; Back does it here.
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.addEventListener('pagehide', () => { try { sessionStorage.setItem(scrollKey(), String(window.scrollY)); } catch (_) {} });
    function restoreScroll() {
        if (!restore) return;
        restore = false;
        var y = 0;
        try { y = parseInt(sessionStorage.getItem(scrollKey()), 10) || 0; } catch (_) {}
        if (y) window.requestAnimationFrame(() => { window.scrollTo({ top: y, behavior: 'instant' }); });
    }

    function show() {
        var state = readState();
        syncChrome(state);
        if (!isListing(state)) {
            renderToken += 1;
            archive.removeAttribute('aria-busy');
            Object.assign(archive.dataset, { category: '', author: '', query: '', view: 'all', sort: 'newest', page: 1 });
            document.title = baseTitle;
            restoreScroll();
            return;
        }
        archive.setAttribute('aria-busy', 'true');
        var token = ++renderToken;
        // Both sources settle before one render; even a stalled helper cannot hold articles indefinitely.
        var extra = state.q ? Promise.race([
            import(SEARCH_DESTINATIONS_URL).then(() => window.F1S_SEARCH.prepare(state, el)),
            new Promise(resolve => setTimeout(resolve, 400))
        ]) : null;
        Promise.allSettled([ensurePosts(), extra]).then((results) => {
            if (token !== renderToken) return;
            var articlesOK = results[0].status === 'fulfilled';
            var q = norm(state.q);
            var list = articlesOK ? posts.filter((post) => {
                return (!state.category || post.categories.indexOf(state.category) !== -1)
                    && (!state.author || post.author === state.author.name)
                    && (!q || post.__search.indexOf(q) !== -1);
            }) : [];
            if (articlesOK) {
                var kind = render(state, list);
                Object.assign(archive.dataset, { view: kind, category: state.category, author: state.author ? state.author.slug : '', query: state.q, sort: state.sort, page: state.page, total: list.length });
                document.title = (state.author ? state.author.label : state.category ? T.categoryLabel(state.category) : state.q ? '«' + state.q + '»' : 'Όλες οι ιστορίες') + ' — Αρχείο F1 Stories';
            } else {
                archive.dataset.total = 0;
                view.replaceChildren(el('p', { class: 'ed-empty', role: 'status' }, ['Δεν ήταν δυνατή η φόρτωση του αρχείου. Δοκίμασε ξανά σε λίγο ή άνοιξε μια ενότητα: '].concat(sectionNames())));
            }
            if (state.q) {
                if (results[1].value) results[1].value(view, articlesOK, list.length);
                else view.append(el('p', { role: 'status', text: 'Δεν ήταν δυνατή η φόρτωση θεμάτων και εργαλείων.' }));
            }
            archive.removeAttribute('aria-busy');
            restoreScroll();
        });
    }

    // Typing in the masthead search narrows the list in place: one history entry for the whole search.
    function setQuery(value) {
        var state = readState();
        var next = href(state, { q: value.trim(), page: 1 });
        if (next !== location.pathname + location.search) history[state.q ? 'replaceState' : 'pushState'](null, '', next);
        show();
    }
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => { setQuery(searchInput.value); }, 250);
            clearTimeout(analyticsTimer);
            analyticsTimer = setTimeout(() => {
                var analytics = window.f1storiesAnalytics;
                var query = searchInput.value.trim();
                if (query && analytics && analytics.getConsentState().analytics_storage === 'granted') analytics.trackEvent('journal_search', { query_length: query.length, result_count: Number(archive.getAttribute('data-total')) || 0 });
            }, 900);
        });
        if (searchInput.form) searchInput.form.addEventListener('submit', (event) => { event.preventDefault(); clearTimeout(searchTimer); setQuery(searchInput.value); });
    }
    window.addEventListener('popstate', show);
    window.addEventListener('pageshow', event => {
        if (event.persisted && readState().q) {
            if (window.F1S_SEARCH) window.F1S_SEARCH.reset();
            show();
        }
    });
    show();
})();
