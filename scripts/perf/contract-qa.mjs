#!/usr/bin/env node
// B-18 browser checks against the identity-locked aggregate.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildToolLink } from '../race-desk/core/links.mjs';
import { verifyIdentity } from '../deployment/verify-public.mjs';
import { guardContext } from './qa-network.mjs';

const repo = path.resolve(import.meta.dirname, '../..');
async function boundedClose(work, fallback, ms = 10000) {
    let timer;
    try { return await Promise.race([work(), new Promise((_, reject) => { timer=setTimeout(() => reject(Error(`teardown timeout after ${ms}ms`)),ms); })]); }
    catch (error) { fallback(); throw error; }
    finally { clearTimeout(timer); }
}
const matchRace = state => state.title === 'Japanese Grand Prix' && state.race === '2026-jp';
const assertRace = state => assert.ok(matchRace(state), `incorrect rendered race: ${JSON.stringify(state)}`);
const assertLegacy = (url, pathname, search, hash) => {
    const actual = new URL(url);
    assert.equal(actual.pathname, pathname);
    for (const [key, value] of new URLSearchParams(search)) assert.equal(actual.searchParams.get(key), value);
    assert.equal(actual.hash, hash);
};
const isSamePageLink = target => !target || target.toLowerCase() === '_self';
const checkRoot = async (page, item, mutate = '') => {
    if (item.path === '/tyres/') {
        await page.waitForFunction(expected => !document.querySelector('#race')?.disabled && document.querySelector('#race')?.value === expected.id && document.querySelector('#race-title')?.textContent?.trim() === expected.name, item.latest, { timeout: 15000 });
        assert.equal((await page.locator('#race-title').innerText()).trim(), item.latest.name);
    }
    const marker = mutate === 'root' && item.path === '/' ? '#b18-missing-ready-marker' : item.marker;
    const locator = page.locator(marker).first();
    await locator.waitFor({ state: 'visible', timeout: 15000 });
    assert.ok((await locator.innerText()).trim(), `empty ready marker ${marker}`);
    if (item.path === '/standings/') {
        const name = page.locator('#drivers-table .st-row .st-name').first();
        await name.waitFor({ state: 'visible', timeout: 15000 });
        assert.ok((await name.innerText()).trim(), 'empty driver name');
    }
    if (item.content) assert.match((await page.locator('body').innerText()).toLowerCase(), new RegExp(item.content.toLowerCase()));
    assert.equal(new URL(page.url()).pathname, item.path);
};
const args = process.argv.slice(2);
const candidate = args.includes('--candidate');
if (candidate) for (const stream of [process.stdout, process.stderr]) {
    const write = stream.write.bind(stream);
    stream.write = (chunk, ...rest) => write(String(chunk).replace(/^/gm, 'CANDIDATE (identity unverified) ').replace(/CANDIDATE \(identity unverified\) $/, ''), ...rest);
}
if (args.includes('--self-test')) {
    assertRace({ title: 'Japanese Grand Prix', race: '2026-jp' });
    assert.throws(() => assertRace({ title: 'Bahrain Grand Prix', race: '2026-bh' }));
    assert.throws(() => assertRace({ title: 'Japanese Grand Prix', race: '' }));
    const fake = { url: () => 'http://localhost/', locator: selector => ({ first() { return this; }, async waitFor() { assert.equal(selector, '#hero-title'); }, async innerText() { return 'Lead story'; } }) };
    await checkRoot(fake, { path: '/', marker: '#hero-title' });
    await assert.rejects(checkRoot(fake, { path: '/', marker: '#hero-title' }, 'root'));
    assert.equal(isSamePageLink(null), true);
    assert.equal(isSamePageLink('_self'), true);
    assert.equal(isSamePageLink('_blank'), false);
    const standingsFake = name => ({ url: () => 'http://localhost/standings/', locator: selector => ({ first() { return this; }, async waitFor() {}, async innerText() { return selector.endsWith('.st-name') ? name : '1 Driver'; } }) });
    await checkRoot(standingsFake('Driver Name'), { path: '/standings/', marker: '#drivers-table .st-row' });
    await assert.rejects(checkRoot(standingsFake(''), { path: '/standings/', marker: '#drivers-table .st-row' }));
    assertLegacy('http://localhost/telemetry/?year=2025#telemetry-speed-trace', '/telemetry/', '?year=2025', '#telemetry-speed-trace');
    assert.throws(() => assertLegacy('http://localhost/telemetry/', '/telemetry/', '?year=2025', '#telemetry-speed-trace'));
    let forced=false; await assert.rejects(boundedClose(() => new Promise(() => {}), () => { forced=true; }, 20)); assert.ok(forced);
    console.log('self-test PASS: race, root marker, legacy assertions and hung close');
} else {
    const option = (name, fallback) => { const i = args.indexOf(name); if (i < 0) return fallback; if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`${name} requires a value`); return args[i + 1]; };
    const rootArg = option('--root');
    const expectedMainSha = option('--expected-main-sha');
    const expectedTyresDataSha = option('--expected-tyres-data-sha');
    if (!rootArg || (!candidate && (!expectedMainSha || !expectedTyresDataSha))) throw new Error('--root and both expected SHA flags are required unless --candidate (which still requires --root)');
    const root = fs.realpathSync(rootArg);
    const label = option('--label', 'contracts');
    if (!/^[a-zA-Z0-9_-]+$/.test(label)) throw new Error('invalid label');
    const mutate = option('--mutate', '');
    if (mutate && !['tyres-race', 'root', 'legacy', 'article'].includes(mutate)) throw new Error('unknown mutation');
    const out = path.resolve(option('--out', path.join(repo, '.build/aggregate/qa/contract', label)));
    fs.mkdirSync(out, { recursive: true });
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'deployment-manifest.json')));
    const lock = JSON.parse(fs.readFileSync(path.join(repo, 'scripts/deployment/sources.json')));
    const identity = verifyIdentity(root, lock, { expectedMainSha, expectedTyresDataSha });
    const report = { label, runLabel: candidate ? 'CANDIDATE (identity unverified)' : 'standard', legacyScope: ['FROZEN /f1telemetry/ stub preserves query and hash (scripts/external-redirect.min.js)', 'NOT IN ARTIFACT: sibling github.io deep-path and 404 redirects prepared by scripts/deployment/redirects.mjs; sitemap/file preservation checked by scripts/deployment/url-preservation.mjs'], artifact: { root, outputDigest: manifest.outputDigest, buildId: manifest.buildId, applications: manifest.applications.map(({ application, sourceSha, data }) => ({ application, sourceSha, dataSha: data?.sha })) }, identity, chrome: null, mutation: mutate || null, cases: [] };
    const add = (id, name, viewport, status, reason) => { report.cases.push({ id, name, viewport, status, reason }); console.log(`${id} ${name} ${viewport} ${status} ${reason.replace(/\s+/g, ' ')}`); };
    const save = () => fs.writeFileSync(path.join(out, `${label}-contract-report.json`), JSON.stringify(report, null, 2) + '\n');
    const runTimer=setTimeout(() => { add('B-18','watchdog','all','FAIL','whole-run timeout'); save(); process.exit(1); },1500000);
    const checks = identity.checks.filter(c => c.status === 'FAIL');
    if (checks.length) { add('B-18', 'identity', 'all', 'FAIL', checks.map(c => `${c.id}: ${c.diagnostic}`).join('; ')); save(); if (!candidate) process.exitCode = 1; }
    if (!checks.length || candidate) {
        const registry = JSON.parse(fs.readFileSync(path.join(repo, 'data/race-desk/registry.v1.json')));
        const link = buildToolLink(registry, { raceId: '2026-japanese-gp' }, 'tyres');
        assert.equal(link.status, 'resolved');
        const target = new URL(link.url);
        if (mutate === 'tyres-race') { target.searchParams.set('year', '2026'); target.searchParams.set('race', 'sepang'); }
        const server = http.createServer((req, res) => {
            try {
                let p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
                if (p.endsWith('/')) p += 'index.html';
                const file = path.resolve(root, `.${p}`);
                if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
                const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp' };
                res.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(file).pipe(res);
            } catch { res.writeHead(400); res.end(); }
        });
        let browser;
        try {
            await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
            const origin = `http://127.0.0.1:${server.address().port}`;
            const require = createRequire(import.meta.url);
            const { chromium } = require('playwright-core');
            const { Launcher } = require('chrome-launcher');
            const chrome = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || Launcher.getFirstInstallation();
            if (!chrome) throw new Error('Chrome not found');
            browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
            report.chrome = browser.version();
            for (const width of [390, 1440]) {
                const violations = [], notes = [];
                const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, serviceWorkers: 'block' });
                try {
                    await guardContext(context, origin, violations, { artifactRoot: root, notes });
                    const page = await context.newPage();
                    const check = async () => {
                        await page.waitForFunction(() => !document.querySelector('#race')?.disabled, null, { timeout: 15000 });
                        const state = await page.evaluate(() => ({ title: document.querySelector('#race-title')?.textContent?.trim(), race: document.querySelector('#race')?.value }));
                        assertRace(state);
                    };
                    const response = await page.goto(origin + target.pathname + target.search, { waitUntil: 'domcontentloaded' });
                    assert.equal(response.status(), 200); await check();
                    await page.reload({ waitUntil: 'domcontentloaded' }); await check();
                    await page.goto(origin + '/tyres/', { waitUntil: 'domcontentloaded' });
                    await page.goBack({ waitUntil: 'domcontentloaded' }); await check();
                    assert.deepEqual(violations, []);
                    add('B-18', 'tyres-race', width, 'PASS', 'rendered race survives load reload and back');
                } catch (error) { add('B-18', 'tyres-race', width, 'FAIL', `${error.message}; network: ${violations.join('; ')}`); process.exitCode = 1; }
                finally { await boundedClose(() => context.close(), () => browser?.process?.()?.kill('SIGKILL')); }
                const tyresManifest = JSON.parse(fs.readFileSync(path.join(root, 'tyres/data/manifest.json')));
                const latestTyres = tyresManifest.years.flatMap(year => year.races).find(race => race.id === tyresManifest.latest);
                assert.ok(latestTyres, 'TYRES latest race missing from manifest');
                const roots = [
                    { path: '/', marker: '#hero-title' },
                    { path: '/blog-module/blog/index.html', marker: '.ed-headline--lead' },
                    { path: '/standings/', marker: '#drivers-table .st-row' },
                    { path: '/telemetry/', marker: '#root h1', content: 'TELEMETRY' },
                    { path: '/ghostcar/', marker: '#root h1', content: 'Ghost Car' },
                    { path: '/tyres/', marker: '#race-title', content: 'Grand Prix', latest: latestTyres },
                    { path: '/betcast/', marker: '#chart-select', content: 'BetCast' }
                ];
                if (fs.existsSync(path.join(root, 'race-desk/index.html'))) roots.push({ path: '/race-desk/', marker: 'main h1', content: 'Race Desk' });
                for (const app of manifest.applications) assert.ok(roots.some(item => item.path === app.canonicalPath), `missing manifest root ${app.canonicalPath}`);
                const runCase = async (name, fn) => {
                    const violations = [], notes = [];
                    const ctx = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, serviceWorkers: 'block' });
                    try {
                        await guardContext(ctx, origin, violations, { artifactRoot: root, notes });
                        const page = await ctx.newPage();
                        const detail = await fn(page);
                        assert.deepEqual(violations, []);
                        add('B-18', name, width, 'PASS', detail);
                    } catch (error) { add('B-18', name, width, 'FAIL', `${error.message}; network: ${violations.join('; ')}; notes: ${notes.join('; ')}`); process.exitCode = 1; }
                    finally { await boundedClose(() => ctx.close(), () => browser?.process?.()?.kill('SIGKILL')); }
                };
                for (let i = 0; i < roots.length; i++) {
                    const a = roots[i], b = roots[(i + 1) % roots.length];
                    await runCase(`root-${a.path}`, async page => {
                        await page.goto(origin + a.path, { waitUntil: 'load' }); await checkRoot(page, a, mutate);
                        await page.reload({ waitUntil: 'load' }); await checkRoot(page, a, mutate);
                        const links = page.locator('a[href]');
                        let usedLink = false;
                        for (let j = 0, count = await links.count(); j < count; j++) {
                            const candidate = links.nth(j);
                            if (!await candidate.isVisible() || !isSamePageLink(await candidate.getAttribute('target'))) continue;
                            const url = new URL(await candidate.getAttribute('href'), page.url());
                            if (url.origin === origin && url.pathname === b.path && !url.search && !url.hash) {
                                await Promise.all([page.waitForFunction(pathname => location.pathname === pathname, b.path, { timeout: 15000 }), candidate.click()]);
                                await page.waitForLoadState('load'); usedLink = true; break;
                            }
                        }
                        if (!usedLink) await page.goto(origin + b.path, { waitUntil: 'load' });
                        await checkRoot(page, b, mutate);
                        await page.goBack({ waitUntil: 'load' }); await checkRoot(page, a, mutate);
                        await page.goForward({ waitUntil: 'load' }); await checkRoot(page, b, mutate);
                        return `direct reload back forward; transition ${usedLink ? 'link' : 'goto'}`;
                    });
                }
                await runCase('legacy-stub-query-hash', async page => {
                    const input = mutate === 'legacy' ? '/b18-unmapped/' : '/f1telemetry/';
                    await page.goto(origin + input + '?year=2025#telemetry-speed-trace', { waitUntil: 'domcontentloaded' });
                    await page.waitForURL(url => url.pathname === '/telemetry/', { timeout: 15000 });
                    await page.waitForLoadState('load');
                    assertLegacy(page.url(), '/telemetry/', '?year=2025', '#telemetry-speed-trace');
                    await checkRoot(page, roots.find(item => item.path === '/telemetry/'));
                    return `stub, query and hash: ${page.url()}`;
                });
                const posts = JSON.parse(fs.readFileSync(path.join(root, 'blog-module/blog-index-data.json'))).p.toSorted((a, b) => a[3].localeCompare(b[3]));
                for (const post of [posts[0], posts.at(-1)]) {
                    await runCase(`article-${post[0]}`, async page => {
                        const url = `/blog-module/blog-entries/${encodeURIComponent(post[0])}/article.html`;
                        const check = async () => {
                            const title = page.locator('article #article-title');
                            await title.waitFor({ state: 'visible', timeout: 15000 });
                            const text = await title.evaluate(node => { const copy = node.cloneNode(true); copy.querySelectorAll('[aria-hidden="true"]').forEach(child => child.remove()); return copy.textContent.trim(); });
                            assert.equal(text, mutate === 'article' ? 'B-18 incorrect title' : post[1]);
                            assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), `https://f1-stories.gr${url}`);
                            assert.equal(decodeURIComponent(new URL(page.url()).pathname), decodeURIComponent(url));
                            assert.ok(await page.locator('article[data-article-kind]').count());
                        };
                        await page.goto(origin + url, { waitUntil: 'load' }); await check();
                        await page.reload({ waitUntil: 'load' }); await check();
                        return 'index title canonical article marker and reload';
                    });
                }
                await runCase('article-greek-tau', async page => {
                    const target = '/blog-module/blog-entries/20260222T/article.html';
                    const html = fs.readFileSync(path.join(root, 'blog-module/blog-entries/20260227Τ/article.html'), 'utf8');
                    assert.match(html, /<link rel="canonical" href="https:\/\/f1-stories\.gr\/blog-module\/blog-entries\/20260222T\/article\.html">/);
                    await page.goto(origin + '/blog-module/blog-entries/20260227%CE%A4/article.html', { waitUntil: 'commit' });
                    await page.waitForURL(url => url.pathname === target, { timeout: 15000 });
                    await page.waitForLoadState('load');
                    await page.locator('article #article-title').waitFor({ state: 'visible', timeout: 15000 });
                    assert.ok((await page.locator('article #article-title').innerText()).trim());
                    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), `https://f1-stories.gr${target}`);
                    return 'retired hand-over and target heading; docs/search/article-url-policy.md';
                });
            }
        } catch (error) { add('B-18', 'browser-setup', 'all', 'NOT VERIFIED', error.message); process.exitCode = 1; }
        finally {
            const failure = error => { add('B-18','teardown','all','FAIL',String(error)); process.exitCode=1; };
            if (browser) await boundedClose(() => browser.close(), () => browser?.process?.()?.kill('SIGKILL')).catch(failure);
            if (server.listening) await boundedClose(() => new Promise((resolve,reject) => server.close(e => e ? reject(e) : resolve())), () => { server.closeAllConnections?.(); browser?.process?.()?.kill('SIGKILL'); }).catch(failure);
        }
        save();
    }
    clearTimeout(runTimer);
    process.exit(process.exitCode || 0);
}
