#!/usr/bin/env node
// Browser acceptance of an existing public or assembled artifact. No build or provider data is fetched.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { Launcher } from 'chrome-launcher';
import { assertResultsPage } from './results-browser.mjs';
import { readResultsContexts } from './results-files.mjs';
import { createPublicationModels } from './hub-publication.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); if (i < 0) return fallback; if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`${name} needs a value`); return args[i + 1]; };
const site = path.resolve(option('--site', 'dist'));
const reports = path.resolve(option('--reports', '.build/race-desk-r03'));
const assembled = args.includes('--assembled');
const registry = JSON.parse(fs.readFileSync(path.join(repo, 'data/race-desk/registry.v1.json')));
const lock = JSON.parse(fs.readFileSync(path.join(repo, 'scripts/deployment/sources.json')));
const evidence = JSON.parse(fs.readFileSync(path.join(repo, 'data/race-desk/hub-evidence.v1.json')));
const models = createPublicationModels(registry, lock, evidence, { currentYear: new Date().getUTCFullYear() });
const resultsContexts = readResultsContexts(repo, registry);
const races = new Map(registry.races.map(race => [race.raceId, race]));
const storyIds = { '2026-singapore-gp': ['20261012W', '20261008J'], '2026-mexican-gp': ['20261031J'] };
const posts = new Map(JSON.parse(fs.readFileSync(path.join(repo, 'blog-module/blog-source-cache.json'))).posts.map(post => [post.id, post]));
const editorial = JSON.parse(fs.readFileSync(path.join(repo, 'data/race-desk/editorial.v1.json')));
const privateEvidence = ['source.txt', 'editorial.v1.json', ...editorial.associations.flatMap(({ evidence }) => [evidence.sha256, evidence.reviewedRevision])];
const timelineInventory = JSON.parse(fs.readFileSync(path.join(repo, 'data/race-desk/timeline.v1.json')));
const timelineReceipts = timelineInventory.captures.filter(item => item.raceId === '2026-singapore-gp');
const timelinePayload = endpoint => {
  const matches = timelineReceipts.filter(item => item.endpoint === endpoint);
  assert.equal(matches.length, 1, `one Singapore ${endpoint} capture`);
  return JSON.parse(fs.readFileSync(path.join(repo, matches[0].path)));
};
const instant = value => {
  const match = /^(.*?)(?:\.(\d{1,6}))?(Z|[+-]\d\d:\d\d)$/.exec(value);
  assert.ok(match, `valid capture timestamp: ${value}`);
  const millis = Date.parse(`${match[1]}.${(match[2] || '').padEnd(6, '0').slice(0, 3)}${match[3]}`);
  assert.ok(Number.isFinite(millis));
  return BigInt(millis) * 1000n + BigInt((match[2] || '').padEnd(6, '0').slice(3));
};
const stable = value => value && typeof value === 'object' ? Array.isArray(value) ? value.map(stable) : Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const sessions = timelinePayload('sessions');
assert.equal(sessions.length, 1);
const start = instant(sessions[0].date_start), end = instant(sessions[0].date_end);
assert.ok(start <= end);
const timelineCount = ['race_control', 'pit'].reduce((total, endpoint) => {
  const unique = new Set();
  for (const row of timelinePayload(endpoint)) {
    const time = instant(row.date);
    if (time >= start && time <= end) unique.add(JSON.stringify(stable(row)));
  }
  return total + unique.size;
}, 0);
assert.ok(timelineCount > 0, 'Singapore pilot must contain observations');
const timelinePrivate = ['timeline.v1.json', 'data/race-desk/captures', ...timelineInventory.captures.flatMap(item => [item.sha256, item.captureId, item.requestUrl])];
const paceInventory = JSON.parse(fs.readFileSync(path.join(repo, 'data/race-desk/pace.v1.json')));
const pacePrivate = ['pace.v1.json', 'timelineBindings', 'reasonCodes', ...paceInventory.captures.flatMap(item => [item.sha256, item.captureId, item.requestUrl])];
// Read and pin the actual receipt bytes independently of the pace implementation.
const pacePayload = endpoint => {
  const receipts = paceInventory.captures.filter(item => item.raceId === '2026-singapore-gp' && item.endpoint === endpoint);
  assert.equal(receipts.length, 1, `one Singapore ${endpoint} capture`);
  const receipt = receipts[0], bytes = fs.readFileSync(path.join(repo, receipt.path));
  assert.equal(bytes.length, receipt.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), receipt.sha256);
  const rows = JSON.parse(bytes); assert.equal(rows.length, receipt.rowCount); return rows;
};
const paceLaps = pacePayload('laps'), paceStints = pacePayload('stints');
const paceDrivers = [...new Set(paceLaps.map(row => row.driver_number))].sort((a, b) => a - b);
const uncertainDrivers = [...new Set(timelinePayload('pit').filter(pit => !paceStints.some(stint => stint.driver_number === pit.driver_number && stint.lap_end === pit.lap_number) || !paceStints.some(stint => stint.driver_number === pit.driver_number && stint.lap_start === pit.lap_number + 1)).map(pit => pit.driver_number))].sort((a, b) => a - b);
// The three observed pit visits without a stint boundary belong to #6, #14 and #18.
assert.deepEqual(uncertainDrivers, [6, 14, 18]);
const formatTime = seconds => `${new Intl.NumberFormat('el-GR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Math.floor(seconds * 1000 + 0.5 + 1e-9) / 1000)} s`;
const storyHref = id => `https://f1-stories.gr/blog-module/blog-entries/${encodeURIComponent(id)}/article.html`;
// TYRES override circuit.name at code/data snapshot cd87460bd51d86114b32d0d64556b1393d3f3aed.
// Its deployed data input tracks main separately, so this acceptance detects changes to native selections.
const nativeTyres = {
  '2026-japanese-gp': ['Suzuka Circuit', '67158dbf7d4c4632c3733420a38648ab6171f319'],
  '2026-bahrain-gp': ['Sepang International Circuit', 'e1112c6fe60300560e5e22be75e96b54b429cc41'],
  '2026-azerbaijan-gp': ['Baku City Circuit', '6b77c32b9d865164af65d7ca6583e67d1687013f'],
  '2026-singapore-gp': ['Marina Bay Street Circuit', '1d49eb1a25ced060153f584c0480cb00509d6847'],
  '2025-singapore-gp': ['Marina Bay Street Circuit', 'a26affb3980cb9c7f383f9c73373d43e9370185e'],
  '2026-mexican-gp': ['Autódromo Hermanos Rodríguez', 'be59dff04cae56bcd7966c16df20d70ac59d6673'],
};
const report = { site, assembled, deploymentEnabled: lock.enabled, sourcePins: lock.applications.map(({ application, sha, data }) => ({ application, sha: sha || null, data: data || null })), officialCaptures: models.map(({ raceId, scheduleEvidence }) => ({ raceId, url: scheduleEvidence.url, observedAt: scheduleEvidence.observedAt, sha256: scheduleEvidence.sha256, bytes: scheduleEvidence.bytes })), nativeTyresEvidence: { revision: 'cd87460bd51d86114b32d0d64556b1393d3f3aed', fields: nativeTyres }, browser: null, checks: [], failures: [], captures: [], observations: [] };
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
    // Story pages also fail on any console error, except the "Failed to load resource" noise from this harness aborting off-origin requests.
    page.on('console', message => { if (message.type() === 'error' && (/content security policy|refused to (?:load|execute|frame|connect|apply)/i.test(message.text()) || (!/^Failed to load resource: net::ERR_FAILED$/.test(message.text()) && Object.keys(storyIds).some(id => page.url().includes(`/race-desk/gp/${id}/`))))) errors.push(`console: ${message.text()}`); });
    page.on('response', response => { const url = new URL(response.url()); if (url.origin === origin) bodies.push(response.body().then(body => ({ path: url.pathname, bytes: body.length })).catch(() => null)); });
    return { context, page, requests, bodies, errors };
  }
  const ready = async page => { await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {}); await page.evaluate(() => document.fonts.ready); };
  const pageChecks = async (run, model, javascriptEnabled) => {
    const { page } = run, race = races.get(model.raceId);
    const response = await page.goto(origin + model.path, { waitUntil: 'domcontentloaded' });
    assert.equal(response.status(), 200);
    await ready(page);
    await assertResultsPage(page, resultsContexts.get(model.raceId));
    const sections = page.locator('main section.race-desk-section');
    assert.ok([7, 8].includes(await sections.count()));
    assert.ok(await sections.locator(':scope.race-desk-gateway').count() <= 1);
    assert.deepEqual(await sections.evaluateAll(nodes => nodes.filter(node => !node.classList.contains('race-desk-gateway')).map(node => ({ id: node.getAttribute('aria-labelledby'), headings: [...node.querySelectorAll('h2')].map(h => h.id), kicker: node.querySelector('.race-desk-kicker')?.textContent.trim() }))), [
      ['schedule-title', '01 / ΠΡΟΓΡΑΜΜΑ'], ['gp-results-title', '02 / ΑΠΟΤΕΛΕΣΜΑΤΑ'], ['gp-timeline-title', '03 / ΧΡΟΝΟΛΟΓΙΟ ΑΓΩΝΑ'], ['gp-pace-title', '04 / ΡΥΘΜΟΣ ΑΓΩΝΑ & STINTS'], ['tools-title', '05 / ΕΡΓΑΛΕΙΑ'], ['related-title', '06 / ΙΣΤΟΡΙΕΣ'], ['sources-title', '07 / ΤΕΚΜΗΡΙΩΣΗ']
    ].map(([id, kicker]) => ({ id, headings: [id], kicker })));
    const allIds = await page.locator('[id]').evaluateAll(nodes => nodes.map(node => node.id));
    assert.equal(new Set(allIds).size, allIds.length, 'document IDs must be unique');
    const timeline = page.locator('section.gp-timeline[aria-labelledby="gp-timeline-title"]');
    assert.equal(await page.locator('section.gp-timeline').count(), 1);
    assert.equal(await timeline.count(), 1);
    assert.equal(await timeline.locator('h2').innerText(), 'Χρονολόγιο αγώνα');
    const details = timeline.locator('details.gp-timeline-details'), list = timeline.locator('ol.gp-timeline-list[role="list"]');
    if (model.raceId === '2026-singapore-gp') {
      assert.equal(await timeline.locator('.gp-timeline-counts').count(), 1);
      assert.match(await timeline.locator('.gp-timeline-counts').innerText(), /μηνύματα αγωνοδιεύθυνσης.*διελεύσεις από το pit lane/);
      assert.equal(await timeline.locator('details').count(), 1); assert.equal(await details.count(), 1);
      assert.equal(await details.getAttribute('open'), null, 'timeline starts closed');
      assert.equal(await list.count(), 1); assert.equal(await details.locator('ol').count(), 1);
      const items = list.locator(':scope > li'); assert.equal(await items.count(), timelineCount);
      const rows = await items.evaluateAll(nodes => nodes.map(item => ({
        meta: item.querySelectorAll(':scope > p.gp-timeline-meta').length,
        times: [...item.querySelectorAll(':scope > p.gp-timeline-meta time')].map(time => ({ date: time.getAttribute('datetime'), text: time.textContent.trim() })),
        metaText: item.querySelector(':scope > p.gp-timeline-meta')?.textContent.trim(),
        labels: item.querySelectorAll(':scope > p.gp-timeline-label').length,
        details: item.querySelectorAll(':scope > p.gp-timeline-detail').length
      })));
      const clock = new Intl.DateTimeFormat('el-GR', { timeZone: 'Europe/Athens', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
      let previous = '';
      for (const row of rows) {
        assert.equal(row.meta, 1); assert.equal(row.times.length, 1); assert.equal(row.labels, 1); assert.ok(row.details <= 1);
        const { date, text } = row.times[0];
        assert.match(date, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
        assert.ok(!previous || previous <= date, 'timeline timestamps must be non-decreasing'); previous = date;
        assert.equal(text, clock.format(new Date(date))); assert.match(row.metaText, /ώρα Ελλάδας/);
      }
      const source = timeline.locator('p.gp-timeline-source'); assert.equal(await source.count(), 1);
      assert.equal(await source.locator('a[href="https://openf1.org/"]').count(), 1);
      assert.equal(await source.locator('a[href="https://creativecommons.org/licenses/by-nc-sa/4.0/"]').count(), 1);
      const summary = details.locator('summary'); assert.equal(await summary.count(), 1);
      await summary.focus(); await page.keyboard.press('Enter'); assert.notEqual(await details.getAttribute('open'), null);
      await page.keyboard.press('Space'); assert.equal(await details.getAttribute('open'), null);
      await page.keyboard.press('Space'); assert.notEqual(await details.getAttribute('open'), null);
    } else {
      assert.ok((await timeline.innerText()).includes('Δεν υπάρχει εγκεκριμένη αντιστοίχιση πηγής για αυτόν τον αγώνα.'));
      assert.equal(await timeline.locator('details, ol, .gp-timeline-list').count(), 0);
    }
    assert.doesNotMatch(await timeline.textContent(), /\b(?:null|undefined)\b/i);
    const pace = page.locator('section.gp-pace[aria-labelledby="gp-pace-title"]');
    assert.equal(await page.locator('section.gp-pace').count(), 1); assert.equal(await pace.count(), 1);
    assert.equal(await pace.locator('h2').innerText(), 'Ρυθμός αγώνα & stints');
    assert.doesNotMatch(await pace.textContent(), /\b(?:null|undefined|NaN|Infinity)\b/i);
    assert.equal(await pace.locator('script, svg, img, canvas, [onclick]').count(), 0);
    if (model.raceId === '2026-singapore-gp') {
      const paceDetails = pace.locator('details.gp-pace-details');
      assert.equal(await paceDetails.count(), paceDrivers.length);
      assert.deepEqual(await paceDetails.evaluateAll(nodes => nodes.map(node => node.open)), paceDrivers.map(() => false), 'pace disclosures start closed');
      assert.deepEqual(await paceDetails.evaluateAll(nodes => nodes.map(node => Number(node.querySelector('summary').textContent.match(/#(\d+)/)[1]))), paceDrivers);
      const tables = pace.locator('table');
      assert.equal(await tables.count(), 1 + paceDrivers.length);
      assert.ok(await tables.evaluateAll(nodes => nodes.every(table => table.querySelector(':scope > caption')?.textContent.trim() && [...table.querySelectorAll('th')].every(th => ['col', 'row', 'rowgroup'].includes(th.getAttribute('scope'))))), 'pace tables need captions and scoped headers');
      assert.equal(await pace.locator('details.gp-pace-details tbody tr').count(), paceLaps.length);
      assert.ok(await pace.locator('.gp-pace-table-wrap[role="region"][tabindex="0"][aria-label]').count() === 1 + paceDrivers.length);
      const labels = await pace.locator('.gp-pace-table-wrap').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')));
      assert.ok(labels.every(Boolean) && new Set(labels).size === labels.length, 'pace region labels must be unique');
      const summaries = await paceDetails.locator('summary').allTextContents();
      assert.ok(summaries.every(text => text.trim()) && new Set(summaries).size === summaries.length, 'pace summary labels must be unique');
      for (const [index, driver] of paceDrivers.entries()) {
        const expected = paceLaps.filter(lap => lap.driver_number === driver).sort((a, b) => a.lap_number - b.lap_number);
        const actual = await paceDetails.nth(index).locator('tbody tr').evaluateAll(rows => rows.map(row => [...row.children].map(cell => cell.textContent.trim())));
        assert.deepEqual(actual.map(row => [row[0], row[2]]), expected.map(lap => [String(lap.lap_number), lap.lap_duration === null ? 'Μη διαθέσιμος' : formatTime(lap.lap_duration)]), `driver #${driver} lap times`);
      }
      // The driver header spans that driver's stint rows (scope=rowgroup): carry it onto every row.
      const overview = await tables.first().locator('tbody tr').evaluateAll(rows => { let driver = ''; return rows.map(row => { const cells = [...row.children].map(cell => cell.textContent.trim()); if (row.firstElementChild.tagName === 'TH') driver = cells.shift(); return [driver, ...cells]; }); });
      const sortedStints = [...paceStints].sort((a, b) => a.driver_number - b.driver_number || a.stint_number - b.stint_number);
      assert.equal(overview.length, sortedStints.length);
      for (const [index, stint] of sortedStints.entries()) {
        const row = overview[index], driver = stint.driver_number;
        assert.match(row[0], new RegExp(`^#${driver}\\b`));
        assert.deepEqual(row.slice(1, 5), [String(stint.stint_number), stint.compound, String(stint.tyre_age_at_start), `${stint.lap_start}–${stint.lap_end}`], `driver #${driver} stint metadata`);
        const laps = paceLaps.filter(lap => lap.driver_number === driver && lap.lap_number >= stint.lap_start && lap.lap_number <= stint.lap_end);
        const times = laps.map(lap => lap.lap_duration).filter(value => typeof value === 'number' && Number.isFinite(value) && value > 0).sort((a, b) => a - b);
        assert.equal(row[6], `${laps.length} / ${times.length}`, `driver #${driver} stint counts`);
        if (uncertainDrivers.includes(driver)) {
          assert.deepEqual(row.slice(7, 9), ['Μη διαθέσιμος', 'Μη διαθέσιμος'], `driver #${driver} uncertain stint`);
        } else {
          assert.ok(times.length, `driver #${driver} stint has timed laps`);
          const middle = Math.floor(times.length / 2), median = times.length % 2 ? times[middle] : (times[middle - 1] + times[middle]) / 2;
          assert.deepEqual(row.slice(7, 9), [`${formatTime(median)} (n=${times.length})`, `${formatTime(times[0])} (n=${times.length})`], `driver #${driver} stint summary`);
        }
      }
      const paceText = await pace.innerText();
      for (const phrase of ['Δεν αποτελούν σύγκριση οδηγών ή γομών.', 'Δεν παρουσιάζεται δείγμα επιβεβαιωμένων καθαρών γύρων.', 'επιλέξιμοι: 0', 'Ανεπίσημη πηγή, χωρίς σύνδεση με τη Formula 1.']) assert.ok(paceText.includes(phrase), phrase);
      const source = pace.locator('p.gp-pace-source');
      assert.equal(await source.locator('a[href="https://openf1.org/"]').count(), 1); assert.equal(await source.locator('a[href="https://creativecommons.org/licenses/by-nc-sa/4.0/"]').count(), 1);
      const first = paceDetails.first(), summary = first.locator('summary');
      await summary.focus(); await page.keyboard.press('Enter'); assert.equal(await first.evaluate(node => node.open), true);
      assert.ok(await first.locator('tbody tr').first().isVisible(), 'opened lap table is visible');
      await page.keyboard.press('Space'); assert.equal(await first.evaluate(node => node.open), false);
    } else {
      assert.ok((await pace.innerText()).includes('Δεν υπάρχει εγκεκριμένη αντιστοίχιση πηγής για αυτόν τον αγώνα.'));
      assert.equal(await pace.locator('details, table').count(), 0);
    }
    const related = page.locator('section.race-desk-related[aria-labelledby="related-title"]');
    assert.equal(await page.locator('section.race-desk-related').count(), 1);
    assert.equal(await related.count(), 1);
    assert.equal(await related.locator('h2#related-title').innerText(), 'Σχετικά άρθρα');
    assert.equal(await related.locator('.race-desk-kicker').innerText(), '06 / ΙΣΤΟΡΙΕΣ');
    const ids = storyIds[model.raceId] || [], items = related.locator('ol.race-desk-stories > li');
    assert.equal(await related.locator('ol.race-desk-stories').count(), ids.length ? 1 : 0);
    assert.equal(await items.count(), ids.length);
    assert.equal(await related.locator('a').count(), ids.length);
    for (const [index, id] of ids.entries()) {
      const post = posts.get(id); assert.ok(post, `cached article ${id}`);
      const item = items.nth(index), link = item.locator('h3 > a[href]'), time = item.locator('time[datetime]');
      assert.equal(await link.count(), 1); assert.equal(new URL(await link.getAttribute('href'), 'https://f1-stories.gr').href, storyHref(id));
      assert.equal(await link.textContent(), post.title);
      assert.equal(await time.count(), 1); assert.equal(await time.getAttribute('datetime'), post.date);
      assert.equal(await time.innerText(), new Intl.DateTimeFormat('el-GR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${post.date}T00:00:00Z`)));
    }
    if (!ids.length) assert.doesNotMatch(await related.innerText(), /δεν υπάρχουν(?:\s+\S+){0,3}\s+σχετικά άρθρα|κανένα σχετικό άρθρο δεν υπάρχει/i);
    const headings = await page.locator('main h2, main h3').evaluateAll(nodes => nodes.map(node => ({ id: node.id, story: !!node.closest('.race-desk-stories') })));
    const relatedIndex = headings.findIndex(heading => heading.id === 'related-title'), sourcesIndex = headings.findIndex(heading => heading.id === 'sources-title');
    assert.ok(relatedIndex >= 0 && sourcesIndex > relatedIndex);
    assert.equal(headings.filter(heading => heading.story).length, ids.length);
    assert.ok(headings.every((heading, index) => !heading.story || (index > relatedIndex && index < sourcesIndex)));
    const html = await response.text();
    for (const value of privateEvidence) assert.ok(!html.includes(value), 'editorial evidence must not appear in page source');
    for (const value of timelinePrivate) assert.ok(!html.includes(value), 'timeline provenance must not appear in page source');
    for (const value of pacePrivate) assert.ok(!html.includes(value), 'pace provenance must not appear in page source');
    // The Sources section intentionally cites the official schedule capture digest; the pace section must carry none.
    assert.doesNotMatch(await pace.evaluate(node => node.outerHTML), /\b[a-f0-9]{64}\b|openf1-\d+-(?:laps|stints|drivers|pit|race_control|sessions)|https?:\/\/api\.openf1\.org\/v1\//i, 'provider provenance must not appear in the pace section');
    const resultRegion = page.locator('.gp-results-table-wrap').first();
    if (await resultRegion.count()) {
      assert.ok(await page.locator('.gp-results-hint').first().isVisible());
      await resultRegion.focus(); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(250);
      assert.ok(await resultRegion.evaluate(el => el.scrollLeft > 0), 'results scroll by keyboard with or without JavaScript');
    }
    const canonical = `https://f1-stories.gr${model.path}`;
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), canonical);
    assert.equal(await page.locator('meta[property="og:url"]').getAttribute('content'), canonical);
    assert.equal(await page.locator('h1').count(), 1);
    assert.ok((await page.locator('h1').innerText()).includes(model.displayName), `h1 must contain ${model.displayName}`);
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
    assert.ok((await page.locator('main').innerText()).includes(model.venue.name));
    const table = page.locator('.race-desk-table-wrap[aria-label="Πίνακας προγράμματος"] table');
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
      const result = resultsContexts.get(race.raceId)?.classifications?.[session.kind];
      const note = result?.status === 'available' ? /Καταγεγραμμένη κατάταξη Jolpica/i : ({ 'unmapped-race': /Δεν υπάρχει αντιστοίχιση/, 'uncaptured-session': /Δεν υπάρχει καταγεγραμμένη απόκριση/, 'provider-empty': /δεν περιέχει αποτελέσματα/ }[result?.reason] ?? /μη συνδεδεμένα/i);
      assert.match(text, note);
    }
    const officialGroup = page.locator('.race-desk-source-group').filter({ has: page.getByRole('heading', { name: 'Επίσημη πηγή προγράμματος και ονομασίας' }) });
    const localGroup = page.locator('.race-desk-source-group').filter({ has: page.getByRole('heading', { name: 'Τοπικό μητρώο · αντιστοίχιση και ζώνη ώρας' }) });
    assert.equal(await officialGroup.count(), 1); assert.equal(await localGroup.count(), 1);
    const attribution = page.locator('.race-desk-attribution');
    assert.ok(await attribution.isVisible()); assert.match(await attribution.innerText(), /ανάγνωση πηγής/i);
    assert.equal(await attribution.locator('a').getAttribute('href'), model.scheduleEvidence.url);
    assert.equal(await attribution.locator('time').getAttribute('datetime'), model.scheduleEvidence.observedAt);
    assert.doesNotMatch(await page.locator('main').innerText(), /\bLIVE\b|Ολοκληρώθηκε|Τελική κατάταξη/i);
    const officialLink = officialGroup.locator('a'); assert.equal(await officialLink.count(), 1);
    assert.equal(await officialLink.getAttribute('href'), model.scheduleEvidence.url); assert.ok(await officialLink.isVisible());
    const officialTime = officialGroup.locator('time'); assert.equal(await officialTime.getAttribute('datetime'), model.scheduleEvidence.observedAt);
    assert.ok(await officialTime.isVisible()); assert.match(await officialGroup.innerText(), /Ανάγνωση πηγής/);
    const officialDetails = officialGroup.locator('details');
    assert.equal(await officialDetails.locator('span').first().isVisible(), false);
    await officialDetails.locator('summary').focus(); await page.keyboard.press('Enter');
    const proofText = await officialDetails.innerText();
    for (const value of [model.scheduleEvidence.title, model.scheduleEvidence.sha256, String(model.scheduleEvidence.bytes), model.scheduleEvidence.titleReference, model.scheduleEvidence.meetingReference, model.scheduleEvidence.circuitReference]) assert.ok(proofText.includes(value));
    const aliases = localGroup.locator('details').filter({ has: page.getByText('Ονομασίες στο τοπικό μητρώο', { exact: true }) });
    assert.equal(await aliases.count(), 1); assert.equal(await aliases.locator('span').first().isVisible(), false);
    await aliases.locator('summary').focus(); await page.keyboard.press('Enter');
    const aliasText = await aliases.innerText();
    for (const value of [model.localIdentity.eventName, model.localIdentity.displayName, model.localIdentity.venue.name, model.localIdentity.venue.timeZone]) assert.ok(aliasText.includes(value));
    for (const source of model.sources) {
      const sourceItem = page.locator('.race-desk-sources li').filter({ has: page.locator('details span', { hasText: source.id }) });
      assert.equal(await sourceItem.count(), 1); assert.ok(await sourceItem.isVisible());
      assert.equal(await sourceItem.locator('time').getAttribute('datetime'), source.reviewedAt);
      assert.match(await sourceItem.innerText(), /Έλεγχος πηγής/);
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
    assert.ok((await page.locator('h1').innerText()).includes(model.displayName));
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
  for (const model of models) for (const theme of ['light', 'dark']) for (const width of (storyIds[model.raceId] ? [390, 576, 768, 992, 1280, 1440] : [390, 576, 768, 1440])) for (const javascriptEnabled of (model.raceId === '2026-singapore-gp' ? [false, true] : [true])) {
    const run = await open({ width, theme, javascriptEnabled });
    await check(`${model.raceId}: ${width} ${theme} visual and keyboard, JS ${javascriptEnabled ? 'on' : 'off'}`, async () => {
      assert.equal((await run.page.goto(origin + model.path, { waitUntil: 'domcontentloaded' })).status(), 200); await ready(run.page);
      if (!javascriptEnabled) await run.page.evaluate(value => document.documentElement.setAttribute('data-theme', value), theme);
      assert.equal((await run.page.locator('html').getAttribute('data-theme')) || 'dark', theme);
      await assertResultsPage(run.page, resultsContexts.get(model.raceId));
      if (await run.page.locator('.gp-results-hint').count()) assert.equal(await run.page.locator('.gp-results-hint').first().isVisible(), width < 992);
      const timelineDetails = run.page.locator('.gp-timeline-details');
      if (await timelineDetails.count()) {
        const summary = timelineDetails.locator('summary');
        await summary.focus(); await run.page.keyboard.press('Tab'); await run.page.keyboard.press('Shift+Tab');
        assert.ok(await summary.evaluate(el => el.matches(':focus-visible') && parseFloat(getComputedStyle(el).outlineWidth) > 0), 'timeline summary focus must have a visible outline');
        assert.ok(await summary.evaluate(el => { const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return top === el || el.contains(top); }), 'focused timeline summary must not be covered');
        await run.page.keyboard.press('Enter'); assert.notEqual(await timelineDetails.getAttribute('open'), null);
      }
      const paceDetails = run.page.locator('.gp-pace-details');
      if (await paceDetails.count()) {
        const summary = paceDetails.first().locator('summary');
        await summary.focus(); await run.page.keyboard.press('Tab'); await run.page.keyboard.press('Shift+Tab');
        assert.ok(await summary.evaluate(el => el.matches(':focus-visible') && parseFloat(getComputedStyle(el).outlineWidth) > 0), 'pace summary focus must have a visible outline');
        assert.ok(await summary.evaluate(el => { const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return top === el || el.contains(top); }), 'focused pace summary must not be covered');
        const region = run.page.locator('.gp-pace-table-wrap').first();
        if (await region.evaluate(el => el.scrollWidth > el.clientWidth + 2)) { await region.evaluate(el => { el.scrollLeft = 0; }); await region.focus(); await run.page.keyboard.press('ArrowRight'); await run.page.waitForTimeout(250); assert.ok(await region.evaluate(el => el.scrollLeft > 0), 'pace overview scrolls by keyboard'); }
        // Measure the expanded state: every driver disclosure open.
        await paceDetails.evaluateAll(nodes => nodes.forEach(node => { node.open = true; }));
      }
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
      const file = `${model.raceId}-${width}-${theme}${javascriptEnabled ? '' : '-no-js'}.png`; await run.page.screenshot({ path: path.join(reports, file), fullPage: true });
      report.captures.push(file);
      const bodies = (await Promise.all(run.bodies)).filter(Boolean);
      report.observations.push({ raceId: model.raceId, width, theme, requests: run.requests.length, localRequests: run.requests.filter(url => new URL(url).origin === origin).length, providerRequests: providerRequests(run.requests), decodedResponseBytes: bodies.reduce((sum, body) => sum + body.bytes, 0), decodedHtmlJsBytes: bodies.filter(body => /(?:\.html|\.js|\/)$/i.test(body.path)).reduce((sum, body) => sum + body.bytes, 0), bodies, layout });
      assert.ok(layout.scrollWidth <= layout.viewport + 2, JSON.stringify(layout));
      assert.ok(layout.main.left >= -2 && layout.main.right <= layout.viewport + 2, JSON.stringify(layout));
      assert.deepEqual(layout.overflow, [], JSON.stringify(layout.overflow));
      const first = run.page.locator('a[href],button').first(); await first.focus(); assert.equal(await first.evaluate(el => document.activeElement === el), true); await run.page.keyboard.press('Tab'); assert.ok(await run.page.evaluate(() => document.activeElement !== document.body));
      assert.deepEqual(report.observations.at(-1).providerRequests, javascriptEnabled ? [calendarUrl] : []); assert.deepEqual(run.errors, []);
    });
    await run.context.close();
  }
  for (const width of [991, 992]) for (const javascriptEnabled of [false, true]) {
    const run = await open({ width, javascriptEnabled });
    await check(`results fit or expose scrolling at ${width}, JS ${javascriptEnabled}`, async () => {
      await run.page.goto(origin + models.find(model => model.raceId === '2026-singapore-gp').path, { waitUntil: 'domcontentloaded' }); await ready(run.page);
      for (const region of await run.page.locator('.gp-results-table-wrap').all()) {
        const dimensions = await region.evaluate(el => ({ width: el.clientWidth, scrollWidth: el.scrollWidth }));
        const hint = run.page.locator(`#${await region.getAttribute('aria-describedby')}`);
        assert.equal(await hint.isVisible(), width < 992);
        if (width >= 992) assert.ok(dimensions.scrollWidth <= dimensions.width, JSON.stringify(dimensions));
      }
    });
    await run.context.close();
  }
  for (const javascriptEnabled of [false, true]) {
  const stories = await open({ width: 390, theme: 'light', javascriptEnabled });
  await check(`Singapore stories keyboard focus and article navigation, JS ${javascriptEnabled ? 'on' : 'off'}`, async () => {
    const model = models.find(item => item.raceId === '2026-singapore-gp');
    assert.equal((await stories.page.goto(origin + model.path, { waitUntil: 'domcontentloaded' })).status(), 200); await ready(stories.page);
    const link = stories.page.locator('.race-desk-stories li h3 > a').first();
    await stories.page.locator('.race-desk-skip').focus();
    let focused = false;
    for (let i = 0; i < 100; i++) {
      await stories.page.keyboard.press('Tab');
      if (await link.evaluate(el => document.activeElement === el)) { focused = true; break; }
    }
    assert.ok(focused, 'first story must be reachable by Tab');
    assert.ok(await link.evaluate(el => el.matches(':focus-visible') && parseFloat(getComputedStyle(el).outlineWidth) > 0), 'story focus must have a visible outline');
    assert.ok(await link.evaluate(el => { const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return top === el || el.contains(top); }), 'focused story link must not be covered');
    const href = new URL(await link.getAttribute('href'), 'https://f1-stories.gr').href; assert.equal(href, storyHref(storyIds[model.raceId][0]));
    const response = await stories.page.goto(origin + new URL(href).pathname, { waitUntil: 'domcontentloaded' });
    assert.equal(response.status(), 200);
    assert.equal(await stories.page.locator('link[rel="canonical"]').getAttribute('href'), href);
    await stories.page.goBack({ waitUntil: 'domcontentloaded' });
    assert.deepEqual(await stories.page.locator('.race-desk-stories li h3 > a').evaluateAll(nodes => nodes.map(node => new URL(node.getAttribute('href'), 'https://f1-stories.gr').href)), storyIds[model.raceId].map(storyHref));
    assert.deepEqual(stories.errors, []);
  });
  await stories.context.close();
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
    await schedule.page.goto(origin + models.find(model => model.raceId === '2026-japanese-gp').path, { waitUntil: 'domcontentloaded' }); await ready(schedule.page);
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
    const resultsRegion = schedule.page.locator('.gp-results-table-wrap').first();
    assert.ok(await schedule.page.locator('.gp-results-hint').first().isVisible());
    assert.equal(await resultsRegion.getAttribute('tabindex'), '0');
    await resultsRegion.focus(); await schedule.page.keyboard.press('ArrowRight'); await schedule.page.waitForTimeout(250);
    assert.ok(await resultsRegion.evaluate(el => el.scrollLeft > 0), 'ArrowRight must scroll results');
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
