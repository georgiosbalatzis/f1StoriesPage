#!/usr/bin/env node
// I-08A: offline governance only; no analytics, publication or registry writes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXPERIMENT_STATUSES = Object.freeze(['PROPOSED', 'APPROVED', 'RUNNING', 'PAUSED', 'COMPLETED', 'INCONCLUSIVE', 'ROLLED_BACK']);
export const ALLOWED_TRANSITIONS = Object.freeze({
    PROPOSED: Object.freeze(['APPROVED', 'INCONCLUSIVE']),
    APPROVED: Object.freeze(['RUNNING', 'PAUSED', 'INCONCLUSIVE']),
    RUNNING: Object.freeze(['PAUSED', 'COMPLETED', 'INCONCLUSIVE', 'ROLLED_BACK']),
    PAUSED: Object.freeze(['APPROVED', 'RUNNING', 'INCONCLUSIVE', 'ROLLED_BACK']),
    COMPLETED: Object.freeze(['ROLLED_BACK']),
    INCONCLUSIVE: Object.freeze(['ROLLED_BACK']),
    ROLLED_BACK: Object.freeze([])
});
export const MATURITY_LAG_DAYS = Object.freeze({ ga4: 4, gsc: 3, rum: 4, repo: 0 });
export const DEFAULT_EVIDENCE_FLOOR = 30;
const DAY = 86400000;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPO = 'https://github.com/georgiosbalatzis/f1StoriesPage/';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0 && value === value.trim();
const source = value => typeof value === 'string' && Object.hasOwn(MATURITY_LAG_DAYS, value);
const day = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const dayNumber = value => Date.parse(`${value}T00:00:00Z`) / DAY;
const prLink = value => typeof value === 'string' && value.startsWith(`${REPO}pull/`) && /^[1-9]\d*$/.test(value.slice(`${REPO}pull/`.length));
const commitLink = value => typeof value === 'string' && value.startsWith(`${REPO}commit/`) && /^[a-f0-9]{40}$/.test(value.slice(`${REPO}commit/`.length));

function canonicalURL(value) {
    if (typeof value !== 'string') return false;
    try {
        const url = new URL(value);
        return url.origin === 'https://f1-stories.gr' && !url.username && !url.password && !url.search && !url.hash
            && url.href === value && !/[?#]/.test(value);
    } catch { return false; }
}

// `today` is an injectable ISO calendar day for reproducible offline checks, never a field in the registry.
export function validateRegistry(doc, { today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date()) } = {}) {
    const errors = [], warnings = [];
    const result = () => ({ ok: errors.length === 0, errors, warnings });
    if (!day(today)) return { ok: false, errors: ['today: expected a real ISO date (YYYY-MM-DD)'], warnings };
    const fields = (value, required, optional, at) => {
        if (!object(value)) { errors.push(`${at}: expected an object`); return false; }
        for (const key of required) if (!Object.hasOwn(value, key)) errors.push(`${at}.${key}: required`);
        for (const key of Object.keys(value)) if (![...required, ...optional].includes(key)) errors.push(`${at}.${key}: unknown field (schema version 1)`);
        return true;
    };
    const strings = (values, at, nonempty = false) => {
        if (!Array.isArray(values) || (nonempty && !values.length) || !values.every(text)) errors.push(`${at}: expected ${nonempty ? 'a nonempty' : 'an'} array of nonblank strings`);
    };
    const links = (value, at, required) => {
        if (value.pr != null && !prLink(value.pr)) errors.push(`${at}.pr: expected a repository PR link`);
        if (value.commit != null && !commitLink(value.commit)) errors.push(`${at}.commit: expected a full repository commit link`);
        if (required && !prLink(value.pr) && !commitLink(value.commit)) errors.push(`${at}: a PR or commit link is required`);
    };
    if (!fields(doc, ['version', 'experiments'], [], 'registry')) return result();
    if (doc.version !== 1) errors.push('registry.version: expected 1');
    if (!Array.isArray(doc.experiments)) { errors.push('registry.experiments: expected an array'); return result(); }
    const ids = new Set(), running = [];
    for (const [index, exp] of doc.experiments.entries()) {
        const at = `experiments[${index}]`;
        if (!fields(exp, ['id', 'hypothesis', 'urls', 'topic', 'owner', 'changeType', 'targetBehaviour', 'mechanism',
            'primaryOutcome', 'guardrails', 'baselinePeriod', 'comparisonPeriod', 'confounders', 'decisionPolicy',
            'failureModes', 'rollback', 'status', 'history', 'pr', 'commit'], ['evidenceFloor'], at)) continue;
        if (typeof exp.id !== 'string' || !/^EG-\d{4}-\d{3}$/.test(exp.id)) errors.push(`${at}.id: expected EG-YYYY-NNN`);
        if (ids.has(exp.id)) errors.push(`${at}.id: duplicate id`);
        ids.add(exp.id);
        for (const key of ['hypothesis', 'topic', 'owner', 'changeType', 'targetBehaviour', 'mechanism', 'decisionPolicy', 'rollback']) {
            if (!text(exp[key])) errors.push(`${at}.${key}: expected a nonblank string`);
        }
        strings(exp.confounders, `${at}.confounders`);
        strings(exp.failureModes, `${at}.failureModes`, true);
        if (!Array.isArray(exp.urls) || !exp.urls.length || !exp.urls.every(canonicalURL)) errors.push(`${at}.urls: expected canonical https://f1-stories.gr/ URLs without query or fragment`);
        if (Array.isArray(exp.urls) && new Set(exp.urls).size !== exp.urls.length) errors.push(`${at}.urls: duplicate URL`);
        if (fields(exp.primaryOutcome, ['metric', 'unit', 'source', 'population'], [], `${at}.primaryOutcome`)) {
            for (const key of ['unit', 'population']) if (!text(exp.primaryOutcome[key])) errors.push(`${at}.primaryOutcome.${key}: expected a nonblank string`);
            if (typeof exp.primaryOutcome.metric !== 'string' || !/^[a-z][a-z0-9_]*$/.test(exp.primaryOutcome.metric)) errors.push(`${at}.primaryOutcome.metric: expected a stable lowercase snake_case identifier`);
            if (!source(exp.primaryOutcome.source)) errors.push(`${at}.primaryOutcome.source: expected gsc, ga4, rum or repo`);
        }
        if (!Array.isArray(exp.guardrails) || !exp.guardrails.length) errors.push(`${at}.guardrails: expected a nonempty array`);
        else for (const [i, guardrail] of exp.guardrails.entries()) {
            const where = `${at}.guardrails[${i}]`;
            if (!fields(guardrail, ['metric', 'threshold', 'source'], [], where)) continue;
            for (const key of ['metric', 'threshold']) if (!text(guardrail[key])) errors.push(`${where}.${key}: expected a nonblank string`);
            if (!source(guardrail.source)) errors.push(`${where}.source: expected gsc, ga4, rum or repo`);
        }
        if (exp.evidenceFloor !== undefined && (!Number.isSafeInteger(exp.evidenceFloor) || exp.evidenceFloor < 1)) errors.push(`${at}.evidenceFloor: expected a positive safe integer (default 30 per period)`);
        if (Number.isSafeInteger(exp.evidenceFloor) && exp.evidenceFloor > 0 && exp.evidenceFloor < DEFAULT_EVIDENCE_FLOOR) warnings.push(`${at}.evidenceFloor: below the default 30; insufficient evidence must remain INCONCLUSIVE`);

        const periods = [];
        for (const key of ['baselinePeriod', 'comparisonPeriod']) {
            const value = exp[key];
            if (!fields(value, ['start', 'end'], [], `${at}.${key}`)) continue;
            if (!day(value.start) || !day(value.end)) errors.push(`${at}.${key}: expected real ISO dates (YYYY-MM-DD)`);
            else if (value.start > value.end) errors.push(`${at}.${key}: start must not follow end`);
            else periods.push(value);
        }
        if (periods.length === 2) {
            const [baseline, comparison] = periods;
            if (dayNumber(baseline.end) - dayNumber(baseline.start) !== dayNumber(comparison.end) - dayNumber(comparison.start)) errors.push(`${at}: periods must have equal inclusive lengths`);
            if (baseline.end >= comparison.start) errors.push(`${at}: baseline must end before comparison starts (non-overlapping periods)`);
            const sources = [exp.primaryOutcome?.source, ...(Array.isArray(exp.guardrails) ? exp.guardrails.map(g => g?.source) : [])].filter(source);
            const lag = Math.max(0, ...sources.map(s => MATURITY_LAG_DAYS[s]));
            if (exp.status === 'COMPLETED' && dayNumber(comparison.end) > dayNumber(today) - lag) errors.push(`${at}.comparisonPeriod: not mature; must end at least ${lag} days before today (${today})`);
        }

        if (!EXPERIMENT_STATUSES.includes(exp.status)) errors.push(`${at}.status: unknown status`);
        let previous = null, previousDate = null, approved = false;
        if (!Array.isArray(exp.history) || !exp.history.length) errors.push(`${at}.history: expected a nonempty append-only status trail`);
        else for (const [i, entry] of exp.history.entries()) {
            const where = `${at}.history[${i}]`;
            if (!fields(entry, ['status', 'date', 'actor', 'note'], ['pr', 'commit'], where)) continue;
            for (const key of ['actor', 'note']) if (!text(entry[key])) errors.push(`${where}.${key}: expected a nonblank string`);
            if (!day(entry.date)) errors.push(`${where}.date: expected a real ISO date (YYYY-MM-DD)`);
            else {
                if (entry.date > today) errors.push(`${where}.date: cannot be in the future`);
                if (previousDate && entry.date < previousDate) errors.push(`${where}.date: history must be chronological`);
                previousDate = entry.date;
            }
            if (!EXPERIMENT_STATUSES.includes(entry.status)) errors.push(`${where}.status: unknown status`);
            if (i === 0 && entry.status !== 'PROPOSED') errors.push(`${where}.status: history must begin with PROPOSED`);
            if (i > 0 && (!EXPERIMENT_STATUSES.includes(previous) || !ALLOWED_TRANSITIONS[previous].includes(entry.status))) {
                errors.push(`${where}.status: illegal transition from the previous history status`);
            }
            if (entry.status === 'RUNNING' && !approved) errors.push(`${where}: RUNNING requires a prior approval entry`);
            links(entry, where, ['APPROVED', 'RUNNING', 'ROLLED_BACK'].includes(entry.status));
            if (entry.status === 'APPROVED') approved = true;
            previous = entry.status;
        }
        if (previous !== exp.status) errors.push(`${at}.status: must equal the last history status`);
        links(exp, at, approved || ['RUNNING', 'ROLLED_BACK'].includes(exp.status));
        if (exp.status === 'RUNNING' && periods.length === 2 && Array.isArray(exp.urls)) running.push({ exp, periods, at });
        warnings.push(`${at}: before/after evidence is observational; counts and outcome are NOT VERIFIED by registry validation`);
    }
    for (let i = 0; i < running.length; i++) for (let j = i + 1; j < running.length; j++) {
        const a = running[i], b = running[j];
        if (a.exp.primaryOutcome?.metric === b.exp.primaryOutcome?.metric && a.exp.urls.some(url => b.exp.urls.includes(url))
            && a.periods.some(p => b.periods.some(q => p.start <= q.end && q.start <= p.end))) {
            errors.push(`${a.at}, ${b.at}: RUNNING experiments overlap on the same URL and primary metric`);
        }
    }
    return result();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const [command, filename, ...extra] = process.argv.slice(2);
        if (command !== 'check' || extra.length) throw new Error('Usage: node scripts/intelligence/experiment-registry.mjs check [path]');
        const doc = JSON.parse(fs.readFileSync(filename || path.join(ROOT, 'experiments/editorial-growth/registry.json'), 'utf8'));
        const report = validateRegistry(doc);
        console.log(report.ok ? 'PASS: registry schema and governance checks' : 'FAIL: registry schema or governance checks');
        for (const message of report.errors) console.error(`FAIL: ${message}`);
        for (const message of report.warnings) console.warn(`WARNING: ${message}`);
        process.exitCode = report.ok ? 0 : 1;
    } catch (error) {
        // Do not echo parser input: a mistakenly selected file may contain private data.
        console.error(error instanceof SyntaxError ? 'FAIL: invalid JSON' : error.code ? `FAIL: cannot read registry (${error.code})` : `FAIL: ${error.message}`);
        process.exitCode = 1;
    }
}
