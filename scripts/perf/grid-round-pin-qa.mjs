#!/usr/bin/env node
// Regression against the built public artifact and its committed round snapshots.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { Launcher } from 'chrome-launcher';

const root = path.resolve('dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer((req, res) => {
    let pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return res.writeHead(404).end();
    res.setHeader('content-type', types[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || Launcher.getFirstInstallation(), headless: true });
const context = await browser.newContext();
await context.route('https://**/*', route => route.abort());
const page = await context.newPage();
const requests = [];
page.on('request', request => requests.push(request.url()));
async function open(query, expected) {
    requests.length = 0;
    await page.goto(`${origin}/standings/${query}`);
    await page.locator('#drivers-table .st-row').first().waitFor({ state: 'attached' });
    if (expected) {
        assert.ok(requests.some(url => url.includes(`/standings/rounds/${expected}.json`)), `snapshot ${expected}: ${query}`);
        const data = JSON.parse(fs.readFileSync(path.join(root, 'standings/rounds', expected + '.json')));
        const driver = data.driverStandings.MRData.StandingsTable.StandingsLists[0].DriverStandings[0];
        const team = data.constructorStandings.MRData.StandingsTable.StandingsLists[0].ConstructorStandings[0];
        assert.match(await page.locator('#drivers-table .st-row').first().innerText(), new RegExp(driver.points));
        assert.match(await page.locator('#constructors-table .st-row').first().innerText(), new RegExp(team.points));
        await page.waitForTimeout(3800);
        assert.ok(!requests.some(url => /current\/(driver|constructor)standings/.test(url)), 'pinned standings must not refresh live');
    } else assert.ok(requests.some(url => url.includes('/standings/standings-cache.json')), `default snapshot: ${query}`);
}
try {
    await open('?tab=drivers&season=2026&round=16', '2026-16');
    await page.locator('[data-tab="constructors"]').first().click();
    assert.equal(new URL(page.url()).searchParams.get('round'), '16');
    await page.locator('[data-tab="pit-stops"]').first().click();
    assert.equal(new URL(page.url()).searchParams.get('round'), '16');
    await open('?tab=constructors&round=3', '2026-3');
    await open('?tab=drivers&embed=1&season=2026&round=16&focus=drivers-chart', '2026-16');
    assert.equal(new URL(await page.locator('#embed-footer-link').getAttribute('href')).searchParams.has('round'), false);
    await open('?round=0', null);
    await open('?tab=pit-stops&season=2026&round=3', '2026-3');
    // A valid different season must be requested rather than silently using this year.
    requests.length = 0;
    await Promise.all([page.waitForResponse(response => response.url().includes('/rounds/2025-3.json')), page.goto(`${origin}/standings/?season=2025&round=3`)]);
    assert.ok(requests.some(url => url.includes('/rounds/2025-3.json')));
    for (const [slug, round] of [['japanese', '3'], ['bahrain', '16']]) {
        const html = fs.readFileSync(path.join(root, `race-desk/gp/2026-${slug}-gp/index.html`), 'utf8');
        assert.ok(html.includes(`season=2026&amp;round=${round}`), `R02 ${slug} link`);
    }
    await open('', null);
    // Browser history changes between pins and unpinned entries must restore data.
    await open('?round=3', '2026-3');
    await Promise.all([page.waitForResponse(response => response.url().includes('/rounds/2026-16.json')), page.evaluate(() => { history.pushState({}, '', '?round=16'); dispatchEvent(new PopStateEvent('popstate')); })]);
    await Promise.all([page.waitForResponse(response => response.url().includes('/rounds/2026-3.json')), page.goBack()]);
    await Promise.all([page.waitForResponse(response => response.url().includes('/rounds/2026-16.json')), page.goForward()]);
    console.log('Round pin browser regression passed');
} finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
}
