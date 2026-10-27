// Synthetic stand-ins for BigQuery in the snapshot tests: invented aggregate rows in the REST result format.
// No real analytics, no network.
import { modelWindow, windowDays } from '../snapshot.mjs';

const addDays = (day, days) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const TYPES = { p75: 'FLOAT', good_share: 'FLOAT', meets_min_events: 'BOOLEAN', meets_min_observations: 'BOOLEAN',
    core_web_vital: 'BOOLEAN', cohort_truncated: 'BOOLEAN', category: 'STRING', coverage: 'STRING', metric: 'STRING', stage: 'STRING',
    article_id: 'STRING', title: 'STRING', primary_category: 'STRING', author: 'STRING',
    attribution_scope: 'STRING', channel_class: 'STRING', medium_class: 'STRING', source_family: 'STRING', event_name: 'STRING',
    destination_article_id: 'STRING', source_surface: 'STRING', link_section: 'STRING', source_section: 'STRING', destination_section: 'STRING' };
const typeOf = name => TYPES[name] || (/_day$|^extraction_through$/.test(name) ? 'DATE' : 'INTEGER');

export function syntheticRows(window) {
    const base = { from_day: window.start, through_day: window.end };
    const rum = { ...base, requested_through_day: window.end, extraction_through: window.end, cohort_truncated: false, late_revision_days: 0 };
    const acquisition = modelWindow('26-acquisition-session', window);
    const acquisitionBase = { from_day: acquisition.start, through_day: acquisition.end };
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
        '10-article-pageviews': [
            { article_id: 'a-fast', title: 'Ταχύτερος γύρος', published_day: '2026-10-21', primary_category: 'Ανάλυση', author: 'Συντακτική ομάδα', page_view_events: 42, via_retired_url_events: 1, days_with_events: 4, unmapped_keys: 0, meets_min_events: true },
            { article_id: 'a-slow', title: 'Ειδήσεις <script>alert(1)</script>', published_day: '2026-10-19', primary_category: 'Ιστορία', author: 'Συντακτική ομάδα', page_view_events: 8, via_retired_url_events: 0, days_with_events: 2, unmapped_keys: 0, meets_min_events: false },
            { article_id: '(unmapped)', title: null, published_day: null, primary_category: null, author: null, page_view_events: 2, via_retired_url_events: 0, days_with_events: 1, unmapped_keys: 1, meets_min_events: false }
        ].map(row => ({ ...base, ...row })),
        // I-06C3: one destination over the minimum only once its rows are summed; a hostile title; an unmapped key.
        '13-article-discovery': [
            ['a-fast', 'Ταχύτερος γύρος', 'Ανάλυση', 'home', 'article_link', 34, true],
            ['a-fast', 'Ταχύτερος γύρος', 'Ανάλυση', 'article', 'article_link', 9, false],
            ['a-slow', 'Ειδήσεις <img src=x onerror=alert(1)>', 'Ιστορία', 'edition', 'navigation', 5, false],
            ['a-slow', 'Ειδήσεις <img src=x onerror=alert(1)>', 'Ιστορία', 'entity_hub', 'article_link', 3, false],
            ['(unmapped)', null, null, 'other', 'page', 2, false],
            ['a-fast', 'Ταχύτερος γύρος', 'Ανάλυση', 'authors', '(none)', 1, false]
        ].map(([destination_article_id, title, primary_category, source_surface, link_section, click_events, meets_min_events]) =>
            ({ ...base, destination_article_id, title, primary_category, source_surface, link_section, click_events, meets_min_events })),
        '28-internal-navigation': [
            ['home', 'article', 'article_link', 34], ['article', 'article', 'article_link', 9], ['edition', 'article', 'navigation', 5],
            ['entity_hub', 'article', 'article_link', 3], ['home', 'standings', 'navigation', 4], ['article', 'edition', 'footer', 2],
            ['other', 'article', 'page', 2], ['home', 'missing', 'other', 1]
        ].map(([source_section, destination_section, link_section, click_events]) =>
            ({ ...base, source_section, destination_section, link_section, click_events, meets_min_events: click_events >= 30 })),
        '11-category-pageviews': [['Ανάλυση', 412, 18, 120, true], ['Ιστορία <b>', 96, 7, 80, true], ['(unmapped)', 4, 0, 0, false]]
            .map(([category, page_view_events, articles_with_events, catalog_articles, meets_min_events]) =>
                ({ ...base, category, page_view_events, articles_with_events, catalog_articles, meets_min_events })),
        '20-daily-activity': Array.from({ length: windowDays(window) }, (_, i) => {
            const views = 12 + (i * 37) % 61;
            return { ...base, event_day: addDays(window.start, i), page_view_events: views, session_start_events: Math.round(views / 3),
                first_visit_events: Math.round(views / 5), meets_min_events: views >= 30 };
        }),
        '26-acquisition-session': [
            ['organic_search', 'organic', 'google', 33, 62, true],
            ['direct', 'none', 'direct', 8, 17, false],
            ['referral', 'referral', 'other_source', 3, 4, false],
            ['unattributed', 'unknown', 'unattributed', 2, 3, false]
        ].map(([channel_class, medium_class, source_family, session_start_events, page_view_events, meets_min_events]) =>
            ({ ...acquisitionBase, attribution_scope: 'session_last_click', channel_class, medium_class, source_family,
                session_start_events, page_view_events, meets_min_events })),
        '29-audience-coverage': ['page_view', 'session_start'].map(event_name => ({
            ...acquisitionBase, event_name, events_in_tables: 105, consented_events: 100,
            primary_host_events: 100, site_events: 95, device_unknown_or_other: 0,
            country_unknown: 0, first_user_source_unattributed_or_other: 6, collected_source_unattributed: 12,
            session_source_unattributed_or_other: 2, session_channel_unattributed_or_other: 2,
            enum_parameter_other: 0
        })),
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
export function fakeClient(window, { processed = '2400000', tables = 1, billed = 10485760, missingDay = null, failRun = null, mutate = null } = {}) {
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
            return { billed, result: mutate ? mutate(model, result) : result };
        }
    };
}
