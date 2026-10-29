#!/usr/bin/env node
// I-06E: metadata-only monitoring. No key, decryption, query, dispatch or billable retry.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import {
    assertEnvelope, windowFor, propertyDay, MATURITY_DAYS, DISCOVERY_EVERY_DAYS, DISCOVERY_MAX_AGE_DAYS,
    MAX_BYTES_BILLED, DAILY_MAX_BYTES, SNAPSHOT_PATH, STALE_MS, SNAPSHOT_MODELS, DISCOVERY_MODELS, ROTATED_FOR_DISCOVERY
} from './snapshot.mjs';

const HOUR = 3600000;
const DAY = 24 * HOUR;
export const CONFIG = Object.freeze({
    scheduleDelayMs: 6 * HOUR, scheduleGraceMs: 8 * HOUR, scheduleCriticalMs: 12 * HOUR,
    publicationGraceMs: HOUR, pagesGraceMs: HOUR, pagesCriticalMs: 3 * HOUR,
    futureToleranceMs: 5 * 60000, staleMs: STALE_MS,
    costInfo: 0.5, costWarning: 0.8, costCritical: 1,
    readTimeoutMs: 5000, readAttempts: 2
});
export const LABEL = 'intelligence-health';
export const PUBLIC_SNAPSHOT = 'https://f1-stories.gr/dashboard/data/snapshot.json';
export const CATEGORIES = Object.freeze({
    'refresh-failed': { component: 'refresh', title: 'Snapshot refresh failed', action: 'Inspect the refresh steps; preserve the previous snapshot and use the owner recovery procedure.' },
    'schedule-missing': { component: 'schedule', title: 'Expected execution missing', action: 'Check Actions scheduling and whether a successful manual refresh covered the expected reporting day.' },
    'bigquery-failed': { component: 'bigquery', title: 'Authentication or BigQuery failed', action: 'Inspect the named stage: authentication, daily exports, dry-run SQL/schema, query, or result validation. Do not blindly retry queries.' },
    'cost-preflight': { component: 'costGuard', title: 'Cost guard needs attention', action: 'Review estimates and billed bytes against the unchanged caps; do not raise limits or infer a currency bill.' },
    'publication-failed': { component: 'publication', title: 'Snapshot publication failed', action: 'Check envelope upload and the publish job against the default-branch snapshot; retain the previous valid envelope.' },
    'pages-failed': { component: 'pages', title: 'Pages deployment failed or publication lagged', action: 'Compare repository and public envelope digests and the latest deployment; check concurrency supersession and deploy the intact repository copy.' },
    'snapshot-stale': { component: 'freshness', title: 'Snapshot exceeds supported freshness', action: 'Check the last published reporting day and generation time, then diagnose the upstream stage before owner recovery.' },
    'discovery-overdue': { component: 'discovery', title: 'Discovery exceeds allowed age', action: 'Inspect weekly rotation and yesterday’s RUM availability; Discovery older than the supported age is pending/unavailable.' },
    'repeated-failures': { component: 'repeated', title: 'Consecutive executions failed', action: 'Investigate the common failing stage across consecutive refresh executions; avoid billable reruns.' }
});
const STATES = ['HEALTHY', 'UNKNOWN', 'DEGRADED', 'CRITICAL'];
const STAGES = ['plan_skipped', 'configuration', 'authentication', 'export_tables', 'dry_run', 'preflight', 'query', 'result_validation', 'encryption', 'ok'];
const OUTCOMES = ['pending', 'skipped', 'success', 'failure', 'unknown'];
const dayBefore = day => new Date(Date.parse(day) - DAY).toISOString().slice(0, 10);
const validDay = day => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day)
    && Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day;
const instant = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && validDay(value.slice(0, 10)) && Number.isFinite(Date.parse(value));
const bytes = value => Number.isSafeInteger(value) && value >= 0;
const models = values => Array.isArray(values) && values.every(value => Object.hasOwn(SNAPSHOT_MODELS, value)) && new Set(values).size === values.length;
const worst = values => STATES[Math.max(...values.map(value => STATES.indexOf(value)))];
const mib = value => bytes(value) ? `${(value / 1048576).toFixed(2)} MiB` : 'UNKNOWN';

// First 03:00 in Athens; on the spring gap there is no scheduled instant, and on the fall overlap only one is due.
export function scheduleClock(now) {
    const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Athens', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    for (let day = propertyDay(now, 'Europe/Athens'), count = 0; count < 3; day = dayBefore(day), count++) {
        for (let offset = -4; offset <= 4; offset += 0.5) {
            const candidate = new Date(Date.parse(day) + offset * HOUR);
            if (candidate <= now && propertyDay(candidate, 'Europe/Athens') === day && formatter.format(candidate) === '03:00') {
                return { scheduledAt: candidate.toISOString(), asOf: propertyDay(candidate) };
            }
        }
    }
    throw new Error('schedule clock unavailable');
}

// Explicit allowlist prevents artifact extensions, provider errors and analytics from reaching public reports.
export function cleanOperation(value) {
    if (value?.version !== 1 || !instant(value.observedAt) || !['refresh', 'dry-run'].includes(value.mode)
        || !STAGES.includes(value.stage) || !OUTCOMES.includes(value.outcome) || !validDay(value.window?.asOf)
        || !models(value.runModels) || !Array.isArray(value.carriedModels) || !Array.isArray(value.queries)
        || value.carriedModels.length > 9 || value.queries.length > 9 || !bytes(value.queryCount)
        || ![value.estimateBytes, value.billedBytes].every(v => v === null || bytes(v))
        || !bytes(value.perQueryCapBytes) || !bytes(value.dailyCapBytes)) throw new Error('invalid operation');
    const window = windowFor(value.window.asOf);
    if (value.window.start !== window.start || value.window.end !== window.end) throw new Error('invalid operation window');
    const carriedModels = value.carriedModels.map(item => {
        if (!Object.hasOwn(SNAPSHOT_MODELS, item.model) || !validDay(item.asOf) || item.asOf >= window.asOf) throw new Error('invalid carried model');
        return { model: item.model, asOf: item.asOf };
    });
    if (!models(carriedModels.map(item => item.model)) || carriedModels.some(item => value.runModels.includes(item.model))) throw new Error('duplicate model');
    const queries = value.queries.map(item => {
        if (!value.runModels.includes(item.model) || !bytes(item.estimateBytes) || !(item.billedBytes === null || bytes(item.billedBytes))) throw new Error('invalid query telemetry');
        return { model: item.model, estimateBytes: item.estimateBytes, billedBytes: item.billedBytes };
    });
    if (!models(queries.map(item => item.model))) throw new Error('duplicate query telemetry');
    return { version: 1, observedAt: new Date(value.observedAt).toISOString(), mode: value.mode, window, stage: value.stage, outcome: value.outcome,
        runModels: [...value.runModels], carriedModels, queries, queryCount: value.queryCount, estimateBytes: value.estimateBytes,
        billedBytes: value.billedBytes, perQueryCapBytes: value.perQueryCapBytes, dailyCapBytes: value.dailyCapBytes };
}

export function envelopeMetadata(value) {
    const header = typeof value === 'string' ? assertEnvelope(value).header : value;
    if (!header || ![header.asOf, header.start, header.end].every(validDay) || !instant(header.generatedAt)) throw new Error('invalid dates');
    const window = windowFor(header.asOf);
    if (header.start !== window.start || header.end !== window.end || header.start > header.end) throw new Error('invalid window');
    // The isolated incident job replays only validated dates and the original envelope digest.
    if (typeof value !== 'string' && Object.keys(value).sort().join() !== 'asOf,digest,end,generatedAt,start') throw new Error('invalid metadata');
    let digest = header.digest;
    if (typeof value === 'string') {
        const { header: text, iv, data } = JSON.parse(value);
        digest = createHash('sha256').update(JSON.stringify({ header: text, iv, data })).digest('hex');
    }
    if (typeof digest !== 'string' || !/^[a-f0-9]{64}$/.test(digest)) throw new Error('invalid digest');
    return { generatedAt: new Date(header.generatedAt).toISOString(), asOf: header.asOf, start: header.start, end: header.end, digest };
}

const runUrl = run => /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/actions\/runs\/\d+(?:\/attempts\/\d+)?$/.test(run?.html_url || '') ? run.html_url : null;
const time = run => run?.run_started_at || run?.created_at;
const failed = run => ['failure', 'timed_out', 'action_required', 'startup_failure', 'cancelled'].includes(run?.conclusion);
const conclusions = ['success', 'failure', 'neutral', 'cancelled', 'skipped', 'timed_out', 'action_required', 'startup_failure', 'stale'];
const conclusion = value => conclusions.includes(value) ? value : null;
function cleanRun(run) {
    return { id: run.id, run_attempt: run.run_attempt || 1, event: ['schedule', 'workflow_dispatch'].includes(run.event) ? run.event : null,
        status: run.status, conclusion: conclusion(run.conclusion), created_at: instant(run.created_at) ? new Date(run.created_at).toISOString() : null,
        run_started_at: instant(run.run_started_at) ? new Date(run.run_started_at).toISOString() : null, html_url: runUrl(run) };
}
function cleanJob(job) {
    const names = ['Query and encrypt', 'Commit the encrypted snapshot', 'Deploy Pages artifact'];
    const stepNames = ['Upload the encrypted envelope', 'Authenticate to Google Cloud (Workload Identity Federation, no key file)'];
    const name = typeof job?.name === 'string' && job.name.endsWith(' / Deploy Pages artifact') ? 'Deploy Pages artifact' : job?.name;
    return { name: names.includes(name) ? name : '', conclusion: conclusion(job?.conclusion),
        startedAt: name === 'Deploy Pages artifact' && instant(job?.started_at) ? new Date(job.started_at).toISOString() : null,
        steps: (Array.isArray(job?.steps) ? job.steps : []).filter(step => stepNames.includes(step?.name))
            .map(step => ({ name: step.name, conclusion: conclusion(step.conclusion) })) };
}

// Evidence uses {ok,value} reads; a failed read stays distinguishable from a valid empty list.
export function assessHealth(evidence, { now, config = {} }) {
    now = new Date(now);
    if (!Number.isFinite(+now)) throw new Error('now is required');
    const c = { ...CONFIG, ...config };
    const clock = scheduleClock(now);
    const components = {};
    const set = (name, status, detail, observedAt = null, url = null, recoveryObserved = false) => {
        components[name] = { status, detail, observedAt, url, recoveryObserved: status === 'HEALTHY' && recoveryObserved };
    };
    for (const name of ['schedule', 'bigquery', 'snapshot', 'publication', 'pages', 'freshness', 'discovery', 'costGuard', 'refresh', 'repeated']) {
        set(name, 'UNKNOWN', 'Evidence unavailable; no recovery inferred.');
    }
    const reads = evidence || {};
    const runs = reads.runs?.ok && Array.isArray(reads.runs.value) && reads.runs.value.every(run => instant(time(run)))
        ? reads.runs.value.slice().sort((a, b) => Date.parse(time(b)) - Date.parse(time(a)) || (b.run_attempt || 1) - (a.run_attempt || 1)) : null;
    const unique = runs && [...new Map([...runs].reverse().map(run => [run.id, run])).values()].sort((a, b) => Date.parse(time(b)) - Date.parse(time(a)));
    const operations = new Map();
    for (const run of unique || []) {
        try {
            if (reads.operations?.[run.id]?.ok) {
                const op = cleanOperation(reads.operations[run.id].value);
                // Run artifacts are evidence for that attempt only, and never for a future reporting day.
                if (op.observedAt <= new Date(+now + c.futureToleranceMs).toISOString() && op.window.asOf <= propertyDay(now)) operations.set(run.id, op);
            }
        } catch { /* Invalid metadata stays UNKNOWN. */ }
    }
    let repo = null, publicHeader = null;
    for (const [name, read] of [['repo', reads.repoSnapshot], ['public', reads.publicSnapshot]]) {
        if (read?.ok) {
            try {
                const meta = envelopeMetadata(read.value);
                if (Date.parse(meta.generatedAt) > +now + c.futureToleranceMs || meta.asOf > propertyDay(now)) throw new Error('future metadata');
                if (name === 'repo') repo = meta;
                else publicHeader = meta;
            } catch {
                if (name === 'public') set('snapshot', 'CRITICAL', 'Public envelope metadata is malformed or implausible.', now.toISOString());
                else set('publication', 'CRITICAL', 'Default-branch envelope metadata is malformed or implausible.', now.toISOString());
            }
        }
    }
    const previousAvailable = publicHeader ? true : reads.publicSnapshot?.ok ? false : null;
    if (publicHeader) set('snapshot', 'HEALTHY', `Well-formed envelope; as_of ${publicHeader.asOf}, mature through ${publicHeader.end}. Authenticity is NOT VERIFIED.`, publicHeader.generatedAt, null, true);
    const latest = unique?.find(run => operations.get(run.id)?.mode !== 'dry-run');
    const op = latest && operations.get(latest.id);
    const active = latest && latest.status !== 'completed';
    const elapsed = +now - Date.parse(clock.scheduledAt);
    if (unique) {
        const scheduled = unique.find(run => run.event === 'schedule' && Date.parse(time(run)) >= Date.parse(clock.scheduledAt));
        const manual = unique.find(run => run.event === 'workflow_dispatch' && run.conclusion === 'success'
            && operations.get(run.id)?.mode === 'refresh' && operations.get(run.id)?.window.asOf >= clock.asOf && repo?.asOf >= clock.asOf);
        const execution = scheduled || manual;
        if (execution) {
            const delay = Date.parse(time(execution)) - Date.parse(clock.scheduledAt);
            set('schedule', delay > c.scheduleDelayMs ? 'DEGRADED' : 'HEALTHY',
                `${scheduled ? 'Scheduled' : 'Successful manual'} execution observed at ${time(execution)}${delay > c.scheduleDelayMs ? `; delayed beyond ${c.scheduleDelayMs / HOUR}h allowance` : ''}.`, time(execution), runUrl(execution), true);
        } else if (unique.length >= 30 && Date.parse(time(unique.at(-1))) > Date.parse(clock.scheduledAt)) {
            set('schedule', 'UNKNOWN', 'Run-list horizon does not cover the expected schedule.');
        } else {
            set('schedule', elapsed < c.scheduleGraceMs ? 'HEALTHY' : elapsed < c.scheduleCriticalMs ? 'DEGRADED' : 'CRITICAL',
                elapsed < c.scheduleGraceMs ? `Within ${c.scheduleGraceMs / HOUR}h scheduling grace.` : 'No scheduled execution or successful covering manual refresh.', clock.scheduledAt);
        }
        components.schedule.executionObserved = Boolean(execution);
    }
    if (latest) {
        if (failed(latest)) set('refresh', 'CRITICAL', `Refresh execution ${latest.conclusion}; stage ${op?.stage || 'unknown'}.`, time(latest), runUrl(latest));
        else if (active) set('refresh', elapsed > c.scheduleCriticalMs ? 'DEGRADED' : 'UNKNOWN', 'Refresh execution still in progress.', time(latest), runUrl(latest));
        else if (latest.conclusion === 'success' && op && (op.outcome === 'success' && op.stage === 'ok'
            || op.outcome === 'skipped' && op.stage === 'plan_skipped' && repo?.asOf >= op.window.asOf)) {
            set('refresh', 'HEALTHY', `Refresh ${op.outcome}; stage ${op.stage}.`, op.observedAt, runUrl(latest), true);
        }
        if (op?.outcome === 'failure') set('refresh', 'CRITICAL', `Refresh failed at ${op.stage}.`, op.observedAt, runUrl(latest));
    }
    const executed = unique?.filter(run => operations.get(run.id)?.mode !== 'dry-run' && run.status === 'completed');
    if (executed?.length >= 2 && executed.slice(0, 2).every(run => operations.get(run.id)?.mode === 'refresh')) {
        const pair = executed.slice(0, 2);
        const recovered = pair[0].id === latest?.id && components.refresh.recoveryObserved;
        set('repeated', pair.every(failed) ? 'CRITICAL' : recovered ? 'HEALTHY' : 'UNKNOWN',
            pair.every(failed) ? 'Two consecutive refresh executions failed.' : recovered ? 'Latest refresh execution succeeded.' : 'No successful latest refresh establishes recovery.', time(pair[0]), runUrl(pair[0]), recovered);
    }
    // A no-op has no query telemetry: reuse only an actual successful refresh matching the committed envelope.
    const successful = unique?.find(run => {
        const operation = operations.get(run.id);
        return operation?.mode === 'refresh' && operation.outcome === 'success' && operation.stage === 'ok'
            && repo && operation.window.asOf === repo.asOf;
    });
    const publishedOp = successful && operations.get(successful.id);
    const queryRun = op?.stage === 'plan_skipped' ? unique.find(run => operations.get(run.id)?.mode !== 'dry-run'
        && operations.get(run.id)?.stage !== 'plan_skipped') : latest;
    const candidate = queryRun && operations.get(queryRun.id);
    const queryOp = op?.stage === 'plan_skipped' ? (queryRun?.id === successful?.id || candidate?.outcome === 'failure' ? candidate : null) : op;
    let costComplete = false;
    if (queryOp) {
        const stage = queryOp.stage;
        const queryFailure = queryOp.outcome === 'failure' && ['authentication', 'export_tables', 'dry_run', 'query', 'result_validation'].includes(stage);
        const complete = queryOp.outcome === 'success' && stage === 'ok' && queryOp.runModels.length === 7
            && queryOp.queries.length === 7 && queryOp.queryCount === 7 && queryOp.queries.every(q => bytes(q.billedBytes));
        set('bigquery', queryFailure ? 'CRITICAL' : complete ? 'HEALTHY' : 'UNKNOWN',
            queryFailure ? `Confirmed failure at ${stage}.` : complete ? 'All seven selected queries completed; billed bytes recorded.' : `Incomplete query evidence at ${stage}.`, queryOp.observedAt, runUrl(queryRun), complete);
        const estimates = queryOp.queries.map(q => q.estimateBytes);
        const billed = queryOp.queries.map(q => q.billedBytes);
        const violation = queryOp.perQueryCapBytes !== MAX_BYTES_BILLED || queryOp.dailyCapBytes !== DAILY_MAX_BYTES
            || estimates.some(v => v > MAX_BYTES_BILLED) || billed.some(v => bytes(v) && v > MAX_BYTES_BILLED)
            || queryOp.queryCount > queryOp.runModels.length || queryOp.estimateBytes > DAILY_MAX_BYTES || queryOp.billedBytes > DAILY_MAX_BYTES;
        const telemetryComplete = complete && bytes(queryOp.estimateBytes) && bytes(queryOp.billedBytes)
            && estimates.reduce((sum, v) => sum + v, 0) === queryOp.estimateBytes && billed.reduce((sum, v) => sum + v, 0) === queryOp.billedBytes;
        costComplete = telemetryComplete;
        const ratio = Math.max(queryOp.estimateBytes ?? 0, queryOp.billedBytes ?? 0) / DAILY_MAX_BYTES;
        const status = violation || (stage === 'preflight' && queryOp.outcome === 'failure') || ratio >= c.costCritical ? 'CRITICAL'
            : !telemetryComplete ? 'UNKNOWN' : ratio >= c.costWarning ? 'DEGRADED' : 'HEALTHY';
        set('costGuard', status, `Estimate ${mib(queryOp.estimateBytes)}; actual billed ${mib(queryOp.billedBytes)}${telemetryComplete ? '' : ' (incomplete telemetry)'}; ${queryOp.queryCount} query attempts; daily cap ${mib(DAILY_MAX_BYTES)}, per query ${mib(MAX_BYTES_BILLED)}.${ratio >= c.costInfo ? ` INFO: at least ${c.costInfo * 100}% of daily byte allowance.` : ''}${violation ? ' Guard violation.' : ''}`, queryOp.observedAt, runUrl(queryRun), telemetryComplete);
    }
    const jobs = latest && reads.jobs?.[latest.id];
    const authFailed = jobs?.ok && jobs.value.some(job => job.steps?.some(step => step.name === 'Authenticate to Google Cloud (Workload Identity Federation, no key file)' && step.conclusion === 'failure'));
    if (authFailed) set('bigquery', 'CRITICAL', 'Confirmed failure at authentication (workflow step).', time(latest), runUrl(latest));
    const publishJob = jobs?.ok && jobs.value.find(job => job.name === 'Commit the encrypted snapshot');
    const uploadFailed = jobs?.ok && jobs.value.some(job => job.steps?.some(step => step.name === 'Upload the encrypted envelope' && step.conclusion === 'failure'));
    if (uploadFailed || failed(publishJob)) set('publication', 'CRITICAL', 'Envelope upload or publication job failed; previous file is not replaced by the failed refresh.', time(latest), runUrl(latest));
    else if (repo && op && latest?.conclusion === 'success' && ['success', 'skipped'].includes(op.outcome)
        && ['success', 'skipped'].includes(publishJob?.conclusion) && repo.asOf >= op.window.asOf && repo.asOf >= clock.asOf) {
        set('publication', 'HEALTHY', `Default branch contains as_of ${repo.asOf}; ${op.stage === 'plan_skipped' ? 'intentional no-op' : 'publication reconciled'}.`, repo.generatedAt, runUrl(latest), true);
    } else if (repo && op?.stage === 'ok' && op.mode === 'refresh' && op.window.asOf > repo.asOf) {
        set('publication', +now - Date.parse(op.observedAt) > c.publicationGraceMs ? 'CRITICAL' : 'DEGRADED', 'Completed refresh has not reached the default branch.', op.observedAt, runUrl(latest));
    }
    const newerPublished = repo && unique?.find(run => run.conclusion === 'success' && operations.get(run.id)?.mode === 'refresh'
        && operations.get(run.id)?.stage === 'ok' && operations.get(run.id)?.window.asOf > repo.asOf);
    if (newerPublished) set('publication', +now - Date.parse(time(newerPublished)) > c.publicationGraceMs ? 'CRITICAL' : 'DEGRADED',
        'Default branch is behind a previously successful refresh and publication.', time(newerPublished), runUrl(newerPublished));
    else if (latest && !jobs?.ok && components.publication.status !== 'CRITICAL') set('publication', 'UNKNOWN', 'Publication job/step metadata unavailable; no recovery inferred.');
    if (repo && publicHeader) {
        const pages = reads.pagesRuns?.ok ? reads.pagesRuns.value.filter(run => instant(time(run))).sort((a, b) => Date.parse(time(b)) - Date.parse(time(a))) : null;
        const headersMatch = publicHeader.asOf === repo.asOf && publicHeader.generatedAt === repo.generatedAt;
        const digestMismatch = headersMatch && publicHeader.digest !== repo.digest;
        const matches = headersMatch && !digestMismatch;
        const deployed = pages?.find(run => run.conclusion === 'success' && Date.parse(time(run)) >= Date.parse(repo.generatedAt)
            && reads.pagesJobs?.[run.id]?.ok && reads.pagesJobs[run.id].value.some(job => job.name === 'Deploy Pages artifact' && job.conclusion === 'success'));
        const relevant = pages?.filter(run => Date.parse(time(run)) >= Date.parse(repo.generatedAt));
        const latestPage = relevant?.[0];
        const failedPage = relevant?.find(run => failed(run) || reads.pagesJobs?.[run.id]?.ok
            && reads.pagesJobs[run.id].value.some(job => job.name === 'Deploy Pages artifact' && failed(job)));
        const failureRecovered = deployed && (!failedPage || deployed.id !== failedPage.id && Date.parse(time(deployed)) >= Date.parse(time(failedPage)));
        const pageFailure = failedPage && !failureRecovered && !(failedPage.conclusion === 'cancelled' && relevant.some(run => run.id !== failedPage.id
            && Date.parse(time(run)) >= Date.parse(time(failedPage)) && run.status !== 'completed'));
        const reconciled = matches && failureRecovered;
        const pageJobsUnknown = latestPage && !reads.pagesJobs?.[latestPage.id]?.ok;
        const age = +now - Date.parse(repo.generatedAt);
        if (publicHeader.asOf > repo.asOf || (matches === false && publicHeader.asOf === repo.asOf && publicHeader.generatedAt > repo.generatedAt)) {
            set('publication', 'CRITICAL', 'Public metadata is newer than the default branch; possible repository regression.', repo.generatedAt);
        }
        set('pages', digestMismatch || pageFailure ? 'CRITICAL' : !pages || pageJobsUnknown ? 'UNKNOWN' : reconciled ? 'HEALTHY'
            : age > c.pagesCriticalMs ? 'CRITICAL' : age > c.pagesGraceMs ? 'DEGRADED' : 'UNKNOWN',
        digestMismatch ? `Public and repository envelope digests differ despite equal headers: repository SHA-256 ${repo.digest}; public SHA-256 ${publicHeader.digest}.`
            : pageFailure ? 'Latest unresolved Pages deployment failed.' : reconciled ? 'Successful deployment and public envelope digest match the default branch.'
            : !pages || pageJobsUnknown ? 'Pages run/step metadata unavailable.' : 'Awaiting deployment evidence or public metadata reconciliation.',
        pageFailure ? time(failedPage) : deployed ? time(deployed) : repo.generatedAt, runUrl(reconciled ? deployed : failedPage || latestPage), Boolean(reconciled));
    }
    if (publicHeader) {
        const stale = +now - Date.parse(publicHeader.generatedAt) > c.staleMs;
        const requiredAsOf = elapsed <= c.scheduleGraceMs ? scheduleClock(new Date(Date.parse(clock.scheduledAt) - 1)).asOf : clock.asOf;
        const lag = (Date.parse(requiredAsOf) - Date.parse(publicHeader.asOf)) / DAY;
        set('freshness', stale || lag > 1 ? 'CRITICAL' : lag > 0 ? 'DEGRADED' : 'HEALTHY',
            `Generated ${publicHeader.generatedAt}; as_of ${publicHeader.asOf}; expected at schedule ${clock.asOf}; required now ${requiredAsOf}; maturity ${MATURITY_DAYS} days; latest mature day now ${windowFor(propertyDay(now)).end}.${stale ? ' Older than the dashboard 48-hour support window.' : ''}`, publicHeader.generatedAt, null, true);
    }
    if (publishedOp) {
        const asOfFor = model => publishedOp.runModels.includes(model) ? publishedOp.window.asOf : publishedOp.carriedModels.find(item => item.model === model)?.asOf;
        const currentDiscoveryDays = DISCOVERY_MODELS.map(asOfFor);
        const discoveryDays = DISCOVERY_MODELS.map((model, index) => currentDiscoveryDays[index] || [...operations.values()].filter(item => item.mode === 'refresh'
            && item.outcome === 'success' && item.window.asOf <= publishedOp.window.asOf)
            .map(item => item.runModels.includes(model) ? item.window.asOf : item.carriedModels.find(carried => carried.model === model)?.asOf)
            .filter(Boolean).sort().at(-1));
        const rumDays = ROTATED_FOR_DISCOVERY.map(asOfFor);
        const referenceDay = clock.asOf > publishedOp.window.asOf ? clock.asOf : publishedOp.window.asOf;
        const ages = discoveryDays.map(day => day ? (Date.parse(referenceDay) - Date.parse(day)) / DAY : Infinity);
        const rumAges = rumDays.map(day => day ? (Date.parse(publishedOp.window.asOf) - Date.parse(day)) / DAY : Infinity);
        const invalidRum = rumAges.some(age => age < 0 || age > 1);
        set('discovery', ages.some(age => Number.isFinite(age) && age > DISCOVERY_MAX_AGE_DAYS) ? 'CRITICAL'
            : currentDiscoveryDays.some(day => !day) ? 'UNKNOWN' : invalidRum ? 'DEGRADED' : 'HEALTHY',
            `Discovery ages ${ages.map(age => Number.isFinite(age) ? `${age}d` : 'unavailable').join(', ')}; rotation ${DISCOVERY_EVERY_DAYS}d, allowed carry ${DISCOVERY_MAX_AGE_DAYS}d.${currentDiscoveryDays.some(day => !day) ? ' Current publication lacks Discovery evidence; history establishes expiry only.' : ''} RUM ages at publication ${rumAges.map(age => Number.isFinite(age) ? `${age}d` : 'unavailable').join(', ')}; one-day carry is intentional.`, publishedOp.observedAt, runUrl(successful), currentDiscoveryDays.every(Boolean));
    }
    const incidents = Object.entries(CATEGORIES).map(([id, category]) => ({ id, title: category.title, component: category.component,
        ...components[category.component], action: category.action, previousSnapshotAvailable: previousAvailable }));
    // Envelope corruption belongs to the freshness incident even when a timestamp cannot be read.
    if (components.snapshot.status === 'CRITICAL') Object.assign(incidents.find(item => item.id === 'snapshot-stale'), components.snapshot);
    return { version: 1, observedAt: now.toISOString(), expected: clock, components, overall: worst(Object.values(components).map(item => item.status)),
        unknownComponents: Object.keys(components).filter(name => components[name].status === 'UNKNOWN'), incidents,
        analyticalCorrectness: 'NOT VERIFIED — I-06C4 is owner-run on the decrypted payload; envelope shape does not prove authenticity.',
        cost: queryOp ? { estimateBytes: queryOp.estimateBytes, billedBytes: queryOp.billedBytes, queryCount: queryOp.queryCount, dailyCapBytes: DAILY_MAX_BYTES,
            complete: costComplete } : null };
}

export function escapeMarkdown(value) {
    return String(value ?? 'UNKNOWN').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
        .replaceAll('@', '&#64;').replace(/[\\`*_{}\[\]()!|#~]/g, '\\$&').replace(/[\r\n]/g, ' ');
}

export function formatSummary(assessment) {
    const rows = Object.entries(assessment.components).map(([name, item]) => `| ${escapeMarkdown(name)} | ${item.status} | ${escapeMarkdown(item.observedAt)} — ${escapeMarkdown(item.detail)} |`);
    const incidents = assessment.incidents.filter(item => ['DEGRADED', 'CRITICAL'].includes(item.status));
    return `### F1 Stories Intelligence Health\n\nOverall: **${assessment.overall}**; UNKNOWN: ${assessment.unknownComponents.join(', ') || 'none'}.\n\n| Component | Status | Last evidence |\n| --- | --- | --- |\n${rows.join('\n')}\n\n${incidents.map(item => `- ${item.id}: ${item.status} — ${escapeMarkdown(item.detail)} Next: ${escapeMarkdown(item.action)}${item.url ? ` Workflow: ${escapeMarkdown(item.url)}` : ''}`).join('\n') || 'No confirmed active incidents.'}\n\nCost: estimate ${mib(assessment.cost?.estimateBytes)}; actual billed ${mib(assessment.cost?.billedBytes)}${assessment.cost && !assessment.cost.complete ? ' (incomplete telemetry)' : ''}; daily allowance ${mib(DAILY_MAX_BYTES)}. Bytes are not money; this cannot establish the Cloud bill or guarantee the €10 budget alert.\n\n${assessment.analyticalCorrectness}\n\nExit is nonzero only for CRITICAL. GitHub schedules and notifications are best effort; Actions outages can stop both pipeline and watchdog.\n`;
}

const marker = id => `<!-- intelligence-health:${id} -->`;
const stateMarker = status => `<!-- intelligence-health-state:${status} -->`;
function issueBody(incident, assessment, firstDetected) {
    return `${marker(incident.id)}\n${stateMarker(incident.status)}\n\nCategory: ${incident.id}\n\nFirst detected: ${firstDetected}\n\nLatest observed: ${assessment.observedAt}\n\nStage: ${incident.component}\n\nWorkflow URL: ${escapeMarkdown(incident.url)}\n\nWhat failed / recovery evidence: ${escapeMarkdown(incident.detail)}\n\nNext action: ${escapeMarkdown(incident.action)}\n\nPrevious snapshot remains available: ${incident.previousSnapshotAvailable === null ? 'UNKNOWN' : incident.previousSnapshotAvailable ? 'yes (well-formed envelope; authenticity not verified)' : 'no valid envelope observed'}\n`;
}

// An open incident closes only on positive recovery evidence for its category; grace and missing evidence never qualify.
export function planIncidents(currentIssues, assessment) {
    const actions = [];
    for (const [id, category] of Object.entries(CATEGORIES)) {
        const incident = assessment.incidents.find(item => item.id === id);
        if (!incident || !STATES.includes(incident.status) || incident.status === 'UNKNOWN') continue;
        if (incident.status === 'HEALTHY' && incident.recoveryObserved !== true) continue;
        const existing = currentIssues.filter(issue => issue.state === 'open' && !issue.pull_request
            && issue.labels?.some(label => (typeof label === 'string' ? label : label.name) === LABEL) && issue.body?.includes(marker(id)));
        const active = ['CRITICAL', 'DEGRADED'].includes(incident.status);
        if (!existing.length && active) {
            actions.push({ type: 'create', category: id, title: `[Intelligence] ${incident.status} — ${category.title}`, body: issueBody(incident, assessment, assessment.observedAt) });
        }
        for (const issue of existing) {
            const texts = [issue.body, ...(issue.commentsData || []).filter(comment => comment.user?.login === 'github-actions[bot]').map(comment => comment.body)];
            const state = texts.flatMap(body => [...String(body).matchAll(/<!-- intelligence-health-state:(HEALTHY|UNKNOWN|DEGRADED|CRITICAL) -->/g)].map(match => match[1])).at(-1);
            const first = issue.body.match(/First detected: (\d{4}-\d{2}-\d{2}T[^\s<]+)/)?.[1];
            const firstDetected = instant(first) ? new Date(first).toISOString() : assessment.observedAt;
            if (!active) actions.push({ type: 'close', category: id, number: issue.number, body: state === 'HEALTHY' ? null : issueBody(incident, assessment, firstDetected) });
            else if (state !== incident.status) actions.push({ type: 'comment', category: id, number: issue.number, body: issueBody(incident, assessment, firstDetected) });
        }
    }
    return actions;
}

// All reads have bounded bodies, attempts and total time, including mocks that ignore AbortSignal.
export function reader({ fetch = globalThis.fetch, token, config = {} } = {}) {
    const c = { ...CONFIG, ...config };
    return async function read(url, { binary = false, publicRead = false } = {}) {
        for (let attempt = 0; attempt < c.readAttempts; attempt++) {
            const controller = new AbortController();
            let timer;
            try {
                const result = await Promise.race([
                    (async () => {
                        const response = await fetch(url, { signal: controller.signal, headers: publicRead ? {} : {
                            Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28'
                        } });
                        if (!response.ok) return { ok: false, error: `HTTP_${response.status}`, retry: response.status >= 500 || response.status === 429 };
                        const chunks = [];
                        let size = 0;
                        for await (const chunk of response.body) {
                            size += chunk.length;
                            if (size > 2 * 1024 * 1024) { controller.abort(); throw new Error('read limit'); }
                            chunks.push(chunk);
                        }
                        const buffer = Buffer.concat(chunks);
                        return { ok: true, value: binary ? buffer : publicRead ? buffer.toString('utf8') : JSON.parse(buffer.toString('utf8')) };
                    })(),
                    new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('timeout')); }, c.readTimeoutMs); })
                ]);
                if (result.ok || !result.retry || attempt === c.readAttempts - 1) return result;
            } catch {
                if (attempt === c.readAttempts - 1) return { ok: false, error: 'READ_FAILED' };
            } finally { clearTimeout(timer); }
        }
        return { ok: false, error: 'READ_FAILED' };
    };
}

// GitHub's artifact ZIP contains exactly this JSON file; never extract archive paths to disk.
export function operationFromZip(buffer) {
    let end = -1;
    for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65557); offset--) {
        if (buffer.readUInt32LE(offset) === 0x06054b50) { end = offset; break; }
    }
    if (end < 0 || buffer.readUInt16LE(end + 10) !== 1) throw new Error('invalid artifact zip');
    const central = buffer.readUInt32LE(end + 16);
    if (buffer.readUInt32LE(central) !== 0x02014b50) throw new Error('invalid directory');
    const method = buffer.readUInt16LE(central + 10);
    const compressed = buffer.readUInt32LE(central + 20);
    const expanded = buffer.readUInt32LE(central + 24);
    const nameLength = buffer.readUInt16LE(central + 28);
    const name = buffer.subarray(central + 46, central + 46 + nameLength).toString('utf8');
    const local = buffer.readUInt32LE(central + 42);
    if (name !== 'intelligence-operation.json' || expanded > 65536 || compressed > 65536 || ![0, 8].includes(method)
        || buffer.readUInt32LE(local) !== 0x04034b50) throw new Error('unexpected artifact');
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    if (start + compressed > central) throw new Error('invalid zip bounds');
    const data = buffer.subarray(start, start + compressed);
    const json = method === 8 ? inflateRawSync(data, { maxOutputLength: 65536 }) : data;
    if (json.length !== expanded) throw new Error('invalid zip size');
    return cleanOperation(JSON.parse(json.toString('utf8')));
}

export async function collectEvidence({ repo, token, fetch, config } = {}) {
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo || '') || !token) throw new Error('GitHub repository and token required');
    const base = `https://api.github.com/repos/${repo}`;
    const read = reader({ token, fetch, config });
    const pagesWorkflows = ['deploy-pages.yml', 'publish-blog.yml', 'auto-merge-dependencies.yml', 'auto-publish-author-pr.yml'];
    const [repository, runsRead, pagesReads, publicRead] = await Promise.all([
        read(base), read(`${base}/actions/workflows/intelligence-snapshot.yml/runs?branch=main&per_page=30`),
        Promise.all(pagesWorkflows.map(workflow => read(`${base}/actions/workflows/${workflow}/runs?branch=main&per_page=30`))),
        read(PUBLIC_SNAPSHOT, { publicRead: true })
    ]);
    const list = (result, key) => {
        if (!result.ok || !Array.isArray(result.value?.[key])) return { ok: false };
        if (key === 'workflow_runs' && !result.value[key].every(run => Number.isSafeInteger(run?.id) && instant(time(run))
            && (run.run_attempt === undefined || Number.isSafeInteger(run.run_attempt) && run.run_attempt > 0)
            && ['completed', 'in_progress', 'queued', 'requested', 'waiting', 'pending'].includes(run.status))) return { ok: false };
        return { ok: true, value: result.value[key].map(key === 'workflow_runs' ? cleanRun : cleanJob) };
    };
    const runs = list(runsRead, 'workflow_runs');
    const pagesLists = pagesReads.map(result => list(result, 'workflow_runs'));
    const evidence = { runs, pagesRuns: { ok: false }, operations: {}, jobs: {}, pagesJobs: {}, repoSnapshot: { ok: false },
        publicSnapshot: publicRead.ok ? { ok: true, value: publicRead.value } : { ok: false }, issuesEnabled: repository.ok ? repository.value?.has_issues === true : null };
    if (repository.ok && /^[A-Za-z0-9_./-]+$/.test(repository.value?.default_branch || '')) {
        const contents = await read(`${base}/contents/${SNAPSHOT_PATH}?ref=${encodeURIComponent(repository.value.default_branch)}`);
        if (contents.ok && contents.value?.encoding === 'base64' && typeof contents.value.content === 'string') {
            evidence.repoSnapshot = { ok: true, value: Buffer.from(contents.value.content, 'base64').toString('utf8') };
        }
    }
    // Bound the history: absent/expired artifacts remain UNKNOWN rather than guessed from free-text logs.
    for (const run of (runs.ok ? runs.value : []).slice(0, 10)) {
        if (!Number.isSafeInteger(run.id)) continue;
        const [jobs, artifacts] = await Promise.all([
            read(`${base}/actions/runs/${run.id}/attempts/${run.run_attempt || 1}/jobs?per_page=100`),
            read(`${base}/actions/runs/${run.id}/artifacts?per_page=100`)
        ]);
        evidence.jobs[run.id] = list(jobs, 'jobs');
        evidence.operations[run.id] = { ok: false };
        const artifact = artifacts.ok && Array.isArray(artifacts.value?.artifacts)
            && artifacts.value.artifacts.find(item => item?.name === `intelligence-operation-${run.id}-${run.run_attempt || 1}` && !item.expired);
        if (artifact && Number.isSafeInteger(artifact.id)) {
            const zip = await read(`${base}/actions/artifacts/${artifact.id}/zip`, { binary: true });
            try { if (zip.ok) evidence.operations[run.id] = { ok: true, value: operationFromZip(zip.value) }; } catch { /* UNKNOWN */ }
        }
    }
    for (const run of pagesLists.flatMap(result => result.ok ? result.value.slice(0, 5) : [])) {
        if (Number.isSafeInteger(run.id)) evidence.pagesJobs[run.id] = list(await read(`${base}/actions/runs/${run.id}/attempts/${run.run_attempt || 1}/jobs?per_page=100`), 'jobs');
    }
    if (pagesLists.every(result => result.ok)) {
        // Caller success without an actual deployment cannot supersede a failed Pages run.
        evidence.pagesRuns = { ok: true, value: pagesLists.flatMap((result, index) => result.value.flatMap(run => {
            const jobs = evidence.pagesJobs[run.id];
            const deploy = jobs?.value?.find(job => job.name === 'Deploy Pages artifact');
            if (index > 0 && jobs?.ok && (!deploy || deploy.conclusion === 'skipped')) return [];
            return [deploy?.startedAt ? { ...run, run_started_at: deploy.startedAt } : run];
        })) };
    }
    return evidence;
}

export async function loadIssues({ repo, token, fetch, config }) {
    const read = reader({ token, fetch, config });
    const base = `https://api.github.com/repos/${repo}`;
    async function all(url) {
        const values = [];
        for (let page = 1; page <= 10; page++) {
            const result = await read(`${url}${url.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
            if (!result.ok || !Array.isArray(result.value)) throw new Error('Issue state unavailable; writes suppressed');
            values.push(...result.value);
            if (result.value.length < 100) return values;
        }
        throw new Error('Issue pagination limit; writes suppressed');
    }
    const issues = await all(`${base}/issues?state=open&labels=${LABEL}`);
    for (const issue of issues) {
        if (issue.comments > 0 && Number.isSafeInteger(issue.number)) issue.commentsData = await all(`${base}/issues/${issue.number}/comments`);
    }
    return issues;
}

export async function executeIncidents(actions, { repo, token, fetch = globalThis.fetch, config = {} }) {
    const base = `https://api.github.com/repos/${repo}`;
    // Writes are never retried: a lost response must be reconciled by the next serialized watchdog.
    async function write(method, suffix, body) {
        const response = await fetch(`${base}${suffix}`, { method, signal: AbortSignal.timeout(config.readTimeoutMs || CONFIG.readTimeoutMs),
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!response.ok) throw new Error('Incident write failed; no retry attempted');
    }
    if (actions.some(action => action.type === 'create')) {
        const label = await reader({ token, fetch, config })(`${base}/labels/${LABEL}`);
        if (!label.ok) {
            if (label.error !== 'HTTP_404') throw new Error('Incident label unavailable; writes suppressed');
            await write('POST', '/labels', { name: LABEL, color: 'd93f0b', description: 'Intelligence pipeline operational incidents' });
        }
    }
    for (const action of actions) {
        if (action.type === 'create') await write('POST', '/issues', { title: action.title, body: action.body, labels: [LABEL] });
        else {
            if (action.body) await write('POST', `/issues/${action.number}/comments`, { body: action.body });
            if (action.type === 'close') await write('PATCH', `/issues/${action.number}`, { state: 'closed', state_reason: 'completed' });
        }
    }
}

export const exitCode = assessment => assessment.overall === 'CRITICAL' ? 1 : 0;

async function main(argv, env) {
    const dryRun = argv.includes('--dry-run');
    const json = argv.includes('--json');
    const output = argv.find(arg => arg.startsWith('--out='))?.slice(6);
    const incidentFile = argv.find(arg => arg.startsWith('--incidents='))?.slice(12);
    const repo = env.GITHUB_REPOSITORY;
    const token = env.GITHUB_TOKEN;
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo || '') || !token) throw new Error('GitHub repository and token required');
    let assessment;
    let issuesEnabled = null;
    if (incidentFile) {
        // Reassess the safe evidence artifact; never execute a plan or Markdown supplied by an artifact.
        const saved = JSON.parse(fs.readFileSync(incidentFile, 'utf8'));
        assessment = assessHealth(saved.evidence, { now: saved.observedAt });
        issuesEnabled = saved.evidence.issuesEnabled;
    } else {
        const evidence = await collectEvidence({ repo, token });
        assessment = assessHealth(evidence, { now: new Date() });
        issuesEnabled = evidence.issuesEnabled;
        if (output) {
            // Retain dates and digests for replay, never ciphertext, nonce or key check.
            const safeEnvelope = read => {
                if (!read?.ok) return { ok: false };
                try {
                    return { ok: true, value: envelopeMetadata(read.value) };
                } catch { return { ok: true, value: '{}' }; }
            };
            const safe = { ...evidence, repoSnapshot: safeEnvelope(evidence.repoSnapshot), publicSnapshot: safeEnvelope(evidence.publicSnapshot) };
            fs.writeFileSync(output, JSON.stringify({ observedAt: assessment.observedAt, evidence: safe }));
        }
    }
    let incidentSync = 'NOT_REQUESTED';
    let actions = [];
    // Read/assess job has no Issue permission; the separate incident job consumes its evidence.
    if (!output || incidentFile) {
        try {
            if (issuesEnabled !== true) throw new Error('Issue availability UNKNOWN or disabled; writes suppressed');
            const issues = await loadIssues({ repo, token });
            actions = planIncidents(issues, assessment);
            if (!dryRun) await executeIncidents(actions, { repo, token });
            incidentSync = dryRun ? 'DRY_RUN' : 'COMPLETE';
        } catch {
            incidentSync = 'UNKNOWN';
        }
    }
    const summary = `${formatSummary(assessment)}\nIncident synchronization: ${incidentSync}.\n`;
    if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY, summary);
    console.log(json ? JSON.stringify({ ...assessment, incidentSync, ...(dryRun ? { incidentPlan: actions } : {}) }, null, 2)
        : `${summary}${dryRun ? `\n${JSON.stringify({ dryRun: true, actions }, null, 2)}\n` : ''}`);
    process.exitCode = exitCode(assessment);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main(process.argv.slice(2), process.env).catch(() => {
        const assessment = assessHealth({}, { now: new Date() });
        const summary = `${formatSummary(assessment)}\nCollection or configuration: UNKNOWN. No recovery inferred.\n`;
        try {
            if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
        } catch { /* stdout still reports UNKNOWN if the summary file is unavailable. */ }
        console.log(process.argv.includes('--json') ? JSON.stringify({ ...assessment, incidentSync: 'UNKNOWN' }) : summary);
        process.exitCode = 0;
    });
}
