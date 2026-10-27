// Authentication and default-deny behavior of the dashboard API. Keys are generated per run;
// no key, verifier or session token is committed.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, beforeEach, test } from 'node:test';
import { newKey, parseKeyStore, verifyKey } from '../keys.mjs';
import { createDashboardServer, LOGIN_LIMIT_GLOBAL, LOGIN_LIMIT_PER_IP, LOGIN_WINDOW_MS, SESSION_TTL_MS, validateConfig } from '../server.mjs';

const ORIGIN = 'https://f1-stories.gr';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-dashboard-'));
const keysFile = path.join(dir, 'keys.json');
let server, base, clock, owner, other, ipCounter = 0;

const writeStore = records => fs.writeFileSync(keysFile, JSON.stringify({ keys: records }));
// 'f1sdk_' + 8-character id + '_' is 15 characters; the base64url secret may itself contain '_'.
const secretOf = key => key.slice(15);

// Each call gets its own client IP unless one is given, so the per-IP limit stays out of unrelated tests.
function request(pathname, { method = 'GET', origin = ORIGIN, cookie, body, ip, headers = {} } = {}) {
    return fetch(base + pathname, {
        method,
        headers: {
            ...(origin ? { origin } : {}),
            ...(cookie ? { cookie } : {}),
            ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
            'x-forwarded-for': `203.0.113.250, ${ip || `198.51.100.${++ipCounter % 250}`}`,
            ...headers
        },
        body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
    });
}

async function login(key, options = {}) {
    const res = await request('/api/session', { method: 'POST', body: { key }, ...options });
    const setCookie = res.headers.get('set-cookie') || '';
    return { res, setCookie, cookie: setCookie.split(';')[0] };
}

before(async () => {
    owner = newKey('owner');
    other = newKey('second reader');
    server = createDashboardServer({ allowedOrigin: ORIGIN, keysFile }, { now: () => clock });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
    // A fresh window per test: rate-limit windows and sessions from earlier tests have expired.
    clock = (clock || 0) + LOGIN_WINDOW_MS + SESSION_TTL_MS;
    writeStore([owner.record, other.record]);
});

test('configuration fails closed', () => {
    assert.throws(() => validateConfig({ allowedOrigin: 'https://evil.example', keysFile }), /ALLOWED_ORIGIN/);
    assert.throws(() => validateConfig({ allowedOrigin: '*', keysFile }), /ALLOWED_ORIGIN/);
    assert.throws(() => validateConfig({ allowedOrigin: ORIGIN }), /KEYS_FILE/);
    assert.throws(() => createDashboardServer({}), /ALLOWED_ORIGIN/);
});

test('keys: only a verifier is stored, and it matches only its own secret', () => {
    const { key, record } = owner;
    assert.match(key, /^f1sdk_[a-z0-9]{8}_[A-Za-z0-9_-]{43}$/);
    assert.ok(!JSON.stringify(record).includes(secretOf(key)), 'the record must not contain the secret');
    const keys = parseKeyStore(JSON.stringify({ keys: [record] }));
    assert.equal(verifyKey(keys, key).id, record.id);
    const flipped = key.slice(0, -1) + (key.endsWith('A') ? 'B' : 'A');
    for (const bad of [flipped, other.key, '', null, `${key} `, key.toUpperCase(), { key }]) assert.equal(verifyKey(keys, bad), null);
    assert.equal(verifyKey(parseKeyStore(JSON.stringify({ keys: [{ ...record, revoked: true }] })), key), null);
    assert.throws(() => parseKeyStore(JSON.stringify({ keys: [record, record] })), /repeats/);
    assert.throws(() => parseKeyStore(JSON.stringify({ keys: [{ ...record, verifier: key }] })), /malformed/);
    assert.throws(() => parseKeyStore(JSON.stringify({ keys: [{ ...record, revoked: 'no' }] })), /malformed/);
});

test('requests without the dashboard origin are rejected before routing', async () => {
    // '' sends no Origin header at all.
    for (const origin of ['', 'https://evil.example', 'https://www.f1-stories.gr', 'http://f1-stories.gr', 'null']) {
        const res = await request('/api/session', { origin });
        assert.equal(res.status, 403, origin);
        assert.equal(res.headers.get('access-control-allow-origin'), null);
    }
    const crossSite = await request('/api/session', { headers: { 'sec-fetch-site': 'cross-site' } });
    assert.equal(crossSite.status, 403);
    const loginElsewhere = await login(owner.key, { origin: 'https://evil.example' });
    assert.equal(loginElsewhere.res.status, 403);
    assert.equal(loginElsewhere.setCookie, '');
    assert.equal((await request('/healthz', { origin: '' })).status, 200);
});

test('unauthenticated requests are denied; unknown routes do not exist', async () => {
    assert.equal((await request('/api/session')).status, 401);
    for (const pathname of ['/api/v1/reports/article-pageviews', '/api/v1/query', '/api/v1/']) {
        const res = await request(pathname);
        assert.equal(res.status, 401, pathname);
        assert.deepEqual(await res.json(), { error: 'unauthenticated' });
    }
    const forged = await request('/api/v1/reports/x', { cookie: `__Host-f1s_dash=${'A'.repeat(43)}` });
    assert.equal(forged.status, 401);
    assert.equal((await request('/api/v1/query', { method: 'POST', body: { sql: 'SELECT 1' } })).status, 405);
    for (const pathname of ['/', '/api', '/api/sessions', '/api/session/x', '/admin', '/../keys.json']) {
        assert.equal((await request(pathname)).status, 404, pathname);
    }
});

test('login rejects wrong keys and malformed requests without a cookie', async () => {
    for (const key of [other.key.replace(/_[^_]+$/, '_' + 'A'.repeat(43)), 'f1sdk_', '', 42]) {
        const { res, setCookie } = await login(key);
        assert.equal(res.status, 401);
        assert.equal(setCookie, '');
    }
    assert.equal((await request('/api/session', { method: 'POST', body: '{not json' })).status, 400);
    assert.equal((await request('/api/session', { method: 'POST', body: { key: 'x'.repeat(2000) } })).status, 413);
    const form = await request('/api/session', { method: 'POST', body: JSON.stringify({ key: owner.key }), headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    assert.equal(form.status, 415);
    assert.equal((await request('/api/session', { method: 'PUT' })).status, 405);
});

test('a valid key opens a short-lived HttpOnly session; analytics stay disabled', async () => {
    const { res, setCookie, cookie } = await login(owner.key);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), ORIGIN);
    assert.equal(res.headers.get('access-control-allow-credentials'), 'true');
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await res.json(), { expiresAt: new Date(clock + SESSION_TTL_MS).toISOString(), label: 'owner' });
    assert.match(setCookie, /^__Host-f1s_dash=[A-Za-z0-9_-]{43}; Path=\/; Secure; HttpOnly; SameSite=Strict; Max-Age=1800$/);
    assert.ok(!setCookie.includes(owner.key));

    const session = await request('/api/session', { cookie });
    assert.equal(session.status, 200);
    assert.equal((await session.json()).label, 'owner');
    const analytics = await request('/api/v1/reports/article-pageviews', { cookie });
    assert.equal(analytics.status, 503);
    assert.deepEqual(await analytics.json(), { error: 'analytics_not_enabled' });
});

test('preflight answers only the dashboard origin', async () => {
    const ok = await request('/api/session', { method: 'OPTIONS' });
    assert.equal(ok.status, 204);
    assert.equal(ok.headers.get('access-control-allow-origin'), ORIGIN);
    assert.equal(ok.headers.get('access-control-allow-headers'), 'Content-Type');
    assert.equal((await request('/api/session', { method: 'OPTIONS', origin: 'https://evil.example' })).status, 403);
});

test('logout ends the session on the server, not only in the browser', async () => {
    const { cookie } = await login(owner.key);
    const out = await request('/api/session', { method: 'DELETE', cookie });
    assert.equal(out.status, 204);
    assert.match(out.headers.get('set-cookie'), /^__Host-f1s_dash=; Path=\/; Secure; HttpOnly; SameSite=Strict; Max-Age=0$/);
    assert.equal((await request('/api/session', { cookie })).status, 401);
    assert.equal((await request('/api/v1/reports/x', { cookie })).status, 401);
});

test('sessions expire after the TTL', async () => {
    const { cookie } = await login(owner.key);
    clock += SESSION_TTL_MS - 1;
    assert.equal((await request('/api/session', { cookie })).status, 200);
    clock += 1;
    assert.equal((await request('/api/session', { cookie })).status, 401);
    clock -= 1;
    assert.equal((await request('/api/session', { cookie })).status, 401, 'an expired session is deleted, not resumed');
});

test('revoking one key ends its sessions and blocks its logins; other keys keep working', async () => {
    const mine = await login(owner.key);
    const theirs = await login(other.key);
    writeStore([{ ...owner.record, revoked: true }, other.record]);
    assert.equal((await request('/api/session', { cookie: mine.cookie })).status, 401);
    assert.equal((await login(owner.key)).res.status, 401);
    assert.equal((await request('/api/session', { cookie: theirs.cookie })).status, 200);
    writeStore([other.record]);
    assert.equal((await login(owner.key)).res.status, 401, 'a deleted record is revoked too');
});

test('rotating a key under the same id ends sessions opened with the old secret', async () => {
    const old = await login(owner.key);
    const theirs = await login(other.key);
    const fresh = newKey('owner');
    const rotated = { key: `f1sdk_${owner.record.id}_${secretOf(fresh.key)}`, record: { ...fresh.record, id: owner.record.id } };
    writeStore([rotated.record, other.record]);
    assert.equal((await request('/api/session', { cookie: old.cookie })).status, 401);
    assert.equal((await request('/api/v1/reports/x', { cookie: old.cookie })).status, 401);
    assert.equal((await login(owner.key)).res.status, 401, 'the old secret no longer logs in');
    assert.equal((await request('/api/session', { cookie: theirs.cookie })).status, 200, 'other keys are unaffected');
    const renewed = await login(rotated.key);
    assert.equal(renewed.res.status, 200);
    assert.equal((await request('/api/session', { cookie: renewed.cookie })).status, 200);
    writeStore([owner.record, other.record]);
    assert.equal((await request('/api/session', { cookie: old.cookie })).status, 401, 'rolling back does not resurrect a deleted session');
    assert.equal((await request('/api/session', { cookie: renewed.cookie })).status, 401, 'a session bound to the rotated secret ends on rollback');
});

test('an unreadable or malformed key store denies everyone', async () => {
    const { cookie } = await login(owner.key);
    fs.writeFileSync(keysFile, '{"keys": [');
    assert.equal((await request('/api/session', { cookie })).status, 401);
    assert.equal((await login(owner.key)).res.status, 401);
    fs.rmSync(keysFile);
    assert.equal((await login(owner.key)).res.status, 401);
});

test('login attempts are rate limited per client and globally', async () => {
    const ip = '192.0.2.10';
    for (let attempt = 0; attempt < LOGIN_LIMIT_PER_IP; attempt++) assert.equal((await login('wrong', { ip })).res.status, 401);
    const limited = await login(owner.key, { ip });
    assert.equal(limited.res.status, 429, 'even a valid key waits out the window');
    assert.equal(limited.setCookie, '');
    assert.ok(Number(limited.res.headers.get('retry-after')) > 0);
    assert.equal((await login(owner.key, { ip: '192.0.2.11' })).res.status, 200, 'other clients are unaffected');

    clock += LOGIN_WINDOW_MS;
    assert.equal((await login(owner.key, { ip })).res.status, 200, 'the window resets');

    clock += LOGIN_WINDOW_MS;
    for (let attempt = 0; attempt < LOGIN_LIMIT_GLOBAL; attempt++) await login('wrong');
    assert.equal((await login(owner.key)).res.status, 429, 'rotating client addresses hits the global limit');
});
