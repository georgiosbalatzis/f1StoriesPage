import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { evaluateExperiment } from '../experiment-evaluate.mjs';
import { MATURITY_LAG_DAYS, validateRegistry } from '../experiment-registry.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const cli = path.join(root, 'scripts/intelligence/experiment-evaluate.mjs');
const fixtures = fileURLToPath(new URL('./fixtures/experiment-evaluate/', import.meta.url));
const read = name => JSON.parse(fs.readFileSync(path.join(fixtures, name), 'utf8'));
const input = () => ({ experiment: read('registry.json').experiments[0], observations: read('observations.json') });
const options = { asOf: '2000-01-18' };
const evaluate = ({ experiment, observations }, opts = options) => evaluateExperiment(experiment, observations, opts);
const hasReason = (result, code) => assert.ok(result.reasons.some(r => r.code === code), JSON.stringify(result.reasons));
const primary = data => data.observations.filter(row => row.metric === data.experiment.primaryOutcome.metric);
const cliEnv = { ...process.env };
delete cliEnv.CI;
delete cliEnv.GITHUB_ACTIONS;
const run = (args, env = {}) => spawnSync(process.execPath, [cli, ...args], { cwd: os.tmpdir(), encoding: 'utf8', env: { ...cliEnv, ...env } });
const args = [path.join(fixtures, 'registry.json'), 'EG-2000-001', path.join(fixtures, 'observations.json')];

test('synthetic fixtures validate; descriptive result preserves raw values without changing inputs', () => {
    const data = input(), before = structuredClone(data);
    assert.equal(validateRegistry(read('registry.json'), { today: options.asOf }).ok, true);
    const result = evaluate(data);
    assert.equal(result.decision, 'DESCRIPTIVE_CHANGE_OBSERVED');
    assert.deepEqual(result.primary.difference, { kind: 'count', absolute: 20 });
    assert.equal(result.primary.baseline.numerator, 40);
    assert.equal(result.primary.comparison.numerator, 60);
    assert.equal(result.guardrails[0].baseline.denominator, 60);
    assert.deepEqual(result.guardrails.map(g => g.status), ['PASS', 'PASS']);
    assert.equal(result.primary.interval, null);
    assert.equal(result.checks.production, 'NOT VERIFIED');
    assert.deepEqual(data, before);
    assert.equal(JSON.stringify(evaluate(data)), JSON.stringify(result));
    result.primary.baseline.period.start = '1999-01-01';
    assert.deepEqual(data, before);
});

test('scalar and non-integer primary outcomes abstain without treating values or sample sizes as evidence', () => {
    for (const denominators of [null, [4000, 8000]]) {
        const data = input(), rows = primary(data);
        Object.assign(data.experiment.primaryOutcome, { metric: 'lcp_p75', unit: 'ms', source: 'rum' });
        rows.forEach((row, i) => {
            Object.assign(row, data.experiment.primaryOutcome, { numerator: i === 0 ? 2000 : 2100 });
            if (denominators) row.denominator = denominators[i];
        });
        const result = evaluate(data);
        assert.equal(result.decision, 'INCONCLUSIVE');
        assert.notEqual(result.checks.evidence, 'PASS');
        assert.equal(result.primary.difference, null);
        assert.equal(result.primary.baseline.numerator, 2000);
        assert.equal(result.primary.comparison.numerator, 2100);
        if (denominators) assert.equal(result.primary.comparison.denominator, 8000);
        hasReason(result, 'UNSUPPORTED_OUTCOME');
    }
    for (const [metric, unit] of [['scalar_value', 'unitless'], ['average_events', 'events'], ['events_p75', 'events'], ['mean_events', 'events']]) {
        const data = input(), rows = primary(data);
        Object.assign(data.experiment.primaryOutcome, { metric, unit });
        rows.forEach(row => { Object.assign(row, data.experiment.primaryOutcome); });
        assert.equal(evaluate(data).decision, 'INCONCLUSIVE', `${metric}/${unit}`);
    }
    for (const numerator of [-1, 40.5]) {
        const data = input();
        primary(data)[0].numerator = numerator;
        const result = evaluate(data);
        assert.equal(result.decision, 'INCONCLUSIVE');
        assert.equal(result.primary.difference, null);
        assert.notEqual(result.checks.evidence, 'PASS');
        hasReason(result, 'UNSUPPORTED_OUTCOME');
    }
    const data = input();
    primary(data).forEach(row => { row.denominator = 100; });
    const result = evaluate(data);
    assert.equal(result.decision, 'INCONCLUSIVE', 'denominators do not declare a proportion');
    assert.equal(result.primary.difference, null);
    assert.notEqual(result.checks.evidence, 'PASS');
});

test('effective floor cannot fall below 30; lower declared floors warn without blocking adequate evidence', () => {
    for (const floor of [1, 10]) {
        const data = input();
        data.experiment.evidenceFloor = floor;
        primary(data).forEach((row, i) => { row.numerator = i === 0 ? floor : floor + 1; });
        let result = evaluate(data);
        assert.equal(result.decision, 'INCONCLUSIVE');
        assert.equal(result.declaredEvidenceFloor, floor);
        assert.equal(result.evidenceFloor, 30);
        assert.equal(result.primary.difference, null);
        hasReason(result, 'LOW_DECLARED_EVIDENCE_FLOOR');
        hasReason(result, 'BELOW_EVIDENCE_FLOOR');
        primary(data).forEach((row, i) => { row.numerator = 30 + i; });
        result = evaluate(data);
        assert.equal(result.decision, 'DESCRIPTIVE_CHANGE_OBSERVED', 'the lower declaration is a warning only');
        hasReason(result, 'LOW_DECLARED_EVIDENCE_FLOOR');
    }
    const data = input();
    data.experiment.evidenceFloor = 50;
    assert.equal(evaluate(data).evidenceFloor, 50);
    assert.equal(evaluate(data).decision, 'INCONCLUSIVE');
});

test('permanent and open-ended confounders in a gap affect comparison; explicitly expired transients do not', () => {
    const data = input();
    data.experiment.comparisonPeriod = { start: '2000-01-15', end: '2000-01-21' };
    data.observations.forEach(row => {
        if (row.period.start === '2000-01-08') row.period = { ...data.experiment.comparisonPeriod };
        row.asOf = '2000-01-25';
    });
    const confounder = { description: 'SYNTHETIC canonical URL change', major: true, permanent: true,
        period: { start: '2000-01-14', end: '2000-01-14' } };
    data.observations = { observations: data.observations, confounders: [confounder] };
    let result = evaluate(data, { asOf: '2000-01-25' });
    assert.equal(result.decision, 'INCONCLUSIVE');
    assert.equal(result.confounders[0].overlaps, true);
    assert.equal(result.confounders[0].permanent, true);
    hasReason(result, 'CONFOUNDED_WINDOW');
    confounder.permanent = false;
    result = evaluate(data, { asOf: '2000-01-25' });
    assert.equal(result.decision, 'DESCRIPTIVE_CHANGE_OBSERVED');
    assert.equal(result.confounders[0].overlaps, false);
    delete confounder.period.end;
    result = evaluate(data, { asOf: '2000-01-25' });
    assert.equal(result.decision, 'INCONCLUSIVE', 'without an explicit end the effect may persist');
    assert.equal(result.confounders[0].overlaps, true);
});

test('below-floor primary and secondary comparisons retain raw counts but suppress all differences', () => {
    const data = input();
    data.experiment.primaryOutcome.unit = 'proportion';
    primary(data).forEach((row, i) => { row.unit = 'proportion'; row.numerator = i + 1; row.denominator = 2; });
    data.observations.push(...primary(data).map(row => ({ ...structuredClone(row), metric: 'synthetic_secondary_events', role: 'secondary' })));
    let result = evaluate(data);
    assert.equal(result.decision, 'INCONCLUSIVE');
    assert.equal(result.primary.difference, null);
    assert.equal(result.secondary[0].difference, null);
    assert.equal(result.primary.baseline.numerator, 1);
    assert.equal(result.primary.comparison.numerator, 2);
    assert.equal(result.primary.baseline.denominator, 2);
    assert.equal(result.secondary[0].comparison.denominator, 2);
    assert.equal(result.primary.interval, null);
    assert.equal(result.secondary[0].interval, null);
    data.experiment.primaryOutcome.unit = 'events';
    data.observations.filter(row => row.unit === 'proportion').forEach(row => { row.unit = 'events'; delete row.denominator; });
    result = evaluate(data);
    assert.equal(result.primary.difference, null);
    assert.equal(result.secondary[0].difference, null);
});

test('Greek report follows the template, labels observational evidence and omits aggregate values', () => {
    const data = input();
    primary(data)[1].numerator = 123456789;
    const result = evaluate(data);
    for (const heading of ['Συγκρισιμότητα και επάρκεια', 'Προστασία ποιότητας και εναλλακτικές εξηγήσεις', 'Ανθρώπινη απόφαση']) assert.ok(result.markdown.includes(`## ${heading}`));
    assert.match(result.markdown, /παρατηρησιακή/);
    assert.match(result.markdown, /Παραγωγική συμφωνία δεδομένων:\*\* NOT VERIFIED/);
    assert.match(result.markdown, /δεν είναι μοναδικοί αναγνώστες ή συνεδρίες/);
    assert.match(result.markdown, /δεν αποδεικνύουν φόρτωση προορισμού/);
    assert.doesNotMatch(result.markdown, /123456789/);
    assert.doesNotMatch(JSON.stringify(result), /p-value|\blift\b|\bsignificant\b/i);
});

test('Markdown neutralizes user and team mentions in free text while preserving raw JSON', () => {
    const data = input();
    data.experiment.owner = 'SYNTHETIC @user';
    data.experiment.hypothesis = 'SYNTHETIC @org/team';
    data.experiment.decisionPolicy = 'SYNTHETIC `@policy-user`';
    data.experiment.rollback = 'SYNTHETIC **@rollback-team/reviewers**';
    data.observations = { observations: data.observations, confounders: ['SYNTHETIC @confounder-user and @confounder-org/team'] };
    const result = evaluate(data);
    assert.doesNotMatch(result.markdown, /@[A-Za-z0-9]/);
    for (const mention of ['user', 'org/team', 'policy-user', 'rollback-team/reviewers', 'confounder-user', 'confounder-org/team']) {
        assert.ok(result.markdown.includes(`@\u200d${mention}`), mention);
    }
    assert.equal(result.confounders[0].description, 'SYNTHETIC @confounder-user and @confounder-org/team');
    assert.equal(JSON.stringify(evaluate(data)), JSON.stringify(result));
});

test('nested period payloads and non-string URL fields are rejected without echoing extra data', () => {
    for (const update of [
        { period: { start: '2000-01-01', end: '2000-01-07', unexpected: 'SYNTHETIC_PRIVATE_SENTINEL' } },
        { urls: [{ unexpected: 'SYNTHETIC_PRIVATE_SENTINEL' }] }
    ]) {
        const data = input();
        Object.assign(data.observations[0], update);
        const result = evaluate(data);
        assert.equal(result.decision, 'STOP_MEASUREMENT_FAILED');
        assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC_PRIVATE_SENTINEL/);
    }
});

test('zero count baseline gives counts only, no relative difference and no interval', () => {
    const data = input();
    primary(data)[0].numerator = 0;
    const result = evaluate(data);
    assert.equal(result.decision, 'INCONCLUSIVE');
    hasReason(result, 'ZERO_BASELINE');
    hasReason(result, 'BELOW_EVIDENCE_FLOOR');
    assert.equal(result.primary.difference, null);
    assert.equal(result.primary.baseline.numerator, 0);
    assert.equal(result.primary.comparison.numerator, 60);
    assert.equal(result.primary.interval, null);
    assert.ok(!('ratio' in result.primary) && !('percentage' in result.primary));
});

test('evidence floor applies separately to each period, supports the registry value and default', () => {
    for (const index of [0, 1]) {
        const data = input();
        primary(data)[index].numerator = 29;
        primary(data)[1 - index].numerator = 10000;
        const result = evaluate(data);
        assert.equal(result.decision, 'INCONCLUSIVE');
        hasReason(result, 'BELOW_EVIDENCE_FLOOR');
        assert.equal(result.primary.interval, null);
    }
    const data = input();
    delete data.experiment.evidenceFloor;
    assert.equal(evaluate(data).evidenceFloor, 30);
    for (const row of primary(data)) row.numerator = 30;
    assert.equal(evaluate(data).decision, 'NO_DETECTABLE_CHANGE');
    data.experiment.evidenceFloor = 31;
    assert.equal(evaluate(data).decision, 'INCONCLUSIVE');
    data.experiment.evidenceFloor = 10;
    assert.equal(evaluate(data).evidenceFloor, 30);
    assert.equal(evaluate(data).declaredEvidenceFloor, 10);
});

test('proportions retain numerators and denominators; floor is the underlying count; zero baseline stays counts only', () => {
    const data = input();
    data.experiment.primaryOutcome.unit = 'proportion';
    const rows = primary(data);
    for (const row of rows) { row.unit = 'proportion'; row.denominator = 100; }
    rows[0].numerator = 4;
    rows[1].numerator = 8;
    let result = evaluate(data);
    assert.equal(result.decision, 'DESCRIPTIVE_CHANGE_OBSERVED');
    assert.deepEqual(result.primary.difference, { kind: 'proportion', absolute: 0.04 });
    assert.equal(result.primary.baseline.denominator, 100);
    rows[0].denominator = 29;
    assert.equal(evaluate(data).decision, 'INCONCLUSIVE');
    rows[0].denominator = 100;
    rows[0].numerator = 0;
    result = evaluate(data);
    assert.deepEqual(result.primary.difference, { kind: 'count', absolute: 8 });
    hasReason(result, 'ZERO_BASELINE');
    assert.equal(result.primary.interval, null);
});

test('maturity uses registry lags at the exact boundary, including the original extraction day', () => {
    for (const [source, lag] of Object.entries(MATURITY_LAG_DAYS)) {
        const data = input();
        data.experiment.primaryOutcome.source = source;
        data.experiment.guardrails.forEach(g => { g.source = source; });
        const asOf = `2000-01-${14 + lag}`;
        data.observations.forEach(row => { row.source = source; row.asOf = asOf; });
        assert.equal(evaluate(data, { asOf }).decision, 'DESCRIPTIVE_CHANGE_OBSERVED', source);
        const earlier = `2000-01-${13 + lag}`;
        data.observations.forEach(row => { row.asOf = earlier; });
        let result = evaluate(data, { asOf: earlier });
        assert.equal(result.decision, 'INCONCLUSIVE', source);
        hasReason(result, 'IMMATURE_WINDOW');
        result = evaluate(data, { asOf: '2000-02-01' });
        assert.equal(result.decision, 'INCONCLUSIVE', `${source}: old extraction never matures in memory`);
    }
    const data = input();
    data.experiment.primaryOutcome.source = 'gsc';
    primary(data).forEach(row => { row.source = 'gsc'; });
    data.observations.forEach(row => { row.asOf = '2000-01-17'; });
    assert.equal(evaluate(data, { asOf: '2000-01-17' }).decision, 'INCONCLUSIVE', 'RUM still needs four days');
});

test('unequal, overlapping, reversed and mismatched periods abstain instead of normalizing', () => {
    for (const mutate of [
        data => { data.experiment.comparisonPeriod.end = '2000-01-13'; },
        data => { data.experiment.comparisonPeriod = { start: '2000-01-07', end: '2000-01-13' }; },
        data => { [data.experiment.baselinePeriod, data.experiment.comparisonPeriod] = [data.experiment.comparisonPeriod, data.experiment.baselinePeriod]; },
        data => { primary(data)[1].period.end = '2000-01-13'; }
    ]) {
        const data = input();
        mutate(data);
        assert.equal(evaluate(data).decision, 'INCONCLUSIVE');
    }
});

test('carried or weekly inputs never count as daily evidence', () => {
    for (const update of [{ carried: true }, { cadence: 'weekly' }]) {
        const data = input();
        Object.assign(primary(data)[1], update);
        const result = evaluate(data);
        assert.equal(result.decision, 'INCONCLUSIVE');
        hasReason(result, 'CARRIED_OR_WEEKLY');
        assert.deepEqual(result.primary.comparison.period, data.experiment.comparisonPeriod);
    }
});

test('source, metric, unit, population, denominator and URL mismatches fail measurement', () => {
    for (const update of [
        { source: 'gsc' }, { unit: 'readers' }, { population: 'SYNTHETIC different coverage' },
        { denominator: 100 }, { metric: 'gsc_clicks', source: 'gsc' },
        { urls: ['https://f1-stories.gr/another-synthetic/'] }, { url: 'https://f1-stories.gr/wrong-synthetic/' },
        { urls: [] }, { urls: 'https://f1-stories.gr/synthetic-example/' }
    ]) {
        const data = input();
        Object.assign(primary(data)[1], update);
        assert.equal(evaluate(data).decision, 'STOP_MEASUREMENT_FAILED', JSON.stringify(update));
    }
    for (const field of ['source', 'unit', 'population']) {
        const data = input();
        primary(data).forEach(row => { row[field] = field === 'source' ? 'gsc' : 'SYNTHETIC mismatch'; });
        const result = evaluate(data);
        assert.equal(result.decision, 'STOP_MEASUREMENT_FAILED', field);
        hasReason(result, 'REGISTRY_IDENTITY_MISMATCH');
    }
});

test('URL coverage is exact, supports a single URL, rejects partial multi-URL scope and abstains if absent', () => {
    const data = input();
    data.observations.forEach(row => { row.url = row.urls[0]; delete row.urls; });
    assert.equal(evaluate(data).decision, 'DESCRIPTIVE_CHANGE_OBSERVED');
    delete data.observations[0].url;
    let result = evaluate(data);
    assert.equal(result.decision, 'INCONCLUSIVE');
    hasReason(result, 'URL_NOT_VERIFIED');
    const multiple = input();
    multiple.experiment.urls.push('https://f1-stories.gr/second-synthetic/');
    assert.equal(evaluate(multiple).decision, 'STOP_MEASUREMENT_FAILED');
    multiple.observations.forEach(row => { row.urls = [...multiple.experiment.urls].reverse(); });
    assert.equal(evaluate(multiple).decision, 'DESCRIPTIVE_CHANGE_OBSERVED');
});

test('registry confounders are retained conservatively; dated major events only cap overlapping observed windows', () => {
    const data = input();
    data.experiment.confounders = ['ΣΥΝΘΕΤΙΚΟ αγωνιστικό Σαββατοκύριακο'];
    let result = evaluate(data);
    assert.equal(result.decision, 'INCONCLUSIVE');
    assert.equal(result.confounders[0].origin, 'registry');
    assert.equal(result.confounders[0].overlaps, null);
    for (const description of ['race weekend', 'major F1 news', 'Google update', 'canonical URL change', 'republication', 'metadata change']) {
        const fresh = input();
        fresh.observations = { observations: fresh.observations, confounders: [{ description: `SYNTHETIC ${description}`, major: true,
            period: { start: '2000-01-14', end: '2000-01-15' } }] };
        result = evaluate(fresh);
        assert.equal(result.decision, 'INCONCLUSIVE', description);
        assert.equal(result.confounders[0].overlaps, true);
        hasReason(result, 'CONFOUNDED_WINDOW');
        fresh.observations.confounders[0].period = { start: '2000-01-15', end: '2000-01-16' };
        assert.equal(evaluate(fresh).decision, 'DESCRIPTIVE_CHANGE_OBSERVED');
    }
    data.experiment.confounders = [];
    data.experiment.comparisonPeriod = { start: '2000-01-15', end: '2000-01-21' };
    data.observations.filter(row => row.period.start === '2000-01-08').forEach(row => { row.period = { ...data.experiment.comparisonPeriod }; });
    data.observations.forEach(row => { row.asOf = '2000-01-25'; });
    data.observations = { observations: data.observations, confounders: [{ description: 'SYNTHETIC gap only', major: true, period: { start: '2000-01-08', end: '2000-01-14' } }] };
    assert.equal(evaluate(data, { asOf: '2000-01-25' }).decision, 'DESCRIPTIVE_CHANGE_OBSERVED');
});

test('LCP and CLS guardrail breaches override low primary evidence and confounders', () => {
    for (const [metric, value] of [['mobile_lcp_p75', 2501], ['mobile_cls_p75', 0.101]]) {
        const data = input();
        primary(data)[0].numerator = 2;
        data.experiment.confounders = ['ΣΥΝΘΕΤΙΚΗ μεγάλη είδηση'];
        data.observations.find(row => row.metric === metric && row.period.start === '2000-01-08').numerator = value;
        const result = evaluate(data);
        assert.equal(result.decision, 'ROLLBACK_RECOMMENDED', metric);
        assert.equal(result.guardrails.find(g => g.metric === metric).status, 'FAIL');
        hasReason(result, 'BELOW_EVIDENCE_FLOOR');
        hasReason(result, 'CONFOUNDED_WINDOW');
        hasReason(result, 'GUARDRAIL_BREACH');
        primary(data)[1].source = 'gsc';
        assert.equal(evaluate(data).decision, 'STOP_MEASUREMENT_FAILED', 'invalid measurements take precedence over recommendations');
    }
    const missingBaseline = input();
    missingBaseline.observations = missingBaseline.observations.filter(row => row.metric !== 'mobile_lcp_p75' || row.period.start !== '2000-01-01');
    missingBaseline.observations.find(row => row.metric === 'mobile_lcp_p75').numerator = 3000;
    assert.equal(evaluate(missingBaseline).decision, 'ROLLBACK_RECOMMENDED', 'absolute breach does not require a baseline');
});

test('guardrails honor units, comparator boundaries, sample counts and unsupported prose', () => {
    for (const [threshold, value, expected] of [['<= 2500 ms', 2500, 'PASS'], ['< 2500 ms', 2500, 'FAIL'], ['>= 2500 ms', 2500, 'PASS'], ['> 2500 ms', 2500, 'FAIL']]) {
        const data = input();
        data.experiment.guardrails[0].threshold = threshold;
        data.observations[4].numerator = value;
        assert.equal(evaluate(data).guardrails[0].status, expected, threshold);
    }
    for (const threshold of ['<= 2500 ms, owner review required', 'Owner review passes', '<= 2500', '<= 2500 ms; OR true']) {
        const data = input();
        data.experiment.guardrails[0].threshold = threshold;
        const result = evaluate(data);
        assert.equal(result.decision, 'INCONCLUSIVE', threshold);
        assert.equal(result.guardrails[0].status, 'NOT VERIFIED');
    }
    const data = input();
    data.observations[4].denominator = 2;
    assert.equal(evaluate(data).decision, 'INCONCLUSIVE');
    data.observations[4].numerator = 3000;
    assert.equal(evaluate(data).decision, 'ROLLBACK_RECOMMENDED', 'observed safety breach remains visible at low sample');
    data.experiment.guardrails[0].threshold = '<= 2.5 s';
    assert.equal(evaluate(data).decision, 'STOP_MEASUREMENT_FAILED');
});

test('contradictory secondary observations retain both directions and prevent a success claim', () => {
    const data = input();
    data.observations.push(...primary(data).map((row, i) => ({ ...structuredClone(row), metric: 'synthetic_secondary_events', role: 'secondary', numerator: i === 0 ? 70 : 40 })));
    const result = evaluate(data);
    assert.equal(result.decision, 'INCONCLUSIVE');
    assert.equal(result.primary.difference.absolute, 20);
    assert.equal(result.secondary[0].difference.absolute, -30);
    hasReason(result, 'CONTRADICTORY_DIRECTIONS');
    const reason = result.reasons.find(r => r.code === 'CONTRADICTORY_DIRECTIONS');
    assert.match(reason.message, /internal_page_click/);
    assert.match(reason.message, /synthetic_secondary_events/);
    hasReason(result, 'UNREGISTERED_SECONDARY');
    data.observations.filter(row => row.role === 'secondary').forEach(row => { row.denominator = 100; row.unit = 'proportion'; });
    hasReason(evaluate(data), 'CONTRADICTORY_DIRECTIONS');
});

test('missing, malformed and duplicate data fail safely; missing periods never become zero', () => {
    for (const value of [null, {}, 'SYNTHETIC', 4, { observations: [], unexpected: true }]) {
        assert.equal(evaluateExperiment(input().experiment, value, options).decision, 'STOP_MEASUREMENT_FAILED');
    }
    for (const update of [{ numerator: -1 }, { numerator: Infinity }, { numerator: 1.5 }, { numerator: '40' }, { denominator: 0 },
        { denominator: 2 }, { carried: 'false' }, { asOf: '2000-02-30' }, { asOf: '2000-01-19' }, { cadence: 'monthly' }, { source: 'constructor' }]) {
        const data = input();
        Object.assign(primary(data)[0], update);
        const unsupportedNumerator = update.numerator === -1 || update.numerator === 1.5;
        const result = evaluate(data);
        assert.equal(result.decision, unsupportedNumerator ? 'INCONCLUSIVE' : 'STOP_MEASUREMENT_FAILED', JSON.stringify(update));
        if (unsupportedNumerator) {
            assert.equal(result.primary.difference, null);
            assert.notEqual(result.checks.evidence, 'PASS');
            hasReason(result, 'UNSUPPORTED_OUTCOME');
        }
    }
    const missing = input();
    missing.observations = missing.observations.slice(0, 3);
    const result = evaluate(missing);
    assert.equal(result.decision, 'INCONCLUSIVE');
    assert.equal(result.primary.comparison, null);
    assert.equal(result.checks.identity, 'NOT VERIFIED');
    hasReason(result, 'MISSING_PERIOD');
    const empty = evaluate({ ...input(), observations: [] });
    assert.equal(empty.checks.identity, 'NOT VERIFIED');
    assert.equal(empty.checks.maturity, 'NOT VERIFIED');
    assert.equal(empty.checks.freshness, 'NOT VERIFIED');
    const duplicate = input();
    duplicate.observations.push(structuredClone(duplicate.observations[0]));
    assert.equal(evaluate(duplicate).decision, 'STOP_MEASUREMENT_FAILED');
    for (const experiment of [null, {}, { ...input().experiment, evidenceFloor: 0 }]) assert.equal(evaluateExperiment(experiment, [], options).decision, 'STOP_MEASUREMENT_FAILED');
    assert.equal(evaluate(input(), {}).decision, 'STOP_MEASUREMENT_FAILED');
    const malformedConfounder = input();
    malformedConfounder.observations = { observations: malformedConfounder.observations, confounders: [null, { description: 'SYNTHETIC', period: { start: 'bad', end: 'bad' } }] };
    assert.equal(evaluate(malformedConfounder).decision, 'STOP_MEASUREMENT_FAILED');
});

test('continue observing is limited to a not-yet-started plan without observations', () => {
    const data = input();
    data.experiment.status = 'APPROVED';
    data.experiment.history.pop();
    data.observations = [];
    assert.equal(evaluate(data, { asOf: '1999-12-31' }).decision, 'CONTINUE_OBSERVING');
    assert.equal(evaluate(data).decision, 'INCONCLUSIVE');
});

test('CLI refuses each CI flag with only the generic error and no aggregate or file output', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'experiment-evaluate-ci-'));
    try {
        const sentinel = 'SYNTHETIC_CI_PRIVATE_SENTINEL';
        const registry = read('registry.json'), observations = read('observations.json');
        registry.experiments[0].owner = sentinel;
        registry.experiments[0].primaryOutcome.population = sentinel;
        observations.filter(row => row.metric === registry.experiments[0].primaryOutcome.metric).forEach(row => { row.population = sentinel; });
        const registryFile = path.join(dir, 'registry.json'), observationsFile = path.join(dir, 'observations.json');
        fs.writeFileSync(registryFile, JSON.stringify(registry));
        fs.writeFileSync(observationsFile, JSON.stringify(observations));
        const genericError = run([]).stderr;
        for (const flag of ['CI', 'GITHUB_ACTIONS']) {
            for (const outputArgs of [[], [`--out=${path.join(dir, 'result.json')}`]]) {
                const result = run([registryFile, args[1], observationsFile, ...outputArgs], { [flag]: 'true' });
                assert.equal(result.status, 1, flag);
                assert.equal(result.stdout, '', flag);
                assert.equal(result.stderr, genericError, flag);
                assert.doesNotMatch(result.stdout + result.stderr, new RegExp(sentinel));
                assert.equal(fs.existsSync(path.join(dir, 'result.json')), false);
                assert.equal(fs.existsSync(path.join(dir, 'result.md')), false);
            }
        }
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('CLI emits byte-identical JSON and Greek Markdown, returns failure on invalid measurement', () => {
    const first = run(args), second = run(args);
    assert.equal(first.status, 0, first.stderr);
    assert.equal(first.stdout, second.stdout);
    assert.equal(first.stderr, second.stderr);
    assert.equal(JSON.parse(first.stdout).decision, 'DESCRIPTIVE_CHANGE_OBSERVED');
    assert.match(first.stderr, /^# Απολογισμός/);
    assert.equal(run([]).status, 1);
    assert.equal(run([...args, '--unknown']).status, 1);
    assert.equal(run([args[0], 'EG-2000-999', args[2]]).status, 1);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'experiment-evaluate-'));
    try {
        const obs = path.join(dir, 'synthetic.json'), data = input();
        primary(data)[1].source = 'gsc';
        fs.writeFileSync(obs, JSON.stringify(data.observations));
        const failure = run([args[0], args[1], obs]);
        assert.equal(failure.status, 1);
        assert.equal(JSON.parse(failure.stdout).decision, 'STOP_MEASUREMENT_FAILED');
        fs.writeFileSync(obs, '{ SYNTHETIC_PRIVATE_SENTINEL');
        const malformed = run([args[0], args[1], obs]);
        assert.equal(malformed.status, 1);
        assert.doesNotMatch(malformed.stderr, /SYNTHETIC_PRIVATE_SENTINEL/);
        const registry = read('registry.json');
        registry.experiments[0].comparisonPeriod.end = '2000-01-13';
        const registryFile = path.join(dir, 'registry.json');
        fs.writeFileSync(registryFile, JSON.stringify(registry));
        const uneven = run([registryFile, args[1], args[2]]);
        assert.equal(uneven.status, 0);
        assert.equal(JSON.parse(uneven.stdout).decision, 'INCONCLUSIVE');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('CLI writes private files only outside repositories, rejects symlink escapes and never overwrites', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'experiment-evaluate-out-'));
    try {
        const output = path.join(dir, 'result.json');
        const success = run([...args, `--out=${output}`]);
        assert.equal(success.status, 0, success.stderr);
        assert.equal(success.stdout, '');
        assert.equal(success.stderr, '');
        assert.equal(JSON.parse(fs.readFileSync(output)).decision, 'DESCRIPTIVE_CHANGE_OBSERVED');
        const report = path.join(dir, 'result.md');
        assert.match(fs.readFileSync(report, 'utf8'), /παρατηρησιακή/);
        assert.equal(fs.statSync(output).mode & 0o777, 0o600);
        assert.equal(fs.statSync(report).mode & 0o777, 0o600);
        const before = fs.readFileSync(output, 'utf8');
        assert.equal(run([...args, `--out=${output}`]).status, 1);
        assert.equal(fs.readFileSync(output, 'utf8'), before);
        fs.writeFileSync(path.join(dir, 'reserved.md'), 'SYNTHETIC keep');
        assert.equal(run([...args, `--out=${path.join(dir, 'reserved.json')}`]).status, 1);
        assert.equal(fs.existsSync(path.join(dir, 'reserved.json')), false);
        assert.equal(fs.readFileSync(path.join(dir, 'reserved.md'), 'utf8'), 'SYNTHETIC keep');
        assert.equal(run([...args, `--out=${path.join(root, 'forbidden-evaluation.json')}`]).status, 1);
        assert.equal(fs.existsSync(path.join(root, 'forbidden-evaluation.json')), false);
        const link = path.join(dir, 'repo-link');
        fs.symlinkSync(root, link, 'dir');
        assert.equal(run([...args, `--out=${path.join(link, 'forbidden-evaluation.json')}`]).status, 1);
        const nestedRepo = path.join(dir, 'synthetic-repo');
        fs.mkdirSync(nestedRepo);
        fs.mkdirSync(path.join(nestedRepo, '.git'));
        assert.equal(run([...args, `--out=${path.join(nestedRepo, 'result.json')}`]).status, 1);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
