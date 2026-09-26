// The Journal archive. The build ships the front page and the first ledger page as
// static HTML (blog-module/build/index.js); this script loads the compact index only
// when a reader filters, searches, re-sorts or pages, and renders ledger rows from it.
document.addEventListener('DOMContentLoaded', function() {
    var taxonomy = window.F1S_TAXONOMY;
    var ledger = document.getElementById('articles-grid');
    if (!taxonomy || !ledger) return;

    var LAYOUT = taxonomy.JOURNAL_LAYOUT;
    var root = document.documentElement;
    var edition = document.getElementById('journal-edition');
    var archive = document.getElementById('journal-archive');
    var archiveTitle = document.getElementById('journal-archive-title');
    var countEl = document.getElementById('post-count');
    var searchInput = document.getElementById('blog-search');
    var searchClearBtn = document.getElementById('blog-search-clear');
    var sortSelect = document.getElementById('blog-sort-select');
    var resetBtn = document.getElementById('blog-filter-reset');
    var filterToggle = document.getElementById('journal-filter-toggle');
    var filterPanel = document.getElementById('journal-filter-panel');
    var categoryOptions = document.getElementById('category-strip');
    var authorOptions = document.getElementById('author-strip');
    var paginationEl = document.getElementById('blog-pagination');
    var CACHE_KEY = 'f1s-blog-index-v4-primary';
    var CACHE_TTL = 15 * 60 * 1000;
    var FULL_DATA_PATHS = ['/blog-module/blog-index-data.json', '../blog-index-data.json', '../../blog-index-data.json'];
    var ARCHIVE_TITLE = archiveTitle ? archiveTitle.textContent : 'ΤΟ ΑΡΧΕΙΟ';

    // Stories already on the front page are left out of the unfiltered ledger.
    var frontIds = edition ? (edition.getAttribute('data-story-ids') || '').split(/\s+/).filter(Boolean) : [];
    var totalPosts = edition ? parseInt(edition.getAttribute('data-total'), 10) || 0 : 0;
    var staticLedger = !!ledger.querySelector('.ledger-row');
    var allPosts = [];
    var fullPostsLoaded = false;
    var fullPostsPromise = null;
    var activeAuthor = authorFromUrl();
    var activeCategory = categoryFromUrl();
    var activeQuery = '';
    var sortDir = -1;
    var currentPage = 1;
    var filteredPosts = [];
    var searchTimer = null;

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }
    function slugify(value) {
        return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
            .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }
    function normalizeText(value) {
        return String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    }
    function categoryFromUrl() {
        var requested = new URL(window.location.href).searchParams.get('category');
        return taxonomy.normalizeCategories(requested ? [requested] : [])[0] || 'all';
    }
    // The URL carries a slug; filtering compares canonical names from the author options.
    function authorFromUrl() {
        var requested = new URL(window.location.href).searchParams.get('author');
        if (!requested) return 'all';
        var option = authorOption(requested);
        return option ? option.getAttribute('data-author') : String(requested).trim();
    }
    function authorOption(value) {
        if (!authorOptions) return null;
        var wanted = slugify(value);
        return Array.prototype.find.call(authorOptions.querySelectorAll('[data-author]'), function(option) {
            return option.getAttribute('data-author') !== 'all' && slugify(option.getAttribute('data-author')) === wanted;
        }) || null;
    }
    function syncUrl() {
        var url = new URL(window.location.href);
        if (activeCategory === 'all') url.searchParams.delete('category');
        else url.searchParams.set('category', activeCategory);
        if (activeAuthor === 'all') url.searchParams.delete('author');
        else url.searchParams.set('author', slugify(activeAuthor));
        if (url.href !== window.location.href) window.history.pushState(null, '', url.href);
    }

    function isFiltered() {
        return activeAuthor !== 'all' || activeCategory !== 'all' || !!activeQuery;
    }
    // The static first page is exactly the unfiltered, newest-first ledger page 1.
    function isStaticView() {
        return !isFiltered() && sortDir === -1 && currentPage === 1;
    }

    // ── Data ─────────────────────────────────────────────
    function decodeFlags(flags, maxPosts) {
        var values = [];
        if (!flags) return values;
        var runs = flags.split(',');
        for (var i = 0; i < runs.length; i += 1) {
            var marker = runs[i].charAt(0);
            var length = parseInt(runs[i].slice(1), 36);
            if ((marker !== '0' && marker !== '1') || !length || length > maxPosts - values.length) return [];
            for (var n = 0; n < length; n += 1) values.push(marker === '1');
        }
        return values;
    }
    function expandCompactPosts(data) {
        if (!data || data.v !== 2 || !Array.isArray(data.p)) return null;
        var authors = data.a || [];
        var categories = data.c || [];
        var tags = data.t || [];
        var cardFlags = typeof data.h === 'string' ? decodeFlags(data.h, data.p.length) : [];
        return data.p.map(function(row, index) {
            var id = row[0] || '';
            var folder = '/blog-module/blog-entries/' + encodeURIComponent(id) + '/';
            var postCategories = (Array.isArray(row[8]) ? row[8] : []).map(function(i) { return categories[i]; }).filter(Boolean);
            return {
                id: id,
                title: row[1] || '',
                author: authors[row[2]] || 'F1 Stories',
                date: row[3] || '',
                thumbnail: folder + (cardFlags[index] ? '1-card.webp' : '1.webp'),
                thumbnailWidth: parseInt(row[4], 10) || 400,
                thumbnailHeight: parseInt(row[5], 10) || 188,
                excerpt: row[6] || '',
                readingTime: row[7] || '',
                // The build lists the primary category first.
                category: postCategories[0],
                categories: postCategories,
                tags: Array.isArray(row[9]) ? row[9].map(function(tag) { return typeof tag === 'number' ? tags[tag] : tag; }).filter(Boolean) : []
            };
        });
    }
    function preparePosts(posts) {
        return (posts || []).slice().sort(function(a, b) { return new Date(b.date) - new Date(a.date); }).map(function(post) {
            var postTaxonomy = taxonomy.getPostTaxonomy(post);
            post.category = postTaxonomy.category;
            post.categories = postTaxonomy.categories;
            post.tags = postTaxonomy.tags;
            post.__search = normalizeText([
                post.title, post.excerpt, post.author, taxonomy.authorLabel(post.author),
                post.categories.join(' '), post.categories.map(taxonomy.categoryLabel).join(' '),
                post.tags.join(' '), post.date
            ].join(' '));
            return post;
        });
    }
    function readCache() {
        try {
            var cached = JSON.parse(sessionStorage.getItem(CACHE_KEY));
            if (cached && Date.now() - cached.ts < CACHE_TTL && Array.isArray(cached.posts)) return cached.posts;
        } catch (_) {}
        return null;
    }
    function writeCache(posts) {
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), posts: posts })); } catch (_) {}
    }
    function fetchJson(paths, index) {
        index = index || 0;
        if (index >= paths.length) return Promise.reject(new Error('Unable to load blog data'));
        return fetch(paths[index], { cache: 'no-store', headers: { Accept: 'application/json' } })
            .then(function(response) { if (!response.ok) throw new Error('not ok'); return response.json(); })
            .catch(function() { return fetchJson(paths, index + 1); });
    }
    function setPosts(posts) {
        allPosts = preparePosts(posts);
        fullPostsLoaded = true;
        if (activeAuthor !== 'all') {
            var wanted = slugify(activeAuthor);
            var match = allPosts.find(function(post) { return post.author === activeAuthor || slugify(post.author) === wanted; });
            activeAuthor = match ? match.author : 'all';
        }
    }
    function ensurePosts() {
        if (fullPostsLoaded) return Promise.resolve(allPosts);
        if (fullPostsPromise) return fullPostsPromise;
        var cached = readCache();
        if (cached) {
            setPosts(cached);
            return Promise.resolve(allPosts);
        }
        fullPostsPromise = fetchJson(FULL_DATA_PATHS).then(function(data) {
            var posts = expandCompactPosts(data) || (data && data.posts) || [];
            writeCache(posts);
            setPosts(posts);
            return allPosts;
        }).catch(function(error) {
            fullPostsPromise = null;
            throw error;
        });
        return fullPostsPromise;
    }

    // ── Rendering ────────────────────────────────────────
    function storyKicker(post) {
        var kicker = el('p', 'story-kicker');
        kicker.appendChild(el('span', 'story-cat', taxonomy.greekUpper(taxonomy.categoryLabel(post.category || 'News'))));
        return kicker;
    }
    function storyMeta(post) {
        var meta = el('p', 'story-meta');
        meta.appendChild(el('span', null, taxonomy.authorLabel(post.author || 'F1 Stories')));
        var minutes = taxonomy.formatReadingTime(post.readingTime || post.readTime || '');
        if (minutes) meta.appendChild(el('span', null, minutes));
        return meta;
    }
    function storyImage(post) {
        var image = el('img');
        var srcset = taxonomy.cardImageSrcset(post.thumbnail, false);
        if (srcset) {
            image.srcset = srcset;
            image.sizes = taxonomy.CARD_SIZES.archiveLedger;
        }
        image.src = post.thumbnail;
        image.width = post.thumbnailWidth;
        image.height = post.thumbnailHeight;
        image.loading = 'lazy';
        image.decoding = 'async';
        image.alt = '';
        image.setAttribute('data-fallback-src', '/blog-module/images/default-blog.jpg');
        return image;
    }
    function ledgerRow(post, index) {
        var date = taxonomy.ledgerDate(post.date);
        var picture = taxonomy.isLedgerPicture(index) && !!post.thumbnail;
        var row = el('li', 'ledger-row' + (picture ? ' ledger-row--picture' : ''));
        row.setAttribute('data-kind', taxonomy.categoryKind(post.category));
        var link = el('a', 'ledger-row__link');
        link.href = post.url || ('/blog-module/blog-entries/' + post.id + '/article.html');
        var time = el('time', 'ledger-row__date');
        time.dateTime = post.date || '';
        if (date) {
            time.textContent = date.day + ' ' + date.month;
            time.appendChild(el('span', 'visually-hidden', ' ' + date.year));
        } else {
            time.textContent = taxonomy.formatDate(post.date);
        }
        link.append(time, storyKicker(post));
        if (picture) {
            var media = el('span', 'ledger-row__media');
            media.appendChild(storyImage(post));
            link.appendChild(media);
        }
        link.appendChild(el('h3', 'ledger-row__title', post.title || ''));
        if (picture && post.excerpt) link.appendChild(el('p', 'ledger-row__excerpt', post.excerpt));
        link.appendChild(storyMeta(post));
        row.appendChild(link);
        return row;
    }
    // Month rules group the rows; every page opens with its month.
    function ledgerRows(posts, start) {
        var month = '';
        var rows = [];
        posts.forEach(function(post, offset) {
            var date = taxonomy.ledgerDate(post.date);
            if (date && date.key !== month) {
                month = date.key;
                var rule = el('li', 'ledger-month', date.monthTitle);
                rule.setAttribute('aria-hidden', 'true');
                rows.push(rule);
            }
            rows.push(ledgerRow(post, start + offset));
        });
        return rows;
    }
    function emptyState(text) {
        return el('li', 'ledger-empty', text);
    }

    function getFilteredPosts() {
        var query = normalizeText(activeQuery);
        var skip = isFiltered() ? [] : frontIds;
        return allPosts.filter(function(post) {
            return (activeAuthor === 'all' || post.author === activeAuthor)
                && (activeCategory === 'all' || post.categories.indexOf(activeCategory) !== -1)
                && (!query || post.__search.indexOf(query) !== -1)
                && skip.indexOf(post.id) === -1;
        }).sort(function(a, b) { return sortDir * (new Date(a.date) - new Date(b.date)); });
    }
    function resultCount() {
        return isFiltered() || fullPostsLoaded ? filteredPosts.length : Math.max(0, totalPosts - frontIds.length);
    }

    function pageRange(current, total) {
        if (total <= 7) return Array.from({ length: total }, function(_, i) { return i + 1; });
        var pages = [1];
        var left = Math.max(2, current - 1);
        var right = Math.min(total - 1, current + 1);
        if (left > 2) pages.push('…');
        for (var page = left; page <= right; page += 1) pages.push(page);
        if (right < total - 1) pages.push('…');
        pages.push(total);
        return pages;
    }
    function pageButton(label, page, ariaLabel, disabled) {
        var button = el('button', 'ledger-page', label);
        button.type = 'button';
        button.setAttribute('data-page', page);
        button.setAttribute('aria-label', ariaLabel);
        button.disabled = !!disabled;
        return button;
    }
    function renderPagination() {
        if (!paginationEl) return;
        var totalPages = Math.ceil(resultCount() / LAYOUT.page);
        if (totalPages <= 1) { paginationEl.replaceChildren(); return; }
        var nodes = [pageButton('←', currentPage - 1, 'Προηγούμενη σελίδα', currentPage === 1)];
        pageRange(currentPage, totalPages).forEach(function(item) {
            if (item === '…') { nodes.push(el('span', 'ledger-page-gap', '…')); return; }
            var button = pageButton(String(item), item, 'Σελίδα ' + item);
            if (item === currentPage) button.setAttribute('aria-current', 'page');
            nodes.push(button);
        });
        nodes.push(pageButton('→', currentPage + 1, 'Επόμενη σελίδα', currentPage === totalPages));
        paginationEl.replaceChildren.apply(paginationEl, nodes);
    }

    // The archive head names the current view: the archive, a topic, a writer or a search.
    function renderArchiveHead() {
        var option = activeAuthor !== 'all' ? authorOption(activeAuthor) : null;
        var title = ARCHIVE_TITLE;
        var notes = [];
        if (option) title = option.textContent.trim();
        else if (activeCategory !== 'all') title = taxonomy.greekUpper(taxonomy.categoryLabel(activeCategory));
        else if (activeQuery) title = 'ΑΝΑΖΗΤΗΣΗ';
        if (option && option.getAttribute('data-specialty')) notes.push(option.getAttribute('data-specialty'));
        if (option && activeCategory !== 'all') notes.push(taxonomy.categoryLabel(activeCategory));
        if (activeQuery) notes.push('«' + activeQuery + '»');
        if (archiveTitle) {
            var nodes = [];
            var portrait = option && option.querySelector('img');
            if (portrait) {
                var image = el('img', 'journal-archive__portrait');
                image.src = portrait.getAttribute('src');
                image.alt = '';
                image.width = 48;
                image.height = 48;
                nodes.push(image);
            }
            nodes.push(document.createTextNode(title));
            archiveTitle.replaceChildren.apply(archiveTitle, nodes);
        }
        if (archive) {
            archive.setAttribute('data-view', option ? 'author' : activeCategory !== 'all' ? 'category' : activeQuery ? 'search' : 'all');
            if (activeCategory !== 'all' && !option) archive.setAttribute('data-kind', taxonomy.categoryKind(activeCategory));
            else archive.removeAttribute('data-kind');
            // A writer's view is ruled in that writer's accent ink (CSS, keyed by slug).
            if (option) archive.setAttribute('data-author-slug', option.getAttribute('data-author-slug'));
            else archive.removeAttribute('data-author-slug');
        }
        if (countEl) {
            var count = resultCount() + (isFiltered() ? 0 : frontIds.length);
            countEl.textContent = notes.concat(count + ' ' + (count === 1 ? 'άρθρο' : 'άρθρα')).join(' · ');
        }
    }
    function syncControls() {
        if (resetBtn) resetBtn.hidden = !isFiltered();
        if (searchClearBtn) searchClearBtn.hidden = !(searchInput && searchInput.value);
        [[categoryOptions, 'data-category', activeCategory], [authorOptions, 'data-author', activeAuthor]].forEach(function(group) {
            if (!group[0]) return;
            Array.prototype.forEach.call(group[0].querySelectorAll('[' + group[1] + ']'), function(option) {
                if (option.getAttribute(group[1]) === group[2]) option.setAttribute('aria-current', 'true');
                else option.removeAttribute('aria-current');
            });
        });
    }
    // Hiding or showing the front page must not move the archive under the reader.
    function syncEdition() {
        var filtered = isFiltered();
        if (root.hasAttribute('data-journal-filtered') === filtered) return;
        var before = archive ? archive.getBoundingClientRect().top : 0;
        root.toggleAttribute('data-journal-filtered', filtered);
        if (!archive || before > window.innerHeight) return;
        var shift = archive.getBoundingClientRect().top - before;
        // Instant: the site's smooth scrolling would visibly slide the page back.
        if (shift) window.scrollBy({ top: shift, behavior: 'instant' });
    }

    function render(options) {
        options = options || {};
        syncEdition();
        syncControls();
        if (!fullPostsLoaded && !isStaticView()) {
            ledger.setAttribute('aria-busy', 'true');
            ensurePosts().then(function() { render(options); }, showLoadFailure);
            return;
        }
        ledger.removeAttribute('aria-busy');
        if (!fullPostsLoaded) {
            // Unfiltered page 1: the static HTML is already the right ledger.
            renderArchiveHead();
            renderPagination();
            return;
        }
        filteredPosts = getFilteredPosts();
        var totalPages = Math.max(1, Math.ceil(filteredPosts.length / LAYOUT.page));
        currentPage = Math.max(1, Math.min(currentPage, totalPages));
        renderArchiveHead();
        if (isStaticView() && staticLedger) {
            renderPagination();
            return;
        }
        staticLedger = false;
        var start = (currentPage - 1) * LAYOUT.page;
        var rows = ledgerRows(filteredPosts.slice(start, start + LAYOUT.page), start);
        if (!rows.length) rows = [emptyState('Δεν βρέθηκαν άρθρα.')];
        ledger.replaceChildren.apply(ledger, rows);
        renderPagination();
        if (options.scroll && archive) archive.scrollIntoView({ block: 'start' });
    }
    function showLoadFailure() {
        ledger.removeAttribute('aria-busy');
        if (countEl) countEl.textContent = 'Δεν ήταν δυνατή η φόρτωση του αρχείου.';
        if (!isStaticView()) ledger.replaceChildren(emptyState('Δεν ήταν δυνατή η φόρτωση των άρθρων. Δοκίμασε ξανά σε λίγο.'));
    }

    function update(change, options) {
        clearTimeout(searchTimer);
        change();
        currentPage = 1;
        render(options);
    }

    // ── Events ───────────────────────────────────────────
    ledger.addEventListener('error', function(event) {
        var image = event.target;
        if (!image || image.tagName !== 'IMG') return;
        var fallback = image.getAttribute('data-fallback-src');
        if (image.hasAttribute('srcset')) { image.removeAttribute('srcset'); return; }
        if (fallback && image.getAttribute('src') !== fallback) { image.src = fallback; return; }
        var media = image.closest('.ledger-row__media');
        if (media) media.remove();
    }, true);

    // Filter options are real links (they work without script); here they update in place.
    function bindOptions(container, attribute, apply) {
        if (!container) return;
        container.addEventListener('click', function(event) {
            var option = event.target.closest('[' + attribute + ']');
            if (!option || event.metaKey || event.ctrlKey || event.shiftKey || event.button) return;
            event.preventDefault();
            update(function() { apply(option.getAttribute(attribute)); syncUrl(); });
            // On phones the panel sits above the results: close it so they are in view.
            if (filterToggle && getComputedStyle(filterToggle).display !== 'none') setFiltersOpen(false);
        });
    }
    bindOptions(categoryOptions, 'data-category', function(value) {
        activeCategory = taxonomy.normalizeCategories([value])[0] || 'all';
    });
    bindOptions(authorOptions, 'data-author', function(value) { activeAuthor = value || 'all'; });

    if (searchInput) {
        searchInput.addEventListener('input', function() {
            if (searchClearBtn) searchClearBtn.hidden = !searchInput.value;
            clearTimeout(searchTimer);
            searchTimer = setTimeout(function() {
                update(function() { activeQuery = searchInput.value.trim(); });
            }, 250);
        });
    }
    if (searchClearBtn) {
        searchClearBtn.addEventListener('click', function() {
            update(function() { activeQuery = ''; searchInput.value = ''; });
            searchInput.focus();
        });
    }
    if (sortSelect) {
        sortSelect.addEventListener('change', function() {
            update(function() { sortDir = sortSelect.value === 'oldest' ? 1 : -1; });
        });
    }
    if (resetBtn) {
        resetBtn.addEventListener('click', function() {
            update(function() {
                activeAuthor = 'all';
                activeCategory = 'all';
                activeQuery = '';
                if (searchInput) searchInput.value = '';
                syncUrl();
            });
        });
    }
    if (paginationEl) {
        paginationEl.addEventListener('click', function(event) {
            var button = event.target.closest('.ledger-page');
            if (!button || button.disabled) return;
            currentPage = parseInt(button.getAttribute('data-page'), 10) || 1;
            render({ scroll: true });
        });
    }

    function setFiltersOpen(open) {
        if (!filterPanel || !filterToggle) return;
        filterPanel.classList.toggle('is-open', open);
        filterToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    if (filterToggle) {
        filterToggle.addEventListener('click', function() {
            setFiltersOpen(filterToggle.getAttribute('aria-expanded') !== 'true');
        });
    }
    document.addEventListener('keydown', function(event) {
        if (event.key !== 'Escape' || !filterPanel || !filterPanel.classList.contains('is-open')) return;
        setFiltersOpen(false);
        filterToggle.focus();
    });

    // Masthead shortcuts: jump to the archive, then focus search or open the filters.
    Array.prototype.forEach.call(document.querySelectorAll('[data-journal-open]'), function(link) {
        link.addEventListener('click', function(event) {
            if (!archive) return;
            event.preventDefault();
            archive.scrollIntoView({ block: 'start' });
            if (link.getAttribute('data-journal-open') === 'search' && searchInput) searchInput.focus({ preventScroll: true });
            else if (filterToggle && getComputedStyle(filterToggle).display !== 'none') {
                setFiltersOpen(true);
                filterToggle.focus({ preventScroll: true });
            }
        });
    });

    // Fetch a story only once the reader shows intent (keyboard focus, or hover with
    // a fine pointer), and never on data-saving or slow connections.
    var prefetched = {};
    function prefetchStory(event) {
        var link = event.target.closest && event.target.closest('.journal a[href*="/blog-entries/"]');
        var connection = navigator.connection;
        if (!link || prefetched[link.href]) return;
        if (connection && (connection.saveData || /2g|3g/.test(connection.effectiveType || ''))) return;
        prefetched[link.href] = true;
        var hint = document.createElement('link');
        hint.rel = 'prefetch';
        hint.href = link.href;
        document.head.appendChild(hint);
    }
    document.addEventListener('focusin', prefetchStory);
    if (window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        document.addEventListener('pointerover', prefetchStory);
    }

    window.addEventListener('popstate', function() {
        update(function() {
            activeAuthor = authorFromUrl();
            activeCategory = categoryFromUrl();
        });
    });

    render();
});
