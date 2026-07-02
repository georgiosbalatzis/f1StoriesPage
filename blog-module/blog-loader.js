// blog-loader.js — Handles homepage blog section only
// The blog index page (index.html) has its own self-contained loader.
// This script loads the 3 most recent posts for the homepage blog preview.

document.addEventListener('DOMContentLoaded', function () {
    const CACHE_KEY = 'f1s-home-blog-v2';
    const CACHE_TTL = 15 * 60 * 1000;
    const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

    const $ = sel => document.querySelector(sel);
    let started = false;

    // ── Build image path ────────────────────────────
    function imgSrc(src) {
        if (!src) return '/blog-module/images/default-blog.jpg';
        if (src.startsWith('http')) return src;
        return src.startsWith('/') ? src : '/' + src;
    }

    function dateParts(value) {
        const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return { day: '', month: '' };
        const monthIndex = parseInt(match[2], 10) - 1;
        return {
            day: String(parseInt(match[3], 10) || ''),
            month: MONTHS[monthIndex] || ''
        };
    }

    function defaultThumbnail(id) {
        return '/blog-module/blog-entries/' + encodeURIComponent(id || '') + '/1-card.webp';
    }

    function extractPosts(data) {
        if (data && data.v === 2 && Array.isArray(data.p)) {
            return data.p.map(row => {
                const id = row[0] || '';
                return {
                    id: id,
                    title: row[1] || '',
                    date: row[3] || '',
                    thumbnail: defaultThumbnail(id),
                    thumbnailWidth: parseInt(row[4], 10) || 400,
                    thumbnailHeight: parseInt(row[5], 10) || 188,
                    excerpt: row[6] || ''
                };
            });
        }
        if (data && Array.isArray(data.posts)) return data.posts;
        return Array.isArray(data) ? data : [];
    }

    // ── Fetch home-latest.json with fallback paths ────────
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

        const paths = [
            '/blog-module/home-latest.json',
            'blog-module/home-latest.json',
            '/blog-module/blog-index-data.json'
        ];
        for (const p of paths) {
            try {
                const r = await fetch(p, {
                    cache: 'no-store',
                    headers: { 'Accept': 'application/json' }
                });
                if (r.ok) {
                    const data = await r.json();
                    writeCachedBlogData(data);
                    return data;
                }
            } catch (_) { /* next */ }
        }
        if (cached) return cached;
        throw new Error('Failed to fetch blog data');
    }

    // ── Render a single card ────────────────────────
    document.addEventListener('error', function(event) {
        var img = event.target;
        if (!img || img.tagName !== 'IMG') return;
        var fallback = img.getAttribute('data-fallback-src');
        if (!fallback) return;
        img.removeAttribute('data-fallback-src');
        img.src = fallback;
    }, true);

    function createIcon(iconId) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'icon');
        svg.setAttribute('aria-hidden', 'true');
        const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', '#' + iconId);
        svg.appendChild(use);
        return svg;
    }

    function createMessageColumn(text, className) {
        const col = document.createElement('div');
        col.className = className || 'col-12 text-center';
        const p = document.createElement('p');
        p.style.color = 'var(--bs-text-muted)';
        p.textContent = text;
        col.appendChild(p);
        return col;
    }

    function createLoadingColumn() {
        const col = document.createElement('div');
        col.className = 'col-12 text-center py-4';
        const spinner = document.createElement('div');
        spinner.className = 'spinner-border text-light';
        spinner.setAttribute('role', 'status');
        const hidden = document.createElement('span');
        hidden.className = 'visually-hidden';
        hidden.textContent = 'Φόρτωση άρθρων...';
        spinner.appendChild(hidden);
        col.appendChild(spinner);
        return col;
    }

    function createStoryMeta(label, date) {
        const meta = document.createElement('div');
        meta.className = 'home-story-meta';

        const labelEl = document.createElement('span');
        labelEl.className = 'home-story-meta__label';
        labelEl.textContent = label;

        const dateEl = document.createElement('span');
        dateEl.className = 'home-story-meta__date';
        dateEl.textContent = date || '';

        meta.append(labelEl, dateEl);
        return meta;
    }

    function createBlogCard(post) {
        const href = '/blog-module/blog-entries/' + encodeURIComponent(post.slug || post.id || '') + '/article.html';
        const img = imgSrc(post.thumbnail || post.image);
        const fallback = '/blog-module/images/default-blog.jpg';
        const parts = dateParts(post.date);
        const thumbWidth = parseInt(post.thumbnailWidth, 10) || 400;
        const thumbHeight = parseInt(post.thumbnailHeight, 10) || 188;

        const col = document.createElement('div');
        col.className = 'col-md-4';
        const link = document.createElement('a');
        link.href = href;
        link.className = 'blog-card-link';
        const card = document.createElement('div');
        card.className = 'blog-card';

        const media = document.createElement('div');
        media.className = 'blog-img-container';
        const image = document.createElement('img');
        image.src = img;
        image.alt = post.title || '';
        image.className = 'blog-img';
        image.loading = 'lazy';
        image.decoding = 'async';
        image.width = thumbWidth;
        image.height = thumbHeight;
        image.setAttribute('data-fallback-src', fallback);

        const date = document.createElement('div');
        date.className = 'blog-date';
        const day = document.createElement('span');
        day.className = 'day';
        day.textContent = parts.day;
        const month = document.createElement('span');
        month.className = 'month';
        month.textContent = parts.month;
        date.append(day, month);
        media.append(image, date);

        const body = document.createElement('div');
        body.className = 'blog-content';
        const title = document.createElement('h3');
        title.className = 'blog-title';
        title.textContent = post.title || '';
        const excerpt = document.createElement('p');
        excerpt.className = 'blog-excerpt';
        excerpt.textContent = post.excerpt || '';
        const readMore = document.createElement('span');
        readMore.className = 'blog-read-more';
        readMore.append(document.createTextNode('Συνέχεια ανάγνωσης '), createIcon('fa-arrow-right'));
        body.append(title, excerpt, readMore);

        card.append(media, body);
        link.appendChild(card);
        col.appendChild(link);
        return col;
    }

    function createHomeLeadStory(post) {
        const href = '/blog-module/blog-entries/' + encodeURIComponent(post.slug || post.id || '') + '/article.html';
        const img = imgSrc(post.thumbnail || post.image);
        const fallback = '/blog-module/images/default-blog.jpg';
        const thumbWidth = parseInt(post.thumbnailWidth, 10) || 400;
        const thumbHeight = parseInt(post.thumbnailHeight, 10) || 188;

        const article = document.createElement('article');
        article.className = 'home-lead-story';

        const link = document.createElement('a');
        link.href = href;
        link.className = 'home-lead-story__link';

        const media = document.createElement('div');
        media.className = 'home-lead-story__media';
        const image = document.createElement('img');
        image.src = img;
        image.alt = post.title || '';
        image.className = 'home-lead-story__image';
        image.loading = 'lazy';
        image.decoding = 'async';
        image.width = thumbWidth;
        image.height = thumbHeight;
        image.setAttribute('data-fallback-src', fallback);
        media.appendChild(image);

        const body = document.createElement('div');
        body.className = 'home-lead-story__body';
        body.appendChild(createStoryMeta('Κύριο θέμα', post.date));

        const title = document.createElement('h3');
        title.className = 'home-lead-story__title';
        title.textContent = post.title || '';

        const excerpt = document.createElement('p');
        excerpt.className = 'home-lead-story__excerpt';
        excerpt.textContent = post.excerpt || '';

        const cta = document.createElement('span');
        cta.className = 'home-lead-story__cta';
        cta.append(document.createTextNode('Συνέχεια ανάγνωσης '), createIcon('fa-arrow-right'));

        body.append(title, excerpt, cta);
        link.append(media, body);
        article.appendChild(link);
        return article;
    }

    function createHomeSecondaryStory(post) {
        const href = '/blog-module/blog-entries/' + encodeURIComponent(post.slug || post.id || '') + '/article.html';
        const img = imgSrc(post.thumbnail || post.image);
        const fallback = '/blog-module/images/default-blog.jpg';
        const thumbWidth = parseInt(post.thumbnailWidth, 10) || 400;
        const thumbHeight = parseInt(post.thumbnailHeight, 10) || 188;

        const article = document.createElement('article');
        article.className = 'home-secondary-story';

        const link = document.createElement('a');
        link.href = href;
        link.className = 'home-secondary-story__link';

        const media = document.createElement('div');
        media.className = 'home-secondary-story__media';
        const image = document.createElement('img');
        image.src = img;
        image.alt = post.title || '';
        image.className = 'home-secondary-story__image';
        image.loading = 'lazy';
        image.decoding = 'async';
        image.width = thumbWidth;
        image.height = thumbHeight;
        image.setAttribute('data-fallback-src', fallback);
        media.appendChild(image);

        const body = document.createElement('div');
        body.className = 'home-secondary-story__body';
        body.appendChild(createStoryMeta('Επόμενο θέμα', post.date));

        const title = document.createElement('h3');
        title.className = 'home-secondary-story__title';
        title.textContent = post.title || '';

        const excerpt = document.createElement('p');
        excerpt.className = 'home-secondary-story__excerpt';
        excerpt.textContent = post.excerpt || '';

        body.append(title, excerpt);
        link.append(media, body);
        article.appendChild(link);
        return article;
    }

    function renderHomepageFeed(container, posts) {
        const recent = posts.slice(0, 3);
        if (!recent.length) {
            container.replaceChildren(createMessageColumn('Δεν υπάρχουν διαθέσιμα άρθρα αυτή τη στιγμή.', 'text-center'));
            return;
        }

        const shell = document.createElement('div');
        shell.className = 'home-stories-shell';

        const lead = document.createElement('div');
        lead.className = 'home-stories-shell__lead';
        lead.appendChild(createHomeLeadStory(recent[0]));

        shell.appendChild(lead);

        if (recent.length > 1) {
            const rail = document.createElement('div');
            rail.className = 'home-stories-shell__rail';
            recent.slice(1).forEach(post => rail.appendChild(createHomeSecondaryStory(post)));
            shell.appendChild(rail);
        }

        container.replaceChildren(shell);
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
        container.replaceChildren(createLoadingColumn());

        fetchBlogData()
            .then(function (data) {
                var posts = extractPosts(data);
                if (container.closest('#latest')) {
                    renderHomepageFeed(container, posts);
                    return;
                }

                var recent = posts.slice(0, 3);
                if (!recent.length) {
                    container.replaceChildren(createMessageColumn('Δεν υπάρχουν διαθέσιμα άρθρα αυτή τη στιγμή.'));
                    return;
                }
                container.replaceChildren.apply(container, recent.map(createBlogCard));
            })
            .catch(function () {
                var col = document.createElement('div');
                col.className = 'col-12';
                var alert = document.createElement('div');
                alert.className = 'alert alert-danger';
                alert.textContent = 'Δεν ήταν δυνατή η φόρτωση των άρθρων.';
                col.appendChild(alert);
                container.replaceChildren(col);
            });
    }

    function canWarmHiddenPanel() {
        if (!navigator.connection) return true;
        return !navigator.connection.saveData &&
            navigator.connection.effectiveType !== 'slow-2g' &&
            navigator.connection.effectiveType !== '2g' &&
            navigator.connection.effectiveType !== '3g';
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
            }, { rootMargin: '120px 0px' });
            observer.observe(latestSection);
        }
    }
});
