#!/usr/bin/env node
// Synthetic tests for the I-05 Real User Performance models. No BigQuery. The oracle below takes every rule it
// applies from the rendered SQL itself: scan and cohort bounds, eligibility, the rum-pilot revision order, validity
// lists, CLS divisor, rating thresholds and the percentile fraction. Changing one of those rules in the SQL changes
// the oracle's results, so the fixtures test the SQL's rules, not a hand-written copy. Joins and window semantics are
// BigQuery's and are only exercised by a dry-run.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { MODELS, AUDIENCE_MODELS, RUM_MODELS, MODELS_DIR, renderModel, rumLatestRevisionSql } from '../editorial-model.mjs';

const read = name => fs.readFileSync(path.join(MODELS_DIR, name), 'utf8');
const code = text => text.replace(/--.*$/gm, '');
const report = fs.readFileSync(path.join(MODELS_DIR, '..', '..', '..', '..', 'perf', 'rum-pilot', 'report.sql'), 'utf8');
const index = { v: 2, a: ['Writer'], c: ['News'], p: [['20261001A', 'Synthetic', 0, '2026-10-01', 400, 188, '', '1', [0]]] };
const render = name => renderModel(name, { project: 'synthetic-project', property: '123', index, retired: [] });
const sql = code(render('30-cwv-summary'));
const one = (re, text = sql) => { const m = text.match(re); assert.ok(m, `rule ${re}`); return m; };
const list = text => text.split(',').map(s => s.trim().replace(/^'|'$/g, ''));

// Rules parsed from the rendered SQL.
const RULES = {
    scanBefore: Number(one(/DATE_SUB\(@start_day, INTERVAL (\d+) DAY\)/)[1]),
    maturity: Number(one(/DATE_SUB\(@as_of_day, INTERVAL (\d+) DAY\)/)[1]),
    scanSpan: Number(one(/DATE_ADD\(@start_day, INTERVAL (\d+) DAY\)\)\) AS extraction_through/)[1]),
    cohortSpan: Number(one(/DATE_ADD\(from_day, INTERVAL (\d+) DAY\)/)[1]),
    version: one(/version = '([^']+)' AND metric_id IS NOT NULL AND revision >= (\d+)/)[1],
    minRevision: Number(one(/version = '([^']+)' AND metric_id IS NOT NULL AND revision >= (\d+)/)[2]),
    host: new RegExp(one(/r'(\^https:\/\/f1-stories\\\.gr\(\/\[\^\?#\]\*\))'/)[1]),
    partition: list(one(/QUALIFY ROW_NUMBER\(\) OVER \(\s*PARTITION BY ([\w, ]+?) ORDER BY/)[1]),
    order: list(one(/QUALIFY ROW_NUMBER\(\) OVER \(\s*PARTITION BY [\w, ]+? ORDER BY ([\w ,]+?)\s*\) = 1/)[1]).map(k => k.split(' ')),
    metrics: list(one(/AND metric IN \(([^)]+)\)\n\s+AND page_group IN/)[1]),
    pageGroups: list(one(/AND page_group IN \(([^)]+)\)/)[1]),
    viewports: list(one(/AND viewport IN \(([^)]+)\)/)[1]),
    coverages: list(one(/AND coverage IN \(([^)]+)\)/)[1]),
    navTypes: list(one(/IF\(navigation_type IN \(([^)]+)\), navigation_type, 'other'\)/)[1]),
    clsDivisor: Number(one(/IF\(metric = 'CLS', value \/ ([\d.]+), value\) AS native_value/)[1]),
    thresholds: [...sql.matchAll(/WHEN metric = '(\w+)' AND native_value <= ([\d.]+) THEN '(\w+)'/g)].map(m => [m[1], Number(m[2]), m[3]]),
    fraction: Number(one(/PERCENTILE_CONT\(native_value, ([\d.]+)\)/)[1])
};

const day = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const minDay = (...days) => days.sort()[0];
const localDay = (ms, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));

function percentileCont(values, p) {
    const sorted = [...values].sort((a, b) => a - b);
    const pos = p * (sorted.length - 1), lo = Math.floor(pos), hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function rating(metric, value) {
    const rules = RULES.thresholds.filter(([m]) => m === metric);
    if (!rules.length) return null;
    const hit = rules.find(([, limit]) => value <= limit);
    return hit ? hit[2] : 'poor';
}

// The rum-base pipeline, driven by RULES.
function run(events, { start, end, asOf, tz = 'Europe/Athens', minObservations = 30 }) {
    const extractionThrough = minDay(day(asOf, -RULES.maturity), day(start, RULES.scanSpan));
    const through = minDay(end, day(start, RULES.cohortSpan), extractionThrough);
    const scanned = events.filter(e => e.table_day >= day(start, -RULES.scanBefore) && e.table_day <= extractionThrough);
    const eligible = scanned.filter(e => e.analytics_storage === 'Yes' && RULES.host.test(e.page_location || '')
        && e.version === RULES.version && e.metric_id != null && Number.isInteger(e.revision) && e.revision >= RULES.minRevision);
    const key = (e, cols) => JSON.stringify(cols.map(c => e[c]));
    const copies = new Map();
    for (const e of eligible) { const k = key(e, [...RULES.partition, 'revision']); copies.set(k, [...(copies.get(k) || []), e]); }
    const groups = new Map();
    for (const e of eligible) { const k = key(e, RULES.partition); groups.set(k, [...(groups.get(k) || []), e]); }
    const latest = [...groups.values()].map(rows => [...rows].sort((a, b) => {
        for (const [col, dir] of RULES.order) if (a[col] !== b[col]) return (a[col] < b[col] ? -1 : 1) * (dir === 'DESC' ? -1 : 1);
        return 0;
    })[0]).map(e => {
        const same = copies.get(key(e, [...RULES.partition, 'revision']));
        return { ...e, snapshot_copies: same.length, conflicted: new Set(same.map(s => s.value)).size > 1 };
    });
    const rated = latest
        .filter(e => e.value != null && e.value >= 0 && e.nav_start_ms != null && RULES.metrics.includes(e.metric)
            && RULES.pageGroups.includes(e.page_group) && RULES.viewports.includes(e.viewport) && RULES.coverages.includes(e.coverage))
        .map(e => {
            const native = e.metric === 'CLS' ? e.value / RULES.clsDivisor : e.value;
            return { ...e, nav_day: localDay(e.nav_start_ms, tz), native, rating: rating(e.metric, native),
                nav_type: e.nav_type == null ? '(missing)' : RULES.navTypes.includes(e.nav_type) ? e.nav_type : 'other' };
        })
        .filter(e => e.nav_day >= start && e.nav_day <= through);
    const summary = {};
    for (const coverage of RULES.coverages) for (const metric of RULES.metrics) {
        const rows = rated.filter(r => r.coverage === coverage && r.metric === metric);
        summary[`${coverage}/${metric}`] = {
            observations: rows.length,
            p75: rows.length ? percentileCont(rows.map(r => r.native), RULES.fraction) : null,
            good: rows.filter(r => r.rating === 'good').length,
            needs_improvement: rows.filter(r => r.rating === 'needs_improvement').length,
            poor: rows.filter(r => r.rating === 'poor').length,
            conflicted: rows.filter(r => r.conflicted).length,
            meets_min_observations: rows.length >= minObservations
        };
    }
    return { extractionThrough, through, truncated: through < end, rated, summary };
}

// Synthetic web_vital events. nav 2026-10-20 12:00 Athens unless stated.
const NAV = Date.parse('2026-10-20T09:00:00Z');
let ts = 1;
const ev = over => ({ table_day: '2026-10-20', event_timestamp: ts++, analytics_storage: 'Yes', page_location: 'https://f1-stories.gr/',
    version: 'wv6.2.3-rum1', metric: 'LCP', metric_id: 'id', revision: 1, value: 1000, nav_start_ms: NAV,
    page_group: 'home', viewport: 'mobile_like', nav_type: 'navigate', coverage: 'delayed_existing', ...over });
const WINDOW = { start: '2026-10-19', end: '2026-10-25', asOf: '2026-10-30' };
const at = (out, k) => out.summary[`delayed_existing/${k}`];

test('the rules come from the SQL and match the documented contract', () => {
    assert.deepEqual(RULES.partition, ['version', 'metric', 'metric_id']);
    assert.deepEqual(RULES.order, [['revision', 'DESC'], ['event_timestamp', 'DESC']]);
    assert.equal(RULES.version, 'wv6.2.3-rum1');
    assert.equal(RULES.clsDivisor, 1000);
    assert.equal(RULES.fraction, 0.75);
    assert.deepEqual(RULES.thresholds, [['LCP', 2500, 'good'], ['LCP', 4000, 'needs_improvement'], ['INP', 200, 'good'],
        ['INP', 500, 'needs_improvement'], ['CLS', 0.1, 'good'], ['CLS', 0.25, 'needs_improvement']]);
    assert.deepEqual(RULES.metrics, ['LCP', 'INP', 'CLS', 'FCP', 'TTFB']);
    assert.deepEqual([RULES.scanBefore, RULES.maturity, RULES.scanSpan, RULES.cohortSpan], [1, 4, 119, 89]);
});

test('revisions: highest revision wins, INP may decrease, never the maximum value', () => {
    const out = run([
        ev({ metric_id: 'a', revision: 1, value: 3000 }), ev({ metric_id: 'a', revision: 2, value: 2000 }),
        ev({ metric: 'INP', metric_id: 'b', revision: 1, value: 600 }), ev({ metric: 'INP', metric_id: 'b', revision: 2, value: 150 })
    ], WINDOW);
    assert.deepEqual([at(out, 'LCP').observations, at(out, 'LCP').p75, at(out, 'LCP').good], [1, 2000, 1]);
    assert.deepEqual([at(out, 'INP').observations, at(out, 'INP').p75, at(out, 'INP').good], [1, 150, 1]);
});

test('same-id transport duplicates collapse; conflicting copies are resolved by timestamp and flagged', () => {
    const out = run([
        ev({ metric_id: 'dup', revision: 2, value: 1800 }), ev({ metric_id: 'dup', revision: 2, value: 1800 }),
        ev({ metric_id: 'clash', revision: 3, value: 2400 }), ev({ metric_id: 'clash', revision: 3, value: 2600 })
    ], WINDOW);
    const byId = Object.fromEntries(out.rated.map(r => [r.metric_id, r]));
    assert.deepEqual([byId.dup.snapshot_copies, byId.dup.conflicted, byId.dup.native], [2, false, 1800]);
    assert.deepEqual([byId.clash.conflicted, byId.clash.native], [true, 2600], 'latest event_timestamp wins');
    assert.deepEqual([at(out, 'LCP').observations, at(out, 'LCP').conflicted], [2, 1]);
});

test('CLS is divided by 1000 and threshold boundaries are inclusive', () => {
    const cls = [0, 100, 101, 250, 251].map((value, i) => ev({ metric: 'CLS', metric_id: `c${i}`, value }));
    const lcp = [2500, 2500.1, 4000, 4000.1].map((value, i) => ev({ metric_id: `l${i}`, value }));
    const inp = [200, 201, 500, 501].map((value, i) => ev({ metric: 'INP', metric_id: `i${i}`, value }));
    const out = run([...cls, ...lcp, ...inp], WINDOW);
    assert.deepEqual(out.rated.filter(r => r.metric === 'CLS').map(r => [r.native, r.rating]),
        [[0, 'good'], [0.1, 'good'], [0.101, 'needs_improvement'], [0.25, 'needs_improvement'], [0.251, 'poor']]);
    assert.deepEqual(out.rated.filter(r => r.metric === 'LCP').map(r => r.rating), ['good', 'needs_improvement', 'needs_improvement', 'poor']);
    assert.deepEqual(out.rated.filter(r => r.metric === 'INP').map(r => r.rating), ['good', 'needs_improvement', 'needs_improvement', 'poor']);
    assert.equal(rating('FCP', 99999), null, 'FCP and TTFB are not rated');
});

test('zero is kept; missing INP is absent, not zero; counts are per metric', () => {
    const out = run([ev({ metric: 'CLS', metric_id: 'z', value: 0 }), ev({ metric_id: 'l', value: 1200 }),
        ev({ metric: 'INP', metric_id: 'n', value: null })], WINDOW);
    assert.deepEqual([at(out, 'CLS').observations, at(out, 'CLS').p75], [1, 0]);
    assert.deepEqual([at(out, 'INP').observations, at(out, 'INP').p75], [0, null]);
    assert.equal(at(out, 'LCP').observations, 1);
    const summary = code(read('30-cwv-summary.sql'));
    assert.match(summary, /IFNULL\(p\.observations, 0\) AS observations,\n\s+p\.p75,/, 'no observations keeps p75 NULL');
});

test('exact PERCENTILE_CONT over observations and sample flags that keep the numbers', () => {
    const out = run([100, 200, 300, 400].map((value, i) => ev({ metric_id: `p${i}`, value })), { ...WINDOW, minObservations: 5 });
    assert.equal(at(out, 'LCP').p75, 325);
    assert.equal(at(out, 'LCP').meets_min_observations, false);
    for (const name of ['30-cwv-summary', '31-cwv-breakdown', '32-cwv-trend']) {
        const text = code(read(`${name}.sql`));
        assert.match(text, /PERCENTILE_CONT\([\w.]*native_value, 0\.75\) OVER w/, name);
        assert.match(text, />= @min_observations AS meets_min_observations/, name);
        assert.doesNotMatch(text, /AVG\(|APPROX_QUANTILES|MAX\([\w.]*value\)/, `${name}: no averaged or approximate percentiles`);
    }
});

test('navigation dates use the reporting time zone; late revisions count toward the navigation day', () => {
    const lateNight = Date.parse('2026-10-18T22:30:00Z'); // 2026-10-19 01:30 in Athens, exported on 2026-10-18
    const out = run([
        ev({ metric_id: 'tz', nav_start_ms: lateNight, table_day: '2026-10-18' }),
        // 2026-10-25 is the EU DST change: Athens is UTC+2 that evening, so 22:30Z is 00:30 on the 26th.
        ev({ metric_id: 'next', nav_start_ms: Date.parse('2026-10-25T22:30:00Z'), table_day: '2026-10-25' }),
        ev({ metric_id: 'edge', nav_start_ms: Date.parse('2026-10-25T21:30:00Z'), table_day: '2026-10-25' }),
        ev({ metric_id: 'late', nav_start_ms: Date.parse('2026-10-24T09:00:00Z'), table_day: '2026-10-24', revision: 1, value: 1000 }),
        ev({ metric_id: 'late', nav_start_ms: Date.parse('2026-10-24T09:00:00Z'), table_day: '2026-10-26', revision: 2, value: 3000 }),
        ev({ metric_id: 'late', nav_start_ms: Date.parse('2026-10-24T09:00:00Z'), table_day: '2026-10-27', revision: 3, value: 5000 })
    ], WINDOW);
    const byId = Object.fromEntries(out.rated.map(r => [r.metric_id, r]));
    assert.equal(byId.tz.nav_day, '2026-10-19', 'scanned through the one-day margin and dated in Athens');
    assert.equal(byId.next, undefined, 'navigates on 2026-10-26 Athens: outside the cohort');
    assert.equal(byId.edge.nav_day, '2026-10-25', '23:30 Athens after the DST change is still the 25th');
    assert.deepEqual([byId.late.revision, byId.late.native, byId.late.nav_day], [2, 3000, '2026-10-24'],
        'revision exported after the navigation day counts; the immature 2026-10-27 table is not read');
    assert.equal(out.extractionThrough, '2026-10-26');
    assert.equal(run([], { ...WINDOW, tz: 'UTC' }).through, '2026-10-25');
});

test('coverage classes and BFCache observations stay separate', () => {
    const out = run([ev({ metric_id: 'd1', value: 1000 }), ev({ metric_id: 'd2', value: 1000, coverage: 'delayed_consent' }),
        ev({ metric_id: 'b1', value: 5000, coverage: 'bfcache_observed', nav_type: 'back-forward-cache' })], WINDOW);
    assert.deepEqual(['delayed_existing', 'delayed_consent', 'bfcache_observed'].map(c => out.summary[`${c}/LCP`].observations), [1, 1, 1]);
    assert.equal(out.summary['bfcache_observed/LCP'].poor, 1);
    assert.equal(out.rated.find(r => r.metric_id === 'b1').nav_type, 'back-forward-cache');
    for (const name of ['30-cwv-summary', '31-cwv-breakdown', '32-cwv-trend']) {
        assert.match(code(read(`${name}.sql`)), /PARTITION BY [\w., ]*coverage, [\w.]*metric\)/, `${name}: coverage in every partition`);
    }
});

test('only consented, primary-host, official-version, identifiable snapshots count', () => {
    const out = run([
        ev({ metric_id: 'ok' }), ev({ metric_id: 'no', analytics_storage: 'No' }), ev({ metric_id: 'null', analytics_storage: null }),
        ev({ metric_id: 'www', page_location: 'https://www.f1-stories.gr/' }), ev({ metric_id: 'local', page_location: 'http://localhost:8080/' }),
        ev({ metric_id: 'legacy', version: null }), ev({ metric_id: 'v2', version: 'wv7-rum2' }),
        ev({ metric_id: null }), ev({ metric_id: 'r0', revision: 0 }), ev({ metric_id: 'bad', page_group: 'admin' })
    ], WINDOW);
    assert.deepEqual(out.rated.map(r => r.metric_id), ['ok']);
});

test('date bounds: maturity, scan cap and cohort cap are reported', () => {
    const long = run([], { start: '2026-01-01', end: '2026-12-31', asOf: '2026-12-31' });
    assert.deepEqual([long.extractionThrough, long.through, long.truncated], ['2026-04-30', '2026-03-31', true]);
    const base = code(read('rum-base.sql'));
    assert.match(base, /IF\(@as_of_day > DATE_ADD\(CURRENT_DATE\(\), INTERVAL 1 DAY\), ERROR\('as_of_day is in the future'\)/);
    assert.match(base, /AS cohort_truncated/);
    assert.match(base, /AS late_revision_days/);
});

test('reused logic is the rum-pilot report and the I-03 base, verbatim', () => {
    const base = code(read('rum-base.sql'));
    const editorial = code(read('base.sql'));
    assert.equal(rumLatestRevisionSql(), report.match(/^ {2}QUALIFY[\s\S]*?^ {2}\) = 1$/m)[0]);
    assert.ok(render('30-cwv-summary').includes(rumLatestRevisionSql()));
    for (const expression of ["IF(metric = 'CLS', value / 1000.0, value) AS native_value",
        'COALESCE(value.double_value, CAST(value.int_value AS FLOAT64), CAST(value.float_value AS FLOAT64))',
        "('home', 'edition', 'article', 'standings', 'other')", "('mobile_like', 'desktop_like')",
        "('delayed_existing', 'delayed_consent', 'bfcache_observed')", 'value IS NOT NULL AND value >= 0']) {
        assert.ok(report.includes(expression) && base.includes(expression), expression);
    }
    assert.ok(report.includes('DATE(TIMESTAMP_MILLIS(nav_start_ms), @report_timezone)') && base.includes('DATE(TIMESTAMP_MILLIS(nav_start_ms), @report_timezone)'));
    assert.ok(editorial.includes("analytics_storage = 'Yes' AND page_path IS NOT NULL") && base.includes("analytics_storage = 'Yes' AND page_path IS NOT NULL"));
    assert.equal(base.match(/r'\^https:\/\/f1-stories\\\.gr\(\/\[\^\?#\]\*\)'/)[0], editorial.match(/r'\^https:\/\/f1-stories\\\.gr\(\/\[\^\?#\]\*\)'/)[0]);
    assert.ok(base.includes("IF(@as_of_day > DATE_ADD(CURRENT_DATE(), INTERVAL 1 DAY), ERROR('as_of_day is in the future'),") && editorial.includes("IF(@as_of_day > DATE_ADD(CURRENT_DATE(), INTERVAL 1 DAY), ERROR('as_of_day is in the future'),"));
});

test('privacy: no ids, URLs or visitor fields leave the base; only allowlisted parameters are read', () => {
    const base = code(read('rum-base.sql'));
    assert.deepEqual([...new Set([...base.matchAll(/key = '([^']+)'/g)].map(m => m[1]))].sort(), ['measurement_coverage', 'measurement_version',
        'metric_id', 'metric_name', 'metric_rating', 'metric_revision', 'metric_value', 'nav_start_ms', 'nav_type', 'observation_start_ms', 'page_group',
        'page_location', 'viewport_category']);
    assert.doesNotMatch(base, /\b(?:user_pseudo_id|user_id|ga_session_id|ga_session_number|user_properties|page_referrer|page_title|link_text|geo|device|traffic_source)\b/);
    assert.match(base, /^ {4}metric, page_group, viewport, navigation_type, coverage, nav_day, native_value, conflicted, snapshot_copies, library_rating,$/m, 'rated drops metric_id and page_path');
    for (const name of RUM_MODELS) {
        const text = code(read(`${name}.sql`));
        // Presence tests are allowed; the values themselves never appear in a model.
        const scrubbed = text.replace(/metric_id IS NULL/g, '').replace(/page_path IS NOT NULL/g, '');
        assert.doesNotMatch(scrubbed, /\bmetric_id\b|\bpage_path\b|\bevent_timestamp\b/, `${name}: id, path or timestamp exposed`);
    }
});

test('rendered SQL is deterministic, read-only and bounded, and no template hides a placeholder in a comment', () => {
    for (const name of RUM_MODELS) {
        const out = render(name);
        assert.equal(out, render(name), `${name}: deterministic`);
        assert.doesNotMatch(out, /\{\{/, name);
        assert.doesNotMatch(out, /\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE|DROP|ALTER|CREATE|GRANT|EXPORT|LOAD|CALL|DECLARE|SET)\b/, `${name}: write`);
        assert.equal(out.match(/events_\*/g).length, 1, `${name}: one scan`);
        assert.equal(code(out).match(/QUALIFY/g).length, 1, `${name}: one revision rule`);
        assert.match(out, /event_name = 'web_vital'/);
        assert.ok(out.includes('`synthetic-project.analytics_123.events_*`'));
    }
    for (const file of fs.readdirSync(MODELS_DIR).filter(f => f.endsWith('.sql'))) {
        for (const line of read(file).split('\n').filter(l => /--/.test(l))) {
            assert.doesNotMatch(line.slice(line.indexOf('--')), /\{\{/, `${file}: placeholder inside a comment`);
        }
    }
    assert.equal(new Set([...MODELS, ...AUDIENCE_MODELS, ...RUM_MODELS]).size, MODELS.length + AUDIENCE_MODELS.length + RUM_MODELS.length);
});
