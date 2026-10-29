import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { canonicalArticleUrl, validateEditorialInputs } from '../editorial-inputs.mjs';
import { evaluateEditorialInsights, renderEditorialReport } from '../editorial-insights.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/editorial-insights/synthetic.json', import.meta.url));
const fixture = () => JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const cli = fileURLToPath(new URL('../editorial-insights.mjs', import.meta.url));
const tests = fileURLToPath(new URL('./', import.meta.url));
const evaluate = input => evaluateEditorialInsights(input, { asOf: '2026-10-29' });
const types = ['data_explainer_opportunity', 'discovery_dropoff', 'evergreen_refresh', 'metadata_review', 'search_ctr_gap', 'weak_internal_linking'];
const searchTypes = ['evergreen_refresh', 'metadata_review', 'search_ctr_gap'];
const signalFields = ['signal_id', 'type', 'group', 'subject', 'scope', 'observations', 'data_source', 'exact_period',
    'metric_units', 'minimum_sample_status', 'confidence', 'limitations', 'why_it_matters', 'recommended_human_review', 'counterevidence', 'evidence_links'];
const subject = fixture().catalogue.rows[0].url;
const find = (result, type) => result.signals.find(row => row.type === type);
const abstains = (result, type) => result.abstentions.some(row => row.type === type && row.reason.length);
function temporary(t, parent = os.tmpdir()) {
    const directory = fs.mkdtempSync(path.join(parent, 'tmp-editorial-insights-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    return directory;
}
function run(input, out, env = {}) {
    return spawnSync(process.execPath, [cli, input, `--out=${out}`], {
        encoding: 'utf8', env: { ...process.env, NODE_TEST_CONTEXT: 'child-v8', ...env }
    });
}

test('complete synthetic fixture produces all six exact signal shapes without mutation', () => {
    const input = fixture(), before = structuredClone(input);
    assert.equal(validateEditorialInputs(input).ok, true);
    const result = evaluate(input);
    assert.deepEqual(input, before);
    assert.deepEqual(Object.keys(result), ['version', 'asOf', 'signals', 'abstentions']);
    assert.equal(result.version, 1);
    assert.deepEqual([...new Set(result.signals.map(row => row.type))], types);
    assert.deepEqual(result.signals.filter(row => row.type === 'weak_internal_linking').map(row => row.subject), input.catalogue.rows.map(row => row.url).sort());
    assert.deepEqual(result.abstentions, []);
    for (const row of result.signals) {
        assert.deepEqual(Object.keys(row), signalFields);
        assert.match(row.signal_id, /^[a-f0-9]{24}$/);
        assert.equal(row.confidence, 'low');
        assert.equal(row.minimum_sample_status, 'MET');
        assert.ok(['content_opportunity', 'article_improvement', 'internal_discovery', 'technical_seo', 'data_quality'].includes(row.group));
        assert.ok(row.limitations.length && row.why_it_matters && row.recommended_human_review);
        assert.ok(row.evidence_links.every(link => link.startsWith('docs/') || canonicalArticleUrl(link).url === link));
    }
    const ctr = find(result, 'search_ctr_gap');
    assert.equal(ctr.observations.clicks, 7);
    assert.equal(ctr.observations.impressions, 2100);
    assert.equal(ctr.observations.baseline_ctr_numerator, 3);
    assert.equal(ctr.observations.baseline_ctr_denominator, 100);
    assert.equal(ctr.exact_period.gsc.start, '2026-10-12');
    const evergreen = find(result, 'evergreen_refresh');
    assert.deepEqual(evergreen.observations.earlier, { clicks: 7, impressions: 700, days: 7 });
    assert.deepEqual(evergreen.observations.later, { clicks: 0, impressions: 1400, days: 7 });
    assert.ok(evergreen.exact_period.gsc.earlier.end < evergreen.exact_period.gsc.later.start);
    assert.match(evergreen.recommended_human_review, /ημερομηνία δημοσίευσης.*υπογραφή/);
});

test('invalid input always yields one data_quality abstention, never partial signals or input values', () => {
    const invalid = [null, [], {}, { ...fixture(), version: 2 }];
    const malformed = fixture(); malformed.site.articles[0].visitor_id = 'SYNTHETIC PRIVATE VALUE'; invalid.push(malformed);
    const oldDomain = fixture(); oldDomain.gsc.rows[0].page = 'https://f1stories.gr/SYNTHETIC-PRIVATE'; invalid.push(oldDomain);
    for (const input of invalid) {
        const result = evaluate(input);
        assert.deepEqual(result.signals, []);
        assert.equal(result.abstentions.length, 1);
        assert.equal(result.abstentions[0].type, 'data_quality');
        assert.equal(result.abstentions[0].status, 'FAIL');
        assert.doesNotMatch(JSON.stringify(result), /f1stories\.gr|SYNTHETIC PRIVATE|SYNTHETIC-PRIVATE/);
    }
    for (const asOf of [undefined, null, '2026-02-30', 'bad', 42]) {
        const result = evaluateEditorialInsights(fixture(), { asOf });
        assert.equal(result.abstentions.length, 1);
        assert.equal(result.signals.length, 0);
    }
});

test('empty, missing, absent and unverified GSC abstain only for search types; other evidence is evaluated independently', () => {
    const cases = [d => { delete d.gsc; }, d => { d.gsc.rows = []; },
        d => { d.gsc.status = 'absent'; delete d.gsc.rows; },
        d => { d.gsc.status = 'NOT VERIFIED'; delete d.gsc.rows; }];
    for (const change of cases) {
        const input = fixture(); change(input);
        assert.equal(validateEditorialInputs(input).ok, true);
        const result = evaluate(input);
        assert.deepEqual(result.signals, evaluate(fixture()).signals.filter(row => !searchTypes.includes(row.type)));
        assert.deepEqual([...new Set(result.signals.map(row => row.type))], ['data_explainer_opportunity', 'discovery_dropoff', 'weak_internal_linking']);
        assert.deepEqual(result.abstentions.map(row => row.type), searchTypes);
        for (const type of searchTypes) {
            assert.equal(find(result, type), undefined);
            assert.ok(abstains(result, type));
        }
    }
    const minimal = evaluate({ version: 1, synthetic: true });
    assert.equal(minimal.signals.length, 0);
    assert.equal(minimal.abstentions.length, 6);
});

test('below-floor samples abstain and never acquire medium confidence', () => {
    const input = fixture();
    for (const row of input.gsc.rows) Object.assign(row, { impressions: 1, clicks: 0, ctr: 0 });
    input.site.discovery.rows[0].click_events = 29;
    input.site.articles[1].page_view_events = 29;
    const result = evaluate(input);
    assert.equal(result.signals.length, input.catalogue.rows.length);
    assert.ok(result.signals.every(row => row.type === 'weak_internal_linking' && row.confidence === 'low'));
    for (const type of types.filter(type => type !== 'weak_internal_linking')) assert.ok(abstains(result, type), type);
    assert.equal(abstains(result, 'weak_internal_linking'), false);
    assert.ok(find(result, 'weak_internal_linking').limitations.some(value => value.includes('κάτω από 30')));
    assert.doesNotMatch(JSON.stringify(result), /"confidence":"medium"/);
    const boundary = fixture();
    boundary.site.discovery.rows[0].click_events = 30;
    boundary.site.articles[1].page_view_events = 30;
    const accepted = evaluate(boundary);
    assert.ok(find(accepted, 'discovery_dropoff'));
    assert.ok(find(accepted, 'data_explainer_opportunity'));
});

test('position-bucket baseline uses counts, respects the 100-impression boundary and never averages rounded CTR', () => {
    for (const [position, numerator] of [[1, 20], [2, 10], [3, 10], [4, 3], [10, 3], [11, 1]]) {
        const input = fixture();
        input.gsc.rows = [{ ...input.gsc.rows[0], date: null, impressions: 100, clicks: 0, ctr: 1, position }];
        const gap = find(evaluate(input), 'search_ctr_gap');
        assert.equal(gap.observations.baseline_ctr_numerator, numerator);
        input.gsc.rows[0].impressions = 99;
        assert.equal(find(evaluate(input), 'search_ctr_gap'), undefined);
        Object.assign(input.gsc.rows[0], { impressions: 100, clicks: numerator, ctr: 0 });
        assert.equal(find(evaluate(input), 'search_ctr_gap'), undefined);
    }
});

test('GSC and GA4 are never compared or reconciled, including explicitly requested comparisons', () => {
    const input = fixture();
    for (const operation of ['compare', 'reconcile']) {
        input.comparisons = [{ left: 'gsc.clicks', right: 'site.page_view_events', operation }];
        const result = evaluate(input);
        assert.ok(abstains(result, 'data_quality'));
        for (const row of result.signals) {
            assert.ok(!(row.data_source.gsc && row.data_source.site));
            assert.ok(!(row.data_source.gsc && row.data_source.discovery));
        }
        const changed = structuredClone(input); changed.site.articles[0].page_view_events = 999;
        assert.deepEqual(find(evaluate(changed), 'search_ctr_gap'), find(result, 'search_ctr_gap'));
        const changedSearch = structuredClone(input);
        for (const row of changedSearch.gsc.rows) { row.clicks = row.impressions; row.ctr = 1; }
        assert.deepEqual(find(evaluate(changedSearch), 'discovery_dropoff'), find(result, 'discovery_dropoff'));
    }
});

test('unmapped resources never join; recognized aliases resolve through I-07A only', () => {
    const input = fixture(), unknown = 'https://f1-stories.gr/SYNTHETIC-unmapped';
    input.gsc.rows = input.gsc.rows.map(row => ({ ...row, page: unknown, mapping: 'unmapped' }));
    input.site.discovery.rows[0].page = unknown; input.site.discovery.rows[0].mapping = 'unmapped';
    input.site.articles[0].page = unknown; input.site.articles[0].mapping = 'unmapped';
    input.site.articles[1].page_view_events = 0;
    const result = evaluate(input);
    assert.ok(result.signals.every(row => row.type === 'weak_internal_linking'));
    assert.equal(result.signals.length, input.catalogue.rows.length);
    assert.ok(result.signals.every(row => !row.data_source.discovery && !Object.hasOwn(row.observations, 'internal_click_events')));
    assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC-unmapped/);
    const alias = fixture();
    for (const row of alias.gsc.rows) row.page = subject.replace('20260222T', '20260227%CE%A4');
    assert.deepEqual(evaluate(alias), evaluate(fixture()));
});

test('ambiguous dimensions, property totals, canonical alias overlap and missing days abstain from search conclusions', () => {
    const mutations = [d => { d.gsc.rows[0].query = 'SYNTHETIC QUERY MUST NOT APPEAR'; },
        d => { d.gsc.rows[0].country = 'SYNTHETIC country'; }, d => { d.gsc.rows[0].device = 'MOBILE'; },
        d => { d.gsc.rows.pop(); },
        d => { d.gsc.rows.push({ ...d.gsc.rows[0], page: subject.replace('20260222T', '20260227%CE%A4') }); },
        d => { d.gsc.aggregation = 'property'; for (const row of d.gsc.rows) { row.page = null; row.mapping = null; } }];
    for (const change of mutations) {
        const input = fixture(); change(input);
        assert.equal(validateEditorialInputs(input).ok, true);
        const result = evaluate(input);
        for (const type of ['search_ctr_gap', 'metadata_review', 'evergreen_refresh']) {
            assert.equal(find(result, type), undefined);
            assert.ok(abstains(result, type));
        }
        assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC QUERY MUST NOT APPEAR/);
    }
});

test('immature, future and unverified periods abstain, even when labels claim final', () => {
    for (const change of [d => { d.gsc.freshness.dataState = 'preliminary'; },
        d => { d.gsc.freshness.dataState = 'NOT VERIFIED'; },
        d => { d.gsc.asOf = '2026-10-27'; }, d => { d.gsc.asOf = '2026-10-30'; }]) {
        const input = fixture(); change(input);
        assert.equal(validateEditorialInputs(input).ok, true);
        const result = evaluate(input);
        assert.deepEqual(result.signals, evaluate(fixture()).signals.filter(row => !searchTypes.includes(row.type)));
        assert.deepEqual(result.abstentions.map(row => row.type), searchTypes);
    }
    const site = fixture(); site.site.freshness.dataState = 'preliminary';
    const result = evaluate(site);
    assert.equal(find(result, 'discovery_dropoff'), undefined);
    assert.equal(find(result, 'data_explainer_opportunity'), undefined);
    assert.ok(abstains(result, 'discovery_dropoff'));
    const invalid = fixture(); invalid.site.period.end = '2026-10-28';
    assert.equal(evaluate(invalid).abstentions[0].status, 'FAIL');
});

test('carried discovery retains its own period and never becomes current destination evidence', () => {
    const input = fixture();
    input.site.discovery.asOf = '2026-10-27';
    input.site.discovery.period.end = '2026-10-23';
    input.site.discovery.freshness.carried = true;
    assert.equal(validateEditorialInputs(input).ok, true);
    const result = evaluate(input);
    assert.equal(find(result, 'discovery_dropoff'), undefined);
    assert.ok(abstains(result, 'discovery_dropoff'));
    const linking = find(result, 'weak_internal_linking');
    assert.equal(linking.exact_period.discovery.end, '2026-10-23');
    assert.equal(linking.data_source.discovery.asOf, '2026-10-27');
    assert.equal(linking.data_source.discovery.freshness.carried, true);
    assert.equal(linking.exact_period.linkGraph.end, '2026-10-29');
    input.site.discovery.asOf = '2026-10-21';
    input.site.discovery.period.end = '2026-10-17';
    input.site.discovery.period.start = '2026-10-17';
    // This date predates the snapshot export contract, so validation fails closed.
    assert.equal(evaluate(input).abstentions[0].status, 'FAIL');
});

test('explicit destination rows and weak-view criterion are required; contradictory evidence is retained', () => {
    const base = evaluate(fixture());
    for (const type of ['discovery_dropoff', 'weak_internal_linking', 'evergreen_refresh', 'data_explainer_opportunity']) {
        assert.ok(find(base, type).counterevidence.length, type);
    }
    assert.equal(find(base, 'discovery_dropoff').scope.hypothesis, true);
    for (const change of [d => { d.site.articles.shift(); }, d => { d.site.articles[0].page_view_events = 5; }]) {
        const input = fixture(); change(input);
        assert.equal(find(evaluate(input), 'discovery_dropoff'), undefined);
    }
    const zero = fixture(); zero.site.articles[0].page_view_events = 0;
    assert.ok(find(evaluate(zero), 'discovery_dropoff'));
    const graph = fixture();
    graph.linkGraph.rows.push({ from: 'https://f1-stories.gr/SYNTHETIC-hub', to: subject, fromMapping: 'unmapped', toMapping: 'mapped' });
    assert.equal(evaluate(graph).signals.some(row => row.type === 'weak_internal_linking' && row.subject === subject), false);
    const noGraph = fixture(); delete noGraph.linkGraph;
    assert.ok(abstains(evaluate(noGraph), 'weak_internal_linking'));
});

test('weak linking evaluates every catalogue article with zero, small or missing discovery evidence and no GSC', () => {
    for (const clickEvents of [0, 1, 29]) for (const inbound of [0, 1]) {
        const input = fixture(); delete input.gsc;
        input.site.discovery.rows[0].click_events = clickEvents;
        if (inbound === 0) input.linkGraph.rows = [];
        const result = evaluate(input), linking = find(result, 'weak_internal_linking');
        assert.equal(validateEditorialInputs(input).ok, true);
        assert.equal(result.signals.filter(row => row.type === 'weak_internal_linking').length, input.catalogue.rows.length);
        assert.equal(linking.subject, subject);
        assert.equal(linking.observations.inbound_source_pages, inbound);
        assert.equal(linking.observations.internal_click_events, clickEvents);
        assert.equal(Object.hasOwn(linking.observations, 'minimum_click_events'), false);
        assert.equal(linking.metric_units.internal_click_events, 'consented internal_page_click events');
        assert.deepEqual(linking.exact_period.discovery, { ...input.site.discovery.period, timezone: input.site.discovery.timezone });
        assert.equal(linking.confidence, 'low');
        assert.equal(linking.minimum_sample_status, 'MET');
        assert.ok(linking.limitations.some(value => value.includes('κάτω από 30')));
        assert.equal(abstains(result, 'weak_internal_linking'), false);
        for (const type of searchTypes) assert.ok(abstains(result, type));
    }
    for (const change of [d => { delete d.site; }, d => { delete d.site.discovery; },
        d => { d.site.discovery.rows = []; }, d => { d.site.discovery.freshness.dataState = 'preliminary'; },
        d => { d.site.discovery.status = 'absent'; delete d.site.discovery.rows; }]) {
        const input = fixture(); delete input.gsc; change(input);
        assert.equal(validateEditorialInputs(input).ok, true);
        const result = evaluate(input), linking = find(result, 'weak_internal_linking');
        assert.equal(result.signals.filter(row => row.type === 'weak_internal_linking').length, input.catalogue.rows.length);
        assert.deepEqual(Object.keys(linking.data_source), ['catalogue', 'linkGraph']);
        assert.deepEqual(Object.keys(linking.exact_period), ['catalogue', 'linkGraph']);
        assert.equal(Object.hasOwn(linking.observations, 'internal_click_events'), false);
        assert.equal(Object.hasOwn(linking.metric_units, 'internal_click_events'), false);
        assert.ok(linking.limitations.some(value => value.includes('Απουσιάζει ώριμη')));
        assert.equal(linking.confidence, 'low');
        assert.equal(abstains(result, 'weak_internal_linking'), false);
    }
});

test('weak linking still requires usable catalogue and graph observed together, regardless of discovery clicks', () => {
    const changes = [d => { delete d.catalogue; }, d => { d.catalogue.rows = []; },
        d => { d.catalogue.freshness.dataState = 'NOT VERIFIED'; }, d => { delete d.linkGraph; },
        d => { d.linkGraph.freshness.dataState = 'preliminary'; },
        d => { d.linkGraph.period = { start: '2026-10-28', end: '2026-10-28' }; },
        d => { d.linkGraph.asOf = '2026-10-30'; }];
    for (const change of changes) {
        const input = fixture(); delete input.gsc; input.site.discovery.rows[0].click_events = 0; change(input);
        assert.equal(validateEditorialInputs(input).ok, true);
        const result = evaluate(input);
        assert.equal(find(result, 'weak_internal_linking'), undefined);
        assert.ok(abstains(result, 'weak_internal_linking'));
    }
    const repeatedEdges = fixture(); delete repeatedEdges.gsc;
    repeatedEdges.linkGraph.rows.push({ ...repeatedEdges.linkGraph.rows[0] }, { from: subject, to: subject, fromMapping: 'mapped', toMapping: 'mapped' });
    assert.equal(find(evaluate(repeatedEdges), 'weak_internal_linking').observations.inbound_source_pages, 1);
});

test('evergreen abstains for recent articles, unequal/short periods, totals and insufficient change', () => {
    const mutations = [d => { d.catalogue.rows[0].published = '2026-10-01'; },
        d => { d.gsc.period.start = '2026-10-13'; d.gsc.rows.shift(); },
        d => { d.gsc.period.start = '2026-10-20'; d.gsc.rows = d.gsc.rows.slice(-6); },
        d => { d.gsc.rows = [{ ...d.gsc.rows[0], date: null }]; },
        d => { for (const row of d.gsc.rows) row.impressions = 100; }];
    for (const change of mutations) {
        const input = fixture(); change(input);
        assert.equal(find(evaluate(input), 'evergreen_refresh'), undefined);
        assert.ok(abstains(evaluate(input), 'evergreen_refresh'));
    }
});

test('topic evidence uses explicit catalogue categories and first-party events, never title guessing or catalogue supply alone', () => {
    const input = fixture(); delete input.site;
    assert.equal(find(evaluate(input), 'data_explainer_opportunity'), undefined);
    assert.ok(abstains(evaluate(input), 'data_explainer_opportunity'));
    for (const category of ['standings', 'telemetry', 'tyres', 'ghost-car', 'τηλεμετρία']) {
        const topic = fixture(); topic.catalogue.rows[1].category = category;
        assert.ok(find(evaluate(topic), 'data_explainer_opportunity'));
    }
    const unknown = fixture(); unknown.catalogue.rows[1].category = 'SYNTHETIC general';
    unknown.catalogue.rows[1].title = 'SYNTHETIC tyres telemetry standings ghost-car';
    assert.equal(find(evaluate(unknown), 'data_explainer_opportunity'), undefined);
});

test('deterministic IDs and ordering survive repeated runs and permutations of input rows', () => {
    const input = fixture();
    const second = { ...input.gsc.rows[0], date: null, page: input.catalogue.rows[1].url, impressions: 200, clicks: 0, ctr: 0 };
    input.gsc.rows = [{ ...input.gsc.rows[0], date: null }, second];
    const baseline = evaluate(input);
    assert.deepEqual(evaluate(input), baseline);
    for (const rows of [input.gsc.rows, input.site.articles, input.site.discovery.rows, input.catalogue.rows, input.linkGraph.rows]) rows.reverse();
    assert.deepEqual(evaluate(input), baseline);
    const daily = fixture(), dailyBaseline = evaluate(daily);
    daily.gsc.rows.reverse();
    assert.deepEqual(evaluate(daily), dailyBaseline);
    const shifted = fixture(); shifted.gsc.period.start = '2026-10-13'; shifted.gsc.rows.shift();
    assert.notEqual(find(evaluate(shifted), 'search_ctr_gap').signal_id, find(dailyBaseline, 'search_ctr_gap').signal_id);
});

test('synthetic end-to-end CLI writes private JSON and a Greek Markdown report without printing measurements', t => {
    const directory = temporary(t), output = path.join(directory, 'insights.json');
    const result = run(fixturePath, output);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /PASS/);
    assert.doesNotMatch(result.stdout + result.stderr, /2100|1400|20260222T|tmp-editorial/);
    assert.deepEqual(JSON.parse(fs.readFileSync(output, 'utf8')), evaluate(fixture()));
    const markdown = fs.readFileSync(path.join(directory, 'insights.md'), 'utf8');
    assert.match(markdown, /συνθετικά δεδομένα/);
    assert.match(markdown, /Αντίθετη ένδειξη/);
    assert.match(markdown, /NOT VERIFIED/);
    for (const file of ['insights.json', 'insights.md']) assert.equal(fs.statSync(path.join(directory, file)).mode & 0o777, 0o600);
    assert.equal(run(fixturePath, output).status, 1);
    assert.equal(fs.readFileSync(path.join(directory, 'insights.md'), 'utf8'), markdown);
    assert.equal(renderEditorialReport(evaluate(fixture()), { synthetic: true }), markdown);
});

test('output refuses repo paths, symlink bypasses, existing reports and real data in CI', t => {
    const directory = temporary(t), repoTmp = temporary(t, tests);
    const refused = path.join(tests, 'editorial-insights-refused.json');
    assert.equal(run(fixturePath, refused).status, 1);
    assert.equal(fs.existsSync(refused), false);
    fs.symlinkSync(tests, path.join(directory, 'back-into-repo'));
    assert.equal(run(fixturePath, path.join(directory, 'back-into-repo', 'refused.json')).status, 1);
    assert.equal(run(fixturePath, path.join(repoTmp, 'synthetic.json')).status, 0);
    assert.equal(run(fixturePath, path.join(repoTmp, 'not-a-test.json'), { NODE_TEST_CONTEXT: '' }).status, 1);
    const nonSynthetic = path.join(directory, 'non-synthetic-marker.json');
    // Measurements are still invented; only the flag changes to exercise the write/CI guards.
    fs.writeFileSync(nonSynthetic, JSON.stringify({ ...fixture(), synthetic: false }));
    assert.equal(run(nonSynthetic, path.join(repoTmp, 'real-refused.json')).status, 1);
    assert.equal(run(nonSynthetic, path.join(directory, 'ci-refused.json'), { CI: 'true' }).status, 1);
    fs.writeFileSync(path.join(directory, 'reserved.md'), 'SYNTHETIC KEEP');
    assert.equal(run(fixturePath, path.join(directory, 'reserved.json')).status, 1);
    assert.equal(fs.existsSync(path.join(directory, 'reserved.json')), false);
    assert.equal(fs.readFileSync(path.join(directory, 'reserved.md'), 'utf8'), 'SYNTHETIC KEEP');
    fs.symlinkSync(path.join(directory, 'reserved.md'), path.join(directory, 'linked.json'));
    assert.equal(run(fixturePath, path.join(directory, 'linked.json')).status, 1);
    assert.equal(fs.readFileSync(path.join(directory, 'reserved.md'), 'utf8'), 'SYNTHETIC KEEP');
    const malformed = path.join(directory, 'malformed.json'); fs.writeFileSync(malformed, 'SYNTHETIC PRIVATE INVALID JSON');
    const failure = run(malformed, path.join(directory, 'bad.json'));
    assert.equal(failure.status, 1);
    assert.doesNotMatch(failure.stderr, /SYNTHETIC PRIVATE|malformed\.json/);
});
