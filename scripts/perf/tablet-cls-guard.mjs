#!/usr/bin/env node
// tablet-cls-guard.mjs - layout-shift budget at tablet widths, which the mobile-only Lighthouse guard never renders.
// The homepage loads cold at 768x1024 and 1024x1366 (@2x), dark and light, on Slow 4G with a 4x CPU.
// Then replay the edition label's fallback-to-web-font swap in isolation: local font preloads can otherwise win
// the first-paint race and conceal the wrapping regression. Report cold-load and controlled-swap CLS separately.
// CLS is the largest session window (web-vitals definition); every over-budget case fails with element attribution.

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const BUDGET = 0.02;
const VIEWPORTS = [{ width: 768, height: 1024 }, { width: 1024, height: 1366 }];
const THEMES = ['dark', 'light'];
const SLOW_4G = { offline: false, latency: 562.5, downloadThroughput: 1474.56 * 1024 / 8, uploadThroughput: 675 * 1024 / 8 };
const MIME_TYPES = new Map([
    ['.avif', 'image/avif'], ['.css', 'text/css; charset=utf-8'], ['.html', 'text/html; charset=utf-8'],
    ['.js', 'text/javascript; charset=utf-8'], ['.json', 'application/json; charset=utf-8'], ['.png', 'image/png'],
    ['.jpg', 'image/jpeg'], ['.svg', 'image/svg+xml; charset=utf-8'], ['.webp', 'image/webp'], ['.woff2', 'font/woff2'],
    ['.xml', 'application/xml; charset=utf-8']
]);
const GZIP_TYPES = new Set(['.css', '.html', '.js', '.json', '.svg', '.xml']);

// Largest session window: shifts less than 1 s apart, within 5 s of the window's first shift, input-driven ones excluded.
export function sessionWindowCls(shifts) {
    let max = 0;
    let current = 0;
    let first = -Infinity;
    let last = -Infinity;
    for (const shift of [...shifts].filter(s => !s.hadRecentInput).sort((a, b) => a.startTime - b.startTime)) {
        if (shift.startTime - last < 1000 && shift.startTime - first < 5000) {
            current += shift.value;
        } else {
            current = shift.value;
            first = shift.startTime;
        }
        last = shift.startTime;
        max = Math.max(max, current);
    }
    return max;
}

function parseArgs(argv) {
    const args = { root: path.join(REPO_ROOT, 'dist'), widths: VIEWPORTS.map(v => v.width), output: '' };
    for (let i = 2; i < argv.length; i++) {
        if (argv[i] === '--root') args.root = path.resolve(argv[++i]);
        else if (argv[i] === '--widths') args.widths = argv[++i].split(',').map(Number);
        else if (argv[i] === '--output') args.output = path.resolve(argv[++i]);
        else throw new Error(`Unknown argument: ${argv[i]}`);
    }
    if (args.widths.some(width => !Number.isInteger(width) || width < 320)) throw new Error('Widths must be integers >= 320');
    return args;
}

function startServer(root) {
    const server = http.createServer((req, res) => {
        let pathname = decodeURIComponent(new URL(req.url || '/', 'http://127.0.0.1').pathname);
        if (pathname.endsWith('/')) pathname += 'index.html';
        const file = path.resolve(root, `.${pathname}`);
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
            res.writeHead(404);
            res.end();
            return;
        }
        const ext = path.extname(file).toLowerCase();
        const headers = { 'content-type': MIME_TYPES.get(ext) || 'application/octet-stream', 'cache-control': 'no-store' };
        if (GZIP_TYPES.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
            headers['content-encoding'] = 'gzip';
            res.writeHead(200, headers);
            fs.createReadStream(file).pipe(zlib.createGzip()).pipe(res);
            return;
        }
        res.writeHead(200, headers);
        fs.createReadStream(file).pipe(res);
    });
    return new Promise((resolve, reject) => {
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }));
    });
}

const OBSERVER = `
window.__f1sShifts = [];
new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {
        window.__f1sShifts.push({
            startTime: entry.startTime, value: entry.value, hadRecentInput: entry.hadRecentInput,
            sources: entry.sources.map(source => {
                const node = source.node && source.node.nodeType === 1 ? source.node : source.node && source.node.parentElement;
                if (!node) return '?';
                const name = node.tagName.toLowerCase() + (node.id ? '#' + node.id : '') + (node.classList.length ? '.' + [...node.classList].slice(0, 2).join('.') : '');
                return name + ' y' + Math.round(source.previousRect.y) + '->' + Math.round(source.currentRect.y) + ' h' + Math.round(source.previousRect.height) + '->' + Math.round(source.currentRect.height);
            })
        });
    }
}).observe({ type: 'layout-shift', buffered: true });
`;

async function measure(browser, origin, route, viewport, theme) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2, colorScheme: theme });
    await context.addInitScript(value => {
        try {
            localStorage.setItem('f1stories-theme', value);
            localStorage.setItem('f1stories-cookie-consent-v1', JSON.stringify({ ts: 0, essential: true, analytics: false }));
        } catch (_) {}
    }, theme);
    await context.addInitScript(OBSERVER);
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.emulateNetworkConditions', SLOW_4G);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    try {
        await page.goto(origin + route.path, { waitUntil: 'load', timeout: 120000 });
        await page.waitForTimeout(3000);
        const shifts = await page.evaluate(() => window.__f1sShifts);
        await page.evaluate(() => document.fonts.ready);
        // Exercise only the reported label; delaying every font would also change unrelated headline/nav metrics.
        const previousFont = await page.locator('.cover-edition').evaluate(el => {
            const previous = el.style.fontFamily;
            el.style.fontFamily = 'sans-serif';
            return previous;
        });
        await page.waitForTimeout(150);
        const fallbackLayout = await page.locator('.cover-edition').evaluate(el => ({ height: el.getBoundingClientRect().height }));
        await page.evaluate(() => { window.__f1sShifts = []; });
        await page.locator('.cover-edition').evaluate((el, previous) => { el.style.fontFamily = previous; }, previousFont);
        await page.waitForTimeout(250);
        const fallbackShifts = await page.evaluate(() => window.__f1sShifts);
        const layout = await page.evaluate(() => ({
            theme: document.documentElement.dataset.theme || 'dark',
            overflow: document.documentElement.scrollWidth > innerWidth,
            edition: [...document.querySelectorAll('.cover-edition, .cover-edition > span, .cover-strip')].map(el => {
                const rect = el.getBoundingClientRect();
                const style = getComputedStyle(el);
                return { tag: el.tagName, class: el.className, text: el.tagName === 'SPAN' ? el.textContent : '',
                    x: rect.x, y: rect.y, width: rect.width, height: rect.height, font: style.font, whiteSpace: style.whiteSpace };
            })
        }));
        const coldCls = sessionWindowCls(shifts);
        const fallbackCls = sessionWindowCls(fallbackShifts);
        return { cls: Math.max(coldCls, fallbackCls), coldCls, fallbackCls, shifts: [...shifts, ...fallbackShifts], fallbackLayout, layout };
    } finally {
        await context.close();
    }
}

async function main() {
    const { chromium } = require('playwright-core');
    const { Launcher } = require('chrome-launcher');
    const args = parseArgs(process.argv);
    if (!fs.existsSync(path.join(args.root, 'index.html'))) throw new Error('dist/ is missing. Run npm run build:public first.');
    const { server, origin } = await startServer(args.root);
    // Third parties are unreachable, identically on every run.
    const browser = await chromium.launch({
        executablePath: process.env.CHROME_PATH || Launcher.getFirstInstallation(),
        args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1']
    });
    const failures = [];
    const measurements = [];
    try {
        for (const route of [{ name: 'Home', path: '/' }]) {
            for (const width of args.widths) {
                const viewport = VIEWPORTS.find(v => v.width === width) || { width, height: width < 768 ? 844 : 1080 };
                for (const theme of THEMES) {
                    const result = await measure(browser, origin, route, viewport, theme);
                    const label = `${route.name.padEnd(9)} ${viewport.width}x${viewport.height} ${theme.padEnd(5)}`;
                    const over = result.cls > BUDGET;
                    measurements.push({ route: route.name, viewport, theme, ...result });
                    console.log(`${label} CLS ${result.coldCls.toFixed(3)} cold / ${result.fallbackCls.toFixed(3)} edition font swap${over ? '  FAIL' : ''}`);
                    if (over) {
                        const worst = [...result.shifts].sort((a, b) => b.value - a.value).slice(0, 3);
                        failures.push(`${label} CLS ${result.cls.toFixed(3)} > ${BUDGET}: ` + worst.map(s => `${s.value.toFixed(3)} @${Math.round(s.startTime)}ms [${s.sources.join('; ')}]`).join(' | '));
                    }
                }
            }
        }
    } finally {
        await browser.close();
        server.close();
    }
    if (args.output) fs.writeFileSync(args.output, JSON.stringify(measurements, null, 2) + '\n');
    if (failures.length) {
        console.error('\nTablet CLS budget failures:');
        failures.forEach(failure => console.error(`  - ${failure}`));
        process.exitCode = 1;
    } else {
        console.log(`\nAll tablet CLS budgets passed (<= ${BUDGET}).`);
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
    main().catch(error => {
        console.error(error.message || error);
        process.exit(1);
    });
}
