import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ALLOWED_TRANSITIONS, DEFAULT_EVIDENCE_FLOOR, EXPERIMENT_STATUSES, MATURITY_LAG_DAYS, validateRegistry } from '../experiment-registry.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const cli = path.join(root, 'scripts/intelligence/experiment-registry.mjs');
const fixture = fileURLToPath(new URL('./fixtures/experiment-registry/synthetic.json', import.meta.url));
const read = filename => JSON.parse(fs.readFileSync(filename, 'utf8'));
const registry = () => read(fixture);
const options = { today: '2000-01-18' };
const validate = doc => validateRegistry(doc, options);
function reject(mutate, pattern) {
    const doc = registry();
    mutate(doc.experiments[0], doc);
    const report = validate(doc);
    assert.equal(report.ok, false, JSON.stringify(report));
    assert.ok(report.errors.some(error => pattern.test(error)), JSON.stringify(report.errors));
}
function entry(status) {
    return { status, date: '2000-01-15', actor: 'Synthetic owner', note: 'SYNTHETIC transition', commit: registry().experiments[0].commit };
}

test('committed registry starts empty and validates', () => {
    const doc = read(path.join(root, 'experiments/editorial-growth/registry.json'));
    assert.deepEqual(doc, { version: 1, experiments: [] });
    assert.deepEqual(validateRegistry(doc), { ok: true, errors: [], warnings: [] });
});

test('complete synthetic record validates without mutation; defaults and limits are explicit', () => {
    const doc = registry(), before = structuredClone(doc);
    const report = validate(doc);
    assert.equal(report.ok, true, JSON.stringify(report));
    assert.match(report.warnings.join('\n'), /observational.*NOT VERIFIED/);
    assert.deepEqual(doc, before);
    assert.deepEqual(MATURITY_LAG_DAYS, { ga4: 4, gsc: 3, rum: 4, repo: 0 });
    assert.equal(DEFAULT_EVIDENCE_FLOOR, 30);
    delete doc.experiments[0].evidenceFloor;
    assert.equal(validate(doc).ok, true);
    doc.experiments[0].evidenceFloor = 10;
    assert.match(validate(doc).warnings.join('\n'), /below the default 30/);
});

test('documented complete example stays in sync with the validated synthetic fixture', () => {
    const readme = fs.readFileSync(path.join(root, 'experiments/editorial-growth/README.md'), 'utf8');
    const example = JSON.parse(readme.match(/```json\n([\s\S]*?)\n```/)[1]);
    assert.deepEqual(example, registry());
    assert.equal(validate(example).ok, true);
});

test('schema refuses malformed structures, missing fields and unknown version or keys', () => {
    for (const doc of [null, [], 1, 'registry', {}, { version: 2, experiments: [] }, { version: 1, experiments: null },
        { version: 1, experiments: [null, [], 2] }, { version: 1, experiments: [], extra: true }]) {
        assert.equal(validate(doc).ok, false);
    }
    for (const field of Object.keys(registry().experiments[0]).filter(key => key !== 'evidenceFloor')) {
        reject(exp => { delete exp[field]; }, new RegExp(field));
    }
    reject(exp => { exp.extra = 'not in v1'; }, /unknown field/);
    reject(exp => { exp.primaryOutcome = []; }, /primaryOutcome/);
    for (const source of ['google', null, [], { toString: null }]) reject(exp => { exp.primaryOutcome.source = source; }, /source/);
    reject(exp => { exp.primaryOutcome.metric = ' Internal Clicks '; }, /metric/);
    reject(exp => { exp.primaryOutcome.population = ''; }, /population/);
    reject(exp => { exp.guardrails = []; }, /guardrails/);
    reject(exp => { exp.guardrails = [null]; }, /guardrails/);
    reject(exp => { exp.guardrails[0].threshold = 2500; }, /threshold/);
    reject(exp => { exp.guardrails[0].source = 'other'; }, /source/);
    reject(exp => { exp.failureModes = []; }, /failureModes/);
    reject(exp => { exp.confounders = [null]; }, /confounders/);
    for (const value of [null, 0, -1, 1.5, '30', Number.MAX_SAFE_INTEGER + 1]) reject(exp => { exp.evidenceFloor = value; }, /evidenceFloor/);
});

test('stable IDs are unique, and rollback cannot be absent or blank', () => {
    for (const id of ['eg-2000-001', 'EG-00-1', ' EG-2000-001', null]) reject(exp => { exp.id = id; }, /id/);
    reject((exp, doc) => { doc.experiments.push(structuredClone(exp)); }, /duplicate id/);
    for (const value of ['', '   ', null, []]) reject(exp => { exp.rollback = value; }, /rollback/);
});

test('URLs reject the old domain, credentials, tracking variants and noncanonical forms', () => {
    for (const url of ['https://f1stories.gr/', 'http://f1-stories.gr/', 'https://www.f1-stories.gr/',
        'https://f1-stories.gr.evil.example/', 'https://f1-stories.gr@evil.example/', 'https://owner@f1-stories.gr/',
        'https://f1-stories.gr:444/', 'https://f1-stories.gr:443/', 'https://F1-STORIES.gr/', 'https://f1-stories.gr',
        'https://f1-stories.gr/a/../b/', 'https://f1-stories.gr/?utm_source=synthetic', 'https://f1-stories.gr/#part',
        'https://f1-stories.gr/?', 'https://f1-stories.gr/#', '/relative/', 'invalid', null]) {
        reject(exp => { exp.urls = [url]; }, /canonical/);
    }
    reject(exp => { exp.urls = []; }, /urls/);
    reject(exp => { exp.urls.push(exp.urls[0]); }, /duplicate URL/);
});

test('real ISO dates, equal inclusive periods, ordering and non-overlap are enforced', () => {
    for (const date of ['2000-02-30', '2001-02-29', '2000-13-01', '2000-01-00', '2000-1-01', '2000-01-01T00:00:00Z', null]) {
        reject(exp => { exp.baselinePeriod.start = date; }, /real ISO/);
        reject(exp => { exp.history[0].date = date; }, /real ISO/);
    }
    reject(exp => { exp.baselinePeriod.start = '2000-01-08'; }, /start must not follow end/);
    reject(exp => { exp.comparisonPeriod.end = '2000-01-13'; }, /equal inclusive lengths/);
    reject(exp => { exp.comparisonPeriod = { start: '2000-01-07', end: '2000-01-13' }; }, /non-overlapping/);
    reject(exp => { [exp.baselinePeriod, exp.comparisonPeriod] = [exp.comparisonPeriod, exp.baselinePeriod]; }, /baseline must end before/);
    const leap = registry();
    leap.experiments[0].baselinePeriod = { start: '2000-02-29', end: '2000-02-29' };
    leap.experiments[0].comparisonPeriod = { start: '2000-03-01', end: '2000-03-01' };
    assert.equal(validateRegistry(leap, { today: '2000-03-05' }).ok, true);
    assert.equal(validateRegistry(registry(), { today: 'not a day' }).ok, false);
});

test('COMPLETED maturity uses the strictest primary/guardrail source and accepts the exact boundary', () => {
    for (const [source, lag] of Object.entries(MATURITY_LAG_DAYS)) {
        const doc = registry(), exp = doc.experiments[0];
        exp.status = 'COMPLETED';
        exp.history.push({ ...entry('COMPLETED'), date: '2000-01-14' });
        exp.primaryOutcome.source = source;
        exp.guardrails = [{ metric: 'Synthetic quality', threshold: 'owner review passes', source: 'repo' }];
        const mature = `2000-01-${14 + lag}`;
        assert.equal(validateRegistry(doc, { today: mature }).ok, true, source);
        assert.match(validateRegistry(doc, { today: `2000-01-${13 + lag}` }).errors.join('\n'), /not mature/, source);
    }
    const doc = registry();
    doc.experiments[0].status = 'COMPLETED';
    doc.experiments[0].history.push({ ...entry('COMPLETED'), date: '2000-01-14' });
    doc.experiments[0].primaryOutcome.source = 'gsc';
    assert.match(validateRegistry(doc, { today: '2000-01-17' }).errors.join('\n'), /at least 4 days/);
});

test('future comparison periods are valid for every status except COMPLETED, including early endings', () => {
    for (const status of EXPERIMENT_STATUSES) {
        const doc = registry(), exp = doc.experiments[0];
        exp.comparisonPeriod = { start: '2000-02-01', end: '2000-02-07' };
        if (status === 'PROPOSED') exp.history = exp.history.slice(0, 1);
        else if (status === 'APPROVED') exp.history = exp.history.slice(0, 2);
        else if (status !== 'RUNNING') exp.history.push(entry(status));
        exp.status = status;
        const report = validate(doc);
        assert.equal(report.ok, status !== 'COMPLETED', `${status}: ${JSON.stringify(report)}`);
        if (status === 'COMPLETED') assert.match(report.errors.join('\n'), /not mature/);
    }
});

test('every status transition is checked against history, including terminal statuses', () => {
    assert.deepEqual(EXPERIMENT_STATUSES, ['PROPOSED', 'APPROVED', 'RUNNING', 'PAUSED', 'COMPLETED', 'INCONCLUSIVE', 'ROLLED_BACK']);
    const prefix = {
        PROPOSED: ['PROPOSED'], APPROVED: ['PROPOSED', 'APPROVED'], RUNNING: ['PROPOSED', 'APPROVED', 'RUNNING'],
        PAUSED: ['PROPOSED', 'APPROVED', 'RUNNING', 'PAUSED'], COMPLETED: ['PROPOSED', 'APPROVED', 'RUNNING', 'COMPLETED'],
        INCONCLUSIVE: ['PROPOSED', 'APPROVED', 'RUNNING', 'INCONCLUSIVE'], ROLLED_BACK: ['PROPOSED', 'APPROVED', 'RUNNING', 'ROLLED_BACK']
    };
    for (const from of EXPERIMENT_STATUSES) for (const to of EXPERIMENT_STATUSES) {
        const doc = registry(), exp = doc.experiments[0];
        exp.history = [...prefix[from], to].map(entry);
        exp.status = to;
        assert.equal(validate(doc).ok, ALLOWED_TRANSITIONS[from].includes(to), `${from} -> ${to}`);
    }
    reject(exp => { exp.history = [entry('RUNNING')]; }, /begin with PROPOSED/);
    reject(exp => { exp.history = [entry('PROPOSED'), entry('RUNNING')]; }, /requires a prior approval/);
    reject(exp => { exp.status = 'COMPLETED'; }, /last history status/);
    reject(exp => { exp.history[1].date = '1999-12-19'; }, /chronological/);
    reject(exp => { exp.history[2].date = '2000-01-19'; }, /future/);
    for (const value of ['UNKNOWN', 'toString', '__proto__', 'constructor', null, [], { toString: null }]) reject(exp => { exp.history[1].status = value; }, /unknown status/);
});

test('approval, start and rollback need repository PR/commit links; links are format checked only', () => {
    for (const i of [1, 2]) reject(exp => { delete exp.history[i].commit; }, /PR or commit link is required/);
    reject(exp => { exp.history.push({ ...entry('ROLLED_BACK'), commit: null }); exp.status = 'ROLLED_BACK'; }, /PR or commit link is required/);
    reject(exp => { exp.commit = null; }, /PR or commit link is required/);
    for (const link of ['https://github.com/other/repo/commit/' + '0'.repeat(40), 'https://example.com/commit/123',
        'https://github.com/georgiosbalatzis/f1StoriesPage/commit/0000000']) {
        reject(exp => { exp.commit = link; }, /full repository commit link/);
    }
    reject(exp => { exp.pr = 'https://github.com/georgiosbalatzis/f1StoriesPage/pull/0'; }, /repository PR link/);
    const doc = registry(), exp = doc.experiments[0];
    exp.commit = null;
    exp.pr = 'https://github.com/georgiosbalatzis/f1StoriesPage/pull/999999';
    exp.history = exp.history.map(e => ({ ...e, commit: null, pr: exp.pr }));
    assert.equal(validate(doc).ok, true);
});

test('RUNNING conflicts include boundary days and cross-period overlaps, regardless of source', () => {
    const pair = () => {
        const doc = registry(), second = structuredClone(doc.experiments[0]);
        second.id = 'EG-2000-002';
        doc.experiments.push(second);
        return doc;
    };
    assert.match(validate(pair()).errors.join('\n'), /RUNNING experiments overlap/);
    for (const mutate of [exp => { exp.primaryOutcome.source = 'gsc'; },
        exp => { exp.baselinePeriod = { start: '2000-01-14', end: '2000-01-14' }; exp.comparisonPeriod = { start: '2000-01-15', end: '2000-01-15' }; }]) {
        const doc = pair();
        mutate(doc.experiments[1]);
        assert.match(validateRegistry(doc, { today: '2000-01-20' }).errors.join('\n'), /RUNNING experiments overlap/);
    }
    for (const mutate of [exp => { exp.urls = ['https://f1-stories.gr/another-synthetic/']; },
        exp => { exp.primaryOutcome.metric = 'page_view'; },
        exp => { exp.history.push(entry('PAUSED')); exp.status = 'PAUSED'; },
        exp => { exp.baselinePeriod = { start: '1999-12-01', end: '1999-12-07' }; exp.comparisonPeriod = { start: '1999-12-08', end: '1999-12-14' }; }]) {
        const doc = pair();
        mutate(doc.experiments[1]);
        assert.equal(validate(doc).ok, true, JSON.stringify(validate(doc)));
    }
    const malformed = pair();
    malformed.experiments[1].primaryOutcome = null;
    assert.equal(validate(malformed).ok, false);
});

test('RUNNING conflicts resolve known retired and encoded article identities but preserve unmapped URLs', () => {
    const base = 'https://f1-stories.gr/blog-module/blog-entries/';
    for (const [left, right, conflict] of [
        ['20260222T/article.html', '20260227%CE%A4/article.html', true],
        ['20260227%CE%A4/article.html', '20260227%ce%a4/article.html', true],
        ['20260227%CE%A4/article.html', '20260227%cE%A4/article.html', true],
        ['20260222T/article.html', '20260222%54/article.html', true],
        ['20260222T/', '20260227%CE%A4/article.html', true],
        ['synthetic-unmapped-a/article.html', 'synthetic-unmapped-b/article.html', false],
        ['synthetic-unmapped-a/article.html', '%73ynthetic-unmapped-a/article.html', false],
        ['synthetic-unmapped-%CE%A4/article.html', 'synthetic-unmapped-%ce%a4/article.html', false],
        ['synthetic-unmapped-%ZZ/article.html', 'synthetic-unmapped-%YY/article.html', false]
    ]) {
        const doc = registry(), first = doc.experiments[0];
        first.urls = [base + left];
        doc.experiments.push({ ...structuredClone(first), id: 'EG-2000-002', urls: [base + right] });
        const before = structuredClone(doc), report = validate(doc);
        assert.equal(report.ok, !conflict, `${left}, ${right}: ${JSON.stringify(report)}`);
        if (conflict) assert.match(report.errors.join('\n'), /RUNNING experiments overlap/);
        assert.deepEqual(doc, before, 'stored URLs must remain unchanged');
    }
});

test('duplicate URLs within an experiment include known retired aliases and encoding variants', () => {
    const base = 'https://f1-stories.gr/blog-module/blog-entries/';
    reject(exp => { exp.urls = [base + '20260222T/article.html', base + '20260227%CE%A4/article.html']; }, /duplicate URL or article identity/);
    reject(exp => { exp.urls = [base + '20260227%CE%A4/article.html', base + '20260227%ce%a4/article.html']; }, /duplicate URL or article identity/);
    const doc = registry();
    doc.experiments[0].urls = [base + 'synthetic-unmapped-a/article.html', base + '%73ynthetic-unmapped-a/article.html'];
    assert.equal(validate(doc).ok, true);
});

test('CLI checks default and explicit files, handles invalid input and writes nothing', () => {
    const run = args => spawnSync(process.execPath, [cli, ...args], { cwd: os.tmpdir(), encoding: 'utf8' });
    assert.equal(run(['check']).status, 0);
    const valid = run(['check', fixture]);
    assert.equal(valid.status, 0);
    assert.match(valid.stdout, /PASS/);
    assert.match(valid.stderr, /WARNING/);
    assert.equal(run([]).status, 1);
    assert.equal(run(['check', fixture, 'extra']).status, 1);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'experiment-registry-'));
    try {
        const filename = path.join(dir, 'synthetic.json');
        assert.equal(run(['check', filename]).status, 1);
        fs.writeFileSync(filename, '{SYNTHETIC malformed JSON');
        const malformed = run(['check', filename]);
        assert.equal(malformed.status, 1);
        assert.equal(malformed.stderr.trim(), 'FAIL: invalid JSON');
        fs.writeFileSync(filename, JSON.stringify({ version: 2, experiments: [] }));
        const before = fs.readFileSync(filename, 'utf8');
        assert.equal(run(['check', filename]).status, 1);
        assert.equal(fs.readFileSync(filename, 'utf8'), before);
        assert.deepEqual(fs.readdirSync(dir), ['synthetic.json']);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('unknown keys never leak into validator diagnostics or CLI output at any object level', () => {
    const sentinel = 'SYNTHETIC_PRIVATE_QUERY_KEY_SENTINEL';
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'experiment-registry-private-key-'));
    try {
        const filename = path.join(dir, 'synthetic.json');
        for (const [at, select] of [
            ['registry', doc => doc],
            ['experiments[0]', doc => doc.experiments[0]],
            ['experiments[0].primaryOutcome', doc => doc.experiments[0].primaryOutcome],
            ['experiments[0].guardrails[0]', doc => doc.experiments[0].guardrails[0]],
            ['experiments[0].baselinePeriod', doc => doc.experiments[0].baselinePeriod],
            ['experiments[0].comparisonPeriod', doc => doc.experiments[0].comparisonPeriod],
            ['experiments[0].history[0]', doc => doc.experiments[0].history[0]]
        ]) {
            const doc = registry();
            select(doc)[sentinel] = true;
            const report = validate(doc);
            assert.equal(report.ok, false, at);
            assert.ok(report.errors.includes(`${at}: unknown field (schema version 1)`), at);
            assert.equal(JSON.stringify(report).includes(sentinel), false, at);
            fs.writeFileSync(filename, JSON.stringify(doc));
            const result = spawnSync(process.execPath, [cli, 'check', filename], { cwd: os.tmpdir(), encoding: 'utf8' });
            assert.equal(result.status, 1, at);
            assert.match(result.stdout, /FAIL: registry schema or governance checks/, at);
            assert.ok(result.stderr.includes(`${at}: unknown field (schema version 1)`), at);
            assert.equal(result.stdout.includes(sentinel), false, at);
            assert.equal(result.stderr.includes(sentinel), false, at);
        }
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
