#!/usr/bin/env node
// embed-qa.mjs - regression check for the Standings embeds (/standings/?embed=1).
//
// Loads every embed target at 320, 390 and 680px in both themes, with a viewport tall enough that the page has
// no scrollbar (as in an article iframe once the article resizes it), and asserts:
//   - height stays within budget (<= 1400px at 680px, <= 1800px when narrower; documented exceptions below)
//   - nothing leaves the 12px side gutters, except content inside a horizontal scroller that shows a swipe hint
//   - no session/round selects and no view-tab strips are visible (the URL decides what an embed shows)
//   - the footer is present, with a 44px link that opens in the top window
//   - the embed follows the theme: color-scheme matches (no opaque white canvas), headline contrast >= 4.5:1
//   - no page errors and no failed same-origin requests
//
// NETWORK REQUIRED: the analysis tabs read live OpenF1/Jolpica data, so this is a manual/pre-release check and is
// NOT wired into CI. Runs share one browser context per theme (the app's IndexedDB cache keeps the ~90 loads under
// the providers' rate limits) and retry a tab that shows an error/empty state before failing it. Serves the working tree (or `--root=dist` for the published artifact) and needs a Chrome
// install (CHROME_PATH to override).
//
//   npm run qa:embeds
//   node scripts/perf/embed-qa.mjs --theme=dark --widths=390 --only=lap1,pit --no-fail
//   flags: --root=dist  --theme=dark|light|both  --widths=320,390,680  --only=<substring,...>  --json  --no-fail

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { Launcher } = require('chrome-launcher');

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const THEME_KEY = 'f1stories-theme';
const GUTTER = 12;
const VIEWPORT_HEIGHT = 7000;
const MAX_RETRIES = 3;

// The 13 copyable targets, plus the variants a copied embed code produces (pinned round, quali session view).
const TARGETS = [
    { id: 'panel-drivers', tab: 'drivers' },
    { id: 'drivers-table', tab: 'drivers' },
    { id: 'drivers-chart', tab: 'drivers' },
    { id: 'panel-constructors', tab: 'constructors' },
    { id: 'constructors-table', tab: 'constructors' },
    { id: 'constructors-chart', tab: 'constructors' },
    { id: 'panel-quali-gaps', tab: 'quali-gaps', label: 'quali-overview' },
    { id: 'panel-quali-gaps', tab: 'quali-gaps', label: 'quali-session', extra: 'qualiView=race-detail' },
    { id: 'panel-lap1-gains', tab: 'lap1-gains' },
    { id: 'panel-tyre-pace', tab: 'tyre-pace' },
    { id: 'panel-dirty-air', tab: 'dirty-air' },
    { id: 'panel-track-dominance', tab: 'track-dominance' },
    { id: 'panel-pit-stops', tab: 'pit-stops' },
    { id: 'panel-debrief', tab: 'debrief' },
    { id: 'drivers-chart', tab: 'drivers', label: 'drivers-chart-pinned', extra: `season=${new Date().getFullYear()}&round=1`, expectPinned: true }
];

const DEFAULT_BUDGET = { wide: 1400, narrow: 1800 };
// Known overruns, kept visible instead of silently loosening the default. Remove an entry once it is fixed.
const BUDGET_EXCEPTIONS = {
    'panel-track-dominance': { wide: 1800, reason: 'two stacked driver cards plus the track map' },
    'quali-overview': { wide: 1800, narrow: 1900, reason: 'five tall teammate pairs on the overview' }
};

// Host page backgrounds the embed sits on (styles/editorial.css tokens), for the contrast check.
const HOST_BACKGROUND = { dark: [27, 26, 25], light: [242, 238, 228] };

function parseArgs(argv) {
    const args = { root: REPO_ROOT, theme: 'both', widths: [320, 390, 680], only: [], json: false, failOnIssues: true };
    argv.forEach(arg => {
        if (arg.startsWith('--root=')) args.root = path.resolve(REPO_ROOT, arg.slice('--root='.length));
        else if (arg.startsWith('--theme=')) args.theme = arg.slice('--theme='.length);
        else if (arg.startsWith('--widths=')) args.widths = arg.slice('--widths='.length).split(',').map(Number).filter(Boolean);
        else if (arg.startsWith('--only=')) args.only = arg.slice('--only='.length).split(',').filter(Boolean);
        else if (arg === '--json') args.json = true;
        else if (arg === '--no-fail') args.failOnIssues = false;
    });
    return args;
}

const MIME = new Map([['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'], ['.webp', 'image/webp'], ['.avif', 'image/avif'], ['.png', 'image/png'],
    ['.jpg', 'image/jpeg'], ['.svg', 'image/svg+xml; charset=utf-8'], ['.woff2', 'font/woff2'], ['.map', 'application/json']]);

function startServer(root) {
    const server = http.createServer((req, res) => {
        const parsed = new URL(req.url || '/', 'http://127.0.0.1');
        let pathname = decodeURIComponent(parsed.pathname);
        if (pathname.endsWith('/')) pathname += 'index.html';
        const abs = path.resolve(root, `.${pathname}`);
        if (!abs.startsWith(root) || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
            res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
            res.end('not found');
            return;
        }
        res.writeHead(200, { 'content-type': MIME.get(path.extname(abs)) || 'application/octet-stream', 'cache-control': 'no-store' });
        fs.createReadStream(abs).pipe(res);
    });
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }));
    });
}

function luminance([r, g, b]) {
    const lin = v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

function budgetFor(target, width) {
    const key = width >= 680 ? 'wide' : 'narrow';
    const exception = BUDGET_EXCEPTIONS[target.label || target.id];
    return (exception && exception[key]) || DEFAULT_BUDGET[key];
}

// Runs inside the page. Returns plain data; all judgement happens in assess().
function measurePage(gutter) {
    const vw = document.documentElement.clientWidth;
    const visible = el => el.offsetParent !== null || getComputedStyle(el).position === 'fixed';
    const scrollers = [...document.querySelectorAll('*')].filter(el => ['auto', 'scroll'].includes(getComputedStyle(el).overflowX) && el.scrollWidth > el.clientWidth + 2 && visible(el));
    const panel = document.querySelector('.standings-panel.active');
    const offenders = [];
    document.querySelectorAll('.standings-panel.active *, #embed-footer, #embed-footer *').forEach(el => {
        if (!visible(el) || scrollers.some(s => s !== el && s.contains(el))) return;
        if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') return;
        const r = el.getBoundingClientRect();
        if (!r.width) return;
        if (r.right > vw - gutter + 1 || r.left < gutter - 1) {
            offenders.push(`${typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : el.tagName.toLowerCase()} [${Math.round(r.left)},${Math.round(r.right)}]`);
        }
    });
    const count = sel => [...document.querySelectorAll(sel)].filter(visible).length;
    const link = document.getElementById('embed-footer-link');
    const meta = document.getElementById('embed-footer-meta');
    const heading = (panel && panel.querySelector('h2, h3, .chart-title, .st-name')) || document.body;
    return {
        vw,
        docScroll: document.documentElement.scrollWidth,
        height: Math.ceil(document.body.getBoundingClientRect().height),
        offenders: [...new Set(offenders)].slice(0, 6),
        scrollers: scrollers.map(el => (typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : el.tagName.toLowerCase())),
        hint: !!panel && [...panel.querySelectorAll('[class*="scroll-hint"]')].some(visible),
        selects: count('select'),
        viewTabs: count('[class*="view-tab"], [class*="view-switch"]'),
        interactiveRows: document.querySelectorAll('.st-row[role="button"], .st-detail-row').length,
        footerText: meta ? meta.textContent.replace(/\s+/g, ' ').trim() : '',
        linkVisible: !!link && visible(link),
        linkHeight: link ? Math.round(link.getBoundingClientRect().height) : 0,
        linkTarget: link ? link.target : '',
        linkText: link ? link.textContent.trim() : '',
        dataEmbed: document.documentElement.getAttribute('data-embed'),
        theme: document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark',
        colorScheme: getComputedStyle(document.documentElement).colorScheme,
        htmlBg: getComputedStyle(document.documentElement).backgroundColor,
        bodyBg: getComputedStyle(document.body).backgroundColor,
        headingColor: getComputedStyle(heading).color
    };
}

function parseRgb(value) {
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(value || '');
    return m ? { rgb: [Number(m[1]), Number(m[2]), Number(m[3])], alpha: m[4] == null ? 1 : Number(m[4]) } : null;
}

function assess(target, width, theme, m, errors) {
    const issues = [];
    const budget = budgetFor(target, width);
    if (m.height > budget) issues.push(`height ${m.height}px exceeds ${budget}px`);
    if (m.docScroll > m.vw) issues.push(`page scrolls sideways (${m.docScroll}px in ${m.vw}px)`);
    if (m.offenders.length) issues.push(`outside the ${GUTTER}px gutters: ${m.offenders.join(', ')}`);
    if (m.scrollers.length && !m.hint) issues.push(`horizontal scroller without a swipe hint: ${[...new Set(m.scrollers)].join(', ')}`);
    if (m.selects) issues.push(`${m.selects} visible select(s)`);
    if (m.viewTabs) issues.push(`${m.viewTabs} visible view tab/switch element(s)`);
    if (m.interactiveRows) issues.push('rows still expandable in an embed');
    if (!m.footerText) issues.push('footer text missing');
    if (!m.linkVisible) issues.push('footer link not visible');
    else {
        if (m.linkHeight < 44) issues.push(`footer link ${m.linkHeight}px tall (< 44px)`);
        if (m.linkTarget !== '_top') issues.push(`footer link target is "${m.linkTarget}", expected _top`);
    }
    if (target.expectPinned && !/Σημερινή βαθμολογία/.test(m.linkText)) issues.push('pinned embed does not link to today\'s standings');
    if (m.dataEmbed !== '1') issues.push('html[data-embed] not set');
    if (m.theme !== theme) issues.push(`theme is ${m.theme}, expected ${theme}`);
    if (m.colorScheme !== theme) issues.push(`color-scheme is "${m.colorScheme}", expected ${theme} (opaque canvas risk)`);
    const bg = parseRgb(m.bodyBg);
    if (!bg || bg.alpha > 0) issues.push(`body background is not transparent (${m.bodyBg})`);
    const html = parseRgb(m.htmlBg);
    if (html && html.alpha > 0) issues.push(`html background is not transparent (${m.htmlBg})`);
    const text = parseRgb(m.headingColor);
    if (text) {
        const ratio = contrast(text.rgb, HOST_BACKGROUND[theme]);
        if (ratio < 4.5) issues.push(`headline contrast ${ratio.toFixed(2)}:1 on the ${theme} host background`);
    }
    errors.forEach(e => issues.push(e));
    return issues;
}

// Analysis tabs fetch several OpenF1 resources; measuring before they finish would pass a half-empty embed.
// Settled = no visible loading placeholder or error state, and the height unchanged for three polls.
async function waitUntilSettled(page, timeoutMs = 45000) {
    const deadline = Date.now() + timeoutMs;
    let last = -1;
    let stable = 0;
    while (Date.now() < deadline) {
        const state = await page.evaluate(() => {
            const visible = el => el.offsetParent !== null;
            const panel = document.querySelector('.standings-panel.active');
            const loading = panel ? [...panel.querySelectorAll('.skel, [class*="skeleton"], [class*="loading"]')].filter(visible).length : 1;
            const failed = panel ? [...panel.querySelectorAll('.standings-error, .standings-empty, [class*="-empty"]')].filter(visible).length : 0;
            return { loading, failed, height: Math.ceil(document.body.getBoundingClientRect().height) };
        }).catch(() => null);
        if (state) {
            if (state.failed) return 'showing an error or empty state';
            stable = state.loading === 0 && state.height === last ? stable + 1 : 0;
            last = state.height;
            if (stable >= 3) return '';
        }
        await page.waitForTimeout(400);
    }
    return 'content did not finish loading';
}

// One page per attempt, inside a context shared by every run of a theme: the app caches OpenF1/Jolpica responses
// in IndexedDB, which keeps the ~90 loads below the providers' rate limits (a cold start per run trips 429s).
async function run(context, origin, target, width, theme) {
    const page = await context.newPage();
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
    const errors = [];
    page.on('pageerror', error => errors.push(`page error: ${error.message}`));
    page.on('response', response => {
        if (response.status() >= 400 && response.url().startsWith(origin)) errors.push(`HTTP ${response.status()} ${new URL(response.url()).pathname}`);
    });
    const query = [`tab=${target.tab}`, `focus=${target.id}`, 'embed=1'];
    if (target.extra) query.push(target.extra);
    try {
        await page.goto(`${origin}/standings/?${query.join('&')}`, { waitUntil: 'networkidle' }).catch(() => {});
        await page.waitForSelector('#embed-footer-meta', { state: 'attached', timeout: 15000 }).catch(() => {});
        const unsettled = await waitUntilSettled(page);
        const measured = await page.evaluate(measurePage, GUTTER);
        return { issues: assess(target, width, theme, measured, unsettled ? [unsettled, ...errors] : errors), measured };
    } catch (error) {
        return { issues: [`could not measure: ${error.message}`], measured: null };
    } finally {
        await page.close();
    }
}

// A rate-limited provider shows up as an error/empty/unfinished tab; give it a moment and look again before failing.
const RETRYABLE = /error or empty state|did not finish loading/;
async function runWithRetry(context, origin, target, width, theme) {
    let result = await run(context, origin, target, width, theme);
    let retries = 0;
    while (retries < MAX_RETRIES && result.issues.some(issue => RETRYABLE.test(issue))) {
        retries += 1;
        await new Promise(resolve => setTimeout(resolve, 6000 * retries));
        result = await run(context, origin, target, width, theme);
    }
    return { ...result, retries };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (!fs.existsSync(path.join(args.root, 'standings', 'index.html'))) throw new Error(`No standings/index.html under ${args.root}. For --root=dist run \`npm run build:public\` first.`);
    const chromePath = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || Launcher.getFirstInstallation();
    if (!chromePath) throw new Error('No Chrome installation found for embed QA.');

    const themes = args.theme === 'both' ? ['dark', 'light'] : [args.theme];
    const targets = TARGETS.filter(t => !args.only.length || args.only.some(o => (t.label || t.id).includes(o)));
    const started = await startServer(args.root);
    const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
    const rows = [];

    try {
        console.log(`Serving ${args.root} at ${started.origin} (live OpenF1/Jolpica data required)`);
        for (const theme of themes) {
            const context = await browser.newContext({ viewport: { width: args.widths[0], height: VIEWPORT_HEIGHT } });
            await context.addInitScript(([key, value]) => { try { localStorage.setItem(key, value); } catch (_) {} }, [THEME_KEY, theme]);
            try {
                for (const width of args.widths) {
                    for (const target of targets) {
                        const { issues, measured, retries } = await runWithRetry(context, started.origin, target, width, theme);
                        const name = target.label || target.id;
                        rows.push({ target: name, width, theme, height: measured && measured.height, issues });
                        const status = issues.length ? `FAIL (${issues.length})` : 'ok';
                        console.log(`${theme.padEnd(5)} ${String(width).padStart(3)}px ${name.padEnd(24)} ${String(measured ? measured.height : '-').padStart(5)}px  ${status}${retries ? ` (after ${retries} retr${retries === 1 ? 'y' : 'ies'})` : ''}`);
                        issues.forEach(issue => console.log(`        - ${issue}`));
                        await new Promise(resolve => setTimeout(resolve, 400));
                    }
                }
            } finally {
                await context.close();
            }
        }
    } finally {
        await browser.close();
        if (typeof started.server.closeAllConnections === 'function') started.server.closeAllConnections();
        await new Promise(resolve => started.server.close(resolve));
    }

    const failing = rows.filter(row => row.issues.length);
    if (args.json) console.log(JSON.stringify(rows, null, 2));
    console.log(`\n${rows.length - failing.length}/${rows.length} embed checks passed.`);
    if (failing.length && args.failOnIssues) {
        console.error(`Embed QA failed: ${failing.length} check(s) with issues.`);
        process.exitCode = 1;
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
