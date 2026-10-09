// article-script.js — Article page functionality
// Share + scroll-to-top handled by blog-fixes.js / shared-nav.js.
// A lazy iframe that has not navigated yet is a same-origin about:blank window: posting to it only logs a "target origin"
// warning and delivers nothing. Its load event restarts measuring, so skipping is lossless. A cross-origin (loaded) frame throws here.
const frameNotNavigated = frame => { try { return frame.contentWindow.location.href === 'about:blank'; } catch (_) { return false; } };

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
        if (frameNotNavigated(frame)) return;
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
    const post = (state, type, extra) => {
        if (frameNotNavigated(state.frame)) return;
        try { state.frame.contentWindow?.postMessage({ type, ...extra }, state.url.origin); } catch (_) {}
    };
    // Telemetry embeds cannot read this origin's theme storage: push the article theme to them.
    const sendTheme = state => {
        if (kind === 'telemetry') post(state, 'f1s-telemetry:theme', { theme: doc.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark' });
    };
    const clearRetries = state => {
        state.timers.forEach(timer => win.clearTimeout(timer));
        state.timers = [];
    };
    const requestMeasurement = state => { post(state, `f1s-${kind}:measure`); sendTheme(state); };
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
        // A first resize proves the embed's script runs, not that its theme listener is attached yet (a theme sent while the
        // frame was still loading is dropped). Telemetry frames therefore get the theme again now and keep their scheduled retries.
        // A first resize proves the embed's script runs, not that its theme listener is attached yet (a theme sent while the
        // frame was still loading is dropped). Telemetry frames therefore get the theme again now and keep their scheduled retries.
        if (kind === 'telemetry') { if (!state.alive) { state.alive = true; sendTheme(state); } } else clearRetries(state);
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
    const themeObserver = kind === 'telemetry' && win.MutationObserver ? new win.MutationObserver(() => frames.forEach(sendTheme)) : null;
    themeObserver?.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
        win.removeEventListener('message', onMessage);
        observer?.disconnect();
        themeObserver?.disconnect();
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

// Loaded only by articles that carry a managed embed (scripts/build/stamp-html.mjs adds the tag before article-script).
const articleEmbeds = { setupBetCastFrameBridge, setupStandingsFrameBridge, setupTelemetryFrameBridge, setupBetCastWidgets, setupTelemetryFigures };
if (typeof module !== 'undefined' && module.exports) module.exports = articleEmbeds;
else if (typeof window !== 'undefined') window.F1SArticleEmbeds = articleEmbeds;
