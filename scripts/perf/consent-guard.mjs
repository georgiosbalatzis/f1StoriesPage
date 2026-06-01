#!/usr/bin/env node
// consent-guard.mjs - verify analytics does not load before explicit opt-in.

import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const { Launcher } = require('chrome-launcher');

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const DEFAULT_ROOT = path.join(REPO_ROOT, 'dist');
const STORAGE_KEY = 'f1stories-cookie-consent-v1';
const ANALYTICS_HOST_RE = /(?:^|\.)googletagmanager\.com$|(?:^|\.)google-analytics\.com$|^analytics\.google\.com$|^region1\.google-analytics\.com$|(?:^|\.)stats\.g\.doubleclick\.net$|^unpkg\.com$/i;
const CORE_ROUTES = ['/', '/blog-module/blog/index.html', '/standings/'];
const MIME_TYPES = new Map([
    ['.avif', 'image/avif'],
    ['.css', 'text/css; charset=utf-8'],
    ['.html', 'text/html; charset=utf-8'],
    ['.ico', 'image/x-icon'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.png', 'image/png'],
    ['.svg', 'image/svg+xml; charset=utf-8'],
    ['.webmanifest', 'application/manifest+json; charset=utf-8'],
    ['.webp', 'image/webp'],
    ['.woff2', 'font/woff2'],
    ['.xml', 'application/xml; charset=utf-8']
]);

function parseArgs(argv) {
    const args = { root: process.env.CONSENT_GUARD_ROOT || DEFAULT_ROOT };
    for (let i = 2; i < argv.length; i++) {
        if (argv[i] === '--root') args.root = path.resolve(argv[++i]);
    }
    return args;
}

function isInside(root, filePath) {
    const rel = path.relative(root, filePath);
    return rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function resolveRequest(root, requestUrl) {
    const url = new URL(requestUrl, 'http://127.0.0.1');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';

    const direct = path.resolve(root, `.${pathname}`);
    if (!isInside(root, direct)) return null;
    if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;

    if (!path.extname(direct)) {
        const index = path.join(direct, 'index.html');
        if (isInside(root, index) && fs.existsSync(index) && fs.statSync(index).isFile()) return index;
    }

    return null;
}

function sendFile(res, filePath) {
    const type = MIME_TYPES.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream';
    res.writeHead(200, {
        'cache-control': 'no-store',
        'content-type': type
    });
    fs.createReadStream(filePath).pipe(res);
}

function startServer(root) {
    if (!fs.existsSync(path.join(root, 'index.html'))) {
        throw new Error(`Public artifact missing at ${path.relative(REPO_ROOT, root)}. Run npm run build:public first.`);
    }

    const server = http.createServer((req, res) => {
        if (!req.url || !['GET', 'HEAD'].includes(req.method || '')) {
            res.writeHead(405);
            res.end('Method not allowed');
            return;
        }

        const filePath = resolveRequest(root, req.url);
        if (!filePath) {
            res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
            res.end('Not found');
            return;
        }

        if (req.method === 'HEAD') {
            res.writeHead(200);
            res.end();
            return;
        }
        sendFile(res, filePath);
    });

    return new Promise((resolve, reject) => {
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            resolve({ server, origin: `http://127.0.0.1:${address.port}` });
        });
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function waitFor(predicate, timeoutMs, intervalMs = 100) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
        function tick() {
            if (predicate()) {
                resolve();
                return;
            }
            if (Date.now() - start >= timeoutMs) {
                reject(new Error('Timed out waiting for condition'));
                return;
            }
            setTimeout(tick, intervalMs);
        }
        tick();
    });
}

async function closeBrowser(browser) {
    if (!browser) return;
    const proc = typeof browser.process === 'function' ? browser.process() : null;
    try {
        await Promise.race([
            browser.close(),
            sleep(3000).then(() => {
                throw new Error('browser close timeout');
            })
        ]);
    } catch (_) {
        if (proc && !proc.killed) proc.kill('SIGKILL');
    }
}

async function closeServer(server) {
    if (!server) return;
    if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
    await Promise.race([
        new Promise(resolve => server.close(resolve)),
        sleep(2000)
    ]);
}

function getChromePath() {
    if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
    if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
    return Launcher.getFirstInstallation();
}

function isAnalyticsUrl(rawUrl) {
    try {
        const url = new URL(rawUrl);
        if (!ANALYTICS_HOST_RE.test(url.hostname)) return false;
        if (url.hostname === 'unpkg.com' && !/\/web-vitals(?:@|\/|$)/.test(url.pathname)) return false;
        return true;
    } catch (_) {
        return false;
    }
}

async function openGuardedPage(browser, origin, route) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    const analyticsRequests = [];

    await page.setCacheEnabled(false);
    await page.setRequestInterception(true);
    page.on('request', request => {
        const url = request.url();
        if (isAnalyticsUrl(url)) {
            analyticsRequests.push(url);
            request.abort('blockedbyclient').catch(() => {});
            return;
        }
        request.continue().catch(() => {});
    });

    await page.goto(new URL(route, origin).toString(), { waitUntil: 'networkidle2', timeout: 45000 });
    return { context, page, analyticsRequests };
}

async function assertNoPreConsentRequests(browser, origin, route) {
    const opened = await openGuardedPage(browser, origin, route);
    try {
        await sleep(4300);
        const consent = await opened.page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
        if (consent) {
            throw new Error(`${route}: fresh profile unexpectedly stored consent`);
        }
        if (opened.analyticsRequests.length) {
            throw new Error(`${route}: analytics request before opt-in: ${opened.analyticsRequests.join(', ')}`);
        }
        return { route, status: 'ok' };
    } finally {
        await opened.context.close();
    }
}

async function assertAcceptLoadsAnalytics(browser, origin) {
    const opened = await openGuardedPage(browser, origin, '/');
    try {
        await opened.page.waitForSelector('#accept-all', { visible: true, timeout: 10000 });
        if (opened.analyticsRequests.length) {
            throw new Error(`/: analytics request before accept: ${opened.analyticsRequests.join(', ')}`);
        }
        await opened.page.click('#accept-all');
        await waitFor(() => opened.analyticsRequests.some(url => url.includes('googletagmanager.com/gtag/js')), 5000);
        const consent = await opened.page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), STORAGE_KEY);
        if (!consent || consent.analytics !== true) {
            throw new Error('/: accept did not persist analytics consent');
        }
        return { route: '/', status: 'accept loads gtag' };
    } finally {
        await opened.context.close();
    }
}

async function assertRejectKeepsAnalyticsBlocked(browser, origin) {
    const opened = await openGuardedPage(browser, origin, '/');
    try {
        await opened.page.waitForSelector('#reject-all', { visible: true, timeout: 10000 });
        if (opened.analyticsRequests.length) {
            throw new Error(`/: analytics request before reject: ${opened.analyticsRequests.join(', ')}`);
        }
        await opened.page.click('#reject-all');
        await sleep(1200);
        const consent = await opened.page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), STORAGE_KEY);
        if (!consent || consent.analytics !== false) {
            throw new Error('/: reject did not persist denied analytics consent');
        }
        if (opened.analyticsRequests.length) {
            throw new Error(`/: analytics request after reject: ${opened.analyticsRequests.join(', ')}`);
        }
        return { route: '/', status: 'reject blocks analytics' };
    } finally {
        await opened.context.close();
    }
}

async function main() {
    const args = parseArgs(process.argv);
    const chromePath = getChromePath();
    if (!chromePath) throw new Error('Chrome not found. Set CHROME_PATH or PUPPETEER_EXECUTABLE_PATH.');

    let server;
    let browser;
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f1stories-consent-'));
    try {
        const started = await startServer(args.root);
        server = started.server;
        browser = await puppeteer.launch({
            executablePath: chromePath,
            headless: 'new',
            userDataDir,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        const rows = [];
        for (const route of CORE_ROUTES) {
            rows.push(await assertNoPreConsentRequests(browser, started.origin, route));
        }
        rows.push(await assertRejectKeepsAnalyticsBlocked(browser, started.origin));
        rows.push(await assertAcceptLoadsAnalytics(browser, started.origin));

        console.table(rows);
        console.log('Consent analytics guard passed.');
    } finally {
        await closeBrowser(browser);
        await closeServer(server);
        fs.rmSync(userDataDir, { recursive: true, force: true });
    }
}

main().catch(error => {
    console.error(error.message || error);
    process.exit(1);
});
