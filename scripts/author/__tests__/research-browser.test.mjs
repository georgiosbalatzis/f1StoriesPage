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
    await page.waitForFunction(() => !document.getElementById('gen-app').hidden);
    if (await page.locator('.gb-step[data-step="1"]').isVisible()) await page.locator('.gb-step[data-step="1"]').click();
    else await page.locator('#gen-next').click();
    if (!(await page.locator('#research-notebook').isVisible())) await page.locator('#research-toggle').click();
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
    assert.match(await page.locator('#research-notebook').textContent(), /κείμενο δημοσιευμένων άρθρων/);
    assert.equal(requests.filter(url => url.includes('/research-content/')).length, 0);
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
    await page.evaluate(() => { document.getElementById('research-status').textContent = ''; });
    await page.getByRole('button', { name: 'Επανάληψη καταλόγου', exact: true }).click();
    await page.waitForFunction(() => document.getElementById('research-status').textContent.includes('φορτώθηκαν'));
    assert.equal(await page.locator('#research-round').inputValue(), '16');
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

test('research is saved only explicitly and restores after reload without GitHub requests', async t => {
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
    const unsaved = await savedState(page);
    assert.deepEqual(unsaved.drafts, before.drafts);
    assert.deepEqual(unsaved.fields, before.fields); assert.equal(unsaved.preview, before.preview);
    assert.equal(unsaved.local, before.local); assert.equal(unsaved.session, before.session);
    assert.deepEqual(external.filter(url => /api.github.com/.test(url)), []);
    assert.equal(external.length, 0);
    await page.reload(); await open(page);
    assert.equal(await page.locator('#research-question').inputValue(), ''); assert.equal(await page.locator('.gb-research-result').count(), 0);
    const drafts = await page.evaluate(() => window.F1S_LOCAL_DRAFTS.list()); assert.deepEqual(drafts, before.drafts);
    await page.locator('#gen-show-drafts').click();
    await page.locator('#gen-draft-list button').filter({ hasText: 'Άνοιγμα' }).click();
    await open(page); await page.locator('#research-question').fill('Αποθηκευμένη έρευνα α\u0301'); await addNote(page);
    await page.locator('#research-toggle').click(); await page.locator('.gb-step[data-step="4"]').click();
    await page.locator('#gen-save-draft').click();
    await page.waitForFunction(() => document.getElementById('gen-draft-status').textContent.startsWith('Αποθηκεύτηκε τοπικά'));
    await page.reload(); await page.locator('#gen-show-drafts').click();
    await page.locator('#gen-draft-list button').filter({ hasText: 'Άνοιγμα' }).click();
    await open(page); assert.equal(await page.locator('#research-question').inputValue(), 'Αποθηκευμένη έρευνα α\u0301');
    assert.match(await page.locator('.gb-research-result').textContent(), /Δοκιμαστική σημείωση/);
    assert.deepEqual(external.filter(url => /api.github.com/.test(url)), []);
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

test('archive discovery: find related articles, copy the canonical URL or a Markdown link, never touch the draft', async t => {
    const { page, requests, external } = await pageFor(t);
    const body = 'Η McLaren πήγε στο Baku με μεγάλο πακέτο.\n\nΔεύτερη παράγραφος ά.';
    await page.evaluate(text => { const node = document.getElementById('gen-content'); node.value = text; node.dispatchEvent(new Event('input', { bubbles: true })); }, body);
    await page.locator('.gb-step[data-step="4"]').click(); await page.locator('#gen-save-draft').click();
    await page.waitForFunction(() => document.getElementById('gen-draft-status').textContent.startsWith('Αποθηκεύτηκε τοπικά'));
    await page.locator('.gb-step[data-step="1"]').click();
    const before = await savedState(page);
    const indexURL = origin + '/blog-module/blog-index-data.json';
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.researchCopied = text; } } }));

    const archive = page.getByRole('button', { name: 'Βρες σχετικά άρθρα', exact: true });
    await archive.click();
    assert.equal(await archive.getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator('#research-question').evaluate(node => node === document.activeElement), true);
    assert.equal(requests.filter(url => url === indexURL).length, 0, 'opening does not load the archive');
    await page.keyboard.type('McLaren Baku upgrade'); await page.keyboard.press('Enter');
    await page.waitForSelector('.gb-research-results li');
    const first = page.locator('.gb-research-results li').first();
    assert.match(await first.locator('h3').textContent(), /Baku ήταν το τελευταίο upgrade test της McLaren/);
    assert.match(await first.textContent(), /Ταιριάζει σε: Τίτλος: McLaren, Baku, upgrade/);
    assert.match(await first.textContent(), /πακέτο αναβαθμίσεων/);
    assert.match(await page.locator('#research-notebook').textContent(), /Σύνδεσε προηγούμενα άρθρα μόνο όταν προσφέρουν ουσιαστικό πλαίσιο/);
    assert.equal(await first.getByRole('link', { name: 'Άνοιγμα άρθρου' }).getAttribute('href'), '/blog-module/blog-entries/20260928G/article.html');

    await first.getByRole('button', { name: 'Αντιγραφή URL', exact: true }).click();
    assert.equal(await page.evaluate(() => window.researchCopied), '/blog-module/blog-entries/20260928G/article.html');
    assert.match(await page.locator('#research-status').textContent(), /Αντιγράφηκε η διεύθυνση/);
    assert.match(await first.textContent(), /Αντιγράφηκε η διεύθυνση \/blog-module\/blog-entries\/20260928G\/article\.html/, 'confirmed beside the button');
    // No phrase typed or selected: nothing is copied and the headline is not used.
    await page.evaluate(() => { const node = document.getElementById('gen-content'); node.setSelectionRange(0, 0); window.researchCopied = 'unchanged'; });
    await first.getByRole('button', { name: 'Αντιγραφή συνδέσμου Markdown', exact: true }).click();
    assert.equal(await page.evaluate(() => window.researchCopied), 'unchanged');
    assert.equal(await page.locator('#research-anchor').evaluate(node => node === document.activeElement), true);
    // The phrase selected in the article body becomes the anchor; the typed phrase wins over it.
    await page.evaluate(() => { const node = document.getElementById('gen-content'); const start = node.value.indexOf('μεγάλο πακέτο'); node.setSelectionRange(start, start + 'μεγάλο πακέτο'.length); });
    await first.getByRole('button', { name: 'Αντιγραφή συνδέσμου Markdown', exact: true }).click();
    assert.equal(await page.evaluate(() => window.researchCopied), '[μεγάλο πακέτο](/blog-module/blog-entries/20260928G/article.html)');
    assert.match(await page.locator('#research-status').textContent(), /Το κείμενο του άρθρου δεν άλλαξε/);
    await page.locator('#research-anchor').fill('το πακέτο του Baku');
    await first.getByRole('button', { name: 'Αντιγραφή συνδέσμου Markdown', exact: true }).click();
    assert.equal(await page.evaluate(() => window.researchCopied), '[το πακέτο του Baku](/blog-module/blog-entries/20260928G/article.html)');
    assert.equal(await page.locator('#gen-content').inputValue(), body);

    await page.locator('#research-question').fill('McLaren'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelectorAll('.gb-research-results li').length === 8);
    const more = page.getByRole('button', { name: /^Περισσότερα αποτελέσματα/ });
    await more.click(); assert.equal(await page.locator('.gb-research-results li').count(), 16);
    assert.equal(await page.locator('.gb-research-results li').nth(8).getByRole('link', { name: 'Άνοιγμα άρθρου' }).evaluate(node => node === document.activeElement), true);
    assert.equal(requests.filter(url => url === indexURL).length, 1, 'one archive request for every search');

    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#research-notebook').isVisible(), false);
    assert.equal(await archive.evaluate(node => node === document.activeElement), true);
    assert.equal(await page.locator('#research-toggle').getAttribute('aria-expanded'), 'false');
    const after = await savedState(page);
    assert.deepEqual(after.drafts, before.drafts); assert.deepEqual(after.fields, before.fields); assert.equal(after.preview, before.preview);
    assert.equal(after.local, before.local); assert.equal(after.session, before.session);
    assert.match(await page.locator('#gen-draft-status').textContent(), /Μη αποθηκευμένες αλλαγές/);
    assert.deepEqual(external.filter(url => /api.github.com/.test(url)), []);

    // The author pastes the link; the preview renders it as an internal article link.
    await page.locator('#gen-content').fill('Η McLaren πήγε στο Baku με [μεγάλο πακέτο](/blog-module/blog-entries/20260928G/article.html).');
    await page.locator('.gb-step[data-step="3"]').click();
    await page.waitForFunction(() => document.getElementById('gen-article-preview').srcdoc.includes('href="/blog-module/blog-entries/20260928G/article.html"'));
});

test('archive discovery on a phone: long Greek headlines wrap without page overflow, and the editor stays usable offline', async t => {
    const { page } = await pageFor(t, 390);
    await page.route('**/blog-index-data.json', route => route.abort());
    await page.locator('#gen-next').click();
    await page.getByRole('button', { name: 'Βρες σχετικά άρθρα', exact: true }).click();
    await page.locator('#research-question').fill('Hamilton'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('#research-status').textContent.includes('δεν φορτώθηκε'));
    await page.locator('#gen-content').fill('Γράφω κανονικά χωρίς σύνδεση.');
    assert.equal(await page.locator('#gen-content').inputValue(), 'Γράφω κανονικά χωρίς σύνδεση.');
    await page.unroute('**/blog-index-data.json');
    await page.locator('#research-question').fill('Ιστορία'); await page.keyboard.press('Enter');
    await page.waitForSelector('.gb-research-results li');
    for (const theme of ['light', 'dark']) {
        await page.evaluate(value => { if (value === 'light') document.documentElement.dataset.theme = value; else delete document.documentElement.dataset.theme; }, theme);
        const dimensions = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth,
            widest: Math.max(...Array.from(document.querySelectorAll('.gb-research-results li'), node => node.getBoundingClientRect().right)) }));
        assert.ok(dimensions.width <= dimensions.viewport && dimensions.widest <= dimensions.viewport, JSON.stringify(dimensions));
        if (process.env.F1S_RESEARCH_QA_DIR) {
            await page.locator('.gb-research-results li').first().scrollIntoViewIfNeeded();
            await page.screenshot({ path: path.join(process.env.F1S_RESEARCH_QA_DIR, `archive-390-${theme}.png`) });
        }
    }
});

test('desktop/mobile, light/dark, focus and overflow QA use actual public references and pinned records', async t => {
    const output = process.env.F1S_RESEARCH_QA_DIR;
    for (const width of [1440, 390]) {
        const { page } = await pageFor(t, width); await open(page);
        await page.locator('#research-question').fill('Hamilton'); await page.getByRole('button', { name: 'Εύρεση αναφορών', exact: true }).click(); await page.waitForSelector('.gb-research-results li');
        await page.waitForFunction(() => /προς έλεγχο|Δεν βρέθηκαν/.test(document.getElementById('research-status').textContent));
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
            // Measure layout, not scroll: earlier steps can scroll the page.
            await page.evaluate(() => scrollTo({ top: 0, left: 0, behavior: 'instant' }));
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
            // After the geometry checks: focusing the bottom controls scrolls the page.
            await page.keyboard.press('Tab');
            for (const selector of ['#research-notebook button:has-text("Εισαγωγή έρευνας JSON")', '#research-notebook button:has-text("Εξαγωγή έρευνας JSON")']) {
                const control = page.locator(selector); await control.focus();
                assert.equal(await control.evaluate(node => node === document.activeElement && node.matches(':focus-visible')), true, selector);
                assert.equal(await control.isVisible(), true, selector);
                assert.notEqual(await control.evaluate(node => getComputedStyle(node).outlineStyle), 'none', selector);
            }
            await page.keyboard.press('Tab');
            assert.equal(await page.getByRole('button', { name: 'Εισαγωγή έρευνας JSON', exact: true }).evaluate(node => node === document.activeElement), true);
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

test('research JSON rejects invalid envelopes, confirms replacement and persists valid import', async t => {
    const { page } = await pageFor(t); await open(page);
    const exporter = page.getByRole('button', { name: 'Εξαγωγή έρευνας JSON' });
    assert.equal(await exporter.isDisabled(), true);
    const input = page.locator('#research-import');
    const send = async contents => input.setInputFiles({ name: 'research.json', mimeType: 'application/json', buffer: Buffer.from(contents) });
    const blank = { text: '', section: 'unverified', type: 'unverified', kind: 'general', verification: 'pending', sourceTitle: '', url: '', sourceDate: '', event: '', market: '', units: '', period: '', calculation: '', limitations: '' };
    const workspace = { version: 1, question: 'Εισαγωγή α\u0301', anchor: '', season: '', round: '', notes: [], form: { ...blank, url: 'https://unfinished', sourceDate: '2026-' } };
    for (const value of ['{', JSON.stringify({ format: 'wrong', version: 1, research: workspace }),
        JSON.stringify({ format: 'f1stories-research', version: 2, research: workspace }),
        JSON.stringify({ format: 'f1stories-research', version: 1, research: workspace, extra: 1 }), 'x'.repeat(2 * 1024 * 1024 + 1)]) {
        await page.evaluate(() => { document.getElementById('research-status').textContent = ''; });
        await send(value); await page.waitForFunction(() => document.getElementById('research-status').textContent.includes('δεν είναι έγκυρο'));
        assert.equal(await page.evaluate(() => window.F1S_RESEARCH_NOTEBOOK.snapshot()), null);
    }
    await page.locator('#research-question').fill('Αρχική έρευνα'); assert.equal(await exporter.isDisabled(), false);
    const valid = JSON.stringify({ format: 'f1stories-research', version: 1, research: workspace });
    await send(valid); await page.getByRole('dialog').getByRole('button', { name: 'Ακύρωση', exact: true }).click();
    assert.equal(await page.locator('#research-question').inputValue(), 'Αρχική έρευνα');
    await send(valid); await page.getByRole('dialog').getByRole('button', { name: 'Αντικατάσταση', exact: true }).click();
    await page.waitForFunction(() => document.getElementById('research-question').value === 'Εισαγωγή α\u0301');
    assert.match(await page.locator('#gen-draft-status').textContent(), /Μη αποθηκευμένες/);
    await page.locator('#research-toggle').click(); await page.locator('.gb-step[data-step="4"]').click();
    await page.locator('#gen-save-draft').click(); await page.waitForFunction(() => document.getElementById('gen-draft-status').textContent.startsWith('Αποθηκεύτηκε'));
    await page.reload(); await page.locator('#gen-show-drafts').click(); await page.getByRole('button', { name: 'Άνοιγμα', exact: true }).click();
    await page.waitForFunction(() => document.getElementById('gen-draft-status').textContent.startsWith('Ανοιχτό')); await open(page);
    assert.equal(await page.locator('#research-question').inputValue(), workspace.question);
    assert.equal(await page.locator('#research-note-url').inputValue(), 'https://unfinished');
});

test('switch cancellation retains A and opening B without a notebook cannot inherit A', async t => {
    const { page } = await pageFor(t);
    await page.evaluate(async () => {
        await window.F1S_LOCAL_DRAFTS.save({ title: 'A', text: 'Άρθρο A', editor: { step: 1 } });
        await window.F1S_LOCAL_DRAFTS.save({ title: 'B', text: 'Άρθρο B', editor: { step: 1 } });
    });
    await page.locator('#gen-show-drafts').click();
    await page.locator('#gen-draft-list li').filter({ has: page.getByRole('heading', { name: 'A', exact: true }) }).getByRole('button', { name: 'Άνοιγμα' }).click();
    await page.waitForFunction(() => document.getElementById('gen-draft-status').textContent.includes('Ανοιχτό')); await open(page);
    await page.locator('#research-question').fill('Μη αποθηκευμένο A');
    await page.locator('#gen-show-drafts').click();
    const b = page.locator('#gen-draft-list li').filter({ has: page.getByRole('heading', { name: 'B', exact: true }) }).getByRole('button', { name: 'Άνοιγμα' });
    await b.click(); await page.getByRole('dialog').getByRole('button', { name: 'Ακύρωση', exact: true }).click();
    assert.equal(await page.evaluate(() => window.F1S_RESEARCH_NOTEBOOK.snapshot().question), 'Μη αποθηκευμένο A');
    await b.click(); await page.getByRole('dialog').getByRole('button', { name: 'Συνέχεια χωρίς αποθήκευση', exact: true }).click();
    await page.waitForFunction(() => document.getElementById('gen-title').value === 'B' && !document.getElementById('gen-app').hidden);
    assert.equal(await page.evaluate(() => window.F1S_RESEARCH_NOTEBOOK.snapshot()), null);
    assert.equal(await page.locator('#gen-content').inputValue(), 'Άρθρο B');
});

test('delayed catalog, archive and JSON import cannot repopulate a switched notebook', async t => {
    const { page } = await pageFor(t);
    await page.evaluate(async () => { await window.F1S_LOCAL_DRAFTS.save({ title: 'B', text: 'B', editor: { step: 1 } }); });
    let releaseCatalog, releaseArchive;
    const catalogStarted = new Promise(resolve => page.route('**/research-catalog.json', async route => { resolve(); await new Promise(done => { releaseCatalog = done; }); await route.continue(); }));
    const archiveStarted = new Promise(resolve => page.route('**/blog-index-data.json', async route => { resolve(); await new Promise(done => { releaseArchive = done; }); await route.continue(); }));
    await page.locator('.gb-step[data-step="1"]').click(); await page.locator('#research-toggle').click(); await catalogStarted;
    await page.locator('#research-question').fill('Hamilton'); await page.getByRole('button', { name: 'Εύρεση αναφορών' }).click(); await archiveStarted;
    await page.evaluate(() => {
        const read = File.prototype.text;
        File.prototype.text = function () { return new Promise(resolve => { window.__releaseResearchImport = async () => resolve(await read.call(this)); }); };
    });
    const form = { text: '', section: 'unverified', type: 'unverified', kind: 'general', verification: 'pending', sourceTitle: '', url: '', sourceDate: '', event: '', market: '', units: '', period: '', calculation: '', limitations: '' };
    const json = JSON.stringify({ format: 'f1stories-research', version: 1, research: { version: 1, question: 'A import', anchor: '', season: '', round: '', notes: [], form } });
    await page.locator('#research-import').setInputFiles({ name: 'research.json', mimeType: 'application/json', buffer: Buffer.from(json) });
    await page.waitForFunction(() => Boolean(window.__releaseResearchImport));
    await page.locator('#gen-show-drafts').click(); await page.getByRole('button', { name: 'Άνοιγμα', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Συνέχεια χωρίς αποθήκευση', exact: true }).click();
    await page.waitForFunction(() => document.getElementById('gen-title').value === 'B');
    const archived = page.waitForResponse('**/blog-index-data.json');
    releaseCatalog(); releaseArchive(); await page.evaluate(() => window.__releaseResearchImport());
    await archived;
    assert.equal(await page.evaluate(() => window.F1S_RESEARCH_NOTEBOOK.snapshot()), null);
    assert.equal(await page.locator('.gb-research-results li').count(), 0);
    assert.equal(await page.locator('#research-question').inputValue(), '');
});

test('a delayed standings response from A cannot paint in B', async t => {
    const { page } = await pageFor(t); await page.evaluate(async () => window.F1S_LOCAL_DRAFTS.save({ title: 'B standings', editor: { step: 1 } }));
    await open(page); await page.locator('details').filter({ has: page.locator('#research-season') }).evaluate(node => { node.open = true; });
    await page.locator('#research-season').selectOption('2026');
    let release;
    const started = new Promise(resolve => page.route('**/standings/rounds/2026-17.json', async route => { resolve(); await new Promise(done => { release = done; }); await route.continue(); }));
    await page.locator('#research-round').selectOption('17'); await started;
    await page.locator('#gen-show-drafts').click(); await page.getByRole('button', { name: 'Άνοιγμα', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Συνέχεια χωρίς αποθήκευση' }).click();
    await page.waitForFunction(() => document.getElementById('gen-title').value === 'B standings');
    const response = page.waitForResponse('**/standings/rounds/2026-17.json'); release(); await response;
    assert.equal(await page.locator('#research-standing-entry').count(), 0);
    assert.equal(await page.evaluate(() => window.F1S_RESEARCH_NOTEBOOK.snapshot()), null);
});

test('a delayed clipboard failure cannot expose A text after opening B', async t => {
    const { page } = await pageFor(t); await page.evaluate(async () => window.F1S_LOCAL_DRAFTS.save({ title: 'Clipboard B', editor: { step: 1 } }));
    await open(page); await page.locator('#research-question').fill('Συνθετικό κείμενο A');
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => new Promise((resolve, reject) => { window.__rejectClipboard = reject; }) } }));
    await page.getByRole('button', { name: 'Αντιγραφή brief', exact: true }).click();
    await page.waitForFunction(() => Boolean(window.__rejectClipboard));
    await page.locator('#gen-show-drafts').click(); await page.getByRole('button', { name: 'Άνοιγμα', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Συνέχεια χωρίς αποθήκευση' }).click();
    await page.waitForFunction(() => document.getElementById('gen-title').value === 'Clipboard B');
    await page.evaluate(async () => { window.__rejectClipboard(new Error('Denied')); await Promise.resolve(); });
    assert.equal(await page.locator('#research-copy-fallback').isHidden(), true);
    assert.equal(await page.locator('#research-copy-fallback').inputValue(), '');
});

test('full text loads only after explicit search, reports a failed shard and retries it', async t => {
    const { page, requests } = await pageFor(t, 390); await open(page);
    assert.equal(requests.filter(url => url.includes('/research-content/')).length, 0);
    await page.route('**/research-content/2026-10.json', route => route.fulfill({ status: 503 }));
    await page.locator('#research-question').fill('minisectors ακορντεόν');
    await page.locator('#research-question').press('Enter');
    await page.waitForFunction(() => document.getElementById('research-status').textContent.includes('Μερική κάλυψη'));
    assert.match(await page.locator('#research-status').textContent(), /16\/17/);
    assert.equal(requests.filter(url => url.endsWith('/research-content/manifest.json')).length, 1);
    await page.unroute('**/research-content/2026-10.json');
    await page.getByRole('button', { name: 'Εύρεση αναφορών', exact: true }).click();
    await page.waitForFunction(() => document.getElementById('research-status').textContent.includes('17/17'));
    await page.waitForSelector('.gb-research-results li'); assert.match(await page.locator('.gb-research-results').textContent(), /minisectors/);
    assert.ok(await page.locator('.gb-research-results .gb-research-passage').count() > 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const first = page.locator('.gb-research-results li').first();
    await first.getByRole('link', { name: 'Άνοιγμα άρθρου' }).focus();
    assert.equal(await first.getByRole('link', { name: 'Άνοιγμα άρθρου' }).evaluate(node => node === document.activeElement), true);
    assert.equal(await page.evaluate(() => 'hits' in (window.F1S_RESEARCH_NOTEBOOK.snapshot() || {})), false);
});

test('late full-text responses cannot restore a stale search', async t => {
    const { page } = await pageFor(t); await open(page);
    await page.route('**/research-content/2026-10.json', async route => {
        await new Promise(resolve => setTimeout(resolve, 500)); await route.continue();
    });
    await page.locator('#research-question').fill('minisectors ακορντεόν');
    await page.getByRole('button', { name: 'Εύρεση αναφορών', exact: true }).click();
    await page.waitForRequest('**/research-content/2026-10.json');
    await page.locator('#research-question').fill('');
    await page.waitForResponse('**/research-content/2026-10.json');
    assert.equal(await page.locator('.gb-research-results li').count(), 0);
});

test('retry refreshes metadata after a manifest arrives from a newer deployment', async t => {
    const { page, requests } = await pageFor(t); await open(page);
    const index = fs.readFileSync(path.join(root, 'blog-module/blog-index-data.json'), 'utf8');
    await page.route('**/blog-index-data.json', route => route.fulfill({ status: 200, contentType: 'application/json', body: index + ' ' }));
    await page.locator('#research-question').fill('minisectors ακορντεόν');
    await page.locator('#research-question').press('Enter');
    await page.waitForFunction(() => document.getElementById('research-status').textContent.includes('Μερική κάλυψη'));
    await page.unroute('**/blog-index-data.json');
    await page.getByRole('button', { name: 'Εύρεση αναφορών', exact: true }).click();
    await page.waitForFunction(() => document.getElementById('research-status').textContent.includes('17/17'));
    await page.waitForSelector('.gb-research-results .gb-research-passage');
    assert.equal(requests.filter(url => url.endsWith('/blog-index-data.json')).length, 2);
});

test('retry refreshes a stale manifest after a shard arrives from a newer deployment', async t => {
    const { page, requests } = await pageFor(t); await open(page);
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'scripts/author/research-content/manifest.json'), 'utf8'));
    manifest.shards.find(shard => shard.file === '2026-10.json').sha256 = '0'.repeat(64);
    await page.route('**/research-content/manifest.json', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(manifest) }));
    await page.locator('#research-question').fill('minisectors ακορντεόν');
    await page.locator('#research-question').press('Enter');
    await page.waitForFunction(() => document.getElementById('research-status').textContent.includes('Μερική κάλυψη'));
    await page.unroute('**/research-content/manifest.json');
    await page.getByRole('button', { name: 'Εύρεση αναφορών', exact: true }).click();
    await page.waitForFunction(() => document.getElementById('research-status').textContent.includes('17/17'));
    await page.waitForSelector('.gb-research-results .gb-research-passage');
    assert.equal(requests.filter(url => url.endsWith('/research-content/manifest.json')).length, 2);
});

test('full-text scoring yields and an edited query cancels the in-progress scan', async t => {
    const { page } = await pageFor(t); await open(page);
    await page.locator('#research-question').fill('minisectors ακορντεόν');
    await page.locator('#research-question').press('Enter');
    await page.waitForFunction(() => document.getElementById('research-status').textContent.includes('17/17'));
    await page.evaluate(() => {
        const realNow = performance.now.bind(performance), realTimeout = window.setTimeout;
        let ticks = 0;
        performance.now = () => realNow() + ++ticks * 9;
        window.setTimeout = (fn, delay, ...args) => {
            if (delay === 0) window.__researchYields = (window.__researchYields || 0) + 1;
            return realTimeout(fn, delay, ...args);
        };
    });
    await page.locator('#research-question').press('Enter');
    await page.waitForFunction(() => window.__researchYields > 0);
    await page.locator('#research-question').fill('');
    // Wait until no scan is still yielding, so a scan that ignored the edit would have rendered by now.
    await page.evaluate(async () => {
        let last = -1;
        while (window.__researchYields !== last) { last = window.__researchYields; await new Promise(resolve => setTimeout(resolve, 200)); }
    });
    assert.equal(await page.locator('.gb-research-results li').count(), 0);
});

test('claims capture, evidence review, stale edits, copy and anchor location stay in the notebook', async t => {
    const { page, external } = await pageFor(t); await open(page);
    const text = 'Αρχή · Ρυθμός α\u0301 1.029 δευτερόλεπτα · τέλος';
    await page.locator('#gen-content').fill(text);
    const quote = 'Ρυθμός α\u0301 1.029 δευτερόλεπτα';
    await page.locator('#gen-content').evaluate((node, value) => { const start = node.value.indexOf(value); node.setSelectionRange(start, start + value.length); }, quote);
    await page.getByText('Ισχυρισμοί & τεκμήρια', { exact: true }).click();
    await page.getByRole('button', { name: 'Από την επιλογή του άρθρου' }).click();
    let card = page.locator('details[id^="research-claim-"]');
    assert.equal(await card.locator('[id$="-text"]').inputValue(), quote);
    await card.getByRole('button', { name: 'Έλεγξα τον ισχυρισμό με τα παρακάτω τεκμήρια' }).click();
    assert.match(await card.textContent(), /Χρειάζεται αιτιολόγηση/);
    await card.locator('[id$="-type"]').selectOption('calculated-statistic');
    card = page.locator('details[id^="research-claim-"]');
    await card.locator('summary').filter({ hasText: /^Πλαίσιο$/ }).click();
    for (const [name, value] of [['scope-event', 'Monza'], ['scope-season', '2026'], ['scope-round', '17']]) await card.locator(`[id$="-${name}"]`).fill(value);
    await card.locator('[id$="-scope-session"]').selectOption('race');
    await card.getByText('Αριθμητικά στοιχεία', { exact: true }).click();
    for (const [name, value] of [['metric', 'Διαφορά α\u0301'], ['value', '1.029'], ['units', 's'], ['sample', '17 γύροι'], ['method', 'Διαφορά τιμών']]) await card.locator(`[id$="-numeric-${name}"]`).fill(value);
    await card.getByRole('button', { name: 'Προσθήκη αρχικής τιμής' }).click();
    await card.locator('[id$="-original-0-label"]').fill('Πρώτη'); await card.locator('[id$="-original-0-value"]').fill('0,250');
    await card.getByText('Πηγές & τεκμήρια', { exact: true }).click();
    await card.getByRole('button', { name: 'Προσθήκη πηγής' }).click();
    await card.locator('[id$="-source-0-title"]').fill('Πηγή <img src=x>');
    await card.locator('[id$="-source-0-url"]').fill('https://example.com/entry?edition=1');
    await card.locator('[id$="-rationale"]').fill('Αξιολόγησα και το πλαίσιο α\u0301.');
    await card.getByRole('button', { name: 'Έλεγξα τον ισχυρισμό με τα παρακάτω τεκμήρια' }).click();
    assert.equal(await page.evaluate(() => window.F1S_RESEARCH_NOTEBOOK.snapshot().claims[0].status), 'unreviewed');
    await card.locator('[id$="-source-0-locator-kind"]').selectOption('page');
    await card.locator('[id$="-source-0-locator-value"]').fill('2-3');
    await card.locator('[id$="-source-0-excerpt"]').fill('<script>untrusted</script>');
    await card.getByRole('button', { name: 'Έλεγξα τον ισχυρισμό με τα παρακάτω τεκμήρια' }).click();
    assert.match(await card.locator('summary').first().textContent(), /Ελέγχθηκε με τεκμήρια/);
    assert.equal(await card.locator('script, img').count(), 0);
    const reviewed = await page.evaluate(() => window.F1S_RESEARCH_NOTEBOOK.snapshot().claims[0]);
    assert.equal(reviewed.numeric.originalValues[0].value, '0,250'); assert.ok(reviewed.review.reviewedAt.endsWith('Z'));
    await card.locator('[id$="-text"]').fill(quote + '!');
    assert.match(await card.locator('summary').first().textContent(), /Χρειάζεται νέο έλεγχο/);
    await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.__claimCopy = value; } } }); });
    await card.getByRole('button', { name: 'Αντιγραφή κειμένου' }).click();
    assert.equal(await page.evaluate(() => window.__claimCopy), quote + '!');
    assert.match(await card.textContent(), /Η αντιγραφή δεν αποτελεί επαλήθευση/);
    await card.getByRole('button', { name: 'Εντοπισμός', exact: true }).click();
    assert.equal(await page.locator('#gen-content').evaluate(node => node.value.slice(node.selectionStart, node.selectionEnd)), quote);
    assert.equal(await page.locator('#gen-content').inputValue(), text);
    await page.locator('.gb-step[data-step="4"]').click(); await page.locator('#gen-save-draft').click(); await page.waitForFunction(() => document.getElementById('gen-draft-status').textContent.startsWith('Αποθηκεύτηκε'));
    await page.reload(); await page.locator('#gen-show-drafts').click(); await page.getByRole('button', { name: 'Άνοιγμα', exact: true }).click();
    await page.waitForFunction(() => document.getElementById('gen-draft-status').textContent.startsWith('Ανοιχτό')); await open(page);
    const reopened = await page.evaluate(() => window.F1S_RESEARCH_NOTEBOOK.snapshot().claims[0]);
    assert.equal(reopened.status, 'stale'); assert.equal(reopened.text, quote + '!'); assert.equal(reopened.numeric.originalValues[0].value, '0,250');
    assert.deepEqual(external, []);
});

test('claim review imports are demoted and controls fit mobile and desktop themes', async t => {
    for (const width of [390, 1440]) {
        const { page } = await pageFor(t, width); await open(page);
        await page.getByText('Ισχυρισμοί & τεκμήρια', { exact: true }).click();
        await page.getByRole('button', { name: 'Νέος ισχυρισμός' }).click();
        const card = page.locator('details[id^="research-claim-"]');
        await card.locator('[id$="-text"]').fill('Ισχυρισμός α\u0301');
        await card.getByText('Πηγές & τεκμήρια', { exact: true }).click(); await card.getByRole('button', { name: 'Προσθήκη πηγής' }).click();
        await card.locator('[id$="-source-0-title"]').fill('Πηγή'); await card.locator('[id$="-source-0-url"]').fill('https://example.com/a');
        await card.locator('[id$="-source-0-locator-kind"]').selectOption('section'); await card.locator('[id$="-source-0-locator-value"]').fill('Ενότητα 1');
        await card.locator('[id$="-rationale"]').fill('Έλεγχος πηγής'); await card.getByRole('button', { name: 'Έλεγξα τον ισχυρισμό με τα παρακάτω τεκμήρια' }).click();
        const payload = await page.evaluate(() => JSON.stringify({ format: 'f1stories-research', version: 1, research: window.F1S_RESEARCH_NOTEBOOK.snapshot() }));
        await page.locator('#research-import').setInputFiles({ name: 'research.json', mimeType: 'application/json', buffer: Buffer.from(payload) });
        await page.getByRole('dialog').getByRole('button', { name: 'Αντικατάσταση', exact: true }).click();
        await page.waitForFunction(() => window.F1S_RESEARCH_NOTEBOOK.snapshot().claims[0].status === 'stale');
        for (const theme of ['light', 'dark']) {
            await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true);
            const control = card.getByRole('button', { name: 'Αντιγραφή κειμένου' }); await control.focus();
            assert.equal(await control.evaluate(node => document.activeElement === node), true);
            await page.keyboard.press('Tab'); assert.ok(await page.evaluate(() => document.activeElement.closest('#research-notebook') !== null));
        }
    }
});

test('evidence controls keep keyboard focus through additions and removals', async t => {
    const { page } = await pageFor(t); await open(page);
    await page.getByText('Ισχυρισμοί & τεκμήρια', { exact: true }).click();
    await page.getByRole('button', { name: 'Νέος ισχυρισμός' }).click();
    const card = page.locator('details[id^="research-claim-"]');
    await card.getByText('Πηγές & τεκμήρια', { exact: true }).click();
    await card.getByRole('button', { name: 'Προσθήκη πηγής' }).focus(); await page.keyboard.press('Enter');
    await page.keyboard.type('Πηγή'); assert.equal(await card.locator('[id$="-source-0-title"]').inputValue(), 'Πηγή');
    await card.getByRole('button', { name: 'Αφαίρεση πηγής' }).focus(); await page.keyboard.press('Enter');
    assert.equal(await card.getByRole('button', { name: 'Προσθήκη πηγής' }).evaluate(node => node === document.activeElement), true);
    await card.getByText('Αριθμητικά στοιχεία', { exact: true }).click();
    await card.getByRole('button', { name: 'Προσθήκη αριθμητικών στοιχείων' }).focus(); await page.keyboard.press('Enter');
    await page.keyboard.type('Metric'); assert.equal(await card.locator('[id$="-numeric-metric"]').inputValue(), 'Metric');
    await card.getByRole('button', { name: 'Προσθήκη αρχικής τιμής' }).focus(); await page.keyboard.press('Enter');
    await page.keyboard.type('Value'); assert.equal(await card.locator('[id$="-original-0-label"]').inputValue(), 'Value');
    await card.getByRole('button', { name: 'Αφαίρεση αρχικής τιμής' }).focus(); await page.keyboard.press('Enter');
    assert.equal(await card.getByRole('button', { name: 'Προσθήκη αρχικής τιμής' }).evaluate(node => node === document.activeElement), true);
    await card.getByRole('button', { name: 'Αφαίρεση αριθμητικών στοιχείων' }).focus(); await page.keyboard.press('Enter');
    assert.equal(await card.getByRole('button', { name: 'Προσθήκη αριθμητικών στοιχείων' }).evaluate(node => node === document.activeElement), true);
    await card.getByRole('button', { name: 'Αφαίρεση', exact: true }).focus(); await page.keyboard.press('Enter');
    assert.equal(await page.locator('#research-new-claim').evaluate(node => node === document.activeElement), true);
});
