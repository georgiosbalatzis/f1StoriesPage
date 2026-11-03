import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { Launcher } from 'chrome-launcher';
import { startPreview } from '../newsletter-preview/server.mjs';

const screenshotDir = process.argv[2];

test('local preview works with keyboard, enhancement and native POST', async () => {
    const preview = await startPreview();
    const browser = await puppeteer.launch({ executablePath: Launcher.getFirstInstallation(), headless: true, args: ['--no-sandbox'] });
    const external = [];
    try {
        for (const width of [390, 576, 768, 1440]) {
            for (const theme of ['dark', 'light']) {
                const scenario = await startPreview();
                const context = await browser.createBrowserContext();
                const page = await context.newPage();
                await page.setViewport({ width, height: 900 });
                let submits = 0;
                await page.setRequestInterception(true);
                page.on('request', request => {
                    if (!request.url().startsWith(`${scenario.origin}/`)) {
                        external.push(request.url());
                        return request.abort();
                    }
                    if (request.url().endsWith('/mock/signup')) submits++;
                    return request.continue();
                });
                await page.goto(`${scenario.origin}/?theme=${theme}`);
                assert.equal(await page.$eval('#consent', el => el.checked), false);
                await page.keyboard.press('Tab');
                assert.equal(await page.evaluate(() => document.activeElement.id), 'email');
                await page.keyboard.press('Tab');
                assert.equal(await page.evaluate(() => document.activeElement.id), 'consent');
                await page.click('#signup-form button');
                assert.equal(await page.evaluate(() => document.activeElement.id), 'error-summary');
                assert.equal(await page.$eval('#email', el => el.getAttribute('aria-invalid')), 'true');
                assert.equal(submits, 0);
                if (screenshotDir) {
                    fs.mkdirSync(screenshotDir, { recursive: true });
                    await page.screenshot({ path: path.join(screenshotDir, `newsletter-${width}-${theme}.png`), fullPage: true });
                }
                await page.type('#email', `reader${width}${theme}@example.com`);
                await page.click('#consent');
                await page.evaluate(() => { const form = document.querySelector('#signup-form'); form.requestSubmit(); form.requestSubmit(); });
                await page.waitForFunction(() => document.querySelector('#signup-status').textContent.includes('επιβεβαίωσης'));
                assert.equal(submits, 1);
                assert.equal(await page.$eval('#consent', el => el.checked), false);
                assert.equal(await page.$eval('#email', el => el.value), '');
                assert.deepEqual(await page.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie]), [0, 0, '']);
                await context.close();
                await scenario.close();
            }
        }
        const context = await browser.createBrowserContext();
        const page = await context.newPage();
        await page.setJavaScriptEnabled(false);
        await page.goto(preview.origin);
        await page.type('#email', 'native@example.com');
        await page.click('#consent');
        await Promise.all([page.waitForNavigation(), page.click('#signup-form button')]);
        assert.match(await page.$eval('[role="status"]', el => el.textContent), /επιβεβαίωσης/);
        await context.close();
        const failed = await browser.createBrowserContext();
        const failurePage = await failed.newPage();
        await failurePage.setRequestInterception(true);
        failurePage.on('request', request => request.url().endsWith('/mock/signup') ? request.abort() : request.continue());
        await failurePage.goto(preview.origin);
        await failurePage.type('#email', 'failure@example.com');
        await failurePage.click('#consent');
        await failurePage.click('#signup-form button');
        await failurePage.waitForFunction(() => document.querySelector('#signup-status').textContent.includes('δεν ήταν δυνατό'));
        await failed.close();
        assert.deepEqual(external, []);
    } finally {
        await browser.close();
        await preview.close();
    }
});
