// I-06B encrypted snapshot: schedule, window, cost guards, fail-closed paths, encryption and publication.
// Synthetic data and generated keys only; no BigQuery, Google or GitHub request is ever made.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { readInputs, renderModel } from '../editorial-model.mjs';
import {
    ACQUISITION_WINDOW_DAYS, DAILY_MAX_BYTES, ENABLED, EXPORT_START, MATURITY_DAYS, MAX_BYTES_BILLED, PROJECT, PROPERTY, REPORT_TIMEZONE, SNAPSHOT_MODELS,
    SNAPSHOT_PATH, WINDOW_DAYS, assertEnvelope, bigQuery, conservativeBytes, install, parametersFor, plan, preflight, refresh,
    resultRows, scannedTables, sealSnapshot, snapshotWindow, modelWindow, windowDays, windowFor,
    DISCOVERY_EVERY_DAYS, DISCOVERY_MAX_AGE_DAYS, DISCOVERY_MODELS, ROTATED_FOR_DISCOVERY, openSnapshot, schedule
} from '../snapshot.mjs';
import { fakeClient, queryResult, syntheticRows } from './snapshot-fixture.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = rel => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
const workflow = read('.github/workflows/intelligence-snapshot.yml');
const job = name => workflow.split(`\n  ${name}:\n`)[1].split(/\n {2}[a-z_]+:\n/)[0];
const newKey = () => crypto.randomBytes(32).toString('base64');
const NOW = new Date('2026-11-20T01:00:00Z'); // 03:00 Athens; 17:00 on 19 Nov in Los Angeles
const WINDOW = { asOf: '2026-11-19', start: '2026-10-19', end: '2026-11-15' };
const env = (overrides = {}) => ({
    DASHBOARD_SNAPSHOT_KEY: newKey(),
    WIF_PROVIDER: 'projects/123456789/locations/global/workloadIdentityPools/github/providers/f1-stories',
    WIF_SERVICE_ACCOUNT: 'intelligence-snapshot@f1-stories-analytics.iam.gserviceaccount.com',
    BIGQUERY_ACCESS_TOKEN: 'synthetic-token',
    ...overrides
});
const tempRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-snapshot-'));
const quiet = () => {};
const run = (options = {}) => refresh({ mode: 'refresh', enabled: true, root: tempRoot(), env: env(), now: NOW, log: quiet, ...options });

// The browser's own decryption code (dashboard/snapshot-crypto.js), run on Node's Web Crypto.
function browserSnapshot() {
    const context = vm.createContext({ crypto: globalThis.crypto, TextEncoder, TextDecoder, atob, btoa, Uint8Array });
    vm.runInContext(read('dashboard/snapshot-crypto.js'), context);
    return context.F1SSnapshot;
}

async function rejection(promise) {
    try {
        await promise;
    } catch (error) {
        return error.code;
    }
    assert.fail('expected a rejection');
}

test('the refresh is scheduled once a day at 03:00 Europe/Athens, plus manual runs, and nothing else', () => {
    assert.deepEqual([...workflow.matchAll(/- cron: '([^']+)'\n\s+timezone: ([^\n]+)/g)].map(m => [m[1], m[2]]), [['0 3 * * *', 'Europe/Athens']]);
    const triggers = workflow.split('\non:\n')[1].split('\n\n')[0];
    assert.deepEqual([...triggers.matchAll(/^ {2}([a-z_]+):/gm)].map(m => m[1]), ['schedule', 'workflow_dispatch']);
    // The local time holds across both DST changes: 00:00 UTC in summer, 01:00 UTC in winter.
    const athens = instant => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Athens', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
        .format(new Date(instant));
    for (const instant of ['2026-03-28T01:00:00Z', '2026-03-30T00:00:00Z', '2026-10-24T00:00:00Z', '2026-10-26T01:00:00Z']) {
        assert.equal(athens(instant), '03:00', instant);
    }
    // Spring forward: 03:00 never happens on 29 March, so that day may get no run; the next run catches up.
    assert.deepEqual(['2026-03-29T00:59:00Z', '2026-03-29T01:00:00Z'].map(athens), ['02:59', '04:00']);
    // Fall back: 03:00 happens twice on 25 October. Both instants are the same as_of day, so a second run is a no-op.
    assert.deepEqual(['2026-10-25T00:00:00Z', '2026-10-25T01:00:00Z'].map(athens), ['03:00', '03:00']);
    assert.equal(snapshotWindow(new Date('2026-10-25T00:00:00Z')).asOf, snapshotWindow(new Date('2026-10-25T01:00:00Z')).asOf);
    // A manual run defaults to the free dry-run.
    assert.match(workflow, /mode:\n\s+description: [^\n]+\n\s+required: true\n\s+default: dry-run\n/);
});

test('the window is the latest mature days in the property time zone: up to 28, never before the export or immature', () => {
    assert.equal(REPORT_TIMEZONE, 'America/Los_Angeles');
    assert.equal(EXPORT_START, '2026-10-19');
    assert.deepEqual(snapshotWindow(NOW), WINDOW);
    // The export started on 19 Oct: until 28 days have matured, every mature day since then, with no gap.
    for (const [asOf, start, end, days] of [
        ['2026-10-23', '2026-10-19', '2026-10-19', 1],
        ['2026-10-26', '2026-10-19', '2026-10-22', 4],
        ['2026-10-29', '2026-10-19', '2026-10-25', 7],
        ['2026-11-19', '2026-10-19', '2026-11-15', 28],
        ['2026-11-20', '2026-10-20', '2026-11-16', 28]
    ]) {
        const window = windowFor(asOf);
        assert.deepEqual(window, { asOf, start, end }, asOf);
        assert.equal(windowDays(window), days, asOf);
    }
    // Before the first export day matures there is no window, and nothing is planned (before any credential is read).
    assert.ok(windowFor('2026-10-22').start > windowFor('2026-10-22').end);
    for (const mode of ['dry-run', 'refresh']) {
        const result = plan({ mode, enabled: true, env: {}, now: new Date('2026-10-23T01:00:00Z'), root: tempRoot() });
        assert.deepEqual([result.due, result.reason], [false, 'no mature daily export yet (the first, 2026-10-19, matures 4 days later)']);
    }
    for (const [instant, asOf] of [
        ['2026-10-25T01:00:00Z', '2026-10-24'], // EU already on winter time, US still on summer time
        ['2026-11-02T01:00:00Z', '2026-11-01'], // the US change
        ['2027-03-09T01:00:00Z', '2027-03-08'],
        ['2027-03-29T00:00:00Z', '2027-03-28'],
        ['2026-11-20T07:59:00Z', '2026-11-19'], // a schedule seven hours late is still the same as_of day
        ['2026-11-20T08:00:00Z', '2026-11-20'] // after Los Angeles midnight it is the next day, never an immature one
    ]) {
        const window = snapshotWindow(new Date(instant));
        assert.equal(window.asOf, asOf, instant);
        assert.equal((Date.parse(window.asOf) - Date.parse(window.end)) / 86400000, MATURITY_DAYS);
        assert.ok(window.start >= EXPORT_START && windowDays(window) >= 1 && windowDays(window) <= WINDOW_DAYS, instant);
    }
    // The models' own maturity rule is the same 4 days, so the window never asks for more than they read.
    for (const model of Object.keys(SNAPSHOT_MODELS)) {
        assert.match(renderModel(model, { project: PROJECT, property: PROPERTY, ...readInputs() }), /DATE_SUB\(@as_of_day, INTERVAL 4 DAY\)/);
    }
});

for (const [asOf, days] of [['2026-10-26', 4], ['2026-10-29', 7], ['2026-11-19', 28]]) {
    test(`a ${days}-day window refreshes, seals and opens with exactly ${days} daily rows and ${days} checked tables`, async () => {
        const window = windowFor(asOf);
        const keyText = newKey();
        const client = fakeClient(window);
        const now = new Date(`${asOf}T23:00:00Z`); // 16:00 in Los Angeles
        assert.equal(snapshotWindow(now).asOf, asOf);
        const text = await run({ client, now, env: env({ DASHBOARD_SNAPSHOT_KEY: keyText }) });
        assert.deepEqual(client.calls.tables, Array.from({ length: days }, (_, i) => new Date(Date.parse(window.start) + i * 86400000).toISOString().slice(0, 10)));
        assert.deepEqual(client.calls.dryRuns[0].parameters.filter(p => p.name.endsWith('_day')).map(p => [p.name, p.parameterValue.value]),
            [['as_of_day', asOf], ['end_day', window.end], ['start_day', window.start]]);
        const { header } = assertEnvelope(text);
        assert.deepEqual([header.asOf, header.start, header.end], [asOf, window.start, window.end]);
        const browser = browserSnapshot();
        const { payload } = await browser.open(browser.parseEnvelope(text), keyText);
        assert.equal(payload.models['20-daily-activity'].length, days);
        assert.equal(payload.models['20-daily-activity'][0].event_day, '2026-10-19');
        assert.equal(payload.models['30-cwv-summary'].length, 15);
        assert.equal(payload.models['26-acquisition-session'].length, 4);
        assert.equal(payload.models['29-audience-coverage'].length, 2);
        assert.deepEqual(JSON.parse(JSON.stringify(payload.modelWindows || {})), days > 7
            ? { '26-acquisition-session': { start: new Date(Date.parse(window.end) - 6 * 86400000).toISOString().slice(0, 10), end: window.end },
                '29-audience-coverage': { start: new Date(Date.parse(window.end) - 6 * 86400000).toISOString().slice(0, 10), end: window.end } }
            : {});
    assert.equal(payload.models['10-article-pageviews'].length, 3);
    assert.deepEqual(Array.from(payload.models['10-article-pageviews'], row => row.meets_min_events), [true, false, false]);
        // A daily result that skips or adds a day is incomplete.
        for (const rows of [days - 1, days + 1]) {
            const bad = fakeClient(window, { mutate: (model, result) => (model === '20-daily-activity'
                ? { ...result, rows: rows < days ? result.rows.slice(1) : [...result.rows, result.rows[0]], totalRows: String(rows) } : result) });
            await assert.rejects(run({ client: bad, now }), new RegExp(`20-daily-activity: expected ${days} rows, got ${rows}`));
        }
    });
}

test('envelopes accept any valid 1-28 day window and nothing else', () => {
    const key = crypto.randomBytes(32);
    const seal = window => sealSnapshot({}, key, { generatedAt: NOW.toISOString(), window });
    for (const asOf of ['2026-10-23', '2026-10-26', '2026-10-29', '2026-11-19', '2027-06-01']) assert.ok(assertEnvelope(seal(windowFor(asOf))));
    for (const window of [
        { asOf: '2026-10-26', start: '2026-10-20', end: '2026-10-22' }, // a shorter window than is available
        { asOf: '2026-10-26', start: '2026-10-18', end: '2026-10-22' }, // a day before the export began
        { asOf: '2026-10-26', start: '2026-10-19', end: '2026-10-23' }, // an immature day
        { asOf: '2026-11-20', start: '2026-10-19', end: '2026-11-16' }, // 29 days
        { asOf: '2026-10-22', start: '2026-10-19', end: '2026-10-18' } // no mature day
    ]) {
        assert.throws(() => assertEnvelope(seal(window)), /window is not the mature window/, JSON.stringify(window));
    }
});

test('each model gets exactly its validated parameters, and a malformed one fails closed', () => {
    const inputs = readInputs();
    const names = model => parametersFor(renderModel(model, { project: PROJECT, property: PROPERTY, ...inputs }), WINDOW).map(p => p.name);
    assert.deepEqual(names('11-category-pageviews'), ['as_of_day', 'end_day', 'min_events', 'start_day']);
    assert.deepEqual(names('20-daily-activity'), ['as_of_day', 'end_day', 'min_events', 'start_day']);
    assert.deepEqual(names('26-acquisition-session'), ['as_of_day', 'end_day', 'min_events', 'start_day']);
    assert.deepEqual(names('29-audience-coverage'), ['as_of_day', 'end_day', 'start_day']);
    assert.deepEqual(names('30-cwv-summary'), ['as_of_day', 'end_day', 'min_observations', 'report_timezone', 'start_day']);
    assert.deepEqual(names('33-rum-coverage'), ['as_of_day', 'end_day', 'report_timezone', 'start_day']);
    const sql = renderModel('30-cwv-summary', { project: PROJECT, property: PROPERTY, ...inputs });
    assert.deepEqual(parametersFor(sql, WINDOW).find(p => p.name === 'report_timezone'),
        { name: 'report_timezone', parameterType: { type: 'STRING' }, parameterValue: { value: 'America/Los_Angeles' } });
    assert.throws(() => parametersFor(sql, { ...WINDOW, end: '2026-11-15; DROP' }), /malformed or unknown query parameter @end_day/);
    assert.throws(() => parametersFor('SELECT @unknown_thing', WINDOW), /@unknown_thing/);
});

test('owner-approved activation preserves cost caps and the nine-model allowlist, seven per day', async () => {
    assert.equal(ENABLED, true);
    assert.equal(MAX_BYTES_BILLED, 400 * 1048576);
    assert.equal(DAILY_MAX_BYTES, 1600 * 1048576);
    assert.deepEqual(Object.keys(SNAPSHOT_MODELS), ['10-article-pageviews', '11-category-pageviews', '13-article-discovery', '20-daily-activity',
        '26-acquisition-session', '28-internal-navigation', '29-audience-coverage', '30-cwv-summary', '33-rum-coverage']);
    // The emergency disable path must still fail closed, even when config is otherwise valid.
    const client = fakeClient(WINDOW);
    await assert.rejects(refresh({ mode: 'refresh', enabled: false, root: tempRoot(), env: env(), now: NOW, client, log: quiet }), /billable refreshes are disabled/);
    assert.deepEqual(client.calls, { tables: [], dryRuns: [], runs: [] });
});

test('acquisition and coverage have the same bounded seven-day mature window', async () => {
    assert.equal(ACQUISITION_WINDOW_DAYS, 7);
    assert.deepEqual(modelWindow('26-acquisition-session', WINDOW),
        { asOf: WINDOW.asOf, start: '2026-11-09', end: '2026-11-15' });
    assert.deepEqual(modelWindow('29-audience-coverage', WINDOW), modelWindow('26-acquisition-session', WINDOW));
    assert.deepEqual(modelWindow('20-daily-activity', WINDOW), WINDOW);
    assert.deepEqual(modelWindow('26-acquisition-session', windowFor('2026-10-26')), windowFor('2026-10-26'));
    const client = fakeClient(WINDOW);
    const text = await run({ client });
    const browser = browserSnapshot();
    const envelope = JSON.parse(text);
    // The encrypted header always describes the primary 28-day window; acquisition stays inside.
    const { header } = assertEnvelope(text);
    assert.equal(header.start, WINDOW.start);
    const query = client.calls.runs.find(r => r.jobId.includes('26_acquisition_session'));
    assert.deepEqual(query.parameters.filter(p => p.name === 'start_day').map(p => p.parameterValue.value), ['2026-11-09']);
    assert.equal(client.calls.dryRuns.length, 7);
    assert.ok(envelope.data && !text.includes('organic_search'));
    // Browser code will validate the authenticated ciphertext and included sub-window metadata.
    assert.ok(browser.open);
});

test('estimates count every scanned daily table, even when a dry-run lists the wildcard as one', () => {
    const job = (processed, tables) => ({ statistics: { query: { totalBytesProcessed: processed, referencedTables: Array(tables).fill({ tableId: 'events_*' }) } } });
    // The editorial and audience bases read the window's days; the RUM base also reads the day before.
    assert.deepEqual(Object.keys(SNAPSHOT_MODELS).map(model => scannedTables(model, modelWindow(model, WINDOW))), [28, 28, 28, 28, 7, 28, 7, 29, 29]);
    assert.deepEqual(Object.keys(SNAPSHOT_MODELS).map(model => scannedTables(model, modelWindow(model, windowFor('2026-10-26')))), [4, 4, 4, 4, 4, 4, 4, 5, 5]);
    // One listed wildcard table: the 10 MiB per-table minimum still applies to all 28 or 29 tables.
    assert.deepEqual(conservativeBytes(job('1000', 1), 28), { processed: 1000, referenced: 1, tables: 28, estimate: 280 * 1048576 });
    assert.equal(conservativeBytes(job('1000', 1), 29).estimate, 290 * 1048576);
    // A dry-run listing more tables than expected, or processing more bytes, raises the estimate.
    assert.equal(conservativeBytes(job('1000', 31), 28).estimate, 310 * 1048576);
    assert.equal(conservativeBytes(job(String(350 * 1048576 + 1), 1), 28).estimate, 351 * 1048576);
    assert.throws(() => conservativeBytes(job('1000', 1)), /no scanned table count/);
    assert.throws(() => conservativeBytes({ statistics: {} }, 28), /no byte estimate/);
    assert.throws(() => conservativeBytes(job('1e9', 1), 28), /no byte estimate/);
});

test('preflight enforces the per-query cap and the combined daily ceiling before anything runs', async () => {
    const MiB = 1048576;
    // Seven queries at table minimums: 280×3 + 70×2 + 290×2 = 1560 MiB within unchanged 1600 MiB cap.
    const client = fakeClient(WINDOW, { processed: '1000', tables: 1 });
    const logs = [];
    await run({ client, log: line => logs.push(line) });
    assert.equal(client.calls.runs.length, 7);
    assert.ok(logs.includes('preflight passed: ≤ 1560.00 MiB of the 1600.00 MiB daily ceiling; per-query cap 400.00 MiB'), logs.join('\n'));
    assert.ok(logs.includes('dry-run 30-cwv-summary: 0.00 MiB processed, 1 table(s) listed, 29 counted, ≤ 290.00 MiB billed'));

    assert.equal(preflight(Array(4).fill({ model: 'm', estimate: 400 * MiB })), 1600 * MiB);
    assert.throws(() => preflight([{ model: 'm', estimate: 400 * MiB + 1 }]), /m: estimate 400.00 MiB exceeds the 400.00 MiB per-query cap; nothing was run/);
    assert.throws(() => preflight([...Array(4).fill({ model: 'm', estimate: 400 * MiB }), { model: 'n', estimate: MiB }]), /combined estimate 1601.00 MiB exceeds the 1600.00 MiB daily ceiling; nothing was run/);
    for (const options of [{ processed: String(400 * MiB + 1) }, { tables: 41 }]) {
        const rejected = fakeClient(WINDOW, options);
        await assert.rejects(run({ client: rejected }), /per-query cap; nothing was run/);
        assert.equal(rejected.calls.dryRuns.length, 7);
        assert.equal(rejected.calls.runs.length, 0);
    }
    // Billed bytes are checked after each query: a query billing more than planned stops the rest.
    const overbilled = fakeClient(WINDOW, { billed: 900 * MiB });
    await assert.rejects(run({ client: overbilled }), /billed bytes 1800.00 MiB passed the daily ceiling; stopping/);
    assert.equal(overbilled.calls.runs.length, 2);
});

test('missing or malformed configuration fails closed before any network call', async () => {
    for (const [overrides, message] of [
        [{ DASHBOARD_SNAPSHOT_KEY: '' }, /DASHBOARD_SNAPSHOT_KEY is missing/],
        [{ DASHBOARD_SNAPSHOT_KEY: crypto.randomBytes(16).toString('base64') }, /DASHBOARD_SNAPSHOT_KEY/],
        [{ WIF_PROVIDER: '' }, /INTELLIGENCE_WIF_PROVIDER/],
        [{ WIF_SERVICE_ACCOUNT: 'someone@gmail.com' }, /INTELLIGENCE_SERVICE_ACCOUNT/],
        [{ BIGQUERY_ACCESS_TOKEN: '' }, /no BigQuery access token/]
    ]) {
        const client = fakeClient(WINDOW);
        await assert.rejects(run({ client, env: env(overrides) }), message);
        assert.deepEqual(client.calls, { tables: [], dryRuns: [], runs: [] });
        if (!('BIGQUERY_ACCESS_TOKEN' in overrides)) assert.throws(() => plan({ mode: 'dry-run', env: env(overrides), now: NOW, root: tempRoot() }), message);
    }
    // The emergency disabled mode plans nothing before reading configuration.
    assert.equal(plan({ mode: 'refresh', enabled: false, env: {}, now: NOW, root: tempRoot() }).due, false);
    assert.throws(() => plan({ mode: 'everything', env: env(), now: NOW }), /unknown mode/);
});

test('a missing daily export table stops the refresh before any query', async () => {
    const client = fakeClient(WINDOW, { missingDay: '2026-11-01' });
    await assert.rejects(run({ client }), /events_20261101 is missing/);
    assert.equal(client.calls.dryRuns.length, 0);
    assert.equal(client.calls.tables.at(-1), '2026-11-01');
    // A dry-run still costs every query (free) so the owner can review estimates, then fails the same way.
    const dry = fakeClient(WINDOW, { missingDay: '2026-11-01' });
    await assert.rejects(run({ client: dry, mode: 'dry-run', enabled: false }), /1 daily export table\(s\) missing \(first 2026-11-01\): a refresh would fail closed/);
    assert.deepEqual([dry.calls.tables.length, dry.calls.dryRuns.length, dry.calls.runs.length], [WINDOW_DAYS, 7, 0]);
    // The same in a short window: a gap in the first days is never skipped or filled.
    const early = fakeClient(windowFor('2026-10-29'), { missingDay: '2026-10-21' });
    await assert.rejects(run({ client: early, now: new Date('2026-10-29T23:00:00Z') }), /events_20261021 is missing/);
    assert.deepEqual([early.calls.tables, early.calls.dryRuns.length], [['2026-10-19', '2026-10-20', '2026-10-21'], 0]);
    // Every reporting day is checked, never a day after the mature end.
    const complete = fakeClient(WINDOW);
    await run({ client: complete });
    assert.equal(complete.calls.tables.length, WINDOW_DAYS);
    assert.deepEqual([complete.calls.tables[0], complete.calls.tables.at(-1)], [WINDOW.start, WINDOW.end]);
});

test('dry-run mode costs every query and runs none; refresh runs each model once under a per-day job id', async () => {
    const dry = fakeClient(WINDOW);
    assert.equal(await run({ client: dry, mode: 'dry-run', enabled: false }), null);
    assert.equal(dry.calls.runs.length, 0);

    const client = fakeClient(WINDOW);
    await run({ client });
    assert.equal(client.calls.runs.length, 7);
    for (const { jobId } of client.calls.runs) assert.match(jobId, /^f1s_snapshot_20261119_\d\d_[a-z_]+_[0-9a-f]{16}$/);
    const again = fakeClient(WINDOW);
    await run({ client: again });
    assert.deepEqual(again.calls.runs.map(r => r.jobId), client.calls.runs.map(r => r.jobId), 'a rerun reuses the same BigQuery jobs');
});

test('the REST client caps every query, never retries one, and reuses an existing job instead of re-running it', async () => {
    const requests = [];
    const respond = (status, json) => ({ status, json: async () => json });
    const fetcher = handler => async (url, init) => {
        requests.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : null, auth: init.headers.Authorization });
        return handler(url, init, requests.length);
    };
    const done = { status: { state: 'DONE' }, statistics: { query: { totalBytesBilled: '10485760' } } };
    const results = queryResult(syntheticRows(WINDOW)['11-category-pageviews']);

    let client = bigQuery({ token: 't', sleep: async () => {}, fetch: fetcher((url, init) => {
        if (init.method === 'POST') return respond(200, {});
        return url.includes('/queries/') ? respond(200, results) : respond(200, done);
    }) });
    await client.dryRun('SELECT 1', []);
    const run1 = await client.run('job_a', 'SELECT 1', []);
    assert.equal(run1.billed, 10485760);
    assert.equal(requests[0].body.configuration.dryRun, true);
    assert.equal(requests[1].body.configuration.dryRun, undefined);
    for (const request of requests.slice(0, 2)) {
        assert.equal(request.body.configuration.query.maximumBytesBilled, '419430400'); // 400 MiB
        assert.equal(request.body.configuration.query.useLegacySql, false);
        assert.equal(request.body.jobReference.location, 'EU');
        assert.equal(request.auth, 'Bearer t');
        assert.match(request.url, /^https:\/\/bigquery\.googleapis\.com\/bigquery\/v2\/projects\/f1-stories-analytics\//);
    }
    assert.equal(requests[1].body.jobReference.jobId, 'job_a');

    // Already exists (a rerun the same day): read the earlier job, insert nothing new.
    requests.length = 0;
    client = bigQuery({ token: 't', sleep: async () => {}, fetch: fetcher((url, init) =>
        init.method === 'POST' ? respond(409, { error: { message: 'Already Exists' } }) : url.includes('/queries/') ? respond(200, results) : respond(200, done)) });
    await client.run('job_a', 'SELECT 1', []);
    assert.equal(requests.filter(r => r.method === 'POST').length, 1);

    // Failures are final: one insert, no retry.
    for (const handler of [
        (url, init) => (init.method === 'POST' ? respond(500, { error: { message: 'backend error' } }) : respond(200, done)),
        () => respond(403, { error: { message: 'Access Denied: bigquery.jobs.create' } }),
        (url, init) => (init.method === 'POST' ? respond(200, {}) : respond(200, { status: { state: 'DONE', errorResult: { message: 'bytesBilledLimitExceeded' } } }))
    ]) {
        requests.length = 0;
        client = bigQuery({ token: 't', sleep: async () => {}, fetch: fetcher(handler) });
        await assert.rejects(client.run('job_b', 'SELECT 1', []), /not accepted|failed|denied/i);
        assert.equal(requests.filter(r => r.method === 'POST').length, 1);
    }
    client = bigQuery({ token: 't', fetch: fetcher(() => respond(404, { error: { message: 'Not found: Table' } })) });
    await assert.rejects(client.table('2026-11-01'), /events_20261101 is missing or unreadable: HTTP 404/);
});

test('incomplete or out-of-window output fails the refresh', async () => {
    const rows = syntheticRows(WINDOW);
    const result = model => queryResult(rows[model]);
    assert.equal(resultRows('20-daily-activity', result('20-daily-activity'), WINDOW).length, WINDOW_DAYS);
    const broken = [
        ['20-daily-activity', r => ({ ...r, jobComplete: false })],
        ['20-daily-activity', r => ({ ...r, pageToken: 'next' })],
        ['20-daily-activity', r => ({ ...r, rows: r.rows.slice(1) })],
        ['20-daily-activity', r => ({ ...r, rows: r.rows.slice(1), totalRows: String(r.rows.length - 1) })],
        ['11-category-pageviews', r => ({ ...r, schema: { fields: r.schema.fields.map(f => (f.name === 'meets_min_events' ? { ...f, name: 'x' } : f)) } })],
        ['30-cwv-summary', r => ({ ...r, rows: r.rows.map(row => ({ f: row.f.map((c, i) => (r.schema.fields[i].name === 'cohort_truncated' ? { v: 'true' } : c)) })) })],
        ['11-category-pageviews', r => ({ ...r, rows: r.rows.map(row => ({ f: row.f.map((c, i) => (r.schema.fields[i].name === 'through_day' ? { v: '2026-11-16' } : c)) })) })]
    ];
    for (const [model, mutate] of broken) {
        assert.throws(() => resultRows(model, mutate(result(model)), WINDOW), new RegExp(model));
        await assert.rejects(run({ client: fakeClient(WINDOW, { mutate: (name, r) => (name === model ? mutate(r) : r) }) }), new RegExp(model));
    }
});

test('encrypt/decrypt round trip through the browser code, with a fresh nonce every seal', async () => {
    const keyText = newKey();
    const client = fakeClient(WINDOW);
    const text = await run({ client, env: env({ DASHBOARD_SNAPSHOT_KEY: keyText }) });
    const { header } = assertEnvelope(text);
    assert.deepEqual({ asOf: header.asOf, start: header.start, end: header.end, generatedAt: header.generatedAt },
        { ...WINDOW, generatedAt: NOW.toISOString() });

    const browser = browserSnapshot();
    const { payload } = await browser.open(browser.parseEnvelope(text), keyText);
    // No earlier snapshot: the normal seven models run, and discovery is pending.
    const normal = Object.fromEntries(Object.entries(syntheticRows(WINDOW)).filter(([model]) => !DISCOVERY_MODELS.includes(model)));
    assert.deepEqual(JSON.parse(JSON.stringify(payload.models)), normal);
    assert.deepEqual({ ...payload.window }, { ...WINDOW, timezone: 'America/Los_Angeles' });
    assert.equal(payload.minEvents, 30);

    // Same plaintext, same key: different nonce and ciphertext.
    const key = Buffer.from(keyText, 'base64');
    const [a, b] = [1, 2].map(() => JSON.parse(sealSnapshot({ x: 1 }, key, { generatedAt: NOW.toISOString(), window: WINDOW })));
    assert.notEqual(a.iv, b.iv);
    assert.notEqual(a.data, b.data);
    // Nothing readable leaks: no row value, category, model name or key.
    for (const secret of ['Ανάλυση', 'page_view_events', '20-daily-activity', 'delayed_existing', keyText, key.toString('hex')]) {
        assert.equal(text.includes(secret), false, secret);
    }
});

test('a wrong or malformed key, and any tampering, is rejected without revealing data', async () => {
    const keyText = newKey();
    const text = sealSnapshot({ format: 'f1s-dashboard-snapshot-payload', v: 1, window: WINDOW, models: {} }, Buffer.from(keyText, 'base64'),
        { generatedAt: NOW.toISOString(), window: WINDOW });
    const browser = browserSnapshot();
    const envelope = JSON.parse(text);
    const reopen = (changed, key = keyText) => rejection(browser.open(browser.parseEnvelope(JSON.stringify(changed)), key));
    const flip = base64 => {
        const bytes = Buffer.from(base64, 'base64');
        bytes[0] ^= 1;
        return bytes.toString('base64');
    };

    assert.equal(await reopen(envelope, newKey()), 'wrong-key');
    assert.equal(await reopen(envelope, 'not-a-key'), 'key-format');
    assert.equal(await reopen({ ...envelope, data: flip(envelope.data) }), 'tampered');
    assert.equal(await reopen({ ...envelope, iv: flip(envelope.iv) }), 'tampered');
    // The header is authenticated: a forged update time or coverage date breaks decryption.
    assert.equal(await reopen({ ...envelope, header: envelope.header.replace(NOW.toISOString(), '2027-01-01T00:00:00.000Z') }), 'tampered');
    assert.equal(await reopen({ ...envelope, header: envelope.header.replace('"end":"2026-11-15"', '"end":"2026-11-16"') }), 'tampered');
    // A payload sealed for another window cannot be relabelled.
    const other = sealSnapshot({ format: 'f1s-dashboard-snapshot-payload', v: 1, window: { ...WINDOW, end: '2026-11-14' }, models: {} },
        Buffer.from(keyText, 'base64'), { generatedAt: NOW.toISOString(), window: WINDOW });
    assert.equal(await rejection(browser.open(browser.parseEnvelope(other), keyText)), 'tampered');
    // Structural damage never reaches decryption.
    for (const damaged of ['', '{', '{"header":"{}","iv":"","data":""}', JSON.stringify({ ...envelope, extra: 1 }), JSON.stringify({ ...envelope, iv: 'AAAA' })]) {
        assert.throws(() => browser.parseEnvelope(damaged), error => error.code === 'unavailable');
        assert.throws(() => assertEnvelope(damaged));
    }
});

test('publication is idempotent, newer-only, and never replaces the snapshot with a failed or invalid one', async () => {
    const root = tempRoot();
    const keyText = newKey();
    const seal = (now, overrides = {}) => run({ client: fakeClient(snapshotWindow(now)), now, root: tempRoot(), env: env({ DASHBOARD_SNAPSHOT_KEY: keyText }), ...overrides });
    const first = await seal(NOW);
    const file = path.join(root, SNAPSHOT_PATH);

    assert.equal(install(first, root), true);
    assert.equal(fs.readFileSync(file, 'utf8'), first);
    // The same day again (a rerun, a late schedule): nothing to do, before any credential is read.
    assert.deepEqual(plan({ mode: 'refresh', enabled: true, env: {}, now: NOW, root }).due, false);
    const sameDay = await seal(new Date('2026-11-20T03:00:00Z'));
    assert.equal(install(sameDay, root), false);
    assert.equal(fs.readFileSync(file, 'utf8'), first);

    // An older envelope (a stale run finishing late) never overwrites a newer one.
    const older = await seal(new Date('2026-11-19T01:00:00Z'));
    assert.equal(install(older, root), false);
    // Malformed or truncated input fails and leaves the published file as it was.
    for (const bad of ['', first.slice(0, 100), first.replace('"iv"', '"nonce"')]) {
        assert.throws(() => install(bad, root));
        assert.equal(fs.readFileSync(file, 'utf8'), first);
    }
    // A refresh that fails mid-way produces no envelope at all, so publish has nothing to install.
    await assert.rejects(run({ client: fakeClient(snapshotWindow(new Date('2026-11-21T01:00:00Z')), { failRun: 3 }), now: new Date('2026-11-21T01:00:00Z') }), /synthetic failure/);
    assert.equal(fs.readFileSync(file, 'utf8'), first);

    const next = await seal(new Date('2026-11-21T01:00:00Z'));
    assert.equal(install(next, root), true);
    assert.equal(assertEnvelope(fs.readFileSync(file, 'utf8')).header.asOf, '2026-11-20');
    assert.deepEqual(fs.readdirSync(path.dirname(file)), ['snapshot.json'], 'no temporary file is left behind');
});

test('operational telemetry always runs without blocking refresh or weakening publication gates', () => {
    const steps = job('refresh').split('\n      - name: ').slice(1);
    for (const name of ['Finalize operational metadata', 'Upload operational metadata']) {
        const step = steps.find(value => value.startsWith(`${name}\n`));
        assert.ok(step, name);
        assert.match(step, /^ {8}if: \$\{\{ always\(\) \}\}$/m);
        assert.match(step, /^ {8}continue-on-error: true$/m);
    }
    assert.equal(steps.filter(step => /continue-on-error:/.test(step)).length, 2);
    assert.match(job('publish'), /needs\.refresh\.result == 'success' && needs\.refresh\.outputs\.envelope == 'true'/);
});

test('unwritable summaries preserve plan and refresh results, envelope output and original failures', async () => {
    const root = tempRoot();
    try {
        const preload = path.join(root, 'fetch.mjs');
        const blocked = path.join(root, 'private-telemetry-path');
        fs.mkdirSync(blocked);
        const results = Object.fromEntries(Object.entries(syntheticRows(WINDOW)).map(([model, rows]) => [model, queryResult(rows)]));
        const dryRun = await fakeClient(WINDOW).dryRun();
        fs.writeFileSync(preload, `import fs from 'node:fs';
            const RealDate = Date;
            globalThis.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [${JSON.stringify(NOW.toISOString())}])); } };
            const exists = fs.existsSync;
            fs.existsSync = file => String(file).endsWith('dashboard/data/snapshot.json') ? false : exists(file);
            const results = ${JSON.stringify(results)};
            const queries = new Map();
            globalThis.fetch = async (url, options) => {
                const body = options.body && JSON.parse(options.body);
                if (url.includes('/tables/')) return Response.json({});
                if (body?.configuration?.dryRun) return Response.json(${JSON.stringify(dryRun)});
                if (body?.jobReference) {
                    const id = body.jobReference.jobId;
                    const model = Object.keys(results).find(model => id.includes('_' + model.replaceAll('-', '_') + '_'));
                    queries.set(id, results[model]);
                    return Response.json({});
                }
                const id = url.match(/\\/(?:jobs|queries)\\/([^?]+)/)?.[1];
                if (queries.has(id)) {
                    if (url.includes('/queries/')) return Response.json(queries.get(id));
                    return Response.json({ status: { state: 'DONE', ...(process.env.FAIL_QUERY ? { errorResult: { message: 'synthetic query failure' } } : {}) },
                        statistics: { query: { totalBytesBilled: '10485760' } } });
                }
                throw new Error('test forbids unexpected network access');
            };\n`);
        const cli = (command, summaryPath, overrides = {}) => spawnSync(process.execPath,
            ['--import', preload, 'scripts/intelligence/snapshot.mjs', command, '--mode=refresh', `--out=${path.join(root, 'snapshot.json')}`],
            { env: { PATH: process.env.PATH, ...env(), ...overrides, ...(summaryPath ? { SNAPSHOT_SUMMARY_PATH: summaryPath } : {}) }, encoding: 'utf8' });
        for (const [command, overrides, expected] of [
            ['plan', {}, 0], ['plan', { DASHBOARD_SNAPSHOT_KEY: '' }, 1],
            ['refresh', {}, 0], ['refresh', { FAIL_QUERY: 'true' }, 1]
        ]) {
            const baseline = cli(command, null, overrides);
            assert.equal(baseline.status, expected, baseline.stderr);
            const file = path.join(root, 'snapshot.json');
            if (expected === 0 && command === 'refresh') {
                assertEnvelope(fs.readFileSync(file, 'utf8'));
                fs.unlinkSync(file);
            }
            const result = cli(command, blocked, overrides);
            assert.equal(result.status, baseline.status, result.stderr);
            assert.equal(result.stdout, baseline.stdout);
            assert.ok(result.stderr.includes(baseline.stderr.trim()), 'original failure is retained');
            assert.match(result.stderr, /Operational metadata unavailable/);
            assert.ok(!result.stderr.includes(blocked), 'telemetry errors never reveal paths or provider data');
            if (expected === 0 && command === 'refresh') {
                assertEnvelope(fs.readFileSync(file, 'utf8'));
                fs.unlinkSync(file);
            }
        }
        for (const summaryPath of [blocked, path.join(blocked, 'missing', 'summary.json')]) {
            const result = cli('finalize-summary', summaryPath);
            assert.equal(result.status, 0, result.stderr);
            assert.match(result.stderr, /Operational metadata unavailable/);
            assert.ok(!result.stderr.includes(summaryPath));
        }
        const malformed = path.join(root, 'malformed.json');
        fs.writeFileSync(malformed, 'private-malformed-telemetry');
        const result = cli('finalize-summary', malformed);
        assert.equal(result.status, 0, result.stderr);
        assert.doesNotMatch(result.stderr, /private-malformed-telemetry/);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('the workflow keeps credentials, writes and deploys in separate least-privilege jobs', () => {
    assert.match(workflow, /^permissions: \{\}$/m);
    assert.match(workflow, /^concurrency:\n {2}group: intelligence-snapshot\n {2}cancel-in-progress: false$/m);
    const refreshJob = job('refresh'), publishJob = job('publish'), deployJob = job('deploy');
    const permissions = text => text.match(/\n {4}permissions:\n((?: {6}[a-z-]+: [a-z]+\n)+)/)[1].trim().split('\n').map(line => line.trim());
    assert.deepEqual(permissions(refreshJob), ['contents: read', 'id-token: write']);
    assert.deepEqual(permissions(publishJob), ['contents: write']);
    assert.deepEqual(permissions(deployJob), ['actions: write']);

    // Credentials: main only, behind a main-only environment, after the plan, through WIF with no key file.
    assert.match(refreshJob, /if: \$\{\{ github\.ref == 'refs\/heads\/main' \}\}/);
    assert.match(refreshJob, /environment: intelligence-snapshots/);
    const steps = refreshJob.split('\n      - name: ').slice(1);
    const authIndex = steps.findIndex(step => step.includes('google-github-actions/auth@'));
    assert.ok(authIndex > steps.findIndex(step => step.includes('snapshot.mjs plan')));
    assert.match(steps[authIndex], /if: \$\{\{ steps\.plan\.outputs\.due == 'true' \}\}/);
    assert.match(steps[authIndex], /token_format: access_token\n[\s\S]*create_credentials_file: false\n\s+export_environment_variables: false/);
    assert.doesNotMatch(workflow, /credentials_json|GOOGLE_APPLICATION_CREDENTIALS|secrets\.GITHUB_TOKEN|secrets\.[A-Z_]*PAT/);
    assert.doesNotMatch(refreshJob, /npm (?:ci|install)|uses: \.\/\.github\/actions\/setup/);
    // Only the envelope and the allowlisted operational metadata are uploaded; no plaintext analytics.
    assert.deepEqual([...workflow.matchAll(/\n\s+path: ([^\n]+)/g)].map(m => m[1]), ['${{ runner.temp }}/snapshot.json', '${{ runner.temp }}/intelligence-operation.json', '${{ runner.temp }}/snapshot']);

    // Publication: the content publishers' lock, the shared commit helper, only the snapshot path.
    assert.match(publishJob, /needs\.refresh\.outputs\.envelope == 'true'/);
    assert.match(publishJob, /concurrency:\n {6}group: content-publishing\n {6}queue: max/);
    assert.match(publishJob, /snapshot\.mjs install "\$RUNNER_TEMP\/snapshot\/snapshot\.json"[\s\S]*uses: \.\/\.github\/actions\/commit-and-push/);
    assert.match(publishJob, /paths: dashboard\/data\/snapshot\.json\n/);
    assert.match(publishJob, /token: \$\{\{ github\.token \}\}/);

    // Deployment: only after a changed commit, by dispatching the existing Pages workflow on main.
    assert.match(deployJob, /if: \$\{\{ needs\.publish\.result == 'success' && needs\.publish\.outputs\.changed == 'true' \}\}/);
    assert.match(deployJob, /gh api --method POST "repos\/\$REPO\/actions\/workflows\/deploy-pages\.yml\/dispatches" -f ref=main/);
    assert.doesNotMatch(workflow, /upload-pages-artifact|deploy-pages@|build-pages|configure-pages/);
    // The dispatched build checks out main at run time, so it contains the commit pushed just before.
    const pages = read('.github/workflows/deploy-pages.yml');
    assert.match(pages, /^ {2}workflow_dispatch:$/m);
    assert.match(pages.split('\n  build:\n')[1].split('\n  deploy:\n')[0], /with:\n {10}ref: main\n/);
});

test('no other workflow can reach Google credentials or the snapshot key; pull requests never authenticate', () => {
    for (const file of fs.readdirSync(path.join(REPO_ROOT, '.github/workflows'))) {
        if (file === 'intelligence-snapshot.yml') continue;
        const text = read(`.github/workflows/${file}`);
        assert.doesNotMatch(text, /google-github-actions|DASHBOARD_SNAPSHOT_KEY|INTELLIGENCE_|intelligence-snapshots|bigquery/i, file);
    }
    const health = read('.github/workflows/intelligence-health.yml');
    assert.doesNotMatch(health, /id-token|environment:|secrets\.|actions: write|contents: write/);
    assert.match(health, /run: node scripts\/intelligence\/health-check\.mjs/);
    assert.doesNotMatch(workflow, /pull_request|push:|workflow_run|repository_dispatch/);
});

test('the plaintext artifact guards cover every snapshot model, including discovery', () => {
    for (const file of ['scripts/build/validate-public-artifact.mjs', 'scripts/quality/static-source-guard.mjs']) {
        const names = read(file).match(/"\(\?:((?:\d\d-[a-z-]+\|?)+)\)"\\s\*:/)[1].split('|');
        assert.deepEqual(Object.keys(SNAPSHOT_MODELS).filter(model => !names.includes(model)), [], file);
    }
});

// I-06C3 -------------------------------------------------------------------------------------------------------------
const MiB = 1048576;
const floor = (models, window) => models.reduce((sum, model) => sum + scannedTables(model, modelWindow(model, window)) * 10 * MiB, 0);
// A chain of daily refreshes sharing one root and key, as on main: each day reads the snapshot the day before published.
async function chain(days, { from = '2026-11-19', keyText = newKey(), root = tempRoot(), skip = [], client = window => fakeClient(window) } = {}) {
    const results = [];
    for (let i = 0; i < days; i++) {
        const asOf = new Date(Date.parse(`${from}T00:00:00Z`) + i * 86400000).toISOString().slice(0, 10);
        if (skip.includes(asOf)) continue;
        const now = new Date(`${asOf}T23:00:00Z`);
        const calls = client(snapshotWindow(now));
        const text = await run({ client: calls, now, root, env: env({ DASHBOARD_SNAPSHOT_KEY: keyText }) });
        install(text, root);
        results.push({ asOf, ran: calls.calls.runs.map(r => r.jobId.match(/_(\d\d_[a-z_]+)_[0-9a-f]{16}$/)[1].replaceAll('_', '-')),
            snapshot: openSnapshot(text, Buffer.from(keyText, 'base64')) });
    }
    return results;
}

test('every supported window, normal or discovery day, plans at most 1560 MiB at the per-table floor; limits unchanged', () => {
    assert.equal(MAX_BYTES_BILLED, 400 * MiB);
    assert.equal(DAILY_MAX_BYTES, 1600 * MiB);
    const all = Object.keys(SNAPSHOT_MODELS);
    const normal = all.filter(model => !DISCOVERY_MODELS.includes(model));
    const discoveryDay = all.filter(model => !ROTATED_FOR_DISCOVERY.includes(model));
    // Running all nine daily would need 2120 MiB: the rotation exists because that does not fit.
    assert.equal(floor(all, WINDOW), 2120 * MiB);
    let worst = 0;
    for (let asOf = '2026-10-23'; asOf <= '2026-11-25'; asOf = new Date(Date.parse(`${asOf}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)) {
        const window = windowFor(asOf);
        assert.ok(windowDays(window) >= 1 && windowDays(window) <= 28);
        for (const models of [normal, discoveryDay]) {
            assert.equal(models.length, 7);
            for (const model of models) assert.ok(scannedTables(model, modelWindow(model, window)) * 10 * MiB <= MAX_BYTES_BILLED, `${asOf} ${model}`);
            assert.ok(floor(models, window) <= DAILY_MAX_BYTES, asOf);
            worst = Math.max(worst, floor(models, window));
        }
    }
    assert.equal(worst, 1560 * MiB);
    assert.equal(floor(discoveryDay, WINDOW), 1540 * MiB);
    // Discovery uses the primary window: the full 28 days (or every mature day), never a shortened one.
    for (const model of DISCOVERY_MODELS) {
        assert.deepEqual(modelWindow(model, WINDOW), WINDOW);
        assert.deepEqual(modelWindow(model, windowFor('2026-10-26')), windowFor('2026-10-26'));
    }
});

test('discovery models get their validated parameters over the primary window', () => {
    const inputs = readInputs();
    for (const window of [WINDOW, windowFor('2026-10-26'), windowFor('2026-10-29')]) {
        for (const model of DISCOVERY_MODELS) {
            const parameters = parametersFor(renderModel(model, { project: PROJECT, property: PROPERTY, ...inputs }), modelWindow(model, window));
            assert.deepEqual(parameters.map(p => [p.name, p.parameterValue.value]),
                [['as_of_day', window.asOf], ['end_day', window.end], ['min_events', '30'], ['start_day', window.start]], model);
        }
    }
});

test('the weekly rotation runs discovery in place of RUM, carries the rest, and never runs more than seven queries', async () => {
    const days = await chain(16);
    const discoveryRuns = days.filter(day => day.ran.includes('13-article-discovery')).map(day => day.asOf);
    // Day 1 has no snapshot to carry RUM from, so discovery starts on day 2, then every seven days.
    assert.deepEqual(discoveryRuns, ['2026-11-20', '2026-11-27', '2026-12-04']);
    for (const day of days) {
        assert.equal(day.ran.length, 7, day.asOf);
        const discovery = discoveryRuns.includes(day.asOf);
        assert.equal(day.ran.includes('30-cwv-summary'), !discovery, day.asOf);
        const { payload, header } = day.snapshot;
        // Every published snapshot after day 1 has all nine models; carried ones are labelled with their own as_of.
        assert.deepEqual(Object.keys(payload.models).sort(), day.asOf === '2026-11-19'
            ? Object.keys(SNAPSHOT_MODELS).filter(model => !DISCOVERY_MODELS.includes(model)).sort() : Object.keys(SNAPSHOT_MODELS).sort(), day.asOf);
        if (discovery) {
            const yesterday = new Date(Date.parse(`${day.asOf}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
            for (const model of ROTATED_FOR_DISCOVERY) assert.deepEqual(payload.modelWindows[model], { asOf: yesterday, ...(({ start, end }) => ({ start, end }))(windowFor(yesterday)) });
            for (const model of DISCOVERY_MODELS) assert.equal(payload.modelWindows[model], undefined, 'discovery ran today, over the primary window');
        } else if (day.asOf !== '2026-11-19') {
            const ran = discoveryRuns.filter(asOf => asOf < day.asOf).at(-1);
            for (const model of DISCOVERY_MODELS) assert.deepEqual(payload.modelWindows[model], { asOf: ran, start: windowFor(ran).start, end: windowFor(ran).end }, day.asOf);
            for (const row of payload.models['13-article-discovery']) assert.deepEqual([row.from_day, row.through_day], [windowFor(ran).start, windowFor(ran).end]);
        }
        assert.equal(header.asOf, day.asOf);
    }
});

test('discovery is skipped, never forced, when RUM cannot be carried from exactly yesterday', async () => {
    // A missed schedule: no snapshot for 20 Nov, so 21 Nov cannot carry one-day-old RUM and runs the normal set.
    const days = await chain(4, { skip: ['2026-11-20'] });
    assert.deepEqual(days.map(day => [day.asOf, day.ran.includes('13-article-discovery')]),
        [['2026-11-19', false], ['2026-11-21', false], ['2026-11-22', true]]);
    // A legacy seven-model snapshot (no discovery) qualifies as soon as it is yesterday's.
    const legacy = schedule(windowFor('2026-11-20'), { header: { asOf: '2026-11-19', ...windowFor('2026-11-19') },
        payload: { models: Object.fromEntries(Object.entries(syntheticRows(windowFor('2026-11-19'))).filter(([model]) => !DISCOVERY_MODELS.includes(model))), modelWindows: {} } });
    assert.deepEqual(legacy.run.includes('13-article-discovery'), true);
    // An unreadable previous snapshot (rotated key, damage) carries nothing and runs the normal set.
    assert.deepEqual(schedule(windowFor('2026-11-20'), null).run, Object.keys(SNAPSHOT_MODELS).filter(model => !DISCOVERY_MODELS.includes(model)));
    const other = tempRoot();
    await chain(1, { root: other });
    const rotated = fakeClient(windowFor('2026-11-20'));
    await run({ client: rotated, now: new Date('2026-11-20T23:00:00Z'), root: other });
    assert.equal(rotated.calls.runs.some(r => r.jobId.includes('13_article_discovery')), false, 'a new key cannot open the old snapshot');
});

test('carried data must exactly match its own window; stale discovery is dropped, not shown as current', () => {
    const today = windowFor('2026-12-10');
    const snapshotFor = (asOf, mutate = rows => rows) => {
        const window = windowFor(asOf);
        const rows = syntheticRows(window);
        return { header: { asOf, ...window }, payload: { models: { ...rows, '13-article-discovery': mutate(rows['13-article-discovery']) },
            modelWindows: Object.fromEntries(DISCOVERY_MODELS.map(model => [model, { asOf, start: window.start, end: window.end }])) } };
    };
    // 13 days old: carried. 14 days old: dropped (pending), and RUM is not yesterday's either, so the normal set runs.
    assert.deepEqual(Object.keys(schedule(today, snapshotFor('2026-11-27')).carried), DISCOVERY_MODELS);
    assert.equal(DISCOVERY_MAX_AGE_DAYS, 13);
    assert.deepEqual(schedule(today, snapshotFor('2026-11-26')).carried, {});
    // Rows whose dates disagree with their label, or a label for a different window, are not carried.
    assert.deepEqual(schedule(today, snapshotFor('2026-12-05', rows => rows.map(row => ({ ...row, through_day: '2026-12-02' })))).carried, {});
    const relabelled = snapshotFor('2026-12-05');
    relabelled.payload.modelWindows['13-article-discovery'].start = '2026-11-08';
    assert.deepEqual(schedule(today, relabelled).carried, {});
    // A label from the future is never carried.
    assert.deepEqual(schedule(windowFor('2026-12-04'), snapshotFor('2026-12-05')).carried, {});
    assert.equal(DISCOVERY_EVERY_DAYS, 7);
});

test('discovery results fail closed like every model: pagination, missing columns, out-of-window rows', async () => {
    const rows = syntheticRows(WINDOW);
    for (const model of DISCOVERY_MODELS) {
        const result = queryResult(rows[model]);
        assert.equal(resultRows(model, result, WINDOW).length, rows[model].length);
        assert.equal(resultRows(model, { ...result, rows: [], totalRows: '0' }, WINDOW).length, 0, 'no clicks is a valid, empty result');
        assert.throws(() => resultRows(model, { ...result, pageToken: 'next' }, WINDOW), /incomplete result/);
        assert.throws(() => resultRows(model, { ...result, totalRows: String(rows[model].length + 1) }, WINDOW), /incomplete result/);
        assert.throws(() => resultRows(model, { ...result, schema: { fields: result.schema.fields.filter(f => f.name !== 'click_events') } }, WINDOW), /no click_events column/);
        assert.throws(() => resultRows(model, result, { ...WINDOW, start: '2026-10-20' }), /does not cover/);
    }
    // On a discovery day a bad discovery result fails the whole refresh: nothing is published.
    const root = tempRoot();
    const keyText = newKey();
    await chain(1, { root, keyText });
    const before = fs.readFileSync(path.join(root, SNAPSHOT_PATH), 'utf8');
    const bad = fakeClient(windowFor('2026-11-20'), { mutate: (model, result) => (model === '28-internal-navigation' ? { ...result, pageToken: 'next' } : result) });
    await assert.rejects(run({ client: bad, now: new Date('2026-11-20T23:00:00Z'), root, env: env({ DASHBOARD_SNAPSHOT_KEY: keyText }) }), /28-internal-navigation: incomplete result/);
    assert.equal(fs.readFileSync(path.join(root, SNAPSHOT_PATH), 'utf8'), before);
    // A missing export table stops a discovery day before any query, as on every day.
    const missing = fakeClient(windowFor('2026-11-20'), { missingDay: '2026-11-01' });
    await assert.rejects(run({ client: missing, now: new Date('2026-11-20T23:00:00Z'), root, env: env({ DASHBOARD_SNAPSHOT_KEY: keyText }) }), /events_20261101 is missing/);
    assert.deepEqual([missing.calls.dryRuns.length, missing.calls.runs.length], [0, 0]);
});

test('a discovery day still passes the unchanged preflight and stops on over-billing', async () => {
    const root = tempRoot();
    const keyText = newKey();
    await chain(1, { root, keyText });
    const logs = [];
    const client = fakeClient(windowFor('2026-11-20'), { processed: '1000' });
    await run({ client, now: new Date('2026-11-20T23:00:00Z'), root, env: env({ DASHBOARD_SNAPSHOT_KEY: keyText }), log: line => logs.push(line) });
    assert.ok(logs.includes('preflight passed: ≤ 1540.00 MiB of the 1600.00 MiB daily ceiling; per-query cap 400.00 MiB'), logs.join('\n'));
    assert.ok(logs.some(line => line.startsWith('running 10-article-pageviews, 11-category-pageviews, 13-article-discovery, 20-daily-activity, 26-acquisition-session, 28-internal-navigation, 29-audience-coverage; carrying 30-cwv-summary (as_of 2026-11-19), 33-rum-coverage (as_of 2026-11-19)')), logs.join('\n'));
    // Same preflight rules: an oversized discovery estimate stops everything before any query runs.
    const oversized = fakeClient(windowFor('2026-11-20'), { processed: String(400 * MiB + 1) });
    await assert.rejects(run({ client: oversized, now: new Date('2026-11-20T23:00:00Z'), root, env: env({ DASHBOARD_SNAPSHOT_KEY: keyText }) }), /per-query cap; nothing was run/);
    assert.equal(oversized.calls.runs.length, 0);
    const overbilled = fakeClient(windowFor('2026-11-20'), { billed: 900 * MiB });
    await assert.rejects(run({ client: overbilled, now: new Date('2026-11-20T23:00:00Z'), root, env: env({ DASHBOARD_SNAPSHOT_KEY: keyText }) }), /passed the daily ceiling; stopping/);
    assert.equal(overbilled.calls.runs.length, 2);
});

test('carried snapshots stay encrypted: no discovery value appears in the public envelope', async () => {
    const keyText = newKey();
    const days = await chain(3, { keyText });
    const root = tempRoot();
    await chain(2, { root, keyText });
    const text = fs.readFileSync(path.join(root, SNAPSHOT_PATH), 'utf8');
    for (const secret of ['Ταχύτερος γύρος', 'onerror', 'article_link', 'entity_hub', '13-article-discovery', '28-internal-navigation', keyText]) {
        assert.equal(text.includes(secret), false, secret);
    }
    assert.ok(days[1].snapshot.payload.models['13-article-discovery'].length);
    // A snapshot sealed under one key is unreadable under another, and tampering is rejected, not carried.
    assert.equal(openSnapshot(text, crypto.randomBytes(32)), null);
    const envelope = JSON.parse(text);
    const data = Buffer.from(envelope.data, 'base64');
    data[5] ^= 1;
    assert.equal(openSnapshot(JSON.stringify({ ...envelope, data: data.toString('base64') }), Buffer.from(keyText, 'base64')), null);
});

test('the retired I-06A API leaves no code, dependency or route behind', () => {
    assert.equal(fs.existsSync(path.join(REPO_ROOT, 'services')), false);
    const tracked = execFileSync('git', ['ls-files'], { cwd: REPO_ROOT, encoding: 'utf8' }).split('\n')
        .filter(file => /\.(?:m?js|cjs|html|json|ya?ml|css)$/.test(file) && !file.startsWith('scripts/intelligence/__tests__/') && fs.existsSync(path.join(REPO_ROOT, file)));
    const offenders = tracked.filter(file => /dashboard-api|f1s-dashboard-api|DASHBOARD_API_ORIGIN|\/api\/session|f1sdk_/.test(read(file))
        && !['scripts/quality/static-source-guard.mjs', 'scripts/build/validate-public-artifact.mjs', 'scripts/build/__tests__/security-policy.test.mjs'].includes(file));
    assert.deepEqual(offenders, []);
    assert.doesNotMatch(read('package.json'), /services\//);
});
