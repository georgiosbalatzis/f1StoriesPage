import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import JSZip from 'jszip';
import { Launcher } from 'chrome-launcher';
import os from 'node:os';
import { createResponsiveTableFromCSV } from '../../../blog-module/build/csv-to-table.js';
import { buildAuthorPreview } from '../../build/author-preview.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
let browser, server, origin, scratch;
before(async () => {
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-draft-tests-'));
    await buildAuthorPreview(root, path.relative(root, path.join(scratch, 'preview.js')));
    server = http.createServer((request, response) => {
        let file = path.resolve(root, '.' + new URL(request.url, 'http://localhost').pathname);
        if (file === path.join(root, 'scripts/author/article-preview.min.js')) file = path.join(scratch, 'preview.js');
        else if (file.includes('/scripts/author/') || !fs.existsSync(file)) file = file.replace(/\.min\.(js|css)$/, '.$1');
        if ((!file.startsWith(root + '/') && !file.startsWith(scratch + '/')) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404).end(); return; }
        const type = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.webp': 'image/webp', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' }[path.extname(file)] || 'application/octet-stream';
        response.writeHead(200, { 'Content-Type': type }); fs.createReadStream(file).pipe(response);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch({ executablePath: Launcher.getInstallations()[0], headless: true });
});
after(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); fs.rmSync(scratch, { recursive: true, force: true }); });

async function pageFor(t, profile = { viewport: { width: 1440, height: 1000 } }) {
    const context = await browser.newContext(profile);
    t.after(() => context.close());
    const page = await context.newPage();
    page.setDefaultTimeout(7000);
    await context.route('**/*', route => route.request().url().startsWith(origin) || route.request().url().startsWith('blob:') ? route.continue() : route.abort());
    await page.goto(origin + '/generate.html');
    await page.waitForFunction(() => window.F1S_LOCAL_DRAFTS && document.querySelector('[name="gen-author"]'));
    return page;
}
async function setText(page, title, text) {
    await page.evaluate(({ title, text }) => {
        for (const [id, value] of [['gen-title', title], ['gen-content', text]]) {
            const input = document.getElementById(id); input.value = value; input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }, { title, text });
}
async function setExcerpt(page, value) {
    await page.locator('#gen-excerpt').fill(value);
}
async function step(page, number) { await page.locator(`.gb-step[data-step="${number}"]`).click(); }
async function saved(page) { await page.waitForFunction(() => document.getElementById('gen-draft-status').textContent.startsWith('Αποθηκεύτηκε τοπικά')); }

test('IndexedDB CRUD: multiple incomplete/Greek drafts, Blob order, update identity and refresh persistence', async t => {
    const page = await pageFor(t);
    const result = await page.evaluate(async () => {
        const api = window.F1S_LOCAL_DRAFTS;
        const input = { title: '', author: 'Γιάννης', category: '', tags: 'ρυθμός, Σιγκαπούρη', text: 'Καλημέρα!\n\nΤόνοι: ά έ ή ί ό ύ ώ — α\u0301.',
            metadata: { sources: 'https://example.com/verified', token: 'dummy-secret' }, token: 'dummy-secret',
            hero: { blob: new Blob(['hero'], { type: 'image/webp' }), name: 'κεντρική.webp' },
            images: ['δεύτερη', 'πρώτη'].map(name => ({ name, blob: new Blob([name]) })) };
        const a = await api.save(input), b = await api.save({ text: '' });
        const update = await api.save({ ...input, title: 'Νέος τίτλος' }, a.id);
        const reopened = await api.get(a.id);
        return { id: a.id, second: b.id, created: a.createdAt, update, text: reopened.text,
            blobs: await Promise.all([reopened.hero.blob, ...reopened.images.map(image => image.blob)].map(blob => blob.text())),
            names: reopened.images.map(image => image.name), count: (await api.list()).length };
    });
    assert.equal(result.update.id, result.id); assert.equal(result.update.createdAt, result.created);
    assert.equal(result.count, 2); assert.equal(result.text, 'Καλημέρα!\n\nΤόνοι: ά έ ή ί ό ύ ώ — α\u0301.');
    assert.deepEqual(result.blobs, ['hero', 'δεύτερη', 'πρώτη']); assert.deepEqual(result.names, ['δεύτερη', 'πρώτη']);
    assert.ok(!JSON.stringify(result.update).includes('dummy-secret'));
    await page.reload();
    assert.equal(await page.evaluate(async id => (await window.F1S_LOCAL_DRAFTS.get(id)).title, result.id), 'Νέος τίτλος');
    await page.evaluate(async id => window.F1S_LOCAL_DRAFTS.remove(id), result.second);
    assert.equal(await page.evaluate(async () => (await window.F1S_LOCAL_DRAFTS.list()).length), 1);
});

test('storage quota, aborted transactions, corrupt records and database/unsupported failures do not report success', async t => {
    const page = await pageFor(t);
    const codes = await page.evaluate(async () => {
        const api = window.F1S_LOCAL_DRAFTS, results = [];
        const research = { version: 1, question: 'Συνθετική έρευνα', anchor: '', season: '', round: '', notes: [], form: { text: '', section: 'unverified', type: 'unverified', kind: 'general', verification: 'pending', sourceTitle: '', url: '', sourceDate: '', event: '', market: '', units: '', period: '', calculation: '', limitations: '' } };
        const put = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function () { throw new DOMException('Full', 'QuotaExceededError'); };
        try { await api.save({ text: 'κείμενο', research }); } catch (error) { results.push(error.code); }
        IDBObjectStore.prototype.put = function (value) { const request = put.call(this, value); this.transaction.abort(); return request; };
        try { await api.save({ text: 'κείμενο', research }); } catch (error) { results.push(error.code); }
        IDBObjectStore.prototype.put = put;
        results.push((await api.list()).length);
        // Updating an existing draft reports the same localized quota error as creating one, and keeps the stored record.
        const kept = await api.save({ text: 'κείμενο', research });
        IDBObjectStore.prototype.put = function () { throw new DOMException('Full', 'QuotaExceededError'); };
        try { await api.save({ text: 'νέο', research }, kept.id); } catch (error) { results.push(error.code); }
        IDBObjectStore.prototype.put = put;
        results.push((await api.get(kept.id)).text);
        await api.remove(kept.id);
        await new Promise((resolve, reject) => {
            const request = indexedDB.open('f1stories-author-drafts', 1);
            request.onsuccess = () => { const db = request.result, tx = db.transaction('drafts', 'readwrite'); tx.objectStore('drafts').put({ id: 'broken', title: '<img onerror=alert(1)>' }); tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = reject; };
        });
        try { await api.get('broken'); } catch (error) { results.push(error.code); }
        results.push((await api.list())[0].corrupt);
        const open = indexedDB.open;
        indexedDB.open = () => { throw new DOMException('Unavailable', 'SecurityError'); };
        try { await api.list(); } catch (error) { results.push(error.code); }
        indexedDB.open = open;
        Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true });
        try { await api.list(); } catch (error) { results.push(error.code); }
        return results;
    });
    assert.deepEqual(codes, ['quota', 'storage', 0, 'quota', 'κείμενο', 'corrupt', true, 'storage', 'unsupported']);
});

test('save/reopen/edit/delete restores every editor image and never makes GitHub requests', async t => {
    const page = await pageFor(t);
    const requests = [];
    await page.route('https://api.github.com/**', route => { requests.push(route.request().method()); return route.fulfill({ json: {} }); });
    await page.evaluate(() => sessionStorage.setItem('f1stories-gh-token', 'dummy-token-for-save-isolation'));
    await page.reload();
    assert.match(await page.locator('#gen-token-state').textContent(), /ενεργό/);
    await setText(page, 'Πρόχειρο με εικόνες', '# Ενότητα\n\n[img-instert-tag]\n\n[img-instert-tag]\n\nΤέλος.');
    await page.locator('[name="gen-author"][value="Giannis Poulikidis"]').check({ force: true });
    await page.locator('[name="gen-category"][value="Analysis"]').check({ force: true });
    await page.locator('#gen-hero-input').setInputFiles(path.join(root, 'blog-module/blog-entries/20261010J/1.webp'));
    await page.locator('#gen-header-input').setInputFiles(path.join(root, 'blog-module/blog-entries/20261020W/1.webp'));
    await page.locator('#gen-content-input').setInputFiles(['3', '4'].map(slot => path.join(root, `blog-module/blog-entries/20261020W/${slot}.webp`)));
    await page.waitForFunction(() => document.querySelectorAll('#gen-content-images-list li').length === 2 && document.querySelector('#gen-content-images-list img'));
    await step(page, 4); await page.locator('#gen-save-draft').click(); await saved(page);
    const id = await page.evaluate(async () => (await window.F1S_LOCAL_DRAFTS.list())[0].id);
    assert.ok(!(await page.evaluate(async () => JSON.stringify(await window.F1S_LOCAL_DRAFTS.list()))).includes('dummy-token-for-save-isolation'));
    await page.reload(); await page.locator('#gen-show-drafts').click();
    await page.locator('#gen-draft-list button').filter({ hasText: 'Άνοιγμα' }).click();
    await page.waitForFunction(() => document.getElementById('gen-draft-status').textContent.startsWith('Ανοιχτό'));
    assert.equal(await page.locator('#gen-title').inputValue(), 'Πρόχειρο με εικόνες');
    assert.equal(await page.locator('[name="gen-author"]:checked').inputValue(), 'Giannis Poulikidis');
    assert.equal(await page.locator('[name="gen-category"]:checked').inputValue(), 'Analysis');
    assert.equal(await page.locator('#gen-content-images-list img').count(), 2);
    assert.equal(await page.locator('#gen-hero-input').evaluate(input => input.files[0].size), fs.statSync(path.join(root, 'blog-module/blog-entries/20261010J/1.webp')).size);
    await setText(page, 'Διορθωμένο', 'Συνέχεια με ακριβείς τόνους.');
    await page.locator('#gen-save-draft').click(); await saved(page);
    assert.deepEqual(await page.evaluate(async () => (await window.F1S_LOCAL_DRAFTS.list()).map(value => value.id)), [id]);
    await setText(page, 'Μη αποθηκευμένο', 'Αλλαγές'); await page.locator('#gen-new-draft').click();
    assert.equal(await page.getByRole('dialog').count(), 1);
    await page.getByRole('button', { name: 'Ακύρωση', exact: true }).click();
    assert.equal(await page.locator('#gen-title').inputValue(), 'Μη αποθηκευμένο');
    await page.locator('#gen-show-drafts').click(); await page.getByRole('button', { name: 'Διαγραφή: Διορθωμένο', exact: true }).click();
    assert.equal(await page.getByRole('dialog').count(), 1);
    await page.getByRole('dialog').getByRole('button', { name: 'Διαγραφή', exact: true }).click();
    await page.waitForFunction(async () => (await window.F1S_LOCAL_DRAFTS.list()).length === 0);
    assert.deepEqual(requests, []);
});

test('article scheduling is absent and immediate publishing still uses the trusted workflow', () => {
    assert.equal(fs.existsSync(path.join(root, '.github/workflows/scheduled-publish.yml')), false);
    for (const file of ['generate.html', 'scripts/author/generate-page.js', 'scripts/author/github-client.js', 'scripts/author/housekeeping-page.js']) {
        assert.doesNotMatch(fs.readFileSync(path.join(root, file), 'utf8'), /author\/scheduled|f1s-publish-at|scheduledDate|parsePublishAt|publishAtMarker|gen-schedule/);
    }
    const workflow = fs.readFileSync(path.join(root, '.github/workflows/auto-publish-author-pr.yml'), 'utf8');
    assert.match(workflow, /author\/blog\/\*\*/);
    assert.match(workflow, /head_sha/);
    assert.match(workflow, /--match-head-commit/);
    assert.match(workflow, /Site Quality/);
});

test('switching drafts releases old image URLs and ignores a late image decode', async t => {
    const page = await pageFor(t);
    await page.evaluate(() => {
        const NativeImage = window.Image;
        window.__pendingImageLoads = [];
        window.Image = function () {
            const image = new NativeImage();
            Object.defineProperty(image, 'onload', { set(callback) { image.addEventListener('load', () => window.__pendingImageLoads.push(() => callback.call(image))); } });
            return image;
        };
        const revoke = URL.revokeObjectURL.bind(URL);
        window.__revokedImageURLs = [];
        URL.revokeObjectURL = url => { window.__revokedImageURLs.push(url); revoke(url); };
    });
    await page.locator('#gen-hero-input').setInputFiles(path.join(root, 'blog-module/blog-entries/20261010J/1.webp'));
    await page.waitForFunction(() => window.__pendingImageLoads.length === 1);
    await page.locator('#gen-new-draft').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Συνέχεια χωρίς αποθήκευση', exact: true }).click();
    await page.evaluate(async () => { window.__pendingImageLoads.forEach(finish => finish()); await new Promise(resolve => setTimeout(resolve, 0)); });
    assert.equal(await page.locator('#gen-hero-input').evaluate(input => input.files.length), 0);
    assert.equal(await page.locator('#gen-hero-thumb img').count(), 0);
    assert.equal(await page.evaluate(() => window.__revokedImageURLs.length), 1);
});

test('restored images remain saveable when a browser cannot assign file inputs', async t => {
    const page = await pageFor(t);
    const expected = await page.evaluate(async origin => {
        const blob = await (await fetch(origin + '/blog-module/blog-entries/20261010J/1.webp')).blob();
        await window.F1S_LOCAL_DRAFTS.save({ title: 'Δοκιμή αποκατάστασης', text: 'Κείμενο.', author: 'Giannis Poulikidis', category: 'Betting', hero: { blob, name: 'hero.webp' }, editor: { step: 4 } });
        window.DataTransfer = function () { throw new Error('File input assignment is unavailable'); };
        return blob.size;
    }, origin);
    await page.locator('#gen-show-drafts').click(); await page.getByRole('button', { name: 'Άνοιγμα', exact: true }).click();
    await page.waitForFunction(() => document.getElementById('gen-draft-status').textContent.startsWith('Ανοιχτό'));
    assert.equal(await page.locator('#gen-hero-input').evaluate(input => input.files.length), 0);
    assert.equal(await page.locator('#gen-hero-thumb img').count(), 1);
    await page.locator('#gen-save-draft').click(); await saved(page);
    assert.equal(await page.evaluate(async () => (await window.F1S_LOCAL_DRAFTS.list())[0].hero.blob.size), expected);
});

test('edits made during a save remain visibly unsaved and update the same draft on the next save', async t => {
    const page = await pageFor(t);
    await page.evaluate(() => {
        const save = window.F1S_LOCAL_DRAFTS.save;
        let first = true;
        window.F1S_LOCAL_DRAFTS.save = async (...args) => {
            const result = await save(...args);
            if (first) { first = false; await new Promise(resolve => window.__finishDraftSave = resolve); }
            return result;
        };
    });
    await setText(page, 'Αρχικός τίτλος', 'Κείμενο πριν από την αποθήκευση.');
    await step(page, 1); await page.locator('#research-toggle').click();
    await page.locator('#research-question').fill('Πριν την αποθήκευση');
    await step(page, 4); await page.locator('#gen-save-draft').click();
    await page.waitForFunction(() => Boolean(window.__finishDraftSave));
    await setText(page, 'Νεότερος τίτλος', 'Κείμενο που γράφτηκε ενώ αποθηκευόταν.');
    await step(page, 1); await page.locator('#research-question').fill('Μετά την αποθήκευση'); await step(page, 4);
    await page.evaluate(() => window.__finishDraftSave());
    await saved(page);
    assert.match(await page.locator('#gen-draft-status').textContent(), /νεότερες μη αποθηκευμένες αλλαγές/);
    const before = await page.evaluate(async () => (await window.F1S_LOCAL_DRAFTS.list())[0]);
    assert.equal(before.title, 'Αρχικός τίτλος'); assert.equal(before.research.question, 'Πριν την αποθήκευση');
    await page.locator('#gen-save-draft').click(); await saved(page);
    const after = await page.evaluate(async () => await window.F1S_LOCAL_DRAFTS.list());
    assert.equal(after.length, 1); assert.equal(after[0].id, before.id); assert.equal(after[0].title, 'Νεότερος τίτλος'); assert.equal(after[0].research.question, 'Μετά την αποθήκευση');
});

test('only explicit publish from a saved draft retains author/blog PR behavior and keeps the draft', async t => {
    const page = await pageFor(t);
    const calls = [];
    await page.route('https://api.github.com/**', async route => {
        const request = route.request(), url = new URL(request.url()), suffix = url.pathname.replace('/repos/georgiosbalatzis/f1StoriesPage', '');
        calls.push({ suffix, method: request.method(), body: request.postDataJSON() });
        let data = {};
        if (suffix.startsWith('/pulls?') || suffix === '/pulls' && request.method() === 'GET') data = [];
        else if (suffix.startsWith('/contents/')) return route.fulfill({ status: 404, json: { message: 'Not Found' } });
        else if (suffix === '/git/ref/heads/main') data = { object: { sha: 'base-sha' } };
        else if (suffix === '/git/commits/base-sha') data = { tree: { sha: 'tree-sha' } };
        else if (suffix === '/pulls') data = { number: 123, html_url: 'https://github.com/example/dummy/pull/123' };
        else data = { sha: 'mock-sha' };
        await route.fulfill({ json: data });
    });
    const canary = 'SYNTHETIC_E01_CANARY_42891';
    const claimCanary = 'SYNTHETIC_E02_CLAIM_92841', reviewCanary = 'SYNTHETIC_E02_REVIEW_92841';
    await page.evaluate(() => { localStorage.setItem('f1stories-cookie-consent-v1', JSON.stringify({ analytics: true })); window.__events = []; window.gtag = (...args) => window.__events.push(args); });
    await step(page, 1); await page.locator('#research-toggle').click();
    await page.locator('details').filter({ has: page.locator('#research-note-text') }).evaluate(node => { node.open = true; });
    await page.locator('#research-note-text').fill(canary);
    await page.getByRole('button', { name: 'Προσθήκη σημείωσης', exact: true }).click();
    await page.getByText('Ισχυρισμοί & τεκμήρια', { exact: true }).click();
    await page.getByRole('button', { name: 'Νέος ισχυρισμός' }).click();
    const claimCard = page.locator('details[id^="research-claim-"]');
    await claimCard.locator('[id$="-text"]').fill(claimCanary);
    await claimCard.getByText('Πηγές & τεκμήρια', { exact: true }).click();
    await claimCard.getByRole('button', { name: 'Προσθήκη πηγής' }).click();
    await claimCard.locator('[id$="-source-0-title"]').fill('Συνθετική πηγή');
    await claimCard.locator('[id$="-source-0-url"]').fill('https://example.com/synthetic');
    await claimCard.locator('[id$="-source-0-locator-kind"]').selectOption('section');
    await claimCard.locator('[id$="-source-0-locator-value"]').fill('Ενότητα 1');
    await claimCard.locator('[id$="-rationale"]').fill(reviewCanary);
    await claimCard.getByRole('button', { name: 'Έλεγξα τον ισχυρισμό με τα παρακάτω τεκμήρια' }).click();
    assert.equal(await page.evaluate(() => window.F1S_RESEARCH_NOTEBOOK.snapshot().claims[0].status), 'reviewed-with-evidence');
    await page.locator('#research-import').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{' + canary) });
    await page.waitForFunction(() => document.getElementById('research-status').textContent.includes('δεν είναι έγκυρο'));
    await page.evaluate(async () => {
        const put = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function () { throw new DOMException('Full', 'QuotaExceededError'); };
        try { await window.F1S_LOCAL_DRAFTS.save({ research: window.F1S_RESEARCH_NOTEBOOK.snapshot() }); } catch (_) {}
        finally { IDBObjectStore.prototype.put = put; }
        sessionStorage.removeItem('f1s-err-count');
        const reason = new Error('synthetic failure'), promise = Promise.reject(reason); promise.catch(() => {});
        window.dispatchEvent(new PromiseRejectionEvent('unhandledrejection', { promise, reason }));
    });
    assert.ok((await page.evaluate(() => window.__events.length)) > 0);
    await setText(page, 'Άρθρο από πρόχειρο', 'Κείμενο για άμεση δημοσίευση.');
    await step(page, 0); await setExcerpt(page, 'Η ανάλυση του αγώνα: γιατί η McLaren & η Mercedes «χάνουν» χρόνο στα φρένα;');
    await page.locator('[name="gen-author"][value="Giannis Poulikidis"]').check({ force: true });
    await page.locator('[name="gen-category"][value="Analysis"]').check({ force: true });
    await step(page, 3); await page.waitForFunction(() => Boolean(window.F1S_ARTICLE_PREVIEW));
    await page.evaluate(() => { const original = window.F1S_ARTICLE_PREVIEW.render; window.F1S_ARTICLE_PREVIEW.render = async state => { window.__previewInput = JSON.stringify(state); return original(state); }; });
    await step(page, 4); await page.locator('#gen-save-draft').click(); await saved(page);
    const savedResearch = await page.evaluate(async () => (await window.F1S_LOCAL_DRAFTS.list())[0].research);
    assert.ok(JSON.stringify(savedResearch).includes(canary));
    for (const secret of [claimCanary, reviewCanary]) assert.ok(JSON.stringify(savedResearch).includes(secret));
    await step(page, 3); await page.waitForFunction(() => window.__previewInput !== undefined);
    assert.ok(!(await page.evaluate(() => window.__previewInput)).includes(canary));
    assert.ok(!(await page.locator('#gen-article-preview').getAttribute('srcdoc')).includes(canary));
    await step(page, 4); await page.locator('.gb-zip-utility summary').click();
    const [archive] = await Promise.all([page.waitForEvent('download'), page.locator('#gen-export-btn').click()]);
    const zip = await JSZip.loadAsync(fs.readFileSync(await archive.path()));
    for (const entry of Object.values(zip.files)) if (!entry.dir) assert.ok(!(await entry.async('nodebuffer')).includes(Buffer.from(canary)));
    assert.deepEqual(calls, []);
    await page.locator('#gen-publish-btn').click();
    await page.getByRole('dialog').getByRole('textbox').fill('dummy-token-only-for-tests');
    await page.getByRole('dialog').getByRole('button', { name: 'OK', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Άνοιγμα PR', exact: true }).click();
    await page.waitForFunction(() => !document.getElementById('gen-result').hidden);
    const branch = calls.find(call => call.suffix === '/git/refs').body.ref;
    assert.match(branch, /^refs\/heads\/author\/blog\/\d{8}j-/);
    const textBlob = calls.find(call => call.suffix === '/git/blobs').body;
    const publishedSource = Buffer.from(textBlob.content, 'base64').toString('utf8');
    assert.match(publishedSource, /category: Analysis/);
    assert.equal(publishedSource.match(/^excerpt: .*$/gm).join('\n'), 'excerpt: Η ανάλυση του αγώνα: γιατί η McLaren & η Mercedes «χάνουν» χρόνο στα φρένα;');
    assert.equal(calls.filter(call => call.suffix === '/pulls' && call.method === 'POST').length, 1);
    assert.ok(calls.some(call => call.suffix === '/git/commits' && call.method === 'POST'));
    assert.ok(!JSON.stringify(calls).includes('f1s-publish-at'));
    assert.ok(!JSON.stringify(calls).includes(canary));
    for (const call of calls.filter(value => value.suffix === '/git/blobs' && value.body?.encoding === 'base64')) assert.ok(!Buffer.from(call.body.content, 'base64').includes(Buffer.from(canary)));
    assert.ok(!JSON.stringify(await page.evaluate(() => window.__events)).includes(canary));
    for (const secret of [claimCanary, reviewCanary]) {
        assert.ok(!(await page.evaluate(() => window.__previewInput)).includes(secret));
        assert.ok(!(await page.locator('#gen-article-preview').getAttribute('srcdoc')).includes(secret));
        for (const entry of Object.values(zip.files)) if (!entry.dir) assert.ok(!(await entry.async('nodebuffer')).includes(Buffer.from(secret)));
        assert.ok(!JSON.stringify(calls).includes(secret));
        for (const call of calls.filter(value => value.suffix === '/git/blobs' && value.body?.encoding === 'base64')) assert.ok(!Buffer.from(call.body.content, 'base64').includes(Buffer.from(secret)));
        assert.ok(!JSON.stringify(await page.evaluate(() => window.__events)).includes(secret));
    }
    assert.deepEqual(await page.evaluate(async () => (await window.F1S_LOCAL_DRAFTS.list())[0].research), savedResearch);
    assert.deepEqual(await page.evaluate(() => window.F1S_RESEARCH_NOTEBOOK.snapshot()), savedResearch);
    assert.ok(!calls.some(call => /actions|deploy|merge/.test(call.suffix)));
    assert.equal(await page.evaluate(async () => (await window.F1S_LOCAL_DRAFTS.list()).length), 1);
    assert.match(await page.locator('#gen-result').innerText(), /Η δημοσίευση εκκρεμεί/);
});

test('the description field counts, validates, blocks publishing and survives drafts, ZIP export/import and preview', async t => {
    const page = await pageFor(t);
    await setText(page, 'Άρθρο με περιγραφή', 'Πρώτη παράγραφος του κειμένου.\n\nΔεύτερη παράγραφος.');
    await step(page, 4);
    assert.equal(await page.locator('#gen-publish-btn').isDisabled(), true);
    assert.match(await page.locator('#gen-review').innerText(), /Λείπει η περιγραφή άρθρου \(excerpt\)/);
    await step(page, 0);
    // Not a live region: typing never interrupts a screen reader; the count and issues are in aria-describedby.
    assert.equal(await page.locator('#gen-excerpt').getAttribute('aria-describedby'), 'gen-excerpt-hint gen-excerpt-count gen-excerpt-warnings');
    assert.equal(await page.locator('label[for="gen-excerpt"]').textContent(), 'Περιγραφή άρθρου');
    await setExcerpt(page, `${'α'.repeat(150)} β γ δ ε ζ`);
    assert.equal(await page.locator('#gen-excerpt-count').innerText(), '160 / 155');
    assert.equal(await page.locator('#gen-excerpt-count').evaluate(node => node.classList.contains('is-warn')), true);
    assert.equal(await page.locator('#gen-excerpt').getAttribute('aria-invalid'), 'true');
    assert.match(await page.locator('#gen-excerpt-warnings').innerText(), /160 χαρακτήρες· το όριο είναι 155\. Συντόμευσέ τη κατά 5\./);
    await setExcerpt(page, 'Η <b>Ferrari</b> στη Μόντσα');
    assert.match(await page.locator('#gen-excerpt-warnings').innerText(), /HTML ή κωδικούς χαρακτήρων/);
    const excerpt = 'Γιατί η Ferrari 🏎️ «κέρδισε» στη Μόντσα: η στρατηγική & τα ελαστικά.';
    const count = [...new Intl.Segmenter('el', { granularity: 'grapheme' }).segment(excerpt)].length;
    await setExcerpt(page, `  ${excerpt.replace(' «', '   «')}\n`);
    assert.equal(await page.locator('#gen-excerpt-count').innerText(), `${count} / 155`);
    assert.equal(await page.locator('#gen-excerpt').getAttribute('aria-invalid'), 'false');
    assert.equal(await page.locator('#gen-card-excerpt').innerText(), excerpt);
    await step(page, 4);
    assert.equal(await page.locator('#gen-publish-btn').isDisabled(), false);
    assert.match(await page.locator('#gen-review').innerText(), new RegExp(`Περιγραφή · ${count} / 155 χαρακτήρες`));
    // The summary card previews the description; the article preview never adds it to the body.
    await step(page, 3);
    await page.waitForFunction(() => document.getElementById('gen-article-preview').contentDocument?.querySelector('.article-content p'));
    const previewBody = await page.evaluate(() => document.getElementById('gen-article-preview').contentDocument.querySelector('.article-content').textContent);
    assert.ok(previewBody.includes('Πρώτη παράγραφος') && !previewBody.includes('στρατηγική & τα'));
    assert.equal(await page.locator('#gen-card-excerpt').innerText(), excerpt);
    await step(page, 4); await page.locator('#gen-save-draft').click(); await saved(page);
    await page.reload(); await page.locator('#gen-show-drafts').click();
    await page.locator('#gen-draft-list button').filter({ hasText: 'Άνοιγμα' }).click();
    await page.waitForFunction(() => document.getElementById('gen-draft-status').textContent.startsWith('Ανοιχτό'));
    assert.equal(await page.locator('#gen-excerpt').inputValue(), excerpt);
    // Editing the body never rewrites an existing description.
    await setText(page, 'Άρθρο με περιγραφή', 'Εντελώς νέο κείμενο σώματος.');
    assert.equal(await page.locator('#gen-excerpt').inputValue(), excerpt);
    await step(page, 4); await page.locator('.gb-zip-utility summary').click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#gen-export-btn').click()]);
    const zip = await JSZip.loadAsync(fs.readFileSync(await download.path()));
    const source = await zip.file(/source\.txt$/)[0].async('string');
    assert.deepEqual(source.match(/^excerpt: .*$/gm), [`excerpt: ${excerpt}`]);
    // Import into an empty editor: the description and unrelated front matter come back exactly once.
    await page.reload();
    const file = path.join(scratch, 'import.zip');
    zip.file(zip.file(/source\.txt$/)[0].name, source.replace(/^title: .*$/m, '$&\nsources: Πηγή | https://example.com/a'));
    fs.writeFileSync(file, await zip.generateAsync({ type: 'nodebuffer' }));
    await step(page, 4); await page.locator('.gb-zip-utility summary').click();
    await page.locator('#gen-import-input').setInputFiles(file);
    await page.waitForFunction(() => document.getElementById('gen-excerpt').value);
    assert.equal(await page.locator('#gen-excerpt').inputValue(), excerpt);
    const [again] = await Promise.all([page.waitForEvent('download'), page.locator('#gen-export-btn').click()]);
    const reexported = await (await JSZip.loadAsync(fs.readFileSync(await again.path()))).file(/source\.txt$/)[0].async('string');
    assert.deepEqual(reexported.match(/^excerpt: .*$/gm), [`excerpt: ${excerpt}`]);
    assert.deepEqual(reexported.match(/^sources: .*$/gm), ['sources: Πηγή | https://example.com/a']);
});

// On a phone the panel's publish button is hidden; the bottom-nav button is the only way to publish.
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 };
async function toReviewByNav(page) {
    for (let i = 0; i < 4; i++) await page.locator('#gen-next').tap();
    await page.waitForFunction(() => !document.querySelector('[data-panel="4"]').hidden);
}
const panelTitle = page => page.evaluate(() => [...document.querySelectorAll('.gb-panel')].find(panel => !panel.hidden).querySelector('.gb-title').textContent);

test('phone: a description the browser restored without an input event still lets the article publish', async t => {
    const page = await pageFor(t, PHONE);
    assert.equal(await page.locator('#gen-publish-btn').isVisible(), false, 'the in-panel publish button is hidden on phones');
    await setText(page, 'Άρθρο από το κινητό', 'Πρώτη παράγραφος.\n\nΔεύτερη παράγραφος.');
    // Form restoration after a mobile tab reload (and some keyboards) fill the field without an input event.
    await page.evaluate(() => { document.getElementById('gen-excerpt').value = 'Σύντομη περιγραφή του άρθρου για την Google και την κοινοποίηση.'; });
    await toReviewByNav(page);
    assert.match(await page.locator('#gen-review').innerText(), /Περιγραφή · \d+ \/ 155 χαρακτήρες/);
    await page.locator('#gen-next').tap();
    await page.locator('.f1s-author-dialog').filter({ hasText: 'GitHub Personal Access Token' }).waitFor();
    assert.equal(await panelTitle(page), 'Έλεγχος & Δημοσίευση', 'publishing starts instead of returning to step 1');
});

test('phone: a missing description is explained, then its field opens, instead of a silent jump to step 1', async t => {
    const page = await pageFor(t, PHONE);
    await setText(page, 'Άρθρο χωρίς περιγραφή', 'Κείμενο του άρθρου.');
    await toReviewByNav(page);
    await page.locator('#gen-next').tap();
    const dialog = page.locator('.f1s-author-dialog');
    await dialog.waitFor();
    assert.match(await dialog.innerText(), /Δεν μπορεί να δημοσιευτεί ακόμη[\s\S]*Λείπει η περιγραφή άρθρου \(excerpt\)/);
    await dialog.locator('.f1s-author-dialog-btn-primary').tap();
    await page.waitForFunction(() => document.activeElement?.id === 'gen-excerpt');
    assert.equal(await panelTitle(page), 'Βασικά');
    // Once it is written, the same button publishes.
    await page.locator('#gen-excerpt').fill('Σύντομη περιγραφή του άρθρου για την Google και την κοινοποίηση.');
    await toReviewByNav(page);
    await page.locator('#gen-next').tap();
    await page.locator('.f1s-author-dialog').filter({ hasText: 'GitHub Personal Access Token' }).waitFor();
});

test('an old draft without a description opens with an empty field and no suggestion', async t => {
    const page = await pageFor(t);
    await page.evaluate(() => window.F1S_LOCAL_DRAFTS.save({ title: 'Παλιό πρόχειρο', author: 'Georgios Balatzis', category: 'News', tags: '', text: 'Κείμενο παλιού προχείρου.', metadata: { sources: 'Πηγή | https://example.com/b' }, images: [], editor: { step: 0 } }));
    await page.reload(); await page.locator('#gen-show-drafts').click();
    await page.locator('#gen-draft-list button').filter({ hasText: 'Άνοιγμα' }).click();
    await page.waitForFunction(() => document.getElementById('gen-draft-status').textContent.startsWith('Ανοιχτό'));
    assert.equal(await page.locator('#gen-title').inputValue(), 'Παλιό πρόχειρο');
    assert.equal(await page.locator('#gen-excerpt').inputValue(), '');
    assert.equal(await page.locator('#gen-excerpt-count').innerText(), '0 / 155');
    assert.equal(await page.locator('#gen-excerpt').getAttribute('aria-invalid'), 'false');
});

test('preview uses Race Report at real 1440/390 viewports, live values, shared typography and safe embeds', async t => {
    const page = await pageFor(t);
    await setText(page, 'Μεγάλος ελληνικός τίτλος: τι αλλάζει στη Formula 1 και γιατί η ανάλυση του αγώνα έχει σημασία',
        '# Ενότητα\n\nΠαράγραφος **έντονη** και *πλάγια*.\n\n- Ένα\n- Δύο\n\n| Οδηγός | Χρόνος |\n| --- | --- |\n| Νόρις | 1:20 |\n\nIFRAME:https://f1-stories.gr/standings/?tab=debrief&embed=1\n\n<iframe src="javascript:alert(1)" onload="parent.alert(1)"></iframe>\n\n<script>parent.__draftInjected=true</script>');
    await step(page, 3);
    await page.waitForFunction(() => document.getElementById('gen-article-preview').contentDocument?.querySelector('.rr-title'));
    const frame = page.frames().find(frame => frame.url() === 'about:srcdoc');
    for (const width of [1440, 390]) {
        await page.getByRole('button', { name: width === 390 ? 'Κινητό' : 'Desktop', exact: true }).click();
        for (const theme of ['light', 'dark']) {
            await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
            await frame.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
            const result = await frame.evaluate(() => ({ width: innerWidth, kind: document.querySelector('.rr').dataset.articleKind,
                rr: ['.rr-article', '.rr-cover__grid', '.rr-cover__media', '.rr-cover__text', '.rr-timing', '.rr-layout', '.rr-body', '.rr-pitwall', '.rr-tower'].every(selector => document.querySelector(selector)),
                content: document.querySelector('.rr-body').textContent, unsafe: Boolean(document.querySelector('script, iframe[src^="javascript:"], [onload], [onerror], link[rel="canonical"]')),
                tower: getComputedStyle(document.querySelector('.rr-tower')).display, data: document.querySelectorAll('.rr-data').length,
                title: getComputedStyle(document.querySelector('.rr-title')).fontFamily }));
            assert.equal(result.width, width); assert.ok(result.rr); assert.equal(result.unsafe, false);
            assert.equal(result.data, 1); assert.equal(result.kind, 'news');
            assert.equal(result.tower === 'none', width === 390);
            assert.match(result.title, /IBM Plex Sans/);
        }
    }
    assert.equal(await page.evaluate(() => window.__draftInjected), undefined);
    assert.equal(await page.locator('#gen-article-preview').getAttribute('sandbox'), 'allow-same-origin');
    await step(page, 0); await page.locator('#gen-title').fill('Αλλαγή χωρίς αποθήκευση'); await step(page, 3);
    await page.waitForFunction(() => document.getElementById('gen-article-preview').contentDocument?.querySelector('.rr-title')?.textContent.includes('Αλλαγή χωρίς αποθήκευση'));
});

test('published News, Analysis, Technical, History and Betting articles match preview geometry and editorial content', async t => {
    const posts = JSON.parse(fs.readFileSync(path.join(root, 'blog-module/blog-source-cache.json'), 'utf8')).posts;
    const ids = ['20261005G', '20261008J', '20261015G', '20261021W', '20261010J'];
    const evidence = process.env.F1S_AUTHOR_QA_DIR;
    if (evidence) fs.mkdirSync(evidence, { recursive: true });
    const report = [];
    for (const id of ids) {
        const post = posts.find(post => post.id === id);
        const page = await pageFor(t);
        const dir = path.join(root, 'blog-module/blog-entries', id);
        const source = fs.readFileSync(path.join(dir, 'source.txt'), 'utf8');
        const draftId = await page.evaluate(async ({ source, post, origin }) => {
            const parsed = window.F1S_AUTHOR_ARTICLE_SOURCE.parseSourceText(source, { id: post.id });
            const state = { title: parsed.title, text: parsed.body, tags: parsed.tags.join(', '), author: post.author, category: parsed.category, metadata: parsed.metadata, images: [], editor: { step: 3 } };
            // Load source images as Blobs, just as local draft restore does; no ZIP or GitHub token is involved.
            for (let slot = 1; slot <= 30; slot++) {
                const image = await fetch(origin + '/blog-module/blog-entries/' + post.id + '/' + slot + '.webp');
                if (!image.ok) { if (slot < 3) continue; break; }
                const value = { blob: await image.blob(), name: slot + '.webp' };
                if (slot === 1) state.hero = value; else if (slot === 2) state.banner = value; else state.images.push(value);
            }
            return (await window.F1S_LOCAL_DRAFTS.save(state)).id;
        }, { source, post, origin });
        await page.locator('#gen-show-drafts').click(); await page.getByRole('button', { name: 'Άνοιγμα', exact: true }).click();
        await page.waitForFunction(() => document.getElementById('gen-article-preview').contentDocument?.querySelector('.rr-title'));
        const frame = page.frames().find(frame => frame.url() === 'about:srcdoc');
        const published = await page.context().newPage();
        const isolated = await page.context().newPage();
        const html = await page.locator('#gen-article-preview').getAttribute('srcdoc');
        for (const width of [1440, 390]) for (const theme of ['dark', 'light']) {
            for (const target of [published, isolated]) await target.setViewportSize({ width, height: 1000 });
            await published.goto(origin + '/blog-module/blog-entries/' + id + '/article.html');
            await isolated.goto(origin + '/generate.html');
            await isolated.setContent(html);
            for (const target of [published, isolated]) {
                await target.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
                await target.evaluate(() => document.fonts.ready);
                await target.locator('.rr-cover img').evaluateAll(images => Promise.all(images.map(image => image.decode().catch(() => {}))));
                await target.evaluate(() => document.getAnimations().forEach(animation => { if (Number.isFinite(animation.effect.getComputedTiming().endTime)) animation.finish(); }));
            }
            const metrics = async target => target.evaluate(() => {
                const style = selector => {
                    const node = document.querySelector(selector);
                    if (!node) return null;
                    const css = getComputedStyle(node), rect = node.getBoundingClientRect();
                    return { width: rect.width, height: rect.height, fontFamily: css.fontFamily, fontSize: css.fontSize, fontWeight: css.fontWeight,
                        lineHeight: css.lineHeight, letterSpacing: css.letterSpacing, color: css.color, marginBottom: css.marginBottom };
                };
                return { kind: document.querySelector('.rr').dataset.articleKind, cover: document.querySelector('.rr-cover').className,
                    title: style('.rr-title'), image: style('.rr-cover__media img'), body: style('.rr-body'),
                    timing: style('.rr-timing'), byline: document.querySelector('.rr-cover__side').textContent.replace(/\s+/g, ' ').trim(),
                    paragraph: style('.rr-body > p'), heading: style('.rr-body h2, .rr-body h3'), author: style('.rr-pitwall__name'),
                    authorText: document.querySelector('.rr-pitwall__name').textContent.trim(),
                    prose: [...document.querySelectorAll('.rr-body > p, .rr-body > h2, .rr-body > h3')].map(node => node.textContent.replace(/\s+/g, ' ').trim()),
                    data: document.querySelectorAll('.rr-data').length, gallery: document.querySelectorAll('.gallery-carousel').length,
                    imageCount: document.querySelectorAll('.rr-body .article-content-img').length, overflow: document.documentElement.scrollWidth > innerWidth,
                    runningOrder: [...document.querySelectorAll('.rr-tower a')].map(link => link.textContent.replace(/\s+/g, ' ').trim()) };
            });
            const expected = await metrics(published), actual = await metrics(isolated);
            for (const field of ['kind', 'cover', 'byline', 'authorText', 'prose', 'data', 'gallery', 'imageCount', 'runningOrder']) assert.deepEqual(actual[field], expected[field], `${id}/${width}/${theme}: ${field}`);
            for (const field of ['title', 'timing', 'paragraph', 'heading', 'author']) assert.deepEqual(actual[field], expected[field], `${id}/${width}/${theme}: ${field}`);
            // Published AVIF variants can round an original WebP's ratio by a fraction of a pixel.
            const { width: imageWidth, height: imageHeight, ...imageStyle } = actual.image;
            const { width: expectedWidth, height: expectedImageHeight, ...expectedImageStyle } = expected.image;
            assert.deepEqual(imageStyle, expectedImageStyle);
            assert.ok(Math.abs(imageWidth - expectedWidth) <= 1 && Math.abs(imageHeight - expectedImageHeight) <= 1, `${id}/${width}/${theme}: image geometry within one pixel`);
            const { height: actualHeight, ...body } = actual.body;
            const { height: expectedHeight, ...expectedBody } = expected.body;
            assert.deepEqual(body, expectedBody, `${id}/${width}/${theme}: body measure and typography`);
            assert.equal(actual.overflow, false);
            report.push({ id, category: post.categories[0], width, theme, cover: actual.cover, bodyWidth: body.width, titleHeight: actual.title.height, bodyHeightDifference: actualHeight - expectedHeight });
            if (evidence) {
                for (const [name, target] of [['published', published], ['preview', isolated]]) {
                    await target.locator('.rr-cover').screenshot({ path: path.join(evidence, `${post.categories[0]}-${width}-${theme}-${name}.png`), animations: 'disabled' });
                    if ((id === '20261015G' && width === 1440 && theme === 'light') || (id === '20261021W' && width === 390 && theme === 'light')) {
                        await target.locator('.rr-body').evaluate(node => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
                        await target.screenshot({ path: path.join(evidence, `${post.categories[0]}-${width}-${theme}-body-${name}.png`), animations: 'disabled' });
                        await target.locator('.rr-pitwall').screenshot({ path: path.join(evidence, `${post.categories[0]}-${width}-${theme}-author-${name}.png`), animations: 'disabled' });
                    }
                }
            }
        }
        await page.close(); await published.close(); await isolated.close();
    }
    if (evidence) fs.writeFileSync(path.join(evidence, 'parity.json'), JSON.stringify(report, null, 2));
});

test('portrait, landscape and square images use the production cover variants', async t => {
    const page = await pageFor(t);
    assert.equal(await page.evaluate(() => Boolean(window.F1S_ARTICLE_PREVIEW)), false, 'preview code is not loaded before it is needed');
    await step(page, 3);
    await page.waitForFunction(() => Boolean(window.F1S_ARTICLE_PREVIEW));
    const variants = await page.evaluate(async () => {
        const variants = [];
        for (const [width, height] of [[1600, 900], [1050, 791], [500, 1000], [300, 300]]) {
            const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp'));
            const result = await window.F1S_ARTICLE_PREVIEW.render({ title: 'Δοκιμή αναλογιών', text: 'Κείμενο.', category: 'Technical', author: 'Georgios Balatzis', tags: '', metadata: {}, hero: { blob, width, height }, images: [] });
            const doc = new DOMParser().parseFromString(result.html, 'text/html');
            variants.push(doc.querySelector('.rr-cover').className); result.dispose();
        }
        return variants;
    });
    assert.deepEqual(variants, ['rr-cover rr-cover--bleed', 'rr-cover rr-cover--split', 'rr-cover rr-cover--inset', 'rr-cover rr-cover--inset']);
});

test('IndexedDB drafts and image Blobs survive closing and restarting a browser profile', async t => {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-draft-profile-'));
    t.after(() => fs.rmSync(profile, { recursive: true, force: true }));
    let id;
    for (const first of [true, false]) {
        const context = await chromium.launchPersistentContext(profile, { executablePath: Launcher.getInstallations()[0], headless: true });
        try {
            const page = await context.newPage();
            await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
            await page.goto(origin + '/generate.html');
            if (first) id = await page.evaluate(async () => (await window.F1S_LOCAL_DRAFTS.save({ title: 'Μετά την επανεκκίνηση', hero: { blob: new Blob(['persistent bytes']), name: 'εικόνα.webp' } })).id);
            else assert.deepEqual(await page.evaluate(async id => { const value = await window.F1S_LOCAL_DRAFTS.get(id); return [value.title, await value.hero.blob.text()]; }, id), ['Μετά την επανεκκίνηση', 'persistent bytes']);
        } finally { await context.close(); }
    }
});


async function renderedTable(table) {
    return table.evaluate(table => {
        const container = table.closest('.table-container.scroll-view');
        const rect = container.getBoundingClientRect();
        container.scrollLeft = 100;
        const cells = [...table.querySelectorAll('th, td')].map(cell => {
            const box = cell.getBoundingClientRect(), style = getComputedStyle(cell);
            return { text: cell.textContent.trim(), width: box.width, height: box.height,
                visible: cell.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }), fontSize: parseFloat(style.fontSize) };
        });
        const result = { display: getComputedStyle(container).display, width: rect.width, height: rect.height,
            overflowX: getComputedStyle(container).overflowX, scrollLeft: container.scrollLeft,
            documentOverflow: document.documentElement.scrollWidth > innerWidth, cells };
        container.scrollLeft = 0;
        return result;
    });
}

test('document table cells stay visible and scroll inside published articles and author preview at mobile breakpoints', async t => {
    const page = await pageFor(t);
    await setText(page, 'Δοκιμή πίνακα', '# Δεδομένα αγώνα\n\n| Οδηγός | Χρόνος | Πρώτος τομέας | Δεύτερος τομέας | Τρίτος τομέας | Ταχύτητα |\n| --- | --- | --- | --- | --- | --- |\n| Συνθετικός οδηγός | 1:23.456 | 27.123 | 31.234 | 25.099 | 320 km/h |');
    await step(page, 3);
    await page.waitForFunction(() => document.getElementById('gen-article-preview').contentDocument?.querySelector('.docx-table'));
    const frame = page.frames().find(frame => frame.url() === 'about:srcdoc');
    const published = await page.context().newPage();
    await published.goto(origin + '/blog-module/blog-entries/20250405G/article.html');
    for (const width of [390, 576, 577, 1440]) for (const theme of ['light', 'dark']) {
        // Test the iframe's viewport, not only the width of its parent editor.
        await page.locator('#gen-article-preview').evaluate((element, width) => { element.width = width; element.style.width = width + 'px'; }, width);
        await frame.waitForFunction(width => innerWidth === width, width);
        await published.setViewportSize({ width, height: 1000 });
        await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
        await frame.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
        await published.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
        for (const [name, target] of [['published', published], ['preview', frame]]) {
            const result = await renderedTable(target.locator('.docx-table').first());
            const label = `${name}/${width}/${theme}`;
            assert.equal(result.display, 'block', label);
            assert.ok(result.width > 0 && result.height > 0, label + ': rendered container');
            assert.ok(result.cells.length > 2 && result.cells.every(cell => cell.text && cell.visible && cell.width > 0 && cell.height > 0 && cell.fontSize >= 12), label + ': readable header and body cells');
            assert.equal(result.documentOverflow, false, label + ': contained overflow');
            if (width === 390) {
                assert.equal(result.overflowX, 'auto', label);
                assert.ok(result.scrollLeft > 0, label + ': wide table scrolls horizontally');
            }
        }
    }
});

test('CSV cards, desktop view switching and compact tables retain their behavior in articles and preview', async t => {
    const page = await pageFor(t);
    const fixtures = createResponsiveTableFromCSV('Οδηγός,Χρόνος\nΆλφα,1:20\nΒήτα,1:21\nΓάμμα,1:22', 'qa-full.csv')
        + createResponsiveTableFromCSV('Οδηγός,Χρόνος\nΆλφα,1:20', 'qa-compact.csv');
    const published = await page.context().newPage();
    await published.route('**/blog-entries/20250405G/article.html', route => {
        const html = fs.readFileSync(path.join(root, 'blog-module/blog-entries/20250405G/article.html'), 'utf8');
        return route.fulfill({ contentType: 'text/html', body: html.replace(/(<div class="rr-body article-content"[^>]*>)/, '$1' + fixtures) });
    });
    await published.goto(origin + '/blog-module/blog-entries/20250405G/article.html');
    await setText(page, 'Δοκιμή CSV', 'Συνθετικό κείμενο.'); await step(page, 3);
    await page.waitForFunction(() => document.getElementById('gen-article-preview').contentDocument?.querySelector('.rr-body'));
    const frame = page.frames().find(frame => frame.url() === 'about:srcdoc');
    // File-backed CSV is a documented preview limitation. Test the unchanged production-generated markup and preview's real toggle handler.
    await frame.locator('.rr-body').evaluate((body, html) => {
        const parsed = new DOMParser().parseFromString(html, 'text/html');
        body.append(...[...parsed.body.children].map(element => document.importNode(element, true)));
    }, fixtures);
    await page.evaluate(() => window.F1S_ARTICLE_PREVIEW.hydrate(document.getElementById('gen-article-preview').contentDocument));
    for (const width of [390, 576, 577, 1440]) for (const theme of ['light', 'dark']) {
        await page.locator('#gen-article-preview').evaluate((element, width) => { element.width = width; element.style.width = width + 'px'; }, width);
        await frame.waitForFunction(width => innerWidth === width, width);
        await published.setViewportSize({ width, height: 1000 });
        await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
        await frame.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
        await published.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
        for (const [name, target] of [['published', published], ['preview', frame]]) {
            const display = selector => target.locator(selector).evaluate(element => getComputedStyle(element).display);
            const label = `${name}/${width}/${theme}`;
            assert.equal(await display('#csv-table-qa-full-csv-scroll'), width <= 576 ? 'none' : 'block', label);
            assert.equal(await display('#csv-table-qa-full-csv-card'), width <= 576 ? 'block' : 'none', label);
            const compact = await renderedTable(target.locator('#csv-table-qa-compact-csv-scroll table'));
            assert.equal(compact.display, 'block', label);
            assert.ok(compact.width > 0 && compact.height > 0 && compact.cells.every(cell => cell.visible && cell.width > 0 && cell.height > 0), label);
            assert.equal(await display('#csv-table-qa-compact-csv-card'), 'none', label);
            if (width === 1440) for (const id of ['qa-full', 'qa-compact']) {
                await target.locator(`[data-table="csv-table-${id}-csv"][data-view="card"]`).click();
                assert.equal(await display(`#csv-table-${id}-csv-scroll`), 'none', label);
                assert.equal(await display(`#csv-table-${id}-csv-card`), 'block', label);
                await target.locator(`[data-table="csv-table-${id}-csv"][data-view="scroll"]`).click();
                assert.equal(await display(`#csv-table-${id}-csv-scroll`), 'block', label);
                assert.equal(await display(`#csv-table-${id}-csv-card`), 'none', label);
            }
        }
    }
});

test('old v1 records open empty without rewriting or dirtying an untouched editor', async t => {
    const page = await pageFor(t);
    assert.equal(await page.evaluate(() => window.F1S_DRAFT_MANAGER !== undefined), true);
    await step(page, 1); await page.locator('#research-toggle').click();
    assert.equal(await page.evaluate(() => window.F1S_RESEARCH_NOTEBOOK.snapshot()), null);
    assert.doesNotMatch(await page.locator('#gen-draft-status').textContent(), /Μη αποθηκευμένες/);
    const old = await page.evaluate(async () => {
        const record = await window.F1S_LOCAL_DRAFTS.save({ title: 'Παλαιό', text: 'Κείμενο', editor: { step: 1 } });
        delete record.research;
        await new Promise((resolve, reject) => { const request = indexedDB.open('f1stories-author-drafts', 1); request.onsuccess = () => {
            const db = request.result, tx = db.transaction('drafts', 'readwrite'); tx.objectStore('drafts').put(record);
            tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = reject;
        }; }); return record;
    });
    await page.locator('#gen-show-drafts').click(); await page.getByRole('button', { name: 'Άνοιγμα', exact: true }).click();
    await page.waitForFunction(() => document.getElementById('gen-draft-status').textContent.startsWith('Ανοιχτό'));
    assert.equal(await page.evaluate(() => window.F1S_RESEARCH_NOTEBOOK.snapshot()), null);
    assert.deepEqual(await page.evaluate(async id => window.F1S_LOCAL_DRAFTS.get(id), old.id), old);
    assert.doesNotMatch(await page.locator('#gen-draft-status').textContent(), /Μη αποθηκευμένες/);
});

test('corrupt research is unreadable and a corrupted previous record cannot be overwritten', async t => {
    const page = await pageFor(t);
    const id = await page.evaluate(async () => (await window.F1S_LOCAL_DRAFTS.save({ title: 'Αποθηκευμένο', text: 'Κείμενο', editor: { step: 4 } })).id);
    await page.locator('#gen-show-drafts').click(); await page.getByRole('button', { name: 'Άνοιγμα', exact: true }).click();
    await page.waitForFunction(() => document.getElementById('gen-draft-status').textContent.startsWith('Ανοιχτό'));
    const corrupted = await page.evaluate(async id => {
        const record = await window.F1S_LOCAL_DRAFTS.get(id); record.research = { version: 99, secret: 'synthetic' };
        await new Promise((resolve, reject) => { const request = indexedDB.open('f1stories-author-drafts', 1); request.onsuccess = () => {
            const db = request.result, tx = db.transaction('drafts', 'readwrite'); tx.objectStore('drafts').put(record);
            tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = reject;
        }; }); return record;
    }, id);
    await setText(page, 'Τρέχον', 'Δεν πρέπει να χαθεί'); await page.locator('#gen-save-draft').click();
    await page.waitForFunction(() => document.getElementById('gen-draft-status').textContent.includes('RESEARCH_INVALID'));
    const stored = await page.evaluate(async id => new Promise((resolve, reject) => { const request = indexedDB.open('f1stories-author-drafts', 1); request.onsuccess = () => {
        const db = request.result, tx = db.transaction('drafts'), get = tx.objectStore('drafts').get(id); get.onsuccess = () => { db.close(); resolve(get.result); }; get.onerror = reject;
    }; }), id);
    assert.deepEqual(stored, corrupted);
    assert.equal((await page.evaluate(async () => window.F1S_LOCAL_DRAFTS.list()))[0].corrupt, true);
    await page.locator('#gen-show-drafts').click();
    await page.waitForFunction(() => !document.getElementById('gen-drafts').hidden);
    assert.match(await page.locator('#gen-draft-list').textContent(), /Μη αναγνώσιμ/);
    assert.equal(await page.locator('#gen-draft-list').getByRole('button', { name: 'Άνοιγμα' }).isDisabled(), true);
    await page.locator('#gen-return-editor').click(); assert.equal(await page.locator('#gen-title').inputValue(), 'Τρέχον');
});

test('new, ZIP replacement and deleting an open draft isolate research', async t => {
    const page = await pageFor(t);
    await step(page, 1); await page.locator('#research-toggle').click(); await page.locator('#research-question').fill('Έρευνα μόνο');
    await page.locator('#gen-new-draft').click(); await page.getByRole('dialog').getByRole('button', { name: 'Συνέχεια χωρίς αποθήκευση' }).click();
    assert.equal(await page.evaluate(() => window.F1S_RESEARCH_NOTEBOOK.snapshot()), null);
    await step(page, 1); if (!(await page.locator('#research-notebook').isVisible())) await page.locator('#research-toggle').click();
    await page.locator('#research-question').fill('Έρευνα πριν ZIP');
    const archive = new JSZip(); archive.file('test/source.txt', '---\ntitle: Από ZIP\ncategory: Analysis\ntags: test\n---\n\nΚείμενο ZIP.');
    await step(page, 4); await page.locator('.gb-zip-utility summary').click();
    await page.locator('#gen-import-input').setInputFiles({ name: 'article.zip', mimeType: 'application/zip', buffer: await archive.generateAsync({ type: 'nodebuffer' }) });
    assert.match(await page.getByRole('dialog').textContent(), /έρευνα/);
    await page.getByRole('dialog').getByRole('button', { name: /Συνέχεια|OK/ }).click();
    await page.waitForFunction(() => document.getElementById('gen-title').value === 'Από ZIP');
    assert.equal(await page.evaluate(() => window.F1S_RESEARCH_NOTEBOOK.snapshot()), null);
    await step(page, 1); if (!(await page.locator('#research-notebook').isVisible())) await page.locator('#research-toggle').click();
    await page.locator('#research-question').fill('Έρευνα που μένει στη μνήμη');
    await step(page, 4); await page.locator('#gen-save-draft').click(); await saved(page);
    await page.locator('#gen-show-drafts').click(); await page.getByRole('button', { name: 'Διαγραφή: Από ZIP' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Διαγραφή', exact: true }).click();
    await page.waitForFunction(async () => (await window.F1S_LOCAL_DRAFTS.list()).length === 0);
    await page.locator('#gen-return-editor').click();
    assert.equal(await page.locator('#gen-title').inputValue(), 'Από ZIP');
    assert.equal(await page.evaluate(() => window.F1S_RESEARCH_NOTEBOOK.snapshot().question), 'Έρευνα που μένει στη μνήμη');
    await page.locator('#gen-new-draft').click(); assert.equal(await page.getByRole('dialog').isVisible(), true);
});

// Holds the ZIP read until the test releases it, so another action can run while an import is in flight.
async function holdZipRead(page) {
    await page.evaluate(async () => {
        await window.F1S_AUTHOR_DOM_TOOLS.loadJSZip();
        const load = JSZip.loadAsync.bind(JSZip);
        JSZip.loadAsync = async (...args) => { await new Promise(resolve => { window.__releaseZip = resolve; }); return load(...args); };
    });
}
async function startZipImport(page, files) {
    const archive = new JSZip(); for (const [name, text] of Object.entries(files)) archive.file(name, text);
    if (!(await page.locator('#gen-import-input').isVisible())) await page.locator('.gb-zip-utility summary').click();
    await page.locator('#gen-import-input').setInputFiles({ name: 'article.zip', mimeType: 'application/zip', buffer: await archive.generateAsync({ type: 'nodebuffer' }) });
    await page.getByRole('dialog').getByRole('button', { name: /Συνέχεια|OK/ }).click();
    await page.waitForFunction(() => Boolean(window.__releaseZip));
}

test('a save that finishes after a ZIP replaced the editor never rebinds or overwrites the previous draft', async t => {
    const page = await pageFor(t);
    await setText(page, 'Πρόχειρο Α', 'Κείμενο Α.');
    await step(page, 4); await page.locator('#gen-save-draft').click(); await saved(page);
    await holdZipRead(page);
    await page.evaluate(() => {
        const save = window.F1S_LOCAL_DRAFTS.save;
        let first = true;
        window.F1S_LOCAL_DRAFTS.save = async (...args) => {
            const result = await save(...args);
            if (first) { first = false; await new Promise(resolve => { window.__finishDraftSave = resolve; }); }
            return result;
        };
    });
    await startZipImport(page, { 'test/source.txt': '---\ntitle: Από ZIP\ncategory: Analysis\ntags: test\n---\n\nΚείμενο ZIP.' });
    await page.locator('#gen-save-draft').click(); await page.waitForFunction(() => Boolean(window.__finishDraftSave));
    await page.evaluate(() => window.__releaseZip());
    await page.waitForFunction(() => document.getElementById('gen-title').value === 'Από ZIP');
    await page.evaluate(() => window.__finishDraftSave());
    await page.waitForFunction(() => document.getElementById('gen-draft-status').textContent.includes('δεν έχει αποθηκευτεί'));
    await page.locator('#gen-save-draft').click(); await saved(page);
    const titles = await page.evaluate(async () => (await window.F1S_LOCAL_DRAFTS.list()).map(draft => draft.title).sort());
    assert.deepEqual(titles, ['Από ZIP', 'Πρόχειρο Α'].sort());
});

test('a ZIP import that fails after the author moved to another draft leaves that draft untouched', async t => {
    const page = await pageFor(t);
    await setText(page, 'Πρόχειρο Α', 'Κείμενο Α.');
    await step(page, 4); await page.locator('#gen-save-draft').click(); await saved(page);
    await holdZipRead(page);
    await startZipImport(page, { 'test/readme.txt': 'χωρίς source.txt' });
    await page.locator('#gen-new-draft').click();
    await page.waitForFunction(() => document.getElementById('gen-title').value === '');
    await page.evaluate(() => window.__releaseZip());
    await page.waitForTimeout(300);
    assert.equal(await page.getByRole('dialog').isVisible(), false);
    assert.equal(await page.locator('#gen-import-text').textContent(), 'Συνέχεια από ZIP');
    assert.equal(await page.locator('#gen-title').inputValue(), '');
});

test('v1 research opens clean without a write and the next explicit save writes v2', async t => {
    const page = await pageFor(t);
    const old = await page.evaluate(async () => {
        const record = await window.F1S_LOCAL_DRAFTS.save({ title: 'Παλαιό v1', text: 'Κείμενο', editor: { step: 1 } });
        record.research = { version: 1, question: 'Παλαιό α\u0301', anchor: '', season: '2026', round: '17', notes: [], form: { text: '', section: 'unverified', type: 'unverified', kind: 'general', verification: 'pending', sourceTitle: '', url: '', sourceDate: '', event: '', market: '', units: '', period: '', calculation: '', limitations: '' } };
        await new Promise((resolve, reject) => { const request = indexedDB.open('f1stories-author-drafts', 1); request.onsuccess = () => {
            const db = request.result, tx = db.transaction('drafts', 'readwrite'); tx.objectStore('drafts').put(record);
            tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = reject;
        }; }); return record;
    });
    await page.locator('#gen-show-drafts').click(); await page.getByRole('button', { name: 'Άνοιγμα', exact: true }).click();
    await page.waitForFunction(() => document.getElementById('gen-draft-status').textContent.startsWith('Ανοιχτό'));
    assert.equal(await page.evaluate(() => window.F1S_RESEARCH_NOTEBOOK.snapshot().version), 2);
    assert.doesNotMatch(await page.locator('#gen-draft-status').textContent(), /Μη αποθηκευμένες/);
    const raw = await page.evaluate(async id => new Promise((resolve, reject) => { const request = indexedDB.open('f1stories-author-drafts', 1); request.onsuccess = () => {
        const db = request.result, tx = db.transaction('drafts'), get = tx.objectStore('drafts').get(id); get.onsuccess = () => { db.close(); resolve(get.result); }; get.onerror = reject;
    }; }), old.id);
    assert.deepEqual(raw, old);
    await step(page, 4); await page.locator('#gen-save-draft').click(); await saved(page);
    const updated = await page.evaluate(async id => window.F1S_LOCAL_DRAFTS.get(id), old.id);
    assert.equal(updated.version, 1); assert.equal(updated.research.version, 2); assert.deepEqual(updated.research.claims, []);
});

test('pending decision edits dirty a saved draft and survive save and reopen without approval', async t => {
    const page = await pageFor(t);
    await step(page, 1); await page.locator('#research-toggle').click();
    await page.getByText('Ισχυρισμοί & τεκμήρια', { exact: true }).click();
    await page.getByRole('button', { name: 'Νέος ισχυρισμός' }).click();
    const card = page.locator('details[id^="research-claim-"]');
    await card.locator('[id$="-text"]').fill('Συνθετικός ισχυρισμός');
    await step(page, 4); await page.locator('#gen-save-draft').click(); await saved(page);
    await page.reload(); await page.locator('#gen-show-drafts').click(); await page.getByRole('button', { name: 'Άνοιγμα', exact: true }).click();
    await page.waitForFunction(() => document.getElementById('gen-draft-status').textContent.startsWith('Ανοιχτό'));
    await step(page, 1); await page.locator('#research-toggle').click();
    await page.evaluate(() => document.querySelectorAll('#research-notebook details').forEach(node => { node.open = true; }));
    await card.locator('[id$="-rationale"]').fill('Εκκρεμής αιτιολόγηση');
    await card.locator('[id$="-reviewer"]').fill('Συνθετικός συντάκτης');
    assert.match(await page.locator('#gen-draft-status').textContent(), /Μη αποθηκευμένες/);
    await step(page, 4); await page.locator('#gen-save-draft').click(); await saved(page);
    await page.reload(); await page.locator('#gen-show-drafts').click(); await page.getByRole('button', { name: 'Άνοιγμα', exact: true }).click();
    await page.waitForFunction(() => document.getElementById('gen-draft-status').textContent.startsWith('Ανοιχτό'));
    const claim = await page.evaluate(() => window.F1S_RESEARCH_NOTEBOOK.snapshot().claims[0]);
    assert.deepEqual(claim.pendingDecision, { rationale: 'Εκκρεμής αιτιολόγηση', reviewer: 'Συνθετικός συντάκτης' });
    assert.equal(claim.status, 'unreviewed'); assert.equal(claim.review, null);
    await step(page, 1); await page.locator('#research-toggle').click();
    assert.equal(await card.locator('[id$="-rationale"]').inputValue(), 'Εκκρεμής αιτιολόγηση');
    assert.equal(await card.locator('[id$="-reviewer"]').inputValue(), 'Συνθετικός συντάκτης');
});
