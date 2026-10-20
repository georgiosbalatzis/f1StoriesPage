#!/usr/bin/env node
// Paired baseline/candidate public-artifact checks in real Chrome. No external traffic.
// node scripts/perf/rum-performance.mjs BASELINE_DIST OUTPUT_JSON [PAIRS=3] [WIDTHS=390,1440] [ROUTES=all]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import zlib from 'node:zlib';
import puppeteer from 'puppeteer-core';
import { Launcher } from 'chrome-launcher';

const candidate = path.resolve('dist'), baseline = path.resolve(process.argv[2]);
const output = process.argv[3] || '/tmp/f1-rum-performance.json', pairs = Number(process.argv[4] || 3);
const posts = JSON.parse(fs.readFileSync('blog-module/home-latest.json'));
const articles = fs.readdirSync(path.join(candidate, 'blog-module/blog-entries')).filter(slug => fs.existsSync(path.join(candidate, 'blog-module/blog-entries', slug, 'article.html')));
const heavy = articles.map(slug => ({ slug, count: (fs.readFileSync(path.join(candidate, 'blog-module/blog-entries', slug, 'article.html'), 'utf8').match(/<img\b/g) || []).length })).sort((a, b) => b.count - a.count)[0];
const fixtures = Object.values(JSON.parse(zlib.gunzipSync(fs.readFileSync('scripts/perf/fixtures/standings-2026-10-15.json.gz'))).responses);
const routes = { home: '/', edition: '/blog-module/blog/index.html', latest: `/blog-module/blog-entries/${posts[0].slug}/article.html`, heavy: `/blog-module/blog-entries/${heavy.slug}/article.html`, standings: '/standings/' };
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webp': 'image/webp', '.avif': 'image/avif', '.jpg': 'image/jpeg', '.png': 'image/png' };
let active = baseline;
const server = http.createServer((req, res) => {
    let url = new URL(req.url, 'http://localhost').pathname;
    const file = path.join(active, url.endsWith('/') ? url + 'index.html' : url);
    if (!file.startsWith(active + '/') || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
    const type = mime[path.extname(file)] || 'application/octet-stream';
    const compress = /text|json|svg/.test(type);
    let body = fs.readFileSync(file);
    if (compress) body = zlib.gzipSync(body);
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store', ...(compress ? { 'content-encoding': 'gzip' } : {}) });
    res.end(body);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({ executablePath: Launcher.getFirstInstallation(), headless: true, args: ['--no-sandbox'] });
const rows = [];
try {
    for (const width of (process.argv[5] || '390,1440').split(',').map(Number)) for (const [route, url] of Object.entries(routes).filter(([name]) => !process.argv[6] || process.argv[6].split(',').includes(name))) {
        for (let pair = 0; pair < pairs; pair++) for (const variant of pair % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate']) {
            active = variant === 'baseline' ? baseline : candidate;
            const context = await browser.createBrowserContext(), page = await context.newPage();
            await page.setViewport({ width, height: 844, isMobile: width === 390, hasTouch: width === 390, deviceScaleFactor: 1 });
            await page.bringToFront();
            const cdp = await page.createCDPSession();
            await cdp.send('Network.enable');
            await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
            await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1600000 / 8, uploadThroughput: 750000 / 8, connectionType: 'cellular4g' });
            await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
            await cdp.send('Performance.enable');
            await cdp.send('Profiler.enable');
            await cdp.send('Profiler.start');
            const errors = [], thirdParty = [];
            page.on('pageerror', e => errors.push(e.message));
            await page.setRequestInterception(true);
            page.on('request', request => {
                if (request.url().startsWith(origin)) return request.continue();
                thirdParty.push(request.url());
                // GA4 transport is a local no-op; no requests reach Google.
                if (request.url().includes('googletagmanager.com/gtag/js')) return request.respond({ status: 200, contentType: 'text/javascript', body: '' });
                const fixture = fixtures.find(f => f.url === request.url());
                if (fixture) return request.respond({ status: fixture.httpStatus, contentType: 'application/json', body: fixture.body });
                return request.respond({ status: 200, contentType: 'application/json', body: '{}' });
            });
            await page.evaluateOnNewDocument(() => {
                localStorage.setItem('f1stories-cookie-consent-v1', JSON.stringify({ ts: 0, essential: true, analytics: true }));
                window.rumPerf = { lcp: 0, cls: 0, long: [] };
                let session = 0, first = 0, last = 0;
                new PerformanceObserver(list => { for (const e of list.getEntries()) rumPerf.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
                new PerformanceObserver(list => { for (const e of list.getEntries()) {
                    if (e.hadRecentInput) continue;
                    if (e.startTime - last < 1000 && e.startTime - first < 5000) session += e.value;
                    else { session = e.value; first = e.startTime; }
                    last = e.startTime; rumPerf.cls = Math.max(rumPerf.cls, session);
                } }).observe({ type: 'layout-shift', buffered: true });
                new PerformanceObserver(list => rumPerf.long.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration })))).observe({ type: 'longtask', buffered: true });
            });
            await page.goto(origin + url, { waitUntil: 'networkidle0', timeout: 90000 });
            await new Promise(resolve => setTimeout(resolve, 500));
            const { profile } = await cdp.send('Profiler.stop');
            const metrics = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
            const state = await page.evaluate(() => ({
                ...rumPerf,
                fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
                load: performance.getEntriesByType('navigation')[0].loadEventStart,
                resources: performance.getEntriesByType('resource').map(e => ({ url: e.name, start: e.startTime, end: e.responseEnd, bytes: e.transferSize }))
            }));
            const scripts = profile.nodes.filter(n => /web-vitals-(collector|beacon)/.test(n.callFrame.url));
            const ids = new Set(scripts.map(n => n.id));
            const sampledMs = profile.samples?.reduce((sum, id, i) => sum + (ids.has(id) ? profile.timeDeltas[i] / 1000 : 0), 0) || 0;
            const ga = state.resources.filter(e => /googletagmanager.com\/gtag\/js/.test(e.url));
            const collectors = state.resources.filter(e => /web-vitals-collector/.test(e.url));
            assert.equal(ga.length, 1, 'one GA download');
            if (route === 'latest' || route === 'heavy') assert.ok(ga[0].start >= state.load, 'article GA stays after load');
            if (variant === 'candidate') { assert.equal(collectors.length, 1); assert.ok(collectors[0].start >= state.load, 'collector after load'); }
            const row = { width, route, path: url, pair, variant, ...state, scriptMs: metrics.ScriptDuration * 1000, vitalsSampledMs: sampledMs, errors, thirdParty };
            rows.push(row);
            fs.writeFileSync(output, JSON.stringify({ chrome: await browser.version(), network: 'Slow 4G: 1.6Mbps down / 750kbps up / 150ms RTT', cpu: 4, heavyImages: heavy.count, rows }, null, 2));
            console.log(width, route, pair, variant, 'FCP', state.fcp?.toFixed(0), 'LCP', state.lcp.toFixed(0), 'CLS', state.cls.toFixed(4), 'vitals CPU', sampledMs.toFixed(1), 'long', state.long.length);
            await context.close();
        }
    }
} finally { await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
