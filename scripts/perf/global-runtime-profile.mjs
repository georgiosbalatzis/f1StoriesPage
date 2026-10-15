#!/usr/bin/env node
// Public-artifact interaction measurements. CPU/network throttles are applied through CDP.
// Run: node scripts/perf/global-runtime-profile.mjs --root=dist --output=/tmp/global-profile --runs=3
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { Launcher } = require('chrome-launcher');
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = new Map(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=')));
const root = path.resolve(repo, args.get('root') || 'dist');
const output = path.resolve(args.get('output') || '/tmp/f1-global-profile');
const runs = Number(args.get('runs') || 3);
const widths = (args.get('widths') || '390,768,1440').split(',').map(Number);
const profiles = { slow4g: { latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 }, fast4g: { latency: 40, downloadThroughput: 9 * 1024 * 1024 / 8, uploadThroughput: 1.5 * 1024 * 1024 / 8 } };
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.avif': 'image/avif', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://x').pathname;
    const file = path.resolve(root, '.' + decodeURIComponent(pathname.endsWith('/') ? pathname + 'index.html' : pathname));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
    const type = types[path.extname(file)] || 'application/octet-stream';
    let body = fs.readFileSync(file);
    const compressed = /text|json|svg/.test(type);
    if (compressed) body = zlib.gzipSync(body);
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', ...(compressed ? { 'Content-Encoding': 'gzip' } : {}) });
    res.end(body);
});
const wav = Buffer.alloc(44 + 160000, 128);
wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(8000, 28); wav.writeUInt16LE(1, 32); wav.writeUInt16LE(8, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
const results = [];
fs.mkdirSync(output, { recursive: true });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || Launcher.getFirstInstallation(), headless: true });
try {
    for (const [profileName, network] of Object.entries(profiles)) for (const width of widths) for (let run = 0; run < runs; run++) {
        const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: width < 1024, isMobile: width < 768 });
        await context.addInitScript(() => {
            localStorage.setItem('f1stories-cookie-consent-v1', JSON.stringify({ ts: Date.now(), essential: true, analytics: false }));
            // Exercise the one-second countdown path as well as ordinary shared navigation.
            const now = Date.now;
            const offset = Date.parse('2026-10-25T19:59:30Z') - now();
            Date.now = () => now() + offset;
            window.__runtime = { clicks: [], longTasks: [], events: [], frames: [], cueScans: [] };
            const query = Document.prototype.querySelectorAll;
            Document.prototype.querySelectorAll = function (selector) {
                const start = performance.now();
                const found = query.call(this, selector);
                if (String(selector).includes('tyre-pace-chart-scroll')) window.__runtime.cueScans.push({ start, duration: performance.now() - start });
                return found;
            };
            new PerformanceObserver(list => window.__runtime.longTasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration })))).observe({ type: 'longtask', buffered: true });
            new PerformanceObserver(list => window.__runtime.events.push(...list.getEntries().filter(e => e.interactionId).map(e => ({ name: e.name, start: e.startTime, duration: e.duration, inputDelay: e.processingStart - e.startTime, processing: e.processingEnd - e.processingStart, interactionId: e.interactionId })))).observe({ type: 'event', buffered: true, durationThreshold: 16 });
            document.addEventListener('click', event => {
                const entry = { target: event.target.closest('button,a')?.id || event.target.closest('button,a')?.className || event.target.tagName, start: event.timeStamp, inputDelay: performance.now() - event.timeStamp };
                window.__runtime.clicks.push(entry);
                requestAnimationFrame(() => requestAnimationFrame(() => { entry.nextPaintUpperBound = performance.now() - event.timeStamp; }));
            }, true);
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await context.route('**/*', route => {
            const url = route.request().url();
            if (url.startsWith(origin)) return route.continue();
            if (url === 'https://anchor.fm/s/101588098/podcast/rss') return route.fulfill({ contentType: 'application/rss+xml', headers: { 'access-control-allow-origin': '*' }, body: '<rss><channel><item><enclosure type="audio/mpeg" url="https://audio.f1stories.test/stream.wav"/></item></channel></rss>' });
            if (url === 'https://audio.f1stories.test/stream.wav') return route.fulfill({ contentType: 'audio/wav', headers: { 'access-control-allow-origin': '*' }, body: wav });
            return route.abort();
        });
        const cdp = await context.newCDPSession(page);
        await cdp.send('Network.enable');
        await cdp.send('Network.emulateNetworkConditions', { offline: false, ...network });
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        await cdp.send('Performance.enable');
        const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(e => [e.name, e.value]));
        await cdp.send('Profiler.enable');
        await cdp.send('Profiler.start');
        await page.goto(origin, { waitUntil: 'load' });
        await page.waitForTimeout(400);
        const load = await metrics();
        if (width < 1024) for (let i = 0; i < 3; i++) {
            await page.locator('#nav-hamburger').tap();
            if (await page.locator('#nav-hamburger').getAttribute('aria-expanded') !== 'true') throw new Error('menu did not open');
            await page.keyboard.press('Escape');
            if (await page.locator('#nav-hamburger').getAttribute('aria-expanded') !== 'false') throw new Error('Escape did not close menu');
        }
        for (let i = 0; i < 2; i++) await page.locator('.theme-toggle-nav-btn').click();
        await page.locator('.nav-audio-btn').click();
        await page.waitForFunction(() => document.querySelector('.nav-audio.is-active'));
        await page.waitForTimeout(1200);
        await page.locator('.nav-audio-btn').click();
        const beforeScroll = await metrics();
        await page.evaluate(() => {
            window.__runtime.scrolling = true;
            let prior;
            function frame(time) { if (prior) window.__runtime.frames.push(time - prior); prior = time; if (window.__runtime.scrolling) requestAnimationFrame(frame); }
            requestAnimationFrame(frame);
        });
        await cdp.send('Input.synthesizeScrollGesture', { x: Math.round(width / 2), y: 600, yDistance: -3600, speed: 1800, gestureSourceType: 'touch' });
        await page.evaluate(() => { window.__runtime.scrolling = false; });
        const afterScroll = await metrics();
        const { profile } = await cdp.send('Profiler.stop');
        const trace = await page.evaluate(() => ({ ...window.__runtime, navigation: performance.getEntriesByType('navigation')[0].toJSON(), paints: performance.getEntriesByType('paint').map(e => e.toJSON()), resources: performance.getEntriesByType('resource').map(e => ({ name: e.name.replace(location.origin, ''), transfer: e.transferSize, decoded: e.decodedBodySize })) }));
        const delta = (end, start, key) => (end[key] - start[key]) * 1000;
        const result = { profileName, width, run, loadScriptMs: load.ScriptDuration * 1000, interactionScriptMs: delta(afterScroll, load, 'ScriptDuration'), scrollScriptMs: delta(afterScroll, beforeScroll, 'ScriptDuration'), scrollLayoutMs: delta(afterScroll, beforeScroll, 'LayoutDuration'), loadLayoutMs: load.LayoutDuration * 1000, errors, ...trace };
        results.push(result);
        fs.writeFileSync(path.join(output, `${profileName}-${width}-${run}.cpuprofile.gz`), zlib.gzipSync(JSON.stringify(profile)));
        fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
        console.log(`${profileName} ${width} #${run + 1}: load JS ${result.loadScriptMs.toFixed(1)}ms, interaction JS ${result.interactionScriptMs.toFixed(1)}ms, scroll JS ${result.scrollScriptMs.toFixed(1)}ms, long tasks ${trace.longTasks.length}`);
        await context.close();
    }
} finally { await browser.close(); server.closeAllConnections(); server.close(); }
