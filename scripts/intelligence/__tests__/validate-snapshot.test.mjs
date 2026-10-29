// I-06C4 snapshot validator: consistent synthetic worlds pass every reconciliation; each corruption fails the check
// that owns it, with a specific diagnostic. Synthetic data and generated keys only; no BigQuery or network request.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { SNAPSHOT_MODELS, openSnapshot, sealSnapshot, windowFor } from '../snapshot.mjs';
import {
    AUDIENCE_EVENTS, CHANNEL_CLASSES, CHECKS, LINK_SECTIONS, MEDIUM_CLASSES, PATH_CLASSES, QUALITY_CONTRACT, RUM_STAGES, SOURCE_FAMILIES, SOURCE_SURFACES,
    formatReport, linkSectionClass, p75Violations, reconcile, redacted, validateSnapshot
} from '../validate-snapshot.mjs';
import { CATALOGUE, generatedAtFor, percentileCont, syntheticSnapshot } from './validation-fixture.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = rel => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
const sql = name => read(`docs/intelligence/sql/models/${name}.sql`);

const snapshot = options => structuredClone(syntheticSnapshot(options));
const validate = (snap, extra = {}) => validateSnapshot({ header: snap.header, payload: snap.payload, catalogue: CATALOGUE, ...extra });
const outcome = (report, id) => report.diagnostics.find(d => d.id === id);
const failures = report => report.diagnostics.filter(d => d.outcome === 'FAIL').map(d => `${d.id}: ${d.detail}`);
const models = snap => snap.payload.models;
const rows = (snap, model) => snap.payload.models[model];
const sum = (list, key) => list.reduce((total, row) => total + row[key], 0);
function expectOutcome(report, id, expected, severity, pattern) {
    const d = outcome(report, id);
    assert.ok(d, `${id} reported`);
    assert.equal(d.outcome, expected, `${id}: ${d.detail}`);
    if (severity) assert.equal(d.severity, severity, `${id} severity`);
    if (pattern) assert.match(d.detail, pattern);
}

const AS_OFS = ['2026-10-23', '2026-10-26', '2026-10-29', '2026-10-30', '2026-11-19', '2026-12-05']; // 1, 4, 7, 8, 28 and 28 days

test('consistent synthetic worlds pass every reconciliation: 1–28 days, both day types, 20 seeds each', () => {
    const reconciliations = ['articles.totals', 'articles.by-category', 'articles.within-site', 'articles.days', 'acquisition.sessions', 'acquisition.coverage',
        'acquisition.gaps-reconcile', 'acquisition.stages', 'rum.ratings', 'rum.p75', 'rum.coverage', 'rum.pipeline', 'window.rows', 'window.labels', 'window.carried', 'window.rotation'];
    for (const asOf of AS_OFS) {
        for (const dayType of ['normal', 'discovery']) {
            for (let seed = 1; seed <= 20; seed++) {
                const report = validate(snapshot({ asOf, seed, dayType }));
                assert.deepEqual(failures(report), [], `${asOf} ${dayType} seed ${seed}`);
                for (const id of reconciliations) assert.equal(outcome(report, id).outcome, 'PASS', `${id} ${asOf} ${dayType} seed ${seed}`);
                if (dayType === 'discovery') for (const id of ['discovery.within-navigation', 'discovery.by-section', 'discovery.by-surface']) {
                    assert.equal(outcome(report, id).outcome, 'PASS', `${id} ${asOf} seed ${seed}`);
                }
            }
        }
    }
});

test('the report never claims PASS for what the snapshot cannot show', () => {
    const report = validate(snapshot({ asOf: '2026-10-29' }));
    for (const id of ['external.ga4-stream', 'external.parameters', 'external.export-completeness', 'external.consent-population', 'external.rum-reference']) {
        expectOutcome(report, id, 'NOT_VERIFIED');
    }
    expectOutcome(report, 'external.rum-reference', 'NOT_VERIFIED', 'info', /not yet eligible.*2026-11-19/);
    expectOutcome(validate(snapshot({ asOf: '2026-11-20' })), 'external.rum-reference', 'NOT_VERIFIED', 'info', /eligible \(RUM as_of 2026-11-20\)/);
    expectOutcome(validateSnapshot({ ...snapshot({}) }), 'articles.identity', 'NOT_VERIFIED', 'info', /no article catalogue/);
});

// ---- comparison guard ----

test('comparisons need the same unit, the same window and a population that supports the relation', () => {
    const scope = { asOf: '2026-11-19', start: '2026-10-19', end: '2026-11-15' };
    const side = (over = {}) => ({ label: 'x', value: 5, unit: 'page_view events', population: 'site', scope, ...over });
    assert.equal(reconcile({ relation: 'equal', left: side(), right: side() }).outcome, 'PASS');
    assert.equal(reconcile({ relation: 'equal', left: side(), right: side({ value: 6 }) }).outcome, 'FAIL');
    assert.match(reconcile({ relation: 'equal', left: side(), right: side({ unit: 'session_start events' }) }).reason, /units differ/);
    assert.equal(reconcile({ relation: 'equal', left: side(), right: side({ unit: 'session_start events' }) }).outcome, 'NOT_VERIFIED');
    // A 28-day total against a 7-day total is never a mismatch: it is not comparable.
    const seven = { ...scope, start: '2026-11-09' };
    assert.equal(reconcile({ relation: 'equal', left: side(), right: side({ scope: seven, value: 1 }) }).outcome, 'NOT_VERIFIED');
    assert.equal(reconcile({ relation: 'equal', left: side(), right: side({ scope: { ...scope, asOf: '2026-11-18' } }) }).outcome, 'NOT_VERIFIED');
    // editorial ⊂ site holds; site ⊂ editorial, rum vs site and equality across populations do not.
    assert.equal(reconcile({ relation: 'subset', left: side({ population: 'editorial', value: 4 }), right: side() }).outcome, 'PASS');
    assert.equal(reconcile({ relation: 'subset', left: side({ population: 'editorial', value: 9 }), right: side() }).outcome, 'FAIL');
    assert.equal(reconcile({ relation: 'subset', left: side(), right: side({ population: 'editorial' }) }).outcome, 'NOT_VERIFIED');
    assert.equal(reconcile({ relation: 'equal', left: side({ population: 'editorial' }), right: side() }).outcome, 'NOT_VERIFIED');
    assert.equal(reconcile({ relation: 'subset', left: side({ population: 'rum' }), right: side() }).outcome, 'NOT_VERIFIED');
});

test('acquisition is compared with daily activity over its own seven days, never the 28-day total', () => {
    const snap = snapshot({ asOf: '2026-11-19', seed: 3 });
    const all28 = sum(rows(snap, '20-daily-activity'), 'session_start_events');
    const acquisition = sum(rows(snap, '26-acquisition-session'), 'session_start_events');
    assert.notEqual(all28, acquisition, 'adversarial: a naive 28-day comparison would report a false mismatch');
    expectOutcome(validate(snap), 'acquisition.sessions', 'PASS', 'info', /over 2026-11-09 → 2026-11-15/);
    // A real mismatch inside those seven days fails.
    rows(snap, '20-daily-activity').at(-1).session_start_events += 1;
    expectOutcome(validate(snap), 'acquisition.sessions', 'FAIL', 'high', /session_start/);
    // The 26/29 pair only: a shifted 20 day outside the seven days changes nothing.
    const outside = snapshot({ asOf: '2026-11-19', seed: 3 });
    rows(outside, '20-daily-activity')[0].session_start_events += 5;
    expectOutcome(validate(outside), 'acquisition.sessions', 'PASS');
});

// ---- article reconciliation ----

test('article and category totals reconcile; any drift fails with the category named', () => {
    const snap = snapshot({ seed: 2 });
    rows(snap, '11-category-pageviews').find(r => r.category === 'Ανάλυση').page_view_events += 1;
    const report = validate(snap);
    expectOutcome(report, 'articles.totals', 'FAIL', 'high', /article page views \(10\) \d+ ≠ category page views \(11\) \d+/);
    expectOutcome(report, 'articles.by-category', 'FAIL', 'high', /Ανάλυση: 11 has/);
    // Moving views between categories keeps the total but breaks the per-category check.
    const moved = snapshot({ seed: 2 });
    const [a, b] = rows(moved, '11-category-pageviews').filter(r => r.page_view_events > 0);
    a.page_view_events -= 1;
    b.page_view_events += 1;
    expectOutcome(validate(moved), 'articles.totals', 'PASS');
    expectOutcome(validate(moved), 'articles.by-category', 'FAIL', 'high');
});

test('article views cannot exceed site views or active site days', () => {
    const snap = snapshot({ seed: 4 });
    for (const row of rows(snap, '20-daily-activity')) row.page_view_events = Math.min(row.page_view_events, 1);
    expectOutcome(validate(snap), 'articles.within-site', 'FAIL', 'high', /article page views \(10\) \d+ > site page views \(20\)/);
    const days = snapshot({ seed: 4 });
    rows(days, '10-article-pageviews')[0].days_with_events = 99;
    expectOutcome(validate(days), 'articles.days', 'FAIL', 'high');
});

test('mapped, unmapped, retired and duplicate article identities', () => {
    const base = snapshot({ asOf: '2026-11-19', seed: 1 });
    const unmapped = rows(base, '10-article-pageviews').find(r => r.article_id === '(unmapped)');
    assert.ok(unmapped, 'the synthetic world has an unindexed key');
    expectOutcome(validate(base), 'articles.unmapped', 'WARNING', 'medium', /not in the index, kept as '\(unmapped\)'/);
    // Retired views stay on their live target.
    assert.ok(rows(base, '10-article-pageviews').some(r => r.via_retired_url_events > 0));
    expectOutcome(validate(base), 'articles.identity', 'PASS');
    // A retired id reported as an article is a double identity.
    const retired = snapshot({ asOf: '2026-11-19', seed: 1 });
    rows(retired, '10-article-pageviews').find(r => r.article_id === 'a-slow').article_id = 'a-fast-old';
    expectOutcome(validate(retired), 'articles.identity', 'FAIL', 'critical', /a-fast-old/);
    // The same article twice double counts.
    const twice = snapshot({ asOf: '2026-11-19', seed: 1 });
    rows(twice, '10-article-pageviews').push({ ...rows(twice, '10-article-pageviews')[0] });
    expectOutcome(validate(twice), 'schema.grain', 'FAIL', 'critical', /duplicate keys: 10-article-pageviews: /);
    // Unmapped rows never carry article metadata; mapped rows never carry unmapped keys.
    const leaky = snapshot({ asOf: '2026-11-19', seed: 1 });
    rows(leaky, '10-article-pageviews').find(r => r.article_id === '(unmapped)').title = 'invented';
    rows(leaky, '10-article-pageviews').find(r => r.article_id === 'a-fast').unmapped_keys = 1;
    expectOutcome(validate(leaky), 'articles.rows', 'FAIL', 'high', /has article metadata.*a-fast: unmapped keys/);
    // An id the index no longer has is a catalogue change, not a failure.
    const removed = snapshot({ asOf: '2026-11-19', seed: 1 });
    rows(removed, '10-article-pageviews').find(r => r.article_id === 'a-slow').article_id = 'a-deleted';
    expectOutcome(validate(removed), 'articles.identity', 'WARNING', 'medium', /a-deleted/);
});

test('missing article metadata and impossible publication dates are flagged, not dropped', () => {
    const snap = snapshot({ asOf: '2026-11-19', seed: 1 });
    expectOutcome(validate(snap), 'articles.metadata', 'WARNING', 'medium', /a-plain/);
    rows(snap, '10-article-pageviews').find(r => r.article_id === 'a-fast').published_day = '2027-01-01';
    expectOutcome(validate(snap), 'articles.metadata', 'WARNING', 'medium', /before their indexed publication date: a-fast/);
    const over = snapshot({ asOf: '2026-11-19', seed: 1 });
    rows(over, '11-category-pageviews').find(r => r.category === 'Ανάλυση').catalog_articles = 0;
    expectOutcome(validate(over), 'categories.catalogue', 'WARNING', 'medium', /Ανάλυση/);
});

// ---- acquisition ----

test('attribution gaps reconcile between 26 and 29 and are never folded into Direct', () => {
    const snap = snapshot({ asOf: '2026-11-19', seed: 2 });
    expectOutcome(validate(snap), 'acquisition.attribution', 'WARNING', 'medium', /never Direct/);
    const shifted = snapshot({ asOf: '2026-11-19', seed: 2 });
    const unattributed = rows(shifted, '26-acquisition-session').find(r => r.channel_class === 'unattributed' && r.session_start_events > 0);
    unattributed.channel_class = 'direct_or_unknown';
    const report = validate(shifted);
    expectOutcome(report, 'acquisition.gaps-reconcile', 'FAIL', 'high', /session_start channel: 29 \d+ vs 26 \d+/);
    expectOutcome(report, 'acquisition.sessions', 'PASS');
    const kept = snapshot({ asOf: '2026-11-19', seed: 2 });
    rows(kept, '29-audience-coverage').find(r => r.event_name === 'page_view').site_events += 2;
    expectOutcome(validate(kept), 'acquisition.coverage', 'FAIL', 'high', /kept page_view \(29\)/);
    const stages = snapshot({ asOf: '2026-11-19', seed: 2 });
    const pv = rows(stages, '29-audience-coverage').find(r => r.event_name === 'page_view');
    pv.consented_events = pv.site_events - 1;
    expectOutcome(validate(stages), 'acquisition.stages', 'FAIL', 'high', /page_view/);
});

// ---- discovery ----

test('article clicks stay within internal clicks in total, per section class and per source surface', () => {
    const snap = snapshot({ asOf: '2026-11-19', seed: 6, dayType: 'discovery' });
    // 13 keeps raw link_section values; they are classified as 28 classifies them before comparing.
    assert.equal(linkSectionClass('Navigation '), 'navigation');
    assert.equal(linkSectionClass('injected'), 'other');
    expectOutcome(validate(snap), 'discovery.by-section', 'PASS');
    const total = snapshot({ asOf: '2026-11-19', seed: 6, dayType: 'discovery' });
    rows(total, '13-article-discovery')[0].click_events += 500;
    const report = validate(total);
    expectOutcome(report, 'discovery.within-navigation', 'FAIL', 'high', /article clicks \(13\) \d+ > internal clicks \(28\)/);
    const surface = snapshot({ asOf: '2026-11-19', seed: 6, dayType: 'discovery' });
    const row13 = rows(surface, '13-article-discovery').find(r => r.source_surface !== 'standings');
    row13.source_surface = 'standings';
    row13.click_events += 50;
    expectOutcome(validate(surface), 'discovery.by-surface', 'FAIL', 'high', /standings: 13 has/);
});

test('missing click fields, unknown classes and unmapped destinations are diagnosed separately', () => {
    const snap = snapshot({ asOf: '2026-11-19', seed: 1, dayType: 'discovery' });
    const nav = rows(snap, '28-internal-navigation');
    nav.push({ ...nav[0], source_section: 'home', destination_section: 'missing', link_section: '(none)', click_events: 2, meets_min_events: false });
    const report = validate(snap);
    expectOutcome(report, 'discovery.fields', 'WARNING', 'high', /without link_path/);
    const unknown = snapshot({ asOf: '2026-11-19', seed: 1, dayType: 'discovery' });
    rows(unknown, '28-internal-navigation')[0].destination_section = 'tool_new';
    expectOutcome(validate(unknown), 'schema.enums', 'FAIL', 'high', /destination_section = tool_new/);
    const other = snapshot({ asOf: '2026-11-19', seed: 1, dayType: 'discovery' });
    expectOutcome(validate(other), 'discovery.classes', 'WARNING', 'medium', /outside the allowlist/);
    expectOutcome(validate(other), 'discovery.unmapped', 'WARNING', 'medium', /'\(unmapped\)'/);
});

test('discovery carried for several days keeps its own dates; overdue warns; too old fails', () => {
    for (const age of [1, 3, 7]) {
        const report = validate(snapshot({ asOf: '2026-11-19', discoveryAge: age }));
        expectOutcome(report, 'freshness.discovery', 'PASS', 'info', new RegExp(`carried, ${age} day`));
        expectOutcome(report, 'window.carried', 'PASS', 'info', /13-article-discovery 2026-10-19 → /);
    }
    expectOutcome(validate(snapshot({ asOf: '2026-11-19', discoveryAge: 9 })), 'freshness.discovery', 'WARNING', 'medium', /overdue/);
    expectOutcome(validate(snapshot({ asOf: '2026-11-19', discoveryAge: 14 })), 'freshness.discovery', 'FAIL', 'high', /must have been dropped/);
    expectOutcome(validate(snapshot({ asOf: '2026-11-19', discoveryAge: null })), 'discovery.within-navigation', 'NOT_VERIFIED');
    // A carried label that does not match its own day's window is presented with the wrong dates.
    const wrong = snapshot({ asOf: '2026-11-19', discoveryAge: 3 });
    wrong.payload.modelWindows['13-article-discovery'].asOf = '2026-11-17';
    wrong.payload.modelWindows['28-internal-navigation'].asOf = '2026-11-17';
    expectOutcome(validate(wrong), 'window.carried', 'FAIL', 'critical', /labelled 2026-10-19 → 2026-11-12, but that day's window is 2026-10-19 → 2026-11-13/);
    // Rows from another window than their label.
    const rowsOff = snapshot({ asOf: '2026-11-19', discoveryAge: 3 });
    rows(rowsOff, '28-internal-navigation')[0].through_day = '2026-11-15';
    expectOutcome(validate(rowsOff), 'window.rows', 'FAIL', 'critical', /28-internal-navigation: 1 row/);
});

// ---- RUM ----

test('carried RUM on a discovery day is expected; a wrong age or a lone carried model fails', () => {
    const snap = snapshot({ asOf: '2026-11-19', dayType: 'discovery' });
    const report = validate(snap);
    expectOutcome(report, 'window.rotation', 'PASS', 'info', /discovery day, RUM carried from yesterday/);
    expectOutcome(report, 'window.carried', 'PASS', 'info', /30-cwv-summary 2026-10-19 → 2026-11-14 \(as_of 2026-11-18\)/);
    // RUM two days old: the rotation never carries it from earlier than yesterday.
    const old = snapshot({ asOf: '2026-11-19', dayType: 'discovery' });
    const twoDays = windowFor('2026-11-17');
    for (const m of ['30-cwv-summary', '33-rum-coverage']) {
        old.payload.modelWindows[m] = { asOf: twoDays.asOf, start: twoDays.start, end: twoDays.end };
        for (const row of rows(old, m)) Object.assign(row, { from_day: twoDays.start, through_day: twoDays.end, requested_through_day: twoDays.end, extraction_through: twoDays.end });
    }
    expectOutcome(validate(old), 'window.rotation', 'FAIL', 'high', /RUM carried from 2 days earlier/);
    // RUM carried while discovery did not run: a normal day computing nine models is over budget.
    const budget = snapshot({ asOf: '2026-11-19', dayType: 'normal', discoveryAge: 0 });
    for (const m of ['13-article-discovery', '28-internal-navigation']) delete budget.payload.modelWindows[m];
    const today = windowFor('2026-11-19');
    for (const m of ['13-article-discovery', '28-internal-navigation']) for (const row of rows(budget, m)) Object.assign(row, { from_day: today.start, through_day: today.end });
    expectOutcome(validate(budget), 'window.rotation', 'FAIL', 'high', /9 models computed/);
});

test('invalid, duplicate and conflicting observations; ratings and p75 must agree with the counts', () => {
    const snap = snapshot({ asOf: '2026-11-19', seed: 4 });
    expectOutcome(validate(snap), 'rum.integrity', 'WARNING', 'medium', /invalid observation/);
    const conflict = snapshot({ asOf: '2026-11-19', seed: 4 });
    rows(conflict, '33-rum-coverage').push({ ...rows(conflict, '33-rum-coverage')[0], stage: 'observations', category: 'final_snapshot_conflicting', count: 2 });
    expectOutcome(validate(conflict), 'rum.integrity', 'WARNING', 'high', /2 final observation\(s\) from conflicting snapshot copies/);
    const sums = snapshot({ asOf: '2026-11-19', seed: 4 });
    rows(sums, '30-cwv-summary').find(r => r.metric === 'LCP' && r.observations).poor += 1;
    expectOutcome(validate(sums), 'rum.ratings', 'FAIL', 'high', /ratings do not add up/);
    const coverage = snapshot({ asOf: '2026-11-19', seed: 4 });
    rows(coverage, '33-rum-coverage').find(r => r.stage === 'coverage_distribution' && r.category === 'delayed_existing').count += 1;
    expectOutcome(validate(coverage), 'rum.coverage', 'FAIL', 'high', /delayed_existing: 33/);
    const library = snapshot({ asOf: '2026-11-19', seed: 4 });
    rows(library, '33-rum-coverage').push({ ...rows(library, '33-rum-coverage')[0], stage: 'library_rating', category: 'disagrees_or_missing', count: 1 });
    expectOutcome(validate(library), 'rum.library', 'WARNING', 'high');
});

test('a wrong unit is caught: CLS reported ×1000 contradicts its rating counts', () => {
    const snap = snapshot({ asOf: '2026-11-19', seed: 5 });
    const cls = rows(snap, '30-cwv-summary').find(r => r.metric === 'CLS' && r.observations >= 4);
    Object.assign(cls, { good: cls.observations, needs_improvement: 0, poor: 0, good_share: 1, p75: 0.042 }); // every shift scored good
    expectOutcome(validate(snap), 'rum.p75', 'PASS');
    cls.p75 *= 1000; // 42: the collector's ×1000 integer, not the native unit
    expectOutcome(validate(snap), 'rum.p75', 'FAIL', 'high', /CLS: p75 .* above the good limit 0\.1/);
});

test('p75 bounds follow PERCENTILE_CONT over every split of rating counts', () => {
    for (let n = 1; n <= 40; n++) {
        for (let good = 0; good <= n; good++) {
            const values = [...Array(good).fill(1000), ...Array(n - good).fill(3000)]; // LCP: good, then needs improvement
            const row = { metric: 'LCP', observations: n, good, needs_improvement: n - good, poor: 0, p75: percentileCont(values, 0.75) };
            assert.deepEqual(p75Violations(row), [], `n ${n} good ${good}`);
            // When both interpolation positions fall in one band, the counts decide the side of 2500 ms.
            const k = (n - 1) * 0.75;
            if (Math.ceil(k) < good || Math.floor(k) >= good) {
                assert.ok(p75Violations({ ...row, p75: row.p75 <= 2500 ? 3500 : 2000 }).length > 0, `wrong side caught (n ${n} good ${good})`);
            }
        }
    }
});

// ---- time ----

test('missing days fail; isolated zero days are normal; a run of zero days is a probable collection gap', () => {
    const missing = snapshot({ asOf: '2026-11-19' });
    rows(missing, '20-daily-activity').splice(10, 1);
    expectOutcome(validate(missing), 'continuity.days', 'FAIL', 'critical', /expected 28 consecutive days/);
    const duplicated = snapshot({ asOf: '2026-11-19' });
    rows(duplicated, '20-daily-activity')[3].event_day = rows(duplicated, '20-daily-activity')[2].event_day;
    expectOutcome(validate(duplicated), 'schema.grain', 'FAIL', 'critical');
    const isolated = snapshot({ asOf: '2026-11-19', seed: 2, zeroDays: ['2026-10-25', '2026-11-01'] });
    expectOutcome(validate(isolated), 'continuity.zero-days', 'PASS', 'info', /2026-10-25.*2026-11-01.*shown as 0/);
    const gap = snapshot({ asOf: '2026-11-19', seed: 2, zeroDays: ['2026-11-03', '2026-11-04', '2026-11-05'] });
    expectOutcome(validate(gap), 'continuity.zero-days', 'WARNING', 'medium', /3 consecutive days .* through 2026-11-05.*not proof of zero readership/);
    const odd = snapshot({ asOf: '2026-11-19', seed: 2, zeroDays: ['2026-11-03'] });
    rows(odd, '20-daily-activity').find(r => r.event_day === '2026-11-03').session_start_events = 2;
    const report = validate(odd);
    expectOutcome(report, 'continuity.sessions-without-views', 'WARNING', 'medium', /2026-11-03/);
});

test('freshness separates the maturity lag, a late schedule, missed refreshes and a stale snapshot', () => {
    const snap = snapshot({ asOf: '2026-11-19' });
    const at = iso => validate(snap, { now: new Date(iso) });
    expectOutcome(at('2026-11-20T01:30:00Z'), 'freshness.snapshot', 'PASS', 'info', /maturity lag is expected/);
    expectOutcome(at('2026-11-20T09:00:00Z'), 'freshness.snapshot', 'PASS', 'info', /today's run \(as_of 2026-11-20\) is pending or late/);
    expectOutcome(at('2026-11-21T09:00:00Z'), 'freshness.snapshot', 'WARNING', 'medium', /1 daily refresh\(es\) missing/);
    expectOutcome(at('2026-11-23T09:00:00Z'), 'freshness.snapshot', 'WARNING', 'medium', /generated \d+ h ago/);
    // A run that started late in the day still has as_of = its own property day, and is valid.
    const late = snapshot({ asOf: '2026-11-19' });
    late.header.generatedAt = late.payload.generatedAt = '2026-11-20T06:40:00.000Z';
    expectOutcome(validate(late), 'payload.as-of', 'PASS');
    // A snapshot generated on one property day but claiming another is not.
    const shifted = snapshot({ asOf: '2026-11-19' });
    shifted.header.generatedAt = shifted.payload.generatedAt = generatedAtFor('2026-11-20');
    expectOutcome(validate(shifted), 'payload.as-of', 'FAIL', 'critical', /as_of is 2026-11-19/);
});

// ---- integrity ----

test('malformed rows, wrong types, changed thresholds and header mismatches fail closed', () => {
    const typed = snapshot({});
    rows(typed, '20-daily-activity')[0].page_view_events = '12';
    rows(typed, '26-acquisition-session')[0].session_start_events = -1;
    rows(typed, '30-cwv-summary')[0].p75 = Number.NaN;
    const report = validate(typed);
    expectOutcome(report, 'schema.columns', 'FAIL', 'critical', /20-daily-activity row 0: page_view_events is not count/);
    assert.equal(outcome(report, 'articles.totals'), undefined, 'numeric checks never run on a malformed payload');
    const missingColumn = snapshot({});
    delete rows(missingColumn, '11-category-pageviews')[0].catalog_articles;
    expectOutcome(validate(missingColumn), 'schema.columns', 'FAIL', 'critical', /catalog_articles/);
    const thresholds = snapshot({});
    thresholds.payload.minEvents = 10;
    expectOutcome(validate(thresholds), 'payload.thresholds', 'FAIL', 'high');
    const flags = snapshot({});
    rows(flags, '20-daily-activity')[0].meets_min_events = true;
    expectOutcome(validate(flags), 'schema.flags', 'FAIL', 'high', /20-daily-activity row 0: meets_min_events/);
    const header = snapshot({});
    header.payload.window.start = '2026-10-20';
    expectOutcome(validate(header), 'payload.header', 'FAIL', 'critical', /window/);
    assert.equal(validate(header).diagnostics.length, 2, 'nothing else is evaluated on a payload the header does not describe');
    const extra = snapshot({});
    models(extra)['99-new-model'] = [];
    expectOutcome(validate(extra), 'payload.models', 'FAIL', 'critical', /99-new-model/);
    const empty = snapshot({});
    rows(empty, '13-article-discovery')[0].click_events = 0;
    rows(empty, '13-article-discovery')[0].meets_min_events = false;
    expectOutcome(validate(empty), 'schema.positive', 'FAIL', 'high');
    assert.equal(validateSnapshot({ header: snapshot({}).header, payload: null }).diagnostics[0].outcome, 'FAIL');
});

test('older 4-, 5- and 7-model snapshots validate what they contain and mark the rest NOT_VERIFIED', () => {
    for (const keep of [['11-category-pageviews', '20-daily-activity', '30-cwv-summary', '33-rum-coverage'],
        ['10-article-pageviews', '11-category-pageviews', '20-daily-activity', '30-cwv-summary', '33-rum-coverage'],
        ['10-article-pageviews', '11-category-pageviews', '20-daily-activity', '26-acquisition-session', '29-audience-coverage', '30-cwv-summary', '33-rum-coverage']]) {
        const snap = snapshot({ asOf: '2026-10-27', discoveryAge: null });
        for (const m of Object.keys(models(snap))) if (!keep.includes(m)) delete models(snap)[m];
        for (const m of Object.keys(snap.payload.modelWindows)) if (!keep.includes(m)) delete snap.payload.modelWindows[m];
        const report = validate(snap);
        assert.deepEqual(failures(report), [], keep.join());
        if (!keep.includes('10-article-pageviews')) expectOutcome(report, 'articles.totals', 'NOT_VERIFIED');
        if (!keep.includes('26-acquisition-session')) expectOutcome(report, 'acquisition.sessions', 'NOT_VERIFIED');
        expectOutcome(report, 'discovery.within-navigation', 'NOT_VERIFIED');
    }
});

test('low traffic is informational, never a failure', () => {
    const report = validate(snapshot({ asOf: '2026-11-19', seed: 9, traffic: 2 }));
    assert.deepEqual(failures(report), []);
    expectOutcome(report, 'sample.sizes', 'PASS', 'info', /flagged and shown/);
    assert.ok(report.diagnostics.filter(d => d.outcome === 'WARNING').length <= 8, 'a low-traffic day does not flood the report');
});

// ---- encryption, output and reporting ----

test('validates a synthetic encrypted snapshot opened with a generated key; output never leaks counts when redacted', () => {
    const key = crypto.randomBytes(32);
    const { header, payload } = snapshot({ asOf: '2026-11-19', seed: 2, dayType: 'discovery' });
    const envelope = sealSnapshot(payload, key, { generatedAt: header.generatedAt, window: { asOf: header.asOf, start: header.start, end: header.end } });
    const opened = openSnapshot(envelope, key);
    const report = validateSnapshot({ ...opened, catalogue: CATALOGUE });
    assert.equal(report.ok, true, failures(report).join('\n'));
    assert.equal(openSnapshot(envelope, crypto.randomBytes(32)), null, 'a wrong key opens nothing');
    const shown = report.diagnostics.filter(item => item.outcome !== 'PASS');
    assert.ok(shown.length > 0 && shown.every(d => formatReport(report).includes(d.detail)), 'the full report shows each finding\'s detail');
    const quiet = formatReport(report, { redact: true });
    for (const d of shown) assert.ok(!quiet.includes(d.detail) && quiet.includes(d.id), `redacted: ${d.id}`);
    assert.ok(redacted(report).diagnostics.every(d => !('detail' in d)));

    // The CLI reads the key from the environment and redacts under GitHub Actions whatever it is asked.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-validate-'));
    const file = path.join(dir, 'snapshot.json');
    fs.writeFileSync(file, envelope);
    const cli = (args, env) => {
        try {
            return { code: 0, out: execFileSync(process.execPath, ['scripts/intelligence/validate-snapshot.mjs', file, ...args], { cwd: REPO_ROOT, env: { PATH: process.env.PATH, ...env }, encoding: 'utf8' }) };
        } catch (error) {
            return { code: error.status, out: error.stdout, err: error.stderr };
        }
    };
    const actions = cli(['--json'], { DASHBOARD_SNAPSHOT_KEY: key.toString('base64'), GITHUB_ACTIONS: 'true' });
    assert.ok(JSON.parse(actions.out).diagnostics.every(d => !('detail' in d)), 'no detail (counts) under GitHub Actions');
    const wrong = cli([], { DASHBOARD_SNAPSHOT_KEY: crypto.randomBytes(32).toString('base64') });
    assert.equal(wrong.code, 2);
    assert.match(wrong.err, /does not open with this key/);
    assert.ok(!fs.readdirSync(dir).some(name => name !== 'snapshot.json'), 'the CLI writes nothing');
    fs.rmSync(dir, { recursive: true });
});

test('every diagnostic has an action, and failing checks name their area and evidence', () => {
    const snap = snapshot({ asOf: '2026-11-19', seed: 2, dayType: 'discovery' });
    rows(snap, '11-category-pageviews')[0].page_view_events += 3;
    const report = validate(snap, { now: new Date('2026-11-25T09:00:00Z') });
    for (const d of report.diagnostics) {
        assert.ok(d.action && d.title && d.area && d.detail, d.id);
        assert.ok(['integrity', 'scheduling', 'reconciliation', 'instrumentation', 'source_coverage', 'sql_classification', 'presentation', 'sample', 'external'].includes(d.area), d.id);
    }
    assert.equal(report.diagnostics[0].outcome, 'FAIL', 'failures are listed first');
    assert.match(formatReport(report), /^Snapshot validation — as_of 2026-11-19, 2026-10-19 → 2026-11-15\n\d+ FAIL/);
});

// ---- the contract is derived from the SQL, not invented ----

test('the quality contract covers exactly the snapshot models and every column they keep', () => {
    assert.deepEqual(Object.keys(QUALITY_CONTRACT).sort(), Object.keys(SNAPSHOT_MODELS).sort());
    for (const [model, spec] of Object.entries(SNAPSHOT_MODELS)) {
        for (const column of spec.columns) assert.ok(QUALITY_CONTRACT[model].columns[column], `${model}.${column}`);
        for (const column of Object.keys(QUALITY_CONTRACT[model].columns)) assert.match(sql(model), new RegExp(`\\b${column}\\b`), `${model}.${column} is in the SQL`);
    }
});

test('populations behind each reconciliation are the ones the model SQL reads', () => {
    for (const model of ['10-article-pageviews', '11-category-pageviews', '13-article-discovery']) {
        assert.match(sql(model), /\{\{EDITORIAL_BASE\}\}/);
        assert.match(sql(model), /\bFROM editorial\b/);
        assert.equal(QUALITY_CONTRACT[model].population, 'editorial');
    }
    for (const model of ['20-daily-activity', '26-acquisition-session', '28-internal-navigation']) {
        assert.match(sql(model), /\{\{AUDIENCE_BASE\}\}/);
        assert.match(sql(model), /\bFROM site\b/);
        assert.equal(QUALITY_CONTRACT[model].population, 'site');
    }
    // editorial = site + an article key: identical consent, host, maturity and table bounds.
    const base = sql('base'), audience = sql('audience-base');
    assert.match(base, /analytics_storage = 'Yes' AND page_path IS NOT NULL AND article_key IS NOT NULL/);
    assert.match(audience, /analytics_storage = 'Yes' AND page_path IS NOT NULL AND event_day <= through_day/);
    assert.match(base, /WHERE k\.event_day <= b\.through_day/);
    const host = /r'\^https:\/\/f1-stories\\\.gr\(\/\[\^\?#\]\*\)'/;
    assert.match(base, host);
    assert.match(audience, host);
    const bounds = text => text.match(/_TABLE_SUFFIX BETWEEN[\s\S]*?\)\)\)/)[0].replace(/\s+/g, ' ');
    assert.equal(bounds(base), bounds(audience));
    // 29's `kept` repeats the site filter; its counters use the same classes as 26.
    assert.match(sql('29-audience-coverage'), /\(analytics_storage = 'Yes' AND page_path IS NOT NULL AND event_day <= through_day\) AS kept/);
    assert.match(sql('29-audience-coverage'), /session_channel_class IN \('unattributed', 'other'\)/);
    assert.match(sql('29-audience-coverage'), /session_source_family IN \('unattributed', 'other_source'\)/);
    // 13 keeps raw link_section (base.sql); 28 classifies it (audience-base.sql), hence linkSectionClass.
    assert.match(base, /key = 'link_section'\) AS link_section/);
    assert.match(audience, /link_section_class\(\(SELECT value\.string_value FROM UNNEST\(event_params\) WHERE key = 'link_section'\)\) AS link_section/);
    // 30 and 33 read the same rum-base CTEs.
    assert.match(sql('30-cwv-summary'), /\{\{RUM_BASE\}\}[\s\S]*FROM rated/);
    assert.match(sql('33-rum-coverage'), /SELECT 'coverage_distribution', coverage FROM rated/);
});

test('enumerations match the SQL that produces them', () => {
    const literals = (text, fn) => {
        const body = text.split(`CREATE TEMP FUNCTION ${fn}(`)[1].split('\n);')[0];
        return [...body.matchAll(/(?:THEN|ELSE) '([^']+)'/g)].map(m => m[1]);
    };
    const functions = sql('audience-functions');
    assert.deepEqual(new Set(literals(functions, 'channel_class')), new Set(CHANNEL_CLASSES));
    assert.deepEqual(new Set(literals(functions, 'medium_class')), new Set(MEDIUM_CLASSES));
    assert.deepEqual(new Set(literals(functions, 'source_family')), new Set(SOURCE_FAMILIES));
    const sections = functions.split('CREATE TEMP FUNCTION link_section_class(')[1].match(/\^\(\?:([a-z_|]+)\)\$/)[1].split('|');
    assert.deepEqual(new Set(sections), new Set(LINK_SECTIONS));
    assert.deepEqual(new Set(literals(read('docs/intelligence/sql/02-event-inventory.sql'), 'classify_path')), new Set(PATH_CLASSES));
    const surfaces = [...sql('13-article-discovery').matchAll(/(?:THEN|ELSE) '([a-z_]+)'/g)].map(m => m[1]);
    assert.deepEqual(new Set(surfaces), new Set(SOURCE_SURFACES));
    const events = sql('audience-base').match(/event_name IN \(([^)]+)\)/)[1].match(/'([a-z_]+)'/g).map(v => v.slice(1, -1));
    assert.deepEqual(events, AUDIENCE_EVENTS);
    const rum = sql('33-rum-coverage');
    for (const [stage, categories] of Object.entries(RUM_STAGES)) {
        assert.match(rum, new RegExp(`'${stage}'`), stage);
        for (const category of categories || []) assert.ok(rum.includes(`'${category}'`) || ['delayed_existing', 'delayed_consent', 'bfcache_observed'].includes(category), `${stage}/${category}`);
    }
    // analytics.js classifyLink emits exactly the allowlisted sections.
    const emitted = [...read('scripts/analytics.js').split('function classifyLink(')[1].split('\n    }\n')[0].matchAll(/return '([a-z_]+)'/g)].map(m => m[1]);
    assert.deepEqual(new Set(emitted), new Set(LINK_SECTIONS));
});

test('the validator is offline: no network, no file writes, no BigQuery, and not wired into any workflow', () => {
    const source = read('scripts/intelligence/validate-snapshot.mjs');
    assert.doesNotMatch(source, /\bfetch\(|writeFile|appendFile|bigQuery\(|googleapis/);
    for (const name of fs.readdirSync(path.join(REPO_ROOT, '.github/workflows'))) {
        assert.doesNotMatch(read(`.github/workflows/${name}`), /validate-snapshot/, name);
    }
    assert.doesNotMatch(read('scripts/intelligence/health-check.mjs'), /openSnapshot\(|parseKey\(|createDecipher|from ['"]\.\/validate-snapshot/);
});

test('the documentation lists every check and every model of the contract', () => {
    const doc = read('docs/intelligence/data-quality.md');
    for (const id of Object.keys(CHECKS)) assert.ok(doc.includes(`\`${id}\``), id);
    for (const model of Object.keys(QUALITY_CONTRACT)) assert.ok(doc.includes(`\`${model}\``), model);
});
