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
    var MAX_VISIBLE_CATEGORIES = 10;
    var DATE_FORMATTER = typeof Intl !== 'undefined'
        ? new Intl.DateTimeFormat('el-GR', { day: 'numeric', month: 'long', year: 'numeric' })
        : null;

    function createIcon(iconId) {
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'icon');
        svg.setAttribute('aria-hidden', 'true');
        var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', '#' + iconId);
        svg.appendChild(use);
        return svg;
    }

    function createEmptyState(iconId, text) {
        var empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.appendChild(createIcon(iconId));
        var p = document.createElement('p');
        p.textContent = text;
        empty.appendChild(p);
        return empty;
    }
    function bindImageFallbacks() {
        if (!grid || grid.__f1sImageFallbacksBound) return;
        grid.__f1sImageFallbacksBound = true;
        grid.addEventListener('error', function(event) {
            var img = event.target;
            if (!img || img.tagName !== 'IMG') return;
            var fallback = img.getAttribute('data-fallback-src');
            if (!fallback) return;
            img.removeAttribute('data-src');
            img.removeAttribute('data-fallback-src');
            img.src = fallback;
            img.classList.add('loaded');
        }, true);
    }
    function bindAuthorFallbacks() {
        if (!strip || strip.__f1sAuthorFallbacksBound) return;
        strip.__f1sAuthorFallbacksBound = true;
        strip.addEventListener('error', function(event) {
            var img = event.target;
            if (!img || img.tagName !== 'IMG') return;
            var fallback = img.getAttribute('data-fallback-label');
            var parent = img.parentElement;
            if (!fallback || !parent) return;
            img.remove();
            parent.textContent = fallback;
        }, true);
    }
    function formatCategoryToken(token) {
        var value = String(token || '').trim();
        var lower = value.toLowerCase();
        var acronyms = { f1: 'F1', gp: 'GP', amg: 'AMG', rb: 'RB', drs: 'DRS', v12: 'V12' };
        if (acronyms[lower]) return acronyms[lower];
        if (!value || /^\d/.test(value)) return value;
        if (value !== lower && value !== value.toUpperCase()) return value;
        return lower.charAt(0).toUpperCase() + lower.slice(1);
    }
    function formatCategoryLabel(value) {
        var raw = String(value || '').replace(/^[\s,-]+|[\s,-]+$/g, '').trim();
        if (!raw) return '';
        return raw.split(/-+/).filter(Boolean).map(formatCategoryToken).join(' ');
    }
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
        return String(value || '').replace(/\bmin\b/gi, 'λεπτά ανάγνωσης');
    }
    function getSearchIndex(post) {
        return normalizeText([
            post.title,
            post.excerpt,
            post.author,
            (post.categories || []).join(' '),
            (post.categories || []).map(formatCategoryLabel).join(' '),
            post.displayDate,
            post.date
        ].join(' '));
    }
    function defaultThumbnailForPost(id) {
        return '/blog-module/blog-entries/' + encodeURIComponent(id || '') + '/1-card.webp';
    }
    function expandCompactPosts(data) {
        if (!data || data.v !== 2 || !Array.isArray(data.p)) return null;
        var authors = data.a || [];
        var categories = data.c || [];
        return data.p.map(function(row) {
            var id = row[0] || '';
            var categoryIndexes = Array.isArray(row[8]) ? row[8] : [];
            var width = parseInt(row[4], 10) || 400;
            return {
                id: id,
                title: row[1] || '',
                author: authors[row[2]] || 'F1 Stories',
                date: row[3] || '',
                thumbnail: defaultThumbnailForPost(id),
                thumbnailWidth: width,
                thumbnailHeight: parseInt(row[5], 10) || 188,
                excerpt: row[6] || '',
                readingTime: row[7] || '',
                categories: categoryIndexes.map(function(index) { return categories[index]; }).filter(Boolean)
            };
        });
    }
    function extractPosts(data) {
        var compact = expandCompactPosts(data);
        if (compact) return compact;
        if (data && Array.isArray(data.posts)) return data.posts;
        return Array.isArray(data) ? data : [];
    }
    function splitCategoryValue(value) {
        var parts = [];
        String(value || '').split(',').forEach(function(part) {
            part.split(/\s+-\s+/).forEach(function(piece) {
                var category = piece.replace(/^[\s,-]+|[\s,-]+$/g, '').trim();
                if (category) parts.push(category);
            });
        });
        return parts;
    }
    function normalizePostCategories(categories) {
        var normalized = [];
        var seen = {};
        (categories || []).forEach(function(category) {
            splitCategoryValue(category).forEach(function(name) {
                if (seen[name]) return;
                seen[name] = true;
                normalized.push(name);
            });
        });
        return normalized;
    }
    function getUniqueCategories(posts) {
        var counts = {};
        (posts || []).forEach(function(post) {
            normalizePostCategories(post.categories).forEach(function(category) {
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
        var normalized = [];
        var seen = {};
        (categories || []).forEach(function(category) {
            var source = typeof category === 'string' ? { name: category } : category || {};
            splitCategoryValue(source.name).forEach(function(name) {
                if (seen[name]) return;
                seen[name] = true;
                normalized.push({ name: name, count: source.count });
            });
        });
        return normalized;
    }
    function getVisibleCategories(categories) {
        var list = normalizeCategories(categories);
        var visible = list.slice(0, MAX_VISIBLE_CATEGORIES);
        if (activeCategory !== 'all' && !visible.some(function(item) { return item.name === activeCategory; })) {
            var activeItem = list.find(function(item) { return item.name === activeCategory; });
            if (activeItem) visible.push(activeItem);
        }
        return visible;
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
        var categories = getVisibleCategories(categoryOptions.length ? categoryOptions : getUniqueCategories(allPosts));
        var nodes = [];
        var allButton = document.createElement('button');
        allButton.className = 'category-chip' + (activeCategory === 'all' ? ' active' : '');
        allButton.type = 'button';
        allButton.setAttribute('data-category', 'all');
        allButton.setAttribute('aria-pressed', activeCategory === 'all' ? 'true' : 'false');
        allButton.textContent = 'Όλες';
        nodes.push(allButton);
        categories.forEach(function(category) {
            var name = typeof category === 'string' ? category : category.name;
            var button = document.createElement('button');
            button.className = 'category-chip' + (name === activeCategory ? ' active' : '');
            button.type = 'button';
            button.setAttribute('data-category', name);
            button.setAttribute('aria-pressed', name === activeCategory ? 'true' : 'false');
            button.textContent = formatCategoryLabel(name);
            nodes.push(button);
        });
        categoryStrip.replaceChildren.apply(categoryStrip, nodes);
    }
    function getResultsSummary(count) {
        var parts = [];
        if (activeAuthor !== 'all') parts.push('Αρθρογράφος: ' + activeAuthor);
        if (activeCategory !== 'all') parts.push('Θέμα: ' + formatCategoryLabel(activeCategory));
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
            post.categories = normalizePostCategories(post.categories);
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
        var posts = extractPosts(data);
        pageOnePosts = preparePosts(posts);
        if (!fullPostsLoaded) {
            allPosts = pageOnePosts.slice();
            totalPostCount = parseInt(data && data.totalCount, 10) || pageOnePosts.length;
            categoryOptions = normalizeCategories(data && data.categories);
            renderCategoryFilters();
            renderPosts();
        }
    }
    function createCardCategories(categories) {
        var container = document.createElement('div');
        container.className = 'article-card-cats';
        var list = categories || [];
        list.slice(0, 2).forEach(function(c) {
            var span = document.createElement('span');
            span.className = 'article-card-cat';
            span.textContent = formatCategoryLabel(c);
            container.appendChild(span);
        });
        if (list.length > 2) {
            var more = document.createElement('span');
            more.className = 'article-card-cat article-card-cat-more';
            more.textContent = '+' + (list.length - 2);
            container.appendChild(more);
        }
        return container;
    }

    function createArticleCard(post, idx) {
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
        if (!readMins && post.wordCount) { readMins = Math.max(1, Math.ceil(post.wordCount / 200)) + ' min'; }
        if (!readMins && excerpt) { readMins = Math.max(2, Math.ceil(Math.round(excerpt.split(/\s+/).length * 10) / 200)) + ' min'; }
        readMins = formatReadingTime(readMins);

        var stagger = window.innerWidth < 768 ? 0.03 : 0.06;
        var animationDelay = Math.round(idx * stagger * 100) / 100;

        var article = document.createElement('article');
        article.className = 'article-card-wrap';
        var link = document.createElement('a');
        link.href = url;
        link.className = 'article-card';
        link.style.animationDelay = animationDelay + 's';

        var imageWrap = document.createElement('div');
        imageWrap.className = 'article-card-img-wrap';
        var image = document.createElement('img');
        image.className = imageClass;
        image.width = imageWidth;
        image.height = imageHeight;
        if (isLcpImage) {
            image.src = img;
            image.loading = 'eager';
            image.fetchPriority = 'high';
        } else {
            image.setAttribute('data-src', img);
            image.loading = 'lazy';
        }
        image.decoding = 'async';
        image.alt = post.title || '';
        image.setAttribute('data-fallback-src', '/blog-module/images/default-blog.jpg');
        imageWrap.appendChild(image);

        var body = document.createElement('div');
        body.className = 'article-card-body';
        var meta = document.createElement('div');
        meta.className = 'article-card-meta';
        var authorTag = document.createElement('span');
        authorTag.className = 'author-tag';
        authorTag.textContent = author;
        var dot = document.createElement('span');
        dot.textContent = '\u00b7';
        var time = document.createElement('time');
        time.className = 'article-card-date';
        time.dateTime = post.date || '';
        time.textContent = date;
        meta.append(authorTag, dot, time);
        if (readMins) {
            var readDot = document.createElement('span');
            readDot.textContent = '\u00b7';
            var readTime = document.createElement('span');
            readTime.className = 'article-card-reading-time';
            readTime.append(createIcon('fa-clock'), document.createTextNode(' ' + readMins));
            meta.append(readDot, readTime);
        }

        var title = document.createElement('h2');
        title.className = 'article-card-title';
        title.textContent = post.title || '';
        var excerptEl = document.createElement('p');
        excerptEl.className = 'article-card-excerpt';
        excerptEl.textContent = excerpt;
        body.append(meta, title, excerptEl);

        var footer = document.createElement('div');
        footer.className = 'article-card-footer';
        var readMore = document.createElement('span');
        readMore.className = 'article-card-read';
        readMore.append(document.createTextNode('Διαβάστε περισσότερα '), createIcon('fa-arrow-right'));
        footer.append(readMore, createCardCategories(post.categories));

        link.append(imageWrap, body, footer);
        article.appendChild(link);
        return article;
    }
    function isDefaultCuratedState() {
        return activeAuthor === 'all' && activeCategory === 'all' && !activeQuery && currentPage === 1;
    }

    function lazyLoadImages() {
        if (!grid) return;
        bindImageFallbacks();
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
    bindImageFallbacks();
    bindAuthorFallbacks();

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
        if (totalPages <= 1) { paginationEl.replaceChildren(); return; }
        var range = getPageRange(currentPage, totalPages);
        var nodes = [];
        var prev = document.createElement('button');
        prev.className = 'page-btn page-prev';
        prev.type = 'button';
        prev.setAttribute('aria-label', 'Προηγούμενη σελίδα');
        prev.disabled = currentPage === 1;
        prev.appendChild(createIcon('fa-chevron-left'));
        nodes.push(prev);
        range.forEach(function(item) {
            if (item === '…') {
                var ellipsis = document.createElement('span');
                ellipsis.className = 'page-ellipsis';
                ellipsis.textContent = '...';
                nodes.push(ellipsis);
            } else {
                var pageButton = document.createElement('button');
                pageButton.className = 'page-btn page-num' + (item === currentPage ? ' active' : '');
                pageButton.type = 'button';
                pageButton.setAttribute('data-page', item);
                pageButton.setAttribute('aria-label', 'Σελίδα ' + item);
                if (item === currentPage) pageButton.setAttribute('aria-current', 'page');
                pageButton.textContent = item;
                nodes.push(pageButton);
            }
        });
        var next = document.createElement('button');
        next.className = 'page-btn page-next';
        next.type = 'button';
        next.setAttribute('aria-label', 'Επόμενη σελίδα');
        next.disabled = currentPage === totalPages;
        next.appendChild(createIcon('fa-chevron-right'));
        nodes.push(next);
        paginationEl.replaceChildren.apply(paginationEl, nodes);
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
        grid.classList.toggle('is-curated-default', isDefaultCuratedState());
        var start = (currentPage - 1) * POSTS_PER_PAGE;
        var pagePosts = filteredPosts.slice(start, start + POSTS_PER_PAGE);
        if (options && options.preserveStatic && currentPage === 1 && staticFirstPageReady) {
            lazyLoadImages();
            renderPagination();
            return;
        }
        grid.replaceChildren.apply(grid, pagePosts.map(function(p, i) { return createArticleCard(p, i); }));
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
                grid.replaceChildren(createEmptyState('fa-newspaper', 'Δεν βρέθηκαν άρθρα για τα επιλεγμένα φίλτρα.'));
            }
            if (paginationEl) paginationEl.replaceChildren();
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
        if (grid) grid.replaceChildren(createEmptyState('fa-exclamation-circle', 'Δεν ήταν δυνατή η φόρτωση των άρθρων.'));
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
            var posts = extractPosts(data);
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
