#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..', '..');
const TOKEN_PATH = path.join(REPO_ROOT, 'scripts', 'author', 'session-token.js');

function createStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem(key) {
            return values.has(key) ? values.get(key) : null;
        },
        removeItem(key) {
            values.delete(key);
        },
        setItem(key, value) {
            values.set(key, String(value));
        }
    };
}

function loadTokenModule(sessionStorage, localStorage) {
    const context = {
        console,
        window: {
            localStorage,
            sessionStorage
        }
    };
    vm.runInNewContext(fs.readFileSync(TOKEN_PATH, 'utf8'), context, {
        filename: TOKEN_PATH
    });
    return context.window.F1S_AUTHOR_SESSION_TOKEN;
}

function testSessionOnlySetAndClear() {
    const session = createStorage();
    const local = createStorage({ 'f1stories-gh-token': 'legacy', 'f1stories-gh-token-remember': '1' });
    const api = loadTokenModule(session, local);
    const store = api.createSessionTokenStore('f1stories-gh-token');

    store.set('ghp_ascii_token');
    assert.equal(session.getItem('f1stories-gh-token'), 'ghp_ascii_token');
    assert.equal(local.getItem('f1stories-gh-token'), null);
    assert.equal(local.getItem('f1stories-gh-token-remember'), null);
    assert.equal(store.get(), 'ghp_ascii_token');

    store.clear();
    assert.equal(session.getItem('f1stories-gh-token'), null);
    assert.equal(local.getItem('f1stories-gh-token'), null);
}

function testLegacyMigration() {
    const session = createStorage();
    const local = createStorage({ 'f1stories-gh-token': 'legacy_ascii', 'f1stories-gh-token-remember': '1' });
    const api = loadTokenModule(session, local);
    const store = api.createSessionTokenStore('f1stories-gh-token');

    store.migrateLegacyPersistentToken();
    assert.equal(session.getItem('f1stories-gh-token'), 'legacy_ascii');
    assert.equal(local.getItem('f1stories-gh-token'), null);
    assert.equal(local.getItem('f1stories-gh-token-remember'), null);
    assert.equal(store.get(), 'legacy_ascii');
}

function testInvalidSessionTokenIsRemoved() {
    const session = createStorage({ 'f1stories-gh-token': 'bad-token-π' });
    const local = createStorage();
    const api = loadTokenModule(session, local);
    const store = api.createSessionTokenStore('f1stories-gh-token');

    assert.equal(store.get(), '');
    assert.equal(session.getItem('f1stories-gh-token'), null);
}

function testAsciiGuard() {
    const api = loadTokenModule(createStorage(), createStorage());
    assert.equal(api.isAsciiToken('abc_123'), true);
    assert.equal(api.isAsciiToken('abc-π'), false);
}

testSessionOnlySetAndClear();
testLegacyMigration();
testInvalidSessionTokenIsRemoved();
testAsciiGuard();
console.log('author session token tests passed.');
