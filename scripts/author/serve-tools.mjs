#!/usr/bin/env node
// serve-tools.mjs - local-only server for browser authoring tools.

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    AUTHOR_CONTENT_SECURITY_POLICY,
    authorSecurityMetaHtml
} from '../build/security-policy.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const PAGE_SOURCE_ROOT = path.join(REPO_ROOT, 'src', 'pages');
const HOST = process.env.AUTHOR_HOST || '127.0.0.1';
const PORT = Number(process.env.AUTHOR_PORT || 4179);

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
    ['.woff2', 'font/woff2'],
    ['.zip', 'application/zip']
]);

const BLOCKED_ROOTS = new Set([
    '.git',
    '.github',
    '.idea',
    'dist'
]);

function normalizeUrlPath(rawPath) {
    let decoded = '/';
    try {
        decoded = decodeURIComponent(rawPath || '/');
    } catch (_) {
        return '';
    }
    if (decoded === '/') return '';
    return path.posix.normalize(decoded).replace(/^\/+/, '');
}

function isAllowedNodeModule(relPath) {
    return relPath === 'node_modules/jszip/dist/jszip.min.js';
}

function isBlocked(relPath) {
    if (!relPath) return false;
    if (isAllowedNodeModule(relPath)) return false;
    const first = relPath.split('/')[0];
    return BLOCKED_ROOTS.has(first) || first === 'node_modules';
}

function resolveSourcePath(relPath) {
    const pagePath = path.join(PAGE_SOURCE_ROOT, relPath);
    if (fs.existsSync(pagePath)) return pagePath;
    return path.join(REPO_ROOT, relPath);
}

function sendText(res, status, body, contentType = 'text/plain; charset=utf-8') {
    res.writeHead(status, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': AUTHOR_CONTENT_SECURITY_POLICY
    });
    res.end(body);
}

function sendAuthorIndex(res) {
    sendText(res, 200, `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>F1 Stories Author Tools</title>
  <style>
    body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;padding:3rem;background:#f6f7f9;color:#15171a}
    main{max-width:720px;margin:auto}
    a{display:inline-flex;margin:.5rem .75rem .5rem 0;padding:.7rem 1rem;border:1px solid #c9ced6;border-radius:6px;background:#fff;color:#15171a;text-decoration:none;font-weight:700}
    p{line-height:1.55}
    code{background:#e9ecf1;padding:.12rem .3rem;border-radius:4px}
  </style>
</head>
<body>
  <main>
    <h1>F1 Stories Author Tools</h1>
    <p>This server is bound to <code>${HOST}</code> for local authoring. Use a fine-grained GitHub token and close the terminal when finished.</p>
    <p>
      <a href="/generate.html">Generate Article</a>
      <a href="/housekeeping.html">Housekeeping</a>
      <a href="/statistics.html">Statistics</a>
    </p>
  </main>
</body>
</html>`, 'text/html; charset=utf-8');
}

function serveFile(req, res) {
    const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);
    const relPath = normalizeUrlPath(url.pathname);

    if (!relPath) {
        sendAuthorIndex(res);
        return;
    }

    if (isBlocked(relPath)) {
        sendText(res, 403, 'Forbidden');
        return;
    }

    const absPath = path.resolve(resolveSourcePath(relPath));
    if (!absPath.startsWith(REPO_ROOT + path.sep)) {
        sendText(res, 403, 'Forbidden');
        return;
    }

    if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) {
        sendText(res, 404, 'Not found');
        return;
    }

    const ext = path.extname(absPath).toLowerCase();
    let body = fs.readFileSync(absPath, 'utf8');
    const headers = {
        'Content-Type': MIME_TYPES.get(ext) || 'application/octet-stream',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
    };
    if (ext === '.html') {
        body = body.replace(
            /<meta\s+http-equiv=["']Content-Security-Policy["'][^>]*>/i,
            authorSecurityMetaHtml('  ')
        );
        headers['Content-Security-Policy'] = AUTHOR_CONTENT_SECURITY_POLICY;
        res.writeHead(200, headers);
        res.end(body);
        return;
    }
    res.writeHead(200, headers);
    fs.createReadStream(absPath).pipe(res);
}

const server = http.createServer((req, res) => {
    if (!['GET', 'HEAD'].includes(req.method || '')) {
        sendText(res, 405, 'Method not allowed');
        return;
    }
    serveFile(req, res);
});

server.listen(PORT, HOST, () => {
    const baseUrl = `http://${HOST}:${PORT}`;
    console.log(`Author tools running at ${baseUrl}/`);
    console.log(`Generate:      ${baseUrl}/generate.html`);
    console.log(`Housekeeping:  ${baseUrl}/housekeeping.html`);
    console.log(`Statistics:    ${baseUrl}/statistics.html`);
    console.log('Press Ctrl+C to stop.');
});
