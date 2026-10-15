import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { Launcher } from 'chrome-launcher';
import { checkCompactFocusRings } from '../visual-qa.mjs';

const executablePath = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || Launcher.getFirstInstallation();

test('focus screenshots recover from a late embed resize and still detect missing rings', async () => {
    const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
    try {
        const page = await browser.newPage({ viewport: { width: 768, height: 1024 } });
        await page.setContent(`<!doctype html><style>
            body { margin: 0; background: white; }
            #embed { height: 2200px; }
            button { display: block; width: 100px; height: 44px; margin: 20px; }
            button:focus-visible { outline: 3px solid black; outline-offset: 3px; }
            footer { height: 1500px; }
            </style><div id="embed"></div>
            <button class="share-btn facebook">Share</button><footer></footer>
            <script>document.querySelector('button').addEventListener('focus', () => {
                setTimeout(() => { document.querySelector('#embed').style.height = '100px'; }, 100);
            }, { once: true });</script>`);
        // Disable scroll anchoring to reproduce the control moving above the viewport.
        await page.addStyleTag({ content: 'html { overflow-anchor: none; }' });
        assert.deepEqual(await checkCompactFocusRings(page, 'latest-article'), []);
        assert.equal(await page.locator('#embed').evaluate(el => el.offsetHeight), 100);

        await page.addStyleTag({ content: 'button:focus-visible { outline: none; }' });
        const issues = await checkCompactFocusRings(page, 'latest-article');
        assert.equal(issues.length, 4);
        assert.ok(issues.every(issue => issue.type === 'control-focus' && /ring only 0% visible/.test(issue.detail)));

        await page.addStyleTag({ content: 'button { width: 900px; }' });
        assert.deepEqual(await checkCompactFocusRings(page, 'latest-article'), [{
            type: 'control-focus', selector: '.share-btn.facebook',
            detail: 'focused control did not settle inside the viewport'
        }]);
    } finally {
        await browser.close();
    }
});
