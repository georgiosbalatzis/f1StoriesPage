// article-script.js — Article page functionality
// Share + scroll-to-top handled by blog-fixes.js / shared-nav.js.
document.addEventListener('DOMContentLoaded', function () {
    const $ = sel => document.querySelector(sel);
    const $$ = sel => document.querySelectorAll(sel);

    // Cache article content element — queried by multiple functions
    const articleContent = $('.article-content');

    // ── Author data ─────────────────────────────────────────
    const AUTHORS = {
        'Georgios Balatzis':  { image: '/images/authors/georgios.webp', title: 'Ιδρυτής και παρουσιαστής', bio: 'Γράφει για στρατηγική, απόδοση και όσα αλλάζουν την ισορροπία ενός αγώνα.' },
        'Giannis Poulikidis': { image: '/images/authors/giannis.webp', title: 'Συμπαρουσιαστής και αναλυτής', bio: 'Εστιάζει στην τεχνική πλευρά της F1 και στις αποφάσεις που κρίνουν ένα Grand Prix.' },
        'Thanasis Batalas':   { image: '/images/authors/thanasis.webp', title: 'Συντάκτης', bio: 'Καλύπτει ιστορίες, πρόσωπα και στιγμές από την αγωνιστική πλευρά της Formula 1.' },
        'Themis Charvalis':       { image: '/images/authors/2fast.webp', title: 'Sim racing και ψηφιακοί αγώνες', bio: 'Παρακολουθεί το sim racing και τη σχέση του με τον σύγχρονο μηχανοκίνητο αθλητισμό.' },
        'Dimitris Keramidiotis': { image: '/images/authors/dimitris.webp', title: 'Συντάκτης', bio: 'Γράφει θεματικά άρθρα, αξιολογήσεις και σχόλια γύρω από τη σεζόν.' }
    };

    function calcReadingTime() {
        const el = $('#reading-time-value');
        if (!articleContent || !el) return;
        const words = articleContent.textContent.trim().split(/\s+/).length;
        const mins = Math.max(1, Math.ceil(words / 200));
        el.textContent = `${mins} λεπτά ανάγνωσης`;
    }

    function setupImageFallbacks() {
        document.addEventListener('error', function(event) {
            const img = event.target;
            if (!img || img.tagName !== 'IMG') return;

            const fallbackSrc = img.getAttribute('data-fallback-src');
            if (fallbackSrc) {
                img.removeAttribute('data-fallback-src');
                img.src = fallbackSrc;
                return;
            }

            const showId = img.getAttribute('data-show-on-error');
            if (showId) {
                const fallbackEl = document.getElementById(showId);
                img.style.display = 'none';
                if (fallbackEl) fallbackEl.style.display = 'flex';
            }
        }, true);
    }

    function populateAuthor() {
        const nameEl = $('#author-name');
        if (!nameEl) return;
        const name = nameEl.textContent.trim();
        const data = AUTHORS[name];
        const imgEl = $('#author-image');
        const initialEl = $('#author-initial');
        const titleEl = $('#author-title');
        const bioEl = $('#author-bio');
        if (data) {
            if (imgEl) imgEl.src = data.image;
            if (titleEl) titleEl.textContent = data.title;
            if (bioEl) bioEl.textContent = data.bio;
        }
        if (initialEl) initialEl.textContent = name.charAt(0).toUpperCase();
    }

    function extractIndexPosts(data) {
        if (data && data.v === 2 && Array.isArray(data.p)) {
            return data.p.map(row => ({
                id: row[0] || '',
                title: row[1] || '',
                date: row[3] || ''
            }));
        }
        if (data && Array.isArray(data.posts)) return data.posts;
        return Array.isArray(data) ? data : [];
    }

    async function setupNavigation() {
        const prevLink = $('#prev-article-link');
        const nextLink = $('#next-article-link');
        if (!prevLink && !nextLink) return;
        const hasResolvedLink = (link) => {
            if (!link) return true;
            const href = (link.getAttribute('href') || '').trim();
            return href && href !== '#' && !href.includes('PREV_') && !href.includes('NEXT_');
        };
        if (hasResolvedLink(prevLink) && hasResolvedLink(nextLink)) return;
        const currentId = window.location.pathname.split('/blog-entries/')[1]?.split('/')[0];
        if (!currentId) return;
        try {
            const paths = ['/blog-module/blog-index-data.json', '../../blog-index-data.json', '../../../blog-module/blog-index-data.json'];
            let data = null;
            for (const p of paths) { try { const r = await fetch(p); if (r.ok) { data = await r.json(); break; } } catch (_) {} }
            if (!data) return;
            const sorted = extractIndexPosts(data).sort((a, b) => new Date(b.date) - new Date(a.date));
            const idx = sorted.findIndex(p => p.id === currentId);
            if (idx === -1) return;
            const base = window.location.pathname.includes('/blog-entries/') ? window.location.pathname.split('/blog-entries/')[0] + '/blog-entries/' : '/blog-module/blog-entries/';
            if (idx > 0 && prevLink) { prevLink.href = `${base}${sorted[idx - 1].id}/article.html`; prevLink.title = sorted[idx - 1].title; } else if (prevLink) { prevLink.style.visibility = 'hidden'; }
            if (idx < sorted.length - 1 && nextLink) { nextLink.href = `${base}${sorted[idx + 1].id}/article.html`; nextLink.title = sorted[idx + 1].title; } else if (nextLink) { nextLink.style.visibility = 'hidden'; }
        } catch (err) { console.error('Error loading article navigation:', err); }
    }

    function updateShareLinks() {
        const url = encodeURIComponent(window.location.href);
        const title = encodeURIComponent(document.title);
        $$('.share-buttons a').forEach(a => {
            let href = a.getAttribute('href');
            if (href) { href = href.replace(/CURRENT_URL/g, url).replace(/ARTICLE_TITLE/g, title); a.setAttribute('href', href); }
        });
    }

    function loadScriptOnce(src, attrs = {}) {
        return new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[data-embed-src="${src}"], script[src="${src}"]`);
            if (existing) {
                existing.addEventListener('load', () => resolve(existing), { once: true });
                existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.dataset.embedSrc = src;

            Object.entries(attrs).forEach(([key, value]) => {
                if (value === true) script.setAttribute(key, '');
                else if (value !== false && value != null) script.setAttribute(key, value);
            });

            script.addEventListener('load', () => resolve(script), { once: true });
            script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
            document.head.appendChild(script);
        });
    }

    function ensureFacebookRoot() {
        if (document.getElementById('fb-root')) return;
        const fbRoot = document.createElement('div');
        fbRoot.id = 'fb-root';
        document.body.prepend(fbRoot);
    }

    function loadFacebookSdk() {
        return new Promise((resolve, reject) => {
            if (window.FB?.XFBML?.parse) {
                resolve(window.FB);
                return;
            }

            ensureFacebookRoot();
            const previousInit = window.fbAsyncInit;
            window.fbAsyncInit = function() {
                if (typeof previousInit === 'function') previousInit();
                resolve(window.FB);
            };

            loadScriptOnce('https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v23.0', {
                crossorigin: 'anonymous',
                defer: 'defer'
            }).catch(reject);
        });
    }

    function setupSocialEmbeds() {
        if (!articleContent) return;

        const twitterEmbeds = articleContent.querySelectorAll('blockquote.twitter-tweet');
        const instagramEmbeds = articleContent.querySelectorAll('blockquote.instagram-media');
        const threadsEmbeds = articleContent.querySelectorAll('blockquote.text-post-media');
        const facebookEmbeds = articleContent.querySelectorAll('.fb-post, .fb-video');

        if (!twitterEmbeds.length && !instagramEmbeds.length && !threadsEmbeds.length && !facebookEmbeds.length) {
            return;
        }

        if (twitterEmbeds.length) {
            const theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
            twitterEmbeds.forEach(embed => embed.setAttribute('data-theme', theme));

            const renderTweets = () => window.twttr?.widgets?.load(articleContent);
            if (window.twttr?.widgets?.load) {
                renderTweets();
            } else {
                loadScriptOnce('https://platform.twitter.com/widgets.js', { charset: 'utf-8' })
                    .then(renderTweets)
                    .catch(error => console.error('Error loading X widgets:', error));
            }
        }

        if (instagramEmbeds.length) {
            const processInstagram = () => window.instgrm?.Embeds?.process?.();
            if (window.instgrm?.Embeds?.process) {
                processInstagram();
            } else {
                loadScriptOnce('https://www.instagram.com/embed.js')
                    .then(processInstagram)
                    .catch(error => console.error('Error loading Instagram embeds:', error));
            }
        }

        if (threadsEmbeds.length && !document.querySelector('script[data-embed-src="https://www.threads.net/embed.js"], script[src="https://www.threads.net/embed.js"]')) {
            loadScriptOnce('https://www.threads.net/embed.js', { charset: 'utf-8' })
                .catch(error => console.error('Error loading Threads embeds:', error));
        }

        if (facebookEmbeds.length) {
            loadFacebookSdk()
                .then(() => window.FB?.XFBML?.parse(articleContent))
                .catch(error => console.error('Error loading Facebook embeds:', error));
        }
    }

    function buildTableOfContents() {
        if (!articleContent) return;
        const headings = articleContent.querySelectorAll('h2, h3');
        if (headings.length < 3) return;

        headings.forEach((h, i) => { if (!h.id) h.id = 'section-' + (i + 1); });

        function createIcon(iconId, className) {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('class', className || 'icon');
            svg.setAttribute('aria-hidden', 'true');
            const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
            use.setAttribute('href', '#' + iconId);
            svg.appendChild(use);
            return svg;
        }

        const tocEl = document.createElement('nav');
        tocEl.className = 'article-toc';
        const toggle = document.createElement('button');
        toggle.className = 'toc-toggle';
        toggle.id = 'toc-toggle';
        toggle.type = 'button';
        toggle.setAttribute('aria-label', 'Toggle table of contents');
        const label = document.createElement('span');
        label.textContent = 'Περιεχόμενα / Contents';
        toggle.append(createIcon('fa-list-ul'), label, createIcon('fa-chevron-down', 'icon toc-chevron'));

        const body = document.createElement('div');
        body.className = 'toc-body';
        body.id = 'toc-body';
        headings.forEach(h => {
            const link = document.createElement('a');
            link.setAttribute('href', '#' + h.id);
            link.className = h.tagName === 'H3' ? 'toc-item toc-sub' : 'toc-item';
            link.textContent = h.textContent.trim();
            body.appendChild(link);
        });
        tocEl.append(toggle, body);

        articleContent.parentNode.insertBefore(tocEl, articleContent);

        const tocToggle = toggle;
        const tocBody = body;
        if (tocToggle && tocBody) {
            tocToggle.addEventListener('click', () => {
                tocBody.classList.toggle('open');
                tocToggle.classList.toggle('open');
            });
        }

        tocEl.querySelectorAll('.toc-item').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.querySelector(link.getAttribute('href'));
                if (target) {
                    const offset = 80;
                    const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
                    window.scrollTo({ top, behavior: 'smooth' });
                }
            });
        });

        const tocLinks = tocEl.querySelectorAll('.toc-item');
        let activeHeadingId = '';

        const headingObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) activeHeadingId = entry.target.id;
            });
            tocLinks.forEach(link => {
                link.classList.toggle('active', link.getAttribute('href') === '#' + activeHeadingId);
            });
        }, { rootMargin: '-10% 0px -80% 0px', threshold: 0 });

        headings.forEach(h => headingObserver.observe(h));
    }

    function setupResponsiveTables() {
        if (!articleContent) return;

        const tableIds = new Set();
        articleContent.querySelectorAll('.view-toggle-btn[data-table]').forEach(button => {
            const tableId = button.getAttribute('data-table');
            if (tableId) tableIds.add(tableId);
        });

        tableIds.forEach(tableId => {
            const toggleButtons = Array.from(articleContent.querySelectorAll('.view-toggle-btn[data-table]'))
                .filter(button => button.getAttribute('data-table') === tableId);
            const scrollContainer = document.getElementById(`${tableId}-scroll`);
            const cardContainer = document.getElementById(`${tableId}-card`);

            toggleButtons.forEach(button => {
                button.addEventListener('click', function () {
                    const viewType = this.getAttribute('data-view');
                    toggleButtons.forEach(toggle => toggle.classList.remove('active'));
                    this.classList.add('active');

                    if (scrollContainer) scrollContainer.classList.toggle('active', viewType === 'scroll');
                    if (cardContainer) cardContainer.classList.toggle('active', viewType === 'card');
                });
            });

            if (!scrollContainer) return;
            const table = scrollContainer.querySelector('table');
            const indicator = scrollContainer.querySelector('.table-scroll-indicator');
            if (!table || !indicator) return;

            if (table.offsetWidth > scrollContainer.offsetWidth) {
                scrollContainer.classList.add('has-scroll');
                indicator.style.display = '';
            } else {
                scrollContainer.classList.remove('has-scroll');
                indicator.style.display = 'none';
            }
        });
    }

    // ── Gallery Carousel ────────────────────────────────────
    function setupGalleryCarousel() {
        const carousel = document.querySelector('.gallery-carousel');
        if (!carousel) return;

        const slides = carousel.querySelectorAll('.gallery-slide');
        const thumbs = carousel.querySelectorAll('.gallery-thumb');
        const prevBtn = carousel.querySelector('.gallery-carousel-prev');
        const nextBtn = carousel.querySelector('.gallery-carousel-next');
        const counter = carousel.querySelector('.gallery-carousel-counter');

        if (!slides.length) return;

        let current = 0;

        function goTo(index) {
            if (index < 0 || index >= slides.length) return;
            slides[current].classList.remove('active');
            thumbs[current].classList.remove('active');
            current = index;
            slides[current].classList.add('active');
            thumbs[current].classList.add('active');
            counter.textContent = (current + 1) + ' / ' + slides.length;
            prevBtn.disabled = current === 0;
            nextBtn.disabled = current === slides.length - 1;
            thumbs[current].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }

        prevBtn.addEventListener('click', function (e) { e.stopPropagation(); goTo(current - 1); });
        nextBtn.addEventListener('click', function (e) { e.stopPropagation(); goTo(current + 1); });

        thumbs.forEach(function (thumb, i) {
            thumb.addEventListener('click', function () { goTo(i); });
        });

        carousel.setAttribute('tabindex', '0');
        carousel.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(current - 1); }
            if (e.key === 'ArrowRight') { e.preventDefault(); goTo(current + 1); }
        });

        var stage = carousel.querySelector('.gallery-carousel-stage');
        var touchStartX = 0;
        stage.addEventListener('touchstart', function (e) {
            touchStartX = e.touches[0].clientX;
        }, { passive: true });
        stage.addEventListener('touchend', function (e) {
            var dx = e.changedTouches[0].clientX - touchStartX;
            if (Math.abs(dx) > 40) {
                if (dx < 0) goTo(current + 1); else goTo(current - 1);
            }
        }, { passive: true });
    }

    // ── Image Lightbox ───────────────────────────────────────
    function setupLightbox() {
        function getImages() {
            return Array.from(document.querySelectorAll('.article-content-img'));
        }

        if (!getImages().length) return;

        function createIcon(iconId) {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('class', 'icon');
            svg.setAttribute('aria-hidden', 'true');
            const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
            use.setAttribute('href', '#' + iconId);
            svg.appendChild(use);
            return svg;
        }

        function createLightboxButton(className, label, iconId) {
            const button = document.createElement('button');
            button.className = className;
            button.type = 'button';
            button.setAttribute('aria-label', label);
            button.appendChild(createIcon(iconId));
            return button;
        }

        // Build overlay DOM once
        const overlay = document.createElement('div');
        overlay.className = 'lb-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Image viewer');
        const closeButton = createLightboxButton('lb-close', 'Close', 'fa-times');
        const imageWrap = document.createElement('div');
        imageWrap.className = 'lb-img-wrap';
        const image = document.createElement('img');
        image.className = 'lb-img';
        image.src = '';
        image.alt = '';
        imageWrap.appendChild(image);
        const prevButton = createLightboxButton('lb-prev', 'Previous image', 'fa-chevron-left');
        const nextButton = createLightboxButton('lb-next', 'Next image', 'fa-chevron-right');
        const counter = document.createElement('div');
        counter.className = 'lb-counter';
        overlay.append(closeButton, imageWrap, prevButton, nextButton, counter);
        document.body.appendChild(overlay);

        const lbImg = image;
        const lbClose = closeButton;
        const lbPrev = prevButton;
        const lbNext = nextButton;
        const lbCounter = counter;

        let current = 0;
        let touchStartX = 0;
        let touchStartY = 0;

        function open(index) {
            const imgs = getImages();
            if (!imgs.length) return;
            current = index;
            update();
            overlay.classList.add('open');
            document.body.style.overflow = 'hidden';
            lbClose.focus();
        }

        function close() {
            overlay.classList.remove('open');
            document.body.style.overflow = '';
        }

        // Resolve full-res src: data-full-src is set by processor for srcset images
        function fullSrc(img) { return img.dataset.fullSrc || img.src; }

        function update() {
            const imgs = getImages();
            if (!imgs.length) return;
            const img = imgs[current];
            lbImg.src = fullSrc(img);
            lbImg.alt = img.alt || '';
            lbCounter.textContent = imgs.length > 1 ? `${current + 1} / ${imgs.length}` : '';
            lbPrev.disabled = current === 0;
            lbNext.disabled = current === imgs.length - 1;
        }

        function prev() { if (current > 0) { current--; update(); } }
        function next() {
            const imgs = getImages();
            if (current < imgs.length - 1) { current++; update(); }
        }

        articleContent.addEventListener('click', (e) => {
            const trigger = e.target.closest('.article-content-img, .article-figure picture, .article-figure');
            if (!trigger) return;

            const img = trigger.classList && trigger.classList.contains('article-content-img')
                ? trigger
                : trigger.querySelector('.article-content-img');
            if (!img) return;

            const imgs = getImages();
            const index = imgs.indexOf(img);
            if (index === -1) return;

            e.preventDefault();
            open(index);
        });

        lbClose.addEventListener('click', close);

        // Close on backdrop click (not on image)
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });

        lbPrev.addEventListener('click', (e) => { e.stopPropagation(); prev(); });
        lbNext.addEventListener('click', (e) => { e.stopPropagation(); next(); });

        // Keyboard
        document.addEventListener('keydown', (e) => {
            if (!overlay.classList.contains('open')) return;
            if (e.key === 'Escape') close();
            if (e.key === 'ArrowLeft') prev();
            if (e.key === 'ArrowRight') next();
        });

        // Touch swipe
        overlay.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: true });
        overlay.addEventListener('touchend', (e) => {
            const dx = e.changedTouches[0].clientX - touchStartX;
            const dy = e.changedTouches[0].clientY - touchStartY;
            if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
                if (dx < 0) next(); else prev();
            }
        }, { passive: true });
    }

    setupImageFallbacks();
    calcReadingTime();
    populateAuthor();
    updateShareLinks();
    buildTableOfContents();
    setupResponsiveTables();
    setupNavigation();
    setupSocialEmbeds();
    setupGalleryCarousel();
    setupLightbox();
});
