// blog-loader.js — Streamlined, no inline style hover effects (CSS handles those)
document.addEventListener('DOMContentLoaded', function () {
    const CONFIG = {
        POSTS_PER_PAGE: 9,
        FEATURED_POSTS_LIMIT: 3,
        AUTHOR_MAP: {
            G: 'Georgios Balatzis',
            J: 'Giannis Poulikidis',
            T: 'Thanasis Batalas',
            W: '2Fast',
            D: 'Dimitris Keramidiotis'
        }
    };

    const state = {
        currentPage: 1,
        totalPages: 1,
        allPosts: [],
        filteredPosts: [],
        featuredPostIds: []
    };

    // ── Helpers ──────────────────────────────────────────────
    const $ = sel => document.querySelector(sel);
    const $$ = sel => document.querySelectorAll(sel);

    const getBasePath = () => {
        const p = window.location.pathname;
        return (p === '/' || p === '/index.html' || p.endsWith('/pages/') || p.endsWith('/pages/index.html')) ? '' : '/';
    };

    const imgPath = (base, src) => {
        if (!src) return base + 'blog-module/images/default-blog.jpg';
        if (src.startsWith('http')) return src;
        return base + (src.startsWith('/') ? src.substring(1) : src);
    };

    // ── Fetch blog data with fallback paths ─────────────────
    async function fetchBlogData() {
        const base = getBasePath();
        for (const p of [base + 'blog-module/blog-data.json', '../../blog-module/blog-data.json', '../blog-data.json']) {
            try {
                const r = await fetch(p);
                if (r.ok) return r.json();
            } catch (_) { /* next */ }
        }
        throw new Error('Failed to fetch blog data');
    }

    // ── Author detection from folder ID ─────────────────────
    function determineAuthor(post) {
        if (post.author?.trim()) return post.author;
        const id = post.id || '';
        const m = id.match(/^\d{8}(?:-\d+)?([A-Z])F?$/) || id.match(/^\d{8}([A-Z])$/);
        if (m && CONFIG.AUTHOR_MAP[m[1]]) return CONFIG.AUTHOR_MAP[m[1]];
        if (id.includes('W')) return '2Fast';
        if (id.includes('D')) return 'Dimitris Keramidiotis';
        return post.author || 'F1 Stories Team';
    }

    // ── Card HTML ───────────────────────────────────────────
    function postCardHTML(post, base, isHome = false) {
        const dm = post.displayDate.match(/([A-Za-z]+) (\d+)/);
        const month = dm ? dm[1].substring(0, 3).toUpperCase() : 'JAN';
        const day = dm ? dm[2] : '1';
        const img = imgPath(base, post.image);
        const fallback = base + 'blog-module/images/default-blog.jpg';

        return `
        <div class="${isHome ? 'col-md-4' : 'col-md-4 blog-card-container'}"
             ${!isHome ? `data-id="${post.id}" data-tag="${post.tag || 'General'}" data-category="${post.category || 'Uncategorized'}"` : ''}>
            <a href="${base}blog-module/blog-entries/${post.id}/article.html" class="blog-card-link">
                <div class="blog-card">
                    <div class="blog-img-container">
                        <img src="${img}" alt="${post.title}" class="blog-img" loading="lazy"
                             onerror="this.src='${fallback}'">
                        <div class="blog-date">
                            <span class="day">${day}</span>
                            <span class="month">${month}</span>
                        </div>
                    </div>
                    <div class="blog-content">
                        <h3 class="blog-title">${post.title}</h3>
                        <div class="blog-meta">
                            <span><i class="fas fa-user"></i> ${post.author}</span>
                            <span><i class="${isHome ? 'fas fa-comments' : 'fas fa-calendar'}"></i> ${isHome ? post.comments : post.displayDate}</span>
                        </div>
                        <p class="blog-excerpt">${post.excerpt}</p>
                        <div class="d-flex justify-content-between align-items-center">
                            <div class="post-info">
                                <span class="post-tag"><i class="fas fa-tag"></i> ${post.tag || 'General'}</span>
                                <span class="post-category ms-2"><i class="fas fa-folder"></i> ${post.category || 'Uncategorized'}</span>
                            </div>
                            <span class="blog-read-more">Read More <i class="fas fa-arrow-right"></i></span>
                        </div>
                    </div>
                </div>
            </a>
        </div>`;
    }

    // ── Loading / Error ─────────────────────────────────────
    function showLoading(el) {
        el.innerHTML = '<div class="col-12 text-center"><div class="spinner-border text-light" role="status"><span class="visually-hidden">Loading…</span></div></div>';
    }
    function showError(el, msg = 'Unable to load blog posts. Please try again later.') {
        el.innerHTML = `<div class="col-12"><div class="alert alert-danger">${msg}</div></div>`;
    }

    // ── Filtering ───────────────────────────────────────────
    function applyFilter(type, value) {
        if (type === 'all') {
            state.filteredPosts = [...state.allPosts];
        } else if (type === 'author') {
            state.filteredPosts = state.allPosts.filter(p => p.author === value);
        } else if (type === 'category') {
            state.filteredPosts = state.allPosts.filter(p => (p.category || 'Uncategorized') === value);
        } else if (type === 'tag') {
            state.filteredPosts = state.allPosts.filter(p => (p.tag || 'General') === value);
        }
        setupPagination();
        displayPosts(1);
        $('.blog-posts')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function handleFilterClick() {
        const type = this.dataset.filter;
        const value = this.dataset.author || this.dataset.category || this.dataset.tag;
        const group = this.classList.contains('author-filter-btn') ? '.author-filter-btn' : '.filter-button';

        $$(group).forEach(b => b.classList.remove('active'));
        this.classList.add('active');

        // Reset the other filter group
        if (group === '.author-filter-btn') {
            $$('.filter-button').forEach(b => { b.classList.remove('active'); if (b.dataset.filter === 'all') b.classList.add('active'); });
        }

        applyFilter(type, value);
    }

    function setupFilters() {
        // Author filter buttons (static HTML)
        $$('.author-filter-btn').forEach(b => b.addEventListener('click', handleFilterClick));

        // Build category/tag buttons dynamically
        const container = $('.filter-categories');
        if (!container) return;

        const counts = { category: {}, tag: {} };
        state.allPosts.forEach(p => {
            const cat = p.category || 'Uncategorized';
            const tag = p.tag || 'General';
            counts.category[cat] = (counts.category[cat] || 0) + 1;
            counts.tag[tag] = (counts.tag[tag] || 0) + 1;
        });

        let html = `<button class="filter-button active" data-filter="all">All <span class="category-count">${state.allPosts.length}</span></button>`;
        for (const [cat, n] of Object.entries(counts.category))
            html += `<button class="filter-button" data-filter="category" data-category="${cat}">${cat} <span class="category-count">${n}</span></button>`;
        for (const [tag, n] of Object.entries(counts.tag))
            html += `<button class="filter-button" data-filter="tag" data-tag="${tag}"># ${tag} <span class="category-count">${n}</span></button>`;

        container.innerHTML = html;
        container.querySelectorAll('.filter-button').forEach(b => b.addEventListener('click', handleFilterClick));
    }

    // ── Search ──────────────────────────────────────────────
    function setupSearch() {
        const input = $('.search-bar input');
        const btn = $('.search-bar button');
        if (!input || !btn) return;

        // Wrap for clear button
        if (!input.parentNode.classList.contains('search-wrapper')) {
            const wrap = document.createElement('div');
            wrap.className = 'search-wrapper position-relative';
            input.parentNode.insertBefore(wrap, input);
            wrap.appendChild(input);

            const clearBtn = document.createElement('button');
            clearBtn.className = 'search-clear-btn';
            clearBtn.innerHTML = '<i class="fas fa-times"></i>';
            clearBtn.style.display = 'none';
            wrap.appendChild(clearBtn);

            input.addEventListener('input', () => clearBtn.style.display = input.value ? 'block' : 'none');
            clearBtn.addEventListener('click', () => { input.value = ''; clearBtn.style.display = 'none'; resetSearch(); });
        }

        const doSearch = () => {
            const term = input.value.toLowerCase().trim();
            if (!term) { resetSearch(); return; }

            state.filteredPosts = state.allPosts.filter(p =>
                [p.title, p.excerpt, p.author, p.tag || '', p.category || ''].join(' ').toLowerCase().includes(term)
            );

            $$('.filter-button, .author-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === 'all'));
            setupPagination();
            displayPosts(1);
            showSearchMsg(term, state.filteredPosts.length);
        };

        const resetSearch = () => {
            state.filteredPosts = [...state.allPosts];
            setupPagination();
            displayPosts(1);
            $('.search-results-message')?.remove();
            $$('.filter-button').forEach(b => b.classList.toggle('active', b.dataset.filter === 'all'));
        };

        btn.addEventListener('click', doSearch);
        input.addEventListener('keypress', e => { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } });
    }

    function showSearchMsg(term, count) {
        $('.search-results-message')?.remove();
        const el = document.createElement('div');
        el.className = 'search-results-message mt-3 mb-4 text-center';
        el.innerHTML = `<span>Found ${count} result${count !== 1 ? 's' : ''} for "${term}"</span>
            <button class="btn btn-sm btn-outline-info ms-3 clear-search">Clear</button>`;
        const grid = $('.blog-posts');
        grid?.parentNode.insertBefore(el, grid);
        el.querySelector('.clear-search').addEventListener('click', () => {
            $('.search-bar input').value = '';
            const cb = $('.search-clear-btn');
            if (cb) cb.style.display = 'none';
            state.filteredPosts = [...state.allPosts];
            setupPagination();
            displayPosts(1);
            el.remove();
        });
    }

    // ── Display posts ───────────────────────────────────────
    function displayPosts(page) {
        const container = $('.blog-posts');
        if (!container) return;

        const base = getBasePath();
        const posts = state.filteredPosts.filter(p => !state.featuredPostIds.includes(p.id));
        const start = (page - 1) * CONFIG.POSTS_PER_PAGE;
        const slice = posts.slice(start, start + CONFIG.POSTS_PER_PAGE);

        if (!slice.length) {
            container.innerHTML = '<div class="col-12"><div class="alert alert-info">No posts found matching your criteria.</div></div>';
            return;
        }

        container.innerHTML = slice.map(p => postCardHTML(p, base)).join('');
        updatePaginationUI(page, posts.length);

        const summary = $('#pagination-summary');
        if (summary) {
            const end = Math.min(start + slice.length, posts.length);
            summary.textContent = `Showing ${start + 1}–${end} of ${posts.length} posts`;
        }
    }

    // ── Pagination ──────────────────────────────────────────
    function setupPagination() {
        const posts = state.filteredPosts.filter(p => !state.featuredPostIds.includes(p.id));
        state.totalPages = Math.max(1, Math.ceil(posts.length / CONFIG.POSTS_PER_PAGE));

        const ul = $('.pagination');
        if (!ul) return;

        const end = Math.min(state.totalPages, 5);
        const startP = Math.max(1, end - 4);

        let html = `<li class="page-item ${state.currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" aria-label="Previous" data-action="prev"><span>&laquo;</span></a></li>`;
        for (let i = startP; i <= end; i++)
            html += `<li class="page-item ${i === state.currentPage ? 'active' : ''}"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`;
        html += `<li class="page-item ${state.currentPage === state.totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" aria-label="Next" data-action="next"><span>&raquo;</span></a></li>`;

        ul.innerHTML = html;
        ul.querySelectorAll('.page-link').forEach(link => {
            link.addEventListener('click', function (e) {
                e.preventDefault();
                const action = this.dataset.action;
                if (action === 'prev' && state.currentPage > 1) goPage(state.currentPage - 1);
                else if (action === 'next' && state.currentPage < state.totalPages) goPage(state.currentPage + 1);
                else { const n = parseInt(this.dataset.page); if (!isNaN(n)) goPage(n); }
            });
        });

        const wrap = $('.pagination-container');
        if (wrap) wrap.style.display = state.totalPages > 1 ? 'block' : 'none';
    }

    function updatePaginationUI(page, total) {
        state.currentPage = page;
        state.totalPages = Math.max(1, Math.ceil(total / CONFIG.POSTS_PER_PAGE));
        $$('.page-link[data-page]').forEach(l => l.parentElement.classList.toggle('active', +l.dataset.page === page));
    }

    function goPage(page) {
        if (page < 1 || page > state.totalPages) return;
        state.currentPage = page;
        displayPosts(page);
        setupPagination();
        $('.blog-posts')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ── Featured posts ──────────────────────────────────────
    const isFeatured = p => /^\d{8}[A-Z]?F$|^\d{8}-\d+[A-Z]?F$/.test(p.id);

    function loadFeaturedPosts() {
        const container = $('#featured-posts-container');
        if (!container) return;

        container.innerHTML = '';
        state.featuredPostIds = [];

        fetchBlogData().then(data => {
            data.posts.forEach(p => p.author = determineAuthor(p));
            const featured = data.posts
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .filter(isFeatured)
                .slice(0, CONFIG.FEATURED_POSTS_LIMIT);

            state.featuredPostIds = featured.map(p => p.id);

            if (!featured.length) {
                container.innerHTML = '<div class="col-12"><p class="text-light">No featured posts available.</p></div>';
                return;
            }

            const base = getBasePath();
            container.innerHTML = featured.map(post => {
                const dm = post.displayDate?.match(/([A-Za-z]+) (\d+)/);
                const month = dm ? dm[1].substring(0, 3) : 'JAN';
                const day = dm ? dm[2] : '1';
                const img = imgPath(base, post.image);
                const fallback = base + 'blog-module/images/default-blog.jpg';

                return `
                <div class="col-md-4 col-sm-6 mb-4">
                    <a href="${base}blog-module/blog-entries/${post.id}/article.html" class="featured-post-link">
                        <div class="featured-post-card">
                            <img src="${img}" alt="${post.title}" class="featured-post-img" loading="lazy"
                                 onerror="this.src='${fallback}'">
                            <div class="featured-post-content">
                                <h3 class="featured-post-title">${post.title}</h3>
                                <div class="featured-post-meta">
                                    <span class="featured-post-author"><i class="fas fa-user"></i> ${post.author}</span>
                                </div>
                                <p class="featured-post-excerpt">${post.excerpt || 'Read this interesting article…'}</p>
                                <div class="featured-post-meta">
                                    <span class="featured-post-date"><i class="fas fa-calendar"></i> ${month} ${day}</span>
                                    <span class="read-more">Read <i class="fas fa-arrow-right"></i></span>
                                </div>
                            </div>
                        </div>
                    </a>
                </div>`;
            }).join('');
        }).catch(err => {
            console.error('Error loading featured posts:', err);
            showError(container, 'Unable to load featured posts.');
        });
    }

    // ── Page loaders ────────────────────────────────────────
    function loadHomepageBlogPosts() {
        const section = $('#blog');
        if (!section) return;
        const container = section.querySelector('.blog-posts');
        if (!container) return;

        showLoading(container);
        const base = getBasePath();

        fetchBlogData().then(data => {
            data.posts.forEach(p => p.author = determineAuthor(p));
            const recent = data.posts.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);
            container.innerHTML = recent.map(p => postCardHTML(p, base, true)).join('');
        }).catch(() => showError(container));
    }

    function loadBlogIndexPosts() {
        const path = window.location.pathname;
        if (!path.includes('/blog/index.html') && !path.includes('/blog-module/blog/index.html') &&
            !path.endsWith('/blog/') && !path.endsWith('/blog-module/blog/')) return;

        const container = $('.blog-posts');
        if (!container) return;

        showLoading(container);

        fetchBlogData().then(data => {
            data.posts.forEach(p => p.author = determineAuthor(p));
            state.allPosts = data.posts.sort((a, b) => new Date(b.date) - new Date(a.date));
            state.filteredPosts = [...state.allPosts];
            setupPagination();
            displayPosts(1);
            setupFilters();
            setupSearch();
        }).catch(() => showError(container));
    }

    // ── Scroll to top ───────────────────────────────────────
    function setupScrollToTop() {
        const btn = $('#scroll-to-top');
        if (!btn) return;
        btn.style.display = 'none';

        let ticking = false;
        window.addEventListener('scroll', () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                const show = window.pageYOffset > 300;
                btn.classList.toggle('visible', show);
                ticking = false;
            });
        });
        btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }

    // ── F1 Calendar countdown (sidebar) ─────────────────────
    function setupF1CalendarCountdown() {
        const el = $('#sidebar-countdown');
        if (!el) return;

        const race = { name: 'Emilia Romagna Grand Prix', circuit: 'Autodromo Enzo e Dino Ferrari', date: new Date(2025, 4, 18, 14, 0, 0) };
        const nameEl = $('#next-race-name');
        const circuitEl = $('#next-race-circuit');
        const daysEl = $('#count-days');
        const hoursEl = $('#count-hours');
        const minsEl = $('#count-mins');

        if (nameEl) nameEl.textContent = race.name;
        if (circuitEl) circuitEl.textContent = race.circuit;

        const update = () => {
            const diff = race.date - new Date();
            if (diff <= 0) { [daysEl, hoursEl, minsEl].forEach(e => { if (e) e.textContent = '0'; }); return; }
            if (daysEl) daysEl.textContent = Math.floor(diff / 864e5);
            if (hoursEl) hoursEl.textContent = String(Math.floor((diff % 864e5) / 36e5)).padStart(2, '0');
            if (minsEl) minsEl.textContent = String(Math.floor((diff % 36e5) / 6e4)).padStart(2, '0');
        };
        update();
        setInterval(update, 60000);
    }

    // ── Past races toggle ───────────────────────────────────
    function setupPastRacesToggle() {
        const btn = $('#toggle-past-races');
        if (!btn) return;
        btn.addEventListener('click', function () {
            const showing = this.textContent.includes('Hide');
            $$('.race-past').forEach(r => r.style.display = showing ? 'none' : 'flex');
            this.textContent = showing ? 'Show Past Races' : 'Hide Past Races';
        });
    }

    // ── Init ────────────────────────────────────────────────
    const path = window.location.pathname;
    const isBlogIndex = path.includes('/blog/index.html') || path.includes('/blog-module/blog/index.html') ||
        path.endsWith('/blog/') || path.endsWith('/blog-module/blog/');

    if (isBlogIndex) {
        loadFeaturedPosts();
        loadBlogIndexPosts();
    } else {
        loadHomepageBlogPosts();
    }

    setupScrollToTop();
    setupF1CalendarCountdown();
    setupPastRacesToggle();
});
