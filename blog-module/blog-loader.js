// blog-loader.js — Handles homepage blog section only
// The blog index page (index.html) has its own self-contained loader.
// This script loads the 3 most recent posts for the homepage blog preview.

document.addEventListener('DOMContentLoaded', function () {
    const AUTHOR_MAP = {
        G: 'Georgios Balatzis',
        J: 'Giannis Poulikidis',
        T: 'Thanasis Batalas',
        W: '2Fast',
        D: 'Dimitris Keramidiotis'
    };
    const CACHE_KEY = 'f1s-home-blog-v1';
    const CACHE_TTL = 15 * 60 * 1000;

    const $ = sel => document.querySelector(sel);
    let started = false;

    // ── Determine author from folder ID if not set ──
    function resolveAuthor(post) {
        if (post.author && post.author.trim() && post.author !== 'F1 Stories Team') return post.author;
        const id = post.id || '';
        const m = id.match(/\d{8}(?:-\d+)?([A-Z])F?$/) || id.match(/\d{8}([A-Z])$/);
        if (m && AUTHOR_MAP[m[1]]) return AUTHOR_MAP[m[1]];
        return post.author || 'F1 Stories Team';
    }

    // ── Build image path ────────────────────────────
    function imgSrc(src) {
        if (!src) return '/blog-module/images/default-blog.jpg';
        if (src.startsWith('http')) return src;
        return src.startsWith('/') ? src : '/' + src;
    }

    // ── Fetch blog-index-data.json with fallback paths ────
    function readCachedBlogData() {
        try {
            const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY));
            if (cached && cached.ts && Date.now() - cached.ts < CACHE_TTL && cached.data) {
                return cached.data;
            }
        } catch (_) {}
        return null;
    }

    function writeCachedBlogData(data) {
        try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({
                ts: Date.now(),
                data: data
            }));
        } catch (_) {}
    }

    async function fetchBlogData() {
        const cached = readCachedBlogData();
        if (cached) return cached;

        const paths = [
            '/blog-module/blog-index-data.json',
            'blog-module/blog-index-data.json',
            '../blog-module/blog-index-data.json'
        ];
        for (const p of paths) {
            try {
                const r = await fetch(p);
                if (r.ok) {
                    const data = await r.json();
                    writeCachedBlogData(data);
                    return data;
                }
            } catch (_) { /* next */ }
        }
        throw new Error('Failed to fetch blog data');
    }

    // ── Render a single card ────────────────────────
    function cardHTML(post) {
        const img = imgSrc(post.image);
        const fallback = '/blog-module/images/default-blog.jpg';
        const dm = (post.displayDate || '').match(/([A-Za-z]+)\s+(\d+)/);
        const month = dm ? dm[1].substring(0, 3).toUpperCase() : '';
        const day = dm ? dm[2] : '';
        const readTime = post.readingTime || '';

        return `
        <div class="col-md-4">
            <a href="/blog-module/blog-entries/${post.id}/article.html" class="blog-card-link">
                <div class="blog-card">
                    <div class="blog-img-container">
                        <img src="${img}" alt="${post.title}" class="blog-img" loading="lazy"
                             decoding="async"
                             onerror="this.src='${fallback}';this.onerror=null;">
                        <div class="blog-date">
                            <span class="day">${day}</span>
                            <span class="month">${month}</span>
                        </div>
                    </div>
                    <div class="blog-content">
                        <h3 class="blog-title">${post.title}</h3>
                        <div class="blog-meta">
                            <span><i class="fas fa-user"></i> ${post.author}</span>
                            ${readTime ? '<span><i class="fas fa-clock"></i> ' + readTime + '</span>' : ''}
                        </div>
                        <p class="blog-excerpt">${post.excerpt || ''}</p>
                        <span class="blog-read-more">Read More <i class="fas fa-arrow-right"></i></span>
                    </div>
                </div>
            </a>
        </div>`;
    }

    // ── Load homepage blog posts ────────────────────
    function loadHomepagePosts() {
        if (started) return;
        started = true;

        // Look for blog posts container on the homepage
        // Try multiple selectors: the old #blog section, or the new #panel-articles
        var container = null;

        // Try #blog section first (legacy layout)
        var section = $('#blog');
        if (section) {
            container = section.querySelector('.blog-posts');
        }

        // Try #panel-articles (new tabbed layout in Latest section)
        if (!container) {
            var panel = $('#panel-articles');
            if (panel) {
                container = panel.querySelector('.blog-posts');
            }
        }

        // Fallback: any .blog-posts on the page
        if (!container) {
            container = $('.blog-posts');
        }

        if (!container) return;

        // Show loading state
        container.innerHTML = `
            <div class="col-12 text-center py-4">
                <div class="spinner-border text-light" role="status">
                    <span class="visually-hidden">Loading blog posts…</span>
                </div>
            </div>`;

        fetchBlogData()
            .then(function (data) {
                var posts = (data.posts || data || []);
                posts.forEach(function (p) { p.author = resolveAuthor(p); });
                posts.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });

                var recent = posts.slice(0, 3);
                if (!recent.length) {
                    container.innerHTML = '<div class="col-12 text-center"><p style="color:var(--bs-text-muted)">No blog posts yet.</p></div>';
                    return;
                }
                container.innerHTML = recent.map(cardHTML).join('');
            })
            .catch(function () {
                container.innerHTML = '<div class="col-12"><div class="alert alert-danger">Unable to load blog posts.</div></div>';
            });
    }

    function canWarmHiddenPanel() {
        if (!navigator.connection) return true;
        return !navigator.connection.saveData &&
            navigator.connection.effectiveType !== 'slow-2g' &&
            navigator.connection.effectiveType !== '2g';
    }

    function scheduleLoad() {
        if (started) return;
        if ('requestIdleCallback' in window && canWarmHiddenPanel()) {
            requestIdleCallback(loadHomepagePosts, { timeout: 1500 });
            return;
        }
        setTimeout(loadHomepagePosts, 0);
    }

    // Only run on the homepage, not on the blog index
    var path = window.location.pathname;
    var isBlogIndex = path.includes('/blog/index.html') || path.includes('/blog-module/blog/') || path.endsWith('/blog/');
    if (!isBlogIndex) {
        var articlesPanel = $('#panel-articles');
        var latestSection = $('#latest');
        var articlesTab = $('.latest-tab[data-tab="articles"]');

        if (!articlesPanel) {
            loadHomepagePosts();
            return;
        }

        document.addEventListener('homepage:articles-tab-open', loadHomepagePosts);
        if (articlesTab) {
            articlesTab.addEventListener('click', loadHomepagePosts, { once: true });
        }

        if (articlesPanel.classList.contains('active')) {
            scheduleLoad();
        } else if (latestSection && 'IntersectionObserver' in window && canWarmHiddenPanel()) {
            var observer = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) return;
                    observer.disconnect();
                    scheduleLoad();
                });
            }, { rootMargin: '320px 0px' });
            observer.observe(latestSection);
        }
    }
});
