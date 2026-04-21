// JSON fetch + sessionStorage cache wrapper used by every standings tab.
//
// The cache is keyed by full URL with a shared f1s-standings: prefix so the
// slim entry and the lazy legacy chunk can see each other's writes: on a
// cold load of /standings/?tab=debrief the legacy chunk can reuse driver
// standings data that drivers-table already fetched minutes ago from another
// session.
//
// Phase 8 is planned to swap this sessionStorage layer for IndexedDB with
// TTL metadata. The function surface (readCachedResponse / writeCachedResponse
// / fetchJSON) is what the swap will keep stable — please preserve these
// names when migrating.

const FETCH_CACHE_PREFIX = 'f1s-standings:';
const FETCH_CACHE_TTL = 60 * 60 * 1000;

export function readCachedResponse(url) {
    try {
        const cached = JSON.parse(sessionStorage.getItem(FETCH_CACHE_PREFIX + url));
        if (cached && cached.ts && Date.now() - cached.ts < FETCH_CACHE_TTL) return cached.data;
    } catch (_) {}
    return null;
}

export function writeCachedResponse(url, data) {
    try {
        sessionStorage.setItem(FETCH_CACHE_PREFIX + url, JSON.stringify({ ts: Date.now(), data: data }));
    } catch (_) {}
}

export function fetchJSONWithTimeout(url, timeoutMs, fetchOptions) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    let timer = null;
    const options = fetchOptions ? Object.assign({}, fetchOptions) : {};
    if (controller) {
        timer = window.setTimeout(function() { controller.abort(); }, typeof timeoutMs === 'number' ? timeoutMs : 8000);
        if (!options.signal) options.signal = controller.signal;
    }

    return fetch(url, options).then(function(r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
    }).finally(function() {
        if (timer) window.clearTimeout(timer);
    });
}

export function fetchJSONNoCache(url, timeoutMs) {
    return fetchJSONWithTimeout(url, timeoutMs, { cache: 'no-store' });
}

export function fetchJSON(url) {
    const cached = readCachedResponse(url);
    if (cached) return Promise.resolve(cached);

    return fetchJSONNoCache(url).then(function(data) {
        writeCachedResponse(url, data);
        return data;
    });
}

export function delay(ms) {
    return new Promise(function(resolve) { window.setTimeout(resolve, ms); });
}

// Retries only on rate-limit (HTTP 429) or aborted fetches, up to 2 extra
// attempts with 350ms * (attempt+1) backoff. Anything else rethrows so the
// caller can render an error card.
export function fetchJSONWithRetry(url, attempt) {
    return fetchJSON(url).catch(function(error) {
        const message = error && error.message ? error.message : String(error);
        if ((message.indexOf('HTTP 429') !== -1 || message.indexOf('AbortError') !== -1) && attempt < 2) {
            return delay(350 * (attempt + 1)).then(function() {
                return fetchJSONWithRetry(url, attempt + 1);
            });
        }
        throw error;
    });
}
