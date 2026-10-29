// I-07A: offline input contract. This module reads public repository metadata only.
import { buildMapping, readInputs } from './editorial-model.mjs';
import retired from '../../blog-module/build/retired.js';
import taxonomy from '../../blog-module/taxonomy.js';
import { MATURITY_DAYS, DISCOVERY_MAX_AGE_DAYS, windowFor } from './snapshot.mjs';

export const EDITORIAL_INPUT_VERSION = 1;
const ORIGIN = 'https://f1-stories.gr';
const { addDays } = taxonomy;
const isDay = value => typeof value === 'string' && taxonomy.isDay(value);
const { aliases } = buildMapping(readInputs());
const identities = new Map(aliases.map(row => [decodeURIComponent(row.article_key), row.article_id]));
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const count = value => Number.isSafeInteger(value) && value >= 0;
const META = ['source', 'population', 'unit', 'period', 'timezone', 'asOf', 'freshness', 'status'];
const PROVENANCE = {
    gsc: ['search-console', 'google-search', 'search-performance'],
    site: ['ga4-bigquery', 'consented-ga4-events', 'events'],
    discovery: ['ga4-bigquery', 'consented-ga4-events', 'events'],
    rum: ['ga4-bigquery', 'consented-rum-observations', 'observations'],
    catalogue: ['repository', 'public-articles', 'articles'],
    linkGraph: ['repository', 'public-internal-links', 'edges']
};

// Unknown resources retain their exact input URL, including query and fragment. No guessed redirects or slugs.
export function canonicalArticleUrl(value) {
    if (!text(value) || value !== value.trim() || /[\u0000-\u0020\\]/.test(value)) throw new Error('invalid article URL');
    let url;
    try { url = new URL(value); } catch { throw new Error('invalid article URL'); }
    if (url.origin !== ORIGIN || url.username || url.password) throw new Error('URL must use https://f1-stories.gr/');
    const key = url.pathname.match(/^\/blog-module\/blog-entries\/([^/]+)\/article\.html$/)?.[1];
    let id;
    try { id = key && identities.get(decodeURIComponent(key)); } catch { /* malformed encoding stays unmapped */ }
    return id ? { url: retired.articleUrl(id), articleId: id, status: 'mapped' }
        : { url: value, articleId: null, status: 'unmapped' };
}

// Descriptors are { ...section, ...row }; this permits side-by-side display only, never numerical reconciliation.
export function joinable(a, b) {
    try {
        for (const item of [a, b]) {
            if (!object(item) || item.status !== 'present' || item.freshness?.dataState !== 'final'
                || !['search-console', 'ga4-bigquery'].includes(item.source)
                || item.population !== (item.source === 'search-console' ? 'google-search' : 'consented-ga4-events')
                || item.unit !== (item.source === 'search-console' ? 'search-performance' : 'events')
                || !isDay(item.period?.start) || !isDay(item.period?.end) || item.period.start > item.period.end
                || !isDay(item.asOf) || item.period.end > item.asOf
                || (item.source === 'search-console' && (item.aggregation !== 'page'
                    || !['https://f1-stories.gr/', 'sc-domain:f1-stories.gr'].includes(item.property)
                    || item.timezone !== 'America/Los_Angeles' || item.period.end > addDays(item.asOf, -3)))
                || (item.source === 'ga4-bigquery' && (item.timezone !== 'America/Los_Angeles'
                    || item.period.end > addDays(item.asOf, -MATURITY_DAYS)))
                || (item.date != null && (!isDay(item.date) || item.date < item.period.start || item.date > item.period.end))) return false;
        }
        const left = canonicalArticleUrl(a.page), right = canonicalArticleUrl(b.page);
        const period = item => item.date == null ? item.period : { start: item.date, end: item.date };
        return left.status === 'mapped' && right.status === 'mapped' && left.url === right.url
            && period(a).start === period(b).start && period(a).end === period(b).end && a.timezone === b.timezone
            && (a.source !== 'search-console' || b.source !== 'search-console' || a.property === b.property);
    } catch { return false; }
}

export function validateEditorialInputs(doc) {
    const errors = [], warnings = [];
    const fail = (where, message) => errors.push(`${where}: ${message}`);
    const warn = (where, message) => warnings.push(`${where}: ${message}`);
    function shape(value, where, required, optional = []) {
        if (!object(value)) { fail(where, 'expected object'); return false; }
        for (const key of required) if (!Object.hasOwn(value, key)) fail(`${where}.${key}`, 'required');
        for (const key of Object.keys(value)) if (![...required, ...optional].includes(key)) fail(where, 'unknown field');
        return true;
    }
    function rows(value, where, check) {
        if (!Array.isArray(value)) { fail(where, 'expected array'); return; }
        value.forEach((row, i) => check(row, `${where}[${i}]`));
    }
    function unique(values, where, key) {
        if (!Array.isArray(values)) return;
        const seen = new Set();
        for (const row of values.filter(object)) {
            const grain = key(row);
            if (seen.has(grain)) fail(where, 'duplicate grain; do not silently sum');
            seen.add(grain);
        }
    }
    function pageKey(row) {
        try { return canonicalArticleUrl(row.page).url; } catch { return row.page; }
    }
    function number(value, where, integer = true) {
        if (integer ? !count(value) : typeof value !== 'number' || !Number.isFinite(value) || value < 0) fail(where, 'invalid nonnegative number');
    }
    function page(value, mapping, where, aggregate = false) {
        if (aggregate && value === null && mapping === 'unmapped') {
            warn(where, 'unmapped source aggregate; no page identity'); return;
        }
        try {
            const resolved = canonicalArticleUrl(value);
            if (mapping !== resolved.status) fail(where, 'mapping disagrees with repository identity');
            if (resolved.status === 'unmapped') warn(where, 'unmapped URL retained; excluded from page joins');
        } catch { fail(where, 'invalid or noncanonical-host URL'); }
    }
    function meta(value, where, kind, extras) {
        if (!shape(value, where, META, extras)) return false;
        ['source', 'population', 'unit'].forEach((key, i) => {
            if (value[key] !== PROVENANCE[kind][i]) fail(`${where}.${key}`, 'incorrect provenance');
        });
        if (!['present', 'NOT VERIFIED', 'absent'].includes(value.status)) fail(where, 'invalid status');
        if (shape(value.period, `${where}.period`, ['start', 'end'])) {
            if (!isDay(value.period.start) || !isDay(value.period.end) || value.period.start > value.period.end) fail(where, 'invalid inclusive calendar period');
        }
        if (!isDay(value.asOf)) fail(`${where}.asOf`, 'expected ISO calendar day');
        if (!text(value.timezone)) fail(`${where}.timezone`, 'expected IANA timezone');
        else try { new Intl.DateTimeFormat('en', { timeZone: value.timezone }); } catch { fail(`${where}.timezone`, 'invalid timezone'); }
        if (isDay(value.period?.end) && isDay(value.asOf) && value.period.end > value.asOf) fail(where, 'period ends after asOf');
        if (shape(value.freshness, `${where}.freshness`, ['cadence', 'carried', 'dataState'])) {
            const cadence = kind === 'discovery' ? 'weekly' : ['catalogue', 'linkGraph'].includes(kind) ? 'static' : 'daily';
            if (value.freshness.cadence !== cadence) fail(where, 'incorrect cadence');
            if (typeof value.freshness.carried !== 'boolean') fail(where, 'carried must be boolean');
            if (!['final', 'preliminary', 'NOT VERIFIED'].includes(value.freshness.dataState)) fail(where, 'invalid dataState');
            if (value.freshness.carried && !['discovery', 'rum'].includes(kind)) fail(where, 'only discovery and RUM may be carried');
            if (value.status === 'present' && value.freshness.dataState !== 'final') warn(where, 'data maturity NOT VERIFIED; abstain from conclusions');
        }
        if (['NOT VERIFIED', 'absent'].includes(value.status)) warn(where, `${value.status}; unavailable, never zero`);
        if (['site', 'discovery', 'rum'].includes(kind) && isDay(value.asOf) && isDay(value.period?.start) && isDay(value.period?.end)) {
            const expected = windowFor(value.asOf);
            if (value.period.start !== expected.start || value.period.end !== expected.end) fail(where, 'expected snapshot mature primary window (asOf minus 4 days, at most 28 days since export start)');
            if (value.timezone !== 'America/Los_Angeles') fail(where, 'snapshot timezone must be America/Los_Angeles');
        }
        if (kind === 'gsc') {
            if (value.timezone !== 'America/Los_Angeles') fail(where, 'Search Console daily dates use America/Los_Angeles');
            if (isDay(value.asOf) && isDay(value.period?.end) && value.period.end > addDays(value.asOf, -3)) warn(where, 'recent GSC period may be preliminary; export completeness NOT VERIFIED');
        }
        return true;
    }
    function availability(value, fields, where) {
        for (const field of fields) {
            if (value.status === 'present' && !Object.hasOwn(value, field)) fail(`${where}.${field}`, 'required when present');
            if (value.status !== 'present' && Object.hasOwn(value, field)) fail(`${where}.${field}`, 'unavailable sections must omit data');
        }
    }
    if (!shape(doc, 'input', ['version', 'synthetic'], ['gsc', 'site', 'catalogue', 'linkGraph', 'comparisons'])) return { ok: false, errors, warnings };
    if (doc.version !== EDITORIAL_INPUT_VERSION) fail('version', 'unsupported input version');
    if (typeof doc.synthetic !== 'boolean') fail('synthetic', 'required boolean; true only for invented data');
    if (doc.gsc !== undefined && meta(doc.gsc, 'gsc', 'gsc', ['property', 'aggregation', 'searchType', 'rows'])) {
        const g = doc.gsc;
        if (!['https://f1-stories.gr/', 'sc-domain:f1-stories.gr'].includes(g.property)) fail('gsc.property', 'property must be an exact allowed identifier');
        if (!['page', 'property'].includes(g.aggregation)) fail('gsc.aggregation', 'expected page or property');
        if (g.searchType !== 'web') fail('gsc.searchType', 'v1 supports web search only');
        availability(g, ['rows'], 'gsc');
        const grains = new Set();
        if (Array.isArray(g.rows) && g.rows.some(row => object(row) && row.date === null)
            && g.rows.some(row => object(row) && row.date !== null)) fail('gsc.rows', 'do not mix daily rows with period totals');
        if (g.rows !== undefined) rows(g.rows, 'gsc.rows', (row, where) => {
            if (!shape(row, where, ['date', 'page', 'mapping', 'country', 'device', 'clicks', 'impressions', 'ctr', 'position'], ['query'])) return;
            if (row.date !== null && (!isDay(row.date) || !isDay(g.period?.start) || !isDay(g.period?.end)
                || row.date < g.period.start || row.date > g.period.end)) fail(where, 'date outside period');
            if (g.aggregation === 'page') page(row.page, row.mapping, where);
            else if (row.page !== null || row.mapping !== null) fail(where, 'property aggregation has no page identity');
            for (const key of ['query', 'country', 'device']) if (row[key] !== undefined && row[key] !== null && !text(row[key])) fail(where, 'invalid dimension');
            if (row.device !== null && !['DESKTOP', 'MOBILE', 'TABLET'].includes(row.device)) fail(where, 'invalid device');
            number(row.clicks, `${where}.clicks`); number(row.impressions, `${where}.impressions`);
            if (count(row.clicks) && count(row.impressions) && row.clicks > row.impressions) fail(where, 'clicks exceed impressions');
            number(row.ctr, `${where}.ctr`, false);
            if ((typeof row.ctr === 'number' && row.ctr > 1) || (row.impressions === 0 && row.ctr !== 0)) fail(where, 'CTR must be a ratio in 0..1 (zero without impressions)');
            if (!(row.position === null && row.impressions === 0)
                && (typeof row.position !== 'number' || !Number.isFinite(row.position) || row.position < 1)) fail(where, 'invalid average position');
            const grain = JSON.stringify([row.date, row.page, row.query ?? null, row.country, row.device]);
            if (grains.has(grain)) fail(where, 'duplicate exported grain; do not silently sum');
            grains.add(grain);
        });
    }
    if (doc.site !== undefined && meta(doc.site, 'site', 'site', ['articles', 'categories', 'discovery', 'rum'])) {
        const s = doc.site;
        availability(s, ['articles', 'categories'], 'site');
        if (s.articles !== undefined) rows(s.articles, 'site.articles', (row, where) => {
            if (!shape(row, where, ['page', 'mapping', 'page_view_events'])) return;
            page(row.page, row.mapping, where, true); number(row.page_view_events, where);
        });
        if (s.categories !== undefined) rows(s.categories, 'site.categories', (row, where) => {
            if (!shape(row, where, ['category', 'page_view_events'])) return;
            if (!text(row.category)) fail(where, 'category required');
            number(row.page_view_events, where);
        });
        unique(s.articles, 'site.articles', pageKey);
        unique(s.categories, 'site.categories', row => row.category);
        for (const kind of ['discovery', 'rum']) {
            const value = s[kind], where = `site.${kind}`;
            const fields = kind === 'discovery' ? ['rows'] : ['assessment'];
            if (value === undefined || !meta(value, where, kind, fields)) continue;
            availability(value, fields, where);
            if (isDay(value.asOf) && isDay(s.asOf)) {
                const age = (Date.parse(s.asOf) - Date.parse(value.asOf)) / 86400000;
                if (age < 0 || value.freshness?.carried !== (age > 0)) fail(where, 'carried label disagrees with parent asOf');
                if (age > (kind === 'rum' ? 1 : DISCOVERY_MAX_AGE_DAYS)) fail(where, 'carried data exceeds snapshot age limit');
                else if (kind === 'discovery' && age >= 8) warn(where, 'weekly discovery overdue');
            }
            if (kind === 'rum' && value.assessment !== undefined && !['PASS', 'WARNING', 'FAIL', 'NOT VERIFIED'].includes(value.assessment)) fail(where, 'invalid RUM assessment');
            if (kind === 'discovery' && value.rows !== undefined) rows(value.rows, `${where}.rows`, (row, at) => {
                if (!shape(row, at, ['page', 'mapping', 'source_surface', 'link_section', 'click_events'])) return;
                page(row.page, row.mapping, at, true); number(row.click_events, at);
                if (!text(row.source_surface) || !text(row.link_section)) fail(at, 'discovery dimensions required');
            });
            if (kind === 'discovery') unique(value.rows, `${where}.rows`, row => JSON.stringify([pageKey(row), row.source_surface, row.link_section]));
        }
    }
    if (doc.catalogue !== undefined && meta(doc.catalogue, 'catalogue', 'catalogue', ['rows'])) {
        availability(doc.catalogue, ['rows'], 'catalogue');
        const ids = new Set();
        if (doc.catalogue.rows !== undefined) rows(doc.catalogue.rows, 'catalogue.rows', (row, where) => {
            if (!shape(row, where, ['id', 'url', 'title', 'category', 'published', 'entities'])) return;
            try {
                const identity = canonicalArticleUrl(row.url);
                if (identity.status !== 'mapped' || identity.articleId !== row.id || identity.url !== row.url) fail(where, 'id and canonical article URL disagree');
            } catch { fail(where, 'invalid catalogue URL'); }
            if (ids.has(row.id)) fail(where, 'duplicate catalogue id');
            ids.add(row.id);
            if (!text(row.title) || !text(row.category) || !isDay(row.published) || !isDay(doc.catalogue.asOf)
                || row.published > doc.catalogue.asOf) fail(where, 'invalid public metadata');
            if (!Array.isArray(row.entities) || row.entities.some(id => typeof id !== 'string' || !/^(driver|team|circuit|grand-prix):[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))
                || new Set(row.entities).size !== row.entities.length) fail(where, 'invalid or duplicate entity IDs');
        });
    }
    if (doc.linkGraph !== undefined && meta(doc.linkGraph, 'linkGraph', 'linkGraph', ['rows'])) {
        availability(doc.linkGraph, ['rows'], 'linkGraph');
        if (doc.linkGraph.rows !== undefined) rows(doc.linkGraph.rows, 'linkGraph.rows', (row, where) => {
            if (!shape(row, where, ['from', 'to', 'fromMapping', 'toMapping'])) return;
            for (const key of ['from', 'to']) {
                page(row[key], row[`${key}Mapping`], where);
                try { if (canonicalArticleUrl(row[key]).url !== row[key]) fail(where, 'edges must use canonical URLs'); } catch { /* reported above */ }
            }
        });
    }
    if (doc.comparisons !== undefined) rows(doc.comparisons, 'comparisons', (row, where) => {
        if (!shape(row, where, ['left', 'right', 'operation'])) return;
        if (![row.left, row.right].every(value => ['gsc.clicks', 'site.page_view_events'].includes(value))
            || !['side-by-side', 'compare', 'reconcile'].includes(row.operation)) fail(where, 'invalid comparison declaration');
        if (row.left !== row.right && row.operation !== 'side-by-side') warn(where, 'GSC clicks and GA4 page_view events must never be compared or reconciled; declaration is not executable');
    });
    return { ok: errors.length === 0, errors, warnings };
}
