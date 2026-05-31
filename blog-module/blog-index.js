document.addEventListener('DOMContentLoaded', function() {

    var allPosts = [];
    var activeAuthor = 'all';
    var grid = document.getElementById('articles-grid');
    var countEl = document.getElementById('post-count');
    var searchInput = document.getElementById('blog-search');
    var searchClearBtn = document.getElementById('blog-search-clear');
    var filterResetBtn = document.getElementById('blog-filter-reset');
    var categoryStrip = document.getElementById('category-strip');
    var strip = document.getElementById('author-strip');
    var imageObserver = null;
    var CACHE_KEY = 'f1s-blog-index-v2-full';
    var CACHE_TTL = 15 * 60 * 1000;
    var PAGE_ONE_PATHS = ['/blog-module/blog-index-page-1.json', '../blog-index-page-1.json', '../../blog-index-page-1.json'];
    var FULL_DATA_PATHS = ['/blog-module/blog-index-data.json', '../blog-index-data.json', '../../blog-index-data.json'];
    var activeCategory = 'all';
    var activeQuery = '';
    var searchTimer = null;
    var pageOnePosts = [];
    var categoryOptions = [];
    var totalPostCount = 0;
    var fullPostsLoaded = false;
    var fullPostsPromise = null;
    var staticFirstPageReady = !!(grid && grid.querySelector('.article-card') && !grid.querySelector('.skeleton-card'));
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
    function normalizeCategories(categories) {
        return (categories || []).map(function(category) {
            if (typeof category === 'string') return { name: category };
            return category || {};
        }).filter(function(category) {
            return !!String(category.name || '').trim();
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
        var categories = categoryOptions.length ? categoryOptions : normalizeCategories(getUniqueCategories(allPosts));
        var html = '<button class="category-chip' + (activeCategory === 'all' ? ' active' : '') + '" data-category="all" aria-pressed="' + (activeCategory === 'all' ? 'true' : 'false') + '">Όλες</button>';
        categories.forEach(function(category) {
            var name = typeof category === 'string' ? category : category.name;
            html += '<button class="category-chip' + (name === activeCategory ? ' active' : '') + '" data-category="' + escHtml(name) + '" aria-pressed="' + (name === activeCategory ? 'true' : 'false') + '">' + escHtml(name) + '</button>';
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
    function preparePosts(posts) {
        return (posts || []).slice().sort(function(a, b) { return new Date(b.date) - new Date(a.date); }).map(function(post) {
            post.__searchIndex = getSearchIndex(post);
            return post;
        });
    }
    function setFullPosts(posts) {
        allPosts = preparePosts(posts);
        pageOnePosts = allPosts.slice(0, POSTS_PER_PAGE);
        totalPostCount = allPosts.length;
        categoryOptions = normalizeCategories(getUniqueCategories(allPosts));
        fullPostsLoaded = true;
        if (activeCategory !== 'all' && getUniqueCategories(allPosts).indexOf(activeCategory) === -1) {
            activeCategory = 'all';
        }
        renderCategoryFilters();
    }
    function hydratePosts(posts) {
        setFullPosts(posts);
        renderPosts();
    }
    function hydratePageOne(data) {
        var posts = data && (data.posts || data) || [];
        pageOnePosts = preparePosts(posts);
        if (!fullPostsLoaded) {
            allPosts = pageOnePosts.slice();
            totalPostCount = parseInt(data && data.totalCount, 10) || pageOnePosts.length;
            categoryOptions = normalizeCategories(data && data.categories);
            renderCategoryFilters();
            renderPosts();
        }
    }
    function renderCardCategories(categories) {
        var list = categories || [];
        var html = list.slice(0, 2).map(function(c) {
            return '<span class="article-card-cat">' + escHtml(c) + '</span>';
        }).join('');
        if (list.length > 2) {
            html += '<span class="article-card-cat article-card-cat-more">+' + (list.length - 2) + '</span>';
        }
        return html;
    }

    function renderCard(post, idx) {
        var cats = renderCardCategories(post.categories);
        var url = post.url || ('/blog-module/blog-entries/' + post.id + '/article.html');
        var img = post.thumbnail || post.image || '/blog-module/images/default-blog.jpg';
        var date = formatPostDate(post);
        var author = post.author || 'F1 Stories';
        var excerpt = post.excerpt || '';
        var readMins = post.readingTime || post.readTime || '';
        var imageWidth = parseInt(post.thumbnailWidth, 10) || 400;
        var imageHeight = parseInt(post.thumbnailHeight, 10) || 188;
        var isLcpImage = idx === 0;
        var imageClass = 'article-card-img' + (isLcpImage ? ' loaded' : '');
        var imageAttrs = isLcpImage
            ? ' src="' + escHtml(img) + '" loading="eager" fetchpriority="high"'
            : ' data-src="' + escHtml(img) + '" loading="lazy"';
        if (!readMins && post.wordCount) { readMins = Math.max(1, Math.ceil(post.wordCount / 200)) + ' min'; }
        if (!readMins && excerpt) { readMins = Math.max(2, Math.ceil(Math.round(excerpt.split(/\s+/).length * 10) / 200)) + ' min'; }
        readMins = formatReadingTime(readMins);
        var readBadge = readMins ? '<span>\u00b7</span><span class="article-card-reading-time"><svg class="icon" aria-hidden="true"><use href="#fa-clock"/></svg> ' + escHtml(readMins) + '</span>' : '';

        var stagger = window.innerWidth < 768 ? 0.03 : 0.06;
        var animationDelay = Math.round(idx * stagger * 100) / 100;
        return '<article class="article-card-wrap">'
            + '<a href="' + escHtml(url) + '" class="article-card" style="animation-delay:' + animationDelay + 's">'
            + '<div class="article-card-img-wrap"><img class="' + imageClass + '" width="' + imageWidth + '" height="' + imageHeight + '"' + imageAttrs + ' decoding="async" alt="' + escHtml(post.title) + '" onerror="this.src=\'/blog-module/images/default-blog.jpg\';this.onerror=null;"></div>'
            + '<div class="article-card-body">'
            + '<div class="article-card-meta"><span class="author-tag">' + escHtml(author) + '</span><span>\u00b7</span><time class="article-card-date" datetime="' + escHtml(post.date || '') + '">' + escHtml(date) + '</time>' + readBadge + '</div>'
            + '<h2 class="article-card-title">' + escHtml(post.title) + '</h2>'
            + '<p class="article-card-excerpt">' + escHtml(excerpt) + '</p>'
            + '</div>'
            + '<div class="article-card-footer"><span class="article-card-read">Διαβάστε περισσότερα <svg class="icon" aria-hidden="true"><use href="#fa-arrow-right"/></svg></span><div class="article-card-cats">' + cats + '</div></div>'
            + '</a>'
            + '</article>';
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
            if (img.getAttribute('src')) {
                img.removeAttribute('data-src');
                img.classList.add('loaded');
                return;
            }
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
        var totalItems = (!fullPostsLoaded && activeAuthor === 'all' && activeCategory === 'all' && !activeQuery)
            ? (totalPostCount || filteredPosts.length)
            : filteredPosts.length;
        var totalPages = Math.ceil(totalItems / POSTS_PER_PAGE);
        if (totalPages <= 1) { paginationEl.innerHTML = ''; return; }
        var range = getPageRange(currentPage, totalPages);
        var html = '<button class="page-btn page-prev" aria-label="Προηγούμενη σελίδα"' + (currentPage === 1 ? ' disabled' : '') + '><svg class="icon" aria-hidden="true"><use href="#fa-chevron-left"/></svg></button>';
        range.forEach(function(item) {
            if (item === '…') {
                html += '<span class="page-ellipsis">&hellip;</span>';
            } else {
                html += '<button class="page-btn page-num' + (item === currentPage ? ' active' : '') + '" data-page="' + item + '" aria-label="Σελίδα ' + item + '"' + (item === currentPage ? ' aria-current="page"' : '') + '>' + item + '</button>';
            }
        });
        html += '<button class="page-btn page-next" aria-label="Επόμενη σελίδα"' + (currentPage === totalPages ? ' disabled' : '') + '><svg class="icon" aria-hidden="true"><use href="#fa-chevron-right"/></svg></button>';
        paginationEl.innerHTML = html;
    }

    function getFilteredPosts() {
        return allPosts.filter(function(post) {
            var matchesAuthor = activeAuthor === 'all' || post.author === activeAuthor;
            var matchesCategory = activeCategory === 'all' || (post.categories || []).indexOf(activeCategory) !== -1;
            var matchesQuery = !activeQuery || post.__searchIndex.indexOf(normalizeText(activeQuery)) !== -1;
            return matchesAuthor && matchesCategory && matchesQuery;
        });
    }

    function goToPage(page, options) {
        if (!grid) return;
        if (!fullPostsLoaded && page > 1) {
            ensureFullPostsLoaded().then(function() {
                filteredPosts = getFilteredPosts();
                goToPage(page, options);
            }).catch(showLoadFailure);
            return;
        }
        var totalItems = (!fullPostsLoaded && activeAuthor === 'all' && activeCategory === 'all' && !activeQuery)
            ? (totalPostCount || filteredPosts.length)
            : filteredPosts.length;
        var totalPages = Math.max(1, Math.ceil(totalItems / POSTS_PER_PAGE));
        currentPage = Math.max(1, Math.min(page, totalPages));
        var start = (currentPage - 1) * POSTS_PER_PAGE;
        var pagePosts = filteredPosts.slice(start, start + POSTS_PER_PAGE);
        if (options && options.preserveStatic && currentPage === 1 && staticFirstPageReady) {
            lazyLoadImages();
            renderPagination();
            return;
        }
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
        if (!fullPostsLoaded && !(activeAuthor === 'all' && activeCategory === 'all' && !activeQuery)) {
            ensureFullPostsLoaded().then(renderPosts).catch(showLoadFailure);
            return;
        }
        filteredPosts = getFilteredPosts();
        if (!fullPostsLoaded && activeAuthor === 'all' && activeCategory === 'all' && !activeQuery) {
            filteredPosts = pageOnePosts.length ? pageOnePosts : filteredPosts;
        }
        if (countEl) {
            var count = (!fullPostsLoaded && activeAuthor === 'all' && activeCategory === 'all' && !activeQuery)
                ? (totalPostCount || filteredPosts.length)
                : filteredPosts.length;
            countEl.textContent = getResultsSummary(count);
        }
        updateSearchControls();
        if (!filteredPosts.length) {
            if (!staticFirstPageReady) {
                grid.innerHTML = '<div class="empty-state"><svg class="icon" aria-hidden="true"><use href="#fa-newspaper"/></svg><p>Δεν βρέθηκαν άρθρα για τα επιλεγμένα φίλτρα.</p></div>';
            }
            if (paginationEl) paginationEl.innerHTML = '';
            return;
        }
        goToPage(1, { scroll: false, preserveStatic: !fullPostsLoaded });
    }

    window.__blogFilterByAuthor = function(author) {
        activeAuthor = author;
        currentPage = 1;
        syncChipState(strip, '.author-chip', 'data-author', activeAuthor);
        renderPosts();
    };

    function fetchJson(paths, idx) {
        idx = idx || 0;
        if (idx >= paths.length) {
            return Promise.reject(new Error('Unable to load blog data'));
        }
        return fetch(paths[idx], {
            cache: 'no-store',
            headers: { 'Accept': 'application/json' }
        }).then(function(r) { if (!r.ok) throw new Error('not ok'); return r.json(); }).catch(function() {
            return fetchJson(paths, idx + 1);
        });
    }

    function showLoadFailure() {
        var cached = readCachedPosts();
        if (cached) { hydratePosts(cached); return; }
        if (staticFirstPageReady) {
            lazyLoadImages();
            return;
        }
        if (grid) grid.innerHTML = '<div class="empty-state"><svg class="icon" aria-hidden="true"><use href="#fa-exclamation-circle"/></svg><p>Δεν ήταν δυνατή η φόρτωση των άρθρων.</p></div>';
    }

    function ensureFullPostsLoaded() {
        if (fullPostsLoaded) return Promise.resolve(allPosts);
        if (fullPostsPromise) return fullPostsPromise;
        var cached = readCachedPosts();
        if (cached) {
            setFullPosts(cached);
            return Promise.resolve(allPosts);
        }
        fullPostsPromise = fetchJson(FULL_DATA_PATHS).then(function(data) {
            var posts = data.posts || data || [];
            writeCachedPosts(posts);
            setFullPosts(posts);
            return allPosts;
        }).catch(function(error) {
            fullPostsPromise = null;
            throw error;
        });
        return fullPostsPromise;
    }

    if (staticFirstPageReady) lazyLoadImages();

    fetchJson(PAGE_ONE_PATHS).then(hydratePageOne).catch(function() {
        ensureFullPostsLoaded().then(function() {
            renderPosts();
        }).catch(showLoadFailure);
    });

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
            ensureFullPostsLoaded().then(renderPosts).catch(showLoadFailure);
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
            ensureFullPostsLoaded().then(renderPosts).catch(showLoadFailure);
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(function() {
                activeQuery = searchInput.value.trim();
                if (activeQuery) {
                    ensureFullPostsLoaded().then(renderPosts).catch(showLoadFailure);
                } else {
                    renderPosts();
                }
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
