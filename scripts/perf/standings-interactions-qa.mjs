#!/usr/bin/env node
// Deterministic interaction regressions against the production artifact.
// The recorded provider subset is documented beside the fixture; no live API calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { Launcher } from 'chrome-launcher';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const root = path.resolve(repo, argument('root') || 'dist');
const widths = (argument('widths') || '390,768,1440').split(',').map(Number);
const themes = (argument('themes') || 'dark,light').split(',');
const output = path.resolve(repo, argument('output') || 'perf/step6-7-regressions.json');
const screenshots = argument('screenshots');
const fixture = JSON.parse(gunzipSync(fs.readFileSync(path.join(repo, 'scripts/perf/fixtures/standings-2026-10-15.json.gz'))));
const response = name => {
    const record = fixture.responses[name];
    assert.ok(record, `Missing recorded response: ${name}`);
    assert.equal(crypto.createHash('sha256').update(record.body).digest('hex'), record.sha256);
    return JSON.parse(record.body);
};
const sessions = response('openf1-sessions-2026').filter(record => [11731, 11384, 11388].includes(record.session_key));
const schedule = response('jolpica-schedule-2026');
schedule.MRData.RaceTable.Races = schedule.MRData.RaceTable.Races.filter(race => race.round === '17');
schedule.MRData.total = '1';
const mime = new Map([['.html', 'text/html'], ['.js', 'text/javascript'], ['.css', 'text/css'], ['.json', 'application/json'], ['.svg', 'image/svg+xml'], ['.woff2', 'font/woff2'], ['.avif', 'image/avif'], ['.webp', 'image/webp'], ['.png', 'image/png'], ['.jpg', 'image/jpeg']]);
const tabs = {
    drivers: '#drivers-table .st-row', constructors: '#constructors-table .st-row',
    'quali-gaps': '#qualifying-gaps-table .quali-gap-card', 'lap1-gains': '#lap1-gains-table .lap1-overview-card',
    'tyre-pace': '#tyre-pace-table .tyre-pace-svg', 'dirty-air': '#dirty-air-table .dirty-air-card',
    'track-dominance': '#track-dominance-table .track-dom-segment', 'pit-stops': '#pit-stops-table .pit-stops-card',
    debrief: '#debrief-table [data-debrief-select]'
};
const results = [];
const check = (name, condition, detail) => { assert.ok(condition, `${name}${detail ? `: ${detail}` : ''}`); };
const hash = text => crypto.createHash('sha256').update(text).digest('hex');

function startServer(artifactRoot = root) {
    const server = http.createServer((request, res) => {
        let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        if (pathname.endsWith('/')) pathname += 'index.html';
        const file = path.resolve(artifactRoot, `.${pathname}`);
        if (!file.startsWith(artifactRoot + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end('not found'); return; }
        res.writeHead(200, { 'content-type': `${mime.get(path.extname(file)) || 'application/octet-stream'}; charset=utf-8`, 'cache-control': 'no-store' });
        fs.createReadStream(file).pipe(res);
    });
    return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` })));
}

function providerPayload(url) {
    if (url.hostname === 'api.openf1.org') {
        const endpoint = url.pathname.split('/').pop();
        if (endpoint === 'sessions') {
            const type = url.searchParams.get('session_type');
            return sessions.filter(session => !type || session.session_type === type);
        }
        const keys = url.searchParams.getAll('session_key');
        if (endpoint === 'location') {
            const number = url.searchParams.get('driver_number');
            const record = fixture.responses[`openf1-location-${keys[0]}-${number}`];
            if (!record) return [];
            return JSON.parse(record.body).filter(sample => (!url.searchParams.get('date>') || Date.parse(sample.date) >= Date.parse(url.searchParams.get('date>'))) && (!url.searchParams.get('date<') || Date.parse(sample.date) <= Date.parse(url.searchParams.get('date<'))));
        }
        return keys.flatMap(key => {
            const lap = endpoint === 'laps' && url.searchParams.get('lap_number');
            const name = `openf1-${lap ? `lap${lap}` : endpoint}-${key}`;
            return fixture.responses[name] ? response(name) : [];
        });
    }
    if (url.hostname === 'api.jolpi.ca') {
        const match = url.pathname.match(/\/2026\/(17)\/(pitstops|results|qualifying)\.json$/);
        if (match) return response(`jolpica-${match[2]}-2026-17`);
        if (/\/2026\.json$/.test(url.pathname)) return schedule;
        if (/\/driverstandings\.json$/.test(url.pathname)) return response('jolpica-driverstandings-2026');
        if (/\/constructorstandings\.json$/.test(url.pathname)) return response('jolpica-constructorstandings-2026');
        throw new Error(`Unrecorded Jolpica endpoint ${url}`);
    }
    return null;
}

async function open(browser, origin, width, theme, query = '', options = {}) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    await context.addInitScript(value => {
        localStorage.setItem('f1stories-theme', value);
        localStorage.setItem('f1stories-cookie-consent-v1', JSON.stringify({ essential: true, analytics: false, ts: Date.now() }));
    }, theme);
    const requests = [];
    const errors = [];
    let failStints = !!options.failStints;
    await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin === origin) {
            if (options.failSnapshot && url.pathname === '/standings/standings-cache.json') return route.fulfill({ status: 503, body: 'fixture failure' });
            return route.continue();
        }
        if (['api.openf1.org', 'api.jolpi.ca'].includes(url.hostname)) {
            requests.push(url.toString());
            if (failStints && url.pathname.endsWith('/stints')) return route.fulfill({ status: 503, body: 'fixture failure' });
            try { return await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(providerPayload(url)) }); }
            catch (error) { errors.push(error.message); return route.fulfill({ status: 500, body: error.message }); }
        }
        return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/standings/${query}`, { waitUntil: 'load' });
    return { context, page, requests, errors, recover: () => { failStints = false; } };
}

async function selectTab(page, tab) {
    // The native selector is the mobile control; desktop tabs remain keyboard-tested below.
    const selector = page.locator('#standings-report-selector');
    if (await selector.isVisible()) await selector.selectOption(tab);
    else await page.locator(`.standings-tab[data-tab="${tab}"]`).click();
    await ready(page, tab);
}

async function ready(page, tab) {
    await page.locator(`#panel-${tab}.active`).waitFor({ state: 'visible' });
    await page.locator(tabs[tab]).first().waitFor({ state: 'attached', timeout: 15000 });
    // Module import/render callbacks complete before exercising the next interaction.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function tyreChecks(page, requests) {
    await selectTab(page, 'tyre-pace');
    const chartMarkup = () => page.locator('#tyre-pace-table .tyre-pace-svg').evaluateAll(nodes => nodes.map(node => node.outerHTML).join(''));
    const initial = await chartMarkup();
    const initialSummary = await page.locator('.tyre-pace-summary').textContent();
    const tyreRequests = () => requests.filter(url => new URL(url).hostname === 'api.openf1.org').length;
    const count = tyreRequests();
    const scroll = await page.evaluate(() => {
        window.__standingsTyreNode = document.querySelector('#tyre-pace-table').firstElementChild;
        const scroller = document.querySelector('#tyre-pace-table [data-horizontal-chart-scroll]');
        scroller.scrollLeft = 123;
        return scroller.scrollLeft;
    });
    await selectTab(page, 'drivers');
    await selectTab(page, 'tyre-pace');
    check('tyre revisit retains report node', await page.evaluate(() => document.querySelector('#tyre-pace-table').firstElementChild === window.__standingsTyreNode));
    check('tyre revisit retains horizontal position', await page.locator('#tyre-pace-table [data-horizontal-chart-scroll]').evaluate(el => el.scrollLeft) === scroll);
    check('tyre revisit retains exact SVG', await chartMarkup() === initial);
    check('tyre revisit retains data summary', await page.locator('.tyre-pace-summary').textContent() === initialSummary);
    check('tyre revisit needs no OpenF1 requests', tyreRequests() === count);
    await page.selectOption('[data-tyre-pace-select]', '11731');
    await page.waitForFunction(() => document.querySelector('.tyre-pace-select')?.value === '11731' && !!document.querySelector('.tyre-pace-svg'));
    check('new tyre session replaces old report', await page.evaluate(() => document.querySelector('#tyre-pace-table').firstElementChild !== window.__standingsTyreNode));
    check('new tyre session updates URL', new URL(page.url()).searchParams.get('tyreSession') === '11731');
    await page.selectOption('[data-tyre-pace-select]', '11388');
    await page.waitForFunction(() => document.querySelector('.tyre-pace-select')?.value === '11388' && !!document.querySelector('.tyre-pace-svg'));
    check('returning tyre session retains exact SVG', await chartMarkup() === initial);
    check('returning tyre session retains data summary', await page.locator('.tyre-pace-summary').textContent() === initialSummary);
    return { svgSha256: hash(initial), scrollLeft: scroll, lapMarkers: await page.locator('.tyre-pace-dot').count() };
}

async function matrixChecks(browser, origin, width, theme) {
    const state = await open(browser, origin, width, theme);
    const { page } = state;
    try {
        const svgHashes = {};
        for (const tab of Object.keys(tabs)) {
            await selectTab(page, tab);
            check(`${tab}: exactly one selected tab`, await page.locator('.standings-tab[aria-selected="true"]').count() === 1);
            check(`${tab}: active panel is not hidden`, await page.locator(`#panel-${tab}`).getAttribute('hidden') === null);
            check(`${tab}: URL state`, new URL(page.url()).searchParams.get('tab') === tab || tab === 'drivers');
            svgHashes[tab] = hash(await page.locator(`#panel-${tab} svg`).evaluateAll(nodes => nodes.map(node => node.outerHTML).join('')));
            if (screenshots) {
                fs.mkdirSync(screenshots, { recursive: true });
                await page.locator(`#panel-${tab}`).screenshot({ path: path.join(screenshots, `${theme}-${width}-${tab}.png`), animations: 'disabled' });
            }
        }
        const actualTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
        check('theme persistence', actualTheme === theme);
        await selectTab(page, 'drivers');
        if (await page.locator('.standings-tabs').isVisible()) {
            await page.locator('#tab-drivers').focus();
            await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
            await ready(page, 'constructors');
            check('desktop keyboard tab navigation', await page.locator('#tab-constructors').getAttribute('aria-selected') === 'true');
            await selectTab(page, 'drivers');
        }
        const row = page.locator('#drivers-table .st-row[tabindex="0"]').first();
        await row.focus(); await page.keyboard.press('Enter');
        check('standings keyboard details expand', await row.getAttribute('aria-expanded') === 'true');
        await page.keyboard.press('Enter');
        check('standings keyboard details collapse', await row.getAttribute('aria-expanded') === 'false');
        await selectTab(page, 'quali-gaps');
        await page.locator('[data-quali-view="race-detail"]').click();
        check('qualifying detail selection', new URL(page.url()).searchParams.get('qualiView') === 'race-detail');
        check('qualifying session controls', await page.locator('[data-quali-race-select] option').count() === 1);
        await selectTab(page, 'lap1-gains');
        await page.locator('[data-lap1-view="race-detail"]').click();
        check('lap-one detail selection', new URL(page.url()).searchParams.get('lap1View') === 'race-detail');
        check('lap-one detail populated', await page.locator('.lap1-race-driver-row, .lap1-race-rows > *').count() > 0);
        const tyre = await tyreChecks(page, state.requests);
        await selectTab(page, 'dirty-air');
        await page.locator('[data-dirty-air-view="timeline"]').click();
        check('dirty-air timeline populated', await page.locator('[data-dirty-air-panel="timeline"] .dirty-air-timeline-segment').count() > 0);
        const dirtyMarkup = await page.locator('[data-dirty-air-panel="timeline"]').innerHTML();
        const dirtyRequests = state.requests.length;
        const dirtyScroll = await page.evaluate(() => {
            window.__dirtyReport = document.querySelector('#dirty-air-table').firstElementChild;
            window.__dirtyTimeline = document.querySelector('.dirty-air-timeline-body');
            const scroller = document.querySelector('.dirty-air-timeline-scroll');
            scroller.scrollLeft = 123;
            return scroller.scrollLeft;
        });
        await selectTab(page, 'drivers');
        await selectTab(page, 'dirty-air');
        check('dirty-air view change retains report on revisit', await page.evaluate(() => document.querySelector('#dirty-air-table').firstElementChild === window.__dirtyReport));
        check('dirty-air view change retains timeline on revisit', await page.evaluate(() => document.querySelector('.dirty-air-timeline-body') === window.__dirtyTimeline));
        check('dirty-air revisit retains exact chart markup', await page.locator('[data-dirty-air-panel="timeline"]').innerHTML() === dirtyMarkup);
        check('dirty-air revisit retains scroll', await page.locator('.dirty-air-timeline-scroll').evaluate(el => el.scrollLeft) === dirtyScroll);
        check('dirty-air revisit needs no provider requests', state.requests.length === dirtyRequests);
        await page.locator('[data-dirty-air-view="summary"]').click();
        check('dirty-air summary restored', await page.locator('[data-dirty-air-panel="summary"]').isVisible());
        await selectTab(page, 'drivers');
        await selectTab(page, 'dirty-air');
        check('dirty-air summary change retains report on revisit', await page.evaluate(() => document.querySelector('#dirty-air-table').firstElementChild === window.__dirtyReport));
        await page.locator('[data-dirty-air-view="timeline"]').focus();
        await page.keyboard.press('Enter');
        check('dirty-air keyboard toggle reuses the timeline', await page.evaluate(() => document.querySelector('.dirty-air-timeline-body') === window.__dirtyTimeline));
        check('dirty-air keyboard toggle shows timeline', await page.locator('[data-dirty-air-panel="timeline"]').isVisible());
        for (let toggle = 0; toggle < 2; toggle++) {
            await page.locator('button.theme-toggle-btn:visible').first().click();
            check('dirty-air theme toggle retains timeline', await page.evaluate(() => document.querySelector('.dirty-air-timeline-body') === window.__dirtyTimeline));
        }
        check('dirty-air theme toggles restore original theme', await page.evaluate(() => document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark') === theme);
        const dirtySession = await page.inputValue('[data-dirty-air-select]');
        const otherDirtySession = await page.locator('[data-dirty-air-select] option').evaluateAll((options, selected) => options.find(option => option.value !== selected)?.value, dirtySession);
        check('dirty-air has a second recorded session', !!otherDirtySession);
        await page.selectOption('[data-dirty-air-select]', otherDirtySession);
        await page.locator('.dirty-air-timeline-body').waitFor({ state: 'attached' });
        check('dirty-air changed session replaces report', await page.evaluate(() => document.querySelector('#dirty-air-table').firstElementChild !== window.__dirtyReport));
        check('dirty-air changed session updates URL', new URL(page.url()).searchParams.get('dirtyAirSession') === otherDirtySession);
        await selectTab(page, 'track-dominance');
        check('track default map retains full segment count', await page.locator('.track-dom-segment').count() === 219);
        const segment = page.locator('.track-dom-segment').first();
        await segment.dispatchEvent('pointermove', { clientX: 200, clientY: 500 });
        check('track tooltip responds', await page.locator('[data-track-dom-tooltip]').getAttribute('class').then(value => value.includes('is-active')));
        await page.selectOption('[data-track-dom-driver="left"]', '44');
        await page.waitForFunction(() => document.querySelector('[data-track-dom-driver="left"]')?.value === '44' && document.querySelectorAll('.track-dom-segment').length === 219);
        check('track driver control updates URL and avoids duplicate drivers', new URL(page.url()).searchParams.get('trackTeamA') === '44' && await page.inputValue('[data-track-dom-driver="right"]') === '16');
        await selectTab(page, 'pit-stops');
        await page.locator('[data-pitstop-view="season"]').click();
        await page.locator('[data-pitstop-panel="season"] .pit-stops-team-row').first().waitFor({ state: 'attached', timeout: 5000 });
        check('pit season URL state', new URL(page.url()).searchParams.get('pitView') === 'season');
        await selectTab(page, 'debrief');
        for (const view of ['long-run', 'tyre-deg', 'team-ideal', 'corners', 'race-pace', 'single-lap']) {
            await page.locator(`[data-debrief-view="${view}"]`).click();
            check(`debrief ${view} switches panel`, await page.locator(`[data-debrief-panel="${view}"]`).isVisible());
        }
        const rounds = await page.locator('[data-debrief-select] option').evaluateAll(options => options.map(option => option.value));
        if (rounds.length > 1) {
            await page.selectOption('[data-debrief-select]', rounds[0]);
            check('debrief round updates URL', new URL(page.url()).searchParams.get('debriefRound') === rounds[0]);
        }
        const cacheSize = () => page.evaluate(async () => {
            const db = await new Promise((resolve, reject) => { const request = indexedDB.open('f1s-standings'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
            const count = await new Promise((resolve, reject) => { const request = db.transaction('kv').objectStore('kv').count(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
            db.close(); return count;
        });
        check('provider data populated IndexedDB', await cacheSize() > 0);
        await page.locator('#standings-clear-cache').click();
        await page.waitForFunction(() => !document.getElementById('standings-clear-cache').disabled);
        check('cache clear removes stored responses', await cacheSize() === 0);
        check('no uncaught page or fixture errors', state.errors.length === 0, state.errors.join('; '));
        return { width, theme, status: 'pass', tabs: Object.keys(tabs), svgHashes, tyre, providerRequests: state.requests.length };
    } finally { await state.context.close(); }
}

async function navigationChecks(browser, origin) {
    const state = await open(browser, origin, 768, 'light', '?tab=tyre-pace&tyreSession=11731&focus=panel-tyre-pace');
    try {
        await ready(state.page, 'tyre-pace');
        check('direct tyre link retains session', await state.page.inputValue('[data-tyre-pace-select]') === '11731');
        // The application intentionally replaces URL state while switching tabs.
        // Seed distinct history entries to exercise its popstate restoration.
        await state.page.evaluate(() => history.pushState({}, '', '?tab=constructors'));
        await state.page.reload(); await ready(state.page, 'constructors');
        await state.page.goBack(); await ready(state.page, 'tyre-pace');
        check('back restores selected session', await state.page.inputValue('[data-tyre-pace-select]') === '11731');
        await state.page.goForward(); await ready(state.page, 'constructors');
        check('forward restores selected tab', await state.page.locator('#tab-constructors').getAttribute('aria-selected') === 'true');
        check('navigation page errors', state.errors.length === 0, state.errors.join('; '));
    } finally { await state.context.close(); }
    for (const query of ['?tab=tyre-pace&tyreSession=11388&embed=1&focus=panel-tyre-pace', '?tab=drivers&embed=1&season=2026&round=1&focus=drivers-chart', '?tab=dirty-air&dirtyAirSession=11388&embed=1&focus=panel-dirty-air']) {
        const embedded = await open(browser, origin, 390, 'dark', query);
        try {
            const tab = new URLSearchParams(query).get('tab');
            await ready(embedded.page, tab);
            check('embed mode applied', await embedded.page.locator('body').getAttribute('class').then(value => value.includes('standings-embed')));
            check('embed footer opens full site', await embedded.page.locator('#embed-footer-link').getAttribute('target') === '_top');
            check('embed leaves dialog uninitialized', await embedded.page.locator('#embed-panels input').count() === 0 && !await embedded.page.locator('#embed-dialog').evaluate(dialog => dialog.open));
            if (tab === 'drivers') {
                check('pinned round stays pinned', await embedded.page.locator('#round-num').textContent() === '1');
                check('pinned footer names today', /Σημερινή/.test(await embedded.page.locator('#embed-footer-link').textContent()));
            } else if (tab === 'tyre-pace') check('embedded tyre session', await embedded.page.inputValue('[data-tyre-pace-select]') === '11388');
            else check('embedded dirty-air session', await embedded.page.inputValue('[data-dirty-air-select]') === '11388');
            check('embed page errors', embedded.errors.length === 0, embedded.errors.join('; '));
        } finally { await embedded.context.close(); }
    }
    const failure = await open(browser, origin, 390, 'dark', '?tab=tyre-pace', { failStints: true });
    try {
        await failure.page.locator('[data-standings-retry="__retryTyrePace"]').waitFor({ state: 'visible', timeout: 15000 });
        failure.recover();
        await failure.page.locator('[data-standings-retry="__retryTyrePace"]').click();
        await ready(failure.page, 'tyre-pace');
        check('retry recovers actual tyre chart', await failure.page.locator('.tyre-pace-dot').count() > 0);
        check('retry page errors', failure.errors.length === 0, failure.errors.join('; '));
    } finally { await failure.context.close(); }
    const fallback = await open(browser, origin, 1440, 'light', '', { failSnapshot: true });
    try {
        await ready(fallback.page, 'drivers');
        check('snapshot failure requests live standings', fallback.requests.some(url => url.includes('driverstandings.json')));
        check('snapshot fallback page errors', fallback.errors.length === 0, fallback.errors.join('; '));
    } finally { await fallback.context.close(); }
    return { status: 'pass', checks: ['deep link', 'back/forward', 'embedded tyre', 'pinned round', 'tyre failure/retry', 'snapshot fallback'] };
}

async function main() {
    check('public artifact exists', fs.existsSync(path.join(root, 'standings/index.html')));
    const started = await startServer();
    const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || Launcher.getFirstInstallation(), headless: true });
    try {
        for (const theme of themes) for (const width of widths) {
            try { results.push(await matrixChecks(browser, started.origin, width, theme)); }
            catch (error) { results.push({ width, theme, status: 'fail', error: error.stack }); }
            console.log(`${theme} ${width}px: ${results.at(-1).status}${results.at(-1).error ? ` ${results.at(-1).error.split('\n')[0]}` : ''}`);
        }
        try { results.push({ navigation: await navigationChecks(browser, started.origin), status: 'pass' }); }
        catch (error) { results.push({ navigation: true, status: 'fail', error: error.stack }); }
    } finally {
        await browser.close();
        started.server.closeAllConnections();
        await new Promise(resolve => started.server.close(resolve));
        fs.mkdirSync(path.dirname(output), { recursive: true });
        fs.writeFileSync(output, JSON.stringify({ fixture: fixture.scope, root, results }, null, 2) + '\n');
    }
    console.log(`${results.filter(result => result.status === 'pass').length}/${results.length} checks passed; ${output}`);
    if (results.some(result => result.status === 'fail')) process.exitCode = 1;
}
export { startServer, providerPayload, selectTab, ready };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch(error => { console.error(error); process.exitCode = 1; });
}
