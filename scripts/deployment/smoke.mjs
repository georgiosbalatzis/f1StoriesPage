// Production static output, one server/origin; deterministic API recordings, no live API claims.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const site = path.resolve(option('--site') || '.build/priority6/site');
const reports = path.resolve(option('--reports') || '.build/priority6/reports');
const baseline = option('--baseline');
let servedRoot = site;
fs.mkdirSync(reports, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.avif': 'image/avif', '.glb': 'model/gltf-binary' };
const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const root = path.resolve(servedRoot);
    let file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
        if (!pathname.endsWith('/')) { res.writeHead(301, { Location: pathname + '/' + new URL(req.url, 'http://localhost').search }).end(); return; }
        file = path.join(file, 'index.html');
    }
    if (pathname === '/__p6-sw-root.js' || pathname === '/telemetry/__p6-sw.js') {
        res.writeHead(200, { 'Content-Type': 'text/javascript' }).end('self.addEventListener("install", () => self.skipWaiting());'); return;
    }
    const exists = fs.existsSync(file) && fs.statSync(file).isFile();
    if (!exists) file = path.join(root, '404.html');
    res.writeHead(exists ? 200 : 404, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    if (fs.existsSync(file)) res.end(fs.readFileSync(file)); else res.end('Not found');
});
await new Promise(resolve => server.listen(Number(option('--port') || 0), '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const executablePath = process.env.CHROME_PATH || (fs.existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome') ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined);
const browser = await chromium.launch({ executablePath, headless: true, args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const failures = [];
const results = { origin, directLoads: [], themes: [], navigation: [], visuals: [], performance: [], accessibility: [], flows: [] };
if (option('--flow-report')) {
    const previous = JSON.parse(fs.readFileSync(option('--flow-report')));
    results.flows = JSON.parse(JSON.stringify(previous.flows).replaceAll(previous.origin, origin));
}
const ghost = JSON.parse(fs.readFileSync(path.join(here, 'fixtures/ghostcar.json')));
const betcast = JSON.parse(fs.readFileSync(path.join(here, 'fixtures/betcast.json')));
const fastestLap = number => ghost.laps[number].filter(lap => lap.lap_duration > 0).reduce((best, lap) => lap.lap_duration < best.lap_duration ? lap : best).lap_number;
const ghostQuery = `?y=${ghost.meeting.year}&mk=${ghost.meeting.meeting_key}&sk=${ghost.session.session_key}&d1=1&d2=4&l1=${fastestLap('1')}&l2=${fastestLap('4')}&v=2`;
const telemetryQuery = '?year=2025&circuit=Monza&session=9912&drivers=1,4&lap=52&tab=telemetry';
const betcastQuery = '?viz=dataTable&from=2&to=4&week=3&cmpA=2&cmpB=3';

async function createPage(os = 'light', width = 1440) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: os, reducedMotion: 'reduce' });
    // Third-party requests are deterministic; no analytics opt-in, posting or external sharing.
    await context.route('https://api.openf1.org/**', async route => {
        const url = new URL(route.request().url());
        let body = [];
        if (route.request().frame().url().includes('/ghostcar/')) {
            const number = url.searchParams.get('driver_number');
            const endpoint = url.pathname.split('/').pop();
            body = endpoint === 'meetings' ? [ghost.meeting] : endpoint === 'sessions' ? [ghost.session] : endpoint === 'drivers' ? ghost.drivers : endpoint === 'laps' ? ghost.laps[number] || [] : endpoint === 'stints' ? ghost.stints[number] || [] : endpoint === 'location' ? ghost.location[number] || [] : endpoint === 'car_data' ? ghost.telemetry[number] || [] : [];
        } else {
            const file = path.join(here, 'fixtures/telemetry', createHash('sha1').update(url.href).digest('hex') + '.json');
            if (fs.existsSync(file)) {
                const data = JSON.parse(fs.readFileSync(file));
                await route.fulfill({ status: data.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: data.body }); return;
            }
        }
        await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    });
    await context.route(/https:\/\/(?:api\.jolpi\.ca|www\.youtube|www\.googletagmanager|docs\.google|.*googleusercontent|corsproxy|.*allorigins)\/.*/, route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await context.addInitScript(data => {
        try {
            sessionStorage.setItem('betcast_data_cache_current', data);
            sessionStorage.setItem('betcast_data_cache_ts_current', String(Date.now()));
        } catch {} // Third-party frames can deny storage; this is test seeding, not application behavior.
        // Avoid a real clipboard/share recipient; test the generated strings.
        window.__copied = [];
        window.__cls = 0;
        new PerformanceObserver(list => list.getEntries().forEach(entry => { if (!entry.hadRecentInput) window.__cls += entry.value; })).observe({ type: 'layout-shift', buffered: true });
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => window.__copied.push(text) } });
        Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    }, betcast.data);
    const page = await context.newPage();
    page.on('response', response => { if (response.url().startsWith(origin) && response.status() >= 400 && !response.url().includes('__invalid__')) failures.push({ url: response.url(), status: response.status() }); });
    page.on('pageerror', error => failures.push({ page: page.url(), error: error.message }));
    return { context, page };
}

async function open(page, pathname) {
    const response = await page.goto(origin + pathname, { waitUntil: 'domcontentloaded' });
    assert.equal(response.status(), 200, pathname);
    await page.locator(pathname.includes('/ghostcar/') && pathname.includes('embed=1') ? '.embed' : 'h1').first().waitFor();
    if (pathname.includes('betcast') || pathname.includes('BetCastVisualisation')) await page.locator('#chart-select').waitFor();
    await page.waitForTimeout(900);
    // Main's retired-worker cleanup can intentionally reload this document once.
    await page.locator(pathname.includes('/ghostcar/') && pathname.includes('embed=1') ? '.embed' : 'h1').first().waitFor();
    await page.evaluate(() => document.fonts.ready);
}
async function themeState(page) {
    return page.evaluate(() => ({ preference: localStorage.getItem('f1stories-theme'), resolved: document.documentElement.dataset.theme || (document.body.classList.contains('light-mode') ? 'light' : 'dark') }));
}
const products = [ ['main', '/', '/'], ['grid', '/standings/', '/standings/'], ['telemetry', '/telemetry/', '/f1-telemetry-dashboard/'], ['ghostcar', '/ghostcar/', '/ghostcar/'], ['betcast', '/betcast/', '/BetCastVisualisation/'] ];
try {
    if (!args.includes('--visual-only') && !args.includes('--external-only')) {
    // Preference is set through Main's UI, then carried naturally by same-origin navigation.
    for (const os of ['light', 'dark']) {
        const { context, page } = await createPage(os);
        await open(page, '/');
        for (const mode of ['light', 'dark', 'auto']) {
            const controls = await page.locator('[data-theme-choice]').all();
            if (controls.length) {
                const choice = page.locator(`[data-theme-choice="${mode}"]`);
                await choice.click({ force: true });
            } else {
                // Main exposes a binary toggle; auto remains the existing stored OS-following preference.
                if (mode === 'auto') await page.evaluate(() => localStorage.setItem('f1stories-theme', 'auto'));
                else {
                    const current = await themeState(page);
                    if (current.resolved !== mode) await page.locator('.theme-toggle-nav-btn').click();
                    else await page.evaluate(mode => localStorage.setItem('f1stories-theme', mode), mode);
                }
            }
            for (const [name, pathname] of products) {
                await open(page, pathname);
                const actual = await themeState(page);
                assert.equal(actual.preference, mode, `${name}: preference`);
                assert.equal(actual.resolved, mode === 'auto' ? os : mode, `${name}: resolution`);
                results.themes.push({ os, mode, name, ...actual });
            }
            await open(page, '/');
        }
        for (const [name, pathname] of products.filter(([name]) => ['telemetry', 'ghostcar', 'betcast'].includes(name))) {
            await open(page, pathname);
            const before = await themeState(page);
            const toggle = page.locator(name === 'betcast' ? '.theme-toggle' : name === 'ghostcar' ? '.masthead__theme' : '.nav-theme-toggle');
            if (await toggle.count()) await toggle.click(); else await page.getByRole('button', { name: /θέμα/i }).first().click();
            const after = await themeState(page);
            assert.notEqual(after.preference, before.preference);
            await open(page, '/');
            assert.equal((await themeState(page)).preference, after.preference);
            results.themes.push({ childToMain: name, preference: after.preference });
        }
        await context.close();
    }
    const { context, page } = await createPage();
    // Direct loads/reloads, selected query state, hashes and shell-free embed mode.
    for (const pathname of ['/', '/standings/', '/telemetry/', '/ghostcar/', '/betcast/', '/telemetry/' + telemetryQuery + '#telemetry-speed-trace', '/ghostcar/' + ghostQuery + '#replay', '/betcast/' + betcastQuery, '/telemetry/' + telemetryQuery + '&embed=1&theme=dark', '/ghostcar/' + ghostQuery + '&embed=1&th=dark', '/betcast/' + betcastQuery + '&embed=1&theme=dark']) {
        await open(page, pathname);
        console.log('Direct load', pathname);
        const first = page.url();
        const response = await page.reload({ waitUntil: 'domcontentloaded' });
        assert.equal(response.status(), 200);
        await page.locator(pathname.includes('/ghostcar/') && pathname.includes('embed=1') ? '.embed' : 'h1').first().waitFor();
        assert.equal(new URL(page.url()).pathname, new URL(first).pathname);
        const client = await context.newCDPSession(page);
        await client.send('Network.clearBrowserCache');
        await client.send('Page.reload', { ignoreCache: true });
        await page.waitForLoadState('domcontentloaded');
        await page.locator(pathname.includes('/ghostcar/') && pathname.includes('embed=1') ? '.embed' : 'h1').first().waitFor();
        await client.detach();
        results.directLoads.push({ pathname, first, refreshed: page.url(), hardReload: true });
    }
    // Navigation targets and current Race Desk item; actual clicks for each requested edge.
    const edges = [['/', '/standings/'], ['/', '/telemetry/'], ['/', '/ghostcar/'], ['/', '/betcast/'], ['/standings/', '/telemetry/'], ['/standings/', '/ghostcar/'], ['/telemetry/', '/standings/'], ['/telemetry/', '/ghostcar/'], ['/ghostcar/', '/standings/'], ['/ghostcar/', '/telemetry/'], ['/betcast/', '/']];
    for (const [from, to] of edges) {
        console.log('Navigation', from, to);
        await open(page, from);
        const legacy = await page.locator('a[href*="georgiosbalatzis.github.io"]').count();
        assert.equal(legacy, 0, `${from}: legacy navigation`);
        let link = page.locator(`a[href="${to}"]`).filter({ visible: true }).first();
        let via = null;
        if (!(await link.count()) && from === '/' && ['/telemetry/', '/ghostcar/'].includes(to)) {
            via = '/standings/';
            await page.locator('a[href="/standings/"]').filter({ visible: true }).first().click();
            await page.waitForURL(origin + '/standings/');
            link = page.locator(`a[href="${to}"]`).filter({ visible: true }).first();
        }
        assert.ok(await link.count(), `${from} → ${to}: no visible link`);
        const href = await link.getAttribute('href');
        // Main historically opens BetCast in another tab. Resolve it in this page for the one-origin smoke.
        await link.evaluate(el => el.removeAttribute('target'));
        await Promise.all([page.waitForURL(origin + to), link.click()]);
        results.navigation.push({ from, via, to, href, actual: page.url() });
    }
    for (const pathname of ['/standings/', '/telemetry/', '/ghostcar/']) {
        await open(page, pathname);
        const desk = page.getByRole('navigation', { name: 'Race Desk' });
        assert.deepEqual(await desk.locator('a').allTextContents(), ['THE GRID', 'TELEMETRY', 'GHOST CAR']);
        assert.equal(await desk.locator('[aria-current="page"]').count(), 1);
    }
    // Static route behavior: one Main 404; compatibility alias preserves state.
    await page.goto(origin + '/telemetry/__invalid__');
    assert.equal((await page.request.get(origin + '/ghostcar/__invalid__')).status(), 404);
    await page.goto(origin + '/f1telemetry/' + telemetryQuery + '#telemetry-speed-trace');
    await page.waitForURL(url => url.pathname === '/telemetry/');
    assert.equal(new URL(page.url()).hash, '#telemetry-speed-trace');
    assert.equal(new URL(page.url()).searchParams.get('lap'), '52');
    results.flows.push({ compatibilityRedirect: 'query/hash preserved', invalidNestedPaths: 'root 404' });

    for (const tab of ['telemetry', 'energy', 'trackmap', 'positions', 'intervals', 'tires', 'radio', 'incidents', 'weather', 'broadcast']) {
        await open(page, '/telemetry/' + telemetryQuery.replace('tab=telemetry', 'tab=' + tab));
        results.flows.push({ lazyTelemetryTab: tab, loaded: true });
    }
    await open(page, '/telemetry/' + telemetryQuery + '#telemetry-speed-trace');
    await page.getByRole('button', { name: 'Κοινοποίηση καρτέλας', exact: true }).click();
    await page.waitForFunction(() => window.__copied.length > 0);
    const telemetryShare = await page.evaluate(() => window.__copied.at(-1));
    assert.equal(new URL(telemetryShare).origin, origin);
    assert.equal(new URL(telemetryShare).pathname, '/telemetry/');
    assert.equal(new URL(telemetryShare).searchParams.get('lap'), '52');
    await page.getByRole('button', { name: 'Ενσωμάτωση καρτέλας', exact: true }).click();
    await page.waitForFunction(() => window.__copied.at(-1).startsWith('<iframe'));
    const telemetryEmbed = await page.evaluate(() => window.__copied.at(-1));
    assert.ok(telemetryEmbed.includes(origin + '/telemetry/'));
    assert.ok(telemetryEmbed.includes('embed=1'));
    results.flows.push({ telemetryShare, telemetryEmbed });

    await open(page, '/ghostcar/' + ghostQuery);
    await page.getByRole('slider', { name: 'Πρόοδος γύρου' }).waitFor();
    await page.getByRole('button', { name: 'Ενσωμάτωση', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    const ghostEmbed = await dialog.locator('textarea').inputValue();
    assert.ok(ghostEmbed.includes(origin + '/ghostcar/'));
    assert.ok(ghostEmbed.includes('embed=1'));
    assert.ok(ghostEmbed.includes('height="560"'));
    await page.keyboard.press('Escape');
    assert.equal(await dialog.count(), 0);
    results.flows.push({ ghostEmbed, dialogEscape: true });
    await open(page, '/ghostcar/' + ghostQuery + '&tv=3d');
    await page.waitForFunction(() => window.__ghostcar3d?.ready, { timeout: 30000 });
    const geometry = await page.evaluate(() => ({ triangles: window.__ghostcar3d.info().render.triangles, calls: window.__ghostcar3d.info().render.calls }));
    assert.ok(geometry.triangles > 0);
    assert.ok(await page.locator('canvas').count());
    results.flows.push({ ghost3D: geometry, modelUrl: '/ghostcar/f1car.glb' });

    await open(page, '/betcast/' + betcastQuery);
    await page.locator('.toolbar-share-group button:nth-child(2)').click();
    await page.waitForFunction(() => window.__copied.length > 0);
    const betcastShare = await page.evaluate(() => window.__copied.at(-1));
    assert.equal(new URL(betcastShare).origin, origin);
    assert.equal(new URL(betcastShare).pathname, '/betcast/');
    assert.equal(new URL(betcastShare).searchParams.get('week'), '3');
    await page.locator('.toolbar-share-group button:nth-child(3)').click();
    await page.waitForFunction(() => window.__copied.at(-1).startsWith('<iframe'));
    const betcastEmbed = await page.evaluate(() => window.__copied.at(-1));
    assert.ok(betcastEmbed.includes(origin + '/betcast/'));
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'CSV', exact: true }).click();
    const download = await downloadPromise;
    const csv = fs.readFileSync(await download.path());
    assert.deepEqual([...csv.subarray(0, 3)], [239, 187, 191]);
    assert.ok(csv.toString().includes('Ποντάρισμα (€)'));
    results.flows.push({ betcastShare, betcastEmbed, csvFilename: download.suggestedFilename(), csvRows: csv.toString().trim().split('\n').length - 1 });

    // Main cleanup removes only its retired root registration/cache; hypothetical child state survives.
    await open(page, '/');
    await page.evaluate(async () => {
        await navigator.serviceWorker.register('/__p6-sw-root.js', { scope: '/' });
        await navigator.serviceWorker.register('/telemetry/__p6-sw.js', { scope: '/telemetry/' });
        await caches.open('f1s-shell-v40');
        await caches.open('f1s-ghostcar-local-test');
    });
    await open(page, '/');
    await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistrations()).every(registration => registration.scope.endsWith('/telemetry/')));
    const workerState = await page.evaluate(async () => ({ scopes: (await navigator.serviceWorker.getRegistrations()).map(registration => new URL(registration.scope).pathname), caches: await caches.keys() }));
    assert.deepEqual(workerState.scopes, ['/telemetry/']);
    assert.ok(workerState.caches.includes('f1s-ghostcar-local-test'));
    assert.ok(!workerState.caches.includes('f1s-shell-v40'));
    results.flows.push({ workerCleanup: workerState });
    await context.close();
    }
    for (const mode of ['light', 'dark']) for (const width of [1440, 390]) for (const [name, pathname, oldPath] of products) {
        if (args.includes('--external-only')) continue;
        if (option('--product') && name !== option('--product')) continue;
        console.log('Visual', name, mode, width);
        const { context, page } = await createPage(mode, width);
        const query = name === 'ghostcar' ? ghostQuery : name === 'telemetry' ? telemetryQuery : name === 'betcast' ? betcastQuery : '';
        await open(page, pathname + query);
        await page.evaluate(mode => localStorage.setItem('f1stories-theme', mode), mode);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.locator(pathname.includes('/ghostcar/') && pathname.includes('embed=1') ? '.embed' : 'h1').first().waitFor();
        if (name === 'betcast') await page.locator('#chart-select').waitFor();
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(async () => { const elements = [document.body, ...document.querySelectorAll('h1,h2,p,td,button,select')]; await Promise.all(elements.map(el => { const style = getComputedStyle(el); return document.fonts.load(`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`, el.textContent || 'Τηλεμετρία'); })); await document.fonts.ready; });
        await page.mouse.move(0, 899);
        await page.waitForTimeout(1800);
        if (name === 'main') {
            await page.waitForLoadState('networkidle');
            await page.locator('#hero-image').evaluate(image => image.decode());
        }
        const perf = await page.evaluate(() => ({ resources: performance.getEntriesByType('resource').filter(r => new URL(r.name).origin === location.origin).length, jsBytes: performance.getEntriesByType('resource').filter(r => r.name.match(/\.js(?:\?|$)/)).reduce((sum, r) => sum + r.decodedBodySize, 0), cssBytes: performance.getEntriesByType('resource').filter(r => r.name.match(/\.css(?:\?|$)/)).reduce((sum, r) => sum + r.decodedBodySize, 0), cls: window.__cls, overflowing: document.documentElement.scrollWidth > innerWidth }));
        assert.equal(perf.overflowing, false, `${name}/${width}: page overflow`);
        results.performance.push({ name, mode, width, ...perf });
        const file = path.join(reports, `${name}-${mode}-${width}.png`);
        await page.screenshot({ path: file, animations: 'disabled' });
        let diff = null;
        if (baseline) {
            servedRoot = path.resolve(baseline);
            await open(page, oldPath + query);
            await page.evaluate(async () => { const elements = [document.body, ...document.querySelectorAll('h1,h2,p,td,button,select')]; await Promise.all(elements.map(el => { const style = getComputedStyle(el); return document.fonts.load(`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`, el.textContent || 'Τηλεμετρία'); })); await document.fonts.ready; });
        await page.mouse.move(0, 899);
        await page.waitForTimeout(1800);
            if (name === 'main') {
                await page.waitForLoadState('networkidle');
                await page.locator('#hero-image').evaluate(image => image.decode());
            }
            results.performance.at(-1).baseline = await page.evaluate(() => ({
                resources: performance.getEntriesByType('resource').filter(r => new URL(r.name).origin === location.origin).length,
                jsBytes: performance.getEntriesByType('resource').filter(r => r.name.match(/\.js(?:\?|$)/)).reduce((sum, r) => sum + r.decodedBodySize, 0),
                cssBytes: performance.getEntriesByType('resource').filter(r => r.name.match(/\.css(?:\?|$)/)).reduce((sum, r) => sum + r.decodedBodySize, 0),
                cls: window.__cls,
            }));
            const oldFile = path.join(reports, `${name}-${mode}-${width}-baseline.png`);
            await page.screenshot({ path: oldFile, animations: 'disabled' });
            const oldBuffer = await sharp(oldFile).ensureAlpha().raw().toBuffer();
            const newBuffer = await sharp(file).ensureAlpha().raw().toBuffer();
            assert.equal(oldBuffer.length, newBuffer.length);
            let changed = 0;
            for (let i = 0; i < oldBuffer.length; i += 4) if (oldBuffer.subarray(i, i + 4).compare(newBuffer.subarray(i, i + 4)) !== 0) changed++;
            diff = { changedPixels: changed, fraction: changed / (oldBuffer.length / 4) };
            servedRoot = site;
        }
        results.visuals.push({ name, mode, width, screenshot: file, diff });
        // Existing shell interaction: keyboard menu closes with Escape and restores focus.
        const menu = page.locator(name === 'betcast' ? '.menu-toggle' : name === 'ghostcar' ? '.masthead__burger' : name === 'telemetry' ? '.nav-mobile summary' : '#nav-hamburger');
        if (width === 390 && await menu.count() && await menu.isVisible()) {
            await menu.focus(); await page.keyboard.press('Enter');
            await page.keyboard.press('Tab');
            const focusVisible = await page.evaluate(() => document.activeElement.matches(':focus-visible'));
            await page.keyboard.press('Escape');
            results.accessibility.push({ name, mode, width, menuKeyboard: true, focusVisible, restoredFocus: await menu.evaluate(el => el === document.activeElement) });
        }
        await context.close();
    }

    // Exercise all BetCast visualizations and generated embeds from a foreign publisher origin.
    if (!args.includes('--visual-only') && !option('--product')) {
        const { context, page } = await createPage();
        await open(page, '/betcast/' + betcastQuery);
        const visualizations = await page.locator('#chart-select option').evaluateAll(options => options.map(o => o.value));
        for (const viz of visualizations) {
            await page.locator('#chart-select').selectOption(viz);
            await page.waitForTimeout(150);
        }
        results.flows.push({ application: 'betcast', visualizations: visualizations.length });
        const snippets = [
            ['telemetry', results.flows.find(flow => flow.telemetryEmbed)?.telemetryEmbed],
            ['ghostcar', results.flows.find(flow => flow.ghostEmbed)?.ghostEmbed],
            ['betcast', results.flows.find(flow => flow.betcastEmbed)?.betcastEmbed]
        ];
        // Use a simulated public HTTPS app host for this third-party test. Chrome's
        // local-network access policy would otherwise block a public HTTPS publisher
        // from framing the loopback server; that is unrelated to production Pages.
        const publicTestOrigin = 'https://f1stories.example';
        const publisher = 'https://publisher.example/embed-probe';
        await context.route(publicTestOrigin + '/**', async route => {
            const url = new URL(route.request().url());
            const response = await context.request.get(origin + url.pathname + url.search);
            await route.fulfill({ response });
        });
        for (const [application, snippet] of snippets) {
            assert(snippet, `${application}: generated embed missing`);
            await context.route(publisher, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>External publisher</title>' + snippet.replaceAll(origin, publicTestOrigin) }));
            await page.goto(publisher);
            const frame = page.frameLocator('iframe');
            await frame.locator('#root > *').first().waitFor({ state: 'attached' });
            await frame.locator(application === 'telemetry' ? '.dashboard-panel' : application === 'ghostcar' ? 'svg, canvas' : 'table').filter({ visible: true }).first().waitFor();
            assert.equal(await frame.locator(application === 'ghostcar' ? '.masthead' : application === 'telemetry' ? '.site-nav' : '.app-header').count(), 0);
            results.flows.push({ application, externalIframe: true, publisherOrigin: new URL(publisher).origin, productOrigin: publicTestOrigin });
            await context.unroute(publisher);
        }
        for (const invalid of ['/__invalid__/', '/telemetry/__invalid__/', '/ghostcar/__invalid__/', '/betcast/__invalid__/']) assert.equal((await context.request.get(origin + invalid)).status(), 404);
        await context.close();
    }
    assert.deepEqual(failures, [], 'Local network or runtime errors');
} catch (error) {
    failures.push({ assertion: error.stack });
} finally {
    results.failures = failures;
    fs.writeFileSync(path.join(reports, 'smoke-report.json'), JSON.stringify(results, null, 2) + '\n');
    await browser.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
}
console.log(JSON.stringify({ origin, themes: results.themes.length, directLoads: results.directLoads.length, navigation: results.navigation.length, screenshots: results.visuals.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;
