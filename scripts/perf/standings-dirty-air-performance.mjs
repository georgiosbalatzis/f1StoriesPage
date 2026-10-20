#!/usr/bin/env node
// Serial, alternating artifact comparison for the first Dirty Air timeline revisit.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { chromium } from 'playwright-core';
import { Launcher } from 'chrome-launcher';
import { startServer, providerPayload, selectTab, ready } from './standings-interactions-qa.mjs';

const [baseline, candidate, output] = process.argv.slice(2);
assert.ok(output, 'Expected BASELINE_DIST CANDIDATE_DIST OUTPUT_DIR');
fs.mkdirSync(output, { recursive: true });
const hash = value => createHash('sha256').update(value).digest('hex');
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const metrics = async cdp => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(item => [item.name, item.value]));

function observe() {
    localStorage.setItem('f1stories-theme', 'dark');
    localStorage.setItem('f1stories-cookie-consent-v1', JSON.stringify({ essential: true, analytics: false, ts: Date.now() }));
    window.__longTasks = [];
    window.__eventTiming = [];
    new PerformanceObserver(list => window.__longTasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration })))).observe({ type: 'longtask', buffered: true });
    new PerformanceObserver(list => window.__eventTiming.push(...list.getEntries().map(e => ({ name: e.name, start: e.startTime, duration: e.duration, processingMs: e.processingEnd - e.processingStart, interactionId: e.interactionId })))).observe({ type: 'event', buffered: true, durationThreshold: 16 });
    for (const type of ['click', 'change']) document.addEventListener(type, () => {
        if (!window.__armed) return;
        window.__armed = false;
        window.__start = performance.now();
        performance.mark('interaction-start');
        requestAnimationFrame(() => requestAnimationFrame(() => {
            window.__presentedMs = performance.now() - window.__start;
            performance.mark('interaction-presented');
        }));
    }, true);
}

async function stopTrace(cdp, file) {
    const done = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
    await cdp.send('Tracing.end');
    const { stream } = await done;
    const chunks = [];
    while (true) {
        const chunk = await cdp.send('IO.read', { handle: stream });
        chunks.push(Buffer.from(chunk.data, chunk.base64Encoded ? 'base64' : 'utf8'));
        if (chunk.eof) break;
    }
    await cdp.send('IO.close', { handle: stream });
    fs.writeFileSync(file, gzipSync(Buffer.concat(chunks)));
}

async function run(browser, site, width, variant, pair) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce',
        ...(width === 390 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
    await context.addInitScript(observe);
    await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin === site.origin) return route.continue();
        if (['api.openf1.org', 'api.jolpi.ca'].includes(url.hostname)) {
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(providerPayload(url)) });
        }
        return route.abort();
    });
    const page = await context.newPage();
    const errors = [], requests = [], transfers = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => requests.push(r.url()));
    page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await cdp.send('Performance.enable');
    await cdp.send('Network.enable');
    cdp.on('Network.loadingFinished', e => transfers.push(e.encodedDataLength));
    const chartMarkup = () => page.locator('[data-dirty-air-panel="timeline"]').innerHTML();
    try {
        const loadStart = Date.now();
        await page.goto(`${site.origin}/standings/?tab=dirty-air`, { waitUntil: 'load' });
        await ready(page, 'dirty-air');
        const firstSummaryMs = Date.now() - loadStart;
        // Keep the existing delayed standings refresh outside measurement windows.
        await page.waitForTimeout(4200);
        async function measure(action) {
            await page.evaluate(() => {
                window.__armed = true; window.__presentedMs = null; window.__longTasks = []; window.__eventTiming = [];
                window.__reportBefore = document.querySelector('#dirty-air-table').firstElementChild;
                window.__timelineBefore = document.querySelector('.dirty-air-timeline-body');
            });
            const before = await metrics(cdp), requestStart = requests.length, transferStart = transfers.length;
            await action();
            await page.waitForFunction(() => window.__presentedMs !== null);
            await page.waitForTimeout(100);
            const after = await metrics(cdp);
            return { ...await page.evaluate(() => ({ presentedMs: window.__presentedMs, longTasks: window.__longTasks,
                eventTiming: window.__eventTiming, reportRetained: window.__reportBefore === document.querySelector('#dirty-air-table').firstElementChild,
                chartRetained: window.__timelineBefore === document.querySelector('.dirty-air-timeline-body') })),
                scriptMs: (after.ScriptDuration - before.ScriptDuration) * 1000,
                layoutMs: (after.LayoutDuration - before.LayoutDuration) * 1000,
                styleMs: (after.RecalcStyleDuration - before.RecalcStyleDuration) * 1000,
                taskMs: (after.TaskDuration - before.TaskDuration) * 1000,
                requests: requests.slice(requestStart), transferredBytes: transfers.slice(transferStart).reduce((sum, n) => sum + n, 0) };
        }
        const firstTimeline = await measure(() => page.locator('[data-dirty-air-view="timeline"]').click());
        const initialHash = hash(await chartMarkup());
        const segments = await page.locator('.dirty-air-timeline-segment').count();
        assert.ok(segments > 0);
        const scrollLeft = await page.locator('.dirty-air-timeline-scroll').evaluate(el => { el.scrollLeft = 123; return el.scrollLeft; });
        await selectTab(page, 'drivers');
        await page.waitForTimeout(200);
        if (pair === 0) await cdp.send('Tracing.start', { categories: 'devtools.timeline,v8.execute,blink.user_timing,disabled-by-default-devtools.timeline', transferMode: 'ReturnAsStream' });
        const revisit = await measure(() => selectTab(page, 'dirty-air'));
        if (pair === 0) await stopTrace(cdp, path.join(output, `${width}-${variant}.trace.json.gz`));
        assert.equal(hash(await chartMarkup()), initialHash, 'exact timeline markup must survive the revisit');
        const scrollAfter = await page.locator('.dirty-air-timeline-scroll').evaluate(el => el.scrollLeft);
        if (variant === 'candidate') {
            assert.ok(revisit.reportRetained && revisit.chartRetained);
            assert.equal(scrollAfter, scrollLeft);
        }
        assert.deepEqual(errors, []);
        return { width, variant, pair, firstSummaryMs, firstTimeline, revisit, initialHash, segments, scrollLeft, scrollAfter };
    } finally { await context.close(); }
}

const sites = { baseline: await startServer(path.resolve(baseline)), candidate: await startServer(path.resolve(candidate)) };
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || Launcher.getFirstInstallation() });
const results = [];
try {
    for (const width of [390, 1440]) for (let pair = 0; pair < 5; pair++) {
        for (const variant of pair % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate']) {
            const result = await run(browser, sites[variant], width, variant, pair);
            results.push(result);
            console.log(JSON.stringify({ width, pair, variant, presentedMs: result.revisit.presentedMs, firstTimelineMs: result.firstTimeline.presentedMs }));
        }
    }
    assert.equal(new Set(results.map(r => r.initialHash)).size, 1, 'identical chart markup across widths and variants');
    const summary = [];
    for (const width of [390, 1440]) for (const variant of ['baseline', 'candidate']) {
        const rows = results.filter(r => r.width === width && r.variant === variant);
        const entry = { width, variant, firstSummaryMs: median(rows.map(r => r.firstSummaryMs)), firstTimelineMs: median(rows.map(r => r.firstTimeline.presentedMs)) };
        for (const metric of ['presentedMs', 'scriptMs', 'layoutMs', 'styleMs', 'taskMs', 'transferredBytes']) entry[metric] = median(rows.map(r => r.revisit[metric]));
        entry.longTasks = rows.flatMap(r => r.revisit.longTasks).length;
        summary.push(entry);
    }
    fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
    console.log(JSON.stringify(summary, null, 2));
} finally {
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ browser: browser.version(), cpuRate: 4, results }, null, 2) + '\n');
    await browser.close();
    for (const site of Object.values(sites)) { site.server.closeAllConnections(); site.server.close(); }
}
