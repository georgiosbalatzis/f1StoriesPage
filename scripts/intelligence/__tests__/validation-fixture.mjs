// I-06C4 synthetic world for the snapshot validator: invented events, aggregated in JavaScript with the same
// populations, filters and groupings as the model SQL, so every model in one payload is consistent by construction.
// Seeded and deterministic. No real analytics, no network.
import { modelWindow, windowFor } from '../snapshot.mjs';

const addDays = (day, days) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const daysOf = scope => Array.from({ length: Math.round((Date.parse(scope.end) - Date.parse(scope.start)) / 86400000) + 1 }, (_, i) => addDays(scope.start, i));

export function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const pick = (random, items) => items[Math.floor(random() * items.length)];

// A public-index stand-in: live articles, one retired alias and one unindexed key.
export const CATALOGUE = {
    articles: [
        { article_id: 'a-fast', title: 'Ταχύτερος γύρος', published_day: '2026-10-01', primary_category: 'Ανάλυση', author: 'Συντακτική ομάδα' },
        { article_id: 'a-slow', title: 'Ιστορία του Μονακό', published_day: '2026-09-12', primary_category: 'Ιστορία', author: 'Συντακτική ομάδα' },
        { article_id: 'a-team', title: 'Ομάδες 2027', published_day: '2026-10-10', primary_category: 'Ανάλυση', author: 'Συντακτική ομάδα' },
        { article_id: 'a-plain', title: 'Χωρίς κατηγορία', published_day: '2026-08-01', primary_category: null, author: 'Συντακτική ομάδα' },
        { article_id: 'a-old', title: 'Αρχείο', published_day: '2025-05-05', primary_category: 'Ιστορία', author: 'Συντακτική ομάδα' }
    ],
    aliases: [
        ...['a-fast', 'a-slow', 'a-team', 'a-plain', 'a-old'].map(id => ({ article_key: id, article_id: id, retired: false })),
        { article_key: 'a-fast-old', article_id: 'a-fast', retired: true }
    ]
};
const ARTICLE_KEYS = ['a-fast', 'a-fast', 'a-slow', 'a-team', 'a-plain', 'a-fast-old', 'ghost-key'];
const articlePath = key => `/blog-module/blog-entries/${key}/article.html`;
const PAGES = ['/', '/index.html', '/standings/', '/blog-module/blog/', '/blog-module/blog/entities/x/', '/authors/', '/privacy/', '/tyres/', ...ARTICLE_KEYS.map(articlePath)];
const SESSION = {
    channel: [null, 'Direct', 'Organic Search', 'Organic Search', 'Referral', 'Unassigned', 'Organic Social', 'Brand New Group'],
    medium: [null, '(none)', 'organic', 'referral', 'cpc', 'weird'],
    source: [null, '(direct)', 'google', 'google', 'facebook', 'weird.example']
};
const LINK_SECTION_RAW = ['article_link', 'article_link', 'navigation', 'footer', 'page', 'Navigation ', 'cta', null, 'injected'];

// Events per mature day: page views, session starts, first visits, internal clicks and a few other audience events,
// each with consent, host and session attribution. traffic: average page views per day; zeroDays: days with none.
export function simulate({ start, end, seed = 1, traffic = 6, zeroDays = [] }) {
    const random = rng(seed);
    const events = [];
    for (const day of daysOf({ start, end })) {
        const views = zeroDays.includes(day) ? 0 : Math.floor(random() * traffic * 2);
        for (let i = 0; i < views; i++) {
            const consented = random() < 0.92 ? 'Yes' : pick(random, ['No', null]);
            const host = random() < 0.94 ? 'https://f1-stories.gr' : pick(random, ['https://www.f1-stories.gr', 'http://localhost:8080', null]);
            const page = pick(random, PAGES);
            const session = { channel: pick(random, SESSION.channel), medium: pick(random, SESSION.medium), source: pick(random, SESSION.source) };
            const at = { day, consented, page_location: host && `${host}${page}`, session };
            if (random() < 0.45) events.push({ ...at, name: 'session_start' });
            if (random() < 0.15) events.push({ ...at, name: 'first_visit' });
            events.push({ ...at, name: 'page_view' });
            if (random() < 0.2) events.push({ ...at, name: 'user_engagement' });
            if (random() < 0.35) {
                const target = random() < 0.08 ? null : pick(random, PAGES);
                events.push({ ...at, name: 'internal_page_click', link_path: target, link_section: pick(random, LINK_SECTION_RAW),
                    article_id: target && /\/blog-entries\/([^/]+)\/article\.html$/.test(target) ? target.match(/\/blog-entries\/([^/]+)\//)[1] : null });
            }
        }
    }
    return events;
}

// ---- SQL semantics ----
const pagePath = location => (location ? (location.match(/^https:\/\/f1-stories\.gr(\/[^?#]*)/) || [])[1] ?? null : null);
const articleKey = path => (path ? (path.match(/^\/blog-module\/blog-entries\/([^/]+)\/(?:article\.html)?$/) || [])[1] ?? null : null);
export function classifyPath(path) {
    if (path === null || path === undefined) return 'missing';
    if (path === '/' || path === '/index.html') return 'home';
    const prefixes = [['/blog-module/blog-entries/', 'article'], ['/blog-module/blog/entities/', 'entity_hub'], ['/blog-module/blog/', 'edition'],
        ['/standings/', 'standings'], ['/authors/', 'authors'], ['/privacy/', 'legal'], ['/telemetry/', 'tool_telemetry'],
        ['/f1telemetry/', 'tool_telemetry_stub'], ['/ghostcar/', 'tool_ghostcar'], ['/tyres/', 'tool_tyres'], ['/betcast/', 'tool_betcast']];
    for (const [prefix, cls] of prefixes) if (path.startsWith(prefix)) return cls;
    return ['/generate.html', '/housekeeping.html'].includes(path) ? 'author_tool' : 'other';
}
const sourceSurface = path => {
    if (/^\/(?:index\.html)?$/.test(path)) return 'home';
    for (const [re, cls] of [[/^\/blog-module\/blog-entries\//, 'article'], [/^\/blog-module\/blog\/entities\//, 'entity_hub'], [/^\/blog-module\/blog\//, 'edition'],
        [/^\/authors\//, 'authors'], [/^\/standings\//, 'standings']]) if (re.test(path)) return cls;
    return 'other';
};
const norm = value => (value === null || value.trim() === '' ? null : value.trim().toLowerCase());
const linkSectionClass = value => (norm(value) === null ? '(none)' : ['article_share', 'sponsor', 'social', 'cta', 'article_link', 'navigation', 'footer', 'page'].includes(norm(value)) ? norm(value) : 'other');
const channelClass = value => ({ null: 'unattributed', direct: 'direct_or_unknown', unassigned: 'unassigned', 'organic search': 'organic_search_reported',
    'organic social': 'social', referral: 'referral' })[norm(value)] || 'other';
const mediumClass = value => ({ null: 'unattributed', '(none)': 'direct_or_unknown', organic: 'organic_search_reported', referral: 'referral', cpc: 'paid' })[norm(value)] || 'other_tagged';
const sourceFamily = value => ({ null: 'unattributed', '(direct)': 'direct_or_unknown', google: 'google', facebook: 'facebook' })[norm(value)] || 'other_source';

function resolve(event) {
    const path = pagePath(event.page_location);
    const key = event.name === 'internal_page_click' ? articleKey(event.link_path) ?? event.article_id : articleKey(path) ?? null;
    const alias = CATALOGUE.aliases.find(a => a.article_key === key);
    const meta = alias && CATALOGUE.articles.find(a => a.article_id === alias.article_id);
    return { ...event, page_path: path, article_key: key, article_id: alias ? alias.article_id : null, via_retired: Boolean(alias?.retired), meta };
}
const inScope = (scope, event) => event.day >= scope.start && event.day <= scope.end;
const site = (events, scope) => events.filter(e => inScope(scope, e) && e.consented === 'Yes' && pagePath(e.page_location) !== null).map(resolve);
const editorial = (events, scope) => site(events, scope).filter(e => e.article_key !== null);
const rowsOf = (map, scope) => [...map.values()].map(row => ({ from_day: scope.start, through_day: scope.end, ...row }));
const bump = (map, key, init, update) => { if (!map.has(key)) map.set(key, init()); update(map.get(key)); };

export function aggregate(events, window, { minEvents = 30 } = {}) {
    const acquisition = modelWindow('26-acquisition-session', window);
    const a10 = new Map();
    for (const e of editorial(events, window).filter(e => e.name === 'page_view')) {
        bump(a10, e.article_id ?? '(unmapped)', () => ({ article_id: e.article_id ?? '(unmapped)', title: e.meta?.title ?? null, published_day: e.meta?.published_day ?? null,
            primary_category: e.meta?.primary_category ?? null, author: e.meta?.author ?? null, page_view_events: 0, via_retired_url_events: 0, days: new Set(), keys: new Set() }), row => {
            row.page_view_events++;
            if (e.via_retired) row.via_retired_url_events++;
            row.days.add(e.day);
            if (!e.article_id) row.keys.add(e.article_key);
        });
    }
    const m10 = rowsOf(a10, window).map(({ days, keys, ...row }) => ({ ...row, days_with_events: days.size, unmapped_keys: keys.size, meets_min_events: row.page_view_events >= minEvents }));
    const a11 = new Map();
    for (const e of editorial(events, window).filter(e => e.name === 'page_view')) {
        bump(a11, e.article_id === null ? '(unmapped)' : e.meta.primary_category ?? '(unknown)', () => ({ page_view_events: 0, ids: new Set() }), row => {
            row.page_view_events++;
            if (e.article_id) row.ids.add(e.article_id);
        });
    }
    const catalogue = new Map();
    for (const a of CATALOGUE.articles.filter(a => a.published_day === null || a.published_day <= window.end)) bump(catalogue, a.primary_category ?? '(unknown)', () => ({ n: 0 }), c => c.n++);
    const m11 = [...new Set([...a11.keys(), ...catalogue.keys()])].map(category => {
        const views = a11.get(category)?.page_view_events ?? 0;
        return { from_day: window.start, through_day: window.end, category, page_view_events: views, articles_with_events: a11.get(category)?.ids.size ?? 0,
            catalog_articles: catalogue.get(category)?.n ?? 0, meets_min_events: views >= minEvents };
    });
    const kept = site(events, window);
    const m20 = daysOf(window).map(day => {
        const count = name => kept.filter(e => e.day === day && e.name === name).length;
        return { from_day: window.start, through_day: window.end, event_day: day, page_view_events: count('page_view'), session_start_events: count('session_start'),
            first_visit_events: count('first_visit'), meets_min_events: count('page_view') >= minEvents };
    });
    const a26 = new Map();
    for (const e of site(events, acquisition).filter(e => ['session_start', 'page_view'].includes(e.name))) {
        const classes = { channel_class: channelClass(e.session.channel), medium_class: mediumClass(e.session.medium), source_family: sourceFamily(e.session.source) };
        bump(a26, Object.values(classes).join('|'), () => ({ attribution_scope: 'session_last_click', ...classes, session_start_events: 0, page_view_events: 0 }), row => row[`${e.name}_events`]++);
    }
    const m26 = rowsOf(a26, acquisition).map(row => ({ ...row, meets_min_events: row.session_start_events >= minEvents }));
    const a29 = new Map();
    for (const e of events.filter(e => inScope(acquisition, e))) {
        const isKept = e.consented === 'Yes' && pagePath(e.page_location) !== null;
        bump(a29, e.name, () => ({ event_name: e.name, events_in_tables: 0, consented_events: 0, primary_host_events: 0, site_events: 0,
            session_source_unattributed_or_other: 0, session_channel_unattributed_or_other: 0 }), row => {
            row.events_in_tables++;
            if (e.consented === 'Yes') row.consented_events++;
            if (pagePath(e.page_location) !== null) row.primary_host_events++;
            if (isKept) row.site_events++;
            if (isKept && ['unattributed', 'other_source'].includes(sourceFamily(e.session.source))) row.session_source_unattributed_or_other++;
            if (isKept && ['unattributed', 'other'].includes(channelClass(e.session.channel))) row.session_channel_unattributed_or_other++;
        });
    }
    return { '10-article-pageviews': m10, '11-category-pageviews': m11, '20-daily-activity': m20, '26-acquisition-session': m26,
        '29-audience-coverage': rowsOf(a29, acquisition), ...discoveryModels(events, window, { minEvents }) };
}

export function discoveryModels(events, window, { minEvents = 30 } = {}) {
    const a13 = new Map();
    for (const e of editorial(events, window).filter(e => e.name === 'internal_page_click')) {
        const id = e.article_id ?? '(unmapped)', surface = sourceSurface(e.page_path), section = e.link_section ?? '(none)';
        bump(a13, `${id}|${surface}|${section}`, () => ({ destination_article_id: id, title: e.meta?.title ?? null, primary_category: e.meta?.primary_category ?? null,
            source_surface: surface, link_section: section, click_events: 0 }), row => row.click_events++);
    }
    const a28 = new Map();
    for (const e of site(events, window).filter(e => e.name === 'internal_page_click')) {
        const classes = { source_section: classifyPath(e.page_path), destination_section: classifyPath(e.link_path), link_section: linkSectionClass(e.link_section) };
        bump(a28, Object.values(classes).join('|'), () => ({ ...classes, click_events: 0 }), row => row.click_events++);
    }
    const flag = row => ({ ...row, meets_min_events: row.click_events >= minEvents });
    return { '13-article-discovery': rowsOf(a13, window).map(flag), '28-internal-navigation': rowsOf(a28, window).map(flag) };
}

// ---- RUM: final observations (after revision resolution), aggregated as 30 and 33 ----
const LIMITS = { LCP: [2500, 4000], INP: [200, 500], CLS: [0.1, 0.25] };
const rating = (metric, value) => (!LIMITS[metric] ? null : value <= LIMITS[metric][0] ? 'good' : value <= LIMITS[metric][1] ? 'needs_improvement' : 'poor');
export function percentileCont(values, p) {
    const sorted = values.slice().sort((x, y) => x - y);
    const k = (sorted.length - 1) * p, lo = Math.floor(k), hi = Math.ceil(k);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (k - lo);
}

export function simulateRum({ start, end, seed = 1, perDay = 8 }) {
    const random = rng(seed * 7919);
    const observations = [];
    for (const day of daysOf({ start: addDays(start, -1), end: addDays(end, 1) })) {
        for (let i = 0; i < Math.floor(random() * perDay * 2); i++) {
            const metric = pick(random, ['LCP', 'LCP', 'INP', 'CLS', 'CLS', 'FCP', 'TTFB']);
            const raw = metric === 'CLS' ? Math.floor(random() * 400) : metric === 'INP' ? Math.floor(random() * 700) : Math.floor(random() * 6000);
            observations.push({ nav_day: day, metric, value: metric === 'CLS' ? raw / 1000 : raw, coverage: pick(random, ['delayed_existing', 'delayed_existing', 'delayed_existing', 'delayed_consent', 'bfcache_observed']),
                invalid: random() < 0.04 ? 'invalid_page_group' : null, copies: random() < 0.1 ? 2 : 1, conflicted: false, revision: random() < 0.1 ? 2 : 1 });
        }
    }
    return observations;
}

export function rumModels(observations, window, { minObservations = 30 } = {}) {
    const rum = { from_day: window.start, through_day: window.end, requested_through_day: window.end, extraction_through: window.end, cohort_truncated: false, late_revision_days: 0 };
    const cohort = o => o.nav_day >= window.start && o.nav_day <= window.end;
    const rated = observations.filter(o => !o.invalid && cohort(o));
    const m30 = [];
    for (const coverage of ['delayed_existing', 'delayed_consent', 'bfcache_observed']) {
        for (const metric of ['LCP', 'INP', 'CLS', 'FCP', 'TTFB']) {
            const cell = rated.filter(o => o.coverage === coverage && o.metric === metric);
            const core = Boolean(LIMITS[metric]);
            const count = r => cell.filter(o => rating(metric, o.value) === r).length;
            m30.push({ ...rum, coverage, metric, core_web_vital: core, observations: cell.length, p75: cell.length ? percentileCont(cell.map(o => o.value), 0.75) : null,
                good: core ? count('good') : null, needs_improvement: core ? count('needs_improvement') : null, poor: core ? count('poor') : null,
                good_share: core && cell.length ? count('good') / cell.length : null, conflicted_observations: cell.filter(o => o.conflicted).length,
                meets_min_observations: cell.length >= minObservations });
        }
    }
    const tally = new Map();
    const add = (stage, category, n = 1) => n && tally.set(`${stage}|${category}`, (tally.get(`${stage}|${category}`) || 0) + n);
    for (const o of observations) {
        const snapshots = o.copies + (o.revision > 1 ? 1 : 0);
        add('scan_version', 'wv6.2.3-rum1', snapshots);
        add('scan_consent', 'Yes', snapshots);
        add('scan_host', 'primary', snapshots);
        add('scan_identity', 'identified', snapshots);
        add('eligible_snapshots', o.copies > 1 ? (o.conflicted ? 'conflicting_copy' : 'duplicate_copy') : 'single_copy', o.copies);
        if (o.revision > 1) add('eligible_snapshots', 'single_copy');
        add('observations', 'resolved');
        if (o.revision > 1) add('observations', 'revised_after_first_snapshot');
        if (o.copies > 1 && !o.conflicted) add('observations', 'final_snapshot_duplicated');
        if (o.conflicted) add('observations', 'final_snapshot_conflicting');
        add('observation_validity', o.invalid || 'valid');
        add('cohort_placement', o.nav_day < window.start ? 'before_cohort' : o.nav_day > window.end ? 'after_cohort' : 'in_cohort');
    }
    for (const o of rated) {
        add('coverage_distribution', o.coverage);
        if (LIMITS[o.metric]) add('library_rating', 'agrees');
    }
    const m33 = [...tally].map(([key, count]) => ({ ...rum, stage: key.split('|')[0], category: key.split('|')[1], count }));
    return { '30-cwv-summary': m30, '33-rum-coverage': m33 };
}

// ---- whole snapshots ----
export const generatedAtFor = asOf => `${addDays(asOf, 1)}T01:00:00.000Z`; // 03:00 Athens, the previous evening in Los Angeles

// dayType 'normal' (discovery carried `discoveryAge` days, or absent when null) or 'discovery' (RUM carried from yesterday).
export function syntheticSnapshot({ asOf = '2026-11-19', seed = 1, dayType = 'normal', discoveryAge = 3, traffic = 6, zeroDays = [] } = {}) {
    const window = windowFor(asOf);
    const world = simulate({ start: '2026-10-19', end: window.end, seed, traffic, zeroDays });
    const rum = simulateRum({ start: '2026-10-19', end: window.end, seed });
    const models = aggregate(world, window);
    const modelWindows = {};
    const acquisition = modelWindow('26-acquisition-session', window);
    if (acquisition.start !== window.start) for (const m of ['26-acquisition-session', '29-audience-coverage']) modelWindows[m] = { start: acquisition.start, end: acquisition.end };
    if (dayType === 'discovery') {
        const yesterday = windowFor(addDays(asOf, -1));
        Object.assign(models, rumModels(rum, yesterday));
        for (const m of ['30-cwv-summary', '33-rum-coverage']) modelWindows[m] = { asOf: yesterday.asOf, start: yesterday.start, end: yesterday.end };
    } else {
        Object.assign(models, rumModels(rum, window));
        delete models['13-article-discovery'];
        delete models['28-internal-navigation'];
        if (discoveryAge !== null) {
            const earlier = windowFor(addDays(asOf, -discoveryAge));
            Object.assign(models, discoveryModels(world, earlier));
            for (const m of ['13-article-discovery', '28-internal-navigation']) modelWindows[m] = { asOf: earlier.asOf, start: earlier.start, end: earlier.end };
        }
    }
    const generatedAt = generatedAtFor(asOf);
    const header = { format: 'f1s-dashboard-snapshot', v: 1, alg: 'AES-256-GCM', generatedAt, asOf, start: window.start, end: window.end };
    const payload = { format: 'f1s-dashboard-snapshot-payload', v: 1, generatedAt, window: { ...window, timezone: 'America/Los_Angeles' },
        minEvents: 30, minObservations: 30, modelWindows, models };
    return { header, payload, world };
}
