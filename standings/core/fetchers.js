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

export function fetchJSONNoCacheWithRetry(url, attempt, timeoutMs) {
    return fetchJSONNoCache(url, timeoutMs).catch(function(error) {
        const message = error && error.message ? error.message : String(error);
        if ((message.indexOf('HTTP 429') !== -1 || message.indexOf('AbortError') !== -1) && attempt < 2) {
            return delay(350 * (attempt + 1)).then(function() {
                return fetchJSONNoCacheWithRetry(url, attempt + 1, timeoutMs);
            });
        }
        throw error;
    });
}

export function chunkArray(items, size) {
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}

// OpenF1 accepts at most ~8 session_key= query params per call, so tabs that
// pull cross-session data (qualifying drivers+results, lap1 gains, tyre pace)
// fan out in chunks of 8 with a 120ms gap to stay under the rate limit.
export function fetchOpenF1BySessionKeys(baseUrl, endpoint, sessionKeys, extraQuery) {
    if (!sessionKeys || !sessionKeys.length) return Promise.resolve([]);

    const chunks = chunkArray(sessionKeys, 8);
    let results = [];

    return chunks.reduce(function(chain, keys, index) {
        return chain.then(function() {
            let query = keys.map(function(sessionKey) {
                return 'session_key=' + encodeURIComponent(sessionKey);
            }).join('&');
            if (extraQuery) query += '&' + extraQuery;

            return fetchJSONWithRetry(baseUrl + '/' + endpoint + '?' + query, 0).then(function(chunk) {
                results = results.concat(chunk || []);
            });
        }).then(function() {
            if (index < chunks.length - 1) return delay(120);
        });
    }, Promise.resolve()).then(function() {
        return results;
    });
}

// OpenF1 location fan-outs need tighter chunking plus no-store retries:
// location sometimes returns HTTP 422 for large driver groups or stale slices,
// so we split by driver_number and retry narrower windows before giving up.
export function fetchOpenF1ByDriverNumbers(baseUrl, endpoint, sessionKey, driverNumbers, extraQuery) {
    if (!sessionKey || !driverNumbers || !driverNumbers.length) return Promise.resolve([]);

    const chunks = chunkArray(driverNumbers.map(String), endpoint === 'location' ? 4 : 8);
    let results = [];
    const delayMs = endpoint === 'location' ? 180 : 120;
    const loader = endpoint === 'location'
        ? function(targetURL) { return fetchJSONNoCacheWithRetry(targetURL, 0, 18000); }
        : function(targetURL) { return fetchJSONWithRetry(targetURL, 0); };

    function fetchDriverChunk(numbers, singleRetryCount) {
        let query = 'session_key=' + encodeURIComponent(sessionKey) + '&' + numbers.map(function(driverNumber) {
            return 'driver_number=' + encodeURIComponent(driverNumber);
        }).join('&');
        if (extraQuery) query += '&' + extraQuery;

        return loader(baseUrl + '/' + endpoint + '?' + query).catch(function(error) {
            const message = error && error.message ? error.message : String(error);
            if (endpoint === 'location' && message.indexOf('HTTP 422') !== -1) {
                if (numbers.length > 1) {
                    const midpoint = Math.ceil(numbers.length / 2);
                    return fetchDriverChunk(numbers.slice(0, midpoint)).then(function(left) {
                        return delay(delayMs).then(function() {
                            return fetchDriverChunk(numbers.slice(midpoint));
                        }).then(function(right) {
                            return (left || []).concat(right || []);
                        });
                    });
                }

                if ((singleRetryCount || 0) < 1) {
                    return delay(450).then(function() {
                        return fetchDriverChunk(numbers, (singleRetryCount || 0) + 1);
                    });
                }

                console.warn('Skipping ' + endpoint + ' data for driver ' + numbers[0] + ' in session ' + sessionKey + ': ' + message);
                return [];
            }
            throw error;
        });
    }

    return chunks.reduce(function(chain, numbers, index) {
        return chain.then(function() {
            return fetchDriverChunk(numbers).then(function(chunk) {
                results = results.concat(chunk || []);
            });
        }).then(function() {
            if (index < chunks.length - 1) return delay(delayMs);
        });
    }, Promise.resolve()).then(function() {
        return results;
    });
}
