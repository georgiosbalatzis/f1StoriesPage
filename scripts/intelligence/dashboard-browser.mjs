#!/usr/bin/env node
// Browser regression for /dashboard/: every state, on a local server with a synthetic encrypted snapshot.
// Fails on any request that leaves the page's origin, any CSP violation, any stored value, or the key in a request.
//   node scripts/intelligence/dashboard-browser.mjs [--screenshots=<dir>]
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { Launcher } from 'chrome-launcher';
import { install, refresh, sealSnapshot, snapshotWindow, windowDays } from './snapshot.mjs';
import { fakeClient, syntheticRows } from './__tests__/snapshot-fixture.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const shots = process.argv.find(arg => arg.startsWith('--screenshots='))?.slice('--screenshots='.length);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };
const key = crypto.randomBytes(32).toString('base64');

// Daily refreshes ending at `now`, each reading the one before, as on main. One day: no discovery yet (the I-06C2
// seven-model shape). Two days: a weekly discovery day (RUM carried). Three days: discovery carried, one day old.
async function seal(now, days = 1) {
    const env = { DASHBOARD_SNAPSHOT_KEY: key, BIGQUERY_ACCESS_TOKEN: 'synthetic',
        WIF_PROVIDER: 'projects/1/locations/global/workloadIdentityPools/p/providers/p', WIF_SERVICE_ACCOUNT: 'snapshot@f1-stories-analytics.iam.gserviceaccount.com' };
    const scratch = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR || '/tmp'), 'f1s-dash-'));
    let text;
    for (let i = days - 1; i >= 0; i--) {
        const at = new Date(now.getTime() - i * 86400000);
        text = await refresh({ mode: 'refresh', enabled: true, root: scratch, env, now: at, client: fakeClient(snapshotWindow(at)), log: () => {} });
        install(text, scratch);
    }
    return text;
}
const withoutDiscovery = models => {
    delete models['13-article-discovery'];
    delete models['28-internal-navigation'];
    return models;
};

const fresh = await seal(new Date());
const freshDays = windowDays(snapshotWindow(new Date()));
// The last I-06B encrypted snapshot contains only four models; it must still render after deployment.
const legacy = (() => {
    const now = new Date(), window = snapshotWindow(now), models = withoutDiscovery(syntheticRows(window));
    delete models['10-article-pageviews'];
    delete models['26-acquisition-session'];
    delete models['29-audience-coverage'];
    const generatedAt = now.toISOString();
    return sealSnapshot({ format: 'f1s-dashboard-snapshot-payload', v: 1, generatedAt,
        window: { ...window, timezone: 'America/Los_Angeles' }, minEvents: 30, minObservations: 30, models },
    Buffer.from(key, 'base64'), { generatedAt, window });
})();
// A five-model I-06C1 snapshot has article rankings but no acquisition yet.
const editorialOnly = (() => {
    const now = new Date(), window = snapshotWindow(now), models = withoutDiscovery(syntheticRows(window));
    delete models['26-acquisition-session'];
    delete models['29-audience-coverage'];
    const generatedAt = now.toISOString();
    return sealSnapshot({ format: 'f1s-dashboard-snapshot-payload', v: 1, generatedAt,
        window: { ...window, timezone: 'America/Los_Angeles' }, minEvents: 30, minObservations: 30, models },
    Buffer.from(key, 'base64'), { generatedAt, window });
})();
const discoveryDay = await seal(new Date(), 2);
const discoveryCarried = await seal(new Date(), 3);
const fourDays = await seal(new Date('2026-10-26T23:00:00Z')); // as_of 26 Oct: 19–22 Oct, all the export has
const stale = await seal(new Date(Date.now() - 3 * 86400000));
const tampered = (() => {
    const envelope = JSON.parse(fresh);
    const data = Buffer.from(envelope.data, 'base64');
    data[0] ^= 1;
    return JSON.stringify({ ...envelope, data: data.toString('base64') });
})();

let snapshot = null;
const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/dashboard/data/snapshot.json') {
        if (snapshot === null) { res.writeHead(404); res.end(); return; }
        res.setHeader('content-type', 'application/json');
        res.end(snapshot);
        return;
    }
    const file = path.join(root, pathname.endsWith('/') ? `${pathname}index.html` : pathname);
    if (!file.startsWith(`${root}/`) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.setHeader('content-type', TYPES[path.extname(file)] || 'application/octet-stream');
    res.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({ executablePath: Launcher.getFirstInstallation(), headless: true, args: ['--no-sandbox'] });
let checks = 0;

async function open(body, { width = 390, scheme = 'dark' } = {}) {
    snapshot = body;
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    const requests = [], problems = [];
    await page.setViewport({ width, height: 844 });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
    page.on('request', request => requests.push({ url: request.url(), body: request.postData() || '' }));
    page.on('pageerror', error => problems.push(error.message));
    page.on('console', message => {
        if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) problems.push(message.text());
    });
    await page.goto(`${origin}/dashboard/`, { waitUntil: 'networkidle0' });
    return { page, context, requests, problems };
}

const visible = (page, state) => page.$eval(`[data-state="${state}"]`, element => !element.hidden);

async function finish({ page, context, requests, problems }, label) {
    assert.deepEqual(problems, [], `${label}: page errors or CSP violations`);
    for (const request of requests) {
        assert.ok(request.url.startsWith(`${origin}/`), `${label}: request left the origin: ${request.url}`);
        assert.ok(!request.url.includes(encodeURIComponent(key)) && !request.url.includes(key) && !request.body.includes(key), `${label}: key in a request`);
    }
    assert.equal(requests.filter(request => request.url === `${origin}/dashboard/data/snapshot.json`).length, 1, `${label}: one snapshot request`);
    const stored = await page.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie]);
    assert.deepEqual(stored, [0, 0, ''], `${label}: nothing stored`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${label}: no horizontal overflow`);
    await context.close();
    checks++;
}

async function unlock(page, value) {
    await page.type('#dash-key', value);
    await page.click('.dash-form button');
    await page.waitForFunction(() => document.querySelector('[data-key-error]').hidden === false
        || !document.querySelector('[data-state="report"]').hidden || !document.querySelector('[data-state="damaged"]').hidden
        || !document.querySelector('[data-state="unavailable"]').hidden);
}

try {
    let session = await open(null);
    assert.ok(await visible(session.page, 'empty'), 'no snapshot yet: empty state');
    await finish(session, 'empty');

    session = await open('{"not":"an envelope"}');
    assert.ok(await visible(session.page, 'unavailable'), 'malformed snapshot: unavailable state');
    await finish(session, 'malformed');

    session = await open(fresh);
    assert.ok(await visible(session.page, 'locked'), 'snapshot present: locked state');
    await unlock(session.page, crypto.randomBytes(32).toString('base64'));
    assert.match(await session.page.$eval('[data-key-error]', element => element.textContent), /Λάθος κλειδί/);
    assert.ok(await visible(session.page, 'locked'), 'wrong key: still locked');
    assert.equal(await session.page.$eval('#dash-key', element => element.value), '', 'the key field is cleared');
    await unlock(session.page, key);
    const page = session.page;
    assert.ok(await visible(page, 'report'), 'right key: report');
    const report = await page.evaluate(() => ({
        title: document.getElementById('report-title').textContent,
        window: document.querySelector('[data-field="window"]').textContent,
        updated: document.querySelector('[data-field="updated"]').textContent,
        stale: document.querySelector('[data-stale]').hidden,
        days: document.querySelectorAll('[data-chart="activity"] rect').length,
        small: document.querySelectorAll('[data-chart="activity"] rect.is-small').length,
        categories: [...document.querySelectorAll('.dash-bars-label')].map(element => element.textContent),
        articles: [...document.querySelectorAll('[data-table="articles"] tbody tr')].map(element => element.cells[0].textContent),
        articleScripts: document.querySelectorAll('[data-table="articles"] script').length,
        acquisition: [...document.querySelectorAll('[data-table="acquisition"] tbody tr')].map(el => el.cells[0].textContent),
        acquisitionWindow: document.querySelector('[data-field="acquisition-window"]').textContent,
        acquisitionWarnings: [...document.querySelectorAll('[data-list="acquisition-quality"] li')].map(el => el.textContent),
        unmapped: document.querySelector('[data-table="articles"] .dash-copy')?.textContent || '',
        injected: document.querySelectorAll('[data-state="report"] b').length,
        cwv: document.querySelectorAll('[data-table="cwv"] tbody tr').length,
        warnings: document.querySelectorAll('[data-list="rum"] .is-warning').length,
        notes: document.querySelector('.dash-notes').textContent,
        discoveryWindow: document.querySelector('[data-field="discovery-window"]').textContent,
        discoveryPending: document.querySelector('[data-table="discovery-surfaces"]').textContent,
        cwvCarried: document.querySelector('[data-field="cwv-carried"]').hidden
    }));
    assert.match(report.title, /^Στοιχεία έως \d{1,2} [^\s]+ \d{4}$/);
    assert.match(report.updated, /Τελευταία επιτυχής ενημέρωση/);
    assert.equal(report.stale, true, 'a fresh snapshot shows no stale warning');
    assert.equal(report.days, freshDays);
    assert.match(report.window, freshDays === 28 ? /^Τελευταίες 28 πλήρεις ημέρες · / : new RegExp(`^${freshDays} πλήρεις? ημέρ.ς, όσες υπάρχουν από την έναρξη της εξαγωγής · `));
    assert.ok(report.small > 0, 'small-sample days are marked');
    assert.deepEqual(report.categories, ['Ανάλυση', 'Ιστορία <b>', '(unmapped)']);
    assert.deepEqual(report.articles, ['Ταχύτερος γύρος', 'Ειδήσεις <script>alert(1)</script>']);
    assert.equal(report.articleScripts, 0, 'article metadata is always rendered as text, never HTML');
    assert.deepEqual(report.acquisition, ['organic_search', 'direct', 'referral', 'unattributed']);
    assert.ok(report.acquisitionWarnings.some(item => item.includes('μη αποδοθέν')), 'attribution quality is visible');
    assert.match(report.acquisitionWindow, /–/);
    assert.match(report.unmapped, /2 προβολές σε μη αντιστοιχισμένα άρθρα/);
    assert.equal(report.injected, 0, 'snapshot text is never parsed as HTML');
    assert.equal(report.cwv, 9, 'LCP, INP and CLS for three coverage classes');
    assert.ok(report.warnings >= 1, 'the synthetic conflict is flagged');
    assert.match(report.notes, /συναίνεση[\s\S]*γεγονότα[\s\S]*30/);
    // A seven-model snapshot without discovery (the first day, or any pre-I-06C3 snapshot): pending, nothing else breaks.
    assert.equal(report.discoveryWindow, 'σε αναμονή');
    assert.match(report.discoveryPending, /μία φορά την εβδομάδα/);
    assert.equal(report.cwvCarried, true, 'RUM ran today: no carried label');
    if (shots) {
        fs.mkdirSync(shots, { recursive: true });
        await page.screenshot({ path: path.join(shots, 'dashboard-mobile-dark.png'), fullPage: true });
    }
    await page.click('[data-lock]');
    assert.ok(await visible(page, 'locked'), 'lock returns to the key form');
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('[data-chart], [data-table], [data-list]')].every(element => !element.children.length)), true,
        'locking removes every decrypted value');
    await finish(session, 'fresh');

    if (shots) {
        session = await open(fresh, { width: 1280, scheme: 'light' });
        await unlock(session.page, key);
        await session.page.screenshot({ path: path.join(shots, 'dashboard-desktop-light.png'), fullPage: true });
        await finish(session, 'desktop light');
    }

    session = await open(legacy);
    await unlock(session.page, key);
    assert.ok(await visible(session.page, 'report'), 'the old four-model snapshot must still open');
    assert.match(await session.page.$eval('[data-table="articles"]', el => el.textContent), /με το επόμενο ημερήσιο στιγμιότυπο/);
    await finish(session, 'legacy snapshot');

    session = await open(editorialOnly);
    await unlock(session.page, key);
    assert.ok(await visible(session.page, 'report'), 'five-model snapshot remains valid');
    assert.match(await session.page.$eval('[data-table="acquisition"]', el => el.textContent), /με την επόμενη επιτυχημένη ημερήσια ανανέωση/);
    await finish(session, 'editorial-only legacy');

    // I-06C3 discovery day: discovery ran today over the primary window; the RUM pair is labelled as carried.
    for (const [width, scheme] of [[390, 'dark'], [1280, 'light']]) {
        session = await open(discoveryDay, { width, scheme });
        await unlock(session.page, key);
        const discovery = await session.page.evaluate(() => {
            const rows = name => [...document.querySelectorAll(`[data-table="${name}"] tbody tr`)].map(tr => [...tr.cells].map(td => td.textContent));
            return {
                heading: document.getElementById('discovery-title').textContent,
                window: document.querySelector('[data-field="discovery-window"]').textContent,
                freshness: document.querySelector('[data-field="discovery-freshness"]').textContent,
                surfaces: rows('discovery-surfaces'), sections: rows('discovery-sections'),
                articles: rows('discovery-articles'), transitions: rows('discovery-transitions'),
                unmapped: document.querySelector('[data-table="discovery-surfaces"] .dash-copy')?.textContent || '',
                injected: document.querySelectorAll('[data-state="report"] img, [data-state="report"] script').length,
                notes: document.querySelectorAll('[aria-labelledby="discovery-title"] .dash-notes li').length,
                overflowing: [...document.querySelectorAll('[data-table^="discovery-"]')].filter(el => el.scrollWidth > el.clientWidth).map(el => el.dataset.table),
                cwv: document.querySelector('[data-field="cwv-carried"]'), rum: document.querySelector('[data-field="rum-carried"]')
            };
        });
        const carried = await session.page.evaluate(() => ['cwv-carried', 'rum-carried'].map(name => {
            const element = document.querySelector(`[data-field="${name}"]`);
            return [element.hidden, element.textContent];
        }));
        assert.equal(discovery.heading, 'Εσωτερική ανακάλυψη άρθρων');
        assert.match(discovery.window, /^\d{1,2} [^\s]+ \d{4} – \d{1,2} [^\s]+ \d{4}$/);
        assert.equal(discovery.freshness, 'Εβδομαδιαία ενότητα: ανανεώθηκε σε αυτό το στιγμιότυπο.');
        assert.deepEqual(discovery.surfaces, [['Αρχική · home', '34', 'επαρκές'], ['Άρθρο · article', '9', 'μικρό δείγμα'],
            ['Έκδοση / αρχείο · edition', '5', 'μικρό δείγμα'], ['Σελίδα οντότητας · entity_hub', '3', 'μικρό δείγμα'],
            ['Άλλο / μη αναγνωρισμένο · other', '2', 'μικρό δείγμα'], ['Συντάκτες · authors', '1', 'μικρό δείγμα']]);
        assert.match(discovery.unmapped, /^2 από αυτά τα κλικ οδηγούν σε μη αντιστοιχισμένα άρθρα/);
        assert.deepEqual(discovery.sections, [['Κάρτες και σύνδεσμοι άρθρων · article_link', '46', 'επαρκές'], ['Μενού πλοήγησης · navigation', '9', 'μικρό δείγμα'],
            ['Υποσέλιδο · footer', '2', 'μικρό δείγμα'], ['Άλλος σύνδεσμος σελίδας · page', '2', 'μικρό δείγμα'], ['Άλλο / μη αναγνωρισμένο · other', '1', 'μικρό δείγμα']]);
        // Destinations are summed over every surface and section: 34 + 9 + 1 reaches the minimum only as a total.
        assert.deepEqual(discovery.articles, [['Ταχύτερος γύρος', 'Ανάλυση', '44', 'επαρκές'],
            ['Ειδήσεις <img src=x onerror=alert(1)>', 'Ιστορία', '8', 'μικρό δείγμα']]);
        assert.equal(discovery.injected, 0, 'titles are text, never markup');
        assert.deepEqual(discovery.transitions[0], ['Αρχική · home', 'Άρθρο · article', '34', 'επαρκές']);
        assert.deepEqual(discovery.transitions.at(-1), ['Αρχική · home', 'Χωρίς διαδρομή · missing', '1', 'μικρό δείγμα']);
        assert.equal(discovery.transitions.length, 8);
        assert.equal(discovery.notes, 3, 'the click, consent and small-sample limits are stated');
        assert.deepEqual(discovery.overflowing, [], `every discovery column stays in view at ${width}px, without sideways scrolling`);
        for (const [hidden, note] of carried) {
            assert.equal(hidden, false);
            assert.match(note, /^Στοιχεία της προηγούμενης ημερήσιας ενημέρωσης \(.+\): σήμερα έτρεξε στη θέση τους η εβδομαδιαία ενότητα ανακάλυψης\.$/);
        }
        if (shots) await (await session.page.$('[aria-labelledby="discovery-title"]')).screenshot({ path: path.join(shots, `dashboard-discovery-${width}.png`) });
        await session.page.click('[data-lock]');
        assert.equal(await session.page.evaluate(() => document.querySelectorAll('[data-table^="discovery-"] *').length), 0, 'locking clears discovery');
        await finish(session, `discovery day ${width}`);
    }

    // The following days carry discovery, labelled with its age; RUM runs again.
    session = await open(discoveryCarried);
    await unlock(session.page, key);
    assert.deepEqual(await session.page.evaluate(() => [document.querySelector('[data-field="discovery-freshness"]').textContent,
        document.querySelector('[data-field="cwv-carried"]').hidden, document.querySelectorAll('[data-table="discovery-articles"] tbody tr').length]),
    ['Εβδομαδιαία ενότητα: στοιχεία της ενημέρωσης πριν από 1 ημέρα. Ανανεώνεται κάθε 7 ημέρες.', true, 2]);
    await finish(session, 'discovery carried');

    session = await open(fourDays);
    await unlock(session.page, key);
    assert.deepEqual(await session.page.evaluate(() => [document.querySelector('[data-field="window"]').textContent,
        document.getElementById('report-title').textContent, document.querySelectorAll('[data-chart="activity"] rect').length]),
    ['4 πλήρεις ημέρες, όσες υπάρχουν από την έναρξη της εξαγωγής · 19 Οκτ 2026 – 22 Οκτ 2026', 'Στοιχεία έως 22 Οκτ 2026', 4]);
    if (shots) await session.page.screenshot({ path: path.join(shots, 'dashboard-4-days.png'), fullPage: true });
    await finish(session, 'four days');

    session = await open(stale);
    await unlock(session.page, key);
    assert.equal(await session.page.$eval('[data-stale]', element => element.hidden), false, 'an old snapshot shows the stale warning');
    await finish(session, 'stale');

    session = await open(tampered);
    await unlock(session.page, key);
    assert.ok(await visible(session.page, 'damaged'), 'tampered snapshot: damaged state, nothing shown');
    assert.equal(await session.page.$$eval('[data-table] *', elements => elements.length), 0);
    await finish(session, 'tampered');
} finally {
    await browser.close();
    server.close();
}
console.log(`✓ dashboard browser regression: ${checks} sessions, same-origin only, nothing stored`);
