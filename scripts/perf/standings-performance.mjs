#!/usr/bin/env node
// Compare identical public artifacts around warm Tyre Pace switches. Provider responses are frozen local fixtures.
// node scripts/perf/standings-performance.mjs BASE_DIST CANDIDATE_DIST OUTPUT_DIR
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import https from 'node:https';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { Launcher } = require('chrome-launcher');
const [baseArg, candidateArg, outputArg] = process.argv.slice(2);
if (!outputArg) throw new Error('Expected BASE_DIST CANDIDATE_DIST OUTPUT_DIR');
const baseline = path.resolve(baseArg), candidate = path.resolve(candidateArg), output = path.resolve(outputArg);
fs.mkdirSync(output, { recursive: true });
const profiles = {
    slow4g: { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 },
    fast4g: { offline: false, latency: 40, downloadThroughput: 9 * 1024 * 1024 / 8, uploadThroughput: 1.5 * 1024 * 1024 / 8 }
};
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.avif': 'image/avif', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg' };
const certDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-perf-cert-'));
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(certDir, 'key.pem'), '-out', path.join(certDir, 'cert.pem'), '-days', '1', '-subj', '/CN=localhost'], { stdio: 'ignore' });
const tls = { key: fs.readFileSync(path.join(certDir, 'key.pem')), cert: fs.readFileSync(path.join(certDir, 'cert.pem')) };
const snapshot = JSON.parse(fs.readFileSync(path.join(baseline, 'standings/standings-cache.json')));
const fixture = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/standings-2026-10-15.json.gz', import.meta.url))));
const responses = new Map(Object.values(fixture.responses).map(item => [item.url, Buffer.from(item.body)]));
function apiResponse(value) {
    if (responses.has(value)) return responses.get(value);
    const url = new URL(value);
    if (url.hostname === 'api.jolpi.ca') {
        if (/driverstandings/.test(url.pathname)) return Buffer.from(JSON.stringify(snapshot.driverStandings));
        if (/constructorstandings/.test(url.pathname)) return Buffer.from(JSON.stringify(snapshot.constructorStandings));
        if (/\/2026\.json$/.test(url.pathname)) return responses.get('https://api.jolpi.ca/ergast/f1/2026.json?limit=30');
    }
    throw new Error(`Missing provider fixture: ${value}`);
}
async function serve(root) {
    const server = https.createServer(tls, (req, res) => {
        const url = new URL(req.url, 'https://local');
        let bytes, type;
        if (url.pathname === '/__api') {
            try { bytes = apiResponse(url.searchParams.get('url')); type = 'application/json'; }
            catch (error) { res.writeHead(500, { 'Access-Control-Allow-Origin': '*' }); res.end(error.message); return; }
        } else {
            const pathname = decodeURIComponent(url.pathname).replace(/\/$/, '/index.html');
            const file = path.resolve(root, '.' + pathname);
            if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
            bytes = fs.readFileSync(file); type = mime[path.extname(file)] || 'application/octet-stream';
        }
        const gzip = /text|json|svg/.test(type);
        res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', ...(gzip ? { 'Content-Encoding': 'gzip' } : {}) });
        res.end(gzip ? zlib.gzipSync(bytes) : bytes);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    return { server, origin: 'https://127.0.0.1:' + server.address().port };
}
const INIT = () => {
    localStorage.setItem('f1stories-cookie-consent-v1', JSON.stringify({ ts: 0, essential: true, analytics: false }));
    window.__longTasks = [];
    new PerformanceObserver(list => window.__longTasks.push(...list.getEntries().map(entry => ({ start: entry.startTime, duration: entry.duration })))).observe({ type: 'longtask', buffered: true });
    window.__switches = [];
    document.addEventListener('change', event => {
        if (event.target.id !== 'standings-report-selector' || event.target.value !== 'tyre-pace') return;
        const start = performance.now();
        performance.mark('tyre-switch-start');
        requestAnimationFrame(() => requestAnimationFrame(() => {
            performance.mark('tyre-switch-presented');
            window.__switches.push(performance.now() - start);
        }));
    }, true);
};
const hash = text => createHash('sha256').update(text).digest('hex');
async function metrics(cdp) {
    return Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(item => [item.name, item.value]));
}
async function traceStop(cdp, file) {
    const complete = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
    await cdp.send('Tracing.end');
    const { stream } = await complete;
    const chunks = [];
    while (true) {
        const chunk = await cdp.send('IO.read', { handle: stream });
        chunks.push(chunk.base64Encoded ? Buffer.from(chunk.data, 'base64') : Buffer.from(chunk.data));
        if (chunk.eof) break;
    }
    await cdp.send('IO.close', { handle: stream });
    fs.writeFileSync(file, zlib.gzipSync(Buffer.concat(chunks)));
}
async function measure(browser, site, network, variant, run) {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await context.addInitScript(INIT);
    await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin === site.origin) return route.continue();
        if (['api.openf1.org', 'api.jolpi.ca'].includes(url.hostname)) return route.continue({ url: site.origin + '/__api?url=' + encodeURIComponent(url.href) });
        return route.abort();
    });
    const page = await context.newPage(), errors = [], failures = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) failures.push({ url: response.url(), status: response.status() }); });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable'); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await cdp.send('Network.emulateNetworkConditions', profiles[network]); await cdp.send('Performance.enable');
    try {
        const loadStart = Date.now();
        await page.goto(site.origin + '/standings/?tab=tyre-pace&tyreSession=11388', { waitUntil: 'load' });
        await page.waitForFunction(() => document.querySelectorAll('.tyre-pace-col').length === 22);
        const firstRenderMs = Date.now() - loadStart;
        // Let the existing 3.5 s background standings refresh finish outside the warm-switch window.
        await page.waitForTimeout(4000);
        const initial = await metrics(cdp);
        const chart = await page.locator('.tyre-pace-svg').evaluateAll(nodes => nodes.map(node => node.outerHTML).join(''));
        assert.ok(chart.includes('tyre-pace-dot'), 'measure a populated full race chart');
        if (run === 0) await cdp.send('Tracing.start', { categories: 'devtools.timeline,v8.execute,blink.user_timing,disabled-by-default-devtools.timeline', transferMode: 'ReturnAsStream' });
        const switches = [];
        for (let i = 0; i < 3; i++) {
            await page.locator('#tyre-pace-table [data-horizontal-chart-scroll]').evaluate(el => { el.scrollLeft = 160; });
            await page.selectOption('#standings-report-selector', 'drivers');
            await page.waitForTimeout(200);
            await page.evaluate(() => {
                window.__nodeBefore = document.querySelector('#tyre-pace-table').firstElementChild;
                window.__switches = []; window.__longTasks = [];
            });
            const before = await metrics(cdp);
            await page.selectOption('#standings-report-selector', 'tyre-pace');
            await page.waitForFunction(() => window.__switches.length === 1);
            await page.waitForTimeout(100);
            const after = await metrics(cdp);
            const result = await page.evaluate(() => ({ presentedMs: window.__switches[0], longTasks: window.__longTasks,
                retained: window.__nodeBefore === document.querySelector('#tyre-pace-table').firstElementChild,
                scrollLeft: document.querySelector('#tyre-pace-table [data-horizontal-chart-scroll]').scrollLeft,
                drivers: document.querySelectorAll('.tyre-pace-col').length, dots: document.querySelectorAll('.tyre-pace-dot').length,
                session: new URLSearchParams(location.search).get('tyreSession') }));
            assert.equal(result.drivers, 22); assert.equal(result.session, '11388');
            if (variant === 'candidate') assert.ok(result.retained, 'candidate must preserve the actual populated chart');
            result.scriptMs = (after.ScriptDuration - before.ScriptDuration) * 1000;
            result.layoutMs = (after.LayoutDuration - before.LayoutDuration) * 1000;
            result.taskMs = (after.TaskDuration - before.TaskDuration) * 1000;
            switches.push(result);
        }
        if (run === 0) await traceStop(cdp, path.join(output, `${network}-${variant}.trace.json.gz`));
        assert.equal(errors.length, 0, errors.join('\n'));
        assert.equal(failures.length, 0, JSON.stringify(failures));
        return { network, variant, run, firstRenderMs, initialScriptMs: initial.ScriptDuration * 1000, chartHash: hash(chart), switches };
    } finally { await context.close(); }
}
const sites = { baseline: await serve(baseline), candidate: await serve(candidate) };
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || Launcher.getFirstInstallation(), args: ['--ignore-certificate-errors'] });
const results = [];
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
try {
    for (const network of Object.keys(profiles)) {
        for (let run = 0; run < 5; run++) {
            for (const variant of run % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate']) {
                const result = await measure(browser, sites[variant], network, variant, run);
                results.push(result);
                console.log(JSON.stringify({ network, variant, run, firstRenderMs: result.firstRenderMs, scriptMs: median(result.switches.map(x => x.scriptMs)), presentedMs: median(result.switches.map(x => x.presentedMs)) }));
            }
        }
    }
    assert.equal(new Set(results.map(result => result.chartHash)).size, 1, 'baseline/candidate charts must be byte-identical');
    const summary = [];
    for (const network of Object.keys(profiles)) for (const variant of ['baseline', 'candidate']) {
        const rows = results.filter(row => row.network === network && row.variant === variant);
        summary.push({ network, variant, firstRenderMs: median(rows.map(row => row.firstRenderMs)), initialScriptMs: median(rows.map(row => row.initialScriptMs)),
            switchScriptMs: median(rows.map(row => median(row.switches.map(s => s.scriptMs)))), switchPresentedMs: median(rows.map(row => median(row.switches.map(s => s.presentedMs)))),
            switchLayoutMs: median(rows.map(row => median(row.switches.map(s => s.layoutMs)))), longTasks: rows.flatMap(row => row.switches.flatMap(s => s.longTasks)).length });
    }
    fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
} finally {
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ profiles, fixtureScope: 'Unchanged latest-race API responses; full year session list; snapshot-backed live standings', results }, null, 2));
    await browser.close(); for (const site of Object.values(sites)) site.server.close();
    fs.rmSync(certDir, { recursive: true, force: true });
}
