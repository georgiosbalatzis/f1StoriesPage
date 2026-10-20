#!/usr/bin/env node
// Local-only lifecycle validation. All third-party requests are fulfilled or blocked.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import puppeteer from 'puppeteer-core';
import { Launcher } from 'chrome-launcher';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const key = 'f1stories-cookie-consent-v1';
const reference = await build({ absWorkingDir: root, stdin: { contents: `
    import {onLCP,onINP,onCLS,onFCP,onTTFB} from 'web-vitals';
    window.reference=[];
    [onLCP,onINP,onCLS,onFCP,onTTFB].forEach(fn=>fn(m=>window.reference.push({name:m.name,value:m.value,rating:m.rating,nav:m.navigationType})));
`, resolveDir: root }, bundle: true, format: 'esm', write: false });
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local RUM fixture</title>
<script defer src="/scripts/analytics.min.js"></script><script defer src="/scripts/perf/web-vitals-beacon.min.js"></script>
</head><body><h1>Deterministic local RUM fixture</h1><div id="spacer"></div><p>Stable content for paint and layout shifts.</p>
<button id="work">Interaction</button><a href="/blog-module/blog-entries/second/article.html">Article navigation</a>
<script>
window.restored=false; window.hides=0; addEventListener('pagehide',()=>window.hides++); addEventListener('pageshow',e=>{window.restored=e.persisted});
window.setConsent=function(value){let c={analytics:value};localStorage.setItem('${key}',JSON.stringify(c));dispatchEvent(new CustomEvent('f1stories:cookie-consent-changed',{detail:c}))};
document.querySelector('#work').onclick=()=>{let until=performance.now()+window.workMs;while(performance.now()<until){};document.querySelector('#work').dataset.clicked=Date.now()};
window.workMs=80;
</script></body></html>`;
const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/reference.js') { res.setHeader('content-type', 'text/javascript'); res.end(reference.outputFiles[0].text); return; }
    if (pathname.startsWith('/scripts/')) {
        const file = path.join(root, pathname);
        if (!file.startsWith(root + '/') || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
        res.setHeader('content-type', 'text/javascript');
        let source = fs.readFileSync(file, 'utf8');
        if (pathname.endsWith('/web-vitals-collector.min.js')) source += '\nimport "/reference.js";';
        res.end(source); return;
    }
    if (pathname.endsWith('/slow.png')) {
        setTimeout(() => { res.setHeader('content-type', 'image/png'); res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64')); }, 350);
        return;
    }
    res.setHeader('content-type', 'text/html');
    res.end(html.replace('</body>', '<img width="1" height="1" src="/slow.png"></body>'));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({ executablePath: Launcher.getFirstInstallation(), headless: true, ignoreDefaultArgs: ['--disable-back-forward-cache'], args: ['--no-sandbox'] });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let checks = 0;
async function open(consent, route = '/') {
    const context = await browser.createBrowserContext(), page = await context.newPage();
    const requests = [], errors = [];
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.setRequestInterception(true);
    page.on('request', request => {
        requests.push(request.url());
        if (!request.url().startsWith(origin)) return request.respond({ status: 200, contentType: 'text/javascript', body: '' });
        request.continue();
    });
    page.on('pageerror', e => errors.push(e.message));
    await page.evaluateOnNewDocument((key, consent) => {
        if (consent !== null) localStorage.setItem(key, JSON.stringify({ analytics: consent }));
    }, key, consent);
    await page.bringToFront();
    await page.goto(origin + route, { waitUntil: 'load' });
    await pause(250);
    return { context, page, requests, errors };
}
async function hidden(page) {
    const other = await page.browserContext().newPage();
    await other.bringToFront(); await pause(200);
    assert.equal(await page.evaluate(() => document.visibilityState), 'hidden');
    return other;
}
async function events(page) {
    return page.evaluate(() => window.dataLayer.filter(c => c[0] === 'event' && c[1] === 'web_vital').map(c => c[2]));
}
async function referenceMatches(page, names) {
    const actual = await events(page), expected = await page.evaluate(() => window.reference);
    for (const name of names) {
        const a = actual.filter(x => x.metric_name === name).at(-1), b = expected.filter(x => x.name === name).at(-1);
        assert.ok(a, name); assert.ok(b, name);
        assert.equal(a.metric_value, b.value * (name === 'CLS' ? 1000 : 1), name);
        assert.equal(a.metric_rating, b.rating); assert.equal(a.nav_type, b.nav);
    }
}
try {
    for (const consent of [null, false]) {
        const p = await open(consent);
        assert.equal(p.requests.some(url => /googletagmanager|collector/.test(url)), false);
        assert.equal((await events(p.page)).length, 0);
        assert.deepEqual(p.errors, []); await p.context.close(); checks++;
    }
    for (const existing of [true, null]) {
        const p = await open(existing, '/blog-module/blog-entries/local/article.html');
        if (existing === null) await p.page.evaluate(() => setConsent(true));
        await p.page.waitForFunction(() => window.reference?.length > 0);
        const timing = await p.page.evaluate(() => ({
            load: performance.getEntriesByType('navigation')[0].loadEventStart,
            requests: performance.getEntriesByType('resource').filter(e => /collector|googletagmanager/.test(e.name)).map(e => e.startTime)
        }));
        assert.ok(timing.requests.length >= 2);
        assert.ok(timing.requests.every(time => time >= timing.load));
        assert.equal(p.requests.filter(url => url.includes('googletagmanager.com/gtag/js')).length, 1);
        assert.equal(p.requests.filter(url => url.includes('web-vitals-collector.min.js')).length, 1);
        const other = await hidden(p.page);
        await referenceMatches(p.page, ['CLS', 'FCP', 'TTFB', 'LCP']);
        const first = await events(p.page);
        assert.equal(first.find(x => x.metric_name === 'CLS').metric_value, 0);
        assert.equal(first.some(x => x.metric_name === 'INP'), false);
        assert.ok(first.every(x => x.measurement_coverage === (existing ? 'delayed_existing' : 'delayed_consent')));
        await p.page.bringToFront(); await pause(100);
        const count = (await events(p.page)).length;
        await other.bringToFront(); await pause(100);
        assert.equal((await events(p.page)).length, count);
        assert.deepEqual(p.errors, []); await p.context.close(); checks++;
    }
    const p = await open(true, '/blog-module/blog-entries/local/article.html');
    await p.page.waitForFunction(() => window.reference?.length > 0);
    await p.page.evaluate(() => document.querySelector('#spacer').style.height = '40px');
    await pause(250);
    await p.page.evaluate(() => document.querySelector('#spacer').style.height = '80px');
    await pause(1200);
    await p.page.evaluate(() => document.querySelector('#spacer').style.height = '90px');
    await pause(200);
    await p.page.tap('#work'); await pause(500);
    const other = await hidden(p.page);
    await referenceMatches(p.page, ['CLS', 'INP']);
    const before = await events(p.page);
    await p.page.bringToFront(); await pause(600);
    await p.page.evaluate(() => { document.querySelector('#spacer').style.height = '350px'; window.workMs = 320; });
    await pause(200); await p.page.tap('#work'); await pause(500);
    await other.bringToFront(); await pause(200);
    await referenceMatches(p.page, ['CLS', 'INP']);
    const after = await events(p.page);
    assert.ok(after.length > before.length);
    for (const metric of ['CLS','INP']) {
        const a = before.filter(e => e.metric_name === metric).at(-1), b = after.filter(e => e.metric_name === metric).at(-1);
        assert.equal(a.metric_id, b.metric_id);
        assert.ok(b.metric_revision >= a.metric_revision);
        if (b.metric_value !== a.metric_value) assert.ok(b.metric_revision > a.metric_revision);
    }
    await p.page.bringToFront();
    await Promise.all([p.page.waitForNavigation({ waitUntil: 'load' }), p.page.tap('a')]);
    await pause(200);
    await p.page.goBack({ waitUntil: 'load' }); await pause(300);
    assert.equal(await p.page.evaluate(() => window.restored), true, 'Actual BFCache restoration required');
    assert.ok(await p.page.evaluate(() => window.hides > 0));
    await other.bringToFront(); await pause(200);
    const restored = await events(p.page);
    const cls = restored.filter(e => e.metric_name === 'CLS').at(-1);
    assert.equal(cls.nav_type, 'back-forward-cache');
    assert.equal(cls.measurement_coverage, 'bfcache_observed');
    assert.notEqual(cls.metric_id, after.filter(e => e.metric_name === 'CLS').at(-1).metric_id);
    assert.equal(restored.filter(e => e.nav_type === 'back-forward-cache').some(e => e.metric_name === 'INP'), false);
    assert.equal(new Set(restored.map(e => e.metric_id + ':' + e.metric_revision)).size, restored.length);
    assert.ok(restored.every(e => Number.isFinite(e.nav_start_ms)));
    assert.ok(restored.filter(e => e.nav_type === 'back-forward-cache').every(e => e.measurement_coverage === 'bfcache_observed'));
    await p.page.bringToFront(); await p.page.evaluate(() => setConsent(false));
    const withdrawnCount = (await events(p.page)).length;
    await p.page.click('#work'); await other.bringToFront(); await pause(200);
    await p.page.bringToFront(); await p.page.evaluate(() => setConsent(true));
    await p.page.click('#work'); await other.bringToFront(); await pause(200);
    assert.equal((await events(p.page)).length, withdrawnCount);
    assert.deepEqual(p.errors, []);
    await p.context.close(); checks += 5;
    console.log(`PASS: ${checks} local browser scenarios; real background/pagehide/BFCache; official reference agrees; zero external transmissions.`);
} finally { await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
