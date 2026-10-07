#!/usr/bin/env node
// embed-dialog-qa.mjs - behaviour and layout check for the standings "Ενσωμάτωση" dialog (standings/standings.js).
//
// Serves the working tree (or --root=dist), blocks every request that leaves the local origin (the page falls
// back to its committed snapshots), and drives it in Chrome. Asserts:
//   open       every embed button opens the modal with its own panel preselected and focus on that radio
//   code       the code names the chosen panel, ends in embed=1, and its src is exactly what the preview loads
//   copy       the button copies the textarea to the real clipboard, says so, and the confirmation clears itself
//   preview    the preview is the real embed page (embed mode, no audio player), sized by its own height report,
//              and ignores a resize message that does not come from the preview frame
//   close      Esc, the close button and the backdrop close it, focus returns to the button, the preview stops
//   layout     inside the viewport, no sideways scroll, 44px controls and readable contrast at 1280/768/430/390/375
//   safety     link-share buttons are unchanged, and an ?embed=1 page never builds the dialog
//
//   npm run qa:embed-dialog            flags: --root=dist  --json

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { Launcher } = require('chrome-launcher');

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const rootArg = process.argv.find(arg => arg.startsWith('--root='));
const ROOT = rootArg ? path.resolve(REPO_ROOT, rootArg.slice(7)) : REPO_ROOT;
const WIDTHS = [1280, 768, 430, 390, 375];
const MIME = new Map([['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'], ['.mjs', 'text/javascript; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'], ['.webp', 'image/webp'], ['.png', 'image/png'], ['.avif', 'image/avif'], ['.svg', 'image/svg+xml; charset=utf-8'],
    ['.woff2', 'font/woff2'], ['.map', 'application/json']]);

const failures = [];
let passed = 0;
function check(name, ok, detail = '') {
    if (ok) passed += 1;
    else failures.push(`${name}${detail ? ` (${detail})` : ''}`);
}

function startServer() {
    const server = http.createServer((req, res) => {
        let pathname = decodeURIComponent(new URL(req.url || '/', 'http://127.0.0.1').pathname);
        if (pathname.endsWith('/')) pathname += 'index.html';
        const abs = path.resolve(ROOT, `.${pathname}`);
        if (!abs.startsWith(ROOT) || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) { res.writeHead(404).end('not found'); return; }
        res.writeHead(200, { 'content-type': MIME.get(path.extname(abs)) || 'application/octet-stream', 'cache-control': 'no-store' });
        fs.createReadStream(abs).pipe(res);
    });
    return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` })));
}

const luminance = ([r, g, b]) => [r, g, b].map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; })
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const rgb = css => (css.match(/[\d.]+/g) || []).slice(0, 3).map(Number);

async function open(browser, origin, { theme = 'light', width = 1280, height = 900, search = '' } = {}) {
    const context = await browser.newContext({ viewport: { width, height }, permissions: ['clipboard-read', 'clipboard-write'] });
    await context.addInitScript(t => { try { localStorage.setItem('f1stories-theme', t); } catch (_) {} }, theme);
    // Only the local site: live data providers, analytics and the like are blocked, so the run needs no network.
    await context.route(url => new URL(url).origin !== origin, route => route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/standings/${search}`, { waitUntil: 'load' });
    await page.waitForSelector('#embed-dialog', { state: 'attached' });
    await page.waitForTimeout(600);
    return { context, page, errors };
}

const dialogOpen = page => page.evaluate(() => document.getElementById('embed-dialog').open);
const unescape = html => html.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

async function behaviourChecks(browser, origin) {
    const { context, page, errors } = await open(browser, origin);
    const targets = await page.evaluate(() => [...document.querySelectorAll('[data-share-kind="embed"][data-share-target]')].map(b => b.getAttribute('data-share-target')));
    const panels = await page.evaluate(() => [...document.querySelectorAll('#embed-panels input')].map(i => i.value));
    check('there is an embed button on every report panel', targets.length >= 9, `found ${targets.length}`);
    check('the panel list is the share-target list, each panel once', panels.length === 13 && new Set(panels).size === 13, String(panels.length));
    check('every embed button maps to a listed panel', targets.every(target => panels.includes(target)), targets.filter(t => !panels.includes(t)).join(','));

    for (const target of targets) {
        // A report's buttons are hidden until its tab is selected, as for a reader.
        const tab = await page.evaluate(id => document.querySelector(`[data-share-kind="embed"][data-share-target="${id}"]`).closest('.standings-panel').id.replace(/^panel-/, ''), target);
        await page.click(`.standings-tab[data-tab="${tab}"]`);
        await page.waitForTimeout(200);
        const button = page.locator(`[data-share-kind="embed"][data-share-target="${target}"]`).first();
        await button.scrollIntoViewIfNeeded();
        await button.click();
        await page.waitForTimeout(250);
        const s = await page.evaluate(() => ({
            open: document.getElementById('embed-dialog').open,
            modal: document.getElementById('embed-dialog').matches(':modal'),
            checked: document.querySelector('#embed-panels input:checked')?.value,
            focus: document.activeElement && document.activeElement.value,
            code: document.getElementById('embed-code').value,
            src: document.getElementById('embed-preview').getAttribute('src'),
            labelled: document.getElementById('embed-dialog').getAttribute('aria-labelledby'),
            title: document.getElementById('embed-title').textContent
        }));
        check(`${target}: opens as a modal with its own panel selected`, s.open && s.modal && s.checked === target, JSON.stringify({ open: s.open, checked: s.checked }));
        check(`${target}: focus starts on the selected panel`, s.focus === target, String(s.focus));
        const srcInCode = unescape((/ src="([^"]*)"/.exec(s.code) || [])[1] || '');
        check(`${target}: code names the panel and is an embed`, srcInCode.includes(`focus=${target}`) && srcInCode.includes('embed=1') && /^<iframe /.test(s.code) && /<\/iframe>$/.test(s.code), srcInCode);
        check(`${target}: the preview loads exactly the code's src`, s.src === srcInCode, `${s.src} vs ${srcInCode}`);
        check(`${target}: the dialog is labelled`, s.labelled === 'embed-title' && s.title.length > 0);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(150);
    }

    // One panel in depth.
    await page.click('.standings-tab[data-tab="drivers"]');
    await page.waitForTimeout(200);
    const button = page.locator('[data-share-kind="embed"][data-share-target="drivers-chart"]').first();
    await button.scrollIntoViewIfNeeded();
    await button.click();
    await page.waitForFunction(() => { const f = document.getElementById('embed-preview'); return f.contentDocument && f.contentDocument.body && f.contentDocument.body.classList.contains('standings-embed'); }, null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const frame = await page.evaluate(() => {
        const f = document.getElementById('embed-preview');
        const d = f.contentDocument;
        return {
            embedMode: !!(d && d.body && d.body.classList.contains('standings-embed')),
            player: d ? d.querySelectorAll('.nav-audio').length : -1,
            nestedPanels: d ? d.querySelectorAll('#embed-panels input').length : -1,
            height: parseFloat(f.style.height),
            content: d && d.body ? Math.ceil(d.body.getBoundingClientRect().height) : 0
        };
    });
    check('the preview is the real embed page', frame.embedMode);
    check('the preview hosts no audio player', frame.player === 0, String(frame.player));
    check('the embed page does not build a dialog of its own', frame.nestedPanels === 0, String(frame.nestedPanels));
    check('the preview is sized from its own height report', Math.abs(frame.height - frame.content) <= 4 && frame.height >= 160, `${frame.height} vs ${frame.content}`);

    const before = await page.evaluate(() => document.getElementById('embed-preview').style.height);
    await page.evaluate(() => window.postMessage({ type: 'f1s-standings:resize', height: 777 }, '*'));
    await page.waitForTimeout(200);
    check('a resize message from anywhere but the preview is ignored', await page.evaluate(() => document.getElementById('embed-preview').style.height) === before);

    // Copy.
    await page.click('#embed-copy');
    await page.waitForTimeout(300);
    const copied = await page.evaluate(async () => ({
        clipboard: await navigator.clipboard.readText(),
        code: document.getElementById('embed-code').value,
        status: document.getElementById('embed-status').textContent,
        marked: document.getElementById('embed-copy').classList.contains('is-copied')
    }));
    check('copy puts the shown code on the real clipboard', copied.clipboard === copied.code && copied.clipboard.startsWith('<iframe'));
    check('copy says so and marks the button', copied.status.startsWith('Αντιγράφηκε') && copied.marked, copied.status);
    await page.waitForTimeout(2100);
    check('the confirmation clears itself on the button', !(await page.evaluate(() => document.getElementById('embed-copy').classList.contains('is-copied'))));

    // Switching panel rewrites both the code and the preview.
    await page.check('#embed-panels input[value="panel-quali-gaps"]');
    await page.waitForTimeout(500);
    const switched = await page.evaluate(() => ({ code: document.getElementById('embed-code').value, src: document.getElementById('embed-preview').getAttribute('src'), status: document.getElementById('embed-status').textContent }));
    check('choosing another panel rewrites the code and the preview', switched.code.includes('panel-quali-gaps') && switched.src.includes('panel-quali-gaps'), switched.src);
    check('choosing another panel clears the old confirmation', switched.status === '');

    // Closing.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    let after = await page.evaluate(() => ({ open: document.getElementById('embed-dialog').open, src: document.getElementById('embed-preview').getAttribute('src'), focus: document.activeElement.getAttribute('data-share-target') }));
    check('Esc closes the dialog and stops the preview', !after.open && after.src === 'about:blank', JSON.stringify(after));
    check('focus returns to the button that opened it', after.focus === 'drivers-chart', String(after.focus));

    await button.click();
    await page.waitForTimeout(250);
    await page.click('.embed-close');
    await page.waitForTimeout(200);
    check('the close button closes the dialog', !(await dialogOpen(page)));

    await button.click();
    await page.waitForTimeout(250);
    await page.mouse.click(4, 4); // outside the dialog: the backdrop
    await page.waitForTimeout(200);
    check('a click on the backdrop closes the dialog', !(await dialogOpen(page)));

    // The link-share buttons keep doing what they did.
    await page.locator('[data-share-kind="share"][data-share-target="drivers-chart"]').first().click();
    await page.waitForTimeout(300);
    check('the link-share button does not open the dialog', !(await dialogOpen(page)));
    check('the link-share button still confirms', (await page.textContent('#share-feedback')).length > 0);
    check('no page errors while using the dialog', errors.length === 0, errors.join('; '));
    await context.close();

    // An embed page never builds the dialog.
    const embedded = await open(browser, origin, { search: '?tab=drivers&focus=drivers-chart&embed=1' });
    check('an ?embed=1 page builds no dialog panels', await embedded.page.evaluate(() => document.querySelectorAll('#embed-panels input').length) === 0);
    await embedded.context.close();
}

async function layoutChecks(browser, origin) {
    for (const theme of ['light', 'dark']) {
        for (const width of WIDTHS) {
            const { context, page } = await open(browser, origin, { theme, width, height: width < 600 ? 800 : 900 });
            const button = page.locator('[data-share-kind="embed"][data-share-target="drivers-chart"]').first();
            await button.scrollIntoViewIfNeeded();
            await button.click();
            await page.waitForTimeout(500);
            await page.click('#embed-copy');
            await page.waitForTimeout(250);
            const r = await page.evaluate(() => {
                const dialog = document.getElementById('embed-dialog');
                const box = dialog.getBoundingClientRect();
                const min = selector => Math.min(...[...dialog.querySelectorAll(selector)].map(el => el.getBoundingClientRect().height));
                const style = selector => getComputedStyle(dialog.querySelector(selector));
                const copy = style('#embed-copy');
                return {
                    inside: box.left >= 0 && box.right <= document.documentElement.clientWidth + 0.5 && box.top >= 0 && box.bottom <= window.innerHeight + 0.5,
                    sideways: dialog.scrollWidth > dialog.clientWidth + 1,
                    docSideways: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
                    labelHeight: min('#embed-panels label'),
                    copyHeight: dialog.querySelector('#embed-copy').getBoundingClientRect().height,
                    closeSize: [dialog.querySelector('.embed-close').getBoundingClientRect().width, dialog.querySelector('.embed-close').getBoundingClientRect().height],
                    bg: getComputedStyle(dialog).backgroundColor,
                    text: getComputedStyle(dialog).color,
                    secondary: style('.embed-label').color,
                    status: style('#embed-status').color,
                    copyColor: copy.color, copyBg: copy.backgroundColor,
                    codeColor: style('#embed-code').color, codeBg: style('#embed-code').backgroundColor
                };
            });
            const where = `${theme} ${width}px`;
            check(`${where}: dialog sits inside the viewport`, r.inside);
            check(`${where}: no sideways scroll`, !r.sideways && !r.docSideways);
            check(`${where}: radios and buttons are >= 44px tall`, r.labelHeight >= 44 && r.copyHeight >= 44 && r.closeSize[0] >= 44 && r.closeSize[1] >= 44, `${r.labelHeight}/${r.copyHeight}/${r.closeSize}`);
            check(`${where}: text on the dialog >= 4.5`, contrast(rgb(r.text), rgb(r.bg)) >= 4.5, contrast(rgb(r.text), rgb(r.bg)).toFixed(2));
            check(`${where}: labels and status >= 4.5`, contrast(rgb(r.secondary), rgb(r.bg)) >= 4.5 && contrast(rgb(r.status), rgb(r.bg)) >= 4.5, `${contrast(rgb(r.secondary), rgb(r.bg)).toFixed(2)}/${contrast(rgb(r.status), rgb(r.bg)).toFixed(2)}`);
            check(`${where}: copied button text >= 4.5`, contrast(rgb(r.copyColor), rgb(r.copyBg)) >= 4.5, contrast(rgb(r.copyColor), rgb(r.copyBg)).toFixed(2));
            check(`${where}: code text >= 4.5`, contrast(rgb(r.codeColor), rgb(r.codeBg)) >= 4.5, contrast(rgb(r.codeColor), rgb(r.codeBg)).toFixed(2));
            await context.close();
        }
    }
}

async function main() {
    const executablePath = process.env.CHROME_PATH || Launcher.getFirstInstallation();
    if (!executablePath) throw new Error('No Chrome install found; set CHROME_PATH.');
    const { server, origin } = await startServer();
    const browser = await chromium.launch({ executablePath, headless: true });
    try {
        await behaviourChecks(browser, origin);
        await layoutChecks(browser, origin);
    } finally {
        await browser.close();
        server.close();
    }
    if (process.argv.includes('--json')) console.log(JSON.stringify({ passed, failures }, null, 2));
    else {
        console.log(`embed-dialog-qa: ${passed} checks passed, ${failures.length} failed.`);
        failures.forEach(failure => console.log(`  FAIL ${failure}`));
    }
    process.exit(failures.length ? 1 : 0);
}

main().catch(error => { console.error(error.stack || error.message || error); process.exit(1); });
