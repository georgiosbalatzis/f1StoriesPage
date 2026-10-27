#!/usr/bin/env node
// snapshot.mjs — I-06B daily encrypted Intelligence snapshot (docs/intelligence/dashboard-snapshots.md).
// Runs four existing models, rendered by editorial-model.mjs and never redefined here, over the latest mature
// days: 28, or every mature day since the export began while there are fewer. Every query is dry-run and costed first, then runs under a hard maximumBytesBilled, at most once per
// day. The aggregate rows exist only in memory and leave this process only as an AES-256-GCM envelope.
// Rows, keys and tokens are never printed.
//
//   node scripts/intelligence/snapshot.mjs plan --mode=dry-run|refresh        (no network; writes GITHUB_OUTPUT)
//   node scripts/intelligence/snapshot.mjs refresh --mode=dry-run|refresh --out=<envelope file>
//   node scripts/intelligence/snapshot.mjs install <envelope file>            (publishes it only if valid and newer)
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PARAMETERS, RUM_MODELS, queryParameters, readInputs, renderModel } from './editorial-model.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Enabled with owner approval after a successful authenticated BigQuery dry-run (2026-10-27).
// Keep the four model allowlist, mandatory cost preflight and 400 MiB per-query / 1600 MiB daily caps.
export const ENABLED = true;
export const PROJECT = 'f1-stories-analytics';
export const PROPERTY = '485678890';
export const LOCATION = 'EU';
export const REPORT_TIMEZONE = 'America/Los_Angeles'; // the property's time zone: GA4 names daily tables in it
export const WINDOW_DAYS = 28; // at most; fewer while the export is younger than that
export const EXPORT_START = '2026-10-19'; // the first GA4 daily export table; no earlier day exists
export const MATURITY_DAYS = 4; // base.sql: days newer than as_of_day - 4 may still change
export const MIN_SAMPLE = 30; // @min_events and @min_observations, as in the model docs
// On-demand pricing bills at least 10 MiB per referenced table, so 28-29 daily tables bill >= 280-290 MiB.
export const MIN_BYTES_PER_TABLE = 10 * 1024 * 1024;
export const MAX_BYTES_BILLED = 400 * 1024 * 1024; // per query, enforced by BigQuery
export const DAILY_MAX_BYTES = 1600 * 1024 * 1024; // all queries of one refresh: planned by estimate, then by billed bytes
export const SNAPSHOT_PATH = 'dashboard/data/snapshot.json';
export const ENVELOPE_FORMAT = 'f1s-dashboard-snapshot';
export const PAYLOAD_FORMAT = 'f1s-dashboard-snapshot-payload';
export const KEY_CHECK_LABEL = 'f1s-dashboard-snapshot-key-check-v1\u0000';

// Columns the dashboard reads; a result without them is incomplete. Exact row counts where the model fixes them.
export const SNAPSHOT_MODELS = {
    '11-category-pageviews': { columns: ['category', 'page_view_events', 'articles_with_events', 'catalog_articles', 'meets_min_events'] },
    '20-daily-activity': { columns: ['event_day', 'page_view_events', 'session_start_events', 'first_visit_events', 'meets_min_events'], rows: 'days' },
    '30-cwv-summary': { columns: ['cohort_truncated', 'coverage', 'metric', 'core_web_vital', 'observations', 'p75', 'good', 'needs_improvement', 'poor', 'good_share', 'meets_min_observations'], rows: 15 },
    '33-rum-coverage': { columns: ['cohort_truncated', 'stage', 'category', 'count'] }
};

const API = 'https://bigquery.googleapis.com/bigquery/v2';
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const MAX_ENVELOPE_BYTES = 1024 * 1024;
const HEADER_KEYS = ['format', 'v', 'alg', 'generatedAt', 'asOf', 'start', 'end', 'keyCheck'];

const addDays = (day, days) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const mib = bytes => `${(bytes / 1024 / 1024).toFixed(2)} MiB`;

// The calendar day in the property time zone: the as_of_day the models expect.
export function propertyDay(now, timeZone = REPORT_TIMEZONE) {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

// The latest mature days for an as_of day: through as_of_day - MATURITY_DAYS, at most WINDOW_DAYS of them, and
// none before EXPORT_START. Before the first export day has matured, start is after end (no window).
export function windowFor(asOf) {
    const end = addDays(asOf, -MATURITY_DAYS);
    const earliest = addDays(end, -(WINDOW_DAYS - 1));
    return { asOf, start: earliest > EXPORT_START ? earliest : EXPORT_START, end };
}

export const snapshotWindow = now => windowFor(propertyDay(now));
export const windowDays = window => (Date.parse(window.end) - Date.parse(window.start)) / 86400000 + 1;

// Daily tables a model's base scans for a window: the RUM base also reads the day before (time-zone margin).
export function scannedTables(model, window) {
    return windowDays(window) + (RUM_MODELS.includes(model) ? 1 : 0);
}

export function parseKey(text) {
    if (typeof text !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(text)) {
        throw new Error('DASHBOARD_SNAPSHOT_KEY is missing or is not 32 random bytes in base64 (openssl rand -base64 32)');
    }
    return Buffer.from(text, 'base64');
}

export function keyCheck(key) {
    return crypto.createHash('sha256').update(KEY_CHECK_LABEL).update(key).digest().subarray(0, 16).toString('base64url');
}

// Fail-closed configuration check, before any credential is minted or any network call is made.
export function requireConfiguration(env, { needsToken = false } = {}) {
    parseKey(env.DASHBOARD_SNAPSHOT_KEY);
    if (!/^projects\/\d+\/locations\/global\/workloadIdentityPools\/[a-z0-9-]+\/providers\/[a-z0-9-]+$/.test(env.WIF_PROVIDER || '')) {
        throw new Error('vars.INTELLIGENCE_WIF_PROVIDER is missing or malformed');
    }
    if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]@[a-z][a-z0-9-]{4,28}[a-z0-9]\.iam\.gserviceaccount\.com$/.test(env.WIF_SERVICE_ACCOUNT || '')) {
        throw new Error('vars.INTELLIGENCE_SERVICE_ACCOUNT is missing or malformed');
    }
    if (needsToken && !env.BIGQUERY_ACCESS_TOKEN) throw new Error('no BigQuery access token: Workload Identity Federation did not authenticate');
}

// Named query parameters for exactly the ones a rendered model references, each validated.
export function parametersFor(sql, window) {
    const values = { start_day: window.start, end_day: window.end, as_of_day: window.asOf, report_timezone: REPORT_TIMEZONE,
        min_events: String(MIN_SAMPLE), min_observations: String(MIN_SAMPLE) };
    return queryParameters(sql).map(name => {
        const [type, valid] = PARAMETERS[name] || [];
        if (!type || !valid.test(values[name] ?? '')) throw new Error(`malformed or unknown query parameter @${name}`);
        return { name, parameterType: { type }, parameterValue: { value: values[name] } };
    });
}

// Bytes BigQuery could bill for a dry-run: processed bytes rounded up to a MiB, or the per-table minimum. A dry-run
// may list a wildcard scan as one table, so the count is never below the daily tables the model's base reads.
export function conservativeBytes(dryRunJob, scanned) {
    const processed = dryRunJob?.statistics?.query?.totalBytesProcessed ?? dryRunJob?.statistics?.totalBytesProcessed;
    if (typeof processed !== 'string' || !/^\d+$/.test(processed)) throw new Error('dry-run returned no byte estimate');
    if (!Number.isInteger(scanned) || scanned < 1) throw new Error('no scanned table count for the estimate');
    const referenced = (dryRunJob.statistics.query?.referencedTables || []).length;
    const tables = Math.max(referenced, scanned);
    return { processed: Number(processed), referenced, tables,
        estimate: Math.max(Math.ceil(Number(processed) / 1048576) * 1048576, tables * MIN_BYTES_PER_TABLE) };
}

export function preflight(estimates) {
    for (const { model, estimate } of estimates) {
        if (estimate > MAX_BYTES_BILLED) throw new Error(`${model}: estimate ${mib(estimate)} exceeds the ${mib(MAX_BYTES_BILLED)} per-query cap; nothing was run`);
    }
    const total = estimates.reduce((sum, { estimate }) => sum + estimate, 0);
    if (total > DAILY_MAX_BYTES) throw new Error(`combined estimate ${mib(total)} exceeds the ${mib(DAILY_MAX_BYTES)} daily ceiling; nothing was run`);
    return total;
}

function cell(type, value) {
    if (value === null || value === undefined) return null;
    if (type === 'INTEGER' || type === 'INT64') {
        const number = Number(value);
        if (!Number.isSafeInteger(number)) throw new Error('integer result out of range');
        return number;
    }
    if (type === 'FLOAT' || type === 'FLOAT64') return Number(value);
    if (type === 'BOOLEAN' || type === 'BOOL') return value === 'true';
    if (type === 'STRING' || type === 'DATE') return String(value);
    throw new Error(`unexpected result column type ${type}`);
}

// A complete, in-window result for one model, as plain objects. Anything else fails the refresh.
export function resultRows(model, result, window) {
    const spec = SNAPSHOT_MODELS[model];
    if (!result?.jobComplete || result.pageToken || !Array.isArray(result.schema?.fields)) throw new Error(`${model}: incomplete result`);
    const rows = result.rows || [];
    if (rows.length !== Number(result.totalRows)) throw new Error(`${model}: incomplete result`);
    const fields = result.schema.fields;
    const names = fields.map(field => field.name);
    for (const column of ['from_day', 'through_day', ...spec.columns]) {
        if (!names.includes(column)) throw new Error(`${model}: result has no ${column} column`);
    }
    const objects = rows.map(row => Object.fromEntries(fields.map((field, i) => [field.name, cell(field.type, row.f?.[i]?.v)])));
    const expected = spec.rows === 'days' ? windowDays(window) : spec.rows;
    if (expected !== undefined && objects.length !== expected) throw new Error(`${model}: expected ${expected} rows, got ${objects.length}`);
    for (const row of objects) {
        if (row.from_day !== window.start || row.through_day !== window.end || row.cohort_truncated === true) {
            throw new Error(`${model}: result does not cover ${window.start} → ${window.end}`);
        }
    }
    return objects;
}

export function sealSnapshot(payload, key, { generatedAt, window }) {
    const header = JSON.stringify({ format: ENVELOPE_FORMAT, v: 1, alg: 'AES-256-GCM', generatedAt,
        asOf: window.asOf, start: window.start, end: window.end, keyCheck: keyCheck(key) });
    const iv = crypto.randomBytes(12); // fresh for every seal; never reused with a key
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(header, 'utf8'));
    const data = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final(), cipher.getAuthTag()]);
    return `${JSON.stringify({ header, iv: iv.toString('base64'), data: data.toString('base64') }, null, 2)}\n`;
}

// The public file's whole allowed shape: a header with dates and a key check, a nonce, and ciphertext.
export function assertEnvelope(text) {
    if (typeof text !== 'string' || Buffer.byteLength(text) > MAX_ENVELOPE_BYTES) throw new Error('snapshot envelope: missing or too large');
    const envelope = JSON.parse(text);
    if (!envelope || typeof envelope !== 'object' || Object.keys(envelope).sort().join() !== 'data,header,iv') {
        throw new Error('snapshot envelope: unexpected fields');
    }
    const { header: headerText, iv, data } = envelope;
    const header = JSON.parse(headerText);
    if (!header || Object.keys(header).join() !== HEADER_KEYS.join()) throw new Error('snapshot envelope: unexpected header fields');
    if (header.format !== ENVELOPE_FORMAT || header.v !== 1 || header.alg !== 'AES-256-GCM') throw new Error('snapshot envelope: unsupported version');
    if (![header.asOf, header.start, header.end].every(day => ISO_DAY.test(day))
        || header.end !== addDays(header.asOf, -MATURITY_DAYS) || header.start !== windowFor(header.asOf).start || header.start > header.end) {
        throw new Error('snapshot envelope: window is not the mature window of its as_of day');
    }
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(header.generatedAt) || !/^[A-Za-z0-9_-]{22}$/.test(header.keyCheck)) {
        throw new Error('snapshot envelope: malformed header');
    }
    if (typeof iv !== 'string' || !BASE64.test(iv) || Buffer.from(iv, 'base64').length !== 12
        || typeof data !== 'string' || !BASE64.test(data) || Buffer.from(data, 'base64').length < 17) {
        throw new Error('snapshot envelope: malformed nonce or ciphertext');
    }
    return { header };
}

const publishedPath = root => path.join(root, SNAPSHOT_PATH);

export function publishedHeader(root = REPO_ROOT) {
    const file = publishedPath(root);
    return fs.existsSync(file) ? assertEnvelope(fs.readFileSync(file, 'utf8')).header : null;
}

// Whether this run has work to do. A refresh runs once per as_of day: reruns and late schedules are no-ops.
export function plan({ mode, env, now, root = REPO_ROOT, enabled = ENABLED }) {
    if (mode !== 'refresh' && mode !== 'dry-run') throw new Error(`unknown mode ${mode}`);
    const window = snapshotWindow(now);
    if (window.start > window.end) return { due: false, window, reason: `no mature daily export yet (the first, ${EXPORT_START}, matures 4 days later)` };
    if (mode === 'refresh' && !enabled) return { due: false, window, reason: 'billable refreshes are disabled (snapshot.mjs ENABLED)' };
    const published = publishedHeader(root);
    if (mode === 'refresh' && published && published.asOf >= window.asOf) {
        return { due: false, window, reason: `the snapshot for as_of ${published.asOf} is already published` };
    }
    requireConfiguration(env);
    return { due: true, window, reason: `${mode} for ${window.start} → ${window.end}, ${windowDays(window)} day(s) (as_of ${window.asOf})` };
}

// The BigQuery REST API, with the job id fixed per day, model and SQL: a rerun finds the earlier job instead of
// billing a second one, and a failed job is never re-run.
export function bigQuery({ token, fetch = globalThis.fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
    async function call(method, url, body) {
        const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
            body: body ? JSON.stringify(body) : undefined });
        const json = await response.json().catch(() => ({}));
        return { status: response.status, json };
    }
    const failure = (what, { status, json }) => new Error(`${what}: HTTP ${status} ${String(json?.error?.message || '').slice(0, 300)}`);
    const queryConfig = (sql, parameters) => ({ query: sql, useLegacySql: false, parameterMode: 'NAMED', queryParameters: parameters,
        maximumBytesBilled: String(MAX_BYTES_BILLED) });

    return {
        async table(day) {
            const id = `events_${day.replaceAll('-', '')}`;
            const response = await call('GET', `${API}/projects/${PROJECT}/datasets/analytics_${PROPERTY}/tables/${id}`);
            if (response.status !== 200) throw failure(`daily export table ${id} is missing or unreadable`, response);
        },
        async dryRun(sql, parameters) {
            const response = await call('POST', `${API}/projects/${PROJECT}/jobs`, {
                configuration: { dryRun: true, query: queryConfig(sql, parameters) }, jobReference: { projectId: PROJECT, location: LOCATION } });
            if (response.status !== 200) throw failure('dry-run failed', response);
            return response.json;
        },
        async run(jobId, sql, parameters) {
            const inserted = await call('POST', `${API}/projects/${PROJECT}/jobs`, {
                configuration: { query: queryConfig(sql, parameters) }, jobReference: { projectId: PROJECT, location: LOCATION, jobId } });
            if (inserted.status !== 200 && inserted.status !== 409) throw failure(`query ${jobId} was not accepted`, inserted);
            let job;
            for (let attempt = 0; ; attempt++) {
                const got = await call('GET', `${API}/projects/${PROJECT}/jobs/${jobId}?location=${LOCATION}`);
                if (got.status !== 200) throw failure(`query ${jobId} status unavailable`, got);
                job = got.json;
                if (job.status?.state === 'DONE') break;
                if (attempt >= 150) throw new Error(`query ${jobId} did not finish in time`);
                await sleep(2000);
            }
            if (job.status.errorResult) throw new Error(`query ${jobId} failed: ${String(job.status.errorResult.message || '').slice(0, 300)}`);
            const billed = Number(job.statistics?.query?.totalBytesBilled ?? NaN);
            if (!Number.isFinite(billed)) throw new Error(`query ${jobId}: no billed byte count`);
            const results = await call('GET', `${API}/projects/${PROJECT}/queries/${jobId}?location=${LOCATION}&maxResults=10000&timeoutMs=0`);
            if (results.status !== 200) throw failure(`query ${jobId} results unavailable`, results);
            return { billed, result: results.json };
        }
    };
}

// Dry-run everything, cost it, and only then (refresh mode) run each model once. Returns the sealed envelope.
export async function refresh({ mode, env, now, client, root, enabled, inputs = readInputs(), log = console.log }) {
    const { due, window, reason } = plan({ mode, env, now, root, enabled });
    if (!due) throw new Error(`nothing to refresh: ${reason}`);
    requireConfiguration(env, { needsToken: true });
    const key = parseKey(env.DASHBOARD_SNAPSHOT_KEY);

    // A refresh stops at the first missing day. A dry-run (free) reports them and still costs the queries, then fails.
    const missing = [];
    for (let day = window.start; day <= window.end; day = addDays(day, 1)) {
        try {
            await client.table(day);
        } catch (error) {
            if (mode === 'refresh') throw error;
            missing.push(day);
            log(error.message);
        }
    }

    const queries = Object.keys(SNAPSHOT_MODELS).map(model => {
        const sql = renderModel(model, { project: PROJECT, property: PROPERTY, ...inputs });
        return { model, sql, parameters: parametersFor(sql, window) };
    });
    const estimates = [];
    for (const query of queries) {
        const { processed, referenced, tables, estimate } = conservativeBytes(await client.dryRun(query.sql, query.parameters),
            scannedTables(query.model, window));
        estimates.push({ model: query.model, estimate });
        log(`dry-run ${query.model}: ${mib(processed)} processed, ${referenced} table(s) listed, ${tables} counted, ≤ ${mib(estimate)} billed`);
    }
    const total = preflight(estimates);
    log(`preflight passed: ≤ ${mib(total)} of the ${mib(DAILY_MAX_BYTES)} daily ceiling; per-query cap ${mib(MAX_BYTES_BILLED)}`);
    if (missing.length) throw new Error(`${missing.length} daily export table(s) missing (first ${missing[0]}): a refresh would fail closed`);
    if (mode === 'dry-run') return null;

    const models = {};
    let billed = 0;
    for (const { model, sql, parameters } of queries) {
        const digest = crypto.createHash('sha256').update(sql).update(JSON.stringify(parameters)).digest('hex').slice(0, 16);
        const jobId = `f1s_snapshot_${window.asOf.replaceAll('-', '')}_${model.replaceAll('-', '_')}_${digest}`;
        const run = await client.run(jobId, sql, parameters);
        billed += run.billed;
        if (billed > DAILY_MAX_BYTES) throw new Error(`billed bytes ${mib(billed)} passed the daily ceiling; stopping`);
        models[model] = resultRows(model, run.result, window);
        log(`ran ${model}: ${mib(run.billed)} billed, ${models[model].length} aggregate rows`);
    }
    const generatedAt = now.toISOString();
    const payload = { format: PAYLOAD_FORMAT, v: 1, generatedAt, window: { ...window, timezone: REPORT_TIMEZONE },
        minEvents: MIN_SAMPLE, minObservations: MIN_SAMPLE, models };
    return sealSnapshot(payload, key, { generatedAt, window });
}

// Publish a sealed envelope over the committed one only when it is valid and newer; otherwise leave it untouched.
export function install(text, root = REPO_ROOT) {
    const { header } = assertEnvelope(text);
    const current = publishedHeader(root);
    if (current && current.asOf >= header.asOf) return false;
    const file = publishedPath(root);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(`${file}.tmp`, text);
    fs.renameSync(`${file}.tmp`, file);
    return true;
}

async function main(argv, env) {
    const [command, ...rest] = argv;
    const options = Object.fromEntries(rest.map(arg => arg.match(/^--([a-z-]+)=(.*)$/)).filter(Boolean).map(m => [m[1], m[2]]));
    const output = (name, value) => env.GITHUB_OUTPUT && fs.appendFileSync(env.GITHUB_OUTPUT, `${name}=${value}\n`);
    if (command === 'plan') {
        const { due, window, reason } = plan({ mode: options.mode, env, now: new Date() });
        console.log(due ? reason : `skipped: ${reason}`);
        output('due', due);
        output('as_of', window.asOf);
    } else if (command === 'refresh') {
        if (options.mode === 'refresh' && !options.out) throw new Error('--out is required');
        const envelope = await refresh({ mode: options.mode, env, now: new Date(), client: bigQuery({ token: env.BIGQUERY_ACCESS_TOKEN }) });
        // Written outside the repository; only the publish job copies it into dashboard/data/.
        if (envelope) fs.writeFileSync(options.out, envelope, { flag: 'wx' });
    } else if (command === 'install') {
        console.log(install(fs.readFileSync(rest[0], 'utf8')) ? `published ${SNAPSHOT_PATH}` : 'unchanged: the published snapshot is as new or newer');
    } else {
        throw new Error('usage: snapshot.mjs plan|refresh --mode=dry-run|refresh [--out=<file>] | install <file>');
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main(process.argv.slice(2), process.env).catch(error => {
        console.error(`✗ ${error.message}`);
        process.exitCode = 1;
    });
}
