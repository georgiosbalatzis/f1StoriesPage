import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { Launcher } from 'chrome-launcher';
import { startResearchServer } from '../server.mjs';
import { demoDossier, examples } from '../fixtures.mjs';

let browser, server, origin;
before(async () => {
    server = await startResearchServer({ port: 0, env: {}, provider: () => { throw new Error('Paid calls forbidden in browser tests'); } });
    origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || Launcher.getInstallations()[0], headless: true });
});
after(async () => { await browser?.close(); if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); });
async function pageFor(t, width = 1440, theme = 'dark') {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
    t.after(() => context.close());
    const page = await context.newPage(); page.setDefaultTimeout(8000);
    const external = [], calls = [], errors = [];
    await context.route('**/*', route => {
        const url = route.request().url();
        if (new URL(url).origin === origin || url.startsWith('blob:')) return route.continue();
        external.push(url); return route.abort();
    });
    page.on('request', request => calls.push({ url: request.url(), data: request.postData() }));
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin); await page.waitForFunction(() => !document.querySelector('#start').disabled);
    if (theme === 'light') await page.locator('#theme').click();
    return { page, context, external, calls, errors };
}
async function investigate(page, id = 'technical') {
    await page.locator('#example').selectOption(id); await page.locator('#start').click();
    await page.waitForFunction(() => !document.querySelector('#copy').disabled);
}

for (const width of [1440, 390]) for (const theme of ['dark', 'light']) {
    test(`DEMO research, citations and layout at ${width}px / ${theme}`, async t => {
        const { page, external, calls, errors } = await pageFor(t, width, theme);
        assert.equal(await page.locator('#mode').inputValue(), 'DEMO');
        assert.equal(await page.locator('#mode option[value=LIVE]').isDisabled(), true);
        assert.match(await page.locator('#availability').textContent(), /λείπει OPENAI_API_KEY/);
        await investigate(page);
        await page.evaluate(() => document.fonts.ready);
        assert.match(await page.locator('#result').textContent(), /DEMO — Δεν πραγματοποιήθηκε ζωντανή έρευνα/);
        assert.ok(await page.locator('.citations a').count() >= 2);
        assert.equal(await page.locator('.dossier-section').count(), 11);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        const contrast = await page.evaluate(() => {
            const root = getComputedStyle(document.documentElement);
            const luminance = prop => {
                const hex = root.getPropertyValue(prop).trim().slice(1);
                const rgb = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
                return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
            };
            return ['--ink', '--muted', '--accent'].map(prop => { const a = luminance(prop), b = luminance('--base'); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); });
        });
        assert.ok(contrast.every(n => n >= 4.5), contrast.join(', '));
        await page.locator('summary').filter({ hasText: 'Περιορισμοί έρευνας' }).click();
        assert.equal(await page.locator('details').filter({ hasText: 'Περιορισμοί έρευνας' }).last().getAttribute('open'), '');
        await page.locator('summary').filter({ hasText: 'Περιορισμοί έρευνας' }).click();
        await mkdir(new URL('../evidence/', import.meta.url), { recursive: true });
        await page.screenshot({ path: new URL(`../evidence/demo-${width}-${theme}.png`, import.meta.url).pathname, fullPage: true });
        assert.deepEqual(external, []); assert.deepEqual(errors, []);
        assert.ok(calls.every(c => !/github|draft|publish|blog-index/.test(c.url)));
        const posts = calls.filter(c => c.data); assert.equal(posts.length, 1);
        assert.deepEqual(Object.keys(JSON.parse(posts[0].data)).sort(), ['activateLive', 'category', 'grandPrix', 'mode', 'question', 'season', 'session']);
    });
}

test('complete Greek UTF-8 download and clipboard match; internal search is explicit and separate', async t => {
    const { page, calls } = await pageFor(t);
    await investigate(page, 'history');
    assert.match(await page.locator('#result').textContent(), /13 λεπτά/);
    assert.equal(calls.some(c => c.url.includes('/api/internal')), false);
    const downloadPromise = page.waitForEvent('download'); await page.locator('#download').click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), 'brief.txt');
    const text = await readFile(await download.path(), 'utf8');
    assert.ok(text.includes(examples[2].question)); assert.match(text, /Μητρώο πηγών/); assert.match(text, /Δημοσίευση: άγνωστη/);
    await page.locator('#copy').click();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), text);
    await page.locator('.internal summary').click(); await page.locator('#lookupQuery').fill('BetCast'); await page.locator('#lookup button').click();
    await page.waitForFunction(() => document.querySelector('#internalResults a'));
    assert.ok(await page.locator('#internalResults a').count() <= 8);
    assert.equal(calls.filter(c => c.url.includes('/api/research')).length, 1);
});

test('research leaves local/session storage, IndexedDB drafts and article state unchanged', async t => {
    const { page, external } = await pageFor(t);
    await page.evaluate(async () => {
        localStorage.setItem('article-state', JSON.stringify({ title: 'Unpublished sentinel', published: false }));
        sessionStorage.setItem('f1stories-gh-token', 'not-a-real-github-token');
        await new Promise((resolve, reject) => {
            const open = indexedDB.open('draft-sentinel', 1); open.onupgradeneeded = () => open.result.createObjectStore('drafts'); open.onerror = reject;
            open.onsuccess = () => { const db = open.result, tx = db.transaction('drafts', 'readwrite'); tx.objectStore('drafts').put({ text: 'private draft sentinel' }, '1'); tx.oncomplete = () => { db.close(); resolve(); }; };
        });
    });
    const state = () => page.evaluate(async () => ({ local: JSON.stringify(localStorage), session: JSON.stringify(sessionStorage), databases: await indexedDB.databases(), draft: await new Promise(resolve => { const open = indexedDB.open('draft-sentinel'); open.onsuccess = () => { const db = open.result, get = db.transaction('drafts').objectStore('drafts').get('1'); get.onsuccess = () => { resolve(get.result); db.close(); }; }; }) }));
    const initial = await state(); await investigate(page); assert.deepEqual(await state(), initial); assert.deepEqual(external, []);
});

test('script injection stays inert in scope, claims and source titles', async t => {
    const { page } = await pageFor(t);
    const injection = '<img src=x onerror="window.pwned=true"><script>window.pwned=true</script>';
    await page.locator('#question').fill(injection); await page.locator('#start').click();
    await page.waitForFunction(() => !document.querySelector('#copy').disabled);
    assert.ok((await page.locator('.scope').textContent()).includes(injection));
    await page.route(origin + '/api/research', async route => {
        const data = await (await route.fetch()).json(); data.dossier.facts[0].text = injection; data.dossier.sources[0].title = injection;
        await route.fulfill({ json: data });
    });
    await investigate(page);
    assert.equal(await page.locator('#result img, #result script').count(), 0);
    assert.equal(await page.evaluate(() => window.pwned), undefined);
});

test('loading, cancel, timeout and provider error states are actionable and discard stale results', async t => {
    const { page } = await pageFor(t);
    let release; const held = new Promise(resolve => { release = resolve; });
    await page.route(origin + '/api/research', async route => { await held; await route.abort().catch(() => {}); });
    await page.locator('#example').selectOption('technical'); await page.locator('#start').click();
    assert.equal(await page.locator('#start').isDisabled(), true); assert.equal(await page.locator('#cancel').isEnabled(), true);
    await page.locator('#cancel').click(); await page.waitForFunction(() => document.querySelector('#status').textContent.includes('ακυρώθηκε'));
    assert.equal(await page.locator('#copy').isDisabled(), true); release(); await page.unroute(origin + '/api/research');
    for (const [code, error] of [[504, 'Η έρευνα υπερέβη το χρονικό όριο.'], [502, 'Σφάλμα παρόχου. Δεν έγινε αυτόματη επανάληψη.']]) {
        await page.route(origin + '/api/research', route => route.fulfill({ status: code, json: { error } }));
        await page.locator('#start').click(); await page.waitForFunction(e => document.querySelector('#status').textContent === e, error);
        assert.equal(await page.locator('#download').isDisabled(), true); await page.unroute(origin + '/api/research');
    }
});

test('LIVE browser activation is required per request and never retained', async t => {
    let calls = 0;
    const fake = await startResearchServer({ port: 0, env: { F1S_RESEARCH_MODE: 'LIVE', OPENAI_API_KEY: 'test-only' }, provider: async input => { calls++; return demoDossier(input); } });
    t.after(() => new Promise(resolve => { fake.close(resolve); fake.closeAllConnections(); }));
    const context = await browser.newContext(); t.after(() => context.close()); const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${fake.address().port}`); await page.waitForFunction(() => !document.querySelector('#start').disabled);
    await page.locator('#example').selectOption('technical'); await page.locator('#mode').selectOption('LIVE');
    await page.locator('#start').click(); assert.equal(calls, 0);
    await page.locator('#activateLive').check(); await page.locator('#start').click(); await page.waitForFunction(() => !document.querySelector('#copy').disabled);
    assert.equal(calls, 1); assert.equal(await page.locator('#activateLive').isChecked(), false);
    await page.locator('#start').click(); assert.equal(calls, 1);
});
