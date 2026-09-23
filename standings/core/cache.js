// Async standings cache backed by IndexedDB with sessionStorage fallback.
//
// Physical keys are versioned as v2:<logical-key>. When an older
// sessionStorage entry is found under the unversioned key, we migrate it
// lazily on read so warm tabs survive the rollout.

const DB_NAME = 'f1s-standings';
const STORE_NAME = 'kv';
const KEY_VERSION_PREFIX = 'v2:';
const LEGACY_FETCH_CACHE_PREFIX = 'f1s-standings:';
const DEFAULT_MAX_AGE_MS = 60 * 60 * 1000;

let dbPromise = null;
let sessionStorageAvailable = null;

function normalizeRecord(record) {
    if (!record || typeof record !== 'object') return null;
    if (typeof record.ts !== 'number') return null;
    if (Object.prototype.hasOwnProperty.call(record, 'v')) {
        return { ts: record.ts, v: record.v };
    }
    if (Object.prototype.hasOwnProperty.call(record, 'data')) {
        return { ts: record.ts, v: record.data };
    }
    return null;
}

function versionedKey(key) {
    const logicalKey = key == null ? '' : String(key);
    return logicalKey.indexOf(KEY_VERSION_PREFIX) === 0 ? logicalKey : KEY_VERSION_PREFIX + logicalKey;
}

function canUseSessionStorage() {
    if (sessionStorageAvailable != null) return sessionStorageAvailable;
    try {
        const probeKey = '__f1s-standings-cache-probe__';
        window.sessionStorage.setItem(probeKey, '1');
        window.sessionStorage.removeItem(probeKey);
        sessionStorageAvailable = true;
    } catch (_) {
        sessionStorageAvailable = false;
    }
    return sessionStorageAvailable;
}

function readSessionRecord(storageKey) {
    if (!canUseSessionStorage()) return null;
    try {
        return normalizeRecord(JSON.parse(window.sessionStorage.getItem(storageKey)));
    } catch (_) {
        return null;
    }
}

function writeSessionRecord(storageKey, record) {
    if (!canUseSessionStorage()) return;
    try {
        window.sessionStorage.setItem(storageKey, JSON.stringify(record));
    } catch (_) {}
}

function removeSessionKey(storageKey) {
    if (!canUseSessionStorage()) return;
    try {
        window.sessionStorage.removeItem(storageKey);
    } catch (_) {}
}

function sessionKeysMatching(prefixes) {
    if (!canUseSessionStorage()) return [];
    const out = [];
    for (let index = 0; index < window.sessionStorage.length; index++) {
        const key = window.sessionStorage.key(index);
        if (!key) continue;
        for (let i = 0; i < prefixes.length; i++) {
            if (key.indexOf(prefixes[i]) === 0) {
                out.push(key);
                break;
            }
        }
    }
    return out;
}

function requestToPromise(request) {
    return new Promise(function(resolve, reject) {
        request.onsuccess = function() { resolve(request.result); };
        request.onerror = function() { reject(request.error || new Error('IndexedDB request failed')); };
    });
}

function transactionToPromise(transaction) {
    return new Promise(function(resolve, reject) {
        transaction.oncomplete = function() { resolve(); };
        transaction.onerror = function() { reject(transaction.error || new Error('IndexedDB transaction failed')); };
        transaction.onabort = function() { reject(transaction.error || new Error('IndexedDB transaction aborted')); };
    });
}

function disableIndexedDB() {
    dbPromise = Promise.resolve(null);
}

function openDatabase() {
    if (dbPromise) return dbPromise;
    if (typeof indexedDB === 'undefined') {
        disableIndexedDB();
        return dbPromise;
    }

    dbPromise = new Promise(function(resolve) {
        let request = null;
        try {
            request = indexedDB.open(DB_NAME, 1);
        } catch (_) {
            resolve(null);
            return;
        }

        request.onupgradeneeded = function() {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = function() {
            const db = request.result;
            db.onversionchange = function() { db.close(); };
            resolve(db);
        };
        request.onerror = function() { resolve(null); };
        request.onblocked = function() { resolve(null); };
    }).then(function(db) {
        if (!db) disableIndexedDB();
        return db;
    });

    return dbPromise;
}

async function getRecord(storageKey) {
    const db = await openDatabase();
    if (db) {
        try {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const record = await requestToPromise(transaction.objectStore(STORE_NAME).get(storageKey));
            await transactionToPromise(transaction);
            return normalizeRecord(record);
        } catch (_) {
            disableIndexedDB();
        }
    }
    return readSessionRecord(storageKey);
}

async function setRecord(storageKey, record) {
    const normalized = normalizeRecord(record);
    if (!normalized) return;

    const db = await openDatabase();
    if (db) {
        try {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            transaction.objectStore(STORE_NAME).put(normalized, storageKey);
            await transactionToPromise(transaction);
            return;
        } catch (_) {
            disableIndexedDB();
        }
    }
    writeSessionRecord(storageKey, normalized);
}

async function deleteRecord(storageKey) {
    const db = await openDatabase();
    if (db) {
        try {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            transaction.objectStore(STORE_NAME).delete(storageKey);
            await transactionToPromise(transaction);
        } catch (_) {
            disableIndexedDB();
        }
    }
    removeSessionKey(storageKey);
}

async function clearVersionedRecords() {
    const db = await openDatabase();
    if (db) {
        try {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            transaction.objectStore(STORE_NAME).clear();
            await transactionToPromise(transaction);
        } catch (_) {
            disableIndexedDB();
        }
    }

    sessionKeysMatching([KEY_VERSION_PREFIX + LEGACY_FETCH_CACHE_PREFIX]).forEach(function(key) {
        removeSessionKey(key);
    });
}

async function purgeExpiredVersionedRecords(maxAgeMs) {
    const db = await openDatabase();
    const expiryTime = Date.now() - maxAgeMs;

    if (db) {
        try {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            await new Promise(function(resolve, reject) {
                const request = store.openCursor();
                request.onsuccess = function() {
                    const cursor = request.result;
                    if (!cursor) {
                        resolve();
                        return;
                    }
                    const record = normalizeRecord(cursor.value);
                    if (!record || record.ts < expiryTime) cursor.delete();
                    cursor.continue();
                };
                request.onerror = function() {
                    reject(request.error || new Error('IndexedDB cursor failed'));
                };
            });
            await transactionToPromise(transaction);
            return;
        } catch (_) {
            disableIndexedDB();
        }
    }

    sessionKeysMatching([KEY_VERSION_PREFIX + LEGACY_FETCH_CACHE_PREFIX]).forEach(function(key) {
        const record = readSessionRecord(key);
        if (!record || record.ts < expiryTime) removeSessionKey(key);
    });
}

function readLegacySessionRecord(logicalKey) {
    return readSessionRecord(logicalKey);
}

export async function cacheGet(key, maxAgeMs) {
    const logicalKey = key == null ? '' : String(key);
    const storageKey = versionedKey(logicalKey);
    const threshold = typeof maxAgeMs === 'number' ? maxAgeMs : DEFAULT_MAX_AGE_MS;

    const current = await getRecord(storageKey);
    if (current) {
        if (current.ts + threshold < Date.now()) {
            await deleteRecord(storageKey);
            return undefined;
        }
        return current.v;
    }

    const legacy = readLegacySessionRecord(logicalKey);
    if (!legacy) return undefined;

    if (legacy.ts + threshold < Date.now()) {
        removeSessionKey(logicalKey);
        return undefined;
    }

    await setRecord(storageKey, { ts: legacy.ts, v: legacy.v });
    removeSessionKey(logicalKey);
    return legacy.v;
}

export async function cacheSet(key, value) {
    const logicalKey = key == null ? '' : String(key);
    await setRecord(versionedKey(logicalKey), { ts: Date.now(), v: value });
    removeSessionKey(logicalKey);
}

export async function cacheDelete(key) {
    const logicalKey = key == null ? '' : String(key);
    await deleteRecord(versionedKey(logicalKey));
    removeSessionKey(logicalKey);
}

export async function cacheClear() {
    await clearVersionedRecords();
    sessionKeysMatching([LEGACY_FETCH_CACHE_PREFIX]).forEach(function(key) {
        removeSessionKey(key);
    });
}

export async function cachePurgeExpired() {
    await purgeExpiredVersionedRecords(DEFAULT_MAX_AGE_MS);
    sessionKeysMatching([LEGACY_FETCH_CACHE_PREFIX]).forEach(function(key) {
        const record = readSessionRecord(key);
        if (!record || record.ts + DEFAULT_MAX_AGE_MS < Date.now()) {
            removeSessionKey(key);
        }
    });
}
