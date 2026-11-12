import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { Launcher } from 'chrome-launcher';
import { scanPage, scanForcedColors } from '../visual-qa.mjs';

test('heading order includes visually hidden headings but excludes aria-hidden headings', async () => {
    const executablePath = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || Launcher.getFirstInstallation();
    const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
    try {
        const page = await browser.newPage();
        const scan = async h2 => {
            await page.setContent(`<html><body><nav></nav><main><h1>Title</h1>${h2}<h3 class="lead">Lead</h3></main><footer></footer></body></html>`);
            return (await scanPage(page, 'test')).issues.filter(issue => issue.type === 'heading-order');
        };
        assert.deepEqual(await scan('<h2 style="position:absolute;width:1px;height:1px;overflow:hidden">Hidden visually</h2>'), []);
        assert.equal((await scan(''))[0].selector, 'h3.lead');
        assert.equal((await scan('<h2 aria-hidden="true">Hidden accessibly</h2>'))[0].selector, 'h3.lead');
        assert.equal((await scan('<details><summary>More</summary><h2>Hidden</h2></details>'))[0].selector, 'h3.lead');
        assert.deepEqual(await scan('<details open><summary>More</summary><h2>Exposed</h2></details>'), []);
        assert.equal((await scan('<div style="content-visibility:hidden"><h2>Hidden</h2></div>'))[0].selector, 'h3.lead');
    } finally { await browser.close(); }
});

test('forced colours recognises a visible pseudo-element border without masking borderless controls', async () => {
    const executablePath = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || Launcher.getFirstInstallation();
    const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
    try {
        const page = await browser.newPage({ forcedColors: 'active' });
        await page.setContent(`<style>button {position:relative; width:44px; height:44px; border:0; forced-color-adjust:none; color: red; background:black} .bounded::before {content:'';position:absolute;inset:8px;border:1px solid white}</style><button class="bounded" aria-label="bounded"></button><button class="unbounded" aria-label="unbounded"></button>`);
        const issues = await page.evaluate(scanForcedColors);
        assert.ok(!issues.some(issue => issue.includes('button.bounded')));
        assert.ok(issues.some(issue => issue.includes('button.unbounded')));
    } finally { await browser.close(); }
});
