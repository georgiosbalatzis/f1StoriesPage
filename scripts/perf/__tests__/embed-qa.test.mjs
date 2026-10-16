import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { Launcher } from 'chrome-launcher';
import { assess, measurePage } from '../embed-qa.mjs';

test('embed QA recognizes current cues and still rejects visible overflow and missing hints', async () => {
    const executablePath = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || Launcher.getFirstInstallation();
    const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
    try {
        const page = await browser.newPage({ viewport: { width: 320, height: 1000 } });
        await page.setContent(`<!doctype html><html data-embed="1" data-theme="dark"><style>
            html { color-scheme: dark; background: transparent; }
            body { margin: 12px; color: #eee; background: transparent; }
            .standings-panel { position: relative; }
            .quali-race-chart-scroll { overflow-x: auto; }
            .chart { width: 600px; height: 60px; }
            .quali-dot-tooltip { position: absolute; right: -8px; top: 0; opacity: 0; }
            #embed-footer-link { display: inline-block; min-height: 44px; }
            </style><div class="standings-panel active">
                <h3>Qualifying</h3>
                <span class="quali-dot-tooltip"><span>+0.123s</span></span>
                <div class="horizontal-scroll-region">
                    <div class="horizontal-scroll-cue"><span>Σύρε για όλες τις ομάδες</span></div>
                    <div class="quali-race-chart-scroll"><div class="chart"></div></div>
                </div>
            </div><footer id="embed-footer"><span id="embed-footer-meta">F1 Stories</span>
                <a id="embed-footer-link" href="/standings/" target="_top">Άνοιγμα</a>
            </footer></html>`);
        const issues = async () => assess({ id: 'panel-quali-gaps' }, 320, 'dark', await page.evaluate(measurePage, 12), []);
        assert.deepEqual(await issues(), [], 'invisible tooltip descendants cannot fail gutters; the current cue satisfies the hint check');

        await page.locator('.quali-dot-tooltip').evaluate(el => el.style.opacity = '1');
        assert.ok((await issues()).some(issue => issue.startsWith('outside the 12px gutters:')));

        await page.locator('.quali-dot-tooltip').evaluate(el => el.style.opacity = '0');
        await page.locator('.horizontal-scroll-cue').evaluate(el => el.hidden = true);
        assert.ok((await issues()).some(issue => issue.startsWith('horizontal scroller without a swipe hint:')));
    } finally {
        await browser.close();
    }
});
