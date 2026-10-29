// I-06E: synthetic metadata, generated keys and mocked fetch only. Never contact GitHub or Google.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { deflateRawSync } from 'node:zlib';
import {
    CONFIG, LABEL, CATEGORIES, PUBLIC_SNAPSHOT, assessHealth, scheduleClock, cleanOperation, envelopeMetadata,
    escapeMarkdown, formatSummary, planIncidents, reader, collectEvidence, operationFromZip, loadIssues, executeIncidents, exitCode
} from '../health-check.mjs';
import {
    operationalSummary, refresh, sealSnapshot, windowFor, propertyDay, SNAPSHOT_MODELS, DISCOVERY_MODELS,
    ROTATED_FOR_DISCOVERY, STALE_MS, MAX_BYTES_BILLED, DAILY_MAX_BYTES, SNAPSHOT_PATH, PAYLOAD_FORMAT, openSnapshot, schedule
} from '../snapshot.mjs';
import { fakeClient, syntheticRows } from './snapshot-fixture.mjs';

const NOW = '2026-11-20T09:10:00.000Z'; // 11:10 Athens, LA 01:10; schedule ran for LA Nov 19.
const AS_OF = '2026-11-19';
const GENERATED = '2026-11-20T06:37:10.000Z';
const ok = value => ({ ok: true, value });
const copy = value => structuredClone(value);
const subtract = (day, days) => new Date(Date.parse(day) - days * 86400000).toISOString().slice(0, 10);
const modelIds = Object.keys(SNAPSHOT_MODELS);
const url = id => `https://github.com/example/repo/actions/runs/${id}`;
function envelope(asOf = AS_OF, generatedAt = GENERATED) {
    return sealSnapshot({}, crypto.randomBytes(32), { window: windowFor(asOf), generatedAt });
}
function operation({ asOf = AS_OF, observedAt = GENERATED, discovery = false, age = 1 } = {}) {
    const value = operationalSummary({ mode: 'refresh', now: new Date(observedAt) });
    value.window = windowFor(asOf);
    value.stage = 'ok';
    value.outcome = 'success';
    value.runModels = modelIds.filter(model => !(discovery ? ROTATED_FOR_DISCOVERY : DISCOVERY_MODELS).includes(model));
    value.carriedModels = (discovery ? ROTATED_FOR_DISCOVERY : DISCOVERY_MODELS).map(model => ({ model, asOf: subtract(asOf, discovery ? 1 : age) }));
    value.queries = value.runModels.map(model => ({ model, estimateBytes: 60 * 1048576, billedBytes: 10 * 1048576 }));
    value.estimateBytes = 420 * 1048576;
    value.billedBytes = 70 * 1048576;
    value.queryCount = 7;
    return value;
}
function run(id = 2, changes = {}) {
    return { id, run_attempt: 1, event: 'schedule', status: 'completed', conclusion: 'success',
        created_at: GENERATED, run_started_at: GENERATED, html_url: url(id), ...changes };
}
function evidence() {
    const snapshot = envelope();
    return { runs: ok([run(), run(1, { created_at: '2026-11-19T06:30:00Z', run_started_at: '2026-11-19T06:30:00Z' })]),
        operations: { 2: ok(operation()), 1: ok(operation({ asOf: '2026-11-18', observedAt: '2026-11-19T06:30:00Z' })) },
        repoSnapshot: ok(snapshot), publicSnapshot: ok(snapshot), jobs: { 2: ok([{ name: 'Commit the encrypted snapshot', conclusion: 'success' }]) },
        pagesRuns: ok([run(3, { event: 'workflow_dispatch', created_at: '2026-11-20T06:45:00Z', run_started_at: '2026-11-20T06:45:00Z' })]),
        pagesJobs: { 3: ok([{ name: 'Deploy Pages artifact', conclusion: 'success' }]) }, issuesEnabled: true };
}
const assess = (value = evidence(), now = NOW, config = {}) => assessHealth(value, { now, config });
const state = (report, name) => report.components[name].status;
const incident = (report, id) => report.incidents.find(item => item.id === id);

test('the operations runbook covers every exported incident category and assessed component', () => {
    const runbook = fs.readFileSync(new URL('../../../docs/intelligence/operations.md', import.meta.url), 'utf8');
    for (const name of [...Object.keys(CATEGORIES), ...Object.keys(assessHealth({}, { now: NOW }).components)]) {
        assert.ok(runbook.includes(`\`${name}\``), `runbook must document ${name}`);
    }
});

test('healthy normal day reconciles all stages, reporting clocks and actual byte telemetry', () => {
    const value = evidence();
    const before = copy(value);
    const report = assess(value);
    assert.deepEqual(assess(value), report, 'the same evidence and clock give the same assessment');
    assert.deepEqual(value, before, 'the core does not mutate evidence');
    assert.equal(report.overall, 'HEALTHY');
    assert.deepEqual(report.unknownComponents, []);
    assert.equal(report.expected.asOf, AS_OF);
    assert.equal(propertyDay(new Date(NOW)), '2026-11-20', 'now in LA differs from the scheduled reporting day');
    assert.equal(report.incidents.length, 9);
    assert.equal(report.cost.billedBytes, 70 * 1048576);
    assert.match(formatSummary(report), /Estimate 420.00 MiB; actual billed 70.00 MiB/);
    assert.match(formatSummary(report), /NOT VERIFIED/);
    assert.equal(exitCode(report), 0);
});

test('healthy Discovery day intentionally carries yesterday’s RUM', () => {
    const value = evidence();
    value.operations[2] = ok(operation({ discovery: true }));
    const report = assess(value);
    assert.equal(report.overall, 'HEALTHY');
    assert.match(report.components.discovery.detail, /Discovery ages 0d, 0d/);
    assert.match(report.components.discovery.detail, /RUM ages at publication 1d, 1d/);
});

for (const age of [1, 7, 13, 14]) {
    test(`Discovery carry age ${age} days respects the 13-day boundary without daily weekly warnings`, () => {
        const value = evidence();
        value.operations[2] = ok(operation({ age }));
        const report = assess(value);
        assert.equal(state(report, 'discovery'), age > 13 ? 'CRITICAL' : 'HEALTHY');
        assert.equal(incident(report, 'discovery-overdue').status, age > 13 ? 'CRITICAL' : 'HEALTHY');
    });
}

test('absent Discovery with no age evidence is UNKNOWN; known expired Discovery dropped by the producer remains critical', () => {
    const value = evidence();
    value.operations[2].value.carriedModels = [];
    value.operations[1].value = operation({ asOf: subtract(AS_OF, 14), observedAt: '2026-11-06T06:30:00Z', discovery: true });
    assert.equal(state(assess(value), 'discovery'), 'CRITICAL');
    delete value.operations[1];
    assert.equal(state(assess(value), 'discovery'), 'UNKNOWN');
});

test('Discovery expiry survives bounded history using yesterday’s validated carried model dates', () => {
    const value = evidence();
    value.operations[2].value.carriedModels = [];
    value.operations[1] = ok(operation({ asOf: subtract(AS_OF, 1), observedAt: '2026-11-19T06:30:00Z', age: 13 }));
    const report = assess(value);
    assert.equal(state(report, 'discovery'), 'CRITICAL');
    assert.equal(incident(report, 'discovery-overdue').status, 'CRITICAL');
    assert.match(report.components.discovery.detail, /Discovery ages 14d, 14d/);
    value.operations[1].value.carriedModels[0].asOf = 'not-a-day';
    assert.equal(state(assess(value), 'discovery'), 'UNKNOWN', 'invalid carry evidence is rejected');
});

test('snapshot-key rotation with recent historical Discovery leaves absent current Discovery UNKNOWN', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-health-rotation-'));
    try {
        const value = evidence();
        const file = path.join(root, SNAPSHOT_PATH);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const oldKey = crypto.randomBytes(32);
        const previousWindow = windowFor('2026-11-18');
        const previous = sealSnapshot({ format: PAYLOAD_FORMAT, models: syntheticRows(previousWindow) }, oldKey,
            { window: previousWindow, generatedAt: '2026-11-19T06:30:00.000Z' });
        assert.deepEqual(Object.keys(schedule(windowFor(AS_OF), openSnapshot(previous, oldKey)).carried), DISCOVERY_MODELS, 'the intact prior key would allow Discovery carry');
        fs.writeFileSync(file, previous);
        const now = new Date(GENERATED);
        const summary = operationalSummary({ mode: 'refresh', now });
        const env = { DASHBOARD_SNAPSHOT_KEY: crypto.randomBytes(32).toString('base64'), BIGQUERY_ACCESS_TOKEN: 'synthetic-secret',
            WIF_PROVIDER: 'projects/123456/locations/global/workloadIdentityPools/github/providers/f1s',
            WIF_SERVICE_ACCOUNT: 'snapshot@f1-stories-analytics.iam.gserviceaccount.com' };
        const snapshot = await refresh({ mode: 'refresh', env, now, root, client: fakeClient(windowFor(AS_OF)), summary, log() {} });
        assert.equal(summary.runModels.length, 7);
        assert.ok(DISCOVERY_MODELS.every(model => !summary.runModels.includes(model)));
        assert.deepEqual(summary.carriedModels, [], 'rotated key prevents carry');
        value.repoSnapshot = value.publicSnapshot = ok(snapshot);
        value.operations[2] = ok(summary);
        value.operations[1] = ok(operation({ asOf: '2026-11-18', observedAt: '2026-11-19T06:30:00Z', discovery: true }));
        const report = assess(value);
        assert.equal(state(report, 'discovery'), 'UNKNOWN');
        assert.equal(incident(report, 'discovery-overdue').status, 'UNKNOWN');
        assert.notEqual(report.overall, 'HEALTHY');
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('recent historical Discovery cannot close an overdue incident without current run or carry evidence', () => {
    const value = evidence();
    value.operations[2] = ok(operation({ age: 14 }));
    const action = planIncidents([], assess(value)).find(item => item.category === 'discovery-overdue');
    const issue = { number: 42, state: 'open', labels: [LABEL], body: action.body };
    value.operations[2].value.carriedModels = [];
    value.operations[1] = ok(operation({ asOf: '2026-11-18', observedAt: '2026-11-19T06:30:00Z', discovery: true }));
    assert.deepEqual(planIncidents([issue], assess(value)).filter(item => item.category === 'discovery-overdue'), []);
    for (const discovery of [false, true]) {
        value.operations[2] = ok(operation({ discovery }));
        const recovery = planIncidents([issue], assess(value)).find(item => item.category === 'discovery-overdue');
        assert.equal(recovery.type, 'close', 'current Discovery run or carry establishes recovery');
        assert.ok(recovery.body.includes(url(2)));
    }
});

test('duplicate as_of skip reuses only matching published telemetry; no query work is inferred from the no-op', () => {
    const value = evidence();
    value.runs.value.unshift(run(4, { run_started_at: '2026-11-20T06:55:00Z' }));
    const skipped = operationalSummary({ mode: 'refresh', now: new Date(GENERATED) });
    skipped.window = windowFor(AS_OF);
    skipped.stage = 'plan_skipped';
    skipped.outcome = 'skipped';
    value.operations[4] = ok(skipped);
    value.jobs[4] = ok([{ name: 'Commit the encrypted snapshot', conclusion: 'skipped' }]);
    assert.equal(assess(value).overall, 'HEALTHY');
    delete value.operations[2];
    assert.equal(state(assess(value), 'bigquery'), 'UNKNOWN');
    assert.equal(state(assess(value), 'costGuard'), 'UNKNOWN');
});

test('a delayed but successful schedule degrades only schedule; observed 5.5h delay is tolerated', () => {
    const value = evidence();
    value.runs.value[0].run_started_at = '2026-11-20T07:30:00Z';
    assert.equal(state(assess(value), 'schedule'), 'DEGRADED');
    assert.equal(state(assess(value), 'publication'), 'HEALTHY');
    assert.equal(state(assess(), 'schedule'), 'HEALTHY');
});

test('missing schedule: grace, warning, then critical; manual dry-run never counts as recovery', () => {
    const value = evidence();
    value.runs.value = [];
    for (const [now, expected] of [['2026-11-20T08:59:00Z', 'HEALTHY'], ['2026-11-20T09:00:00Z', 'DEGRADED'], ['2026-11-20T13:00:00Z', 'CRITICAL']]) {
        assert.equal(state(assess(value, now), 'schedule'), expected);
    }
    value.runs.value = [run(2, { event: 'workflow_dispatch' })];
    value.operations[2].value.mode = 'dry-run';
    assert.equal(state(assess(value, '2026-11-20T15:00:00Z'), 'schedule'), 'CRITICAL');
    value.operations[2].value.mode = 'refresh';
    assert.equal(state(assess(value, '2026-11-20T15:00:00Z'), 'schedule'), 'HEALTHY');
});

for (const event of ['schedule', 'workflow_dispatch']) {
    test(`a new day’s grace carries an unresolved missing-run incident until a covering ${event} appears`, () => {
        const value = evidence();
        value.runs.value = [];
        const report = assess(value, '2026-11-20T15:00:00Z');
        assert.equal(incident(report, 'schedule-missing').status, 'CRITICAL');
        const action = planIncidents([], report).find(item => item.category === 'schedule-missing');
        const issue = { number: 42, state: 'open', labels: [LABEL], body: action.body };
        const grace = assess(value, '2026-11-21T06:00:00Z');
        assert.equal(state(grace, 'schedule'), 'HEALTHY', 'fresh grace without an incident stays healthy');
        assert.deepEqual(planIncidents([], grace).filter(item => item.category === 'schedule-missing'), []);
        assert.deepEqual(planIncidents([issue], grace).filter(item => item.category === 'schedule-missing'), [], 'carry the existing state without closing or commenting');
        value.runs.value = [run(4, { event, created_at: '2026-11-21T06:10:00Z', run_started_at: '2026-11-21T06:10:00Z' })];
        value.operations[4] = ok(operation({ asOf: '2026-11-20', observedAt: '2026-11-21T06:20:00Z' }));
        value.repoSnapshot = ok(envelope('2026-11-20', '2026-11-21T06:20:00.000Z'));
        const recovered = assess(value, '2026-11-21T06:30:00Z');
        const closed = planIncidents([issue], recovered).find(item => item.category === 'schedule-missing');
        assert.equal(closed.type, 'close');
        assert.ok(closed.body.includes(url(4)), 'observed run is recovery evidence');
        assert.match(closed.body, /2026-11-21T06:10:00Z/);
        assert.match(closed.body, /First detected: 2026-11-20T15:00:00.000Z/);
    });
}

test('truncated run history and missing API evidence never imply a missing or healthy execution', () => {
    const value = evidence();
    value.runs.value = Array.from({ length: 30 }, (_, i) => run(i + 10, { event: 'workflow_dispatch' }));
    assert.equal(state(assess(value), 'schedule'), 'UNKNOWN');
    value.runs = { ok: false };
    assert.equal(state(assess(value), 'schedule'), 'UNKNOWN');
    assert.ok(assess(value).unknownComponents.includes('schedule'));
});

for (const stage of ['configuration', 'authentication', 'export_tables', 'dry_run', 'preflight', 'query', 'result_validation', 'encryption']) {
    test(`failed ${stage} is attributed by code path, with no error text copied`, () => {
        const value = evidence();
        value.runs.value[0].conclusion = 'failure';
        const op = value.operations[2].value;
        op.stage = stage;
        op.outcome = 'failure';
        op.error = 'token=secret SELECT visitor_id raw analytics';
        const report = assess(value);
        assert.equal(state(report, 'refresh'), 'CRITICAL');
        assert.equal(state(report, 'bigquery'), ['authentication', 'export_tables', 'dry_run', 'query', 'result_validation'].includes(stage) ? 'CRITICAL' : 'UNKNOWN');
        if (stage === 'preflight') assert.equal(state(report, 'costGuard'), 'CRITICAL');
        assert.match(report.components.refresh.detail, new RegExp(stage));
        assert.doesNotMatch(JSON.stringify(report), /token=secret|SELECT|visitor_id/);
        assert.equal(exitCode(report), 1);
    });
}

test('successful queries with failed publication retain independent query and envelope status', () => {
    const value = evidence();
    value.runs.value[0].conclusion = 'failure';
    value.jobs[2].value[0].conclusion = 'failure';
    const report = assess(value);
    assert.equal(state(report, 'bigquery'), 'HEALTHY');
    assert.equal(state(report, 'publication'), 'CRITICAL');
    assert.equal(state(report, 'snapshot'), 'HEALTHY');
    assert.equal(incident(report, 'publication-failed').previousSnapshotAvailable, true);
});

test('failed envelope upload is publication failure even if publish never starts', () => {
    const value = evidence();
    value.jobs[2] = ok([{ name: 'Query and encrypt', conclusion: 'failure', steps: [{ name: 'Upload the encrypted envelope', conclusion: 'failure' }] }]);
    assert.equal(state(assess(value), 'publication'), 'CRITICAL');
});

test('completed refresh missing in the repository escalates after publication grace', () => {
    const value = evidence();
    value.runs.value[0].status = 'in_progress';
    value.runs.value[0].conclusion = null;
    value.repoSnapshot = ok(envelope('2026-11-18', '2026-11-19T06:30:00.000Z'));
    value.publicSnapshot = value.repoSnapshot;
    assert.equal(state(assess(value), 'publication'), 'CRITICAL');
    assert.equal(state(assess(value, '2026-11-20T06:50:00Z'), 'publication'), 'DEGRADED');
});

test('a repository rollback after a no-op is caught from earlier successful publication evidence', () => {
    const value = evidence();
    const skipped = operationalSummary({ mode: 'refresh', now: new Date(GENERATED) });
    Object.assign(skipped, { window: windowFor(AS_OF), stage: 'plan_skipped', outcome: 'skipped' });
    value.runs.value.unshift(run(4, { run_started_at: '2026-11-20T06:55:00Z' }));
    value.operations[4] = ok(skipped);
    value.jobs[4] = ok([]);
    value.repoSnapshot = value.publicSnapshot = ok(envelope('2026-11-18', '2026-11-19T06:30:00.000Z'));
    assert.equal(state(assess(value), 'publication'), 'CRITICAL');
});

test('an unavailable publication job read cannot produce healthy overall status or recovery', () => {
    const value = evidence();
    value.jobs[2] = { ok: false };
    assert.equal(state(assess(value), 'publication'), 'UNKNOWN');
    assert.equal(assess(value).overall, 'UNKNOWN');
});

test('publication success followed by failed deployment is critical', () => {
    const value = evidence();
    value.pagesRuns.value[0].conclusion = 'failure';
    assert.equal(state(assess(value), 'publication'), 'HEALTHY');
    assert.equal(state(assess(value), 'pages'), 'CRITICAL');
});

test('cancelled deployment superseded by a newer successful deployment is healthy', () => {
    const value = evidence();
    value.pagesRuns.value.push(run(5, { conclusion: 'cancelled', run_started_at: '2026-11-20T06:40:00Z' }));
    assert.equal(state(assess(value), 'pages'), 'HEALTHY');
    value.pagesRuns.value[1].run_started_at = '2026-11-20T07:30:00Z';
    assert.equal(state(assess(value), 'pages'), 'CRITICAL', 'an older success does not excuse a new cancellation');
});

test('public envelope lag and missing deployment escalate only after explicit Pages grace', () => {
    const value = evidence();
    value.publicSnapshot = ok(envelope('2026-11-18', '2026-11-19T06:30:00.000Z'));
    assert.equal(state(assess(value, '2026-11-20T07:00:00Z'), 'pages'), 'UNKNOWN');
    assert.equal(state(assess(value, '2026-11-20T08:00:00Z'), 'pages'), 'DEGRADED');
    assert.equal(state(assess(value, '2026-11-20T10:00:00Z'), 'pages'), 'CRITICAL');
});

test('one flipped public ciphertext byte with identical headers is critical Pages divergence', () => {
    const value = evidence();
    const damaged = JSON.parse(value.publicSnapshot.value);
    const data = Buffer.from(damaged.data, 'base64');
    data[0] ^= 1;
    damaged.data = data.toString('base64');
    value.publicSnapshot = ok(JSON.stringify(damaged));
    assert.equal(damaged.header, JSON.parse(value.repoSnapshot.value).header);
    const report = assess(value, '2026-11-20T06:50:00Z');
    assert.equal(report.overall, 'CRITICAL', 'equal headers cannot hide a damaged public copy, even inside Pages grace');
    assert.equal(incident(report, 'pages-failed').status, 'CRITICAL');
    assert.match(report.components.pages.detail, /digest/i);
    assert.doesNotMatch(incident(report, 'pages-failed').action, /decrypt/i);
    const output = `${JSON.stringify(report)}${formatSummary(report)}${JSON.stringify(planIncidents([], report))}`;
    for (const text of [damaged.data, JSON.parse(value.repoSnapshot.value).data]) assert.ok(!output.includes(text));
});

test('canonical envelope digests cover header, nonce and ciphertext and validate metadata-only replay', () => {
    const value = evidence();
    const { header, iv, data } = JSON.parse(value.publicSnapshot.value);
    const meta = envelopeMetadata(value.publicSnapshot.value);
    assert.equal(meta.digest, crypto.createHash('sha256').update(JSON.stringify({ header, iv, data })).digest('hex'));
    assert.deepEqual(envelopeMetadata(meta), meta);
    value.publicSnapshot.value = JSON.stringify({ data, iv, header });
    assert.equal(assess(value).overall, 'HEALTHY', 'outer whitespace and key order do not change canonical envelope contents');
    for (const field of ['header', 'iv', 'data']) {
        const changed = { header, iv, data };
        if (field === 'header') changed.header = JSON.stringify({ ...JSON.parse(header), keyCheck: 'A'.repeat(22) });
        else {
            const bytes = Buffer.from(changed[field], 'base64');
            bytes[0] ^= 1;
            changed[field] = bytes.toString('base64');
        }
        assert.notEqual(envelopeMetadata(JSON.stringify(changed)).digest, meta.digest);
    }
    for (const invalid of [{ ...meta, digest: 'not-a-digest' }, { ...meta, asOf: '2026-02-30' }, { ...meta, end: meta.asOf }, { ...meta, data }]) {
        assert.throws(() => envelopeMetadata(invalid));
    }
});

test('successful Pages gate without an actual deployment is not healthy; missing jobs remain UNKNOWN', () => {
    const value = evidence();
    value.pagesJobs[3].value = [{ name: 'Scheduled refresh gate', conclusion: 'success' }];
    assert.notEqual(state(assess(value), 'pages'), 'HEALTHY');
    value.pagesJobs[3] = { ok: false };
    assert.equal(state(assess(value, '2026-11-20T14:00:00Z'), 'pages'), 'UNKNOWN');
});

test('missing public snapshot is UNKNOWN; malformed envelope is critical and cannot prove recovery', () => {
    const value = evidence();
    value.publicSnapshot = { ok: false };
    assert.equal(state(assess(value), 'snapshot'), 'UNKNOWN');
    assert.equal(incident(assess(value), 'snapshot-stale').previousSnapshotAvailable, null);
    value.publicSnapshot = ok('{}');
    assert.equal(state(assess(value), 'snapshot'), 'CRITICAL');
    assert.equal(incident(assess(value), 'snapshot-stale').status, 'CRITICAL');
});

test('future timestamps, invalid calendar dates, immature windows and repository regressions fail metadata checks', () => {
    const base = evidence();
    for (const change of [meta => { meta.generatedAt = '2026-11-21T10:00:00.000Z'; }, meta => { meta.generatedAt = '2026-02-30T10:00:00.000Z'; }, meta => { meta.end = meta.asOf; }]) {
        const value = copy(base);
        const env = JSON.parse(value.publicSnapshot.value);
        const meta = JSON.parse(env.header);
        change(meta);
        env.header = JSON.stringify(meta);
        value.publicSnapshot.value = JSON.stringify(env);
        assert.equal(state(assess(value), 'snapshot'), 'CRITICAL');
    }
    base.repoSnapshot = ok(envelope('2026-11-18', '2026-11-19T06:30:00.000Z'));
    assert.equal(state(assess(base), 'publication'), 'CRITICAL');
});

test('freshness matches the dashboard’s strictly greater than 48h boundary', () => {
    const value = evidence();
    const old = '2026-11-18T09:10:00.000Z';
    value.publicSnapshot = ok(envelope('2026-11-18', old));
    assert.equal(state(assess(value), 'freshness'), 'DEGRADED');
    assert.equal(state(assess(value, '2026-11-20T09:10:00.001Z'), 'freshness'), 'CRITICAL');
    const dashboard = fs.readFileSync(new URL('../../../dashboard/dashboard.js', import.meta.url), 'utf8');
    const expression = dashboard.match(/var STALE_MS = ([^;]+);/)[1];
    assert.equal(STALE_MS, Number(expression.split('*').map(Number).reduce((a, b) => a * b)));
});

test('a newly generated envelope cannot disguise reporting data two scheduled days behind', () => {
    const value = evidence();
    value.publicSnapshot = ok(envelope('2026-11-17', GENERATED));
    assert.equal(state(assess(value), 'freshness'), 'CRITICAL');
});

test('freshness grace excuses only the currently due day and cannot close an older missing-day incident', () => {
    const value = evidence();
    value.repoSnapshot = value.publicSnapshot = ok(envelope('2026-11-18', '2026-11-19T06:37:10.000Z'));
    const report = assess(value, '2026-11-20T15:00:00Z');
    assert.equal(state(report, 'freshness'), 'DEGRADED');
    const action = planIncidents([], report).find(item => item.category === 'snapshot-stale');
    const issue = { number: 42, state: 'open', labels: [LABEL], body: action.body };
    const grace = assess(value, '2026-11-21T06:00:00Z');
    assert.equal(state(grace, 'freshness'), 'DEGRADED');
    assert.deepEqual(planIncidents([issue], grace).filter(item => item.category === 'snapshot-stale'), [], 'no close, reopen or unchanged-state comment');
    value.publicSnapshot = ok(envelope('2026-11-18', '2026-11-21T06:05:00.000Z'));
    assert.equal(state(assess(value, '2026-11-21T06:10:00Z'), 'freshness'), 'DEGRADED', 'resealing the same missing reporting day is not recovery');
    value.publicSnapshot = { ok: false };
    assert.deepEqual(planIncidents([issue], assess(value, '2026-11-21T06:10:00Z')).filter(item => item.category === 'snapshot-stale'), []);
    value.repoSnapshot = value.publicSnapshot = ok(envelope('2026-11-19', '2026-11-21T06:15:00.000Z'));
    const recovered = assess(value, '2026-11-21T06:20:00Z');
    assert.equal(state(recovered, 'freshness'), 'HEALTHY', 'the prior missing day is covered; today’s due day is still in grace');
    const closed = planIncidents([issue], recovered).find(item => item.category === 'snapshot-stale');
    assert.equal(closed.type, 'close');
    assert.ok(closed.body.includes(escapeMarkdown('as_of 2026-11-19')));
});

test('freshness grace retains the previous expected reporting day across Athens autumn DST', () => {
    const value = evidence();
    value.publicSnapshot = ok(envelope('2026-10-23', '2026-10-25T06:00:00.000Z'));
    assert.equal(state(assess(value, '2026-10-26T06:00:00Z'), 'freshness'), 'DEGRADED');
});

for (const [component, category, stage] of [['bigquery', 'bigquery-failed', 'query'], ['costGuard', 'cost-preflight', 'preflight']]) {
    test(`${component} cannot recover by reusing older successful telemetry after a failed or unknown refresh`, () => {
        const value = evidence();
        value.runs.value.unshift(run(4, { conclusion: 'failure', run_started_at: '2026-11-20T07:00:00Z' }));
        value.operations[4] = ok({ ...operation({ observedAt: '2026-11-20T07:00:00Z' }), stage, outcome: 'failure' });
        const action = planIncidents([], assess(value)).find(item => item.category === category);
        const issue = { number: 42, state: 'open', labels: [LABEL], body: action.body };
        value.runs.value.unshift(run(5, { run_started_at: '2026-11-20T07:30:00Z' }));
        value.operations[5] = ok({ ...operationalSummary({ mode: 'refresh', now: new Date('2026-11-20T07:30:00Z') }), stage: 'plan_skipped', outcome: 'skipped' });
        assert.notEqual(state(assess(value), component), 'HEALTHY');
        assert.ok(!planIncidents([issue], assess(value)).some(item => item.category === category && item.type === 'close'));
        delete value.operations[4];
        assert.equal(state(assess(value), component), 'UNKNOWN');
        assert.deepEqual(planIncidents([issue], assess(value)).filter(item => item.category === category), []);
        value.runs.value.unshift(run(6, { run_started_at: '2026-11-20T08:00:00Z' }));
        value.operations[6] = ok(operation({ observedAt: '2026-11-20T08:00:00Z' }));
        const recovered = planIncidents([issue], assess(value)).find(item => item.category === category);
        assert.equal(recovered.type, 'close');
        assert.ok(recovered.body.includes(url(6)));
    });
}

test('a skipped refresh without a covering repository snapshot cannot resolve a refresh failure', () => {
    const value = evidence();
    value.runs.value[0].conclusion = 'failure';
    const action = planIncidents([], assess(value)).find(item => item.category === 'refresh-failed');
    const issue = { number: 42, state: 'open', labels: [LABEL], body: action.body };
    value.runs.value[0].conclusion = 'success';
    value.operations[2] = ok({ ...operationalSummary({ mode: 'refresh', now: new Date(GENERATED) }), stage: 'plan_skipped', outcome: 'skipped' });
    value.repoSnapshot = { ok: false };
    assert.equal(state(assess(value), 'refresh'), 'UNKNOWN');
    assert.deepEqual(planIncidents([issue], assess(value)).filter(item => item.category === 'refresh-failed'), []);
    value.repoSnapshot = value.publicSnapshot;
    assert.equal(planIncidents([issue], assess(value)).find(item => item.category === 'refresh-failed').type, 'close');
});

test('missing publish-job observation cannot resolve a publication failure', () => {
    const value = evidence();
    value.jobs[2].value[0].conclusion = 'failure';
    const action = planIncidents([], assess(value)).find(item => item.category === 'publication-failed');
    const issue = { number: 42, state: 'open', labels: [LABEL], body: action.body };
    value.jobs[2] = ok([]);
    assert.equal(state(assess(value), 'publication'), 'UNKNOWN');
    assert.deepEqual(planIncidents([issue], assess(value)).filter(item => item.category === 'publication-failed'), []);
    value.jobs[2] = ok([{ name: 'Commit the encrypted snapshot', conclusion: 'success' }]);
    assert.equal(planIncidents([issue], assess(value)).find(item => item.category === 'publication-failed').type, 'close');
});

test('a successful Pages gate cannot hide an unresolved deployment failure behind an older success', () => {
    const value = evidence();
    value.pagesRuns.value[0].conclusion = 'failure';
    value.pagesRuns.value.push(run(4, { run_started_at: '2026-11-20T06:40:00Z' }));
    value.pagesJobs[4] = ok([{ name: 'Deploy Pages artifact', conclusion: 'success' }]);
    const action = planIncidents([], assess(value)).find(item => item.category === 'pages-failed');
    const issue = { number: 42, state: 'open', labels: [LABEL], body: action.body };
    value.pagesRuns.value.unshift(run(5, { run_started_at: '2026-11-20T07:00:00Z' }));
    value.pagesJobs[5] = ok([{ name: 'Scheduled refresh gate', conclusion: 'success' }]);
    assert.equal(state(assess(value), 'pages'), 'CRITICAL');
    assert.deepEqual(planIncidents([issue], assess(value)).filter(item => item.category === 'pages-failed'), []);
    value.pagesRuns.value.unshift(run(6, { run_started_at: '2026-11-20T07:30:00Z' }));
    value.pagesJobs[6] = ok([{ name: 'Deploy Pages artifact', conclusion: 'success' }]);
    const recovered = planIncidents([issue], assess(value)).find(item => item.category === 'pages-failed');
    assert.equal(recovered.type, 'close');
    assert.ok(recovered.body.includes(url(6)));
});

test('losing an older failed run cannot resolve consecutive failures while the latest refresh still fails', () => {
    const value = evidence();
    value.runs.value.forEach(item => { item.conclusion = 'failure'; });
    value.runs.value.push(run(0, { run_started_at: '2026-11-18T06:30:00Z' }));
    value.operations[0] = ok(operation({ asOf: '2026-11-17', observedAt: '2026-11-18T06:30:00Z' }));
    const action = planIncidents([], assess(value)).find(item => item.category === 'repeated-failures');
    const issue = { number: 42, state: 'open', labels: [LABEL], body: action.body };
    value.runs.value = value.runs.value.filter(item => item.id !== 1);
    assert.equal(state(assess(value), 'repeated'), 'UNKNOWN');
    assert.deepEqual(planIncidents([issue], assess(value)).filter(item => item.category === 'repeated-failures'), []);
    value.runs.value.unshift(run(4, { run_started_at: '2026-11-20T07:00:00Z' }));
    value.operations[4] = ok(operation({ observedAt: '2026-11-20T07:00:00Z' }));
    assert.equal(planIncidents([issue], assess(value)).find(item => item.category === 'repeated-failures').type, 'close');
});

for (const category of Object.keys(CATEGORIES)) {
    test(`${category} requires explicit positive recovery evidence to close`, () => {
        const failed = assess();
        incident(failed, category).status = 'CRITICAL';
        const action = planIncidents([], failed).find(item => item.category === category);
        const issue = { number: 42, state: 'open', labels: [LABEL], body: action.body };
        const unproven = assess();
        delete incident(unproven, category).recoveryObserved;
        assert.deepEqual(planIncidents([issue], unproven).filter(item => item.category === category), []);
        assert.equal(planIncidents([issue], assess()).find(item => item.category === category).type, 'close');
    });
}

for (const [component, category, remove] of [
    ['schedule', 'schedule-missing', value => { value.runs = { ok: false }; }],
    ['bigquery', 'bigquery-failed', value => { delete value.operations[2]; }],
    ['snapshot', 'snapshot-stale', value => { value.publicSnapshot = { ok: false }; }],
    ['publication', 'publication-failed', value => { value.jobs[2] = { ok: false }; }],
    ['pages', 'pages-failed', value => { value.pagesJobs[3] = { ok: false }; }],
    ['freshness', 'snapshot-stale', value => { value.publicSnapshot = { ok: false }; }],
    ['discovery', 'discovery-overdue', value => { value.operations[2].value.carriedModels = []; }],
    ['costGuard', 'cost-preflight', value => { value.operations[2].value.billedBytes = null; }],
    ['refresh', 'refresh-failed', value => { delete value.operations[2]; }],
    ['repeated', 'repeated-failures', value => { delete value.operations[2]; }]
]) {
    test(`${component} missing evidence stays UNKNOWN and cannot close its incident`, () => {
        const failed = assess();
        incident(failed, category).status = 'CRITICAL';
        const action = planIncidents([], failed).find(item => item.category === category);
        const issue = { number: 42, state: 'open', labels: [LABEL], body: action.body };
        const value = evidence();
        remove(value);
        const unknown = assess(value);
        assert.equal(state(unknown, component), 'UNKNOWN');
        assert.deepEqual(planIncidents([issue], unknown).filter(item => item.category === category), []);
    });
}

for (const [ratio, status] of [[0.49, 'HEALTHY'], [0.5, 'HEALTHY'], [0.8, 'DEGRADED'], [1, 'CRITICAL'], [1.01, 'CRITICAL']]) {
    test(`cost threshold ${ratio * 100}% uses estimated and billed bytes separately`, () => {
        const value = evidence();
        const op = value.operations[2].value;
        const each = Math.floor(DAILY_MAX_BYTES * ratio / 7);
        op.queries.forEach(q => { q.estimateBytes = each; });
        op.queries[0].estimateBytes += Math.round(DAILY_MAX_BYTES * ratio) - each * 7;
        op.estimateBytes = op.queries.reduce((sum, q) => sum + q.estimateBytes, 0);
        const report = assess(value);
        assert.equal(state(report, 'costGuard'), status);
        assert.equal(report.cost.billedBytes, 70 * 1048576);
        assert.equal(report.components.costGuard.detail.includes('INFO:'), ratio >= 0.5);
    });
}

test('query cap, changed cap and excess query attempts are critical guard violations', () => {
    for (const mutate of [op => { op.queries[0].billedBytes = MAX_BYTES_BILLED + 1; }, op => { op.dailyCapBytes++; }, op => { op.queryCount++; }]) {
        const value = evidence();
        mutate(value.operations[2].value);
        assert.equal(state(assess(value), 'costGuard'), 'CRITICAL');
    }
});

test('missing or inconsistent billed telemetry is UNKNOWN and never replaced by estimates', () => {
    const value = evidence();
    value.operations[2].value.billedBytes = null;
    assert.equal(state(assess(value), 'costGuard'), 'UNKNOWN');
    assert.match(formatSummary(assess(value)), /actual billed UNKNOWN/);
    value.operations[2].value.billedBytes = 0;
    assert.equal(state(assess(value), 'costGuard'), 'UNKNOWN');
    delete value.operations[2];
    assert.equal(state(assess(value), 'bigquery'), 'UNKNOWN');
});

test('run attempts are deduplicated; two distinct consecutive failed executions alert and success recovers', () => {
    const value = evidence();
    value.runs.value.forEach(item => { item.conclusion = 'failure'; });
    value.runs.value.unshift(run(2, { conclusion: 'failure', run_attempt: 2 }));
    assert.equal(state(assess(value), 'repeated'), 'CRITICAL');
    value.runs.value[0].conclusion = 'success';
    assert.equal(state(assess(value), 'repeated'), 'HEALTHY');
    value.runs.value = value.runs.value.slice(0, 2);
    assert.equal(state(assess(value), 'repeated'), 'UNKNOWN', 'one execution retried is not two failed days');
});

test('unknown latest execution cannot resolve a previous consecutive-failure incident', () => {
    const value = evidence();
    value.runs.value.unshift(run(9, { run_started_at: '2026-11-20T07:00:00Z' }));
    assert.equal(state(assess(value), 'repeated'), 'UNKNOWN');
    value.jobs[9] = ok([{ name: 'Query and encrypt', steps: [{ name: 'Authenticate to Google Cloud (Workload Identity Federation, no key file)', conclusion: 'failure' }] }]);
    assert.equal(state(assess(value), 'bigquery'), 'CRITICAL', 'failed auth step survives an unavailable artifact');
});

test('incident manager creates once, comments only on severity transitions and closes with positive recovery evidence', () => {
    const value = evidence();
    value.jobs[2].value[0].conclusion = 'failure';
    const report = assess(value);
    const actions = planIncidents([], report);
    const action = actions.find(item => item.category === 'publication-failed');
    assert.equal(action.type, 'create');
    const issue = { number: 42, state: 'open', labels: [{ name: LABEL }], body: action.body, comments: 0 };
    assert.deepEqual(planIncidents([issue], report).filter(item => item.category === action.category), []);
    const unknown = copy(report);
    incident(unknown, action.category).status = 'UNKNOWN';
    assert.equal(planIncidents([issue], unknown).length, 0);
    const warning = copy(report);
    incident(warning, action.category).status = 'DEGRADED';
    const transition = planIncidents([issue], warning)[0];
    assert.equal(transition.type, 'comment');
    issue.commentsData = [{ body: transition.body, user: { login: 'github-actions[bot]' } }];
    assert.equal(planIncidents([issue], warning).length, 0);
    issue.commentsData.push({ body: '<!-- intelligence-health-state:CRITICAL -->', user: { login: 'untrusted-commenter' } });
    assert.equal(planIncidents([issue], warning).length, 0, 'public comments cannot forge bot state transitions');
    const recovered = planIncidents([issue], assess())[0];
    assert.equal(recovered.type, 'close');
    for (const field of ['Category:', 'First detected:', 'Latest observed:', 'Stage:', 'Workflow URL:', 'recovery evidence:', 'Next action:', 'Previous snapshot remains available:']) assert.ok(recovered.body.includes(field));
    assert.match(recovered.body, /Default branch contains/);
    issue.commentsData.push({ body: recovered.body, user: { login: 'github-actions[bot]' } });
    assert.equal(planIncidents([issue], assess())[0].body, null, 'a failed close is retried without another recovery notification');
    assert.equal(planIncidents([{ ...issue, labels: [] }], report)[0].type, 'create');
});

test('malicious run titles, logs, API errors and issue bodies never become public report fields', () => {
    const value = evidence();
    const malicious = '<script>token-secret</script>\n@everyone [click](https://evil.example) | table';
    value.runs.value[0].display_title = malicious;
    value.runs.value[0].logs = malicious;
    value.operations[2].value.analytics = { visitor_id: 'private-visitor', count: 987654 };
    value.operations[2].value.token = 'credential-secret';
    value.runs.value[0].html_url = 'https://evil.example/token-secret';
    const report = assess(value);
    const output = `${formatSummary(report)}${JSON.stringify(report)}${JSON.stringify(planIncidents([], report))}`;
    assert.doesNotMatch(output, /script|token-secret|@everyone|evil.example|private-visitor|credential-secret|987654/);
    assert.equal(escapeMarkdown('<img>\n[x](y)|'), '&lt;img&gt; \\[x\\]\\(y\\)\\|');
    const changed = copy(report);
    incident(changed, 'publication-failed').status = 'CRITICAL';
    incident(changed, 'publication-failed').detail = malicious;
    assert.doesNotMatch(planIncidents([], changed)[0].body, /<script>|\[click\]\(/);
    assert.doesNotMatch(JSON.stringify(cleanOperation(value.operations[2].value)), /analytics|token|visitor/);
    assert.doesNotMatch(JSON.stringify(envelopeMetadata(value.publicSnapshot.value)), /keyCheck|data|iv/);
});

const clockCases = [
    ['2026-03-28T12:00:00Z', '2026-03-28T01:00:00.000Z', '2026-03-27'],
    ['2026-03-29T12:00:00Z', '2026-03-28T01:00:00.000Z', '2026-03-27'], // Athens spring gap: no 03:00 occurrence
    ['2026-03-30T12:00:00Z', '2026-03-30T00:00:00.000Z', '2026-03-29'],
    ['2026-10-25T12:00:00Z', '2026-10-25T00:00:00.000Z', '2026-10-24'], // first of two 03:00 occurrences
    ['2026-10-26T12:00:00Z', '2026-10-26T01:00:00.000Z', '2026-10-25'],
    ['2026-03-08T12:00:00Z', '2026-03-08T01:00:00.000Z', '2026-03-07'], // LA spring
    ['2026-11-01T12:00:00Z', '2026-11-01T01:00:00.000Z', '2026-10-31'], // LA fall
    ['2028-02-29T12:00:00Z', '2028-02-29T01:00:00.000Z', '2028-02-28'],
    ['2028-03-01T12:00:00Z', '2028-03-01T01:00:00.000Z', '2028-02-29'],
    ['2027-01-01T12:00:00Z', '2027-01-01T01:00:00.000Z', '2026-12-31'],
    ['2027-02-01T00:30:00Z', '2027-01-31T01:00:00.000Z', '2027-01-30']
];
for (const [now, scheduledAt, asOf] of clockCases) {
    test(`three clocks at ${now}`, () => {
        assert.deepEqual(scheduleClock(new Date(now)), { scheduledAt, asOf });
        const window = windowFor(asOf);
        assert.equal(Date.parse(asOf) - Date.parse(window.end), 4 * 86400000);
    });
}
for (const [before, after, expectedBefore, expectedAfter] of [
    ['2026-03-08T09:59:59Z', '2026-03-08T10:00:00Z', '2026-03-08', '2026-03-08'],
    ['2026-11-01T08:59:59Z', '2026-11-01T09:00:00Z', '2026-11-01', '2026-11-01'],
    ['2028-03-01T07:59:59Z', '2028-03-01T08:00:00Z', '2028-02-29', '2028-03-01']
]) {
    test(`LA reporting day across ${after}`, () => {
        assert.equal(propertyDay(new Date(before)), expectedBefore);
        assert.equal(propertyDay(new Date(after)), expectedAfter);
    });
}

// Minimal single-file ZIP fixture, both stored and deflated, without an archive dependency.
function zipOperation(value, { method = 8, name = 'intelligence-operation.json' } = {}) {
    const text = Buffer.from(JSON.stringify(value));
    const content = method === 8 ? deflateRawSync(text) : text;
    const filename = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(text.length, 22);
    local.writeUInt16LE(filename.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(content.length, 20);
    central.writeUInt32LE(text.length, 24);
    central.writeUInt16LE(filename.length, 28);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50);
    end.writeUInt16LE(1, 8);
    end.writeUInt16LE(1, 10);
    end.writeUInt32LE(central.length + filename.length, 12);
    end.writeUInt32LE(local.length + filename.length + content.length, 16);
    return Buffer.concat([local, filename, content, central, filename, end]);
}

test('artifact reader accepts stored/deflated single metadata file; rejects paths, oversized output and invalid archives', () => {
    for (const method of [0, 8]) assert.deepEqual(operationFromZip(zipOperation(operation(), { method })), cleanOperation(operation()));
    assert.throws(() => operationFromZip(zipOperation(operation(), { name: '../intelligence-operation.json' })));
    assert.throws(() => operationFromZip(zipOperation({ ...operation(), extra: 'x'.repeat(70000) })));
    assert.throws(() => operationFromZip(Buffer.alloc(10)));
});

for (const status of [401, 403, 404, 500, 502, 503]) {
    test(`API HTTP ${status} yields UNKNOWN, bounded retries and no provider error leakage`, async () => {
        let calls = 0;
        const read = reader({ token: 'mock-token', config: { readTimeoutMs: 20 }, fetch: async () => {
            calls++;
            return new Response('secret provider detail', { status });
        } });
        const result = await read('https://api.github.com/mock');
        assert.equal(result.ok, false);
        assert.equal(calls, status >= 500 ? 2 : 1);
        assert.doesNotMatch(JSON.stringify(result), /secret/);
        const value = evidence();
        value.runs = result;
        assert.equal(state(assess(value), 'schedule'), 'UNKNOWN');
    });
}

test('API timeout includes stalled body and fetch mocks that ignore abort; successful retry is bounded', async () => {
    let calls = 0;
    const timedOut = reader({ token: 'test', config: { readTimeoutMs: 5 }, fetch: async () => { calls++; return new Promise(() => {}); } });
    assert.equal((await timedOut('https://api.github.com/mock')).ok, false);
    assert.equal(calls, 2);
    const stalled = reader({ token: 'test', config: { readTimeoutMs: 5 }, fetch: async () => new Response(new ReadableStream({ start() {} })) });
    assert.equal((await stalled('https://api.github.com/mock')).ok, false);
    calls = 0;
    const retried = reader({ token: 'test', fetch: async () => { calls++; return calls === 1 ? new Response('', { status: 503 }) : Response.json({ recovered: true }); } });
    assert.deepEqual(await retried('https://api.github.com/mock'), ok({ recovered: true }));
    assert.equal(calls, 2);
});

test('credential-free public GET, default-branch contents, attempt-specific artifacts and jobs are read without logs or writes', async () => {
    const requests = [];
    const text = envelope();
    const fetch = async (request, options) => {
        requests.push({ url: request, options });
        assert.equal(options.method, undefined);
        if (request === PUBLIC_SNAPSHOT) {
            assert.deepEqual(options.headers, {});
            return new Response(text);
        }
        assert.equal(options.headers.Authorization, 'Bearer mock-token');
        if (request.endsWith('/repos/example/repo')) return Response.json({ default_branch: 'main', has_issues: true });
        if (request.includes('/contents/')) {
            assert.ok(request.endsWith('?ref=main'));
            return Response.json({ encoding: 'base64', content: Buffer.from(text).toString('base64') });
        }
        if (request.includes('/workflows/intelligence-snapshot.yml/')) return Response.json({ workflow_runs: evidence().runs.value });
        if (request.includes('/workflows/deploy-pages.yml/')) return Response.json({ workflow_runs: evidence().pagesRuns.value });
        if (/\/workflows\/(publish-blog|auto-merge-dependencies|auto-publish-author-pr)\.yml\//.test(request)) return Response.json({ workflow_runs: [] });
        if (request.includes('/runs/3/') && request.includes('/jobs?')) return Response.json({ jobs: [{ name: 'Deploy Pages artifact', conclusion: 'success' }] });
        if (request.includes('/jobs?')) return Response.json({ jobs: [{ name: 'Commit the encrypted snapshot', conclusion: 'success' }] });
        if (request.includes('/runs/') && request.includes('/artifacts?')) {
            const id = Number(request.match(/\/runs\/(\d+)/)[1]);
            return Response.json({ artifacts: [{ id: id + 100, name: `intelligence-operation-${id}-1` }] });
        }
        if (request.endsWith('/zip')) {
            const id = Number(request.match(/\/artifacts\/(\d+)/)[1]) - 100;
            return new Response(zipOperation(id === 2 ? operation() : operation({ asOf: '2026-11-18', observedAt: '2026-11-19T06:30:00Z' })));
        }
        assert.fail(request);
    };
    const value = await collectEvidence({ repo: 'example/repo', token: 'mock-token', fetch });
    assert.equal(assess(value).overall, 'HEALTHY');
    assert.ok(requests.some(request => request.url.includes('/attempts/1/jobs?')));
    assert.equal(requests.filter(request => request.url === PUBLIC_SNAPSHOT).length, 1);
    assert.ok(requests.every(request => !request.url.includes('/logs')));
});

for (const [workflow, prefix] of [
    ['publish-blog.yml', 'Deploy site once'], ['auto-merge-dependencies.yml', 'deploy'],
    ['auto-publish-author-pr.yml', 'Build and deploy article / Deploy site once']
]) {
    test(`a cancelled direct Pages deploy recovers through ${workflow} only with a successful actual deploy`, async () => {
        const fixture = evidence();
        const direct = run(3, { conclusion: 'cancelled', run_started_at: '2026-11-20T06:40:00Z' });
        const publishing = run(4, { event: 'push', created_at: '2026-11-20T06:30:00Z', run_started_at: '2026-11-20T06:30:00Z' });
        let callerRuns = [publishing];
        let deployConclusion = 'success';
        const requests = [];
        const fetch = async (request, options) => {
            requests.push(request);
            assert.equal(options.method, undefined, 'all GitHub calls are read-only');
            if (request === PUBLIC_SNAPSHOT) return new Response(fixture.publicSnapshot.value);
            assert.equal(options.headers.Authorization, 'Bearer mock-token');
            if (request.endsWith('/repos/example/repo')) return Response.json({ default_branch: 'main', has_issues: true });
            if (request.includes('/contents/')) return Response.json({ encoding: 'base64', content: Buffer.from(fixture.repoSnapshot.value).toString('base64') });
            if (request.includes('/workflows/intelligence-snapshot.yml/')) return Response.json({ workflow_runs: [] });
            if (request.includes('/workflows/deploy-pages.yml/')) return Response.json({ workflow_runs: [direct] });
            if (request.includes(`/workflows/${workflow}/`)) return Response.json({ workflow_runs: callerRuns });
            if (/\/workflows\/(publish-blog|auto-merge-dependencies|auto-publish-author-pr)\.yml\//.test(request)) return Response.json({ workflow_runs: [] });
            if (request.includes('/runs/3/attempts/1/jobs?')) return Response.json({ jobs: [{ name: 'Deploy Pages artifact', conclusion: 'cancelled' }] });
            if (request.includes('/runs/4/attempts/1/jobs?')) return Response.json({ jobs: [
                { name: `${prefix} / Build Pages artifact`, conclusion: 'success' },
                { name: `${prefix} / Deploy Pages artifact`, conclusion: deployConclusion, started_at: '2026-11-20T06:50:00Z' }
            ] });
            assert.fail(request);
        };
        const collect = () => collectEvidence({ repo: 'example/repo', token: 'mock-token', fetch });
        const recovered = await collect();
        assert.equal(state(assess(recovered), 'pages'), 'HEALTHY');
        assert.equal(incident(assess(recovered), 'pages-failed').status, 'HEALTHY');
        assert.ok(requests.some(request => request.includes(`/workflows/${workflow}/runs?branch=main&per_page=30`)));
        assert.ok(requests.some(request => request.includes('/runs/4/attempts/1/jobs?')));
        assert.deepEqual(recovered.pagesJobs[4].value.map(job => job.name), ['', 'Deploy Pages artifact'], 'only the recognized deploy name reaches evidence');
        assert.equal(assess(recovered).components.pages.url, url(4));
        assert.equal(assess(recovered).components.pages.observedAt, '2026-11-20T06:50:00.000Z', 'deployment job time, not caller start, determines supersession');
        deployConclusion = 'skipped';
        assert.equal(state(assess(await collect()), 'pages'), 'CRITICAL', 'caller success with skipped deploy cannot supersede cancellation');
        callerRuns = [];
        assert.equal(state(assess(await collect()), 'pages'), 'CRITICAL', 'cancellation without later successful deployment remains a failure');
    });
}

test('Issue reads paginate and load state comments; failures suppress decisions instead of creating duplicates', async () => {
    const action = planIncidents([], (() => { const report = assess(); incident(report, 'schedule-missing').status = 'CRITICAL'; return report; })())[0];
    const issue = { number: 42, state: 'open', labels: [LABEL], body: action.body, comments: 1 };
    const seen = [];
    const issues = await loadIssues({ repo: 'example/repo', token: 'mock', fetch: async request => {
        seen.push(request);
        return Response.json(request.includes('/comments?') ? [{ body: '<!-- intelligence-health-state:DEGRADED -->' }] : [issue]);
    } });
    assert.equal(issues[0].commentsData.length, 1);
    assert.equal(seen.length, 2);
    await assert.rejects(loadIssues({ repo: 'example/repo', token: 'mock', fetch: async () => new Response('', { status: 403 }) }), /writes suppressed/);
});

test('incident executor uses only Issue endpoints, comments before closing, and never retries a write', async () => {
    const requests = [];
    const actions = [{ type: 'create', title: 'title', body: 'body' }, { type: 'comment', number: 1, body: 'transition' }, { type: 'close', number: 1, body: 'recovered' }];
    await executeIncidents(actions, { repo: 'example/repo', token: 'mock', fetch: async (url, options) => {
        if (!options.method) return Response.json({ name: LABEL });
        requests.push([url, options.method, JSON.parse(options.body)]);
        return Response.json({});
    } });
    assert.deepEqual(requests.map(item => item[1]), ['POST', 'POST', 'POST', 'PATCH']);
    assert.equal(requests[0][2].labels[0], LABEL);
    let calls = 0;
    await assert.rejects(executeIncidents(actions, { repo: 'example/repo', token: 'mock', fetch: async () => { calls++; return new Response('', { status: 500 }); } }));
    assert.equal(calls, 2, 'only the read is retried; no Issue write starts');
    calls = 0;
    await assert.rejects(executeIncidents(actions, { repo: 'example/repo', token: 'mock', fetch: async (url, options) => {
        if (!options.method) return Response.json({ name: LABEL });
        calls++;
        return new Response('', { status: 500 });
    } }));
    assert.equal(calls, 1, 'writes are never retried');
});

test('the incident label is provisioned only when absent, before creating the first Issue', async () => {
    const requests = [];
    await executeIncidents([{ type: 'create', title: 'title', body: 'body' }], { repo: 'example/repo', token: 'mock', fetch: async (url, options) => {
        requests.push([url, options.method]);
        return !options.method ? new Response('', { status: 404 }) : Response.json({});
    } });
    assert.deepEqual(requests.map(item => item[1]), [undefined, 'POST', 'POST']);
    assert.ok(requests[1][0].endsWith('/labels'));
    assert.ok(requests[2][0].endsWith('/issues'));
});

test('CLI JSON is a single document, dry-run never writes, job summary is Markdown, critical alone exits nonzero', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-health-cli-'));
    try {
        const input = path.join(root, 'evidence.json');
        const preload = path.join(root, 'fetch.mjs');
        const summary = path.join(root, 'summary.md');
        fs.writeFileSync(preload, `globalThis.fetch = async (url, options = {}) => {
            if (options.method) throw new Error('test forbids writes');
            return Response.json([]);
        };\n`);
        const env = { PATH: process.env.PATH, GITHUB_REPOSITORY: 'example/repo', GITHUB_TOKEN: 'mock-secret', GITHUB_STEP_SUMMARY: summary };
        const cli = value => {
            fs.writeFileSync(input, JSON.stringify({ observedAt: NOW, evidence: value }));
            try {
                return { code: 0, report: JSON.parse(execFileSync(process.execPath, ['--import', preload, 'scripts/intelligence/health-check.mjs', `--incidents=${input}`, '--dry-run', '--json'], { env, encoding: 'utf8' })) };
            } catch (error) { return { code: error.status, report: JSON.parse(error.stdout) }; }
        };
        assert.equal(cli(evidence()).code, 0);
        const value = evidence();
        value.jobs[2].value[0].conclusion = 'failure';
        const critical = cli(value);
        assert.equal(critical.code, 1);
        assert.equal(critical.report.incidentSync, 'DRY_RUN');
        assert.ok(critical.report.incidentPlan.some(item => item.type === 'create'));
        assert.doesNotMatch(JSON.stringify(critical.report), /mock-secret/);
        const unknown = cli({});
        assert.equal(unknown.code, 0);
        assert.equal(unknown.report.overall, 'UNKNOWN');
        assert.equal(unknown.report.incidentSync, 'UNKNOWN');
        assert.match(fs.readFileSync(summary, 'utf8'), /\| Component \| Status \| Last evidence \|/);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('collector API failures and malformed public JSON stay independent and cannot produce healthy recovery', async () => {
    const value = await collectEvidence({ repo: 'example/repo', token: 'mock', fetch: async () => new Response('', { status: 403 }) });
    assert.equal(assess(value).overall, 'UNKNOWN');
    assert.equal(assess(value).unknownComponents.length, 10);
    const read = await reader({ fetch: async () => new Response('{broken') })(PUBLIC_SNAPSHOT, { publicRead: true });
    const synthetic = evidence();
    synthetic.publicSnapshot = read;
    assert.equal(state(assess(synthetic), 'snapshot'), 'CRITICAL');
});

test('CLI evidence artifact contains only safe metadata and replays the exact assessment in the isolated Issue job', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-health-artifact-'));
    try {
        const fixture = evidence();
        fixture.runs.value[0].display_title = 'private-visitor raw-secret-token';
        fixture.jobs[2].value[0].steps = [{ name: 'private-visitor', conclusion: 'raw-secret-token' }];
        fixture.operations[2].value.extra = 'private-visitor raw-secret-token';
        const fixturePath = path.join(root, 'fixture.json');
        const preload = path.join(root, 'fetch.mjs');
        const output = path.join(root, 'evidence.json');
        const keyCheck = JSON.parse(JSON.parse(fixture.publicSnapshot.value).header).keyCheck;
        fs.writeFileSync(fixturePath, JSON.stringify({ fixture, archives: {
            101: zipOperation(fixture.operations[1].value).toString('base64'), 102: zipOperation(fixture.operations[2].value).toString('base64')
        } }));
        fs.writeFileSync(preload, `import fs from 'node:fs';
            const RealDate = Date;
            globalThis.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [${JSON.stringify(NOW)}])); } };
            const { fixture: f, archives } = JSON.parse(fs.readFileSync(${JSON.stringify(fixturePath)}, 'utf8'));
            globalThis.fetch = async (url, options = {}) => {
                if (options.method) throw new Error('test forbids writes');
                if (url === ${JSON.stringify(PUBLIC_SNAPSHOT)}) return new Response(f.publicSnapshot.value);
                if (url.endsWith('/repos/example/repo')) return Response.json({ default_branch: 'main', has_issues: true });
                if (url.includes('/contents/')) return Response.json({ encoding: 'base64', content: Buffer.from(f.repoSnapshot.value).toString('base64') });
                if (url.includes('/workflows/intelligence-snapshot.yml/')) return Response.json({ workflow_runs: f.runs.value });
                if (url.includes('/workflows/deploy-pages.yml/')) return Response.json({ workflow_runs: f.pagesRuns.value });
                if (/\\/workflows\\/(publish-blog|auto-merge-dependencies|auto-publish-author-pr)\\.yml\\//.test(url)) return Response.json({ workflow_runs: [] });
                const id = Number(url.match(/\\/runs\\/(\\d+)/)?.[1]);
                if (url.includes('/jobs?')) return Response.json({ jobs: (id === 3 ? f.pagesJobs : f.jobs)[id]?.value || [] });
                if (url.includes('/artifacts?')) return Response.json({ artifacts: [{ id: id + 100, name: 'intelligence-operation-' + id + '-1' }] });
                if (url.endsWith('/zip')) return new Response(Buffer.from(archives[Number(url.match(/\\/artifacts\\/(\\d+)/)[1])], 'base64'));
                throw new Error('unexpected read');
            };\n`);
        let report;
        const args = ['--import', preload, 'scripts/intelligence/health-check.mjs', '--dry-run', '--json', `--out=${output}`];
        const env = { PATH: process.env.PATH, GITHUB_REPOSITORY: 'example/repo', GITHUB_TOKEN: 'raw-secret-token' };
        try { report = JSON.parse(execFileSync(process.execPath, args, { env, encoding: 'utf8' })); }
        catch (error) { report = JSON.parse(error.stdout); }
        const savedText = fs.readFileSync(output, 'utf8');
        assert.doesNotMatch(savedText, /private-visitor|raw-secret-token|display_title|extra/);
        assert.ok(!savedText.includes(keyCheck), 'key check and ciphertext are unnecessary for replay');
        const saved = JSON.parse(savedText);
        assert.deepEqual(assessHealth(saved.evidence, { now: saved.observedAt }).components, report.components);
        assert.equal(report.overall, 'HEALTHY');
        assert.equal(report.incidentSync, 'NOT_REQUESTED');

        const damaged = JSON.parse(fixture.publicSnapshot.value);
        const data = Buffer.from(damaged.data, 'base64');
        data[0] ^= 1;
        damaged.data = data.toString('base64');
        fixture.publicSnapshot.value = JSON.stringify(damaged);
        const source = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
        source.fixture = fixture;
        fs.writeFileSync(fixturePath, JSON.stringify(source));
        try { report = JSON.parse(execFileSync(process.execPath, args, { env, encoding: 'utf8' })); }
        catch (error) { report = JSON.parse(error.stdout); }
        assert.equal(state(report, 'pages'), 'CRITICAL');
        const damagedSavedText = fs.readFileSync(output, 'utf8');
        for (const text of [damaged.data, JSON.parse(fixture.repoSnapshot.value).data, keyCheck]) assert.ok(!damagedSavedText.includes(text));
        const damagedSaved = JSON.parse(damagedSavedText);
        const replayed = assessHealth(damagedSaved.evidence, { now: damagedSaved.observedAt });
        assert.deepEqual(replayed.components, report.components, 'digest divergence survives metadata-only artifact replay');
        assert.equal(incident(replayed, 'pages-failed').status, 'CRITICAL');
        const action = planIncidents([], replayed).find(item => item.category === 'pages-failed');
        assert.equal(action.type, 'create');
        assert.match(action.body, /digest/i);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('producer telemetry reports executed models, estimates, actual billing and carry with no SQL, rows or credentials', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-health-producer-'));
    try {
        const now = new Date('2026-10-29T06:37:10Z');
        const env = { DASHBOARD_SNAPSHOT_KEY: crypto.randomBytes(32).toString('base64'), BIGQUERY_ACCESS_TOKEN: 'synthetic-secret',
            WIF_PROVIDER: 'projects/123456/locations/global/workloadIdentityPools/github/providers/f1s',
            WIF_SERVICE_ACCOUNT: 'snapshot@f1-stories-analytics.iam.gserviceaccount.com' };
        const summary = operationalSummary({ mode: 'refresh', now });
        await refresh({ mode: 'refresh', env, now, root, client: fakeClient(windowFor(propertyDay(now))), summary, log() {} });
        assert.equal(summary.stage, 'ok');
        assert.equal(summary.outcome, 'success');
        assert.equal(summary.queryCount, 7);
        assert.equal(summary.billedBytes, 70 * 1048576);
        assert.equal(summary.runModels.length, 7);
        assert.equal(cleanOperation(summary).stage, 'ok');
        assert.doesNotMatch(JSON.stringify(summary), /synthetic-secret|SELECT|page_view_events|rows|tableId|keyCheck/);
        const failed = operationalSummary({ mode: 'refresh', now });
        await assert.rejects(refresh({ mode: 'refresh', env, now, root, client: fakeClient(windowFor(propertyDay(now)), { missingDay: '2026-10-19' }), summary: failed, log() {} }));
        assert.equal(failed.stage, 'export_tables');
        assert.equal(failed.queryCount, 0);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('producer CLI writes failure metadata and classifies external authentication outcome without provider text', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-health-cli-'));
    try {
        const file = path.join(root, 'operation.json');
        const env = { PATH: process.env.PATH, SNAPSHOT_SUMMARY_PATH: file };
        assert.throws(() => execFileSync(process.execPath, ['scripts/intelligence/snapshot.mjs', 'plan', '--mode=dry-run'], { env, stdio: 'pipe' }));
        assert.equal(JSON.parse(fs.readFileSync(file)).stage, 'configuration');
        assert.equal(JSON.parse(fs.readFileSync(file)).outcome, 'failure');
        fs.writeFileSync(file, JSON.stringify(operationalSummary({ mode: 'refresh', now: new Date(GENERATED) })));
        execFileSync(process.execPath, ['scripts/intelligence/snapshot.mjs', 'finalize-summary'], { env: { ...env, AUTH_OUTCOME: 'failure' } });
        assert.equal(JSON.parse(fs.readFileSync(file)).stage, 'authentication');
        assert.equal(JSON.parse(fs.readFileSync(file)).outcome, 'failure');
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('finalizing without a plan summary records unknown and cannot establish healthy execution', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-health-missing-summary-'));
    try {
        const file = path.join(root, 'intelligence-operation.json');
        assert.equal(fs.existsSync(file), false);
        execFileSync(process.execPath, ['scripts/intelligence/snapshot.mjs', 'finalize-summary'], {
            env: { PATH: process.env.PATH, MODE: 'refresh', SNAPSHOT_SUMMARY_PATH: file }
        });
        const summary = JSON.parse(fs.readFileSync(file, 'utf8'));
        assert.equal(summary.stage, 'configuration');
        assert.equal(summary.outcome, 'unknown');
        const value = evidence();
        value.operations[2] = ok(summary);
        assert.equal(state(assess(value), 'refresh'), 'UNKNOWN');
        // Keep valid mode/window evidence to check that unknown itself is accepted, never treated as success.
        const unknown = { ...operationalSummary({ mode: 'refresh', now: new Date(GENERATED) }),
            stage: summary.stage, outcome: summary.outcome };
        assert.equal(cleanOperation(unknown).outcome, 'unknown');
        value.operations[2] = ok(unknown);
        const report = assess(value);
        for (const name of ['refresh', 'bigquery', 'costGuard']) assert.equal(state(report, name), 'UNKNOWN');
        assert.notEqual(report.overall, 'HEALTHY');
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('watchdog workflow has two timezone schedules, serialized jobs, read-only collection and isolated Issues writes', () => {
    const read = file => fs.readFileSync(new URL(`../../../${file}`, import.meta.url), 'utf8');
    const workflow = read('.github/workflows/intelligence-health.yml');
    assert.deepEqual([...workflow.matchAll(/- cron: '([^']+)'\n\s+timezone: ([^\n]+)/g)].map(m => [m[1], m[2]]), [['0 11 * * *', 'Europe/Athens'], ['0 17 * * *', 'Europe/Athens']]);
    assert.match(workflow, /workflow_dispatch:[\s\S]+dry-run:[\s\S]+default: true/);
    assert.match(workflow, /^permissions: \{\}$/m);
    assert.match(workflow, /group: intelligence-health\n\s+cancel-in-progress: false/);
    const [assessJob, incidentJob] = workflow.split('\n  assess:\n')[1].split('\n  incidents:\n');
    assert.deepEqual([...assessJob.matchAll(/^ {6}([a-z-]+): (read|write)$/gm)].map(m => m[0].trim()), ['contents: read', 'actions: read']);
    assert.deepEqual([...incidentJob.matchAll(/^ {6}([a-z-]+): (read|write)$/gm)].map(m => m[0].trim()), ['contents: read', 'actions: read', 'issues: write']);
    assert.doesNotMatch(workflow, /id-token|google-github|secrets\.|environment:|actions: write|contents: write|dispatches|gh api|workflow_run|repository_dispatch/);
    for (const match of workflow.matchAll(/uses: ([^\s]+)/g)) assert.match(match[1], /@[0-9a-f]{40}$/);
    assert.match(assessJob, /--dry-run --json --out=/);
    assert.match(incidentJob, /always\(\)/);
    assert.match(read('.github/workflows/quality.yml'), /npm run test:intelligence/);
    const producer = read('.github/workflows/intelligence-snapshot.yml');
    assert.match(producer, /name: Upload operational metadata\n\s+if: \$\{\{ always\(\) \}\}/);
    assert.match(producer, /name: intelligence-operation-\$\{\{ github.run_id \}\}-\$\{\{ github.run_attempt \}\}/);
    assert.equal(CONFIG.scheduleGraceMs, 8 * 3600000);
    assert.equal(CONFIG.scheduleCriticalMs, 12 * 3600000);
});
