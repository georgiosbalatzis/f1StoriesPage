// Synthetic stand-ins for BigQuery in the snapshot tests: invented aggregate rows in the REST result format.
// No real analytics, no network.
import { WINDOW_DAYS } from '../snapshot.mjs';

const addDays = (day, days) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const TYPES = { p75: 'FLOAT', good_share: 'FLOAT', meets_min_events: 'BOOLEAN', meets_min_observations: 'BOOLEAN',
    core_web_vital: 'BOOLEAN', cohort_truncated: 'BOOLEAN', category: 'STRING', coverage: 'STRING', metric: 'STRING', stage: 'STRING' };
const typeOf = name => TYPES[name] || (/_day$|^extraction_through$/.test(name) ? 'DATE' : 'INTEGER');

export function syntheticRows(window) {
    const base = { from_day: window.start, through_day: window.end };
    const rum = { ...base, requested_through_day: window.end, extraction_through: window.end, cohort_truncated: false, late_revision_days: 0 };
    const cwv = [];
    for (const coverage of ['delayed_existing', 'delayed_consent', 'bfcache_observed']) {
        for (const [metric, p75, observations] of [['LCP', 2140, 41], ['INP', 96, 12], ['CLS', 0.042, 38], ['FCP', 1510, 44], ['TTFB', 420, 44]]) {
            const scaled = coverage === 'delayed_existing' ? observations : Math.floor(observations / 4);
            const core = ['LCP', 'INP', 'CLS'].includes(metric);
            cwv.push({ ...rum, coverage, metric, core_web_vital: core, observations: scaled, p75: scaled ? p75 : null,
                good: core ? scaled - 2 : null, needs_improvement: core ? 1 : null, poor: core ? 1 : null,
                good_share: core && scaled ? (scaled - 2) / scaled : null, conflicted_observations: 0, meets_min_observations: scaled >= 30 });
        }
    }
    return {
        '11-category-pageviews': [['Ανάλυση', 412, 18, 120, true], ['Ιστορία <b>', 96, 7, 80, true], ['(unmapped)', 4, 0, 0, false]]
            .map(([category, page_view_events, articles_with_events, catalog_articles, meets_min_events]) =>
                ({ ...base, category, page_view_events, articles_with_events, catalog_articles, meets_min_events })),
        '20-daily-activity': Array.from({ length: WINDOW_DAYS }, (_, i) => {
            const views = 12 + (i * 37) % 61;
            return { ...base, event_day: addDays(window.start, i), page_view_events: views, session_start_events: Math.round(views / 3),
                first_visit_events: Math.round(views / 5), meets_min_events: views >= 30 };
        }),
        '30-cwv-summary': cwv,
        '33-rum-coverage': [['scan_version', 'wv6.2.3-rum1', 260], ['scan_consent', 'Yes', 240], ['scan_consent', '(null)', 20],
            ['observations', 'resolved', 171], ['observations', 'final_snapshot_conflicting', 1], ['observation_validity', 'valid', 171],
            ['library_rating', 'agrees', 120]].map(([stage, category, count]) => ({ ...rum, stage, category, count }))
    };
}

// One model's rows as a completed jobs.getQueryResults response.
export function queryResult(rows) {
    const fields = Object.keys(rows[0]).map(name => ({ name, type: typeOf(name) }));
    return { jobComplete: true, totalRows: String(rows.length), schema: { fields },
        rows: rows.map(row => ({ f: fields.map(field => ({ v: row[field.name] === null ? null : String(row[field.name]) })) })) };
}

// A model-level client double for refresh(): records every call; options inject each failure mode.
export function fakeClient(window, { processed = '2400000', tables = 1, missingDay = null, failRun = null, mutate = null } = {}) {
    const rows = syntheticRows(window);
    const calls = { tables: [], dryRuns: [], runs: [] };
    return {
        calls,
        async table(day) {
            calls.tables.push(day);
            if (day === missingDay) throw new Error(`daily export table events_${day.replaceAll('-', '')} is missing or unreadable: HTTP 404`);
        },
        async dryRun(sql, parameters) {
            calls.dryRuns.push({ sql, parameters });
            return { statistics: { totalBytesProcessed: processed, query: { totalBytesProcessed: processed,
                referencedTables: Array.from({ length: tables }, (_, i) => ({ tableId: `events_${i}` })) } } };
        },
        async run(jobId, sql, parameters) {
            calls.runs.push({ jobId, parameters });
            const model = Object.keys(rows).find(name => jobId.includes(`_${name.replaceAll('-', '_')}_`));
            if (failRun === calls.runs.length) throw new Error(`query ${jobId} failed: synthetic failure`);
            const result = queryResult(rows[model]);
            return { billed: 10485760, result: mutate ? mutate(model, result) : result };
        }
    };
}
