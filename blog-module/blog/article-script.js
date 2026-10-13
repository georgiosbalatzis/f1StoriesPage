// Managed-embed adapters (BetCast, standings, telemetry) live in article-embeds.js, which stamp-html only adds to
// articles that carry such an embed. Node tests still reach them through this module's exports.
const isCommonJs = typeof module !== 'undefined' && module.exports;
const embedAdapters = isCommonJs ? require('./article-embeds') : (typeof window !== 'undefined' && window.F1SArticleEmbeds) || {};
if (isCommonJs) module.exports = embedAdapters;
const MANAGED_EMBED_SELECTOR = 'iframe[src*="/standings/"], iframe[src*="/telemetry/"], iframe[src*="f1-telemetry-dashboard"], iframe[src*="BetCastVisualisation"], iframe[src*="/betcast/"], [data-f1s-betcast-widget], .f1-telemetry-figure[data-telemetry-data]';

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', function () {
    const $ = sel => document.querySelector(sel);
    const $$ = sel => document.querySelectorAll(sel);

    // Cache article content element — queried by multiple functions
    const articleContent = $('.article-content');

    function setupImageFallbacks() {
        document.addEventListener('error', function(event) {
            const img = event.target;
            if (!img || img.tagName !== 'IMG') return;

            const fallbackSrc = img.getAttribute('data-fallback-src');
            if (fallbackSrc) {
                img.removeAttribute('data-fallback-src');
                img.src = fallbackSrc;
            }
        }, true);
    }

    function markAuthoredSectionNumbers() {
        if (!articleContent) return;
        const numberedHeading = /^\d+[.)]\s/;
        const headings = [
            ...articleContent.querySelectorAll('h2'),
            ...articleContent.querySelectorAll(':scope > h1')
        ];

        headings.forEach(heading => {
            if (numberedHeading.test(heading.textContent.trim())) {
                heading.classList.add('has-authored-section-number');
            }
        });
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

    // THE RACE REPORT: the sector bar slides in under the masthead once the cover has gone and leaves at the
    // pit wall. It, the running order and the contents list follow the section being read; the meter is the
    // share of the body that has passed the reading line. Sections and segments are written at build time.
    function setupRaceReport() {
        const bar = $('#rr-sectorbar');
        const cover = $('[data-cover]');
        if (!bar || !cover || !articleContent) return;
        const end = $('[data-article-end]');
        const meter = bar.querySelector('[role="progressbar"]');
        const current = bar.querySelector('[data-current]');
        const segments = bar.querySelectorAll('.rr-sectorbar__segs li');
        const title = current ? current.textContent : '';
        // The build's navigable sections (race-report.js): headings with words of their own and no media.
        const sections = Array.from(articleContent.querySelectorAll(':scope > h2[id], :scope > h3[id]'))
            .filter(heading => heading.textContent.trim() && !heading.querySelector('figure, img, picture, iframe, video'));
        const links = Array.from($$('.rr-ro a'));
        let shown = null;
        let active = -2;
        let percent = -1;
        let frame = 0;

        const update = () => {
            frame = 0;
            const show = cover.getBoundingClientRect().bottom < 90 && !(end && end.getBoundingClientRect().top < window.innerHeight * 0.6);
            if (show !== shown) {
                shown = show;
                bar.classList.toggle('is-visible', show);
                bar.setAttribute('aria-hidden', String(!show));
                bar.inert = !show; // a hidden bar's share button must not take focus
                document.body.classList.toggle('rr-bar-on', show);
            }
            const body = articleContent.getBoundingClientRect();
            const read = Math.min(1, Math.max(0, (window.innerHeight * 0.35 - body.top) / Math.max(1, body.height)));
            bar.style.setProperty('--read', read.toFixed(4));
            if (meter && Math.round(read * 100) !== percent) {
                percent = Math.round(read * 100);
                meter.setAttribute('aria-valuenow', String(percent));
            }
            let now = -1;
            sections.forEach((section, index) => { if (section.getBoundingClientRect().top < window.innerHeight * 0.3) now = index; });
            if (now === active) return;
            active = now;
            if (current) current.textContent = now >= 0 ? sections[now].textContent.replace(/\s+/g, ' ').trim() : title;
            segments.forEach((segment, index) => { segment.className = index < now ? 'is-done' : index === now ? 'is-now' : ''; });
            const href = now >= 0 ? `#${sections[now].id}` : '';
            links.forEach(link => {
                if (link.getAttribute('href') === href) link.setAttribute('aria-current', 'location');
                else link.removeAttribute('aria-current');
            });
        };
        const schedule = () => { frame = frame || requestAnimationFrame(update); };
        update();
        window.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', schedule);

        // The bar's share button uses the native sheet where there is one, otherwise copies the link.
        const share = $('#rr-sectorbar-share');
        if (share) share.addEventListener('click', () => {
            const target = typeof navigator.share === 'function' ? $('#web-share-btn') : $('#copy-link-btn');
            if (target) target.click();
        });
        // Choosing a section in the phone contents list closes it.
        $$('.rr-contents a').forEach(link => link.addEventListener('click', () => {
            const details = link.closest('details');
            if (details) details.open = false;
        }));
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

    // Run `load` once, when any of `embeds` comes within 600px of the viewport.
    // ponytail: unscrolled embeds print as their link fallback (accepted trade-off, PERF-P0-03).
    function loadWhenNear(embeds, load) {
        if (!embeds.length) return;
        const observer = new IntersectionObserver(entries => {
            if (!entries.some(entry => entry.isIntersecting)) return;
            observer.disconnect();
            load();
        }, { rootMargin: '600px 0px' });
        embeds.forEach(embed => observer.observe(embed));
    }

    // YouTube facades (build/youtube-facade.js): the player loads only on click.
    function setupYouTubeFacades() {
        if (!articleContent) return;
        articleContent.addEventListener('click', event => {
            const facade = event.target.closest('.youtube-facade');
            const id = facade?.getAttribute('data-youtube-id') || '';
            if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return;
            event.preventDefault();
            const iframe = document.createElement('iframe');
            iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`;
            iframe.title = 'YouTube video player';
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
            iframe.allowFullscreen = true;
            facade.replaceWith(iframe);
            iframe.focus();
        });
    }

    // Tyre Intelligence embeds (georgiosbalatzis.github.io/Tyres/embed/…) carry no script of their own:
    // a "#dark" fragment switches them to the charcoal theme through CSS :target. Fragment changes never
    // reload the iframe, so a 3D view the reader opened survives a theme toggle.
    // Ghost Car embeds (georgiosbalatzis.github.io/ghostcar/) read the same #light / #dark fragment.
    function setupTyreEmbeds() {
        if (!articleContent) return;
        const frames = articleContent.querySelectorAll('iframe[src^="https://georgiosbalatzis.github.io/Tyres/embed/"], iframe[src^="https://georgiosbalatzis.github.io/ghostcar/"]');
        if (!frames.length) return;
        const sync = () => {
            const fragment = document.documentElement.getAttribute('data-theme') === 'light' ? '#light' : '#dark';
            frames.forEach(frame => {
                const next = frame.src.split('#')[0] + fragment;
                if (frame.src !== next) frame.src = next;
            });
        };
        sync();
        new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
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

            loadWhenNear(twitterEmbeds, () => {
                const renderTweets = () => window.twttr?.widgets?.load(articleContent);
                if (window.twttr?.widgets?.load) {
                    renderTweets();
                } else {
                    loadScriptOnce('https://platform.twitter.com/widgets.js', { charset: 'utf-8' })
                        .then(renderTweets)
                        .catch(error => console.error('Error loading X widgets:', error));
                }
            });
        }

        // Shared by the Instagram and Facebook loaders, whichever is reached first.
        let instagramReady = null;
        const loadInstagram = () => {
            if (instagramReady) return instagramReady;
            instagramReady = Promise.resolve();
            if (!instagramEmbeds.length) return instagramReady;
            const processInstagram = () => window.instgrm?.Embeds?.process?.();
            if (window.instgrm?.Embeds?.process) {
                processInstagram();
            } else {
                instagramReady = loadScriptOnce('https://www.instagram.com/embed.js')
                    .then(processInstagram)
                    .catch(error => console.error('Error loading Instagram embeds:', error));
            }
            return instagramReady;
        };
        loadWhenNear(instagramEmbeds, loadInstagram);

        loadWhenNear(threadsEmbeds, () => {
            if (document.querySelector('script[data-embed-src="https://www.threads.net/embed.js"], script[src="https://www.threads.net/embed.js"]')) return;
            loadScriptOnce('https://www.threads.net/embed.js', { charset: 'utf-8' })
                .catch(error => console.error('Error loading Threads embeds:', error));
        });

        // Instagram's embed.js does nothing once the Facebook SDK is on the page.
        loadWhenNear(facebookEmbeds, () => {
            loadInstagram()
                .then(loadFacebookSdk)
                .then(() => window.FB?.XFBML?.parse(articleContent))
                .catch(error => console.error('Error loading Facebook embeds:', error));
        });
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

            const updateIndicator = () => {
                const hasOverflow = scrollContainer.scrollWidth > scrollContainer.clientWidth + 1;
                scrollContainer.classList.toggle('has-scroll', hasOverflow);
                indicator.hidden = !hasOverflow;
                indicator.style.display = hasOverflow ? '' : 'none';
            };

            updateIndicator();

            if (typeof ResizeObserver !== 'undefined') {
                const resizeObserver = new ResizeObserver(updateIndicator);
                resizeObserver.observe(scrollContainer);
                resizeObserver.observe(table);
            } else {
                window.addEventListener('resize', updateIndicator, { passive: true });
            }
        });
    }

    // ── Gallery Carousel ────────────────────────────────────
    function setupChartScrolling() {
        document.querySelectorAll('.rr-chart__scroll').forEach(scroller => {
            // WebKit does not consistently scroll a focused horizontal region with arrow keys.
            scroller.addEventListener('keydown', event => {
                if (event.target !== scroller || scroller.scrollWidth <= scroller.clientWidth) return;
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                event.preventDefault();
                scroller.scrollLeft += event.key === 'ArrowRight' ? 64 : -64;
            });
        });
    }

    function setupGalleryCarousel() {
        document.querySelectorAll('.gallery-carousel').forEach(function (carousel) {
            const slides = carousel.querySelectorAll('.gallery-slide');
            const thumbs = carousel.querySelectorAll('.gallery-thumb');
            const prevBtn = carousel.querySelector('.gallery-carousel-prev');
            const nextBtn = carousel.querySelector('.gallery-carousel-next');
            const counter = carousel.querySelector('.gallery-carousel-counter');

            // Race Report articles show the archive as a filmstrip band (CSS hides the carousel controls):
            // every frame is visible and the strip scrolls sideways, by keyboard too.
            const strip = carousel.closest('.rr-body') && carousel.querySelector('.gallery-carousel-slides');
            if (strip) {
                carousel.removeAttribute('aria-roledescription');
                if (slides.length > 1) {
                    strip.tabIndex = 0;
                    strip.setAttribute('role', 'group');
                    strip.setAttribute('aria-label', `${slides.length} φωτογραφίες, οριζόντια κύλιση`);
                }
                return;
            }

            if (slides.length <= 1) {
                carousel.querySelectorAll('.gallery-carousel-prev, .gallery-carousel-next, .gallery-carousel-counter, .gallery-carousel-thumbs').forEach(function (control) { control.remove(); });
                carousel.removeAttribute('tabindex');
                carousel.removeAttribute('aria-roledescription');
                return;
            }

            if (!slides.length || !prevBtn || !nextBtn || !counter) return;
            prevBtn.setAttribute('aria-label', 'Προηγούμενη φωτογραφία');
            nextBtn.setAttribute('aria-label', 'Επόμενη φωτογραφία');

            let current = Math.max(0, Array.from(slides).findIndex(slide => slide.classList.contains('active')));

            function goTo(index) {
                if (index < 0 || index >= slides.length || index === current) return;
                slides[current].classList.remove('active');
                if (thumbs[current]) thumbs[current].classList.remove('active');
                current = index;
                slides[current].classList.add('active');
                if (thumbs[current]) {
                    thumbs[current].classList.add('active');
                    thumbs[current].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                }
                counter.textContent = (current + 1) + ' / ' + slides.length;
                prevBtn.disabled = current === 0;
                nextBtn.disabled = current === slides.length - 1;
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
            if (!stage) return;
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
        });
    }

    // ── Image Lightbox ───────────────────────────────────────
    function setupLightbox() {
        function getImages() {
            return Array.from(document.querySelectorAll('.article-header-img, .article-content-img'));
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
        overlay.setAttribute('aria-label', 'Προβολή φωτογραφίας');
        const closeButton = createLightboxButton('lb-close', 'Κλείσιμο', 'fa-times');
        const imageWrap = document.createElement('div');
        imageWrap.className = 'lb-img-wrap';
        const image = document.createElement('img');
        image.className = 'lb-img';
        image.alt = '';
        imageWrap.appendChild(image);
        const prevButton = createLightboxButton('lb-prev', 'Προηγούμενη φωτογραφία', 'fa-chevron-left');
        const nextButton = createLightboxButton('lb-next', 'Επόμενη φωτογραφία', 'fa-chevron-right');
        const counter = document.createElement('div');
        counter.className = 'lb-counter';
        counter.id = 'article-image-viewer-caption';
        counter.setAttribute('aria-live', 'polite');
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
        let lastTrigger = null;
        let backgroundStates = [];
        let previousOverflow = '';

        function open(index, trigger) {
            const imgs = getImages();
            if (!imgs.length) return;
            current = index;
            lastTrigger = trigger?.closest('[role="button"]') || trigger || null;
            if (lastTrigger && !lastTrigger.hasAttribute('tabindex')) lastTrigger.setAttribute('tabindex', '-1');
            update();
            overlay.classList.add('open');
            backgroundStates = Array.from(document.body.children)
                .filter(node => node !== overlay)
                .map(node => ({ node, inert: node.inert }));
            backgroundStates.forEach(({ node }) => { node.inert = true; });
            previousOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            lbClose.focus();
        }

        function close() {
            overlay.classList.remove('open');
            document.body.style.overflow = previousOverflow;
            backgroundStates.forEach(({ node, inert }) => { node.inert = inert; });
            backgroundStates = [];
            if (lastTrigger && lastTrigger.isConnected) lastTrigger.focus();
            lastTrigger = null;
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
            const disclosure = img.closest('figure')?.querySelector('.media-credit__ai');
            if (disclosure) {
                lbCounter.textContent += (lbCounter.textContent ? ' · ' : '') + disclosure.textContent;
                lbImg.setAttribute('aria-describedby', lbCounter.id);
            } else lbImg.removeAttribute('aria-describedby');
            overlay.setAttribute('aria-label', disclosure ? 'Προβολή εικονογράφησης' : 'Προβολή φωτογραφίας');
            lbPrev.disabled = current === 0;
            lbNext.disabled = current === imgs.length - 1;
        }

        function prev() { if (current > 0) { current--; update(); } }
        function next() {
            const imgs = getImages();
            if (current < imgs.length - 1) { current++; update(); }
        }

        function openImage(img, e) {
            const imgs = getImages();
            const index = imgs.indexOf(img);
            if (index === -1) return;
            e.preventDefault();
            open(index, img);
        }

        articleContent.addEventListener('click', (e) => {
            const trigger = e.target.closest('.article-content-img, .article-figure picture, .article-figure');
            if (!trigger) return;

            const img = trigger.classList && trigger.classList.contains('article-content-img')
                ? trigger
                : trigger.querySelector('.article-content-img');
            if (!img) return;

            openImage(img, e);
        });

        const headerImage = $('.article-header-img');
        if (headerImage) {
            // Race Report cover: the figure is the control (its <picture> is display: contents and cannot take focus).
            const header = headerImage.closest('.article-header, .rr-cover__media');
            const picture = headerImage.closest('.rr-cover__media') || headerImage.closest('picture');
            picture.tabIndex = 0;
            picture.setAttribute('role', 'button');
            picture.setAttribute('aria-label', picture.querySelector('.media-credit__ai') ? 'Άνοιγμα εικονογράφησης εξωφύλλου' : 'Άνοιγμα φωτογραφίας εξωφύλλου');
            header.addEventListener('click', e => {
                if (e.target.closest('a, button, .article-title, .article-edition, .article-header-byline, .article-meta')) return;
                openImage(headerImage, e);
            });
            picture.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') openImage(headerImage, e);
            });
        }

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
            if (e.key === 'Tab') {
                const controls = Array.from(overlay.querySelectorAll('button:not(:disabled)'));
                const first = controls[0], last = controls[controls.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
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
    updateShareLinks();
    setupRaceReport();
    if (embedAdapters.setupBetCastFrameBridge) {
        ['setupBetCastFrameBridge', 'setupStandingsFrameBridge', 'setupTelemetryFrameBridge', 'setupBetCastWidgets', 'setupTelemetryFigures']
            .forEach(name => embedAdapters[name](articleContent, document, window));
    } else if (articleContent && articleContent.querySelector(MANAGED_EMBED_SELECTOR)) {
        console.warn('article-embeds.js is missing: managed embeds will not resize or follow the theme.');
    }
    markAuthoredSectionNumbers();
    setupResponsiveTables();
    setupNavigation();
    setupYouTubeFacades();
    setupSocialEmbeds();
    setupTyreEmbeds();
    setupChartScrolling();
    setupGalleryCarousel();
    setupLightbox();
});
