#!/usr/bin/env node
// Browser regressions for dynamic shared-navigation scroll cues; run after build:public.
// node scripts/perf/shared-nav-cues-qa.mjs --root=dist
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { Launcher } = require('chrome-launcher');
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const root = path.resolve(repo, (process.argv.find(arg => arg.startsWith('--root=')) || '--root=dist').slice(7));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.avif': 'image/avif', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://x').pathname;
    const file = path.resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || Launcher.getFirstInstallation(), headless: true });
try {
    for (const width of [390, 768, 1440]) for (const theme of ['dark', 'light']) {
        const context = await browser.newContext({ viewport: { width, height: 844 } });
        await context.addInitScript(theme => {
            localStorage.setItem('f1stories-theme', theme);
            localStorage.setItem('f1stories-cookie-consent-v1', JSON.stringify({ ts: Date.now(), essential: true, analytics: false }));
            const query = Document.prototype.querySelectorAll;
            window.__cueScans = 0;
            Document.prototype.querySelectorAll = function (selector) {
                if (String(selector).includes('tyre-pace-chart-scroll')) window.__cueScans++;
                return query.call(this, selector);
            };
        }, theme);
        await context.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
        const page = await context.newPage();
        await page.goto(origin, { waitUntil: 'load' });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(200);
        await page.evaluate(() => {
            const fixture = document.createElement('div');
            fixture.id = 'cue-fixture';
            const scroller = document.createElement('div');
            scroller.className = 'tyre-pace-chart-scroll';
            scroller.style.cssText = 'width:220px;overflow-x:auto';
            const chart = document.createElement('div');
            chart.style.cssText = 'width:660px;height:20px';
            chart.textContent = 'chart';
            scroller.append(chart);
            fixture.append(scroller);
            document.body.append(fixture);
        });
        const fixture = page.locator('#cue-fixture');
        await fixture.locator('.horizontal-scroll-cue:not([hidden])').waitFor();
        assert.deepEqual(await fixture.locator('button').evaluateAll(buttons => buttons.map(b => b.disabled)), [true, false], 'dynamically inserted region has working cue buttons');
        const before = await page.evaluate(() => window.__cueScans);
        await page.evaluate(() => {
            const unrelated = document.createElement('div');
            unrelated.id = 'unrelated-update';
            document.body.append(unrelated);
            unrelated.textContent = 'unrelated standings update';
        });
        await page.waitForTimeout(100);
        assert.equal(await page.evaluate(() => window.__cueScans), before, 'unrelated subtree/text mutations do not scan page geometry');
        await fixture.locator('.tyre-pace-chart-scroll').evaluate(scroller => scroller.firstElementChild.replaceChildren(document.createTextNode('updated chart')));
        await page.waitForFunction(before => window.__cueScans > before, before);
        const scroller = fixture.locator('.tyre-pace-chart-scroll');
        await scroller.evaluate(node => { node.scrollLeft = node.scrollWidth; });
        await page.waitForFunction(() => document.querySelector('#cue-fixture .horizontal-scroll-cue button:last-child').disabled);
        assert.equal(await fixture.locator('button').first().isEnabled(), true, 'scroll position updates cue buttons');
        await scroller.evaluate(node => { node.style.width = '800px'; });
        await fixture.locator('.horizontal-scroll-cue[hidden]').waitFor({ state: 'attached' });
        await fixture.evaluate(node => node.remove());
        await page.waitForTimeout(100);
        assert.equal(await page.locator('#cue-fixture').count(), 0, 'removed region is cleaned up without reinsertion');
        await page.evaluate(() => { window.dispatchEvent(new Event('resize')); });
        console.log(`PASS dynamic cue insertion, unrelated mutation, descendant mutation, scroll, resize, removal: ${width}px ${theme}`);
        await context.close();
    }
} finally { await browser.close(); server.closeAllConnections(); server.close(); }
