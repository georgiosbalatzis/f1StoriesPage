import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import { execFileSync } from 'node:child_process';
import { createHash, createPublicKey } from 'node:crypto';

export function validateOrigin(input) {
    const url = new URL(input);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash || input !== url.origin) throw new Error('Origin must be an HTTPS hostname with default port and no path');
    return url.origin;
}
export function spkiHash(key) {
    return createHash('sha256').update(createPublicKey(key).export({ type: 'spki', format: 'der' })).digest('base64');
}
export function httpsChromeFlags(host, port, hash, proxyFlags) {
    if (!/^(?=.{1,253}$)[a-z0-9.-]+$/i.test(host) || !Number.isInteger(port) || port < 1 || port > 65535 || !/^[A-Za-z0-9+/]{43}=$/.test(hash)) throw new Error('Invalid HTTPS mapping');
    // Resolver rules configure hostname denial; negative navigation checks demonstrate closed-proxy refusal, not independent resolver containment.
    // The mapping is port-specific and the proxy bypass applies only to the mapped host.
    return [`--host-resolver-rules=MAP ${host}:443 127.0.0.1:${port}, MAP * ~NOTFOUND, EXCLUDE localhost`, `--ignore-certificate-errors-spki-list=${hash}`, ...proxyFlags, `--proxy-bypass-list=<-loopback>;${host}:443;127.0.0.1;localhost;[::1]`];
}
export function articlePath(root, id) {
    if (!/^[A-Za-z0-9_-]+$/.test(id) || !fs.existsSync(path.join(root, 'blog-module', 'blog-entries', id, 'article.html'))) throw new Error('Article ID not present in site');
    return `/blog-module/blog-entries/${encodeURIComponent(id)}/article.html`;
}
export function cleanupSync(paths) {
    for (const dir of paths) fs.rmSync(dir, { recursive: true, force: true });
}
export function validateHttpsFlags(flags) {
    for (const flag of flags) {
        if (/^--(?:ignore-certificate-errors(?!-spki-list(?:=|$))|allow-insecure-localhost|disable-web-security|host-resolver-rules)(?:=|$)/i.test(flag)) throw new Error(`Unsafe HTTPS Chrome flag: ${flag}`);
    }
}
export async function startHttpsOrigin(root, origin, handler, paths) {
    const host = new URL(validateOrigin(origin)).hostname;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-https-'));
    paths?.add(dir);
    let server;
    try {
        fs.chmodSync(dir, 0o700);
        const key = path.join(dir, 'key.pem'), cert = path.join(dir, 'cert.pem');
        execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '1', '-subj', `/CN=${host}`, '-addext', `subjectAltName=DNS:${host}`], { stdio: 'ignore' });
        fs.chmodSync(key, 0o600);
        server = https.createServer({ key: fs.readFileSync(key), cert: fs.readFileSync(cert) }, handler(root));
        await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
        const port = server.address().port;
        return { server, origin, port, hash: spkiHash(fs.readFileSync(cert)), dir, close: async () => { try { await new Promise(resolve => server.close(resolve)); } finally { fs.rmSync(dir, { recursive: true, force: true }); } } };
    } catch (error) { if (server?.listening) await new Promise(resolve => server.close(resolve)); cleanupSync([dir]); paths?.delete(dir); throw error; }
}

export function requestKey(method, input) {
    const url = new URL(input);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash) throw new Error('Invalid request URL');
    const query = [...url.searchParams].sort(([ak, av], [bk, bv]) => ak < bk ? -1 : ak > bk ? 1 : av < bv ? -1 : av > bv ? 1 : 0);
    return JSON.stringify([method, url.origin, url.pathname, query]);
}

export function loadFixtures(manifestPaths) {
    const fixtures = new Map();
    for (const manifestPath of [manifestPaths].flat()) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const items = Array.isArray(manifest.fixtures) ? manifest.fixtures : Object.entries(manifest).map(([url, item]) => {
        if (!item || item.url !== url) throw new Error('Capture URL mismatch');
        if (!item.headers || Array.isArray(item.headers) || typeof item.headers !== 'object' || (item.method && item.method !== 'GET')) throw new Error('Invalid capture metadata');
        return { ...item, method: 'GET', sha256: `sha256-${item.sha256}`, headers: Object.fromEntries(Object.entries(item.headers).filter(([, value]) => value !== null)) };
    });
    for (const item of items) {
        if (item.method !== 'GET' || !Number.isInteger(item.status) || item.status < 200 || item.status > 599 || !item.headers || Array.isArray(item.headers) || typeof item.headers !== 'object' || typeof item.body !== 'string' || !/^sha256-[a-f0-9]{64}$/.test(item.sha256 || '')) throw new Error('Invalid fixture metadata');
        const key = requestKey(item.method, item.url);
        if (fixtures.has(key)) throw new Error('Duplicate fixture request');
        const body = fs.readFileSync(path.resolve(path.dirname(manifestPath), item.body));
        if (body.length > 10 * 1024 * 1024 || createHash('sha256').update(body).digest('hex') !== item.sha256.slice(7)) throw new Error('Invalid fixture body');
        const headers = Object.entries(item.headers).map(([name, value]) => {
            if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name) || typeof value !== 'string' || /[\r\n]/.test(value)) throw new Error('Invalid fixture header');
            return { name, value };
        }).filter(({ name }) => !/^(content-length|content-encoding|transfer-encoding)$/i.test(name));
        // Redirected captures replay the terminal response at the original URL; redirect timing is lost.
        fixtures.set(key, { responseCode: item.status, responseHeaders: headers, body: body.toString('base64'), ...(item.redirected ? { redirectNote: 'Terminal response replayed; redirect fidelity is not reproduced' } : {}) });
    }
    }
    return fixtures;
}

