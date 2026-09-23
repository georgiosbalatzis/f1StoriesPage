#!/usr/bin/env node
// serve-site.mjs — local preview server for the generated static site.

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..');
const HOST = process.env.PREVIEW_HOST || '127.0.0.1';
const PORT = Number(process.env.PREVIEW_PORT || 4173);

const MIME_TYPES = new Map([
    ['.avif', 'image/avif'],
    ['.css', 'text/css; charset=utf-8'],
    ['.html', 'text/html; charset=utf-8'],
    ['.ico', 'image/x-icon'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.map', 'application/json; charset=utf-8'],
    ['.png', 'image/png'],
    ['.svg', 'image/svg+xml; charset=utf-8'],
    ['.txt', 'text/plain; charset=utf-8'],
    ['.webmanifest', 'application/manifest+json; charset=utf-8'],
    ['.webp', 'image/webp'],
    ['.woff2', 'font/woff2']
]);

const BLOCKED_ROOTS = new Set(['.git', '.github', '.idea', 'dist', 'node_modules']);

function normalizeUrlPath(rawPath) {
    let decoded;
    try {
        decoded = decodeURIComponent(rawPath || '/');
    } catch (_) {
        return null;
    }
    return path.posix.normalize(decoded).replace(/^\/+/, '');
}

function sendText(res, status, body) {
    res.writeHead(status, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
    });
    res.end(body);
}

function resolveFile(urlPath) {
    const relPath = normalizeUrlPath(urlPath);
    if (relPath === null) return null;
    if (!relPath) return path.join(REPO_ROOT, 'index.html');
    if (BLOCKED_ROOTS.has(relPath.split('/')[0])) return null;

    const requested = path.resolve(REPO_ROOT, relPath);
    if (!requested.startsWith(`${REPO_ROOT}${path.sep}`)) return null;
    if (fs.existsSync(requested) && fs.statSync(requested).isFile()) return requested;
    if (!path.extname(requested) && fs.existsSync(`${requested}.html`)) return `${requested}.html`;
    if (fs.existsSync(path.join(requested, 'index.html'))) return path.join(requested, 'index.html');
    return null;
}

const server = http.createServer((req, res) => {
    if (!['GET', 'HEAD'].includes(req.method || '')) {
        sendText(res, 405, 'Method not allowed');
        return;
    }

    const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);
    const filePath = resolveFile(url.pathname);
    if (!filePath) {
        sendText(res, 404, 'Not found');
        return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
        'Content-Type': MIME_TYPES.get(ext) || 'application/octet-stream',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
    });
    if (req.method === 'HEAD') {
        res.end();
        return;
    }
    fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, HOST, () => {
    console.log(`F1 Stories preview running at http://${HOST}:${PORT}/`);
    console.log('Press Ctrl+C to stop.');
});
