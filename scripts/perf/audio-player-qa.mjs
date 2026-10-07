#!/usr/bin/env node
// audio-player-qa.mjs - behaviour and layout check for the navbar BetCast player (scripts/shared-nav.js).
//
// Serves the working tree (or --root=dist) and drives it in Chrome with the podcast feed and the audio
// endpoint mocked, so it needs no network. Asserts:
//   label      the player always reads ON AIR. (no title, no live state), a bad or empty feed still does
//   fill       the box fills as the episode plays, holds when paused, survives a page change, empties at the end
//   no video   no iframe/video/img inside the player, no YouTube request of any kind, no YouTube Player API
//   audio      no media request before a click, click plays an <audio>, second click pauses, Space/Enter work,
//              a failing stream restores the play state, a missing or non-https audioUrl shows the note and plays nothing
//   a11y       Greek aria-labels, 44px minimum control, contrast >= 4.5:1 in both themes
//   layout     no overlap, nothing past the viewport at 1440/768/430/390/375 in both themes
//
//   npm run qa:audio-player            flags: --root=dist  --json

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
const FEED_URL = 'https://anchor.fm/s/101588098/podcast/rss';
const AUDIO_URL = 'https://audio.f1stories.test/stream.wav';
const OLDER_URL = 'https://audio.f1stories.test/older-episode.wav';
const WIDTHS = [768, 430, 390, 375];
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

// 10 s of 8 kHz silence: a real, decodable stream for the mocked endpoint.
function silentWav(samples = 80000) {
    const header = Buffer.alloc(44);
    header.write('RIFF', 0); header.writeUInt32LE(36 + samples, 4); header.write('WAVEfmt ', 8);
    header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
    header.writeUInt32LE(8000, 24); header.writeUInt32LE(8000, 28); header.writeUInt16LE(1, 32); header.writeUInt16LE(8, 34);
    header.write('data', 36); header.writeUInt32LE(samples, 40);
    return Buffer.concat([header, Buffer.alloc(samples, 128)]);
}

const luminance = ([r, g, b]) => [r, g, b].map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; })
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const rgb = css => (css.match(/[\d.]+/g) || []).slice(0, 3).map(Number);

// Opens the page with a mocked podcast feed. meta: object | string (raw body) | null (HTTP 500).
async function open(browser, origin, { meta, theme = 'dark', width = 1440, audio = 'ok', pagePath = '/authors/' }) {
    const context = await browser.newContext({ viewport: { width, height: 800 } });
    await context.addInitScript(([themeValue]) => {
        try { localStorage.setItem('f1stories-theme', themeValue); } catch (_) {}
        const Original = window.Audio;
        window.__audios = [];
        window.Audio = function () { const instance = new Original(...arguments); window.__audios.push(instance); return instance; };
    }, [theme]);
    const page = await context.newPage();
    const requests = [];
    const errors = [];
    page.on('request', request => requests.push(request.url()));
    page.on('pageerror', error => errors.push(error.message));
    // The podcast feed (newest episode first). meta: { audioUrl } builds one, a string is served raw, null is HTTP 500.
    await page.route(FEED_URL, route => {
        const cors = { 'access-control-allow-origin': '*' };
        if (meta === null) return route.fulfill({ status: 500, headers: cors, body: 'boom' });
        const xml = typeof meta === 'string' ? meta
            : `<?xml version="1.0"?><rss><channel><title>F1 Stories</title>${meta.audioUrl === undefined ? '' : `<item><title>Newest</title>${meta.audioUrl ? `<enclosure url="${meta.audioUrl}" type="audio/mpeg"/>` : ''}</item>`}<item><title>Older</title><enclosure url="${OLDER_URL}" type="audio/mpeg"/></item></channel></rss>`;
        return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/rss+xml' }, body: xml });
    });
    await page.route(AUDIO_URL, route => {
        requests.push(AUDIO_URL); // media requests are not always reported by the request event once routed
        if (audio === 'fail') return route.fulfill({ status: 404, body: 'gone' });
        const body = silentWav(audio === 'short' ? 4000 : 80000);
        // Real audio hosts answer byte ranges; without that a browser cannot seek, which resuming relies on.
        const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers().range || '');
        if (range) {
            const start = Number(range[1]);
            const end = range[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
            return route.fulfill({ status: 206, headers: { 'content-type': 'audio/wav', 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${body.length}` }, body: body.subarray(start, end + 1) });
        }
        return route.fulfill({ status: 200, headers: { 'content-type': 'audio/wav', 'accept-ranges': 'bytes' }, body });
    });
    await page.goto(`${origin}${pagePath}`, { waitUntil: 'load' });
    await page.waitForSelector('.nav-audio');
    await page.waitForLoadState('networkidle').catch(() => {});
    return { context, page, requests, errors };
}

const snapshot = page => page.evaluate(() => {
    const root = document.querySelector('.nav-audio');
    const button = root.querySelector('.nav-audio-btn');
    return {
        aria: button.getAttribute('aria-label'),
        active: root.classList.contains('is-active'),
        note: root.querySelector('.nav-audio-note').textContent,
        text: root.querySelector('.nav-audio-word').textContent.trim(),
        progress: parseFloat(getComputedStyle(root).getPropertyValue('--p')) || 0,
        media: root.querySelectorAll('img, iframe, video, picture, svg').length,
        audios: window.__audios.length,
        paused: window.__audios[0] ? window.__audios[0].paused : null,
        preload: window.__audios[0] ? window.__audios[0].preload : null,
        controls: window.__audios[0] ? window.__audios[0].controls : null
    };
});

const youtube = requests => requests.some(url => /youtube|ytimg|googlevideo/.test(url));
const audioHit = requests => requests.some(url => url.includes('audio.f1stories.test'));

async function behaviourChecks(browser, origin) {
    const player = await open(browser, origin, { meta: { audioUrl: AUDIO_URL } });
    let s = await snapshot(player.page);
    check('player reads exactly ON AIR.', s.text === 'ON AIR.', s.text);
    check('the box starts empty', s.progress === 0, String(s.progress));
    check('paused aria-label', s.aria === 'Αναπαραγωγή BetCast, ON AIR', s.aria);
    check('no audio element or media request before click', s.audios === 0 && !audioHit(player.requests));
    check('no video, thumbnail or iframe in the player', s.media === 0);
    check('no YouTube requests or Player API', !youtube(player.requests));
    check('no iframe on the page', await player.page.evaluate(() => document.querySelectorAll('iframe').length) === 0);
    check('no autoplay', s.paused === null);
    check('no page errors', player.errors.length === 0, player.errors.join('; '));

    await player.page.click('.nav-audio-btn');
    await player.page.waitForFunction(() => window.__audios[0] && !window.__audios[0].paused);
    s = await snapshot(player.page);
    check('click plays an HTMLAudioElement without native controls', s.audios === 1 && s.paused === false && s.preload === 'none' && s.controls === false, JSON.stringify(s));
    check('playing shows the pause label', s.active && s.aria === 'Παύση BetCast, ON AIR', s.aria);
    for (let i = 0; i < 30 && !audioHit(player.requests); i++) await player.page.waitForTimeout(100);
    check('audio requested only after the click', audioHit(player.requests));
    check('only the newest episode plays, never an older one', !player.requests.some(url => url.includes('older-episode')));
    check('still no YouTube after play', !youtube(player.requests));
    await player.page.click('.nav-audio-btn');
    s = await snapshot(player.page);
    check('second click pauses', s.paused === true && !s.active && s.aria === 'Αναπαραγωγή BetCast, ON AIR', JSON.stringify(s));
    await player.context.close();

    const keys = await open(browser, origin, { meta: { audioUrl: AUDIO_URL } });
    await keys.page.focus('.nav-audio-btn');
    await keys.page.keyboard.press('Space');
    await keys.page.waitForFunction(() => window.__audios[0] && !window.__audios[0].paused);
    s = await snapshot(keys.page);
    check('Space starts playback', s.active && s.aria === 'Παύση BetCast, ON AIR', s.aria);
    await keys.page.keyboard.press('Enter');
    s = await snapshot(keys.page);
    check('Enter pauses playback', !s.active && s.paused === true);
    await keys.context.close();

    for (const [name, meta] of [['malformed feed', '{not xml'], ['feed HTTP 500', null], ['non-https enclosure', { audioUrl: 'http://x.test/a.mp3' }], ['newest item without audio', { audioUrl: '' }], ['YouTube enclosure', { audioUrl: 'https://rr1---sn.googlevideo.com/x.mp3' }]]) {
        const bad = await open(browser, origin, { meta });
        await bad.page.click('.nav-audio-btn');
        s = await snapshot(bad.page);
        check(`${name}: still ON AIR., explains, plays nothing`, s.text === 'ON AIR.' && s.note !== '' && !s.active && s.audios === 0 && s.progress === 0, JSON.stringify(s));
        check(`${name}: no page error and no YouTube`, bad.errors.length === 0 && !youtube(bad.requests), bad.errors.join('; '));
        await bad.context.close();
    }

    const failing = await open(browser, origin, { meta: { audioUrl: AUDIO_URL }, audio: 'fail' });
    await failing.page.click('.nav-audio-btn');
    await failing.page.waitForFunction(() => !document.querySelector('.nav-audio').classList.contains('is-active') && document.querySelector('.nav-audio-note').textContent !== '', null, { timeout: 5000 }).catch(() => {});
    s = await snapshot(failing.page);
    check('audio failure restores the play state', !s.active && s.aria === 'Αναπαραγωγή BetCast, ON AIR' && s.note !== '', JSON.stringify(s));
    check('audio failure raises no page error', failing.errors.length === 0, failing.errors.join('; '));
    await failing.context.close();
}

const playing = page => page.waitForFunction(() => window.__audios[0] && !window.__audios[0].paused && window.__audios[0].currentTime > 0.3, null, { timeout: 8000 });

// Pages are separate documents: a listener who pressed play continues on the next page, nothing else ever starts.
async function persistenceChecks(browser, origin) {
    const { context, page, errors } = await open(browser, origin, { meta: { audioUrl: AUDIO_URL }, pagePath: '/authors/' });
    await page.click('.nav-audio-btn');
    await playing(page);
    await page.waitForTimeout(1300); // let the throttled progress save run
    const filling = (await snapshot(page)).progress;
    check('the box fills while the episode plays', filling > 3 && filling < 100, String(filling));
    await page.goto(`${origin}/`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__audios[0] && !window.__audios[0].paused, null, { timeout: 8000 }).catch(() => {});
    let s = await snapshot(page);
    check('playback continues on the next page without a click', s.audios === 1 && s.paused === false && s.active && s.aria === 'Παύση BetCast, ON AIR', JSON.stringify(s));
    check('resumed position is not back at the start', await page.evaluate(() => window.__audios[0].currentTime) > 0.5);
    check('the box is already filled on the next page', s.progress >= filling - 1, `${s.progress} vs ${filling}`);

    await page.click('.nav-audio-btn');
    await page.waitForTimeout(400); // the pause itself queues one last timeupdate
    const held = (await snapshot(page)).progress;
    await page.waitForTimeout(700);
    check('paused: the fill holds', held > 0 && (await snapshot(page)).progress === held, String(held));
    await page.goto(`${origin}/standings/`, { waitUntil: 'load' });
    await page.waitForTimeout(600);
    s = await snapshot(page);
    check('a paused player stays paused on the next page', s.audios === 0 && !s.active && s.aria === 'Αναπαραγωγή BetCast, ON AIR', JSON.stringify(s));
    check('a paused player keeps its fill on the next page', Math.abs(s.progress - held) < 1.5, `${s.progress} vs ${held}`);
    await page.click('.nav-audio-btn');
    await playing(page);
    check('play after navigating continues the same episode', (await snapshot(page)).active);

    await context.addInitScript(() => { HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('blocked', 'NotAllowedError')); });
    await page.goto(`${origin}/authors/`, { waitUntil: 'load' });
    await page.waitForTimeout(600);
    s = await snapshot(page);
    check('a browser-blocked resume falls back to paused without noise', !s.active && s.aria === 'Αναπαραγωγή BetCast, ON AIR' && s.note === '' && errors.length === 0, JSON.stringify(s) + errors.join('; '));
    await context.close();

    const ending = await open(browser, origin, { meta: { audioUrl: AUDIO_URL }, audio: 'short', pagePath: '/authors/' });
    await ending.page.click('.nav-audio-btn');
    await ending.page.waitForFunction(() => window.__audios[0] && window.__audios[0].ended, null, { timeout: 8000 }).catch(() => {});
    s = await snapshot(ending.page);
    check('when the episode ends the player stops, empties and starts nothing else', s.audios === 1 && !s.active && s.paused === true && s.progress === 0 && s.aria === 'Αναπαραγωγή BetCast, ON AIR', JSON.stringify(s));
    await ending.page.goto(`${origin}/`, { waitUntil: 'load' });
    await ending.page.waitForTimeout(600);
    s = await snapshot(ending.page);
    check('a finished episode does not resume on the next page', s.audios === 0 && !s.active, JSON.stringify(s));
    await ending.context.close();

    const stale = await open(browser, origin, { meta: { audioUrl: AUDIO_URL }, pagePath: '/authors/' });
    await stale.page.evaluate(() => sessionStorage.setItem('f1stories-audio', JSON.stringify({ url: 'https://audio.f1stories.test/previous-episode.mp3', playing: true, time: 30, at: Date.now() })));
    await stale.page.goto(`${origin}/`, { waitUntil: 'load' });
    await stale.page.waitForTimeout(600);
    s = await snapshot(stale.page);
    check('a different (older) episode never resumes', s.audios === 0 && !s.active, JSON.stringify(s));
    await stale.context.close();
}

async function layoutChecks(browser, origin) {
    for (const theme of ['dark', 'light']) {
        for (const width of [1440, ...WIDTHS]) {
            const { context, page } = await open(browser, origin, { meta: { audioUrl: AUDIO_URL }, theme, width, pagePath: '/' });
            const r = await page.evaluate(() => {
                const box = selector => { const el = document.querySelector(selector); if (!el || getComputedStyle(el).display === 'none') return null; const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, w: b.width, h: b.height }; };
                const parts = ['.blog-nav-brand', '.nav-audio', '.blog-nav-countdown', '.blog-nav-countdown-mobile', '.theme-toggle-nav-btn', '.blog-nav-hamburger'].map(box).filter(Boolean).sort((a, b) => a.l - b.l);
                const buttonEl = document.querySelector('.nav-audio-btn');
                const base = buttonEl.querySelector('.nav-audio-face:not(.nav-audio-face--fill)');
                const fill = buttonEl.querySelector('.nav-audio-face--fill');
                const word = el => el.querySelector('.nav-audio-word');
                const ham = box('.blog-nav-hamburger');
                const nav = document.querySelector('.blog-nav-inner').getBoundingClientRect();
                const b = buttonEl.getBoundingClientRect();
                return {
                    overlap: parts.some((part, i) => i && part.l < parts[i - 1].r - 1),
                    size: { w: b.width, h: b.height },
                    flush: Math.abs(b.right - document.documentElement.clientWidth) < 0.5,
                    fullHeight: Math.abs(b.height - nav.height) < 1.5,
                    past: Math.max(...parts.map(part => part.r)) - document.documentElement.clientWidth,
                    hamburgerInside: ham ? ham.r <= document.documentElement.clientWidth : true,
                    // Both faces carry the label, so both pairings must read: paper on ink underneath, ink on red on top.
                    baseColor: getComputedStyle(base).color, baseBg: getComputedStyle(buttonEl).backgroundColor,
                    fillColor: getComputedStyle(fill).color, fillBg: getComputedStyle(fill).backgroundColor,
                    clipped: word(base).scrollWidth > word(base).clientWidth || base.scrollWidth > base.clientWidth + 1,
                    wide: b.left >= 0
                };
            });
            const where = `${theme} ${width}px`;
            check(`${where}: no overlap in the masthead`, !r.overlap);
            check(`${where}: nothing past the viewport`, r.past <= 0.5 && r.hamburgerInside, `past=${r.past}`);
            check(`${where}: play control >= 44x44`, r.size.w >= 44 && r.size.h >= 44, `${r.size.w}x${r.size.h}`);
            if (width >= 992) check(`${where}: end-cap is flush right at full masthead height`, r.flush && r.fullHeight, `flush=${r.flush} full=${r.fullHeight}`);
            check(`${where}: label not clipped`, !r.clipped);
            check(`${where}: label on the ink face >= 4.5`, contrast(rgb(r.baseColor), rgb(r.baseBg)) >= 4.5, contrast(rgb(r.baseColor), rgb(r.baseBg)).toFixed(2));
            check(`${where}: label on the red fill >= 4.5`, contrast(rgb(r.fillColor), rgb(r.fillBg)) >= 4.5, contrast(rgb(r.fillColor), rgb(r.fillBg)).toFixed(2));
            await context.close();
        }
    }
}

async function main() {
    const executablePath = process.env.CHROME_PATH || Launcher.getFirstInstallation();
    if (!executablePath) throw new Error('No Chrome install found; set CHROME_PATH.');
    const { server, origin } = await startServer();
    const browser = await chromium.launch({ executablePath, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
    try {
        await behaviourChecks(browser, origin);
        await persistenceChecks(browser, origin);
        await layoutChecks(browser, origin);
    } finally {
        await browser.close();
        server.close();
    }
    if (process.argv.includes('--json')) console.log(JSON.stringify({ passed, failures }, null, 2));
    else {
        console.log(`audio-player-qa: ${passed} checks passed, ${failures.length} failed.`);
        failures.forEach(failure => console.log(`  FAIL ${failure}`));
    }
    process.exit(failures.length ? 1 : 0);
}

main().catch(error => { console.error(error.stack || error.message || error); process.exit(1); });
