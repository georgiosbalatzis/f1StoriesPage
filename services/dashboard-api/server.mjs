#!/usr/bin/env node
// server.mjs — authenticated API behind https://f1-stories.gr/dashboard/ (I-06A).
//
// Login with a Dashboard Access Key, a short-lived HttpOnly session cookie, logout. Every route is
// denied unless listed below; analytics routes require a session and are not enabled yet.
// See docs/intelligence/dashboard-api.md for the contract and deployment prerequisites.

import { createHash, randomBytes } from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readKeyStore, verifyKey } from './keys.mjs';

export const SESSION_TTL_MS = 30 * 60 * 1000;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_LIMIT_PER_IP = 5;
export const LOGIN_LIMIT_GLOBAL = 50;
const MAX_SESSIONS = 200;
const BODY_BYTES = 1024;
// __Host-: Secure, Path=/ and no Domain, so only the API host itself ever receives it.
const COOKIE = '__Host-f1s_dash';
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const hash = value => createHash('sha256').update(value).digest('hex');

// The page must be same-site with the API (https://<name>.f1-stories.gr): SameSite cookies are not
// sent cross-site, and third-party cookies are blocked by default in several browsers.
export function validateConfig({ allowedOrigin, keysFile }) {
    if (allowedOrigin !== 'https://f1-stories.gr') throw new Error('DASHBOARD_ALLOWED_ORIGIN must be https://f1-stories.gr');
    if (!keysFile) throw new Error('DASHBOARD_KEYS_FILE is required');
    return { allowedOrigin, keysFile };
}

function fixedWindow(limit) {
    const windows = new Map();
    return function allow(id, now) {
        if (windows.size > 10000) for (const [key, entry] of windows) if (entry.resetAt <= now) windows.delete(key);
        const entry = windows.get(id);
        if (!entry || entry.resetAt <= now) {
            windows.set(id, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
            return 0;
        }
        entry.count += 1;
        return entry.count > limit ? Math.ceil((entry.resetAt - now) / 1000) : 0;
    };
}

// shortcut: rightmost X-Forwarded-For hop is the client only when Cloud Run is reached directly
// (domain mapping); behind a load balancer it is the balancer, so the per-IP limit becomes global.
function clientIp(req) {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',').map(part => part.trim()).filter(Boolean);
    return forwarded.at(-1) || req.socket.remoteAddress || 'unknown';
}

function readCookie(req) {
    for (const part of String(req.headers.cookie || '').split(';')) {
        const [name, ...value] = part.trim().split('=');
        if (name === COOKIE) return value.join('=');
    }
    return '';
}

async function readJson(req) {
    if (String(req.headers['content-type'] || '').split(';')[0].trim() !== 'application/json') return { status: 415 };
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
        size += chunk.length;
        if (size > BODY_BYTES) return { status: 413 };
        chunks.push(chunk);
    }
    try {
        return { body: JSON.parse(Buffer.concat(chunks).toString('utf8')) };
    } catch {
        return { status: 400 };
    }
}

export function createDashboardServer(options, { now = Date.now } = {}) {
    const { allowedOrigin, keysFile } = validateConfig(options);
    // shortcut: sessions and rate limits live in this process, so deploy with max-instances=1;
    // a restart signs everyone out. Move both to a shared store before scaling out.
    const sessions = new Map();
    const ipLimit = fixedWindow(LOGIN_LIMIT_PER_IP);
    const globalLimit = fixedWindow(LOGIN_LIMIT_GLOBAL);

    // The session's key is re-checked on every request, so revoking a key ends its sessions at once.
    function currentSession(req) {
        const token = readCookie(req);
        if (!TOKEN_PATTERN.test(token)) return null;
        const id = hash(token);
        const session = sessions.get(id);
        if (!session) return null;
        const record = readKeyStore(keysFile).get(session.keyId);
        if (session.expiresAt <= now() || !record || record.revoked) {
            sessions.delete(id);
            return null;
        }
        return { id, ...session, label: record.label };
    }

    function createSession(keyId) {
        const time = now();
        for (const [id, session] of sessions) if (session.expiresAt <= time) sessions.delete(id);
        if (sessions.size >= MAX_SESSIONS) return null;
        const token = randomBytes(32).toString('base64url');
        const session = { keyId, expiresAt: time + SESSION_TTL_MS };
        sessions.set(hash(token), session);
        return { token, ...session };
    }

    const server = http.createServer(async (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
        res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Strict-Transport-Security', 'max-age=31536000');
        res.setHeader('Vary', 'Origin');
        const send = (status, value, headers = {}) => {
            res.writeHead(status, value === undefined ? headers : { 'Content-Type': 'application/json; charset=utf-8', ...headers });
            res.end(value === undefined ? undefined : JSON.stringify(value));
        };
        const pathname = String(req.url || '').split('?')[0];

        if (pathname === '/healthz' && req.method === 'GET') return send(200, { ok: true });

        // Browsers send Origin on every cross-origin fetch; anything else is not the dashboard page.
        const fetchSite = req.headers['sec-fetch-site'];
        if (req.headers.origin !== allowedOrigin || (fetchSite && fetchSite !== 'same-site')) return send(403, { error: 'origin_not_allowed' });
        res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');

        const isSession = pathname === '/api/session';
        const isAnalytics = pathname.startsWith('/api/v1/');
        if (!isSession && !isAnalytics) return send(404, { error: 'not_found' });

        if (req.method === 'OPTIONS') {
            return send(204, undefined, {
                'Access-Control-Allow-Methods': isSession ? 'GET, POST, DELETE' : 'GET',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '600'
            });
        }

        if (isAnalytics) {
            if (req.method !== 'GET') return send(405, { error: 'method_not_allowed' });
            if (!currentSession(req)) return send(401, { error: 'unauthenticated' });
            // Fail closed until the reviewed report endpoints and the BigQuery identity exist.
            return send(503, { error: 'analytics_not_enabled' });
        }

        if (req.method === 'GET') {
            const session = currentSession(req);
            return session ? send(200, { expiresAt: new Date(session.expiresAt).toISOString(), label: session.label }) : send(401, { error: 'unauthenticated' });
        }

        if (req.method === 'DELETE') {
            const session = currentSession(req);
            if (session) sessions.delete(session.id);
            return send(204, undefined, { 'Set-Cookie': `${COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0` });
        }

        if (req.method !== 'POST') return send(405, { error: 'method_not_allowed' });
        const time = now();
        const retryAfter = Math.max(ipLimit(clientIp(req), time), globalLimit('*', time));
        if (retryAfter) return send(429, { error: 'too_many_attempts' }, { 'Retry-After': String(retryAfter) });
        const { status, body } = await readJson(req);
        if (status) return send(status, { error: 'invalid_request' });
        const record = verifyKey(readKeyStore(keysFile), body && body.key);
        if (!record) return send(401, { error: 'invalid_key' });
        const session = createSession(record.id);
        if (!session) return send(503, { error: 'too_many_sessions' });
        return send(200, { expiresAt: new Date(session.expiresAt).toISOString(), label: record.label }, {
            'Set-Cookie': `${COOKIE}=${session.token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_MS / 1000}`
        });
    });
    server.requestTimeout = 10000;
    server.headersTimeout = 5000;
    server.maxHeadersCount = 40;
    return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    let server;
    try {
        server = createDashboardServer({ allowedOrigin: process.env.DASHBOARD_ALLOWED_ORIGIN, keysFile: process.env.DASHBOARD_KEYS_FILE });
    } catch (error) {
        console.error(`dashboard-api: refusing to start: ${error.message}`);
        process.exit(1);
    }
    server.listen(Number(process.env.PORT) || 8080, () => console.log(`dashboard-api listening on ${server.address().port}`));
}
