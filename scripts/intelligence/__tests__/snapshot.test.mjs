// I-06B encrypted snapshot: schedule, window, cost guards, fail-closed paths, encryption and publication.
// Synthetic data and generated keys only; no BigQuery, Google or GitHub request is ever made.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { readInputs, renderModel } from '../editorial-model.mjs';
import {
    DAILY_MAX_BYTES, ENABLED, MATURITY_DAYS, MAX_BYTES_BILLED, PROJECT, PROPERTY, REPORT_TIMEZONE, SNAPSHOT_MODELS, SNAPSHOT_PATH,
    WINDOW_DAYS, assertEnvelope, bigQuery, conservativeBytes, install, parametersFor, plan, preflight, refresh, resultRows,
    sealSnapshot, snapshotWindow
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

test('the window is the latest 28 mature days in the property time zone, wherever the run lands', () => {
    assert.equal(REPORT_TIMEZONE, 'America/Los_Angeles');
    assert.deepEqual(snapshotWindow(NOW), WINDOW);
    for (const [instant, asOf] of [
        ['2026-10-25T01:00:00Z', '2026-10-24'], // EU already on winter time, US still on summer time
        ['2026-11-02T01:00:00Z', '2026-11-01'], // the US change
        ['2026-03-09T01:00:00Z', '2026-03-08'],
        ['2026-03-29T00:00:00Z', '2026-03-28'],
        ['2026-11-20T07:59:00Z', '2026-11-19'], // a schedule seven hours late is still the same as_of day
        ['2026-11-20T08:00:00Z', '2026-11-20'] // after Los Angeles midnight it is the next day, never an immature one
    ]) {
        const window = snapshotWindow(new Date(instant));
        assert.equal(window.asOf, asOf, instant);
        assert.equal((Date.parse(window.asOf) - Date.parse(window.end)) / 86400000, MATURITY_DAYS);
        assert.equal((Date.parse(window.end) - Date.parse(window.start)) / 86400000 + 1, WINDOW_DAYS);
    }
    // The models' own maturity rule is the same 4 days, so the window never asks for more than they read.
    for (const model of Object.keys(SNAPSHOT_MODELS)) {
        assert.match(renderModel(model, { project: PROJECT, property: PROPERTY, ...readInputs() }), /DATE_SUB\(@as_of_day, INTERVAL 4 DAY\)/);
    }
});

test('each model gets exactly its validated parameters, and a malformed one fails closed', () => {
    const inputs = readInputs();
    const names = model => parametersFor(renderModel(model, { project: PROJECT, property: PROPERTY, ...inputs }), WINDOW).map(p => p.name);
    assert.deepEqual(names('11-category-pageviews'), ['as_of_day', 'end_day', 'min_events', 'start_day']);
    assert.deepEqual(names('20-daily-activity'), ['as_of_day', 'end_day', 'min_events', 'start_day']);
    assert.deepEqual(names('30-cwv-summary'), ['as_of_day', 'end_day', 'min_observations', 'report_timezone', 'start_day']);
    assert.deepEqual(names('33-rum-coverage'), ['as_of_day', 'end_day', 'report_timezone', 'start_day']);
    const sql = renderModel('30-cwv-summary', { project: PROJECT, property: PROPERTY, ...inputs });
    assert.deepEqual(parametersFor(sql, WINDOW).find(p => p.name === 'report_timezone'),
        { name: 'report_timezone', parameterType: { type: 'STRING' }, parameterValue: { value: 'America/Los_Angeles' } });
    assert.throws(() => parametersFor(sql, { ...WINDOW, end: '2026-11-15; DROP' }), /malformed or unknown query parameter @end_day/);
    assert.throws(() => parametersFor('SELECT @unknown_thing', WINDOW), /@unknown_thing/);
});

test('cost caps are fixed: 100 MB per query, a lower combined daily ceiling, and billable runs off', () => {
    assert.equal(ENABLED, false);
    assert.equal(MAX_BYTES_BILLED, 104857600);
    assert.ok(DAILY_MAX_BYTES < Object.keys(SNAPSHOT_MODELS).length * MAX_BYTES_BILLED);
    assert.deepEqual(Object.keys(SNAPSHOT_MODELS), ['11-category-pageviews', '20-daily-activity', '30-cwv-summary', '33-rum-coverage']);
});

test('preflight rejects oversized, per-table-minimum and combined estimates before anything runs', async () => {
    const job = (processed, tables) => ({ statistics: { query: { totalBytesProcessed: processed, referencedTables: Array(tables).fill({}) } } });
    assert.equal(conservativeBytes(job('1000', 1)).estimate, 10 * 1048576);
    assert.equal(conservativeBytes(job('1000', 28)).estimate, 280 * 1048576); // the 10 MB minimum per referenced table
    assert.throws(() => preflight([{ model: 'm', estimate: conservativeBytes(job('1000', 28)).estimate }]), /per-query cap; nothing was run/);
    assert.throws(() => preflight([{ model: 'm', estimate: MAX_BYTES_BILLED + 1 }]), /per-query cap/);
    assert.throws(() => preflight(Array(4).fill({ model: 'm', estimate: 90 * 1048576 })), /daily ceiling; nothing was run/);
    assert.throws(() => conservativeBytes({ statistics: {} }), /no byte estimate/);
    assert.throws(() => conservativeBytes(job('1e9', 1)), /no byte estimate/);

    for (const options of [{ processed: String(MAX_BYTES_BILLED + 1) }, { tables: 28 }, { processed: String(80 * 1048576) }]) {
        const client = fakeClient(WINDOW, options);
        await assert.rejects(run({ client }), /nothing was run/);
        assert.equal(client.calls.dryRuns.length, 4);
        assert.equal(client.calls.runs.length, 0);
    }
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
    // Billable refreshes are off: a scheduled run plans nothing and never reads its configuration.
    assert.equal(plan({ mode: 'refresh', env: {}, now: NOW, root: tempRoot() }).due, false);
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
    assert.deepEqual([dry.calls.tables.length, dry.calls.dryRuns.length, dry.calls.runs.length], [WINDOW_DAYS, 4, 0]);
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
    assert.equal(client.calls.runs.length, 4);
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
        assert.equal(request.body.configuration.query.maximumBytesBilled, '104857600');
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
    assert.deepEqual(JSON.parse(JSON.stringify(payload.models)), syntheticRows(WINDOW));
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
    // Only the encrypted envelope is uploaded.
    assert.deepEqual([...workflow.matchAll(/\n\s+path: ([^\n]+)/g)].map(m => m[1]), ['${{ runner.temp }}/snapshot.json', '${{ runner.temp }}/snapshot']);

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
    assert.doesNotMatch(workflow, /pull_request|push:|workflow_run|repository_dispatch/);
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
