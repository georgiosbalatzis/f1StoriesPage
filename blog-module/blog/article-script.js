// article-script.js — Article page functionality
// Share + scroll-to-top handled by blog-fixes.js / shared-nav.js.
function setupBetCastFrameBridge(articleContent, doc, win) {
    if (!articleContent || !doc || !win) return () => {};
    const frameOrigin = src => {
        try {
            const url = new URL(src, win.location.href);
            const allowed = (url.origin === 'https://georgiosbalatzis.github.io'
                    && (url.pathname === '/BetCastVisualisation/' || url.pathname === '/BetCastVisualisation'))
                || (url.origin === 'https://f1stories.gr' && url.pathname === '/betcast/');
            const embed = url.searchParams.get('embed');
            if (!allowed || url.username || url.password || url.port || embed == null || ['0', 'false', 'no', 'off'].includes(embed.toLowerCase())) return null;
            return url;
        } catch (_) { return null; }
    };
    const frames = new Map();
    const post = (frame, type, origin, extra = {}) => {
        try { frame.contentWindow?.postMessage({ type, ...extra }, origin); } catch (_) {}
    };
    const getTheme = () => doc.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    const sendTheme = state => {
        if (!state.ready || state.url.searchParams.get('presentation') !== 'article' || state.url.searchParams.get('theme') !== 'host') return;
        post(state.frame, 'betcast:theme', state.url.origin, { theme: getTheme() });
    };
    const clearRetries = state => {
        state.timers.forEach(timer => win.clearTimeout(timer));
        state.timers = [];
    };
    const requestMeasurement = state => post(state.frame, 'betcast:measure', state.url.origin);
    const addFallbackLink = (frame, url) => {
        const parent = frame.parentElement;
        if (!parent || parent.querySelector(':scope > .betcast-embed-fallback')) return;
        const link = doc.createElement('a');
        const analysis = new URL(url.href);
        ['embed', 'presentation', 'theme'].forEach(key => analysis.searchParams.delete(key));
        link.href = analysis.toString();
        link.className = 'betcast-embed-fallback';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Άνοιγμα BetCast ↗';
        frame.insertAdjacentElement('afterend', link);
    };
    const initializeFrame = frame => {
        if (!frame || frames.has(frame.contentWindow)) return;
        const url = frameOrigin(frame.getAttribute('src') || frame.src);
        if (!url) return;
        frame.dataset.f1sBetcastManaged = 'true';
        addFallbackLink(frame, url);
        const state = { frame, url, ready: false, timers: [] };
        frames.set(frame.contentWindow, state);
        frame.addEventListener('load', () => {
            state.ready = false;
            frame.dataset.f1sBetcastReady = 'false';
            clearRetries(state);
            requestMeasurement(state);
            [250, 750, 1600, 3200].forEach(delay => state.timers.push(win.setTimeout(requestMeasurement, delay, state)));
        });
        requestMeasurement(state);
        [250, 750, 1600, 3200].forEach(delay => state.timers.push(win.setTimeout(requestMeasurement, delay, state)));
    };
    const onMessage = event => {
        const state = frames.get(event.source);
        if (!state || event.origin !== state.url.origin) return;
        const data = event.data;
        if (!data || typeof data !== 'object' || Array.isArray(data)) return;
        const keys = Object.keys(data).sort().join(',');
        if (data.type !== 'betcast:resize' || keys !== 'height,type' || typeof data.height !== 'number'
            || !Number.isFinite(data.height) || !Number.isInteger(data.height) || data.height < 100 || data.height > 12000) return;
        state.ready = true;
        state.frame.dataset.f1sBetcastReady = 'true';
        clearRetries(state);
        state.frame.style.height = `${data.height}px`;
        state.frame.style.removeProperty('min-height');
        sendTheme(state);
    };

    // Install validation before observing existing or future article frames.
    win.addEventListener('message', onMessage);
    articleContent.querySelectorAll('iframe').forEach(initializeFrame);
    const observer = win.MutationObserver ? new win.MutationObserver(records => {
        records.forEach(record => record.addedNodes.forEach(node => {
            if (node.nodeType !== 1) return;
            if (node.matches?.('iframe')) initializeFrame(node);
            node.querySelectorAll?.('iframe').forEach(initializeFrame);
        }));
    }) : null;
    observer?.observe(articleContent, { childList: true, subtree: true });
    const themeObserver = new win.MutationObserver(() => frames.forEach(sendTheme));
    themeObserver.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
        win.removeEventListener('message', onMessage);
        observer?.disconnect();
        themeObserver.disconnect();
        frames.forEach(clearRetries);
    };
}

// Size approved standings and telemetry embeds to their reported content height.
// Validate the originating frame, application URL, message shape and height.
function setupDataFrameBridge(articleContent, doc, win, kind) {
    if (!articleContent || !doc || !win) return () => {};
    const frameUrl = src => {
        try {
            const url = new URL(src, win.location.href);
            const sameSite = url.origin === 'https://f1stories.gr' || url.origin === win.location.origin;
            const embed = url.searchParams.get('embed');
            const allowed = kind === 'telemetry'
                ? ((sameSite && url.pathname === '/telemetry/')
                    || ((sameSite || url.origin === 'https://georgiosbalatzis.github.io') && url.pathname === '/f1-telemetry-dashboard/'))
                : sameSite && url.pathname.startsWith('/standings/');
            if (!allowed || url.username || url.password || embed == null
                || ['0', 'false', 'no', 'off'].includes(embed.toLowerCase())) return null;
            return url;
        } catch (_) { return null; }
    };
    const frames = new Map();
    const post = (state, type) => {
        try { state.frame.contentWindow?.postMessage({ type }, state.url.origin); } catch (_) {}
    };
    const clearRetries = state => {
        state.timers.forEach(timer => win.clearTimeout(timer));
        state.timers = [];
    };
    const requestMeasurement = state => post(state, `f1s-${kind}:measure`);
    const startMeasuring = state => {
        clearRetries(state);
        requestMeasurement(state);
        [250, 750, 1600, 3200].forEach(delay => state.timers.push(win.setTimeout(requestMeasurement, delay, state)));
    };
    const initializeFrame = frame => {
        if (!frame || !frame.contentWindow || frames.has(frame.contentWindow)) return;
        const url = frameUrl(frame.getAttribute('src') || frame.src);
        if (!url) return;
        frame.dataset[kind === 'telemetry' ? 'f1sTelemetryManaged' : 'f1sStandingsManaged'] = 'true';
        const state = { frame, url, timers: [] };
        frames.set(frame.contentWindow, state);
        frame.addEventListener('load', () => startMeasuring(state));
        startMeasuring(state);
    };
    const onMessage = event => {
        const state = frames.get(event.source);
        if (!state || event.origin !== state.url.origin) return;
        const data = event.data;
        if (!data || typeof data !== 'object' || Array.isArray(data)) return;
        const keys = Object.keys(data).sort().join(',');
        if (data.type !== `f1s-${kind}:resize` || keys !== 'height,type' || typeof data.height !== 'number'
            || !Number.isInteger(data.height) || data.height < 100 || data.height > 12000) return;
        clearRetries(state);
        state.frame.dataset[kind === 'telemetry' ? 'f1sTelemetryReady' : 'f1sStandingsReady'] = 'true';
        state.frame.setAttribute('scrolling', 'no');
        state.frame.style.height = `${data.height}px`;
        state.frame.style.removeProperty('min-height');
    };

    win.addEventListener('message', onMessage);
    articleContent.querySelectorAll('iframe').forEach(initializeFrame);
    const observer = win.MutationObserver ? new win.MutationObserver(records => {
        records.forEach(record => record.addedNodes.forEach(node => {
            if (node.nodeType !== 1) return;
            if (node.matches?.('iframe')) initializeFrame(node);
            node.querySelectorAll?.('iframe').forEach(initializeFrame);
        }));
    }) : null;
    observer?.observe(articleContent, { childList: true, subtree: true });

    return () => {
        win.removeEventListener('message', onMessage);
        observer?.disconnect();
        frames.forEach(clearRetries);
    };
}

function setupStandingsFrameBridge(articleContent, doc, win) {
    return setupDataFrameBridge(articleContent, doc, win, 'standings');
}

function setupTelemetryFrameBridge(articleContent, doc, win) {
    return setupDataFrameBridge(articleContent, doc, win, 'telemetry');
}

function setupBetCastWidgets(articleContent, doc, win) {
    if (!articleContent || !doc || !win) return () => {};
    const figures = [...articleContent.querySelectorAll('[data-f1s-betcast-widget="1"]')];
    if (!figures.length) return () => {};
    let runtimePromise;
    let observer;
    const unmounts = new Map();

    const loadRuntime = () => {
        if (runtimePromise) return runtimePromise;
        runtimePromise = win.fetch('/blog-module/widgets/betcast/manifest.json', { credentials: 'same-origin' })
            .then(response => { if (!response.ok) throw new Error('Widget manifest unavailable'); return response.json(); })
            .then(manifest => {
                if (!manifest || manifest.schemaVersion !== 1 || !Number.isSafeInteger(manifest.bytes) || manifest.bytes < 1
                    || !Number.isSafeInteger(manifest.gzipBytes) || manifest.gzipBytes < 1 || manifest.gzipBytes > manifest.bytes
                    || typeof manifest.version !== 'string' || !/^[a-f0-9]{12}$/.test(manifest.version)
                    || typeof manifest.integrity !== 'string' || !/^sha384-[A-Za-z0-9+/]+=*$/.test(manifest.integrity)
                    || manifest.entry !== `/blog-module/widgets/betcast/widget.js?v=${manifest.version}`) throw new Error('Invalid widget manifest');
                return new Promise((resolve, reject) => {
                    const script = doc.createElement('script');
                    script.src = manifest.entry;
                    script.integrity = manifest.integrity;
                    script.crossOrigin = 'anonymous';
                    script.onload = () => win.F1StoriesBetCastWidget?.mount ? resolve(win.F1StoriesBetCastWidget) : reject(new Error('Widget API missing'));
                    script.onerror = () => reject(new Error('Widget runtime failed'));
                    doc.head.append(script);
                });
            }).catch(error => { runtimePromise = null; throw error; });
        return runtimePromise;
    };

    const enhance = figure => {
        if (figure.dataset.widgetStarted === 'true') return;
        figure.dataset.widgetStarted = 'true';
        let config;
        try { config = JSON.parse(figure.dataset.f1sBetcastConfig || ''); } catch (_) { figure.dataset.widgetStarted = 'false'; return; }
        let mount;
        loadRuntime().then(api => {
            mount = doc.createElement('div');
            mount.className = 'betcast-chart-fallback__interactive';
            figure.append(mount);
            const unmount = api.mount(mount, config);
            unmounts.set(figure, unmount);
            const fallback = figure.querySelector('.betcast-chart-fallback__static');
            if (fallback) fallback.hidden = true;
        }).catch(() => { mount?.remove(); figure.dataset.widgetStarted = 'false'; });
    };

    if ('IntersectionObserver' in win) {
        observer = new win.IntersectionObserver(entries => entries.forEach(entry => {
            if (entry.isIntersecting) { observer.unobserve(entry.target); enhance(entry.target); }
        }), { rootMargin: '240px 0px' });
        figures.forEach(figure => observer.observe(figure));
    } else figures.forEach(enhance);

    return () => {
        observer?.disconnect();
        unmounts.forEach(unmount => unmount());
        unmounts.clear();
    };
}

function setupTelemetryFigures(articleContent, doc, win) {
    if (!articleContent || !doc || !win || typeof win.fetch !== 'function') return () => {};
    const figures = new Map();
    let runtimePromise = null;
    const maxPayloadBytes = 5 * 1024 * 1024;
    const fetchJson = async url => {
        const response = await win.fetch(url, { credentials: 'omit', headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('Telemetry resource unavailable');
        const length = Number(response.headers.get('content-length'));
        if (Number.isFinite(length) && length > maxPayloadBytes) throw new Error('Telemetry resource too large');
        const text = await response.text();
        if (new TextEncoder().encode(text).length > maxPayloadBytes) throw new Error('Telemetry resource too large');
        return JSON.parse(text);
    };
    const getRuntime = async manifestUrl => {
        if (!runtimePromise) runtimePromise = (async () => {
            const manifest = await fetchJson(manifestUrl);
            const entry = manifest && manifest['src/embeds/interactive-entry.tsx'];
            if (!entry || entry.isEntry !== true || typeof entry.file !== 'string' || !/^assets\/interactive-[\w-]+\.js$/.test(entry.file)) throw new Error('Interactive telemetry is not configured');
            const base = new URL('.', manifestUrl).href;
            const runtime = await import(/* webpackIgnore: true */ `${base}${entry.file}`);
            if (typeof runtime.mount !== 'function') throw new Error('Interactive telemetry is unavailable');
            return runtime;
        })().catch(error => { runtimePromise = null; throw error; });
        return runtimePromise;
    };
    const theme = () => doc.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    const mountFigure = figure => {
        if (figures.has(figure)) return;
        const dataUrl = figure.getAttribute('data-telemetry-data');
        const manifestUrl = figure.getAttribute('data-runtime-manifest');
        if (!dataUrl || !manifestUrl || !['telemetry-speed-trace', 'telemetry-throttle-brake'].includes(figure.getAttribute('data-panel'))) return;
        let data; let manifest; let page;
        try { data = new URL(dataUrl, doc.baseURI); manifest = new URL(manifestUrl, doc.baseURI); page = new URL(doc.baseURI); } catch (_) { return; }
        const localRuntime = manifest.origin === page.origin && /^\/(?:telemetry|f1-telemetry-dashboard)\/interactive\/manifest\.json$/.test(manifest.pathname);
        const approvedRuntime = new Set([
            'https://f1stories.gr/telemetry/interactive/manifest.json',
            'https://www.f1stories.gr/telemetry/interactive/manifest.json',
            'https://georgiosbalatzis.github.io/f1-telemetry-dashboard/interactive/manifest.json',
            'https://georgiosbalatzis.github.io/f1StoriesPage/f1telemetry/interactive/manifest.json'
        ]).has(manifest.href);
        if (data.origin !== page.origin || data.search || data.hash
            || !['http:', 'https:'].includes(data.protocol)
            || !['http:', 'https:'].includes(manifest.protocol) || manifest.username || manifest.password
            || manifest.search || manifest.hash || (!localRuntime && !approvedRuntime)) return;
        const button = doc.createElement('button');
        button.type = 'button'; button.className = 'f1-telemetry-interactive-toggle';
        button.textContent = 'Εξερεύνηση γραφήματος';
        button.setAttribute('aria-expanded', 'false');
        const status = doc.createElement('p'); status.className = 'f1-telemetry-interactive-status';
        status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
        const mountNode = doc.createElement('div'); mountNode.className = 'f1-telemetry-interactive-host'; mountNode.hidden = true;
        figure.insertBefore(button, figure.querySelector('.f1-telemetry-source') || null);
        button.insertAdjacentElement('afterend', status);
        status.insertAdjacentElement('afterend', mountNode);
        const state = { figure, button, status, mountNode, instance: null, pending: null, disposed: false, dataUrl: data.href, manifestUrl: manifest.href };
        figures.set(figure, state);
        button.addEventListener('click', async () => {
            if (state.instance) {
                state.instance.unmount(); state.instance = null; mountNode.hidden = true;
                figure.classList.remove('f1-telemetry-interactive');
                button.textContent = 'Εξερεύνηση γραφήματος'; button.setAttribute('aria-expanded', 'false'); status.textContent = '';
                button.focus(); return;
            }
            if (state.pending) return state.pending;
            button.disabled = true; button.textContent = 'Φόρτωση γραφήματος…'; status.textContent = '';
            state.pending = (async () => {
                const [runtime, saved] = await Promise.all([getRuntime(state.manifestUrl), fetchJson(state.dataUrl)]);
                if (state.disposed) return;
                if (saved.panelId !== figure.getAttribute('data-panel')) throw new Error('Telemetry panel mismatch');
                const instance = runtime.mount(mountNode, saved, { theme: theme() });
                state.instance = instance; mountNode.hidden = false;
                figure.classList.add('f1-telemetry-interactive');
                button.textContent = 'Επιστροφή στο στατικό γράφημα'; button.setAttribute('aria-expanded', 'true');
            })().catch(() => { status.textContent = 'Το διαδραστικό γράφημα δεν φόρτωσε. Μπορείτε να δοκιμάσετε ξανά ή να δείτε τη στατική εικόνα.'; })
                .finally(() => { state.pending = null; button.disabled = false; if (!state.instance) button.textContent = 'Δοκιμάστε ξανά το διαδραστικό γράφημα'; });
            return state.pending;
        });
    };
    articleContent.querySelectorAll('.f1-telemetry-figure[data-telemetry-data][data-runtime-manifest]').forEach(mountFigure);
    const contentObserver = win.MutationObserver ? new win.MutationObserver(records => records.forEach(record => {
        record.removedNodes.forEach(node => {
            if (node.nodeType !== 1) return;
            const removed = [];
            if (figures.has(node)) removed.push(node);
            node.querySelectorAll?.('.f1-telemetry-figure[data-telemetry-data][data-runtime-manifest]').forEach(figure => removed.push(figure));
            removed.forEach(figure => {
                const state = figures.get(figure);
                if (!state) return;
                state.disposed = true; state.instance?.unmount(); state.button.remove(); state.status.remove(); state.mountNode.remove(); figures.delete(figure);
            });
        });
        record.addedNodes.forEach(node => {
            if (node.nodeType !== 1) return;
            if (node.matches?.('.f1-telemetry-figure[data-telemetry-data][data-runtime-manifest]')) mountFigure(node);
            node.querySelectorAll?.('.f1-telemetry-figure[data-telemetry-data][data-runtime-manifest]').forEach(mountFigure);
        });
    })) : null;
    contentObserver?.observe(articleContent, { childList: true, subtree: true });
    const themeObserver = new win.MutationObserver(() => figures.forEach(state => state.instance?.setTheme(theme())));
    themeObserver.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
        contentObserver?.disconnect(); themeObserver.disconnect();
        figures.forEach(state => { state.disposed = true; state.instance?.unmount(); state.button.remove(); state.status.remove(); state.mountNode.remove(); });
        figures.clear(); runtimePromise = null;
    };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { setupBetCastFrameBridge, setupStandingsFrameBridge, setupTelemetryFrameBridge, setupBetCastWidgets, setupTelemetryFigures };

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', function () {
    const $ = sel => document.querySelector(sel);
    const $$ = sel => document.querySelectorAll(sel);

    // Cache article content element — queried by multiple functions
    const articleContent = $('.article-content');

    function calcReadingTime() {
        const el = $('#reading-time-value');
        if (!articleContent || !el) return;
        const words = articleContent.textContent.trim().split(/\s+/).length;
        const mins = Math.max(1, Math.ceil(words / 200));
        const label = `${mins} λεπτά ανάγνωσης`;
        el.textContent = label;
        $$('[data-reading-time]').forEach(node => { node.textContent = label; });
    }

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

    function setupArticleMiniBar() {
        const miniBar = $('#article-mini-bar');
        if (!miniBar) return;

        const header = $('.article-header');
        const shareButton = $('#article-mini-share');
        const titleEl = $('.article-title');
        const miniTitle = miniBar.querySelector('.article-mini-bar__title');
        const getShortTitle = text => {
            const clean = String(text || '').replace(/\s+/g, ' ').trim();
            if (!clean) return '';
            const split = clean.split(/[:;·–—-]/).map(part => part.trim()).filter(Boolean);
            const candidate = split[0] && split[0].length >= 12 ? split[0] : clean;
            return candidate.length > 64 ? `${candidate.slice(0, 61).trim()}…` : candidate;
        };
        const triggerShare = () => {
            const webShare = $('#web-share-btn');
            const copyLink = $('#copy-link-btn');
            if (webShare && typeof navigator.share === 'function') {
                webShare.click();
                return;
            }
            if (copyLink) copyLink.click();
        };

        if (shareButton) shareButton.addEventListener('click', triggerShare);

        let shown = null;
        let frame = 0;
        const update = () => {
            frame = 0;
            if (!header) return;
            const show = window.innerWidth <= 767 && header.getBoundingClientRect().bottom < 82;
            if (show === shown) return;
            shown = show;
            miniBar.classList.toggle('is-visible', show);
            miniBar.setAttribute('aria-hidden', String(!show));
            miniBar.inert = !show; // a hidden bar's share button must not take focus
        };
        const schedule = () => { frame = frame || requestAnimationFrame(update); };

        update();
        window.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', schedule);

        if (titleEl && miniTitle) {
            miniTitle.textContent = getShortTitle(titleEl.textContent);
        }
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
        label.textContent = 'Περιεχόμενα';
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
    function setupGalleryCarousel() {
        document.querySelectorAll('.gallery-carousel').forEach(function (carousel) {
            const slides = carousel.querySelectorAll('.gallery-slide');
            const thumbs = carousel.querySelectorAll('.gallery-thumb');
            const prevBtn = carousel.querySelector('.gallery-carousel-prev');
            const nextBtn = carousel.querySelector('.gallery-carousel-next');
            const counter = carousel.querySelector('.gallery-carousel-counter');

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
            const header = headerImage.closest('.article-header');
            const picture = headerImage.closest('picture');
            picture.tabIndex = 0;
            picture.setAttribute('role', 'button');
            picture.setAttribute('aria-label', 'Open article image');
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
    calcReadingTime();
    updateShareLinks();
    setupArticleMiniBar();
    setupBetCastFrameBridge(articleContent, document, window);
    setupStandingsFrameBridge(articleContent, document, window);
    setupTelemetryFrameBridge(articleContent, document, window);
    setupBetCastWidgets(articleContent, document, window);
    setupTelemetryFigures(articleContent, document, window);
    markAuthoredSectionNumbers();
    buildTableOfContents();
    setupResponsiveTables();
    setupNavigation();
    setupYouTubeFacades();
    setupSocialEmbeds();
    setupTyreEmbeds();
    setupGalleryCarousel();
    setupLightbox();
});
