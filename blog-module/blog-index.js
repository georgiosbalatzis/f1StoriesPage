document.addEventListener('DOMContentLoaded', function() {

    var allPosts = [];
    var activeAuthor = 'all';
    var grid = document.getElementById('articles-grid');
    var countEl = document.getElementById('post-count');
    var searchInput = document.getElementById('blog-search');
    var searchClearBtn = document.getElementById('blog-search-clear');
    var filterResetBtn = document.getElementById('blog-filter-reset');
    var categoryStrip = document.getElementById('category-strip');
    var imageObserver = null;
    var CACHE_KEY = 'f1s-blog-index-v1';
    var CACHE_TTL = 15 * 60 * 1000;
    var activeCategory = 'all';
    var activeQuery = '';
    var searchTimer = null;
    var DATE_FORMATTER = typeof Intl !== 'undefined'
        ? new Intl.DateTimeFormat('el-GR', { day: 'numeric', month: 'long', year: 'numeric' })
        : null;

    function escHtml(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
    function normalizeText(value) {
        var text = String(value || '').toLowerCase();
        if (text.normalize) {
            text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        }
        return text;
    }
    function parsePostDate(value) {
        if (!value) return null;
        var parsed = value.length === 10 ? new Date(value + 'T12:00:00') : new Date(value);
        return isNaN(parsed.getTime()) ? null : parsed;
    }
    function formatPostDate(post) {
        var parsed = parsePostDate(post.date || post.displayDate || '');
        if (parsed && DATE_FORMATTER) return DATE_FORMATTER.format(parsed);
        return post.displayDate || post.date || '';
    }
    function formatReadingTime(value) {
        return String(value || '').replace(/\bmin\b/gi, 'λεπ');
    }
    function getSearchIndex(post) {
        return normalizeText([
            post.title,
            post.excerpt,
            post.author,
            (post.categories || []).join(' '),
            post.displayDate,
            post.date
        ].join(' '));
    }
    function getUniqueCategories(posts) {
        var counts = {};
        (posts || []).forEach(function(post) {
            (post.categories || []).forEach(function(category) {
                var key = String(category || '').trim();
                if (!key) return;
                counts[key] = (counts[key] || 0) + 1;
            });
        });
        return Object.keys(counts).sort(function(a, b) {
            var diff = counts[b] - counts[a];
            return diff || a.localeCompare(b, 'el');
        });
    }
    function syncChipState(container, selector, attribute, activeValue) {
        if (!container) return;
        Array.prototype.forEach.call(container.querySelectorAll(selector), function(chip) {
            var isActive = chip.getAttribute(attribute) === activeValue;
            chip.classList.toggle('active', isActive);
            chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    }
    function updateSearchControls() {
        if (searchClearBtn) searchClearBtn.hidden = !activeQuery;
        if (filterResetBtn) filterResetBtn.hidden = !(activeAuthor !== 'all' || activeCategory !== 'all' || activeQuery);
    }
    function renderCategoryFilters() {
        if (!categoryStrip) return;
        var categories = getUniqueCategories(allPosts);
        var html = '<button class="category-chip' + (activeCategory === 'all' ? ' active' : '') + '" data-category="all" aria-pressed="' + (activeCategory === 'all' ? 'true' : 'false') + '">Όλες</button>';
        categories.forEach(function(category) {
            html += '<button class="category-chip' + (category === activeCategory ? ' active' : '') + '" data-category="' + escHtml(category) + '" aria-pressed="' + (category === activeCategory ? 'true' : 'false') + '">' + escHtml(category) + '</button>';
        });
        categoryStrip.innerHTML = html;
    }
    function getResultsSummary(count) {
        var parts = [];
        if (activeAuthor !== 'all') parts.push('Αρθρογράφος: ' + activeAuthor);
        if (activeCategory !== 'all') parts.push('Κατηγορία: ' + activeCategory);
        if (activeQuery) parts.push('Αναζήτηση: "' + activeQuery + '"');
        return count + ' ' + (count === 1 ? 'άρθρο' : 'άρθρα') + (parts.length ? ' · ' + parts.join(' · ') : '');
    }
    function readCachedPosts() {
        try {
            var cached = JSON.parse(sessionStorage.getItem(CACHE_KEY));
            if (cached && cached.ts && Date.now() - cached.ts < CACHE_TTL && Array.isArray(cached.posts)) {
                return cached.posts;
            }
        } catch (_) {}
        return null;
    }
    function writeCachedPosts(posts) {
        try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({
                ts: Date.now(),
                posts: posts
            }));
        } catch (_) {}
    }
    function hydratePosts(posts) {
        allPosts = posts.sort(function(a, b) { return new Date(b.date) - new Date(a.date); }).map(function(post) {
            post.__searchIndex = getSearchIndex(post);
            return post;
        });
        if (activeCategory !== 'all' && getUniqueCategories(allPosts).indexOf(activeCategory) === -1) {
            activeCategory = 'all';
        }
        renderCategoryFilters();
        renderPosts();
    }

    function renderCard(post, idx) {
        var cats = (post.categories || []).slice(0, 2).map(function(c) { return '<span class="article-card-cat">' + escHtml(c) + '</span>'; }).join('');
        var url = post.url || ('/blog-module/blog-entries/' + post.id + '/article.html');
        var img = post.image || '/blog-module/images/default-blog.jpg';
        var date = formatPostDate(post);
        var author = post.author || 'F1 Stories';
        var excerpt = post.excerpt || '';
        var readMins = post.readingTime || post.readTime || '';
        if (!readMins && post.wordCount) { readMins = Math.max(1, Math.ceil(post.wordCount / 200)) + ' min'; }
        if (!readMins && excerpt) { readMins = Math.max(2, Math.ceil(Math.round(excerpt.split(/\s+/).length * 10) / 200)) + ' min'; }
        readMins = formatReadingTime(readMins);
        var readBadge = readMins ? '<span>\u00b7</span><span class="article-card-reading-time"><i class="fas fa-clock"></i> ' + escHtml(readMins) + '</span>' : '';

        var stagger = window.innerWidth < 768 ? 0.03 : 0.06;
        return '<a href="' + escHtml(url) + '" class="article-card" style="animation-delay:' + (idx * stagger) + 's">'
            + '<div class="article-card-img-wrap"><img class="article-card-img" loading="lazy" data-src="' + escHtml(img) + '" alt="' + escHtml(post.title) + '" onerror="this.src=\'/blog-module/images/default-blog.jpg\';this.onerror=null;"></div>'
            + '<div class="article-card-body">'
            + '<div class="article-card-meta"><span class="author-tag">' + escHtml(author) + '</span><span>\u00b7</span><span>' + escHtml(date) + '</span>' + readBadge + '</div>'
            + '<h3 class="article-card-title">' + escHtml(post.title) + '</h3>'
            + '<p class="article-card-excerpt">' + escHtml(excerpt) + '</p>'
            + '</div>'
            + '<div class="article-card-footer"><span class="article-card-read">Διαβάστε περισσότερα <i class="fas fa-arrow-right"></i></span><div class="article-card-cats">' + cats + '</div></div>'
            + '</a>';
    }

    function lazyLoadImages() {
        if (!grid) return;
        var imgs = grid.querySelectorAll('img[data-src]');
        if (!imgs.length) return;
        if (imageObserver) {
            imageObserver.disconnect();
            imageObserver = null;
        }
        function loadImg(img) {
            var src = img.getAttribute('data-src');
            if (!src) return;
            img.decoding = 'async';
            img.src = src; img.removeAttribute('data-src');
            img.addEventListener('load', function() { img.classList.add('loaded'); }, { once: true });
            img.addEventListener('error', function() { img.classList.add('loaded'); }, { once: true });
            if (img.complete && img.naturalWidth > 0) img.classList.add('loaded');
        }
        if ('IntersectionObserver' in window) {
            imageObserver = new IntersectionObserver(function(entries) { entries.forEach(function(entry) { if (entry.isIntersecting) { loadImg(entry.target); imageObserver.unobserve(entry.target); } }); }, { rootMargin: '300px 0px' });
            imgs.forEach(function(img) { imageObserver.observe(img); });
        } else { imgs.forEach(loadImg); }
    }

    var POSTS_PER_PAGE = 12;
    var currentPage = 1;
    var filteredPosts = [];
    var paginationEl = document.getElementById('blog-pagination');

    function getPageRange(current, total) {
        if (total <= 7) {
            var r = []; for (var i = 1; i <= total; i++) r.push(i); return r;
        }
        var pages = [1];
        var left = Math.max(2, current - 1);
        var right = Math.min(total - 1, current + 1);
        if (left > 2) pages.push('…');
        for (var p = left; p <= right; p++) pages.push(p);
        if (right < total - 1) pages.push('…');
        pages.push(total);
        return pages;
    }

    function renderPagination() {
        if (!paginationEl) return;
        var totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE);
        if (totalPages <= 1) { paginationEl.innerHTML = ''; return; }
        var range = getPageRange(currentPage, totalPages);
        var html = '<button class="page-btn page-prev" aria-label="Προηγούμενη σελίδα"' + (currentPage === 1 ? ' disabled' : '') + '><i class="fas fa-chevron-left"></i></button>';
        range.forEach(function(item) {
            if (item === '…') {
                html += '<span class="page-ellipsis">&hellip;</span>';
            } else {
                html += '<button class="page-btn page-num' + (item === currentPage ? ' active' : '') + '" data-page="' + item + '" aria-label="Σελίδα ' + item + '"' + (item === currentPage ? ' aria-current="page"' : '') + '>' + item + '</button>';
            }
        });
        html += '<button class="page-btn page-next" aria-label="Επόμενη σελίδα"' + (currentPage === totalPages ? ' disabled' : '') + '><i class="fas fa-chevron-right"></i></button>';
        paginationEl.innerHTML = html;
    }

    function goToPage(page, options) {
        var totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE);
        currentPage = Math.max(1, Math.min(page, totalPages));
        var start = (currentPage - 1) * POSTS_PER_PAGE;
        var pagePosts = filteredPosts.slice(start, start + POSTS_PER_PAGE);
        grid.innerHTML = pagePosts.map(function(p, i) { return renderCard(p, i); }).join('');
        lazyLoadImages();
        renderPagination();
        if (!options || options.scroll !== false) {
            grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    if (paginationEl) {
        paginationEl.addEventListener('click', function(e) {
            var btn = e.target.closest('.page-btn');
            if (!btn || btn.disabled) return;
            if (btn.classList.contains('page-prev')) { goToPage(currentPage - 1); return; }
            if (btn.classList.contains('page-next')) { goToPage(currentPage + 1); return; }
            var page = parseInt(btn.getAttribute('data-page'), 10);
            if (page && page !== currentPage) goToPage(page);
        });
    }

    function renderPosts() {
        if (!grid) return;
        filteredPosts = allPosts.filter(function(post) {
            var matchesAuthor = activeAuthor === 'all' || post.author === activeAuthor;
            var matchesCategory = activeCategory === 'all' || (post.categories || []).indexOf(activeCategory) !== -1;
            var matchesQuery = !activeQuery || post.__searchIndex.indexOf(normalizeText(activeQuery)) !== -1;
            return matchesAuthor && matchesCategory && matchesQuery;
        });
        if (countEl) { countEl.textContent = getResultsSummary(filteredPosts.length); }
        updateSearchControls();
        if (!filteredPosts.length) {
            grid.innerHTML = '<div class="empty-state"><i class="fas fa-newspaper"></i><p>Δεν βρέθηκαν άρθρα για τα επιλεγμένα φίλτρα.</p></div>';
            if (paginationEl) paginationEl.innerHTML = '';
            return;
        }
        goToPage(1, { scroll: false });
    }

    window.__blogFilterByAuthor = function(author) {
        activeAuthor = author;
        currentPage = 1;
        syncChipState(strip, '.author-chip', 'data-author', activeAuthor);
        renderPosts();
    };

    function tryFetch(paths, idx) {
        var cached = idx === 0 ? readCachedPosts() : null;
        if (cached) { hydratePosts(cached); return; }
        if (idx >= paths.length) { if (grid) grid.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Δεν ήταν δυνατή η φόρτωση των άρθρων.</p></div>'; return; }
        fetch(paths[idx]).then(function(r) { if (!r.ok) throw new Error('not ok'); return r.json(); }).then(function(data) {
            var posts = data.posts || data || [];
            writeCachedPosts(posts);
            hydratePosts(posts);
        }).catch(function() { tryFetch(paths, idx + 1); });
    }

    tryFetch(['/blog-module/blog-index-data.json', '../blog-index-data.json', '../../blog-index-data.json'], 0);

    var strip = document.getElementById('author-strip');
    if (strip) {
        syncChipState(strip, '.author-chip', 'data-author', activeAuthor);
        var lastChipTap = 0;
        function handleChipActivate(e) {
            var now = Date.now();
            if (now - lastChipTap < 300) return;
            lastChipTap = now;
            var chip = e.target.closest('.author-chip');
            if (!chip) return;
            e.preventDefault();
            activeAuthor = chip.getAttribute('data-author');
            syncChipState(strip, '.author-chip', 'data-author', activeAuthor);
            renderPosts();
        }
        strip.addEventListener('touchend', handleChipActivate, { passive: false });
        strip.addEventListener('click', handleChipActivate);
    }

    if (categoryStrip) {
        categoryStrip.addEventListener('click', function(e) {
            var chip = e.target.closest('.category-chip');
            if (!chip) return;
            activeCategory = chip.getAttribute('data-category') || 'all';
            syncChipState(categoryStrip, '.category-chip', 'data-category', activeCategory);
            renderPosts();
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(function() {
                activeQuery = searchInput.value.trim();
                renderPosts();
            }, 250);
        });
    }

    if (searchClearBtn) {
        searchClearBtn.addEventListener('click', function() {
            activeQuery = '';
            if (searchInput) {
                searchInput.value = '';
                searchInput.focus();
            }
            renderPosts();
        });
    }

    if (filterResetBtn) {
        filterResetBtn.addEventListener('click', function() {
            activeAuthor = 'all';
            activeCategory = 'all';
            activeQuery = '';
            if (searchInput) searchInput.value = '';
            syncChipState(strip, '.author-chip', 'data-author', activeAuthor);
            syncChipState(categoryStrip, '.category-chip', 'data-category', activeCategory);
            renderPosts();
        });
    }
});
