#!/usr/bin/env node
// edition-qa.mjs - regression gate for the archive's discovery system (the Edition Index) and every shared link.
//
// Serves dist/ the way GitHub Pages does (exact files, "/dir/" -> index.html, no .html fallback, no SPA
// rewrites), then in a real browser asserts:
//   1. Legacy URLs (scripts/perf/fixtures/legacy-urls.json): every ?category= / ?author= link, alias, combination and
//      tracking-tagged link still applies its filter, with the same URL, canonical and result count (derived from the
//      published index). With JavaScript off the baseline showed the unfiltered archive; that stays true.
//   2. Articles: every published article still has its page; shared article URLs keep their canonical.
//   3. Static routes: every section, month and archive page in the sitemap is a real file that reads without
//      JavaScript, with its own canonical, the right story count, working pagination and neighbours.
//   4. Back, Forward and history: Back from a story on a later page returns to that page at the same scroll, a search
//      is one history entry, and a pager link opened in a new tab reproduces its state.
//   5. The phone category strip is sticky under the site nav; ΝΕΟ marks expire on the reader's clock.
//
//   npm run build:public && npm run qa:edition
//   flags: --root=dist  --no-fail

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { unifiedSearchQA } from './unified-search-qa.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { Launcher } = require('chrome-launcher');
const T = require('../../blog-module/taxonomy.js');

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = new Map(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=')));
const ROOT = path.resolve(REPO_ROOT, args.get('root') || 'dist');
const required = ['_headers', '404.html', 'sitemap.xml', 'blog-module/blog/index.html', 'blog-module/blog-index-data.json'];
const absent = required.filter(file => !fs.existsSync(path.join(ROOT, file)) || !fs.statSync(path.join(ROOT, file)).isFile());
if (absent.length) {
    console.error(`Edition QA needs built static output at ${ROOT}. Missing: ${absent.join(', ')}. Run npm run build:public, then npm run qa:edition.`);
    process.exit(1);
}
let chrome;
let browser;
try {
    chrome = process.env.CHROME_PATH || Launcher.getFirstInstallation();
    if (!chrome) throw new Error('no installed Chrome found');
    fs.accessSync(chrome, fs.constants.X_OK);
    browser = await chromium.launch({ executablePath: chrome, headless: true });
} catch (error) {
    console.error(`Edition QA cannot launch Chrome: ${error.message}. Set CHROME_PATH to an installed compatible Chrome/Chromium executable. On Linux check its shared-library dependencies. No browser is downloaded by this suite.`);
    process.exit(1);
}
const fixture = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'scripts/perf/fixtures/legacy-urls.json'), 'utf8'));
const results = [];
const check = (group, name, ok, detail = '') => {
    results.push({ group, name, ok: !!ok, detail: String(detail) });
    if (!ok) console.error(`FAIL [${group}] ${name} ${detail}`);
};

// ── Published data ───────────────────────────────────────
const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'blog-module/blog-index-data.json'), 'utf8'));
const posts = index.p.map(row => ({ id: row[0], date: row[3], author: index.a[row[2]], categories: row[8].map(i => index.c[i]), search: row.slice(1, 8).join(' ') }));
const authorOf = slug => T.AUTHORS.find(author => author.slug === slug);
const expectedTotal = e => posts.filter(post => (!e.category || post.categories.includes(e.category)) && (!e.author || post.author === authorOf(e.author).name)).length;

// ── A GitHub Pages stand-in ──────────────────────────────
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.xml': 'application/xml', '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let pathname = '';
    try { pathname = decodeURIComponent(url.pathname); } catch (_) { /* 404 */ }
    const target = path.join(ROOT, pathname);
    const send = (status, file) => { res.writeHead(status, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(file).pipe(res); };
    if (!target.startsWith(ROOT)) return send(404, path.join(ROOT, '404.html'));
    const stat = fs.existsSync(target) ? fs.statSync(target) : null;
    if (stat && stat.isFile()) return send(200, target);
    if (stat && stat.isDirectory() && !pathname.endsWith('/')) { res.writeHead(301, { Location: `${url.pathname}/${url.search}` }); return res.end(); }
    if (stat && stat.isDirectory() && fs.existsSync(path.join(target, 'index.html'))) return send(200, path.join(target, 'index.html'));
    return send(404, path.join(ROOT, '404.html'));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

async function open({ js = true, width = 1280, height = 900, time, analytics = false } = {}) {
    const context = await browser.newContext({ javaScriptEnabled: js, viewport: { width, height } });
    await context.addInitScript(analytics => { try { localStorage.setItem('f1stories-cookie-consent-v1', JSON.stringify({ ts: Date.now(), essential: true, analytics })); } catch (_) { /* private mode */ } }, analytics);
    await context.route('**/api.jolpi.ca/**', route => route.abort());
    await context.route('**/*googletagmanager*/**', route => route.abort());
    const page = await context.newPage();
    if (time) await page.clock.install({ time: new Date(time) });
    return { context, page };
}
const settle = async page => {
    await page.waitForLoadState('load');
    await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(350);
};
const view = page => page.evaluate(() => ({ ...(document.getElementById('journal-archive') || {}).dataset, front: !!document.getElementById('journal-edition') && document.getElementById('journal-edition').offsetParent !== null }));
const storyIds = page => page.evaluate(() => [...document.querySelectorAll('main a[href*="/blog-entries/"]')].filter(a => a.offsetParent !== null).map(a => decodeURIComponent(a.getAttribute('href').split('/blog-entries/')[1].split('/')[0])));

try {
    // 1. Legacy URLs.
    for (const item of fixture.views) {
        const e = item.expect;
        const filtered = !!(e.category || e.author || e.query || e.sort || e.page);
        const on = await open();
        const response = await on.page.goto(base + item.url);
        await settle(on.page);
        const v = await view(on.page);
        const want = filtered ? { category: e.category || '', author: e.author || '', query: e.query || '', sort: e.sort || 'newest', page: String(e.page || 1) } : null;
        check('legacy', `${item.url} opens (200, no redirect)`, response.status() === 200 && on.page.url() === base + item.url.replace(/#.*$/, '') + (item.url.includes('#') ? item.url.slice(item.url.indexOf('#')) : ''), `${response.status()} ${on.page.url()}`);
        if (want) {
            check('legacy', `${item.url} state`, Object.keys(want).every(key => v[key] === want[key]), JSON.stringify(v));
            if (!e.query && !e.sort && !e.page) check('legacy', `${item.url} result count`, Number(v.total) === expectedTotal(e), `${v.total} vs ${expectedTotal(e)}`);
            const norm = text => String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ς/g, 'σ');
            const filteredPosts = index.p.map(row => ({ id: row[0], date: row[3], author: index.a[row[2]], categories: row[8].map(i => index.c[i]),
                text: norm([row[1], row[6], index.a[row[2]], T.authorLabel(index.a[row[2]]), row[8].map(i => index.c[i]).join(' '),
                    row[8].map(i => T.categoryLabel(index.c[i])).join(' '), row[9].map(tag => typeof tag === 'number' ? index.t[tag] : tag).join(' '), row[3]].join(' ')) }))
                .filter(post => (!e.category || post.categories.includes(e.category)) && (!e.author || post.author === authorOf(e.author).name) && (!e.query || post.text.includes(norm(e.query))))
                .sort((a, b) => a.date < b.date ? (e.sort === 'oldest' ? -1 : 1) : a.date > b.date ? (e.sort === 'oldest' ? 1 : -1) : 0);
            const slice = filteredPosts.slice(((e.page || 1) - 1) * 30, (e.page || 1) * 30).map(post => post.id);
            const actual = await storyIds(on.page);
            check('legacy', `${item.url} actual filtered article slice`, Number(v.total) === filteredPosts.length && JSON.stringify(actual) === JSON.stringify(slice), `${actual.length} links / ${filteredPosts.length} results`);
        } else {
            check('legacy', `${item.url} unfiltered front page`, v.front && v.view === 'all' && !v.category && !v.author);
        }
        check('legacy', `${item.url} canonical unchanged`, (await on.page.locator('link[rel=canonical]').getAttribute('href')) === 'https://f1-stories.gr/blog-module/blog/index.html');
        await on.context.close();
        // JavaScript off: the baseline never filtered without script; the page is the readable front page.
        const off = await open({ js: false });
        const plain = await off.page.goto(base + item.url);
        check('legacy', `${item.url} readable without JavaScript`, plain.status() === 200 && (await off.page.locator('#journal-edition a[href*="/blog-entries/"]').count()) > 5);
        await off.context.close();
    }

    // Search uses the real analytics API contract; navigation events from the
    // retired controls were unreachable at baseline (.analytics was undefined).
    {
        const { context, page } = await open({ analytics: true });
        await page.goto(`${base}/blog-module/blog/index.html`); await settle(page);
        await page.locator('#blog-search').fill('Senna'); await page.waitForTimeout(1200);
        const events = await page.evaluate(() => window.dataLayer.map(args => Array.from(args)).filter(args => args[0] === 'event' && args[1] === 'journal_search'));
        check('analytics', 'journal_search fires once after consent with safe payload', events.length === 1 && events[0][2].query_length === 5 && events[0][2].result_count === Number((await view(page)).total) && !('query' in events[0][2]), JSON.stringify(events));
        await page.evaluate(() => {
            const consent = { ts: Date.now(), essential: true, analytics: false };
            localStorage.setItem('f1stories-cookie-consent-v1', JSON.stringify(consent));
            window.dispatchEvent(new CustomEvent('f1stories:cookie-consent-changed', { detail: consent }));
        });
        await page.locator('#blog-search').fill('Ferrari'); await page.waitForTimeout(1200);
        check('analytics', 'journal_search stops after consent is revoked', (await page.evaluate(() => window.dataLayer.filter(args => args[0] === 'event' && args[1] === 'journal_search').length)) === 1);
        await context.close();
    }

    // 2. Articles.
    const missing = posts.filter(post => !fs.existsSync(path.join(ROOT, 'blog-module/blog-entries', post.id, 'article.html'))).map(post => post.id);
    check('articles', 'every published story has its page in the artifact', missing.length === 0, missing.slice(0, 5).join(', '));
    for (const id of fixture.articles) {
        const { context, page } = await open();
        const response = await page.goto(`${base}/blog-module/blog-entries/${encodeURIComponent(id)}/article.html`);
        await page.waitForLoadState('load');
        check('articles', `${id} opens at its URL with its own canonical`, response.status() === 200 && (await page.locator('link[rel=canonical]').getAttribute('href')) === `https://f1-stories.gr/blog-module/blog-entries/${encodeURIComponent(id)}/article.html`);
        await context.close();
    }
    for (const url of fixture.siblings) check('articles', `${url} still resolves`, (await fetch(base + url)).status === 200);

    // 3. Static routes from the sitemap.
    const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
    const routes = [...sitemap.matchAll(/<loc>https:\/\/f1-stories\.gr(\/blog-module\/blog\/(?:section|archive)\/[^<]*)<\/loc>/g)].map(match => match[1]);
    check('routes', 'the sitemap lists section and month pages', routes.some(r => r.includes('/section/')) && routes.some(r => /\/archive\/\d{4}\/\d{2}\//.test(r)), routes.length);
    const off = await open({ js: false });
    for (const route of routes) {
        const response = await off.page.goto(base + route);
        const facts = await off.page.evaluate(() => ({
            h1: document.querySelectorAll('h1').length, canonical: (document.querySelector('link[rel=canonical]') || {}).href,
            stories: new Set([...document.querySelectorAll('main a[href*="/blog-entries/"]')].map(a => a.getAttribute('href'))).size,
            shown: (document.querySelector('.ed-section__facts') || {}).textContent
        }));
        check('routes', `${route} is a real page without JavaScript`, response.status() === 200 && facts.h1 === 1 && facts.canonical === `https://f1-stories.gr${route}`, JSON.stringify(facts));
        const month = /\/archive\/(\d{4})\/(\d{2})\//.exec(route);
        if (month) {
            const inMonth = posts.filter(post => post.date.startsWith(`${month[1]}-${month[2]}`)).length;
            check('routes', `${route} lists every story of the month`, facts.stories === inMonth, `${facts.stories} vs ${inMonth}`);
        }
        const section = /\/section\/([a-z]+)\/$/.exec(route);
        if (section) {
            const name = T.PUBLIC_CATEGORIES.find(category => T.categoryKind(category) === section[1]);
            check('routes', `${route} count matches the archive`, (facts.shown || '').startsWith(`${posts.filter(post => post.categories.includes(name)).length} ιστορ`), facts.shown);
        }
    }
    const pageTwo = routes.find(route => /\/page\/2\/$/.test(route));
    if (pageTwo) {
        await off.page.goto(base + pageTwo.replace('page/2/', ''));
        await off.page.locator('#blog-pagination a[aria-label="Σελίδα 2"]').click();
        await off.page.waitForLoadState('load');
        check('routes', 'a pager link works without JavaScript', off.page.url() === base + pageTwo, off.page.url());
    }
    await off.context.close();

    // 4. Back, Forward, history.
    for (const [label, start] of [['static section', '/blog-module/blog/section/news/'], ['legacy view', '/blog-module/blog/index.html?category=News']]) {
        const { context, page } = await open();
        await page.goto(base + start); await settle(page);
        await page.locator('#blog-pagination a[aria-label="Σελίδα 3"]').click(); await settle(page);
        const pageUrl = page.url();
        const link = page.locator('#articles-grid a[href*="/blog-entries/"]').nth(12);
        await link.scrollIntoViewIfNeeded(); await page.waitForTimeout(150);
        const y = await page.evaluate(() => Math.round(scrollY));
        const first = await page.locator('#articles-grid a[href*="/blog-entries/"]').first().getAttribute('href');
        await link.click(); await page.waitForURL('**/article.html'); await settle(page);
        await page.goBack(); await settle(page); await page.waitForTimeout(400);
        check('history', `${label}: Back returns to the same page and slice`, page.url() === pageUrl && (await page.locator('#articles-grid a[href*="/blog-entries/"]').first().getAttribute('href')) === first, page.url());
        check('history', `${label}: Back restores the scroll position`, y > 300 && Math.abs(y - (await page.evaluate(() => Math.round(scrollY)))) <= 40, `${y}`);
        await page.goForward(); await settle(page);
        check('history', `${label}: Forward reopens the story`, page.url().includes('/blog-entries/'));
        await context.close();
    }
    {
        const { context, page } = await open();
        await page.goto(`${base}/blog-module/blog/index.html`); await settle(page);
        const before = await page.evaluate(() => history.length);
        await page.locator('#blog-search').pressSequentially('Senna', { delay: 100 });
        await page.waitForTimeout(800);
        check('history', 'a search is one history entry, not one per keystroke', (await page.evaluate(() => history.length)) - before === 1);
        check('history', 'the search is in the URL', new URL(page.url()).searchParams.get('q') === 'Senna');
        await page.locator('#articles-grid a[href*="/blog-entries/"]').first().click(); await page.waitForURL('**/article.html'); await settle(page);
        await page.goBack(); await settle(page);
        check('history', 'Back from a story keeps the search', (await view(page)).query === 'Senna' && (await page.locator('#blog-search').inputValue()) === 'Senna');
        const href = await (async () => { await page.goto(`${base}/blog-module/blog/index.html?category=Technical&sort=oldest`); await settle(page); return page.locator('#blog-pagination a[aria-label="Σελίδα 2"]').getAttribute('href'); })();
        const tab = await context.newPage();
        await tab.goto(new URL(href, base).href); await settle(tab);
        const v = await view(tab);
        check('history', 'a pager link opened in a new tab reproduces its state', v.category === 'Technical' && v.sort === 'oldest' && v.page === '2', JSON.stringify(v));
        await context.close();
    }

    // 5. Phone strip and ΝΕΟ.
    {
        const { context, page } = await open({ width: 390, height: 844 });
        await page.goto(`${base}/blog-module/blog/section/technical/`); await settle(page);
        await page.evaluate(() => window.scrollTo({ top: 1400, behavior: 'instant' })); await page.waitForTimeout(200);
        const rail = await page.evaluate(() => { const r = document.querySelector('.ed-rail').getBoundingClientRect(); return { top: Math.round(r.top), nav: Math.round(document.querySelector('.blog-nav').getBoundingClientRect().bottom), current: !!document.querySelector('.ed-rail [aria-current]'), over: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
        check('phone', 'the category strip stays under the site nav while scrolling', Math.abs(rail.top - rail.nav) <= 2 && rail.current, JSON.stringify(rail));
        check('phone', 'no horizontal overflow', rail.over <= 0, rail.over);
        for (const width of [320, 375, 390]) {
            await page.setViewportSize({ width, height: 844 });
            for (const theme of ['light', 'dark']) {
                await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
                for (const link of await page.locator('.ed-rail a').all()) {
                    await link.focus();
                    const focus = await link.evaluate(el => {
                        const box = el.getBoundingClientRect();
                        const strip = el.closest('ol');
                        return { left: box.left, right: box.right, height: box.height, mask: getComputedStyle(strip).maskImage };
                    });
                    check('phone', `${width}px ${theme}: category focus is fully visible`, focus.left >= 0 && focus.right <= width && focus.height >= 44 && focus.mask === 'none', JSON.stringify(focus));
                }
            }
        }
        await context.close();
    }
    {
        const newest = posts[0].date;
        const fresh = await open({ time: `${newest}T12:00:00Z` });
        await fresh.page.goto(`${base}/blog-module/blog/index.html`); await settle(fresh.page);
        check('new', 'ΝΕΟ marks the newest stories on the day', (await fresh.page.locator('.ed-new').count()) > 0);
        await fresh.context.close();
        const stale = await open({ time: `${T.addDays(newest, 30)}T12:00:00Z` });
        await stale.page.goto(`${base}/blog-module/blog/index.html`); await settle(stale.page);
        check('new', 'a cached page loses ΝΕΟ once the week has passed', (await stale.page.locator('.ed-new').count()) === 0);
        await stale.context.close();
    }
    await unifiedSearchQA({ open, base, root: ROOT, check, settle });
} finally {
    await browser.close();
    server.close();
}

const failed = results.filter(r => !r.ok);
console.log(`Edition QA: ${results.length - failed.length}/${results.length} checks passed (${[...new Set(results.map(r => r.group))].join(', ')}).`);
if (failed.length && !args.has('no-fail')) process.exit(1);
