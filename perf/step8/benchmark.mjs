// Focused Step 8 comparison: serve main's assets, substituting only the runtime under test.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
const root = path.join(process.cwd(), 'dist');
const baseline = execFileSync('git', ['show', '07ab7987:blog-module/blog/article-script.js'], { encoding: 'utf8' });
const candidate = fs.readFileSync('blog-module/blog/article-script.js', 'utf8');
const edition = fs.readFileSync('blog-module/blog-index.js', 'utf8');
let variant = 'baseline';
function instrument(source) {
    return source.replace('const update = () => {', 'const update = () => { const started = performance.now(); try {')
        .replace('        };\n        const schedule = () =>', '        } finally { (window.__updates ||= []).push(performance.now() - started); } };\n        const schedule = () =>');
}
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
    let file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    if (/article-script(?:\.min)?\.js$/.test(file)) return res.end(instrument(variant === 'baseline' ? baseline : candidate));
    if (/blog-index(?:\.min)?\.js$/.test(file)) return res.end(edition);
    if (!fs.existsSync(file)) { res.statusCode = 404; return res.end(); }
    fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
fs.writeFileSync('perf/step8/environment.json', JSON.stringify({ baseline: '07ab7987', browser: browser.version(), node: process.version, platform: process.platform, arch: process.arch, cpuRate: 4, network: { latencyMs: 150, downloadMbps: 1.6, uploadKbps: 750 }, viewports: [390, 768, 1440], height: 900, scrollSteps: 45, thirdPartyRequests: 'blocked identically', serviceWorkers: 'blocked' }, null, 2));
const results = [];
const ids = ['20250328G', '20261009W', '20261007G', '20260422G'];
try {
for (const width of [390, 768, 1440]) for (let pair = 1; pair <= 3; pair++) for (variant of ['baseline', 'candidate']) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
    await context.addInitScript(() => {
        localStorage.setItem('f1stories-cookie-consent-v1', JSON.stringify({ ts: Date.now(), essential: true, analytics: false }));
        window.__long = []; window.__cls = 0;
        new PerformanceObserver(l => window.__long.push(...l.getEntries().map(e => e.duration))).observe({ type: 'longtask', buffered: true });
        new PerformanceObserver(l => l.getEntries().forEach(e => { if (!e.hadRecentInput) window.__cls += e.value; })).observe({ type: 'layout-shift', buffered: true });
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
    await cdp.send('Performance.enable');
    for (const id of ids) {
        await page.goto(`${base}/blog-module/blog-entries/${id}/article.html`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1500);
        const initial = await cdp.send('Performance.getMetrics');
        await page.evaluate(() => { window.__updates = []; window.__long = []; window.__cls = 0; });
        await page.evaluate(async () => {
            const height = document.documentElement.scrollHeight - innerHeight;
            for (let n = 0; n < 45; n++) {
                scrollTo({ top: height * n / 44, behavior: 'instant' });
                await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
            }
        });
        const end = await cdp.send('Performance.getMetrics');
        const m = Object.fromEntries(initial.metrics.map(x => [x.name, x.value]));
        const delta = Object.fromEntries(end.metrics.map(x => [x.name, (x.value - (m[x.name] || 0)) * 1000]));
        results.push({ width, pair, variant, id, ...await page.evaluate(() => ({ updates: window.__updates, long: window.__long, cls: window.__cls })), scriptMs: delta.ScriptDuration, layoutMs: delta.LayoutDuration, styleMs: delta.RecalcStyleDuration, layouts: delta.LayoutCount / 1000, initialScriptMs: m.ScriptDuration * 1000 });
    }
    fs.writeFileSync('perf/step8/results.json', JSON.stringify(results, null, 2));
    await context.close();
    console.log(JSON.stringify({ width, pair, variant, done: results.length }));
}
} finally { await browser.close(); server.close(); }
fs.writeFileSync('perf/step8/results.json', JSON.stringify(results, null, 2));
