#!/usr/bin/env node
// countdown-qa.mjs - behaviour check for the masthead race countdown (scripts/shared-nav.js).
//
// Serves the working tree (or --root=dist) and drives it in Chrome with a fixed clock and the Jolpica schedule
// request aborted or mocked, so it needs no network and does not depend on the production API failing. Asserts:
//   fallback   with the API down, the countdown targets the right 2026 race START, including round 16 (Malaysia) and the
//              rounds whose start instants were wrong (AUS, CAN, USA, Las Vegas, Qatar)
//   target     the container says what it counts down to (race start, in the visitor's own time zone) for tooltips and
//              screen readers, and marks a schedule that the live API has not confirmed
//   zones      the countdown is the same absolute duration whatever the visitor's time zone; only the label's clock changes
//   live       a successful schedule replaces the fallback and is marked live; it is not a fixed 12:00 guess
//   season end after the last race no stale target label is left behind
//
//   npm run qa:countdown            flags: --root=dist

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
const SCHEDULE_URL = '**/api.jolpi.ca/ergast/f1/*.json';
const MIME = new Map([['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'], ['.webp', 'image/webp'], ['.png', 'image/png'], ['.svg', 'image/svg+xml; charset=utf-8'],
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

async function readCountdown(browser, origin, { now, schedule, timezoneId = 'UTC' }) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId, locale: 'el-GR' });
    const page = await context.newPage();
    await page.route(SCHEDULE_URL, route => (schedule ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(schedule) }) : route.abort()));
    await page.clock.setFixedTime(new Date(now));
    await page.goto(`${origin}/`, { waitUntil: 'load' });
    await page.waitForTimeout(500);
    const state = await page.evaluate(() => {
        const text = id => (document.getElementById(id) || {}).textContent || '';
        const root = document.getElementById('nav-countdown');
        const mobile = document.getElementById('nav-countdown-mobile');
        return {
            name: text('next-race-name'), flag: text('race-flag-emoji'), timer: text('race-countdown'), mobileTimer: text('race-countdown-mobile'),
            label: root && root.getAttribute('aria-label'), title: root && root.getAttribute('title'), role: root && root.getAttribute('role'),
            source: root && root.getAttribute('data-calendar-source'), mobileLabel: mobile && mobile.getAttribute('aria-label'),
        };
    });
    await context.close();
    return state;
}

const browser = await chromium.launch({ executablePath: Launcher.getFirstInstallation(), headless: true });
const { server, origin } = await startServer();
try {
    // fallback: the rounds that used to be wrong or missing
    const cases = [
        ['2026-10-01T00:00:00Z', 'Bahrain GP in Malaysia', '3d 7h 0m', 'round 16 exists (was skipped straight to Singapore)'],
        ['2026-10-08T12:00:00Z', 'Singapore GP', '3d 0h 0m', 'Singapore race start'],
        ['2026-10-18T00:00:00Z', 'US GP', '7d 20h 0m', 'US GP starts 20:00Z (15:00 CDT), not 19:00Z'],
        ['2026-11-21T12:00:00Z', 'Las Vegas GP', '16h 0m 0s', 'Las Vegas starts 04:00Z on the 22nd (20:00 PST on the 21st)'],
        ['2026-11-28T00:00:00Z', 'Qatar GP', '1d 16h 0m', 'Qatar starts 16:00Z (19:00 local)'],
        ['2026-03-07T00:00:00Z', 'Australian GP', '1d 4h 0m', 'Australia starts 04:00Z (15:00 AEDT)'],
        ['2026-05-24T00:00:00Z', 'Canadian GP', '20h 0m 0s', 'Canada starts 20:00Z (16:00 EDT)'],
    ];
    for (const [now, name, timer, why] of cases) {
        const state = await readCountdown(browser, origin, { now, schedule: null });
        check(`fallback ${now}: ${name}`, state.name === name && state.timer === timer, `${why}; got "${state.name}" "${state.timer}"`);
        check(`fallback ${now}: marked as stored schedule`, state.source === 'fallback' && /αποθηκευμένο πρόγραμμα/.test(state.label || ''), `source=${state.source}`);
    }

    // target label: race start, in the visitor's zone, on both containers
    const athens = await readCountdown(browser, origin, { now: '2026-10-01T00:00:00Z', schedule: null, timezoneId: 'Europe/Athens' });
    const la = await readCountdown(browser, origin, { now: '2026-10-01T00:00:00Z', schedule: null, timezoneId: 'America/Los_Angeles' });
    check('label names the race start', /^Αγώνας: Bahrain GP in Malaysia · έναρξη /.test(athens.label || ''), athens.label);
    check('label, title and role are set, mobile root labelled too', athens.title === athens.label && athens.role === 'group' && athens.mobileLabel === athens.label);
    check('Athens label shows local race time 10:00 (UTC+3)', /10:00/.test(athens.label || '') && /GMT\+0?3/.test(athens.label || ''), athens.label);
    check('Los Angeles label shows local race time 00:00 (UTC-7)', /00:00/.test(la.label || '') && /GMT-0?7/.test(la.label || ''), la.label);
    check('duration is identical in every time zone', athens.timer === la.timer && athens.timer === '3d 7h 0m', `${athens.timer} vs ${la.timer}`);

    // live schedule replaces the fallback and is marked live
    const liveRace = (round, raceName, country, date, time) => ({ round: String(round), raceName, date, time, Circuit: { Location: { country } } });
    const live = { MRData: { RaceTable: { Races: [
        liveRace(16, 'Bahrain Grand Prix in Malaysia', 'Malaysia', '2026-10-04', '07:00:00Z'),
        liveRace(17, 'Singapore Grand Prix', 'Singapore', '2026-10-11', '12:00:00Z'),
    ] } } };
    const liveState = await readCountdown(browser, origin, { now: '2026-10-08T12:00:00Z', schedule: live });
    check('live schedule is used and marked live', liveState.source === 'live' && liveState.name === 'Singapore GP' && !/αποθηκευμένο/.test(liveState.label || ''), JSON.stringify(liveState));
    const flagState = await readCountdown(browser, origin, { now: '2026-10-01T00:00:00Z', schedule: live });
    check('live Malaysia round gets its flag, not the generic chequered flag', flagState.source === 'live' && flagState.name === 'Bahrain GP in Malaysia' && flagState.flag === '\u{1F1F2}\u{1F1FE}', flagState.flag);

    // after the final race: no stale target label
    const over = await readCountdown(browser, origin, { now: '2026-12-07T00:00:00Z', schedule: null });
    check('season end text', /ολοκληρώθηκε/.test(over.name), over.name);
    check('season end leaves no stale label', !over.label && !over.title, `${over.label}`);
} finally {
    server.close();
    await browser.close();
}

console.log(`countdown-qa: ${passed} checks passed, ${failures.length} failed`);
for (const failure of failures) console.log(`  FAIL ${failure}`);
process.exit(failures.length ? 1 : 0);
