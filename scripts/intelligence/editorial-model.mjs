#!/usr/bin/env node
// editorial-model.mjs — article metadata mapping and SQL rendering for the I-03 editorial, I-04 audience and I-05
// performance models.
// It reads the committed compact index and retired-article map and prints JSON or SQL. It never runs a query.
//
//   node scripts/intelligence/editorial-model.mjs metadata
//   node scripts/intelligence/editorial-model.mjs render 10-article-pageviews --project=<id> --property=<numeric id>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const MODELS_DIR = path.join(REPO_ROOT, 'docs', 'intelligence', 'sql', 'models');
export const MODELS = ['10-article-pageviews', '11-category-pageviews', '12-article-engagement',
    '13-article-discovery', '14-publication-age', '15-coverage'];
// I-04 audience, acquisition and engagement models (audience-base.sql).
export const AUDIENCE_MODELS = ['20-daily-activity', '21-site-sections', '22-device-category', '23-country',
    '24-acquisition-first-user', '25-acquisition-collected', '26-acquisition-session', '27-engagement-events',
    '28-internal-navigation', '29-audience-coverage'];
// I-05 Real User Performance models (rum-base.sql).
export const RUM_MODELS = ['30-cwv-summary', '31-cwv-breakdown', '32-cwv-trend', '33-rum-coverage'];
const FRAGMENTS = { EDITORIAL_BASE: 'base.sql', AUDIENCE_BASE: 'audience-base.sql', AUDIENCE_FUNCTIONS: 'audience-functions.sql',
    RUM_BASE: 'rum-base.sql' };

// I-01's path classifier, taken verbatim from the inventory query so the site has one set of path classes.
export function classifyPathSql(modelsDir = MODELS_DIR) {
    const inventory = fs.readFileSync(path.join(modelsDir, '..', '02-event-inventory.sql'), 'utf8');
    const match = inventory.match(/^CREATE TEMP FUNCTION classify_path\(path STRING\) AS \([\s\S]*?^\);$/m);
    if (!match) throw new Error('02-event-inventory.sql: classify_path function not found');
    return match[0];
}

// The rum-pilot revision rule (highest revision, then latest event), taken verbatim so it exists once.
export function rumLatestRevisionSql(modelsDir = MODELS_DIR) {
    const report = fs.readFileSync(path.join(modelsDir, '..', '..', '..', '..', 'perf', 'rum-pilot', 'report.sql'), 'utf8');
    const match = report.match(/^ {2}QUALIFY ROW_NUMBER\(\) OVER \([\s\S]*?^ {2}\) = 1$/m);
    if (!match) throw new Error('perf/rum-pilot/report.sql: revision QUALIFY clause not found');
    return match[0];
}

function isIsoDay(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const byKey = key => (a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0);

// docs/data-contracts.md, blog-index-data v2: [id, title, authorIndex, date, w, h, excerpt, readingTime, categoryIndexes, …].
// categoryIndexes[0] is the build's primary category. (expandCompactPosts re-sorts categories, so it is not used here.)
export function articleMetadata(index) {
    if (!index || index.v !== 2 || !Array.isArray(index.p)) throw new Error('blog-index-data: expected compact v2 with rows in "p"');
    const seen = new Set();
    return index.p.map(row => {
        const id = row[0];
        if (typeof id !== 'string' || !id) throw new Error('blog-index-data: row without an article id');
        if (seen.has(id)) throw new Error(`blog-index-data: duplicate article id ${id}`);
        seen.add(id);
        const primary = Array.isArray(row[8]) ? (index.c || [])[row[8][0]] : undefined;
        const author = Number.isInteger(row[2]) ? (index.a || [])[row[2]] : undefined;
        return {
            article_id: id,
            title: typeof row[1] === 'string' && row[1] ? row[1] : null,
            published_day: isIsoDay(row[3]) ? row[3] : null,
            primary_category: typeof primary === 'string' && primary ? primary : null,
            author: typeof author === 'string' && author ? author : null
        };
    }).sort(byKey('article_id'));
}

// URL forms of one id: raw, percent-encoded as browsers send it, and with lower-case hex.
export function articleKeys(id) {
    const encoded = encodeURIComponent(id);
    return [...new Set([id, encoded, encoded.replace(/%[0-9A-F]{2}/g, hex => hex.toLowerCase())])];
}

export function articleAliases(articles, retired) {
    const live = new Set(articles.map(article => article.article_id));
    const rows = [];
    for (const id of live) for (const key of articleKeys(id)) rows.push({ article_key: key, article_id: id, retired: false });
    for (const { id, target } of retired) {
        if (live.has(id)) throw new Error(`retired-articles: ${id} is still a live article`);
        if (!live.has(target)) throw new Error(`retired-articles: target ${target} of ${id} is not in the index`);
        for (const key of articleKeys(id)) rows.push({ article_key: key, article_id: target, retired: true });
    }
    const keys = new Set();
    for (const row of rows) {
        if (keys.has(row.article_key)) throw new Error(`article key ${row.article_key} maps to more than one article`);
        keys.add(row.article_key);
    }
    return rows.sort(byKey('article_key'));
}

// Catalog coverage: articles per category and author, and how many rows lack each field.
export function catalogSummary(articles, aliases) {
    const tally = values => Object.fromEntries([...values.reduce((map, value) => map.set(value, (map.get(value) || 0) + 1), new Map())]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1)));
    const unknown = value => value ?? '(unknown)';
    return {
        articles: articles.length,
        article_keys: aliases.length,
        retired_keys: aliases.filter(alias => alias.retired).length,
        by_primary_category: tally(articles.map(article => unknown(article.primary_category))),
        by_author: tally(articles.map(article => unknown(article.author))),
        missing: Object.fromEntries(['title', 'published_day', 'primary_category', 'author']
            .map(field => [field, articles.filter(article => article[field] === null).length]))
    };
}

// GoogleSQL quoted string; backslash escapes cover quotes, backslashes and control characters.
export function sqlString(value) {
    if (value === null || value === undefined) return 'NULL';
    return `'${String(value)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/[\u0000-\u001f]/g, c => `\\x${c.charCodeAt(0).toString(16).padStart(2, '0')}`)}'`;
}

export function lookupSql(articles) {
    const rows = articles.map(a => `  (${sqlString(a.article_id)}, ${sqlString(a.title)}, ${a.published_day ? `DATE '${a.published_day}'` : 'NULL'}, ${sqlString(a.primary_category)}, ${sqlString(a.author)})`);
    return `  SELECT * FROM UNNEST(ARRAY<STRUCT<article_id STRING, title STRING, published_day DATE, primary_category STRING, author STRING>>[\n${rows.join(',\n')}\n  ])`;
}

export function aliasSql(aliases) {
    const rows = aliases.map(a => `  (${sqlString(a.article_key)}, ${sqlString(a.article_id)}, ${a.retired ? 'TRUE' : 'FALSE'})`);
    return `  SELECT * FROM UNNEST(ARRAY<STRUCT<article_key STRING, article_id STRING, retired BOOL>>[\n${rows.join(',\n')}\n  ])`;
}

export function readInputs(root = REPO_ROOT) {
    const read = rel => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
    return { index: read('blog-module/blog-index-data.json'), retired: read('blog-module/retired-articles.json').retired };
}

export function buildMapping({ index, retired }) {
    const articles = articleMetadata(index);
    const aliases = articleAliases(articles, retired);
    return { articles, aliases, summary: catalogSummary(articles, aliases) };
}

export function renderModel(name, { project, property, index, retired, modelsDir = MODELS_DIR }) {
    const known = [...MODELS, ...AUDIENCE_MODELS, ...RUM_MODELS];
    if (!known.includes(name)) throw new Error(`unknown model ${name}; expected one of ${known.join(', ')}`);
    // Google Cloud project ids: 6–30 chars, lower-case letters, digits, hyphens. GA4 property ids are numeric.
    if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project || '')) throw new Error('--project must be a Google Cloud project id');
    if (!/^\d+$/.test(property || '')) throw new Error('--property must be the numeric GA4 property id');
    const { articles, aliases } = buildMapping({ index, retired });
    const fill = (text, key, value) => text.replaceAll(`{{${key}}}`, () => value); // a function keeps "$" literal
    let sql = fs.readFileSync(path.join(modelsDir, `${name}.sql`), 'utf8');
    // Bases first: they carry the function and project placeholders.
    for (const [key, file] of Object.entries(FRAGMENTS)) sql = fill(sql, key, fs.readFileSync(path.join(modelsDir, file), 'utf8').trimEnd());
    if (sql.includes('{{CLASSIFY_PATH}}')) sql = fill(sql, 'CLASSIFY_PATH', classifyPathSql(modelsDir));
    if (sql.includes('{{RUM_LATEST_REVISION}}')) sql = fill(sql, 'RUM_LATEST_REVISION', rumLatestRevisionSql(modelsDir));
    sql = fill(fill(sql, 'PROJECT_ID', project), 'GA4_PROPERTY_ID', property);
    const left = sql.match(/\{\{(?!ARTICLE_LOOKUP\}\}|ARTICLE_ALIAS\}\})[A-Z0-9_]+\}\}/);
    if (left) throw new Error(`unfilled placeholder ${left[0]} in ${name}`);
    // Data literals go in last, so article text can never be read as a placeholder.
    return fill(fill(sql, 'ARTICLE_ALIAS', aliasSql(aliases)), 'ARTICLE_LOOKUP', lookupSql(articles));
}

function main(argv) {
    const [command, model, ...rest] = argv;
    const options = Object.fromEntries(rest.map(arg => arg.match(/^--([a-z]+)=(.*)$/)).filter(Boolean).map(m => [m[1], m[2]]));
    if (command === 'metadata') {
        process.stdout.write(`${JSON.stringify(buildMapping(readInputs()), null, 2)}\n`);
    } else if (command === 'render') {
        process.stdout.write(renderModel(model, { ...readInputs(), project: options.project, property: options.property }));
    } else {
        process.stderr.write('usage: editorial-model.mjs metadata | render <model> --project=<id> --property=<numeric id>\n');
        process.exitCode = 2;
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
