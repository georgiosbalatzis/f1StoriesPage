#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..', '..');
const TOKEN_PATH = path.join(REPO_ROOT, 'scripts', 'author', 'session-token.js');
const KEY = 'f1stories-gh-token';

function createStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    const writes = [];
    return {
        writes,
        get size() { return values.size; },
        getItem(key) {
            return values.has(key) ? values.get(key) : null;
        },
        removeItem(key) {
            values.delete(key);
        },
        setItem(key, value) {
            writes.push(key);
            values.set(key, String(value));
        }
    };
}

function loadTokenModule(sessionStorage, localStorage, { framed = false } = {}) {
    const window = { localStorage, sessionStorage };
    window.self = window;
    window.top = framed ? {} : window;
    const context = { console, window };
    vm.runInNewContext(fs.readFileSync(TOKEN_PATH, 'utf8'), context, {
        filename: TOKEN_PATH
    });
    return context.window.F1S_AUTHOR_SESSION_TOKEN;
}

function testTokenStaysInMemory() {
    const session = createStorage();
    const local = createStorage();
    const store = loadTokenModule(session, local).createSessionTokenStore(KEY);

    store.set('github_pat_ascii_token');
    assert.equal(store.get(), 'github_pat_ascii_token');
    assert.equal(session.size, 0, 'token must not be written to sessionStorage');
    assert.equal(local.size, 0, 'token must not be written to localStorage');
    assert.deepEqual([...session.writes, ...local.writes], [], 'no Web Storage writes at all');

    store.clear();
    assert.equal(store.get(), '');
}

function testReloadForgetsToken() {
    const session = createStorage();
    const local = createStorage();
    loadTokenModule(session, local).createSessionTokenStore(KEY).set('github_pat_first_page');

    // A new page load gets a fresh module instance over the same storage.
    const reloaded = loadTokenModule(session, local).createSessionTokenStore(KEY);
    reloaded.adoptStoredToken();
    assert.equal(reloaded.get(), '');
}

function testStoredCopiesAreAdoptedOnceAndDeleted() {
    const session = createStorage({ [KEY]: 'session_copy' });
    const local = createStorage({ [KEY]: 'legacy_copy', [`${KEY}-remember`]: '1' });
    const store = loadTokenModule(session, local).createSessionTokenStore(KEY);

    store.adoptStoredToken();
    assert.equal(store.get(), 'session_copy', 'the newer sessionStorage copy wins');
    assert.equal(session.getItem(KEY), null);
    assert.equal(local.getItem(KEY), null);
    assert.equal(local.getItem(`${KEY}-remember`), null);

    const legacyOnly = createStorage({ [KEY]: 'legacy_ascii' });
    const legacyStore = loadTokenModule(createStorage(), legacyOnly).createSessionTokenStore(KEY);
    legacyStore.adoptStoredToken();
    assert.equal(legacyStore.get(), 'legacy_ascii');
    assert.equal(legacyOnly.getItem(KEY), null);
}

function testSetPurgesStoredCopies() {
    const session = createStorage({ [KEY]: 'stale' });
    const local = createStorage({ [KEY]: 'stale', [`${KEY}-remember`]: '1' });
    const store = loadTokenModule(session, local).createSessionTokenStore(KEY);

    store.set('fresh');
    assert.equal(session.size, 0);
    assert.equal(local.size, 0);
    assert.equal(store.get(), 'fresh');
}

function testInvalidStoredTokenIsDropped() {
    const session = createStorage({ [KEY]: 'bad-token-π' });
    const store = loadTokenModule(session, createStorage()).createSessionTokenStore(KEY);

    store.adoptStoredToken();
    assert.equal(store.get(), '');
    assert.equal(session.getItem(KEY), null);

    store.set('also-bad-π');
    assert.equal(store.get(), '');
}

function testFramedPageHoldsNoToken() {
    const session = createStorage({ [KEY]: 'stored' });
    const api = loadTokenModule(session, createStorage(), { framed: true });
    const store = api.createSessionTokenStore(KEY);

    assert.equal(api.isFramed(), true);
    store.adoptStoredToken();
    assert.equal(store.get(), '');
    assert.equal(session.getItem(KEY), null, 'a framed page still deletes stored copies');
    store.set('github_pat_typed_into_frame');
    assert.equal(store.get(), '');
}

function testAsciiGuard() {
    const api = loadTokenModule(createStorage(), createStorage());
    assert.equal(api.isAsciiToken('abc_123'), true);
    assert.equal(api.isAsciiToken('abc-π'), false);
    assert.equal(api.isFramed(), false);
}

function testNoWebStorageWritesInSource() {
    const source = fs.readFileSync(TOKEN_PATH, 'utf8');
    assert.doesNotMatch(source, /\.setItem\s*\(/, 'session-token.js must never write Web Storage');
    assert.doesNotMatch(source, /document\.cookie/, 'session-token.js must never use cookies');
}

testTokenStaysInMemory();
testReloadForgetsToken();
testStoredCopiesAreAdoptedOnceAndDeleted();
testSetPurgesStoredCopies();
testInvalidStoredTokenIsDropped();
testFramedPageHoldsNoToken();
testAsciiGuard();
testNoWebStorageWritesInSource();
console.log('author session token tests passed.');
