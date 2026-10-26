import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { Launcher } from 'chrome-launcher';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
let browser, server, origin;
before(async () => {
    server = http.createServer((request, response) => {
        let file = path.resolve(root, '.' + new URL(request.url, 'http://localhost').pathname);
        if (!fs.existsSync(file) && file.includes('/scripts/author/')) file = file.replace(/\.min\.js$/, '.js');
        if (!file.startsWith(root + '/') || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404).end(); return; }
        response.writeHead(200, { 'Content-Type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.webp': 'image/webp' }[path.extname(file)] || 'application/octet-stream' });
        fs.createReadStream(file).pipe(response);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch({ executablePath: Launcher.getInstallations()[0], headless: true });
});
after(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });
async function pageFor(t, width = 1440) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } }); t.after(() => context.close());
    const external = [], requests = [], page = await context.newPage(); page.setDefaultTimeout(7000);
    await context.route('**/*', route => {
        const url = route.request().url();
        if (url.startsWith(origin) || url.startsWith('blob:')) return route.continue();
        external.push(url); return route.abort();
    });
    page.on('request', request => { if (request.url().includes('.json')) requests.push(request.url()); });
    await page.addInitScript(() => { sessionStorage.setItem('f1stories-gh-token', 'dummy-research-token'); });
    await page.goto(origin + '/generate.html'); await page.waitForFunction(() => document.querySelector('[name="gen-author"]'));
    return { page, context, external, requests };
}
async function open(page) {
    if (await page.locator('.gb-step[data-step="1"]').isVisible()) await page.locator('.gb-step[data-step="1"]').click();
    else await page.locator('#gen-next').click();
    await page.locator('#research-toggle').click();
    await page.waitForFunction(() => document.querySelector('#research-season').options.length > 1);
}
async function savedState(page) {
    return page.evaluate(async () => ({ fields: Array.from(document.querySelectorAll('#gen-app input, #gen-app textarea')).filter(node => !node.closest('#research-notebook')).map(node => ({ id: node.id, name: node.name, value: node.value, checked: node.checked, files: Array.from(node.files || [], f => f.name) })),
        drafts: await window.F1S_LOCAL_DRAFTS.list(), status: document.getElementById('gen-draft-status').textContent,
        preview: document.getElementById('gen-article-preview').srcdoc,
        local: JSON.stringify(localStorage), session: JSON.stringify(sessionStorage) }));
}
async function addNote(page, text = 'Δοκιμαστική σημείωση α\u0301 — όχι εκδοτικό τεκμήριο') {
    const details = page.locator('details').filter({ has: page.locator('#research-note-text') });
    await details.evaluate(node => { node.open = true; });
    await page.locator('#research-note-text').fill(text);
    await page.locator('#research-note-sourceTitle').fill('Δοκιμαστική πηγή');
    await page.locator('#research-note-url').fill('https://example.com/evidence');
    await page.getByRole('button', { name: 'Προσθήκη σημείωσης', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#research-notebook').textContent.includes('Η σημείωση προστέθηκε'));
}

test('open/close and keyboard focus preserve notes; startup and open never preload article or standings datasets', async t => {
    const { page, requests } = await pageFor(t);
    assert.equal(requests.filter(url => /blog-index-data|standings\//.test(url)).length, 0);
    await open(page); assert.equal(await page.locator('#research-question').evaluate(node => node === document.activeElement), true);
    assert.equal(requests.filter(url => /blog-index-data|standings\//.test(url)).length, 0);
    await page.locator('#research-question').fill('Hamilton'); await page.keyboard.press('Escape');
    assert.equal(await page.locator('#research-notebook').isVisible(), false);
    assert.equal(await page.locator('#research-toggle').evaluate(node => node === document.activeElement), true);
    await page.keyboard.press('Enter'); assert.equal(await page.locator('#research-question').inputValue(), 'Hamilton');
    assert.equal(await page.locator('.gb-step').count(), 5);
    assert.match(await page.locator('#research-notebook').textContent(), /Δεν γίνεται αναζήτηση στο σώμα άρθρων/);
});

test('public article search displays real metadata and safe internal references, caches requests and recovers from a missing index', async t => {
    const { page, requests } = await pageFor(t); await open(page);
    const indexURL = origin + '/blog-module/blog-index-data.json';
    await page.route(indexURL, route => route.fulfill({ status: 404, body: 'Missing' }));
    await page.locator('#research-question').fill('BetCast'); await page.getByRole('button', { name: 'Εύρεση αναφορών', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#research-status').textContent.includes('δεν φορτώθηκε'));
    await page.unroute(indexURL); await page.getByRole('button', { name: 'Εύρεση αναφορών', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.gb-research-results li').length > 0);
    assert.ok(await page.locator('.gb-research-results li').count() <= 8);
    assert.match(await page.locator('.gb-research-results').textContent(), /Στοίχημα/);
    assert.match(await page.locator('.gb-research-results').textContent(), /Giannis Poulikidis/);
    assert.match(await page.locator('.gb-research-results').textContent(), /2026-10-/);
    assert.match(await page.locator('#research-status').textContent(), /Δεν αποτελούν ανεξάρτητη επαλήθευση/);
    const count = requests.filter(url => url === indexURL).length;
    await page.locator('#research-question').fill('GridCast'); await page.getByRole('button', { name: 'Εύρεση αναφορών', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.gb-research-results').textContent.includes('GridCast'));
    assert.equal(requests.filter(url => url === indexURL).length, count);
});

test('pinned standings require available season/round and preserve values/provenance without cross-round fallback', async t => {
    const { page, requests } = await pageFor(t); await open(page);
    await page.locator('details').filter({ has: page.locator('#research-season') }).evaluate(node => { node.open = true; });
    assert.equal(await page.locator('#research-season').inputValue(), ''); assert.equal(await page.locator('#research-round').isDisabled(), true);
    await page.locator('#research-season').selectOption('2026');
    // The first round without a snapshot: the scheduled standings refresh keeps adding them.
    const missing = Math.max(...fs.readdirSync(path.join(root, 'standings/rounds')).map(name => Number(/^2026-(\d+)\.json$/.exec(name)?.[1] || 0))) + 1;
    assert.equal(await page.locator(`#research-round option[value="${missing}"]`).count(), 0);
    await page.locator('#research-round').selectOption('17');
    await page.waitForSelector('#research-standing-entry');
    const data = JSON.parse(fs.readFileSync(path.join(root, 'standings/rounds/2026-17.json')));
    const text = await page.locator('#research-standing-entry').locator('..').locator('..').textContent();
    for (const value of [data.raceName, data.generatedAt, data.source.driverStandingsUrl, '340', 'Ανεπίσημη', 'Παλαιότερο στιγμιότυπο']) assert.ok(text.includes(value), value);
    await page.locator('#research-standing-entry').selectOption('22');
    assert.match(await page.locator('#research-notebook').textContent(), /Κατασκευαστής:/);
    const wrong = structuredClone(data);
    await page.route('**/standings/rounds/2026-16.json', route => route.fulfill({ json: wrong }));
    await page.locator('#research-round').selectOption('16');
    await page.waitForFunction(() => document.querySelector('#research-notebook').textContent.includes('Δεν έγινε αντικατάσταση γύρου'));
    assert.equal(await page.locator('#research-standing-entry').count(), 0);
    assert.equal(requests.some(url => url.includes('standings-cache.json')), false);
    await page.unroute('**/standings/rounds/2026-16.json');
    await page.getByRole('button', { name: 'Επανάληψη στιγμιοτύπου', exact: true }).click(); await page.waitForSelector('#research-standing-entry');
    assert.match(await page.locator('#research-notebook .gb-research-text').textContent(), /Γύρος: 16/);
    await page.getByRole('button', { name: 'Επανάληψη καταλόγου', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#research-round').disabled);
    assert.equal(await page.locator('#research-standing-entry').count(), 0);
});

test('missing/offline snapshots and unavailable catalogue are recoverable without disrupting the article editor', async t => {
    const { page } = await pageFor(t);
    await page.route('**/research-catalog.json', route => route.abort());
    await page.locator('.gb-step[data-step="1"]').click(); await page.locator('#research-toggle').click();
    await page.waitForFunction(() => document.querySelector('#research-status').textContent.includes('Δεν φορτώθηκαν'));
    await page.unroute('**/research-catalog.json'); await page.locator('#research-toggle').click(); await page.locator('#research-toggle').click();
    await page.waitForFunction(() => document.querySelector('#research-season').options.length > 1);
    await page.locator('details').filter({ has: page.locator('#research-season') }).evaluate(node => { node.open = true; });
    await page.locator('#research-season').selectOption('2026');
    await page.route('**/standings/rounds/2026-1.json', route => route.fulfill({ status: 404 }));
    await page.locator('#research-round').selectOption('1');
    await page.waitForFunction(() => document.querySelector('#research-notebook').textContent.includes('HTTP 404'));
    await page.locator('#gen-content').fill('Συνεχίζω να γράφω κανονικά.');
    assert.equal(await page.locator('#gen-content').inputValue(), 'Συνεχίζω να γράφω κανονικά.');
});

test('manual notes render HTML as text, reject unsafe URLs and cannot mark unverified claims confirmed', async t => {
    const { page } = await pageFor(t); await open(page);
    await page.locator('details').filter({ has: page.locator('#research-note-text') }).evaluate(node => { node.open = true; });
    await page.locator('#research-note-text').fill('<img src=x onerror="window.researchInjected=1"> <script>alert(1)</script>');
    await page.locator('#research-note-url').fill('javascript:alert(1)');
    await page.getByRole('button', { name: 'Προσθήκη σημείωσης', exact: true }).click();
    assert.match(await page.locator('#research-notebook').textContent(), /HTTP ή HTTPS/);
    await page.locator('#research-note-url').fill('https://example.com/source');
    await page.locator('#research-note-verification').selectOption('checked');
    await page.getByRole('button', { name: 'Προσθήκη σημείωσης', exact: true }).click();
    assert.match(await page.locator('#research-notebook').textContent(), /παραμένει μη επαληθευμένος/);
    await page.locator('#research-note-verification').selectOption('pending');
    await page.getByRole('button', { name: 'Προσθήκη σημείωσης', exact: true }).click();
    assert.equal(await page.locator('#research-notebook img, #research-notebook script').count(), 0);
    assert.equal(await page.evaluate(() => window.researchInjected), undefined);
    assert.match(await page.locator('.gb-research-result').textContent(), /<img src=x/);
});

test('untrusted index records remain text and unsafe article IDs fail closed', async t => {
    const { page } = await pageFor(t); await open(page);
    const data = JSON.parse(fs.readFileSync(path.join(root, 'blog-module/blog-index-data.json')));
    data.p = [data.p[0]]; data.p[0][1] = 'Malicious <img src=x onerror="window.researchInjected=1"><script>alert(1)</script>';
    await page.route('**/blog-index-data.json', route => route.fulfill({ json: data }));
    await page.locator('#research-question').fill('Malicious'); await page.getByRole('button', { name: 'Εύρεση αναφορών', exact: true }).click();
    await page.waitForSelector('.gb-research-results li');
    assert.match(await page.locator('.gb-research-results h3').textContent(), /<img/);
    assert.equal(await page.locator('.gb-research-results img, .gb-research-results script').count(), 0);
    assert.equal(await page.evaluate(() => window.researchInjected), undefined);
    const { page: invalid } = await pageFor(t); await open(invalid); data.p[0][0] = '../generate';
    await invalid.route('**/blog-index-data.json', route => route.fulfill({ json: data }));
    await invalid.locator('#research-question').fill('Malicious'); await invalid.getByRole('button', { name: 'Εύρεση αναφορών', exact: true }).click();
    await invalid.waitForFunction(() => document.querySelector('#research-status').textContent.includes('έγκυρο σχήμα'));
    assert.equal(await invalid.locator('.gb-research-results li').count(), 0);
});

test('copy finding, copy reference, clipboard fallback, UTF-8 download and explicit clear retain labels and sources', async t => {
    const { page } = await pageFor(t); await open(page); await addNote(page);
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.researchCopied = text; } } }));
    await page.locator('.gb-research-result').getByRole('button', { name: 'Αντιγραφή ευρήματος', exact: true }).click();
    assert.match(await page.evaluate(() => window.researchCopied), /Εκκρεμεί/);
    assert.match(await page.evaluate(() => window.researchCopied), /https:\/\/example.com\/evidence/);
    await page.locator('#research-question').fill('Hamilton'); await page.getByRole('button', { name: 'Εύρεση αναφορών', exact: true }).click();
    await page.locator('.gb-research-results li').first().getByRole('button', { name: 'Αντιγραφή αναφοράς' }).click();
    assert.match(await page.evaluate(() => window.researchCopied), /όχι ανεξάρτητη επαλήθευση/);
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Denied'); } } }));
    await page.getByRole('button', { name: 'Αντιγραφή brief', exact: true }).click();
    const fallback = page.locator('#research-copy-fallback'); assert.equal(await fallback.isVisible(), true);
    assert.ok(await fallback.evaluate(node => node.selectionEnd > node.selectionStart));
    const contents = await fallback.inputValue(); assert.match(contents, /Εκδοτικό ερώτημα/); assert.match(contents, /Δοκιμαστική σημείωση α\u0301/);
    const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Λήψη σημειώσεων', exact: true }).click();
    const download = await downloading; assert.equal(download.suggestedFilename(), 'brief.txt');
    assert.equal(fs.readFileSync(await download.path(), 'utf8'), contents);
    await page.getByRole('button', { name: 'Καθαρισμός σημειωματαρίου', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Ακύρωση', exact: true }).click();
    assert.equal(await page.locator('#research-question').inputValue(), 'Hamilton');
    await page.getByRole('button', { name: 'Καθαρισμός σημειωματαρίου', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Καθαρισμός', exact: true }).click();
    assert.equal(await page.locator('#research-question').inputValue(), ''); assert.equal(await page.locator('.gb-research-result').count(), 0);
});

test('research with dummy token causes zero editor/draft/storage/preview mutations and zero GitHub requests; reload discards notebook only', async t => {
    const { page, external } = await pageFor(t);
    await page.evaluate(() => {
        for (const [id, value] of [['gen-title', 'Άρθρο δοκιμής'], ['gen-content', 'Αμετάβλητο κείμενο α\u0301'], ['gen-tag', 'Hamilton']]) {
            const node = document.getElementById(id); node.value = value; node.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });
    await page.locator('.gb-step[data-step="4"]').click(); await page.locator('#gen-save-draft').click();
    await page.waitForFunction(() => document.getElementById('gen-draft-status').textContent.startsWith('Αποθηκεύτηκε τοπικά'));
    await open(page); assert.match(await page.locator('#gen-token-state').textContent(), /ενεργό/);
    const before = await savedState(page);
    await page.locator('#research-question').fill('Hamilton'); await page.getByRole('button', { name: 'Εύρεση αναφορών', exact: true }).click();
    await page.waitForSelector('.gb-research-results li'); await addNote(page);
    await page.locator('details').filter({ has: page.locator('#research-season') }).evaluate(node => { node.open = true; });
    await page.locator('#research-season').selectOption('2026'); await page.locator('#research-round').selectOption('17'); await page.waitForSelector('#research-standing-entry');
    await page.getByRole('button', { name: 'Αντιγραφή brief', exact: true }).click();
    await page.locator('#research-toggle').click(); await page.locator('#research-toggle').click();
    assert.deepEqual(await savedState(page), before);
    assert.deepEqual(external.filter(url => /api.github.com/.test(url)), []);
    assert.equal(external.length, 0);
    await page.reload(); await open(page);
    assert.equal(await page.locator('#research-question').inputValue(), ''); assert.equal(await page.locator('.gb-research-result').count(), 0);
    const drafts = await page.evaluate(() => window.F1S_LOCAL_DRAFTS.list()); assert.deepEqual(drafts, before.drafts);
});

test('late responses after clear/selection changes cannot restore obsolete search or round results', async t => {
    const { page } = await pageFor(t); await open(page);
    let release;
    await page.route('**/blog-index-data.json', async route => { await new Promise(resolve => { release = resolve; }); await route.continue(); });
    await page.locator('#research-question').fill('Hamilton'); await page.getByRole('button', { name: 'Εύρεση αναφορών', exact: true }).click();
    await page.getByRole('button', { name: 'Καθαρισμός σημειωματαρίου', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Καθαρισμός', exact: true }).click(); release();
    await page.waitForResponse('**/blog-index-data.json'); assert.equal(await page.locator('.gb-research-results li').count(), 0);
    await page.locator('details').filter({ has: page.locator('#research-season') }).evaluate(node => { node.open = true; });
    await page.locator('#research-season').selectOption('2026');
    await page.route('**/standings/rounds/2026-17.json', async route => { await new Promise(resolve => { release = resolve; }); await route.continue(); });
    await page.locator('#research-round').selectOption('17');
    await page.locator('#research-round').selectOption('16'); await page.waitForSelector('#research-standing-entry');
    const response = page.waitForResponse('**/standings/rounds/2026-17.json'); release(); await response;
    assert.match(await page.locator('#research-notebook .gb-research-text').textContent(), /Γύρος: 16/);
});

test('desktop/mobile, light/dark, focus and overflow QA use actual public references and pinned records', async t => {
    const output = process.env.F1S_RESEARCH_QA_DIR;
    for (const width of [1440, 390]) {
        const { page } = await pageFor(t, width); await open(page);
        await page.locator('#research-question').fill('Hamilton'); await page.getByRole('button', { name: 'Εύρεση αναφορών', exact: true }).click(); await page.waitForSelector('.gb-research-results li');
        await page.locator('details').filter({ has: page.locator('#research-season') }).evaluate(node => { node.open = true; });
        await page.locator('#research-season').selectOption('2026'); await page.locator('#research-round').selectOption('17'); await page.waitForSelector('#research-standing-entry');
        // Keep the notebook compact while retaining the selected round for the second capture.
        await page.locator('details').filter({ has: page.locator('.gb-research-results') }).evaluate(node => { node.open = false; });
        for (const theme of ['light', 'dark']) {
            await page.evaluate(value => { if (value === 'light') document.documentElement.dataset.theme = value; else delete document.documentElement.dataset.theme; }, theme);
            // Existing global color transitions must settle before measuring the new theme.
            await page.waitForFunction(() => {
                const panel = document.querySelector('#research-notebook');
                const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
                const background = luminance(getComputedStyle(panel).backgroundColor);
                return ['.gb-research-text', '.gb-hint'].every(selector => {
                    const foreground = luminance(getComputedStyle(panel.querySelector(selector)).color);
                    return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05) >= 4.5;
                });
            });
            const box = await page.locator('#research-notebook').boundingBox(), writer = await page.locator('#gen-content').boundingBox();
            const dimensions = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth }));
            assert.ok(dimensions.width <= dimensions.viewport, JSON.stringify(dimensions));
            if (width === 1440) assert.ok(box.x > writer.x && Math.abs(box.y - writer.y) < 10);
            else assert.ok(box.y < writer.y);
            const colors = await page.locator('#research-notebook').evaluate(node => ({ foreground: getComputedStyle(node.querySelector('.gb-research-text')).color,
                secondary: getComputedStyle(node.querySelector('.gb-hint')).color, background: getComputedStyle(node).backgroundColor }));
            const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
            const contrast = (a, b) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
            assert.ok(contrast(luminance(colors.foreground), luminance(colors.background)) >= 4.5, JSON.stringify(colors));
            assert.ok(contrast(luminance(colors.secondary), luminance(colors.background)) >= 4.5, JSON.stringify(colors));
            if (output) {
                await page.evaluate(() => scrollTo(0, 0)); await page.locator('#research-notebook').evaluate(node => { node.scrollTop = 0; });
                fs.mkdirSync(output, { recursive: true }); await page.screenshot({ path: path.join(output, `${width}-${theme}.png`) });
                await page.locator('#research-standing-entry').scrollIntoViewIfNeeded();
                await page.screenshot({ path: path.join(output, `${width}-${theme}-standings.png`) });
                await page.locator('#research-question').focus();
            }
        }
        await page.locator('#research-question').focus(); await page.keyboard.press('Tab');
        assert.equal(await page.getByRole('button', { name: 'Εύρεση αναφορών', exact: true }).evaluate(node => node === document.activeElement), true);
    }
});
