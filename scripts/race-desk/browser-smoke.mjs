#!/usr/bin/env node
// Offline acceptance against a built static site; fixture classifications are synthetic.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { Launcher } from 'chrome-launcher';
import { build } from 'esbuild';
import { prepareMain } from '../deployment/assemble.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
const site = path.resolve(option('--site') || 'dist');
const reports = path.resolve(option('--reports') || '.build/race-desk-r02c');
const baseline = option('--baseline');
const layoutOnly = args.includes('--layout-only');
const assembled = args.includes('--assembled');
const enabled = JSON.parse(fs.readFileSync(path.join(repo, 'scripts/deployment/sources.json'))).enabled;
assert.equal(typeof enabled, 'boolean', 'deployment enabled flag must be boolean');
const fixture = JSON.parse(fs.readFileSync(path.join(repo, 'scripts/race-desk/__tests__/fixtures/browser-standings.v1.json')));
const registry = JSON.parse(fs.readFileSync(path.join(repo, 'data/race-desk/registry.v1.json')));
const urls = JSON.parse(fs.readFileSync(path.join(repo, 'scripts/race-desk/__tests__/fixtures/tool-urls.v1.json')));
fs.mkdirSync(reports, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'race-desk-qa-'));
let server, browser;
let servedRoot = site;
const result = { fixture: fixture.description, site, mode: enabled ? 'enabled' : 'disabled', assembled: assembled ? 'requested' : 'not applicable: Main-only artifact', checks: [], requests: {}, screenshots: [], errors: [] };
try {
    await build({ entryPoints: [path.join(repo, 'scripts/race-desk/core/navigation.mjs')], outfile: path.join(tmp, 'navigation.js'), bundle: true, format: 'esm', platform: 'browser' });
    fs.writeFileSync(path.join(tmp, 'sitemap.xml'), '<urlset></urlset>');
    prepareMain(tmp);
    const qaModule = fs.readFileSync(path.join(tmp, 'navigation.js'), 'utf8');
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
    server = http.createServer((req, res) => {
        let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        if (pathname.endsWith('/')) pathname += 'index.html';
        const file = path.resolve(servedRoot, '.' + pathname);
        if (!file.startsWith(servedRoot + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return res.writeHead(404).end('Not found');
        res.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
        fs.createReadStream(file).pipe(res);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || Launcher.getFirstInstallation(), headless: true });
    async function open({ width = 1440, theme = 'light', query = '', snapshot = fixture, live = fixture, failSnapshot = false, failLive = false, gateSnapshot = false, openF1 = false, gateModule = false, failModule = false } = {}) {
        const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce' });
        await context.addInitScript(theme => { window.__raceDeskCLS = 0; try { new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__raceDeskCLS += entry.value; }).observe({ type: 'layout-shift', buffered: true }); } catch { window.__raceDeskCLS = null; } try { localStorage.setItem('f1stories-theme', theme); localStorage.setItem('f1stories-cookie-consent-v1', JSON.stringify({ essential: true, analytics: false, ts: Date.now() })); } catch {} }, theme);
        const requests = [];
        const localRequests = [];
        const bodySizes = [];
        let releaseSnapshot, releaseModule;
        const moduleGate = gateModule ? new Promise(resolve => { releaseModule = resolve; }) : null;
        const snapshotGate = gateSnapshot ? new Promise(resolve => { releaseSnapshot = resolve; }) : null;
        await context.route('**/*', async route => {
            const url = new URL(route.request().url());
            if (url.origin === origin) {
                localRequests.push(url.href);
                if (url.pathname === '/standings/race-desk-navigation.min.js') {
                    if (moduleGate) await Promise.all([moduleGate, new Promise(resolve => setTimeout(resolve, 750))]);
                    if (failModule) return route.fulfill({ status: 503, body: 'synthetic module failure' });
                }
                if (url.pathname === '/__qa__/navigation.js') return route.fulfill({ contentType: 'text/javascript', body: qaModule });
                if (url.pathname === '/standings/standings-cache.json') {
                    if (snapshotGate) await snapshotGate;
                    return route.fulfill(failSnapshot ? { status: 503, body: 'synthetic failure' } : { contentType: 'application/json', body: JSON.stringify(snapshot) });
                }
                return route.continue();
            }
            requests.push(url.href);
            if (url.hostname === 'api.jolpi.ca') {
                if (failLive) return route.fulfill({ status: 503, body: 'synthetic failure' });
                const data = url.pathname.includes('constructorstandings') ? live.constructorStandings : live.driverStandings;
                return route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
            }
            if (url.hostname === 'api.openf1.org') {
                // Synthetic records exercise the fallback renderer, not a real classification.
                const endpoint = url.pathname.split('/').pop();
                const data = !openF1 ? [] : endpoint === 'sessions' ? [{ session_key: 123, date_start: '2026-01-01T00:00:00Z' }] : endpoint === 'championship_drivers' ? [{ driver_number: 99, position_current: 1, points_current: 25 }] : endpoint === 'championship_teams' ? [{ team_name: 'Test Team', position_current: 1, points_current: 25 }] : endpoint === 'drivers' ? [{ driver_number: 99, full_name: 'Test Driver', name_acronym: 'TST', team_name: 'Test Team' }] : [];
                return route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
            }
            return route.abort();
        });
        const page = await context.newPage();
        page.on('pageerror', error => result.errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error' && /Content Security Policy|Refused to (?:load|execute|frame|connect|apply)/i.test(message.text())) result.errors.push('CSP: ' + message.text()); });
        page.on('response', response => {
            const url = new URL(response.url());
            if (url.origin === origin && /\.(?:html|js)$/.test(url.pathname) || url.origin === origin && url.pathname.endsWith('/')) {
                bodySizes.push(response.body().then(body => ({ url: url.pathname, bytes: body.length })).catch(() => null));
            }
        });
        await page.goto(origin + '/standings/' + query, { waitUntil: 'domcontentloaded' });
        return { page, context, requests, localRequests, bodySizes, releaseSnapshot, releaseModule, failNextSnapshot: () => { failSnapshot = true; } };
    }
    const href = (page, tool) => page.locator(`[data-race-desk-tool="${tool}"]`).getAttribute('href');
    const waitHref = (page, expected) => page.waitForFunction(expected => document.querySelector('[data-race-desk-tool="tyres"]') && new URL(document.querySelector('[data-race-desk-tool="tyres"]').href).pathname === expected, expected);
    const test = async (name, fn) => { try { await fn(); result.checks.push(name); } catch (error) { result.errors.push(`${name}: ${error.stack || error}`); } };
    // Before enhancement, standalone Main and the assembled site have different,
    // audited native links. Check exact origins and paths, not inferred provider data.
    const staticRoots = {
        tyres: ['https://georgiosbalatzis.github.io/Tyres/', origin + '/tyres/'],
        telemetry: ['https://georgiosbalatzis.github.io/f1-telemetry-dashboard/', origin + '/telemetry/'],
        ghostcar: ['https://georgiosbalatzis.github.io/ghostcar/', origin + '/ghostcar/']
    };
    const assertStaticRoots = async page => {
        for (const tool of Object.keys(staticRoots)) {
            const actual = new URL(await href(page, tool), origin).href;
            assert.ok(staticRoots[tool].includes(actual), `${tool}: unexpected static URL ${actual}`);
        }
    };
    if (enabled) {
    const waitModuleRequest = async run => {
        const end = Date.now() + 5000;
        while (!run.localRequests.some(url => new URL(url).pathname === '/standings/race-desk-navigation.min.js') && Date.now() < end) await new Promise(resolve => setTimeout(resolve, 20));
        assert.ok(run.localRequests.some(url => new URL(url).pathname === '/standings/race-desk-navigation.min.js'), 'optional entry was not requested');
    };
    for (const tab of ['drivers', 'constructors', 'quali-gaps']) {
        const delayed = await open({ gateModule: true, failLive: true });
        await test(`fast snapshot before delayed optional module: ${tab}`, async () => {
            await delayed.page.locator('#drivers-table .st-row').first().waitFor();
            await waitModuleRequest(delayed);
            await assertStaticRoots(delayed.page);
            if (tab !== 'drivers') await delayed.page.locator(`.standings-tab[data-tab="${tab}"]`).click();
            assert.equal(await delayed.page.locator('.standings-tab[aria-selected="true"]').getAttribute('data-tab'), tab);
            await assertStaticRoots(delayed.page);
            const moduleResponse = delayed.page.waitForResponse(response => new URL(response.url()).pathname === '/standings/race-desk-navigation.min.js');
            delayed.releaseModule();
            assert.equal((await moduleResponse).status(), 200);
            await waitHref(delayed.page, tab === 'drivers' ? '/tyres/2026/suzuka/' : tab === 'constructors' ? '/tyres/2026/sepang/' : '/tyres/');
            if (tab === 'quali-gaps') await delayed.page.waitForFunction(() => document.querySelector('[data-race-desk-tool="tyres"]').href === 'https://f1-stories.gr/tyres/');
            if (tab === 'quali-gaps') {
                await delayed.page.locator('.standings-tab[data-tab="constructors"]').click();
                await waitHref(delayed.page, '/tyres/2026/sepang/');
            }
        });
        if (delayed.releaseModule) delayed.releaseModule();
        result.requests[`delayed-${tab}`] = delayed.requests; await delayed.context.close();
    }
    const failedModule = await open({ failModule: true, failLive: true });
    await test('optional module failure preserves static links and notice', async () => {
        await failedModule.page.locator('#drivers-table .st-row').first().waitFor();
        await waitModuleRequest(failedModule);
        await assertStaticRoots(failedModule.page);
        assert.ok(await failedModule.page.locator('.race-desk-context-note').isVisible());
        assert.match(await failedModule.page.locator('#race-desk-tyres-context').textContent(), /επιλέξεις/);
    });
    result.requests.failedModule = failedModule.requests; await failedModule.context.close();
    const a = await open({ gateSnapshot: true, failLive: true });
    await test('delayed snapshot, separate table metadata, history and refresh failure', async () => {
        await assertStaticRoots(a.page);
        a.releaseSnapshot();
        await waitHref(a.page, '/tyres/2026/suzuka/');
        const desk = a.page.getByRole('navigation', { name: 'Race Desk' });
        assert.deepEqual((await desk.locator('a').allTextContents()).map(t => t.trim()), ['THE GRID', 'TELEMETRY', 'GHOST CAR', 'TYRES']);
        assert.equal(await desk.locator('[aria-current="page"]').count(), 1);
        assert.equal(new URL(await href(a.page, 'telemetry'), origin).pathname, '/telemetry/');
        assert.equal(new URL(await href(a.page, 'ghostcar'), origin).pathname, '/ghostcar/');
        for (const tool of ['tyres', 'telemetry', 'ghostcar']) assert.ok(await a.page.locator(`[data-race-desk-tool="${tool}"]`).getAttribute('aria-describedby'));
        assert.ok(await a.page.locator('.race-desk-context-note[aria-live="polite"]').isVisible());
        assert.match(await a.page.locator('#race-desk-tyres-context').textContent(), /TYRES/);
        assert.match(await a.page.locator('#race-desk-openf1-context').textContent(), /επιλέξεις/);
        await a.page.locator('.standings-tab[data-tab="constructors"]').click();
        await waitHref(a.page, '/tyres/2026/sepang/');
        // Tab changes replace the current URL; seed an extra entry to exercise real popstate.
        await a.page.evaluate(() => history.pushState({}, '', location.href));
        await a.page.locator('.standings-tab[data-tab="quali-gaps"]').click();
        await waitHref(a.page, '/tyres/');
        await a.page.goBack(); await waitHref(a.page, '/tyres/2026/sepang/');
        await a.page.goForward(); await waitHref(a.page, '/tyres/');
        await a.page.goBack(); await waitHref(a.page, '/tyres/2026/sepang/');
        for (const tab of ['lap1-gains', 'tyre-pace', 'dirty-air', 'track-dominance', 'pit-stops', 'debrief']) {
            await a.page.locator(`.standings-tab[data-tab="${tab}"]`).click();
            await waitHref(a.page, '/tyres/');
        }
        await a.page.locator('.standings-tab[data-tab="constructors"]').click();
        await waitHref(a.page, '/tyres/2026/sepang/');
        await a.page.reload(); await waitHref(a.page, '/tyres/2026/sepang/');
        await a.page.waitForTimeout(4500); await waitHref(a.page, '/tyres/2026/sepang/');
        const link = a.page.locator('[data-race-desk-tool="tyres"]');
        await link.focus(); assert.equal(await link.evaluate(el => document.activeElement === el), true);
        assert.equal(await link.evaluate(el => el.tagName), 'A');
        const modifier = await link.evaluate(el => {
            let prevented;
            window.addEventListener('click', event => { prevented = event.defaultPrevented; event.preventDefault(); }, { once: true });
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true, metaKey: true }));
            return prevented;
        });
        assert.equal(modifier, false);
    });
    result.requests.main = a.requests; await a.context.close();
    const unknown = structuredClone(fixture);
    for (const key of ['driverStandings', 'constructorStandings']) { const table = unknown[key].MRData.StandingsTable; table.round = '18'; table.StandingsLists[0].round = '18'; }
    const b = await open({ snapshot: unknown, live: unknown });
    await test('unknown round remains generic', async () => { await b.page.locator('#drivers-table .st-row').first().waitFor(); await waitHref(b.page, '/tyres/'); });
    result.requests.unknown = b.requests; await b.context.close();
    const unchanged = await open({ live: fixture });
    await test('unchanged live payload retains each table scope', async () => {
        await waitHref(unchanged.page, '/tyres/2026/suzuka/');
        await unchanged.page.waitForTimeout(4500);
        await waitHref(unchanged.page, '/tyres/2026/suzuka/');
        await unchanged.page.locator('.standings-tab[data-tab="constructors"]').click();
        await waitHref(unchanged.page, '/tyres/2026/sepang/');
    });
    result.requests.unchanged = unchanged.requests; await unchanged.context.close();
    for (const openF1 of [false, true]) {
        const fallback = await open({ failSnapshot: !openF1, failLive: true, openF1 });
        if (openF1) {
            await waitHref(fallback.page, '/tyres/2026/suzuka/');
            fallback.failNextSnapshot();
            await fallback.page.reload({ waitUntil: 'domcontentloaded' });
        }
        await test(openF1 ? 'OpenF1 fallback after reload clears previously visible scope' : 'initial provider failures retain generic links', async () => {
            await fallback.page.locator(openF1 ? '#drivers-table .st-row' : '#drivers-table .standings-error').first().waitFor({ timeout: 15000 });
            await waitHref(fallback.page, '/tyres/');
            assert.equal(new URL(await href(fallback.page, 'telemetry'), origin).pathname, '/telemetry/');
            assert.equal(new URL(await href(fallback.page, 'ghostcar'), origin).pathname, '/ghostcar/');
        });
        result.requests[openF1 ? 'openf1' : 'failure'] = fallback.requests; await fallback.context.close();
    }
    const embed = await open({ query: '?embed=1', gateSnapshot: true });
    const embedLinksBefore = await Promise.all(['tyres', 'telemetry', 'ghostcar'].map(tool => href(embed.page, tool)));
    embed.releaseSnapshot();
    await test('embed hides navigation', async () => { await embed.page.locator('#drivers-table .st-row').first().waitFor(); assert.equal(await embed.page.getByRole('navigation', { name: 'Race Desk', includeHidden: true }).isVisible(), false); assert.equal(await embed.page.locator('.race-desk-context-note').isVisible(), false);
        assert.deepEqual(await Promise.all(['tyres', 'telemetry', 'ghostcar'].map(tool => href(embed.page, tool))), embedLinksBefore); await embed.page.waitForTimeout(100); assert.equal(embed.localRequests.filter(url => new URL(url).pathname === '/standings/race-desk-navigation.min.js').length, 0); });
    result.requests.embed = embed.requests; await embed.context.close();
    const parser = await open();
    await test('assembled rewrite preserves legacy URL parsing and synthetic round trip', async () => {
        const outcome = await parser.page.evaluate(async ({ registry, urls }) => {
            const { parseToolUrl, planToolLink } = await import('/__qa__/navigation.js');
            const opts = { currentYear: 2026 };
            const legacy = parseToolUrl(registry, urls.legacy.tyres, opts);
            const copy = structuredClone(registry);
            copy.sources.push({ id: 'synthetic-openf1', repository: 'synthetic/test', revision: 'a'.repeat(40), path: 'fixture.json', gitBlob: 'b'.repeat(40), reviewedAt: '2026-01-01T00:00:00.000Z' });
            const race = copy.races.find(r => r.raceId === '2026-japanese-gp');
            const claim = (field, value) => ({ field, value, sourceId: 'synthetic-openf1', reference: '/fixture', status: 'verified' });
            race.sourceKeys.openf1MeetingKey = 1234; race.evidence.push(claim('sourceKeys.openf1MeetingKey', 1234));
            race.sessions[0].openf1SessionKey = 5678; race.sessions[0].evidence.push(claim('openf1SessionKey', 5678));
            const fact = { season: 2026, openf1MeetingKey: 1234, circuitShortName: 'Suzuka Test', sourceId: 'synthetic-openf1', reference: '/fixture/circuit', status: 'verified' };
            const options = { ...opts, telemetryCircuit: fact };
            const parsed = parseToolUrl(copy, urls.legacy.ghostcar, options);
            const plan = parsed.status === 'resolved' && planToolLink(copy, parsed.context, 'telemetry', options);
            const back = plan && parseToolUrl(copy, plan.url, options);
            return { legacy, parsed, plan, back };
        }, { registry, urls });
        assert.equal(outcome.legacy.status, 'resolved'); assert.equal(outcome.parsed.status, 'resolved'); assert.equal(outcome.plan.kind, 'exact'); assert.deepEqual(outcome.back.context, outcome.parsed.context);
    });
    result.requests.parser = parser.requests; await parser.context.close();
    // The reserved notice height must hold while switching between verified rounds.
    result.geometry = [];
    for (const theme of ['light', 'dark']) {
        const run = await open({ width: 768, theme, failLive: true });
        await test(`context changes preserve header geometry at 768 ${theme}`, async () => {
            await waitHref(run.page, '/tyres/2026/suzuka/');
            await run.page.evaluate(() => document.fonts.ready);
            const measure = () => run.page.evaluate(() => ({ titleTop: document.querySelector('h1').getBoundingClientRect().top, noticeHeight: document.querySelector('.race-desk-context-note').getBoundingClientRect().height }));
            const japanese = await measure();
            const selectTab = async tab => {
                if (await run.page.locator('#standings-report-selector').isVisible()) await run.page.locator('#standings-report-selector').selectOption(tab);
                else await run.page.locator(`.standings-tab[data-tab="${tab}"]`).click();
            };
            await selectTab('constructors');
            await waitHref(run.page, '/tyres/2026/sepang/');
            const bahrain = await measure();
            await selectTab('drivers');
            await waitHref(run.page, '/tyres/2026/suzuka/');
            const returned = await measure();
            result.geometry.push({ width: 768, theme, japanese, bahrain, returned });
            for (const next of [bahrain, returned]) {
                assert.ok(Math.abs(next.titleTop - japanese.titleTop) <= 1, `title moved: ${JSON.stringify({ japanese, next })}`);
                assert.ok(Math.abs(next.noticeHeight - japanese.noticeHeight) <= 1, `notice resized: ${JSON.stringify({ japanese, next })}`);
            }
        });
        await run.context.close();
    }
    if (assembled) {
        for (const item of [
            // Pinned TYRES data/overrides/2026/2026-jp.json overrides its generated circuit label.
            { tab: 'drivers', path: '/tyres/2026/suzuka/', id: '2026-jp', title: 'Japanese Grand Prix', venue: 'Suzuka Circuit' },
            { tab: 'constructors', path: '/tyres/2026/sepang/', id: '2026-bh', title: 'Bahrain Grand Prix', venue: 'Sepang International Circuit' }
        ]) {
            const run = await open({ failLive: true });
            await test(`assembled TYRES selects ${item.title} at ${item.venue}`, async () => {
                await waitHref(run.page, '/tyres/2026/suzuka/');
                if (item.tab === 'constructors') await run.page.locator('.standings-tab[data-tab="constructors"]').click();
                await waitHref(run.page, item.path);
                const derived = new URL(await href(run.page, 'tyres'), origin);
                assert.equal(derived.origin, 'https://f1-stories.gr');
                assert.equal(derived.pathname, item.path);
                const response = await run.page.goto(origin + derived.pathname, { waitUntil: 'domcontentloaded' });
                assert.equal(response.status(), 200);
                await run.page.waitForFunction(expected => document.querySelector('#race')?.value === expected, item.id);
                assert.equal(await run.page.locator('#year').inputValue(), '2026');
                assert.equal(await run.page.locator('#race-title').textContent(), item.title);
                assert.match(await run.page.locator('.hero-meta').textContent(), new RegExp(item.venue));
                assert.equal(new URL(run.page.url()).pathname, item.path);
            });
            result.requests[`assembled-${item.id}`] = run.requests;
            await run.context.close();
        }
        result.assembled = 'TYRES child identity checks executed';
    }
    } else {
        assert.equal(assembled, false, '--assembled requires the enabled deployment');
        const control = await open({ failLive: true });
        const rollback = await open({ failLive: true });
        await test('disabled projection keeps original links and notice through data, tabs, history and reload', async () => {
            const originalLinks = await Promise.all(['tyres', 'telemetry', 'ghostcar'].map(tool => href(rollback.page, tool)));
            await assertStaticRoots(rollback.page);
            const originalNotice = await rollback.page.locator('.race-desk-context-note').textContent();
            await Promise.all([control.page.locator('#drivers-table .st-row').first().waitFor(), rollback.page.locator('#drivers-table .st-row').first().waitFor()]);
            await Promise.all([control.page.waitForTimeout(4500), rollback.page.waitForTimeout(4500)]);
            const providers = run => run.requests.filter(url => /https:\/\/(?:api\.jolpi\.ca|api\.openf1\.org)\//.test(url)).toSorted();
            assert.deepEqual(providers(rollback), providers(control), 'disabled mode must not make extra provider requests');
            const beforeTabs = providers(rollback);
            const checkStatic = async () => {
                assert.deepEqual(await Promise.all(['tyres', 'telemetry', 'ghostcar'].map(tool => href(rollback.page, tool))), originalLinks);
                assert.equal(await rollback.page.locator('.race-desk-context-note').textContent(), originalNotice);
            };
            await checkStatic();
            await rollback.page.locator('.standings-tab[data-tab="constructors"]').click();
            await rollback.page.evaluate(() => history.pushState({}, '', location.href));
            await rollback.page.locator('.standings-tab[data-tab="drivers"]').click();
            await rollback.page.goBack();
            await rollback.page.waitForFunction(() => document.querySelector('.standings-tab[aria-selected="true"]')?.dataset.tab === 'constructors');
            await checkStatic();
            await rollback.page.goForward();
            await rollback.page.waitForFunction(() => document.querySelector('.standings-tab[aria-selected="true"]')?.dataset.tab === 'drivers');
            await checkStatic();
            assert.deepEqual(providers(rollback), beforeTabs, 'tab/history changes must not request providers');
            await rollback.page.reload({ waitUntil: 'domcontentloaded' });
            await rollback.page.locator('#drivers-table .st-row').first().waitFor();
            await checkStatic();
        });
        result.requests.disabled = rollback.requests;
        await control.context.close(); await rollback.context.close();
    }
    // One matched capture per artifact, viewport and theme. These are observed values,
    // not performance claims; local HTML/JS bytes are decoded response body lengths.
    result.measurements = {};
    for (const [label, root] of [...(!layoutOnly && baseline ? [['baseline', path.resolve(baseline)]] : []), ['candidate', site]]) {
        assert.ok(fs.statSync(root).isDirectory(), `${label} must be a built artifact directory`);
        servedRoot = root;
        result.measurements[label] = [];
        for (const theme of ['light', 'dark']) for (const width of (layoutOnly ? [768] : [390, 576, 768, 1440])) {
            const run = await open({ width, theme, failLive: true });
            await run.page.locator('#drivers-table .st-row').first().waitFor({ timeout: 15000 });
            await run.page.evaluate(() => document.fonts.ready);
            await run.page.waitForLoadState('load');
            // Include the scheduled 3.5-second live refresh in both samples.
            await run.page.waitForTimeout(4200);
            const metrics = await run.page.evaluate(() => {
                const navigation = performance.getEntriesByType('navigation')[0];
                return { loadMs: navigation?.loadEventEnd || null, cls: window.__raceDeskCLS ?? null };
            });
            const bodies = (await Promise.all(run.bodySizes)).filter(Boolean);
            const file = `${label}-${width}-${theme}.png`;
            await run.page.screenshot({ path: path.join(reports, file), fullPage: true });
            result.screenshots.push(file);
            result.measurements[label].push({ width, theme, localRequests: run.localRequests.length, providerRequests: run.requests.filter(url => /https:\/\/(?:api\.jolpi\.ca|api\.openf1\.org)\//.test(url)).length, otherThirdPartyRequests: run.requests.filter(url => !/https:\/\/(?:api\.jolpi\.ca|api\.openf1\.org)\//.test(url)).length, htmlJsBytes: bodies.reduce((sum, entry) => sum + entry.bytes, 0), htmlJsBodies: bodies, ...metrics });
            await run.context.close();
        }
    }
    assert.deepEqual(result.errors, []);
} catch (error) { result.errors.push(error.stack || String(error)); process.exitCode = 1; }
finally {
    if (browser) await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.writeFileSync(path.join(reports, 'browser-smoke.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ checks: result.checks, screenshots: result.screenshots, errors: result.errors }, null, 2));
}
