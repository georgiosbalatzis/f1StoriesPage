#!/usr/bin/env node
// validate-snapshot.mjs — I-06C4 offline data-quality and reconciliation checks for a decrypted snapshot payload
// (docs/intelligence/data-quality.md). Pure functions over the aggregate rows already in memory: no BigQuery, no
// network, no file is written. Every cross-model comparison first proves that both sides count the same unit over
// the same window and a population that makes the relation valid (POPULATIONS, derived from the model SQL); when it
// cannot, the check is NOT_VERIFIED, never PASS.
//
//   DASHBOARD_SNAPSHOT_KEY=… is read from the environment, never from an argument (it would land in shell history):
//   node scripts/intelligence/validate-snapshot.mjs [envelope] [--redact] [--json]
// Prints to the terminal only. Under GitHub Actions it always redacts counts: decrypted analytics never reach logs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMapping, readInputs } from './editorial-model.mjs';
import {
    DISCOVERY_MAX_AGE_DAYS, DISCOVERY_MODELS, MIN_SAMPLE, PAYLOAD_FORMAT, REPORT_TIMEZONE, ROTATED_FOR_DISCOVERY, SNAPSHOT_MODELS, SNAPSHOT_PATH,
    MATURITY_DAYS, modelWindow, openSnapshot, parseKey, propertyDay, windowDays, windowFor
} from './snapshot.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const OUTCOMES = ['FAIL', 'WARNING', 'NOT_VERIFIED', 'PASS'];
export const SEVERITIES = ['critical', 'high', 'medium', 'info'];
export const MAX_RUN_PER_DAY = 7;
export const STALE_HOURS = 48; // the dashboard's own stale rule (dashboard.js STALE_MS)
export const ZERO_RUN_DAYS = 3; // consecutive zero-page-view days that suggest a collection gap rather than low traffic
export const RUM_REFERENCE_FIRST_AS_OF = '2026-11-19'; // first mature 28-day cohort for perf/rum-pilot/report.sql

// Populations as the SQL defines them. `editorial` (base.sql) is `site` (audience-base.sql) restricted to events with
// an article key: same consent, host, maturity and tables, so editorial page views and clicks are a subset of site's.
export const POPULATIONS = {
    editorial: 'consented, https://f1-stories.gr, mature, with an article key (base.sql `editorial`)',
    site: 'consented, https://f1-stories.gr, mature (audience-base.sql `site`)',
    events: 'all window events of the audience-base event list, before the consent and host filters (29)',
    rum: 'deduplicated wv6.2.3-rum1 observations in the navigation cohort (rum-base.sql `rated`)'
};
export const SUBSET_OF = { editorial: ['site'] };

// I-01 / I-04 enumerations (tests check each set against the SQL that produces it).
export const PATH_CLASSES = ['missing', 'home', 'article', 'entity_hub', 'edition', 'standings', 'authors', 'legal', 'tool_telemetry',
    'tool_telemetry_stub', 'tool_ghostcar', 'tool_tyres', 'tool_betcast', 'author_tool', 'other'];
export const SOURCE_SURFACES = ['home', 'article', 'entity_hub', 'edition', 'authors', 'standings', 'other'];
export const LINK_SECTIONS = ['article_share', 'sponsor', 'social', 'cta', 'article_link', 'navigation', 'footer', 'page'];
export const CHANNEL_CLASSES = ['unattributed', 'direct_or_unknown', 'unassigned', 'organic_search_reported', 'social', 'organic_video_reported',
    'organic_shopping_reported', 'referral', 'email', 'paid', 'other_reported', 'other'];
export const MEDIUM_CLASSES = ['unattributed', 'direct_or_unknown', 'not_set', 'data_deleted', 'organic_search_reported', 'referral', 'social',
    'email', 'paid', 'other_tagged'];
export const SOURCE_FAMILIES = ['unattributed', 'direct_or_unknown', 'not_set', 'data_deleted', 'ai_assistant', 'self_referral', 'legacy_site',
    'google', 'bing', 'duckduckgo', 'other_search_engine', 'facebook', 'instagram', 'threads', 'x', 'reddit', 'linkedin', 'youtube', 'whatsapp',
    'telegram', 'tiktok', 'other_source'];
export const AUDIENCE_EVENTS = ['page_view', 'session_start', 'first_visit', 'user_engagement', 'article_engaged', 'article_share',
    'internal_page_click', 'outbound_click', 'journal_search'];
export const COVERAGES = ['delayed_existing', 'delayed_consent', 'bfcache_observed'];
export const RUM_METRICS = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'];
// Rating limits of rum-base.sql `rated` (CLS in native units).
export const CWV_LIMITS = { LCP: [2500, 4000], INP: [200, 500], CLS: [0.1, 0.25] };
export const RUM_STAGES = {
    scan_version: ['wv6.2.3-rum1', '(none: legacy)', 'other'],
    scan_consent: null, // GA4's analytics_storage value, or '(null)'
    scan_host: ['primary', 'other_or_missing'],
    scan_identity: ['missing_metric_id', 'invalid_revision', 'identified', 'revision_not_integer'],
    eligible_snapshots: ['single_copy', 'duplicate_copy', 'conflicting_copy'],
    observations: ['resolved', 'revised_after_first_snapshot', 'final_snapshot_duplicated', 'final_snapshot_conflicting'],
    observation_validity: ['valid', 'invalid_metric_name', 'missing_or_negative_value', 'missing_nav_start', 'invalid_page_group',
        'invalid_viewport', 'invalid_coverage'],
    observation_fields: ['missing_observation_start', 'nav_type_missing_or_unlisted'],
    cohort_placement: ['before_cohort', 'in_cohort', 'after_cohort'],
    coverage_distribution: COVERAGES,
    library_rating: ['agrees', 'disagrees_or_missing']
};

// 13's raw link_section through 28's link_section_class (audience-functions.sql), so the two can be compared.
export function linkSectionClass(value) {
    if (value === null || value === undefined || String(value).trim() === '' || value === '(none)') return '(none)';
    const v = String(value).trim().toLowerCase();
    return LINK_SECTIONS.includes(v) ? v : 'other';
}

// 28's classify_path classes onto 13's source_surface: every class 13 does not name falls in its 'other'.
export const surfaceOf = section => (SOURCE_SURFACES.includes(section) ? section : 'other');

// ---- Quality contract: one entry per snapshot model ----
// Column kinds: count (safe integer ≥ 0), ncount (count or null), bool, string, nstring, day, nday, nnumber (≥ 0 or null),
// share (0..1 or null). `positive` is the count every grouped row has at least 1 of (a GROUP BY never yields an empty group).
const C = 'count', NC = 'ncount', B = 'bool', S = 'string', NS = 'nstring', D = 'day', ND = 'nday';
export const QUALITY_CONTRACT = {
    '10-article-pageviews': {
        metric: 'Article page views', unit: 'page_view events', population: 'editorial', window: 'primary', cadence: 'daily',
        grain: ['article_id'], positive: 'page_view_events', sample: 'page_view_events',
        columns: { article_id: S, title: NS, published_day: ND, primary_category: NS, author: NS, page_view_events: C, via_retired_url_events: C,
            days_with_events: C, unmapped_keys: C, meets_min_events: B },
        missing: "title, published_day, primary_category and author are NULL only on the '(unmapped)' row or for catalogue gaps"
    },
    '11-category-pageviews': {
        metric: 'Article page views by primary category', unit: 'page_view events', population: 'editorial', window: 'primary', cadence: 'daily',
        grain: ['category'], sample: 'page_view_events',
        columns: { category: S, page_view_events: C, articles_with_events: C, catalog_articles: C, meets_min_events: B },
        missing: "none; '(unmapped)' and '(unknown)' are explicit categories; catalogue-only categories read 0"
    },
    '13-article-discovery': {
        metric: 'Internal clicks to articles', unit: 'internal_page_click events', population: 'editorial', window: 'primary', cadence: 'weekly',
        grain: ['destination_article_id', 'source_surface', 'link_section'], positive: 'click_events', sample: 'click_events',
        columns: { destination_article_id: S, title: NS, primary_category: NS, source_surface: S, link_section: S, click_events: C, meets_min_events: B },
        missing: "title and primary_category NULL on '(unmapped)'; link_section '(none)' when the parameter is absent"
    },
    '20-daily-activity': {
        metric: 'Daily page_view, session_start and first_visit events', unit: 'events per day', population: 'site', window: 'primary', cadence: 'daily',
        grain: ['event_day'], sample: 'page_view_events',
        columns: { event_day: D, page_view_events: C, session_start_events: C, first_visit_events: C, meets_min_events: B },
        missing: 'none: every window day has a row; 0 means no kept event in an existing, mature daily table'
    },
    '26-acquisition-session': {
        metric: 'Events by GA4 session last-click attribution', unit: 'session_start and page_view events', population: 'site', window: 'acquisition',
        cadence: 'daily', grain: ['channel_class', 'medium_class', 'source_family'], sample: 'session_start_events',
        columns: { attribution_scope: S, channel_class: S, medium_class: S, source_family: S, session_start_events: C, page_view_events: C, meets_min_events: B },
        missing: "none; NULL attribution is the explicit class 'unattributed', never Direct"
    },
    '28-internal-navigation': {
        metric: 'Internal clicks by source and destination section', unit: 'internal_page_click events', population: 'site', window: 'primary',
        cadence: 'weekly', grain: ['source_section', 'destination_section', 'link_section'], positive: 'click_events', sample: 'click_events',
        columns: { source_section: S, destination_section: S, link_section: S, click_events: C, meets_min_events: B },
        missing: "destination_section 'missing' when link_path is absent; link_section '(none)' when absent"
    },
    '29-audience-coverage': {
        metric: 'Filter stages and attribution gaps per event name', unit: 'events', population: 'events', window: 'acquisition', cadence: 'daily',
        grain: ['event_name'], positive: 'events_in_tables',
        columns: { event_name: S, events_in_tables: C, consented_events: C, primary_host_events: C, site_events: C,
            session_source_unattributed_or_other: C, session_channel_unattributed_or_other: C },
        missing: 'an event name without a row had no event in the window tables'
    },
    '30-cwv-summary': {
        metric: 'Core Web Vitals p75 and ratings per coverage class', unit: 'observations; p75 in ms (CLS unitless)', population: 'rum',
        window: 'primary', cadence: 'daily (carried on discovery days)', grain: ['coverage', 'metric'], sampleObservations: 'observations',
        columns: { cohort_truncated: B, coverage: S, metric: S, core_web_vital: B, observations: C, p75: 'nnumber', good: NC, needs_improvement: NC,
            poor: NC, good_share: 'share', meets_min_observations: B },
        missing: 'p75 and good_share are NULL exactly when observations = 0; ratings are NULL for FCP/TTFB'
    },
    '33-rum-coverage': {
        metric: 'Observation pipeline stages', unit: "events ('scan' stages), snapshots ('eligible'), observations (other stages)", population: 'rum',
        window: 'primary', cadence: 'daily (carried on discovery days)', grain: ['stage', 'category'], positive: 'count',
        columns: { cohort_truncated: B, stage: S, category: S, count: C },
        missing: 'a stage/category without a row counted 0'
    }
};

// ---- Checks: id → what it establishes, where a failure points, and what to do ----
export const CHECKS = {
    'payload.format': { title: 'Payload format and version', area: 'integrity', action: 'Do not use this snapshot; republish from a known refresh.' },
    'payload.header': { title: 'Payload agrees with the authenticated header', area: 'integrity', action: 'Treat as tampered or mis-sealed; do not use it.' },
    'payload.window': { title: 'Window is the mature window of its as_of day', area: 'integrity', action: 'Do not use; the window rule in snapshot.mjs was bypassed.' },
    'payload.as-of': { title: 'as_of is the property-time-zone day of generation', area: 'integrity', action: 'Check REPORT_TIMEZONE and the runner clock; regenerate.' },
    'payload.thresholds': { title: 'Sample thresholds are min_events = min_observations = 30', area: 'presentation', action: 'Restore MIN_SAMPLE = 30 in snapshot.mjs.' },
    'payload.models': { title: 'Only allowlisted models; the I-06B base present', area: 'integrity', action: 'Do not use; check SNAPSHOT_MODELS and the payload source.' },
    'schema.columns': { title: 'Every row has the contract columns with valid types', area: 'integrity', action: 'Model SQL or payload changed: compare with QUALITY_CONTRACT before use.' },
    'schema.grain': { title: 'One row per grain key (no duplicate identities)', area: 'integrity', action: 'Duplicate keys double count: inspect the model GROUP BY and alias map.' },
    'schema.positive': { title: 'Grouped rows are never empty groups', area: 'integrity', action: 'An empty group cannot come from the model SQL: inspect the payload.' },
    'schema.enums': { title: 'Classes are the values the SQL can produce', area: 'sql_classification', action: 'A new value means the SQL allowlists changed or the payload is corrupt: update both together.' },
    'schema.flags': { title: 'Sample flags and derived booleans match their counts', area: 'presentation', action: 'Flags drive the dashboard\'s small-sample marks: fix the model or payload.' },
    'window.rows': { title: 'Every row covers exactly its model\'s window', area: 'scheduling', action: 'Rows from another window must never be shown: regenerate the snapshot.' },
    'window.labels': { title: 'Window labels match the rotation and acquisition rules', area: 'scheduling', action: 'A carried or shortened model is labelled with the wrong dates: fix modelWindows.' },
    'window.carried': { title: 'Carried models keep their own as_of day and window', area: 'scheduling', action: 'Carried data must never be presented as today\'s: fix schedule()/modelWindows.' },
    'window.rotation': { title: 'Weekly rotation: pairs move together, at most seven models run', area: 'scheduling', action: 'The cost contract was broken: check schedule() before the next refresh.' },
    'freshness.snapshot': { title: 'Snapshot freshness against the daily schedule', area: 'scheduling', action: 'Check the Intelligence Snapshot workflow runs; a late run alone is harmless.' },
    'freshness.discovery': { title: 'Weekly discovery age', area: 'scheduling', action: 'A discovery day needs yesterday\'s RUM pair: check why the rotation did not run.' },
    'continuity.days': { title: 'Daily activity has one row per mature day', area: 'integrity', action: 'A missing or duplicated day breaks every daily figure: regenerate.' },
    'continuity.zero-days': { title: 'Zero-page-view days', area: 'source_coverage', action: 'Several consecutive zero days point at tag, consent or export loss: check GA4 realtime and sql/01 table metadata.' },
    'continuity.sessions-without-views': { title: 'Days with sessions but no page views', area: 'instrumentation', action: 'session_start without page_view suggests a tag configuration change: inspect sql/02.' },
    'articles.totals': { title: 'Article (10) and category (11) page views reconcile', area: 'reconciliation', action: 'Same population and window: a mismatch is an SQL or payload defect.' },
    'articles.by-category': { title: 'Each category equals the sum of its articles', area: 'reconciliation', action: 'Category mapping drifted between 10 and 11: compare the article lookup.' },
    'articles.within-site': { title: 'Article page views do not exceed site page views', area: 'reconciliation', action: 'editorial ⊂ site in the SQL: exceeding it means the filters diverged.' },
    'articles.days': { title: 'Article active days fit the site\'s active days', area: 'reconciliation', action: 'An article cannot be viewed on a day with no site page view: inspect 10 and 20.' },
    'articles.rows': { title: 'Article rows are internally consistent', area: 'integrity', action: 'Retired or unmapped counts out of range: inspect the alias map and 10.' },
    'articles.identity': { title: 'Article ids are canonical (no retired alias as an identity)', area: 'integrity', action: 'Retired ids must resolve to their live target: fix retired-articles.json.' },
    'articles.unmapped': { title: 'Unmapped article views are explicit and explained', area: 'source_coverage', action: 'Map each unmapped URL in retired-articles.json or the index.' },
    'articles.metadata': { title: 'Viewed articles have catalogue metadata', area: 'source_coverage', action: 'Complete the article index (title, date, category).' },
    'categories.catalogue': { title: 'Categories agree with the catalogue', area: 'source_coverage', action: 'catalog_articles is the render-time index, not history: check dates and categories.' },
    'acquisition.sessions': { title: 'Session attribution (26) reconciles with daily activity (20) over the same 7 days', area: 'reconciliation', action: 'Same site population: a mismatch is an SQL or payload defect.' },
    'acquisition.coverage': { title: 'Coverage (29) kept events equal attribution (26) totals', area: 'reconciliation', action: '29 repeats the site filter: a mismatch means the filters diverged.' },
    'acquisition.gaps-reconcile': { title: 'Unattributed/other counts in 29 match 26\'s classes', area: 'reconciliation', action: 'The class functions diverged between 26 and 29.' },
    'acquisition.stages': { title: 'Filter stages never grow', area: 'integrity', action: 'Kept events above consented or on-host events cannot happen: inspect 29.' },
    'acquisition.filters': { title: 'Events removed by the consent and host filters', area: 'source_coverage', action: 'Non-consented or off-host events reached GA4: see validation.md tracking recommendation 1.' },
    'acquisition.attribution': { title: 'Unattributed or unclassified session attribution', area: 'source_coverage', action: 'Reported as its own class, never as Direct: tag campaign links; do not compare with Search Console.' },
    'discovery.within-navigation': { title: 'Article clicks (13) do not exceed internal clicks (28)', area: 'reconciliation', action: 'editorial ⊂ site in the SQL: exceeding it means the filters diverged.' },
    'discovery.by-section': { title: 'Article clicks per link section fit internal clicks', area: 'reconciliation', action: 'link_section classes diverged between 13 and 28.' },
    'discovery.by-surface': { title: 'Article clicks per source surface fit internal clicks', area: 'reconciliation', action: 'Path classes diverged between 13 and 28.' },
    'discovery.destinations': { title: 'Article clicks fit clicks whose link_path is an article', area: 'instrumentation', action: 'article_id and link_path disagree in analytics.js: inspect getArticleIdFromUrl.' },
    'discovery.fields': { title: 'Click events carry link_path and link_section', area: 'instrumentation', action: 'Missing parameters: check analytics.js trackInternalPageClick and sql/02.' },
    'discovery.classes': { title: 'Click classes are recognised', area: 'sql_classification', action: 'Add the new section or path class to analytics.js classifyLink and the SQL allowlist together.' },
    'discovery.unmapped': { title: 'Clicks to unmapped articles', area: 'source_coverage', action: 'Map each unmapped destination in retired-articles.json or the index.' },
    'rum.grid': { title: 'Every coverage × metric row present, classes never pooled', area: 'integrity', action: 'A missing cell would read as zero: regenerate.' },
    'rum.ratings': { title: 'good + needs_improvement + poor = observations', area: 'reconciliation', action: 'Rating counts do not add up: inspect 30.' },
    'rum.p75': { title: 'p75 agrees with the rating counts and the observation count', area: 'reconciliation', action: 'p75 contradicts the ratings: unit or threshold defect in 30.' },
    'rum.coverage': { title: 'Observations per coverage class agree between 30 and 33', area: 'reconciliation', action: '30 and 33 read the same cohort: a mismatch is an SQL or payload defect.' },
    'rum.pipeline': { title: 'Observation pipeline stages are consistent', area: 'reconciliation', action: 'Stage totals do not add up: inspect 33.' },
    'rum.integrity': { title: 'Duplicate, conflicting and invalid observations', area: 'instrumentation', action: 'Investigate the collector and sql/03 for the affected version.' },
    'rum.library': { title: 'Ratings agree with the web-vitals library', area: 'instrumentation', action: 'Threshold or unit drift between the collector and rum-base.sql.' },
    'sample.sizes': { title: 'Rows below the sample threshold', area: 'sample', action: 'None: flagged rows are shown and never compared as stable.' },
    'external.ga4-stream': { title: 'GA4 property 485678890 streams G-X68J6MQKSM', area: 'external', action: 'Owner: confirm in GA4 Admin → Data streams.' },
    'external.parameters': { title: 'Parameter completeness and types in the raw export', area: 'external', action: 'Owner: dry-run, then run sql/02 as written (see the validation plan).' },
    'external.export-completeness': { title: 'Each daily table is complete, not only present', area: 'external', action: 'Owner: run sql/01 (table metadata, no event scan).' },
    'external.consent-population': { title: 'Readers who never consent', area: 'external', action: 'None possible: every figure covers consenting visitors only (metrics-contract.md).' },
    'external.rum-reference': { title: 'RUM agrees with the 28-day perf/rum-pilot reference', area: 'external', action: 'Owner: run the 28-day report.sql comparison once eligible.' }
};

// ---- helpers ----
const addDays = (day, days) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const dayDiff = (later, earlier) => Math.round((Date.parse(later) - Date.parse(earlier)) / 86400000);
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const isDay = v => typeof v === 'string' && ISO_DAY.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const isCount = v => Number.isSafeInteger(v) && v >= 0;
const sum = (rows, key) => rows.reduce((total, row) => total + (row[key] || 0), 0);
const sumWhere = (rows, key, test) => sum(rows.filter(test), key);
const group = (rows, keyOf, valueOf) => rows.reduce((map, row) => map.set(keyOf(row), (map.get(keyOf(row)) || 0) + valueOf(row)), new Map());
const sameScope = (a, b) => a.start === b.start && a.end === b.end && a.asOf === b.asOf;
const scopeText = scope => `${scope.start} → ${scope.end} (as_of ${scope.asOf})`;
const list = (items, max = 5) => items.slice(0, max).join('; ') + (items.length > max ? `; +${items.length - max} more` : '');

const KIND_OK = {
    count: isCount, ncount: v => v === null || isCount(v), bool: v => typeof v === 'boolean', string: v => typeof v === 'string' && v !== '',
    nstring: v => v === null || typeof v === 'string', day: isDay, nday: v => v === null || isDay(v),
    nnumber: v => v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0),
    share: v => v === null || (typeof v === 'number' && v >= 0 && v <= 1)
};

// Compares two aggregates only when unit, window and population make the relation valid. relation: 'equal' needs
// the same population; 'subset' needs left's population declared a subset of right's (SUBSET_OF).
export function reconcile({ relation, left, right }) {
    if (left.unit !== right.unit) return { outcome: 'NOT_VERIFIED', reason: `units differ (${left.unit} vs ${right.unit})` };
    if (!sameScope(left.scope, right.scope)) return { outcome: 'NOT_VERIFIED', reason: `windows differ (${scopeText(left.scope)} vs ${scopeText(right.scope)})` };
    const populationOk = relation === 'equal' ? left.population === right.population
        : relation === 'subset' ? left.population === right.population || (SUBSET_OF[left.population] || []).includes(right.population) : false;
    if (!populationOk) return { outcome: 'NOT_VERIFIED', reason: `populations are not comparable as ${relation} (${left.population} vs ${right.population})` };
    const ok = relation === 'equal' ? left.value === right.value : left.value <= right.value;
    return { outcome: ok ? 'PASS' : 'FAIL', reason: `${left.label} ${left.value} ${ok ? (relation === 'equal' ? '=' : '≤') : (relation === 'equal' ? '≠' : '>')} ${right.label} ${right.value}` };
}

// Where p75 must lie, from the rating counts: PERCENTILE_CONT interpolates between sorted positions ⌊k⌋ and ⌈k⌉,
// k = 0.75 (n − 1); when both positions fall in one rating band, p75 is bounded by that band's limits.
export function p75Violations(row) {
    const limits = CWV_LIMITS[row.metric];
    const n = row.observations;
    if (!limits || !n || row.p75 === null) return [];
    const k = (n - 1) * 0.75, lo = Math.floor(k), hi = Math.ceil(k);
    const good = row.good, upToMid = row.good + row.needs_improvement;
    const out = [];
    if (hi < good && row.p75 > limits[0] + 1e-9) out.push(`p75 ${row.p75} above the good limit ${limits[0]} with ${good}/${n} good`);
    if (lo >= good && row.p75 <= limits[0]) out.push(`p75 ${row.p75} within the good limit ${limits[0]} with only ${good}/${n} good`);
    if (hi < upToMid && row.p75 > limits[1] + 1e-9) out.push(`p75 ${row.p75} above the poor limit ${limits[1]} with ${row.poor}/${n} poor`);
    if (lo >= upToMid && row.p75 <= limits[1]) out.push(`p75 ${row.p75} within the poor limit ${limits[1]} with ${row.poor}/${n} poor`);
    return out;
}

// ---- the validator ----
// header: the authenticated envelope header; payload: the decrypted payload. now (Date) enables freshness checks;
// catalogue ({ articles, aliases } from editorial-model.mjs buildMapping) enables identity checks against the index.
export function validateSnapshot({ header, payload, now = null, catalogue = null }) {
    const diagnostics = [];
    const add = (id, outcome, severity, detail, extra = {}) => {
        if (!CHECKS[id]) throw new Error(`unknown check ${id}`);
        if (!OUTCOMES.includes(outcome) || !SEVERITIES.includes(severity)) throw new Error(`bad outcome for ${id}`);
        diagnostics.push({ id, ...CHECKS[id], outcome, severity, detail, ...extra });
    };
    const done = () => summarize(diagnostics, header);

    // Integrity first: nothing else is meaningful on a payload that is not what the header says.
    if (!payload || payload.format !== PAYLOAD_FORMAT || payload.v !== 1 || !payload.models || typeof payload.models !== 'object') {
        add('payload.format', 'FAIL', 'critical', 'not an f1s-dashboard-snapshot-payload v1 with models');
        return done();
    }
    add('payload.format', 'PASS', 'info', `format ${payload.format} v${payload.v}`);
    const W = { asOf: header?.asOf, start: header?.start, end: header?.end };
    const mismatched = [
        payload.generatedAt !== header?.generatedAt && 'generatedAt',
        (payload.window?.asOf !== W.asOf || payload.window?.start !== W.start || payload.window?.end !== W.end) && 'window',
        payload.window?.timezone !== REPORT_TIMEZONE && 'timezone'
    ].filter(Boolean);
    add('payload.header', mismatched.length ? 'FAIL' : 'PASS', mismatched.length ? 'critical' : 'info',
        mismatched.length ? `payload differs from the header in ${mismatched.join(', ')}` : `window ${W.start} → ${W.end}, as_of ${W.asOf}, ${REPORT_TIMEZONE}`);
    if (mismatched.length) return done();
    const windowOk = [W.asOf, W.start, W.end].every(isDay) && W.end === addDays(W.asOf, -MATURITY_DAYS) && W.start === windowFor(W.asOf).start && W.start <= W.end;
    add('payload.window', windowOk ? 'PASS' : 'FAIL', windowOk ? 'info' : 'critical',
        windowOk ? `${windowDays(W)} mature day(s) through as_of − ${MATURITY_DAYS}` : `${W.start} → ${W.end} is not the mature window of as_of ${W.asOf}`);
    if (!windowOk) return done();
    const generatedDay = typeof payload.generatedAt === 'string' && !Number.isNaN(Date.parse(payload.generatedAt)) ? propertyDay(new Date(payload.generatedAt)) : null;
    add('payload.as-of', generatedDay === W.asOf ? 'PASS' : 'FAIL', generatedDay === W.asOf ? 'info' : 'critical',
        generatedDay === W.asOf ? `generated on ${generatedDay} in ${REPORT_TIMEZONE}` : `generated on ${generatedDay} in ${REPORT_TIMEZONE}, but as_of is ${W.asOf}`);
    const thresholdsOk = payload.minEvents === MIN_SAMPLE && payload.minObservations === MIN_SAMPLE;
    add('payload.thresholds', thresholdsOk ? 'PASS' : 'FAIL', thresholdsOk ? 'info' : 'high',
        `min_events ${payload.minEvents}, min_observations ${payload.minObservations} (contract ${MIN_SAMPLE})`);
    const minEvents = MIN_SAMPLE, minObservations = MIN_SAMPLE;

    const models = payload.models;
    const unknown = Object.keys(models).filter(m => !SNAPSHOT_MODELS[m]);
    const notArrays = Object.keys(models).filter(m => !Array.isArray(models[m]));
    const base = ['11-category-pageviews', '20-daily-activity'].filter(m => !Array.isArray(models[m]));
    const modelsOk = !unknown.length && !notArrays.length && !base.length;
    add('payload.models', modelsOk ? 'PASS' : 'FAIL', modelsOk ? 'info' : 'critical', modelsOk
        ? `${Object.keys(models).length} models: ${Object.keys(models).sort().join(', ')}`
        : [unknown.length && `not allowlisted: ${unknown.join(', ')}`, notArrays.length && `not row lists: ${notArrays.join(', ')}`,
            base.length && `I-06B base missing: ${base.join(', ')}`].filter(Boolean).join('; '));
    if (!modelsOk) return done();
    const has = m => Array.isArray(models[m]);
    const rows = m => models[m] || [];

    // Schema: types, grain, non-empty groups, enumerations and flags. A schema failure stops the numeric checks.
    const typeErrors = [], grainErrors = [], positiveErrors = [];
    for (const [model, spec] of Object.entries(QUALITY_CONTRACT)) {
        if (!has(model)) continue;
        const keys = new Set();
        rows(model).forEach((row, i) => {
            if (!row || typeof row !== 'object') return typeErrors.push(`${model} row ${i}: not an object`);
            for (const [column, kind] of Object.entries({ from_day: D, through_day: D, ...spec.columns })) {
                if (!KIND_OK[kind](row[column])) typeErrors.push(`${model} row ${i}: ${column} is not ${kind}`);
            }
            const key = spec.grain.map(column => row[column]).join(' · ');
            if (keys.has(key)) grainErrors.push(`${model}: ${key}`);
            keys.add(key);
            if (spec.positive && row[spec.positive] === 0) positiveErrors.push(`${model}: ${key}`);
        });
    }
    add('schema.columns', typeErrors.length ? 'FAIL' : 'PASS', typeErrors.length ? 'critical' : 'info',
        typeErrors.length ? list(typeErrors) : 'every contract column present with a valid type and unit');
    add('schema.grain', grainErrors.length ? 'FAIL' : 'PASS', grainErrors.length ? 'critical' : 'info',
        grainErrors.length ? `duplicate keys: ${list(grainErrors)}` : 'every row is unique on its model grain');
    if (typeErrors.length || grainErrors.length) return done();
    add('schema.positive', positiveErrors.length ? 'FAIL' : 'PASS', positiveErrors.length ? 'high' : 'info',
        positiveErrors.length ? `zero-count groups: ${list(positiveErrors)}` : 'every grouped row counts at least one event');

    const enumErrors = [];
    const expect = (model, column, allowed) => rows(model).forEach(row => {
        if (!allowed.includes(row[column])) enumErrors.push(`${model}.${column} = ${row[column]}`);
    });
    expect('26-acquisition-session', 'attribution_scope', ['session_last_click']);
    expect('26-acquisition-session', 'channel_class', CHANNEL_CLASSES);
    expect('26-acquisition-session', 'medium_class', MEDIUM_CLASSES);
    expect('26-acquisition-session', 'source_family', SOURCE_FAMILIES);
    expect('28-internal-navigation', 'source_section', PATH_CLASSES.filter(c => c !== 'missing')); // page_path is never NULL in `site`
    expect('28-internal-navigation', 'destination_section', PATH_CLASSES);
    expect('28-internal-navigation', 'link_section', [...LINK_SECTIONS, '(none)', 'other']);
    expect('13-article-discovery', 'source_surface', SOURCE_SURFACES);
    expect('29-audience-coverage', 'event_name', AUDIENCE_EVENTS);
    expect('30-cwv-summary', 'coverage', COVERAGES);
    expect('30-cwv-summary', 'metric', RUM_METRICS);
    rows('33-rum-coverage').forEach(row => {
        const allowed = RUM_STAGES[row.stage];
        if (allowed === undefined || (allowed && !allowed.includes(row.category))) enumErrors.push(`33-rum-coverage ${row.stage}/${row.category}`);
    });
    add('schema.enums', enumErrors.length ? 'FAIL' : 'PASS', enumErrors.length ? 'high' : 'info',
        enumErrors.length ? `values the SQL cannot produce: ${list(enumErrors)}` : 'every class is one the model SQL produces');

    const flagErrors = [];
    const flag = (model, column, expected) => rows(model).forEach((row, i) => {
        if (row[column] !== expected(row)) flagErrors.push(`${model} row ${i}: ${column} = ${row[column]}`);
    });
    for (const [model, spec] of Object.entries(QUALITY_CONTRACT)) {
        if (spec.sample) flag(model, 'meets_min_events', row => row[spec.sample] >= minEvents);
        if (spec.sampleObservations) flag(model, 'meets_min_observations', row => row[spec.sampleObservations] >= minObservations);
    }
    flag('30-cwv-summary', 'core_web_vital', row => ['LCP', 'INP', 'CLS'].includes(row.metric));
    flag('30-cwv-summary', 'cohort_truncated', () => false);
    flag('33-rum-coverage', 'cohort_truncated', () => false);
    add('schema.flags', flagErrors.length ? 'FAIL' : 'PASS', flagErrors.length ? 'high' : 'info',
        flagErrors.length ? list(flagErrors) : `sample flags agree with counts at ${minEvents} events / ${minObservations} observations`);

    // Windows: each model's scope from the rules, its label, and every row's dates.
    const labels = payload.modelWindows || {};
    const scopes = {}, labelErrors = [], carriedErrors = [];
    for (const model of Object.keys(models)) {
        const label = labels[model];
        if (label && label.asOf !== undefined) {
            const expected = isDay(label.asOf) ? modelWindow(model, windowFor(label.asOf)) : null;
            const allowed = [...DISCOVERY_MODELS, ...ROTATED_FOR_DISCOVERY].includes(model);
            if (!allowed) carriedErrors.push(`${model} is carried but is not a rotated model`);
            else if (!expected || label.asOf >= W.asOf) carriedErrors.push(`${model} carried from as_of ${label.asOf}, not before ${W.asOf}`);
            else if (label.start !== expected.start || label.end !== expected.end) {
                carriedErrors.push(`${model} carried from as_of ${label.asOf} is labelled ${label.start} → ${label.end}, but that day's window is ${expected.start} → ${expected.end}`);
            }
            scopes[model] = { asOf: label.asOf, start: label.start, end: label.end, carried: true };
        } else {
            const expected = modelWindow(model, W);
            if (label && (label.start !== expected.start || label.end !== expected.end)) labelErrors.push(`${model} labelled ${label.start} → ${label.end}, expected ${expected.start} → ${expected.end}`);
            if (!label && expected.start !== W.start) labelErrors.push(`${model} covers ${expected.start} → ${expected.end} but has no window label`);
            scopes[model] = { asOf: W.asOf, start: expected.start, end: expected.end, carried: false };
        }
    }
    const extraLabels = Object.keys(labels).filter(model => !models[model]);
    if (extraLabels.length) labelErrors.push(`labels without data: ${extraLabels.join(', ')}`);
    add('window.labels', labelErrors.length ? 'FAIL' : 'PASS', labelErrors.length ? 'critical' : 'info',
        labelErrors.length ? list(labelErrors) : 'every computed model is labelled with the window it was run for');
    const carried = Object.keys(scopes).filter(m => scopes[m].carried);
    add('window.carried', carriedErrors.length ? 'FAIL' : 'PASS', carriedErrors.length ? 'critical' : 'info', carriedErrors.length ? list(carriedErrors)
        : carried.length ? `carried with their own dates: ${carried.map(m => `${m} ${scopeText(scopes[m])}`).join('; ')}` : 'no carried model');
    const rowErrors = [];
    for (const [model, scope] of Object.entries(scopes)) {
        const off = rows(model).filter(row => row.from_day !== scope.start || row.through_day !== scope.end).length;
        if (off) rowErrors.push(`${model}: ${off} row(s) outside ${scope.start} → ${scope.end}`);
    }
    add('window.rows', rowErrors.length ? 'FAIL' : 'PASS', rowErrors.length ? 'critical' : 'info',
        rowErrors.length ? list(rowErrors) : 'every row carries exactly its model\'s from_day and through_day');
    if (labelErrors.length || carriedErrors.length || rowErrors.length) return done();

    // Rotation and the seven-query budget.
    const ranToday = Object.keys(scopes).filter(m => !scopes[m].carried);
    const rotationErrors = [];
    if (ranToday.length > MAX_RUN_PER_DAY) rotationErrors.push(`${ranToday.length} models computed for as_of ${W.asOf} (at most ${MAX_RUN_PER_DAY})`);
    for (const pair of [DISCOVERY_MODELS, ROTATED_FOR_DISCOVERY]) {
        const present = pair.filter(has);
        if (present.length === 1) rotationErrors.push(`${present[0]} without ${pair.find(m => m !== present[0])}`);
        if (present.length === 2 && !sameScope(scopes[pair[0]], scopes[pair[1]])) rotationErrors.push(`${pair.join(' and ')} cover different windows`);
    }
    const rumCarried = ROTATED_FOR_DISCOVERY.every(m => has(m) && scopes[m].carried);
    if (rumCarried) {
        const age = dayDiff(W.asOf, scopes[ROTATED_FOR_DISCOVERY[0]].asOf);
        if (age !== 1) rotationErrors.push(`RUM carried from ${age} days earlier; the rotation carries it only from yesterday`);
        if (!DISCOVERY_MODELS.every(m => has(m) && !scopes[m].carried)) rotationErrors.push('RUM is carried but discovery did not run in its place');
    }
    add('window.rotation', rotationErrors.length ? 'FAIL' : 'PASS', rotationErrors.length ? 'high' : 'info', rotationErrors.length ? list(rotationErrors)
        : `${ranToday.length} model(s) computed for as_of ${W.asOf}${rumCarried ? '; discovery day, RUM carried from yesterday' : ''}`);

    // Freshness: the 4-day maturity lag is by design; staleness is measured against the schedule.
    if (now) {
        const today = propertyDay(now);
        const behind = dayDiff(today, W.asOf);
        const hours = (now.getTime() - Date.parse(payload.generatedAt)) / 3600000;
        const notes = [`data through ${W.end}: the ${MATURITY_DAYS}-day GA4 maturity lag is expected`];
        if (behind === 1) notes.push(`today's run (as_of ${today}) is pending or late`);
        if (behind < 0) notes.push(`as_of ${W.asOf} is after today's property day ${today}`);
        const stale = hours > STALE_HOURS || behind >= 2 || behind < 0;
        if (behind >= 2) notes.unshift(`${behind - 1} daily refresh(es) missing since as_of ${W.asOf}`);
        if (hours > STALE_HOURS) notes.unshift(`generated ${Math.floor(hours)} h ago (dashboard marks > ${STALE_HOURS} h as stale)`);
        add('freshness.snapshot', stale ? 'WARNING' : 'PASS', stale ? 'medium' : 'info', notes.join('; '));
    }
    if (DISCOVERY_MODELS.every(has)) {
        const age = dayDiff(W.asOf, scopes[DISCOVERY_MODELS[0]].asOf);
        const text = age === 0 ? 'refreshed in this snapshot' : `carried, ${age} day(s) old, from as_of ${scopes[DISCOVERY_MODELS[0]].asOf} (${scopes[DISCOVERY_MODELS[0]].start} → ${scopes[DISCOVERY_MODELS[0]].end})`;
        if (age > DISCOVERY_MAX_AGE_DAYS) add('freshness.discovery', 'FAIL', 'high', `${text}: older than ${DISCOVERY_MAX_AGE_DAYS} days must have been dropped`);
        else if (age > 7) add('freshness.discovery', 'WARNING', 'medium', `${text}: the weekly refresh is overdue`);
        else add('freshness.discovery', 'PASS', 'info', text);
    } else {
        add('freshness.discovery', 'NOT_VERIFIED', 'info', 'no discovery in this snapshot (before the first weekly run, or dropped when older than 13 days)');
    }

    // Daily continuity (20): one row per day, zero days are reported, never invented or removed.
    const daily = rows('20-daily-activity').slice().sort((a, b) => (a.event_day < b.event_day ? -1 : 1));
    const scope20 = scopes['20-daily-activity'];
    const expectedDays = Array.from({ length: windowDays(scope20) }, (_, i) => addDays(scope20.start, i));
    const daysOk = daily.length === expectedDays.length && daily.every((row, i) => row.event_day === expectedDays[i]);
    add('continuity.days', daysOk ? 'PASS' : 'FAIL', daysOk ? 'info' : 'critical', daysOk ? `${daily.length} consecutive day rows, ${scope20.start} → ${scope20.end}`
        : `expected ${expectedDays.length} consecutive days, got ${daily.map(row => row.event_day).join(', ') || 'none'}`);
    if (daysOk) {
        const zero = daily.filter(row => row.page_view_events === 0).map(row => row.event_day);
        let run = 0, longest = 0, longestEnd = null;
        daily.forEach(row => {
            run = row.page_view_events === 0 ? run + 1 : 0;
            if (run > longest) [longest, longestEnd] = [run, row.event_day];
        });
        if (longest >= ZERO_RUN_DAYS) {
            add('continuity.zero-days', 'WARNING', 'medium', `${longest} consecutive days without a kept page view, through ${longestEnd}: a collection gap is more likely than no readers; not proof of zero readership`);
        } else {
            add('continuity.zero-days', 'PASS', 'info', zero.length ? `${zero.length} isolated zero day(s) (${list(zero)}), shown as 0, within normal low-traffic variation` : 'no zero days');
        }
        const odd = daily.filter(row => row.page_view_events === 0 && row.session_start_events > 0).map(row => row.event_day);
        add('continuity.sessions-without-views', odd.length ? 'WARNING' : 'PASS', odd.length ? 'medium' : 'info',
            odd.length ? `session_start events on days with no page_view: ${list(odd)}` : 'every day with session_start also has page views');
    }

    // Article reconciliation (10, 11, 20).
    // One side of a comparison: its unit is the counted event, its population and window the model's own.
    const measure = (model, event, label, value) => ({ label, value, unit: `${event} events`, population: QUALITY_CONTRACT[model].population, scope: scopes[model] });
    const recorded = (id, verdict, severity = 'high') => add(id, verdict.outcome, verdict.outcome === 'FAIL' ? severity : 'info', verdict.reason);
    const article = rows('10-article-pageviews');
    const categories = rows('11-category-pageviews');
    if (has('10-article-pageviews')) {
        recorded('articles.totals', reconcile({ relation: 'equal',
            left: measure('10-article-pageviews', 'page_view', 'article page views (10)', sum(article, 'page_view_events')),
            right: measure('11-category-pageviews', 'page_view', 'category page views (11)', sum(categories, 'page_view_events')) }));
        const fromArticles = group(article, row => (row.article_id === '(unmapped)' ? '(unmapped)' : row.primary_category ?? '(unknown)'), row => row.page_view_events);
        const articlesPer = group(article.filter(row => row.article_id !== '(unmapped)'), row => row.primary_category ?? '(unknown)', () => 1);
        const off = [];
        for (const row of categories) {
            if ((fromArticles.get(row.category) || 0) !== row.page_view_events) off.push(`${row.category}: 11 has ${row.page_view_events}, 10 sums to ${fromArticles.get(row.category) || 0}`);
            if ((articlesPer.get(row.category) || 0) !== row.articles_with_events) off.push(`${row.category}: 11 has ${row.articles_with_events} articles, 10 has ${articlesPer.get(row.category) || 0}`);
        }
        for (const category of fromArticles.keys()) if (!categories.some(row => row.category === category)) off.push(`${category}: in 10, missing from 11`);
        const comparable = sameScope(scopes['10-article-pageviews'], scopes['11-category-pageviews']);
        add('articles.by-category', !comparable ? 'NOT_VERIFIED' : off.length ? 'FAIL' : 'PASS', off.length && comparable ? 'high' : 'info',
            !comparable ? 'windows differ' : off.length ? list(off) : `${categories.length} categories match their articles' page views and article counts`);
        const siteViews = sum(daily, 'page_view_events');
        recorded('articles.within-site', reconcile({ relation: 'subset',
            left: measure('10-article-pageviews', 'page_view', 'article page views (10)', sum(article, 'page_view_events')),
            right: measure('20-daily-activity', 'page_view', 'site page views (20)', siteViews) }));
        const activeDays = daily.filter(row => row.page_view_events > 0).length;
        const dayErrors = article.filter(row => row.days_with_events < 1 || row.days_with_events > activeDays || row.days_with_events > row.page_view_events)
            .map(row => `${row.article_id}: ${row.days_with_events} days, ${row.page_view_events} views`);
        add('articles.days', dayErrors.length ? 'FAIL' : 'PASS', dayErrors.length ? 'high' : 'info',
            dayErrors.length ? `outside 1 … min(views, ${activeDays} site days with views): ${list(dayErrors)}` : `every article's active days fit the ${activeDays} site day(s) with page views`);
        const rowErrors10 = [];
        for (const row of article) {
            if (row.via_retired_url_events > row.page_view_events) rowErrors10.push(`${row.article_id}: retired-URL views above views`);
            if (row.article_id === '(unmapped)') {
                if (row.unmapped_keys < 1) rowErrors10.push('(unmapped): no unmapped key');
                if (row.via_retired_url_events) rowErrors10.push('(unmapped): retired-URL views');
                if ([row.title, row.published_day, row.primary_category, row.author].some(v => v !== null)) rowErrors10.push('(unmapped): has article metadata');
            } else if (row.unmapped_keys !== 0) rowErrors10.push(`${row.article_id}: unmapped keys on a mapped article`);
        }
        add('articles.rows', rowErrors10.length ? 'FAIL' : 'PASS', rowErrors10.length ? 'high' : 'info',
            rowErrors10.length ? list(rowErrors10) : `${article.length} article rows: retired-URL and unmapped counts in range`);
        const unmapped = article.find(row => row.article_id === '(unmapped)');
        const unmappedCategory = categories.find(row => row.category === '(unmapped)');
        add('articles.unmapped', unmapped ? 'WARNING' : 'PASS', unmapped ? 'medium' : 'info', unmapped
            ? `${unmapped.page_view_events} page view(s) from ${unmapped.unmapped_keys} article URL key(s) not in the index, kept as '(unmapped)' (11: ${unmappedCategory ? unmappedCategory.page_view_events : 0})`
            : 'every article page view maps to an indexed article');
        const metadataGaps = article.filter(row => row.article_id !== '(unmapped)' && [row.title, row.published_day, row.primary_category].some(v => v === null))
            .map(row => row.article_id);
        const viewedBeforePublished = article.filter(row => row.published_day && row.published_day > scopes['10-article-pageviews'].end).map(row => `${row.article_id} (${row.published_day})`);
        add('articles.metadata', metadataGaps.length || viewedBeforePublished.length ? 'WARNING' : 'PASS', metadataGaps.length || viewedBeforePublished.length ? 'medium' : 'info',
            [metadataGaps.length && `missing title, date or category: ${list(metadataGaps)}`,
                viewedBeforePublished.length && `viewed before their indexed publication date: ${list(viewedBeforePublished)}`].filter(Boolean).join('; ')
                || 'every viewed article has a title, date and category');
    } else {
        for (const id of ['articles.totals', 'articles.by-category', 'articles.within-site', 'articles.days', 'articles.rows', 'articles.unmapped', 'articles.metadata']) {
            add(id, 'NOT_VERIFIED', 'info', '10-article-pageviews is not in this snapshot (pre-I-06C1)');
        }
    }
    const catalogueErrors = categories.filter(row => !['(unmapped)', '(unknown)'].includes(row.category) && row.articles_with_events > row.catalog_articles)
        .map(row => `${row.category}: ${row.articles_with_events} viewed of ${row.catalog_articles} indexed`);
    const unmappedCategoryOdd = categories.filter(row => row.category === '(unmapped)' && (row.articles_with_events !== 0 || row.catalog_articles !== 0));
    if (unmappedCategoryOdd.length) catalogueErrors.push('(unmapped): has articles or catalogue entries');
    add('categories.catalogue', catalogueErrors.length ? 'WARNING' : 'PASS', catalogueErrors.length ? 'medium' : 'info', catalogueErrors.length ? list(catalogueErrors)
        : `${categories.length} categories; viewed articles never exceed the render-time catalogue (catalogue size is not readership)`);

    // Identity against the committed index (public repository data, not analytics).
    const identityIds = [...article.map(row => row.article_id), ...rows('13-article-discovery').map(row => row.destination_article_id)]
        .filter(id => id !== '(unmapped)');
    if (!catalogue) {
        add('articles.identity', 'NOT_VERIFIED', 'info', 'no article catalogue supplied');
    } else {
        const live = new Set(catalogue.articles.map(a => a.article_id));
        const retired = new Set(catalogue.aliases.filter(a => a.retired).flatMap(a => [a.article_key]));
        const asRetired = [...new Set(identityIds.filter(id => retired.has(id) && !live.has(id)))];
        const absent = [...new Set(identityIds.filter(id => !live.has(id) && !retired.has(id)))];
        if (asRetired.length) add('articles.identity', 'FAIL', 'critical', `retired ids reported as articles (double identity): ${list(asRetired)}`);
        else if (absent.length) add('articles.identity', 'WARNING', 'medium', `ids no longer in the index (catalogue changed since the snapshot): ${list(absent)}`);
        else add('articles.identity', 'PASS', 'info', `${new Set(identityIds).size} reported ids are live, canonical articles`);
    }

    // Acquisition (26, 29) against daily activity (20), compared only over the acquisition window.
    if (has('26-acquisition-session') && has('29-audience-coverage')) {
        const acquisition = rows('26-acquisition-session'), coverage = rows('29-audience-coverage');
        const scope26 = scopes['26-acquisition-session'];
        const contained = scope26.asOf === scope20.asOf && scope26.start >= scope20.start && scope26.end <= scope20.end;
        const slice = daily.filter(row => row.event_day >= scope26.start && row.event_day <= scope26.end);
        const daily7 = { ...scope20, start: scope26.start, end: scope26.end };
        const verdicts = ['session_start', 'page_view'].map(event => reconcile({ relation: 'equal',
            left: measure('26-acquisition-session', event, `${event} by attribution (26)`, sum(acquisition, `${event}_events`)),
            right: { ...measure('20-daily-activity', event, `${event} per day (20) over ${scope26.start} → ${scope26.end}`, sum(slice, `${event}_events`)),
                scope: contained ? { asOf: daily7.asOf, start: daily7.start, end: daily7.end } : scope20 } }));
        const worst = verdicts.find(v => v.outcome === 'FAIL') || verdicts.find(v => v.outcome === 'NOT_VERIFIED') || verdicts[0];
        add('acquisition.sessions', worst.outcome, worst.outcome === 'FAIL' ? 'high' : 'info', verdicts.map(v => v.reason).join('; '));
        const kept = event => coverage.find(row => row.event_name === event)?.site_events ?? 0;
        const coverageVerdicts = ['session_start', 'page_view'].map(event => reconcile({ relation: 'equal',
            left: { ...measure('29-audience-coverage', event, `kept ${event} (29)`, kept(event)), unit: `${event} events`, population: 'site' },
            right: measure('26-acquisition-session', event, `${event} by attribution (26)`, sum(acquisition, `${event}_events`)) }));
        const worstCoverage = coverageVerdicts.find(v => v.outcome === 'FAIL') || coverageVerdicts.find(v => v.outcome === 'NOT_VERIFIED') || coverageVerdicts[0];
        add('acquisition.coverage', worstCoverage.outcome, worstCoverage.outcome === 'FAIL' ? 'high' : 'info', coverageVerdicts.map(v => v.reason).join('; '));
        const gapErrors = [];
        for (const event of ['session_start', 'page_view']) {
            const row = coverage.find(r => r.event_name === event) || { session_channel_unattributed_or_other: 0, session_source_unattributed_or_other: 0 };
            const channel = sumWhere(acquisition, `${event}_events`, r => ['unattributed', 'other'].includes(r.channel_class));
            const source = sumWhere(acquisition, `${event}_events`, r => ['unattributed', 'other_source'].includes(r.source_family));
            if (row.session_channel_unattributed_or_other !== channel) gapErrors.push(`${event} channel: 29 ${row.session_channel_unattributed_or_other} vs 26 ${channel}`);
            if (row.session_source_unattributed_or_other !== source) gapErrors.push(`${event} source: 29 ${row.session_source_unattributed_or_other} vs 26 ${source}`);
        }
        add('acquisition.gaps-reconcile', gapErrors.length ? 'FAIL' : 'PASS', gapErrors.length ? 'high' : 'info',
            gapErrors.length ? list(gapErrors) : 'unattributed/other counts in 29 equal the matching classes in 26');
        const stageErrors = coverage.filter(r => r.site_events > r.consented_events || r.site_events > r.primary_host_events
            || r.consented_events > r.events_in_tables || r.primary_host_events > r.events_in_tables
            || r.session_source_unattributed_or_other > r.site_events || r.session_channel_unattributed_or_other > r.site_events).map(r => r.event_name);
        add('acquisition.stages', stageErrors.length ? 'FAIL' : 'PASS', stageErrors.length ? 'high' : 'info',
            stageErrors.length ? `stage counts grow for: ${list(stageErrors)}` : 'kept ≤ consented, kept ≤ on-host ≤ in tables for every event name');
        const nonConsented = sum(coverage, 'events_in_tables') - sum(coverage, 'consented_events');
        const offHost = sum(coverage, 'events_in_tables') - sum(coverage, 'primary_host_events');
        add('acquisition.filters', nonConsented || offHost ? 'WARNING' : 'PASS', nonConsented || offHost ? 'medium' : 'info', nonConsented || offHost
            ? `${nonConsented} event(s) without analytics consent and ${offHost} without a https://f1-stories.gr page_location reached the export and were excluded, as designed (${scope26.start} → ${scope26.end})`
            : `no event lost to the consent or host filter (${scope26.start} → ${scope26.end})`);
        const sessions = sum(acquisition, 'session_start_events');
        const gap = sumWhere(acquisition, 'session_start_events', r => ['unattributed', 'other'].includes(r.channel_class));
        const unassigned = sumWhere(acquisition, 'session_start_events', r => r.channel_class === 'unassigned');
        add('acquisition.attribution', gap ? 'WARNING' : 'PASS', gap ? 'medium' : 'info',
            `${gap} of ${sessions} session_start event(s) have no or an unclassified channel${unassigned ? `; ${unassigned} GA4 'Unassigned'` : ''}; kept as their own classes, never Direct`);
    } else {
        for (const id of ['acquisition.sessions', 'acquisition.coverage', 'acquisition.gaps-reconcile', 'acquisition.stages', 'acquisition.filters', 'acquisition.attribution']) {
            add(id, 'NOT_VERIFIED', 'info', 'the 26/29 pair is not in this snapshot (pre-I-06C2)');
        }
    }

    // Discovery (13 ⊂ 28): same consent, host, window and event; 13 keeps only clicks with an article destination.
    if (DISCOVERY_MODELS.every(has)) {
        const discovery = rows('13-article-discovery'), navigation = rows('28-internal-navigation');
        recorded('discovery.within-navigation', reconcile({ relation: 'subset',
            left: measure('13-article-discovery', 'internal_page_click', 'article clicks (13)', sum(discovery, 'click_events')),
            right: measure('28-internal-navigation', 'internal_page_click', 'internal clicks (28)', sum(navigation, 'click_events')) }));
        const comparable = sameScope(scopes['13-article-discovery'], scopes['28-internal-navigation']);
        const bounded = (id, left, right, what) => {
            const over = [...left].filter(([key, value]) => value > (right.get(key) || 0)).map(([key, value]) => `${key}: 13 has ${value}, 28 has ${right.get(key) || 0}`);
            add(id, !comparable ? 'NOT_VERIFIED' : over.length ? 'FAIL' : 'PASS', comparable && over.length ? 'high' : 'info',
                !comparable ? 'windows differ' : over.length ? list(over) : `every ${what} of 13 fits within 28`);
        };
        bounded('discovery.by-section', group(discovery, row => linkSectionClass(row.link_section), row => row.click_events),
            group(navigation, row => row.link_section, row => row.click_events), 'link-section class');
        bounded('discovery.by-surface', group(discovery, row => row.source_surface, row => row.click_events),
            group(navigation, row => surfaceOf(row.source_section), row => row.click_events), 'source surface');
        const toArticles = sumWhere(navigation, 'click_events', row => row.destination_section === 'article');
        const total13 = sum(discovery, 'click_events');
        add('discovery.destinations', total13 > toArticles ? 'WARNING' : 'PASS', total13 > toArticles ? 'medium' : 'info', total13 > toArticles
            ? `13 counts ${total13} article clicks but only ${toArticles} clicks have an article link_path: some resolve only through the article_id parameter`
            : `${total13} article clicks of ${toArticles} clicks with an article link_path`);
        const noPath = sumWhere(navigation, 'click_events', row => row.destination_section === 'missing');
        const noSection = sumWhere(navigation, 'click_events', row => row.link_section === '(none)');
        const clicks = sum(navigation, 'click_events');
        add('discovery.fields', noPath || noSection ? 'WARNING' : 'PASS', noPath || noSection ? 'high' : 'info', noPath || noSection
            ? `${noPath} of ${clicks} kept click(s) without link_path and ${noSection} without link_section: analytics.js always sends both`
            : `all ${clicks} kept click(s) carry link_path and link_section (page_location is implied: off-host or missing ones are excluded)`);
        const otherSection = sumWhere(navigation, 'click_events', row => row.link_section === 'other');
        const rawOutside = [...new Set(discovery.filter(row => linkSectionClass(row.link_section) === 'other').map(row => row.link_section))];
        const otherSource = sumWhere(navigation, 'click_events', row => row.source_section === 'other');
        const otherDestination = sumWhere(navigation, 'click_events', row => row.destination_section === 'other');
        const unknownCount = otherSection + rawOutside.length;
        add('discovery.classes', unknownCount ? 'WARNING' : 'PASS', unknownCount ? 'medium' : 'info', [
            unknownCount ? `${otherSection} click(s) with a link_section outside the allowlist${rawOutside.length ? ` (13 raw values: ${list(rawOutside)})` : ''}` : 'every link_section is an analytics.js classifyLink() value',
            (otherSource || otherDestination) && `${otherSource} from and ${otherDestination} to pages outside the named path classes ('other')`
        ].filter(Boolean).join('; '));
        const unmappedClicks = sumWhere(discovery, 'click_events', row => row.destination_article_id === '(unmapped)');
        add('discovery.unmapped', unmappedClicks ? 'WARNING' : 'PASS', unmappedClicks ? 'medium' : 'info', unmappedClicks
            ? `${unmappedClicks} click(s) to article URLs not in the index, kept as '(unmapped)' and outside the ranking` : 'every article destination maps to an indexed article');
    } else {
        for (const id of ['discovery.within-navigation', 'discovery.by-section', 'discovery.by-surface', 'discovery.destinations', 'discovery.fields', 'discovery.classes', 'discovery.unmapped']) {
            add(id, 'NOT_VERIFIED', 'info', 'discovery is not in this snapshot');
        }
    }

    // RUM (30, 33): same cohort; coverage classes kept apart.
    if (has('30-cwv-summary')) {
        const cwv = rows('30-cwv-summary');
        const cells = new Set(cwv.map(row => `${row.coverage}/${row.metric}`));
        const missingCells = COVERAGES.flatMap(c => RUM_METRICS.map(m => `${c}/${m}`)).filter(cell => !cells.has(cell));
        add('rum.grid', missingCells.length ? 'FAIL' : 'PASS', missingCells.length ? 'critical' : 'info',
            missingCells.length ? `missing cells: ${list(missingCells)}` : '3 coverage classes × 5 metrics, each its own row');
        const ratingErrors = [];
        for (const row of cwv) {
            const core = CWV_LIMITS[row.metric];
            if (core && (row.good === null || row.needs_improvement === null || row.poor === null || row.good + row.needs_improvement + row.poor !== row.observations)) {
                ratingErrors.push(`${row.coverage}/${row.metric}: ratings do not add up to ${row.observations}`);
            }
            if (!core && [row.good, row.needs_improvement, row.poor, row.good_share].some(v => v !== null)) ratingErrors.push(`${row.coverage}/${row.metric}: rated without thresholds`);
            if (core && (row.observations ? Math.abs(row.good_share - row.good / row.observations) > 1e-9 : row.good_share !== null)) {
                ratingErrors.push(`${row.coverage}/${row.metric}: good_share ${row.good_share} ≠ good/observations`);
            }
        }
        add('rum.ratings', ratingErrors.length ? 'FAIL' : 'PASS', ratingErrors.length ? 'high' : 'info',
            ratingErrors.length ? list(ratingErrors) : 'ratings and good_share agree with observations in every core row');
        const p75Errors = cwv.flatMap(row => {
            if ((row.observations === 0) !== (row.p75 === null)) return [`${row.coverage}/${row.metric}: p75 ${row.p75} with ${row.observations} observations`];
            return ratingErrors.length ? [] : p75Violations(row).map(text => `${row.coverage}/${row.metric}: ${text}`);
        });
        add('rum.p75', p75Errors.length ? 'FAIL' : 'PASS', p75Errors.length ? 'high' : 'info',
            p75Errors.length ? list(p75Errors) : 'p75 is NULL exactly without observations and lies in the band the rating counts allow');
    } else {
        add('rum.grid', 'NOT_VERIFIED', 'info', '30-cwv-summary is not in this snapshot');
    }
    if (has('30-cwv-summary') && has('33-rum-coverage')) {
        const cwv = rows('30-cwv-summary'), stages = rows('33-rum-coverage');
        const count = (stage, category) => stages.filter(r => r.stage === stage && (category === undefined || r.category === category)).reduce((t, r) => t + r.count, 0);
        const comparable = sameScope(scopes['30-cwv-summary'], scopes['33-rum-coverage']);
        const coverageErrors = COVERAGES.filter(c => count('coverage_distribution', c) !== sumWhere(cwv, 'observations', r => r.coverage === c))
            .map(c => `${c}: 33 ${count('coverage_distribution', c)} vs 30 ${sumWhere(cwv, 'observations', r => r.coverage === c)}`);
        add('rum.coverage', !comparable ? 'NOT_VERIFIED' : coverageErrors.length ? 'FAIL' : 'PASS', comparable && coverageErrors.length ? 'high' : 'info',
            !comparable ? 'windows differ' : coverageErrors.length ? list(coverageErrors)
                : `per coverage class: ${COVERAGES.map(c => `${c} ${count('coverage_distribution', c)}`).join(', ')}`);
        const rated = sum(cwv, 'observations'), resolved = count('observations', 'resolved');
        const pipelineErrors = [
            count('observation_validity') !== resolved && `validity categories sum to ${count('observation_validity')}, resolved ${resolved}`,
            rated > count('observation_validity', 'valid') && `${rated} rated above ${count('observation_validity', 'valid')} valid`,
            rated > count('cohort_placement', 'in_cohort') && `${rated} rated above ${count('cohort_placement', 'in_cohort')} in cohort`,
            resolved > count('eligible_snapshots') && `${resolved} resolved above ${count('eligible_snapshots')} eligible snapshots`,
            cwv.some(r => r.conflicted_observations !== undefined) && sum(cwv, 'conflicted_observations') > count('observations', 'final_snapshot_conflicting')
                && 'conflicted rated observations above conflicting final observations'
        ].filter(Boolean);
        add('rum.pipeline', !comparable ? 'NOT_VERIFIED' : pipelineErrors.length ? 'FAIL' : 'PASS', comparable && pipelineErrors.length ? 'high' : 'info',
            !comparable ? 'windows differ' : pipelineErrors.length ? list(pipelineErrors) : `${resolved} resolved → ${count('observation_validity', 'valid')} valid → ${rated} rated in cohort`);
        const conflicts = count('observations', 'final_snapshot_conflicting');
        const invalid = count('observation_validity') - count('observation_validity', 'valid');
        const identity = count('scan_identity', 'missing_metric_id') + count('scan_identity', 'invalid_revision') + count('scan_identity', 'revision_not_integer');
        const integrity = [conflicts && `${conflicts} final observation(s) from conflicting snapshot copies`,
            invalid && `${invalid} invalid observation(s)`, identity && `${identity} snapshot event(s) without a usable id or revision`].filter(Boolean);
        add('rum.integrity', integrity.length ? 'WARNING' : 'PASS', conflicts ? 'high' : integrity.length ? 'medium' : 'info', integrity.length
            ? `${integrity.join('; ')}; ${count('observations', 'final_snapshot_duplicated')} transport duplicate(s) resolved`
            : `no conflicting, invalid or unidentified observations; ${count('observations', 'final_snapshot_duplicated')} transport duplicate(s) resolved, ${count('observations', 'revised_after_first_snapshot')} revised`);
        const disagree = count('library_rating', 'disagrees_or_missing');
        add('rum.library', disagree ? 'WARNING' : 'PASS', disagree ? 'high' : 'info',
            `${count('library_rating', 'agrees')} agree, ${disagree} disagree or lack a library rating`);
    } else {
        for (const id of ['rum.coverage', 'rum.pipeline', 'rum.integrity', 'rum.library']) add(id, 'NOT_VERIFIED', 'info', 'the 30/33 pair is not in this snapshot');
    }

    // One consolidated small-sample note: expected at this traffic, never a failure.
    const small = [];
    for (const [model, spec] of Object.entries(QUALITY_CONTRACT)) {
        const column = spec.sample || spec.sampleObservations;
        if (!column || !has(model)) continue;
        const threshold = spec.sample ? minEvents : minObservations;
        const below = rows(model).filter(row => row[column] < threshold && !(model === '30-cwv-summary' && !row.core_web_vital)).length;
        if (below) small.push(`${model} ${below}/${model === '30-cwv-summary' ? 9 : rows(model).length}`);
    }
    add('sample.sizes', 'PASS', 'info', small.length ? `rows below ${minEvents}, flagged and shown, never ranked as stable: ${small.join(', ')}` : 'every row meets its threshold');

    // Evidence the snapshot cannot contain.
    add('external.ga4-stream', 'NOT_VERIFIED', 'medium', 'needs GA4 Admin; the export dataset id alone does not prove which stream feeds it');
    add('external.parameters', 'NOT_VERIFIED', 'medium', 'models prove only the parameters they read; source_path, source_type, destination_type and parameter value types need sql/02 as written');
    add('external.export-completeness', 'NOT_VERIFIED', 'medium', 'the refresh proves every daily table existed; a present but partial table needs sql/01 metadata');
    add('external.consent-population', 'NOT_VERIFIED', 'info', 'unmeasurable by design: no event is sent without consent');
    const rumAsOf = has('30-cwv-summary') ? scopes['30-cwv-summary'].asOf : null;
    add('external.rum-reference', 'NOT_VERIFIED', 'info', rumAsOf && rumAsOf >= RUM_REFERENCE_FIRST_AS_OF
        ? `eligible (RUM as_of ${rumAsOf}); needs the owner-run 28-day report.sql comparison`
        : `not yet eligible: the first 28-day cohort matures with as_of ${RUM_REFERENCE_FIRST_AS_OF}`);
    return done();
}

function summarize(diagnostics, header) {
    const counts = Object.fromEntries(OUTCOMES.map(outcome => [outcome, diagnostics.filter(d => d.outcome === outcome).length]));
    const order = (a, b) => OUTCOMES.indexOf(a.outcome) - OUTCOMES.indexOf(b.outcome) || SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity);
    return { asOf: header?.asOf ?? null, start: header?.start ?? null, end: header?.end ?? null, counts, ok: counts.FAIL === 0, diagnostics: diagnostics.slice().sort(order) };
}

// Human-readable report. redact drops every detail (they hold counts) and keeps ids, outcomes, severities and dates.
export function formatReport(report, { redact = false } = {}) {
    const lines = [`Snapshot validation — as_of ${report.asOf}, ${report.start} → ${report.end}`,
        `${report.counts.FAIL} FAIL · ${report.counts.WARNING} WARNING · ${report.counts.NOT_VERIFIED} NOT VERIFIED · ${report.counts.PASS} PASS`, ''];
    for (const outcome of OUTCOMES) {
        const items = report.diagnostics.filter(d => d.outcome === outcome);
        if (!items.length) continue;
        lines.push(`${outcome.replace('_', ' ')} (${items.length})`);
        for (const d of items) {
            lines.push(`  [${d.severity}] ${d.id} — ${d.title} (${d.area})`);
            if (!redact && outcome !== 'PASS') lines.push(`      ${d.detail}`);
            if (outcome !== 'PASS') lines.push(`      action: ${d.action}`);
        }
        lines.push('');
    }
    return lines.join('\n');
}

export const redacted = report => ({ ...report, diagnostics: report.diagnostics.map(({ detail, ...rest }) => rest) });

function main(argv, env) {
    const file = argv.find(arg => !arg.startsWith('--')) || path.join(REPO_ROOT, SNAPSHOT_PATH);
    const redact = argv.includes('--redact') || env.GITHUB_ACTIONS === 'true';
    const opened = openSnapshot(fs.readFileSync(file, 'utf8'), parseKey(env.DASHBOARD_SNAPSHOT_KEY));
    if (!opened) throw new Error('the snapshot does not open with this key (wrong key, or an invalid or damaged envelope)');
    const report = validateSnapshot({ ...opened, now: new Date(), catalogue: buildMapping(readInputs()) });
    process.stdout.write(argv.includes('--json') ? `${JSON.stringify(redact ? redacted(report) : report, null, 2)}\n` : `${formatReport(report, { redact })}\n`);
    if (!report.ok) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        main(process.argv.slice(2), process.env);
    } catch (error) {
        console.error(`✗ ${error.message}`);
        process.exitCode = 2;
    }
}
