// Housekeeping edits keep a published article's folder, and with it its URL, date and author
// (docs/search/article-url-policy.md). Drives housekeeping.html against a mocked GitHub API.
import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { Launcher } from 'chrome-launcher';
import JSZip from 'jszip';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const ENTRIES = 'blog-module/blog-entries';
const LOCK = 'Η ημερομηνία και ο συντάκτης καθορίζουν τη μόνιμη διεύθυνση του δημοσιευμένου άρθρου. Για αλλαγή τους απαιτείται ξεχωριστή διαδικασία.';
// Standard, -N suffix, Greek capital Tau (a real folder), two-letter code and code-less ids.
const POSTS = [
    ['20260416G', 'Georgios Balatzis', '2026-04-16'],
    ['20260416-2T', 'Thanasis Batalas', '2026-04-16'],
    ['20260227Τ', 'F1 Stories Team', '2026-02-27'],
    ['20250514-2GF', 'F1 Stories Team', '2025-05-14'],
    ['20260722', 'F1 Stories Team', '2026-07-22']
].map(([id, author, date]) => ({ id, author, date, dateISO: date, title: `Άρθρο ${id}`, category: 'News', categories: ['News'], tags: ['Ferrari F1'], hasSource: true }));
const FILES = ['source.txt', 'article.html', '1.webp', '1-card.webp', '2.webp', '3.webp'];
const source = id => `---\ncategory: News\ntags: Ferrari F1\ntitle: Άρθρο ${id}\nlegacy-note: μένει\n---\n\nΑρχικό κείμενο.\n`;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

let browser, server, origin;
before(async () => {
    server = http.createServer((request, response) => {
        let file = path.resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
        if (file.includes('/scripts/author/') || !fs.existsSync(file)) file = file.replace(/\.min\.(js|css)$/, '.$1');
        if (!file.startsWith(root + '/') || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404).end(); return; }
        const type = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }[path.extname(file)] || 'application/octet-stream';
        response.writeHead(200, { 'Content-Type': type }); fs.createReadStream(file).pipe(response);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch({ executablePath: Launcher.getInstallations()[0], headless: true });
});
after(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });

async function pageFor(t) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    t.after(() => context.close());
    const calls = [], blobs = new Map();
    await context.addInitScript(() => sessionStorage.setItem('f1stories-housekeeping-list-state-v1', JSON.stringify({ lane: 'all' })));
    await context.route('**/*', async route => {
        const request = route.request(), url = request.url();
        if (url === origin + '/blog-module/blog-index-data.json') return route.fulfill({ json: { posts: POSTS } });
        if (!url.startsWith('https://api.github.com/')) return url.startsWith(origin) || url.startsWith('blob:') ? route.continue() : route.abort();
        const suffix = decodeURIComponent(new URL(url).pathname.replace('/repos/georgiosbalatzis/f1StoriesPage', ''));
        const method = request.method(), body = request.postDataJSON();
        calls.push({ suffix, method, body });
        const listing = suffix.match(/^\/contents\/blog-module\/blog-entries\/([^/]+)$/);
        if (listing) return route.fulfill({ json: FILES.map(name => ({ type: 'file', name, sha: `${listing[1]}/${name}` })) });
        const text = suffix.match(/^\/contents\/blog-module\/blog-entries\/([^/]+)\/source\.txt$/);
        if (text) return route.fulfill({ json: { encoding: 'base64', content: Buffer.from(source(text[1])).toString('base64') } });
        if (suffix.startsWith('/pulls') && method === 'GET') return route.fulfill({ json: [] });
        if (suffix === '/git/ref/heads/main') return route.fulfill({ json: { object: { sha: 'base-sha' } } });
        if (suffix === '/git/commits/base-sha') return route.fulfill({ json: { tree: { sha: 'tree-sha' } } });
        if (suffix === '/pulls') return route.fulfill({ json: { number: 7, html_url: 'https://github.com/example/dummy/pull/7' } });
        if (suffix === '/git/blobs') { const sha = `blob-${blobs.size}`; blobs.set(sha, Buffer.from(body.content, 'base64')); return route.fulfill({ json: { sha } }); }
        return route.fulfill({ json: { sha: 'mock-sha' } });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(7000);
    await page.goto(origin + '/housekeeping.html');
    await page.locator('.hk-item-row').first().waitFor();
    return { page, calls, blobs, token: false };
}

const dialog = page => page.locator('.f1s-author-dialog');
async function openEditor(session, post) {
    const { page } = session;
    await page.locator('.hk-item-row', { hasText: post.title }).getByRole('button', { name: 'Πλήρης επεξεργασία' }).click();
    if (!session.token) {
        await dialog(page).locator('input').fill('dummy-token-only-for-tests');
        await dialog(page).getByRole('button', { name: 'OK', exact: true }).click();
        session.token = true;
    }
    await page.waitForFunction(folder => document.getElementById('hk-edit-folder').textContent === folder
        && document.getElementById('hk-edit-status').textContent === '' && document.querySelector('#hk-edit-images .hk-slot'), `${ENTRIES}/${post.id}`);
}
async function save(page) {
    await page.locator('#hk-edit-save').click();
    await dialog(page).getByRole('button', { name: 'Άνοιγμα PR', exact: true }).click();
    await dialog(page).filter({ hasText: 'Pull Request ανοιχτό' }).getByRole('button', { name: 'OK', exact: true }).click();
}
const writes = calls => calls.filter(call => call.method !== 'GET');

test('open PR lane lists author and review branches across pages without writes', async t => {
    const { page, calls } = await pageFor(t), requests = [];
    const pr = (number, ref, title, base = 'main') => ({ number, title, head: { ref }, base: { ref: base },
        user: { login: 'synthetic-editor' }, html_url: `https://github.com/example/dummy/pull/${number}`, draft: false });
    const author = pr(1, 'author/blog/20261029g-20261029120000-abcd', 'Author PR');
    const review = { ...pr(2, 'editorial/review/20261029-2Τ-20261029120000-efgh', 'Review PR'), syntheticReview: 'CHANGES_REQUESTED' };
    const draft = { ...pr(3, 'editorial/review/20261030G-20261030120000-ijkl', 'Draft review'), draft: true };
    await page.route('https://api.github.com/**', async route => {
        const request = route.request(), url = new URL(request.url());
        requests.push({ method: request.method(), page: url.searchParams.get('page') || '1', path: url.pathname });
        if (request.method() !== 'GET' || !url.pathname.endsWith('/pulls')) return route.abort();
        const data = url.searchParams.get('page') === '2' ? [review, draft, pr(4, 'editorial/review/bad-ref', 'Malformed'), pr(5, review.head.ref, 'Wrong base', 'other')] :
            [author, ...Array.from({ length: 49 }, (_, i) => pr(100 + i, `feature/${i}`, 'Other'))];
        await route.fulfill({ json: data });
    });
    await page.locator('#hk-lane-list').getByRole('button', { name: /Ανοιχτά PR συντακτών/ }).click();
    await page.getByRole('button', { name: 'Ορισμός token' }).click();
    await dialog(page).locator('input').fill('dummy-token-only-for-tests');
    await dialog(page).getByRole('button', { name: 'OK', exact: true }).click();
    const items = page.locator('#hk-list .hk-item-pr');
    await items.nth(2).waitFor();
    assert.equal(await items.count(), 3);
    assert.match(await items.nth(0).innerText(), /Author PR/);
    assert.doesNotMatch(await items.nth(0).innerText(), /Αναμένει ανθρώπινο έλεγχο/);
    assert.match(await items.nth(1).innerText(), /Review PR[\s\S]*20261029-2Τ[\s\S]*Αναμένει ανθρώπινο έλεγχο[\s\S]*CI δεν αποτελεί έγκριση/);
    assert.equal(await items.nth(1).getByRole('link', { name: 'Άνοιγμα στο GitHub' }).getAttribute('href'), review.html_url);
    assert.match(await items.nth(2).innerText(), /πρόχειρο[\s\S]*Draft review/);
    assert.deepEqual(requests.map(call => call.page), ['1', '2']);
    await page.getByRole('button', { name: 'Ανανέωση λίστας PR' }).click();
    await page.waitForFunction(() => document.querySelectorAll('#hk-list .hk-item-pr').length === 3);
    assert.deepEqual(requests.map(call => call.page), ['1', '2', '1', '2']);
    assert.ok(requests.every(call => call.method === 'GET'));
    assert.equal(writes(calls).length, 0);
    assert.equal(await items.getByRole('button').count(), 0);
});
// The single edit PR the last save opened: its tree, decoded uploads, commit and PR request.
function pullRequest({ calls, blobs }) {
    const trees = calls.filter(call => call.suffix === '/git/trees');
    const tree = trees.at(-1).body.tree;
    return {
        tree,
        deleted: tree.filter(entry => entry.sha === null).map(entry => entry.path).sort(),
        written: Object.fromEntries(tree.filter(entry => entry.sha).map(entry => [entry.path, blobs.get(entry.sha)])),
        commit: calls.filter(call => call.suffix === '/git/commits' && call.method === 'POST').at(-1).body.message,
        branch: calls.filter(call => call.suffix === '/git/refs').at(-1).body.ref,
        pr: calls.filter(call => call.suffix === '/pulls' && call.method === 'POST').at(-1).body
    };
}

test('date and author are read-only and explained; title, body and image edits keep every kind of folder id', async t => {
    const session = await pageFor(t);
    const { page } = session;
    const edits = {
        '20260416G': async () => page.locator('#hk-edit-title-input').fill('Νέος τίτλος'),
        '20260416-2T': async () => page.locator('#hk-edit-body').fill('Νέο κείμενο.'),
        '20260227Τ': async () => page.locator('#hk-edit-title-input').fill('Νέος τίτλος'),
        '20250514-2GF': async () => {
            await page.locator('#hk-edit-hero-input').setInputFiles({ name: 'hero.png', mimeType: 'image/png', buffer: PNG });
            await page.locator('#hk-edit-content-input').setInputFiles({ name: 'extra.png', mimeType: 'image/png', buffer: PNG });
        },
        '20260722': async () => {
            await page.locator('.hk-slot', { hasText: 'Εικόνα κειμένου (3)' }).getByRole('button', { name: 'Αφαίρεση' }).click();
        }
    };
    for (const post of POSTS) {
        await openEditor(session, post);
        for (const [selector, value] of [['#hk-edit-author', post.author], ['#hk-edit-date', post.date]]) {
            const field = page.locator(selector);
            assert.equal(await field.inputValue(), value, `${post.id} ${selector}`);
            assert.ok(await field.isDisabled(), `${post.id} ${selector} is read-only`);
            assert.equal(await field.getAttribute('aria-describedby'), 'hk-edit-identity-note');
        }
        assert.equal(await page.locator('#hk-edit-identity-note').innerText(), LOCK);
        assert.ok(await page.locator('#hk-edit-identity-note').isVisible());
        await edits[post.id]();
        await save(page);

        const { tree, deleted, written, commit, branch, pr } = pullRequest(session);
        const folder = `${ENTRIES}/${post.id}/`;
        for (const entry of tree) assert.ok(entry.path.startsWith(folder), `${post.id}: ${entry.path} stays in the published folder`);
        assert.ok(!deleted.some(file => /\/(?:source\.txt|article\.html)$/.test(file)), `${post.id}: source and page are kept`);
        const text = written[folder + 'source.txt'].toString('utf8');
        assert.match(text, /^legacy-note: μένει$/m, `${post.id}: other source metadata is kept`);
        assert.equal(commit, `edit(blog): ${text.match(/^title: (.*)$/m)[1]} (${post.id})`);
        assert.match(branch, /^refs\/heads\/author\/edit\//);
        assert.equal(pr.head, branch.replace('refs/heads/', ''));
        assert.equal(pr.base, 'main');
        assert.equal(pr.body, `Author tool edit for \`${ENTRIES}/${post.id}\`.`);

        if (post.id === '20260416G' || post.id === '20260227Τ') {
            assert.match(text, /^title: Νέος τίτλος$/m);
            assert.deepEqual(Object.keys(written), [folder + 'source.txt']);
            assert.deepEqual(deleted, []);
        }
        if (post.id === '20260416-2T') assert.match(text, /\n\nΝέο κείμενο\.\n$/);
        if (post.id === '20250514-2GF') {
            assert.deepEqual(deleted, [folder + '1-card.webp', folder + '1.webp']);
            assert.deepEqual(Object.keys(written).sort(), [folder + '1.webp', folder + '4.webp', folder + 'source.txt']);
            assert.equal(written[folder + '1.webp'].subarray(8, 12).toString('latin1'), 'WEBP');
        }
        if (post.id === '20260722') assert.deepEqual(deleted, [folder + '3.webp']);
    }
    assert.equal(writes(session.calls).filter(call => call.suffix === '/pulls').length, POSTS.length);
});

test('a changed author or date is refused at save even when the page was altered to allow it', async t => {
    const session = await pageFor(t);
    const { page } = session;
    const post = POSTS[0];
    await openEditor(session, post);
    await page.locator('#hk-edit-title-input').fill('Νέος τίτλος');
    const before = writes(session.calls).length;
    for (const [selector, value] of [['#hk-edit-author', 'Thanasis Batalas'], ['#hk-edit-date', '2026-04-20']]) {
        await page.evaluate(({ selector, value }) => {
            const field = document.querySelector(selector);
            field.disabled = false;
            field.value = value;
            field.dispatchEvent(new Event('change', { bubbles: true }));
        }, { selector, value });
        await page.locator('#hk-edit-save').click();
        await dialog(page).filter({ hasText: LOCK }).getByRole('button', { name: 'OK', exact: true }).click();
        assert.equal(writes(session.calls).length, before, `${selector}: nothing uploaded, no branch, no PR`);
        await page.evaluate(({ selector, value }) => { document.querySelector(selector).value = value; },
            { selector, value: selector === '#hk-edit-author' ? post.author : post.date });
    }
    // Restored values save normally, into the same folder.
    await save(page);
    const { tree } = pullRequest(session);
    assert.deepEqual(tree.map(entry => entry.path), [`${ENTRIES}/${post.id}/source.txt`]);
});


test('a review reservation on a later page blocks housekeeping edits before writes', async t => {
    const session = await pageFor(t), { page, calls } = session;
    await openEditor(session, POSTS[0]);
    const pages = [];
    await page.route('https://api.github.com/**', async route => {
        const request = route.request(), url = new URL(request.url());
        if (request.method() !== 'GET' || !url.pathname.endsWith('/pulls')) return route.abort();
        const number = url.searchParams.get('page') || '1'; pages.push(number);
        await route.fulfill({ json: number === '1' ? Array.from({ length: 50 }, () => ({ head: { ref: 'feature/other' } })) : [
            { base: { ref: 'main' }, head: { ref: 'editorial/review/20260416G-20261029120000-abcd' } }
        ] });
    });
    await page.locator('#hk-edit-title-input').fill('Νέος τίτλος');
    await page.locator('#hk-edit-save').click();
    await dialog(page).getByRole('button', { name: 'Άνοιγμα PR', exact: true }).click();
    await page.waitForFunction(() => document.getElementById('hk-edit-status').textContent.includes('αναμένει ήδη συντακτικό έλεγχο'));
    assert.deepEqual(pages, ['1', '2']);
    assert.equal(writes(calls).length, 0);
});


test('ZIP replacement refuses a folder awaiting editorial review', async t => {
    const session = await pageFor(t), { page, calls } = session;
    const archive = new JSZip();
    archive.file(POSTS[0].id + '/source.txt', source(POSTS[0].id));
    await page.route('https://api.github.com/**', async route => {
        const request = route.request(), url = new URL(request.url());
        if (request.method() === 'GET' && url.pathname.endsWith('/pulls')) return route.fulfill({ json: [
            { base: { ref: 'main' }, head: { ref: 'editorial/review/20260416G-20261029120000-abcd' } }
        ] });
        return route.fallback();
    });
    await page.locator('#hk-import-input').setInputFiles({ name: 'article.zip', mimeType: 'application/zip', buffer: await archive.generateAsync({ type: 'nodebuffer' }) });
    await dialog(page).locator('input').fill('dummy-token-only-for-tests');
    await dialog(page).getByRole('button', { name: 'OK', exact: true }).click();
    await dialog(page).locator('input[value="replace"]').check();
    await dialog(page).getByRole('button', { name: 'Συνέχεια', exact: true }).click();
    await dialog(page).getByRole('button', { name: 'Αντικατάσταση', exact: true }).click();
    await dialog(page).getByRole('button', { name: 'Άνοιγμα PR', exact: true }).click();
    assert.match(await dialog(page).innerText(), /αναμένει ήδη συντακτικό έλεγχο/);
    assert.equal(writes(calls).length, 0);
});
