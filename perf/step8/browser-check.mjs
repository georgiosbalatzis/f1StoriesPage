// Targeted behavioral/visual checks; uses the existing public build, no rebuild required.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const baseline = process.env.STEP8_BASELINE === '1';
import { chromium } from 'playwright-core';
const root = path.join(process.cwd(), 'dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
    let file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (baseline && /article-script(?:\.min)?\.js$/.test(file)) { res.setHeader('Content-Type', 'text/javascript'); return res.end(execFileSync('git', ['show', '07ab7987:blog-module/blog/article-script.js'])); }
    if (!fs.existsSync(file)) { res.statusCode = 404; return res.end(); }
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const facts = [];
try {
for (const width of (baseline ? [390] : [390, 768, 1440])) for (const theme of (baseline ? ['dark'] : ['dark', 'light'])) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
    await context.addInitScript(theme => {
        localStorage.setItem('f1stories-theme', theme);
        localStorage.setItem('f1stories-cookie-consent-v1', JSON.stringify({ ts: Date.now(), essential: true, analytics: false }));
    }, theme);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
    await cdp.send('Performance.enable');
    for (const id of ['20250328G', '20261009W', '20261007G', '20260422G']) {
        await page.goto(`${base}/blog-module/blog-entries/${id}/article.html`, { waitUntil: 'load' });
        await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; scrollTo(0, document.querySelector('.article-content').offsetTop + 600); });
        await page.waitForTimeout(300);
        const state = await page.evaluate(() => {
            const body = document.querySelector('.article-content').getBoundingClientRect();
            const sections = [...document.querySelectorAll('.article-content > h2[id], .article-content > h3[id]')].filter(h => h.textContent.trim() && !h.querySelector('figure,img,picture,iframe,video'));
            const active = sections.filter(h => h.getBoundingClientRect().top < innerHeight * .3).at(-1);
            const bar = document.querySelector('#rr-sectorbar');
            const cover = document.querySelector('[data-cover]'); const end = document.querySelector('[data-article-end]');
            return { actual: Number(bar.querySelector('[role=progressbar]').getAttribute('aria-valuenow')),
                expected: Math.round(Math.min(1, Math.max(0, (innerHeight * .35 - body.top) / Math.max(1, body.height))) * 100),
                current: bar.querySelector('[data-current]').textContent,
                expectedCurrent: active?.textContent.replace(/\s+/g, ' ').trim(),
                visible: bar.classList.contains('is-visible'), inert: bar.inert,
                expectedVisible: cover.getBoundingClientRect().bottom < 90 && !(end && end.getBoundingClientRect().top < innerHeight * .6),
                overflow: document.documentElement.scrollWidth > innerWidth };
        });
        assert.equal(state.actual, state.expected); assert.equal(state.visible, state.expectedVisible); assert.equal(state.inert, !state.visible);
        if (state.expectedCurrent) assert.equal(state.current, state.expectedCurrent);
        assert.equal(state.overflow, false);
        const image = page.locator('.article-content-img').first();
        if (await image.count()) {
            await image.scrollIntoViewIfNeeded(); await image.click();
            await page.locator('.lb-overlay.open').waitFor();
            state.lightboxFocusAtOpen = await page.locator('.lb-close').evaluate(el => el === document.activeElement);
            await page.keyboard.press('ArrowRight'); await page.keyboard.press('Escape');
            assert.equal(await page.locator('.lb-overlay').evaluate(el => el.classList.contains('open')), false);
            assert.equal(await image.evaluate(el => el === document.activeElement || el.closest('[role=button]') === document.activeElement), true);
        }
        const facade = page.locator('.youtube-facade').first();
        if (await facade.count()) {
            await facade.focus(); await page.keyboard.press('Enter');
            assert.ok(await page.locator('iframe[src*="youtube-nocookie.com"]').count());
        }
        facts.push({ width, theme, id, state });
    }
    await page.goto(`${base}/blog-module/blog-entries/20261009W/article.html`, { waitUntil: 'load' });
    await page.evaluate(() => scrollTo(0, document.querySelector('.article-content').offsetTop + 600));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `/tmp/step8-${baseline ? 'baseline-' : ''}${width}-${theme}.png` });
    await page.goto(`${base}/blog-module/blog/index.html?q=F1`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelector('#journal-archive').getAttribute('data-total') !== null);
    const metrics = await cdp.send('Performance.getMetrics');
    const searches = [];
    for (const query of ['Senna', 'Ferrari', 'Hamilton', 'zzzz-no-match']) {
        const before = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
        const start = Date.now();
        await page.locator('#blog-search').fill(query);
        await page.locator('#blog-search').press('Enter');
        await page.waitForFunction(q => document.querySelector('#journal-archive').getAttribute('data-query') === q, query);
        const after = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
        searches.push({ query, elapsedMs: Date.now() - start, scriptMs: (after.ScriptDuration - before.ScriptDuration) * 1000 });
    }
    facts.push({ width, theme, editionInitialScriptMs: metrics.metrics.find(x => x.name === 'ScriptDuration').value * 1000, searches });
    await context.close();
    console.log(`${width} ${theme} passed`);
}
} finally { await browser.close(); server.close(); fs.writeFileSync(`perf/step8/browser-${baseline ? 'baseline' : 'candidate'}-results.json`, JSON.stringify(facts, null, 2)); }
