import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { Launcher } from 'chrome-launcher';
import { startPreview } from '../newsletter-preview/server.mjs';

const screenshotDir = process.argv[2];

test('local preview works with keyboard, enhancement and native POST', async () => {
    const browser = await puppeteer.launch({ executablePath: Launcher.getFirstInstallation(), headless: true, args: ['--no-sandbox'] });
    const external = [];
    // Every page in the suite is observed: any non-loopback request is recorded and aborted.
    async function observedPage(context, origin, { javaScript = true, failSignup = false } = {}) {
        const page = await context.newPage();
        page.submits = 0;
        await page.setJavaScriptEnabled(javaScript);
        await page.setRequestInterception(true);
        page.on('request', request => {
            if (!request.url().startsWith(`${origin}/`)) {
                external.push(request.url());
                return request.abort();
            }
            if (request.url().endsWith('/mock/signup')) {
                page.submits++;
                if (failSignup) return request.abort();
            }
            return request.continue();
        });
        return page;
    }
    try {
        for (const width of [390, 576, 768, 1440]) {
            for (const theme of ['dark', 'light']) {
                const scenario = await startPreview();
                const context = await browser.createBrowserContext();
                const page = await observedPage(context, scenario.origin);
                await page.setViewport({ width, height: 900 });
                await page.goto(`${scenario.origin}/?theme=${theme}`);
                assert.equal(await page.$eval('#consent', el => el.checked), false);
                await page.keyboard.press('Tab');
                assert.equal(await page.evaluate(() => document.activeElement.id), 'email');
                await page.keyboard.press('Tab');
                assert.equal(await page.evaluate(() => document.activeElement.id), 'consent');
                await page.click('#signup-form button');
                assert.equal(await page.evaluate(() => document.activeElement.id), 'error-summary');
                assert.equal(await page.$eval('#email', el => el.getAttribute('aria-invalid')), 'true');
                assert.equal(page.submits, 0);
                if (screenshotDir) {
                    fs.mkdirSync(screenshotDir, { recursive: true });
                    await page.screenshot({ path: path.join(screenshotDir, `newsletter-${width}-${theme}.png`), fullPage: true });
                }
                await page.type('#email', `reader${width}${theme}@example.com`);
                await page.click('#consent');
                await page.evaluate(() => { const form = document.querySelector('#signup-form'); form.requestSubmit(); form.requestSubmit(); });
                await page.waitForFunction(() => document.querySelector('#signup-status').textContent.includes('επιβεβαίωσης'));
                assert.equal(page.submits, 1);
                assert.equal(await page.$eval('#consent', el => el.checked), false);
                assert.equal(await page.$eval('#email', el => el.value), '');
                assert.deepEqual(await page.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie]), [0, 0, '']);
                await page.close();

                // No JavaScript: the native form POST gets the same neutral, server-rendered outcome.
                const native = await observedPage(context, scenario.origin, { javaScript: false });
                await native.setViewport({ width, height: 900 });
                await native.goto(`${scenario.origin}/?theme=${theme}`);
                await native.type('#email', `native${width}${theme}@example.com`);
                await native.click('#consent');
                await Promise.all([native.waitForNavigation(), native.click('#signup-form button')]);
                assert.match(await native.$eval('[role="status"]', el => el.textContent), /επιβεβαίωσης/);
                assert.equal(await native.$eval('#consent', el => el.checked), false);
                assert.equal(native.submits, 1);
                if (screenshotDir) await native.screenshot({ path: path.join(screenshotDir, `newsletter-${width}-${theme}-nojs-neutral.png`), fullPage: true });
                await context.close();
                await scenario.close();
            }
        }
        const preview = await startPreview();
        const failed = await browser.createBrowserContext();
        const failurePage = await observedPage(failed, preview.origin, { failSignup: true });
        await failurePage.goto(preview.origin);
        await failurePage.type('#email', 'failure@example.com');
        await failurePage.click('#consent');
        await failurePage.click('#signup-form button');
        await failurePage.waitForFunction(() => document.querySelector('#signup-status').textContent.includes('δεν ήταν δυνατό'));
        await failed.close();
        await preview.close();
        assert.deepEqual(external, []);
    } finally {
        await browser.close();
    }
});
