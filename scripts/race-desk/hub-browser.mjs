#!/usr/bin/env node
// Browser acceptance of an existing public or assembled artifact. No build or provider data is fetched.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { Launcher } from 'chrome-launcher';
import { createHubModels } from './hub-model.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); if (i < 0) return fallback; if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`${name} needs a value`); return args[i + 1]; };
const site = path.resolve(option('--site', 'dist'));
const reports = path.resolve(option('--reports', '.build/race-desk-r03'));
const assembled = args.includes('--assembled');
const registry = JSON.parse(fs.readFileSync(path.join(repo, 'data/race-desk/registry.v1.json')));
const lock = JSON.parse(fs.readFileSync(path.join(repo, 'scripts/deployment/sources.json')));
const models = createHubModels(registry, lock, { currentYear: new Date().getUTCFullYear() });
const races = new Map(registry.races.map(race => [race.raceId, race]));
// TYRES override circuit.name at code/data snapshot 50e5f50be89e038257cbe3426b366810e0c1f59a.
// Its deployed data input tracks main separately, so this acceptance detects changes to native selections.
const nativeTyres = {
  '2026-japanese-gp': ['Suzuka Circuit', '67158dbf7d4c4632c3733420a38648ab6171f319'],
  '2026-bahrain-gp': ['Sepang International Circuit', 'e1112c6fe60300560e5e22be75e96b54b429cc41'],
  '2026-azerbaijan-gp': ['Baku City Circuit', '6b77c32b9d865164af65d7ca6583e67d1687013f'],
  '2026-singapore-gp': ['Marina Bay Street Circuit', '1d49eb1a25ced060153f584c0480cb00509d6847'],
  '2025-singapore-gp': ['Marina Bay Street Circuit', 'a26affb3980cb9c7f383f9c73373d43e9370185e'],
  '2026-mexican-gp': ['Autódromo Hermanos Rodríguez', 'be59dff04cae56bcd7966c16df20d70ac59d6673'],
};
const report = { site, assembled, deploymentEnabled: lock.enabled, sourcePins: lock.applications.map(({ application, sha, data }) => ({ application, sha: sha || null, data: data || null })), nativeTyresEvidence: { revision: '50e5f50be89e038257cbe3426b366810e0c1f59a', fields: nativeTyres }, browser: null, checks: [], failures: [], captures: [], observations: [] };
fs.mkdirSync(reports, { recursive: true });
let server, browser;
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.jpg': 'image/jpeg' };
const check = async (name, run) => { try { await run(); report.checks.push(name); } catch (error) { report.failures.push({ name, error: error.stack || String(error) }); } };
try {
  assert.ok(fs.statSync(site).isDirectory(), 'site must be a built directory');
  assert.ok(!assembled || lock.enabled, 'assembled acceptance requires enabled deployment');
  assert.ok(!assembled || lock.applications.find(item => item.application === 'tyres')?.sha === report.nativeTyresEvidence.revision, 're-review TYRES native identity evidence after a code pin change');
  assert.equal(models.length, 6, 'expected six reviewed pilot records');
  const realRoot = fs.realpathSync(site);
  server = http.createServer((req, res) => {
    try {
      let requestPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (requestPath.includes('\\') || requestPath.includes('\0')) return res.writeHead(404).end('Not found');
      if (requestPath.endsWith('/')) requestPath += 'index.html';
      const file = path.resolve(realRoot, '.' + requestPath);
      if (!file.startsWith(realRoot + path.sep) || !fs.existsSync(file)) return res.writeHead(404).end('Not found');
      const actual = fs.realpathSync(file);
      if (!actual.startsWith(realRoot + path.sep) || !fs.statSync(actual).isFile()) return res.writeHead(404).end('Not found');
      res.writeHead(200, { 'content-type': mime[path.extname(actual)] || 'application/octet-stream', 'cache-control': 'no-store' });
      fs.createReadStream(actual).pipe(res);
    } catch { res.writeHead(404).end('Not found'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const calendarUrl = `https://api.jolpi.ca/ergast/f1/${new Date().getFullYear()}.json`;
  const providerRequests = requests => requests.filter(url => /^https:\/\/(?:api\.jolpi\.ca|api\.openf1\.org)(?:\/|$)/i.test(url));
  report.calendarFixture = { url: calendarUrl, response: 'synthetic empty schedule', scope: 'incumbent shared navigation countdown only' };
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || Launcher.getFirstInstallation(), headless: true });
  report.browser = browser.version();
  async function open({ width = 390, theme = 'light', javascriptEnabled = true } = {}) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, colorScheme: theme, reducedMotion: 'reduce', javaScriptEnabled: javascriptEnabled });
    if (javascriptEnabled) await context.addInitScript(themeName => { localStorage.setItem('f1stories-theme', themeName); localStorage.setItem('f1stories-cookie-consent-v1', JSON.stringify({ essential: true, analytics: false, ts: Date.now() })); }, theme);
    const requests = [], bodies = [], errors = [];
    await context.route('**/*', route => {
      const url = new URL(route.request().url()); requests.push(url.href);
      if (url.origin === origin) return route.continue();
      if (url.href === calendarUrl) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ MRData: { RaceTable: { Races: [] } } }) });
      return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' && /content security policy|refused to (?:load|execute|frame|connect|apply)/i.test(message.text())) errors.push(`CSP: ${message.text()}`); });
    page.on('response', response => { const url = new URL(response.url()); if (url.origin === origin) bodies.push(response.body().then(body => ({ path: url.pathname, bytes: body.length })).catch(() => null)); });
    return { context, page, requests, bodies, errors };
  }
  const ready = async page => { await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {}); await page.evaluate(() => document.fonts.ready); };
  const pageChecks = async (run, model, javascriptEnabled) => {
    const { page } = run, race = races.get(model.raceId);
    const response = await page.goto(origin + model.path, { waitUntil: 'domcontentloaded' });
    assert.equal(response.status(), 200);
    await ready(page);
    const canonical = `https://f1-stories.gr${model.path}`;
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), canonical);
    assert.equal(await page.locator('meta[property="og:url"]').getAttribute('content'), canonical);
    assert.equal(await page.locator('h1').count(), 1);
    assert.ok((await page.locator('h1').innerText()).includes(race.displayName), `h1 must contain ${race.displayName}`);
    const fonts = await page.evaluate(() => ({
      title: getComputedStyle(document.querySelector('h1')).fontFamily,
      body: getComputedStyle(document.querySelector('body')).fontFamily,
      greekReady: document.fonts.check('16px "IBM Plex Sans"', 'Πρόγραμμα'),
      brandReady: document.fonts.check('700 16px "Barlow Condensed"', 'Grand Prix'),
      faces: [...document.fonts].filter(face => /IBM Plex Sans|Barlow Condensed/i.test(face.family)).map(face => ({ family: face.family, unicodeRange: face.unicodeRange, status: face.status }))
    }));
    assert.match(fonts.title, /Barlow Condensed/i); assert.match(fonts.body, /IBM Plex Sans/i);
    assert.ok(fonts.greekReady && fonts.faces.some(face => /IBM Plex Sans/i.test(face.family) && /370/i.test(face.unicodeRange) && face.status === 'loaded'), `Greek font must be naturally loaded: ${JSON.stringify(fonts)}`);
    assert.ok(fonts.brandReady && fonts.faces.some(face => /Barlow Condensed/i.test(face.family) && face.status === 'loaded'), `brand font must be naturally loaded: ${JSON.stringify(fonts)}`);
    assert.ok((await page.locator('main').innerText()).includes(race.venue.name));
    const table = page.locator('main table');
    assert.equal(await table.count(), 1);
    assert.deepEqual(await table.locator('tbody time').evaluateAll(nodes => nodes.map(node => node.getAttribute('datetime'))), race.sessions.filter(s => s.startUtc).map(s => s.startUtc));
    const tableText = await table.innerText();
    assert.ok(tableText.includes(race.venue.timeZone)); assert.ok(tableText.includes('Europe/Athens'));
    assert.match(tableText, /Τοπική ώρα/); assert.match(tableText, /Ώρα Ελλάδας/);
    for (const session of race.sessions.filter(s => s.startUtc)) {
      const row = table.locator('tr').filter({ has: page.locator(`time[datetime="${session.startUtc}"]`) });
      const text = await row.innerText();
      for (const zone of ['UTC', race.venue.timeZone, 'Europe/Athens']) {
        const parts = Object.fromEntries(new Intl.DateTimeFormat('el-GR', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(session.startUtc)).map(part => [part.type, part.value]));
        assert.ok(text.includes(`${parts.day}/${parts.month}/${parts.year}`)); assert.ok(text.includes(`${parts.hour}:${parts.minute}`));
        const offset = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(new Date(session.startUtc)).find(part => part.type === 'timeZoneName').value.replace('GMT', 'UTC');
        assert.ok(text.includes(offset));
      }
      assert.match(text, /μη συνδεδεμένα/i);
    }
    for (const source of model.sources) {
      const sourceItem = page.locator('.race-desk-sources li').filter({ has: page.locator('details span', { hasText: source.id }) });
      assert.equal(await sourceItem.count(), 1); assert.ok(await sourceItem.isVisible());
      assert.equal(await sourceItem.locator('time').getAttribute('datetime'), source.reviewedAt);
      assert.ok(await sourceItem.locator('time').isVisible());
      const details = sourceItem.locator('details'), summary = details.locator('summary');
      const id = details.locator('span').filter({ hasText: source.id });
      assert.equal(await id.isVisible(), false, 'technical source details start closed');
      if (source.url) {
        const sourceLink = sourceItem.locator('a');
        assert.equal(await sourceLink.count(), 1, `source ${source.id} must be a link`);
        assert.equal(await sourceLink.getAttribute('href'), source.url); assert.ok(await sourceLink.isVisible());
      } else assert.match(await sourceItem.innerText(), /Σύνδεσμος πηγής μη διαθέσιμος/);
      await summary.focus(); assert.equal(await summary.evaluate(el => document.activeElement === el), true);
      await page.keyboard.press('Enter'); assert.ok(await id.isVisible());
      const detailText = await details.innerText(); assert.ok(detailText.includes(source.revision)); assert.ok(detailText.includes(source.path));
    }
    assert.equal(await page.locator('script[type="application/json"]').count(), 0, 'source evidence must not be hidden in JSON');
    const toolLinks = page.locator('.race-desk-tools li');
    for (const tool of model.tools) {
      const item = toolLinks.filter({ has: page.getByRole('link', { name: new RegExp('^' + tool.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }) });
      assert.equal(await item.count(), 1, `tool ${tool.target}`);
      const href = await item.locator('a').getAttribute('href');
      assert.equal(new URL(href, 'https://f1-stories.gr').href, new URL(tool.url, 'https://f1-stories.gr').href, `${tool.target} destination`);
      if (tool.kind === 'generic') assert.match(await item.innerText(), /Γενική προβολή|επίλεξε αγώνα/i);
    }
    assert.deepEqual(providerRequests(run.requests), javascriptEnabled ? [calendarUrl] : [], 'only the shared navigation calendar request is allowed');
    assert.deepEqual(run.errors, []);
    const reload = await page.reload({ waitUntil: 'domcontentloaded' }); assert.equal(reload.status(), 200);
    assert.ok((await page.locator('h1').innerText()).includes(race.displayName));
    await ready(page);
    assert.deepEqual(providerRequests(run.requests), javascriptEnabled ? [calendarUrl, calendarUrl] : [], 'reload must only repeat the shared navigation calendar request');
    assert.deepEqual(run.errors, []);
  };
  const baseline = await open();
  await check('incumbent shared navigation calendar on authors baseline', async () => {
    assert.equal((await baseline.page.goto(origin + '/authors/', { waitUntil: 'domcontentloaded' })).status(), 200); await ready(baseline.page);
    report.baselineProviderRequests = providerRequests(baseline.requests);
    assert.deepEqual(report.baselineProviderRequests, [calendarUrl]);
  });
  await baseline.context.close();
  for (const model of models) for (const javascriptEnabled of [false, true]) {
    const run = await open({ javascriptEnabled });
    await check(`${model.raceId}: direct load and reload, JS ${javascriptEnabled ? 'on' : 'off'}`, () => pageChecks(run, model, javascriptEnabled));
    await run.context.close();
  }
  const missing = await open();
  await check('unknown route returns 404', async () => { assert.equal((await missing.page.goto(origin + '/race-desk/gp/2026-unknown-gp/')).status(), 404); });
  await missing.context.close();
  for (const model of models) for (const theme of ['light', 'dark']) for (const width of [390, 576, 768, 1440]) {
    const run = await open({ width, theme });
    await check(`${model.raceId}: ${width} ${theme} visual and keyboard`, async () => {
      assert.equal((await run.page.goto(origin + model.path, { waitUntil: 'domcontentloaded' })).status(), 200); await ready(run.page);
      assert.equal((await run.page.locator('html').getAttribute('data-theme')) || 'dark', theme);
      const layout = await run.page.evaluate(() => {
        const viewport = document.documentElement.clientWidth, main = document.querySelector('main');
        const rect = main.getBoundingClientRect();
        const overflow = [...main.querySelectorAll('*')].filter(el => {
          const style = getComputedStyle(el), bounds = el.getBoundingClientRect();
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0' || bounds.width <= 1 || bounds.height <= 1) return false;
          for (let parent = el.parentElement; parent && parent !== main; parent = parent.parentElement) {
            const overflowX = getComputedStyle(parent).overflowX;
            if (['auto', 'scroll', 'hidden', 'clip'].includes(overflowX) && parent.scrollWidth > parent.clientWidth + 2) return false;
          }
          return bounds.left < -2 || bounds.right > viewport + 2;
        }).map(el => ({ tag: el.tagName, className: String(el.className), left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right }));
        return { viewport, scrollWidth: document.documentElement.scrollWidth, main: { left: rect.left, right: rect.right }, overflow };
      });
      const file = `${model.raceId}-${width}-${theme}.png`; await run.page.screenshot({ path: path.join(reports, file), fullPage: true });
      report.captures.push(file);
      const bodies = (await Promise.all(run.bodies)).filter(Boolean);
      report.observations.push({ raceId: model.raceId, width, theme, requests: run.requests.length, providerRequests: providerRequests(run.requests), decodedResponseBytes: bodies.reduce((sum, body) => sum + body.bytes, 0), decodedHtmlJsBytes: bodies.filter(body => /(?:\.html|\.js|\/)$/i.test(body.path)).reduce((sum, body) => sum + body.bytes, 0), bodies, layout });
      assert.ok(layout.scrollWidth <= layout.viewport + 2, JSON.stringify(layout));
      assert.ok(layout.main.left >= -2 && layout.main.right <= layout.viewport + 2, JSON.stringify(layout));
      assert.deepEqual(layout.overflow, [], JSON.stringify(layout.overflow));
      const first = run.page.locator('a[href],button').first(); await first.focus(); assert.equal(await first.evaluate(el => document.activeElement === el), true); await run.page.keyboard.press('Tab'); assert.ok(await run.page.evaluate(() => document.activeElement !== document.body));
      assert.deepEqual(report.observations.at(-1).providerRequests, [calendarUrl]); assert.deepEqual(run.errors, []);
    });
    await run.context.close();
  }
  const nav = await open({ width: 390, theme: 'light' });
  await check('mobile navigation, keyboard focus and theme toggle', async () => {
    await nav.page.goto(origin + models[0].path, { waitUntil: 'domcontentloaded' }); await ready(nav.page);
    const hamburger = nav.page.locator('#nav-hamburger');
    await hamburger.focus(); assert.equal(await hamburger.evaluate(el => document.activeElement === el), true);
    await nav.page.keyboard.press('Enter'); assert.equal(await hamburger.getAttribute('aria-expanded'), 'true');
    const menu = nav.page.locator('#nav-mobile'); assert.ok(await menu.isVisible());
    assert.equal(await menu.locator('a[href="/standings/"]').count(), 1);
    const themeButton = nav.page.locator('.theme-toggle-nav-btn');
    await themeButton.click();
    assert.equal((await nav.page.locator('html').getAttribute('data-theme')) || 'dark', 'dark');
    await themeButton.click(); assert.equal(await nav.page.locator('html').getAttribute('data-theme'), 'light');
    assert.deepEqual(nav.errors, []);
  });
  await nav.context.close();
  const schedule = await open({ width: 390, theme: 'light' });
  await check('mobile schedule can be reached and scrolled with keyboard', async () => {
    await schedule.page.goto(origin + models[0].path, { waitUntil: 'domcontentloaded' }); await ready(schedule.page);
    const region = schedule.page.locator('.race-desk-table-wrap');
    assert.equal(await region.getAttribute('role'), 'region'); assert.equal(await region.getAttribute('tabindex'), '0');
    assert.ok(await region.getAttribute('aria-label'));
    const dimensions = await region.evaluate(el => ({ width: el.clientWidth, scrollWidth: el.scrollWidth }));
    assert.ok(dimensions.scrollWidth > dimensions.width, 'test viewport must expose a horizontally scrollable schedule');
    const skip = schedule.page.locator('.race-desk-skip'); await skip.focus();
    assert.ok(await skip.isVisible());
    assert.ok(await skip.evaluate(el => { const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return top === el || el.contains(top); }), 'focused skip link must not be covered');
    await schedule.page.keyboard.press('Enter'); assert.equal(new URL(schedule.page.url()).hash, '#main');
    const target = await schedule.page.evaluate(() => ({ heading: document.querySelector('h1').getBoundingClientRect().top, header: document.querySelector('#blog-nav').getBoundingClientRect().bottom }));
    assert.ok(target.heading >= target.header, `heading must clear the fixed navigation: ${JSON.stringify(target)}`);
    await skip.focus();
    let focused = false;
    for (let i = 0; i < 80; i++) {
      await schedule.page.keyboard.press('Tab');
      if (await region.evaluate(el => document.activeElement === el)) { focused = true; break; }
    }
    assert.ok(focused, 'schedule region must be reachable by Tab');
    await schedule.page.keyboard.press('ArrowRight'); await schedule.page.waitForTimeout(250);
    assert.ok(await region.evaluate(el => el.scrollLeft > 0), 'ArrowRight must scroll the schedule');
    assert.deepEqual(schedule.errors, []);
  });
  await schedule.context.close();
  if (assembled) {
    for (const model of models) {
      const race = races.get(model.raceId), tyres = model.tools.find(tool => tool.target === 'tyres');
      const run = await open({ width: 1440 });
      await check(`${model.raceId}: assembled TYRES native selection`, async () => {
        await run.page.goto(origin + model.path, { waitUntil: 'domcontentloaded' });
        const href = await run.page.locator('.race-desk-tools li').filter({ has: run.page.getByRole('link', { name: /^TYRES/ }) }).locator('a').getAttribute('href');
        const destination = new URL(href, 'https://f1-stories.gr'); assert.equal(destination.href, tyres.url); assert.equal(destination.origin, 'https://f1-stories.gr');
        assert.equal((await run.page.goto(origin + destination.pathname, { waitUntil: 'domcontentloaded' })).status(), 200);
        await run.page.waitForFunction(id => document.querySelector('#race')?.value === id, race.sourceKeys.tyresRaceId, { timeout: 15000 });
        assert.equal(await run.page.locator('#year').inputValue(), String(race.season));
        assert.equal(await run.page.locator('#race-title').textContent(), race.eventName);
        const native = nativeTyres[model.raceId]; assert.ok(native, 'native TYRES venue must be independently reviewed');
        assert.ok((await run.page.locator('.hero-meta').textContent()).includes(native[0]), `native venue must match reviewed override ${native[1]}`);
        assert.equal(new URL(run.page.url()).pathname, destination.pathname);
        assert.deepEqual(run.errors, []);
      }); await run.context.close();
      if (race.sourceKeys.jolpica) {
        const grid = model.tools.find(tool => tool.target === 'grid'); const gridRun = await open({ width: 1440 });
        await check(`${model.raceId}: assembled GRID round pin`, async () => {
          await gridRun.page.goto(origin + model.path, { waitUntil: 'domcontentloaded' });
          const href = await gridRun.page.locator('.race-desk-tools li').filter({ has: gridRun.page.getByRole('link', { name: /^THE GRID/ }) }).locator('a').getAttribute('href');
          const destination = new URL(href, 'https://f1-stories.gr'); assert.equal(destination.href, new URL(grid.url, 'https://f1-stories.gr').href); const params = destination.searchParams;
          assert.equal(destination.pathname, '/standings/'); assert.equal(params.get('embed'), '1'); assert.equal(params.get('season'), String(race.season)); assert.equal(params.get('round'), String(race.sourceKeys.jolpica.round));
          assert.equal((await gridRun.page.goto(origin + destination.pathname + destination.search, { waitUntil: 'domcontentloaded' })).status(), 200);
          const snapshot = JSON.parse(fs.readFileSync(path.join(site, `standings/rounds/${race.season}-${race.sourceKeys.jolpica.round}.json`)));
          const first = snapshot.driverStandings.MRData.StandingsTable.StandingsLists[0].DriverStandings[0];
          await gridRun.page.locator('#drivers-table .st-row').first().waitFor({ timeout: 15000 });
          assert.ok((await gridRun.page.locator('#drivers-table .st-row').first().innerText()).includes(first.Driver.familyName));
          assert.ok((await gridRun.page.locator('body').innerText()).includes(`Γύρο ${race.sourceKeys.jolpica.round}`));
          assert.equal(new URL(gridRun.page.url()).searchParams.get('round'), String(race.sourceKeys.jolpica.round));
          assert.deepEqual(gridRun.errors, []);
        }); await gridRun.context.close();
      }
    }
  }
} catch (error) { report.failures.push({ name: 'runner', error: error.stack || String(error) }); }
finally {
  if (browser) await browser.close();
  if (server) { server.closeAllConnections?.(); await new Promise(resolve => server.close(resolve)); }
  fs.writeFileSync(path.join(reports, 'hub-browser.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ checks: report.checks.length, captures: report.captures.length, failures: report.failures }, null, 2));
  if (report.failures.length) process.exitCode = 1;
}
