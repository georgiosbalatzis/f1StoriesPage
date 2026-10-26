#!/usr/bin/env node
// Synthetic-fixture tests for the I-03 editorial data model. No BigQuery: SQL is checked as text, and its regular
// expressions and CASE rules are executed in JavaScript (RE2 and JS agree on the constructs used).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
    MODELS, MODELS_DIR, articleMetadata, articleKeys, articleAliases, catalogSummary, sqlString, lookupSql,
    buildMapping, readInputs, renderModel
} from '../editorial-model.mjs';

const { PUBLIC_CATEGORIES } = createRequire(import.meta.url)('../../../blog-module/taxonomy.js');
const template = name => fs.readFileSync(path.join(MODELS_DIR, `${name}.sql`), 'utf8');
const code = text => text.replace(/--.*$/gm, '');

// Synthetic compact index (docs/data-contracts.md v2). Rows deliberately unsorted.
const index = {
    v: 2,
    a: ['Writer A', 'Writer B'],
    c: ['News', 'History', 'Drivers'],
    p: [
        ['20261002B', "Title with 'quotes' and $& and {{PROJECT_ID}}", 1, '2026-10-02', 400, 188, '', '3', [2, 1]],
        ['20261001A', 'First', 0, '2026-10-01', 400, 188, '', '2', [0]],
        ['20260222T', 'Survivor', 0, '2026-02-22', 400, 188, '', '2', [1]],
        ['20260822J', 'Betcast', 1, '2026-08-22', 400, 188, '', '2', [0]],
        ['20261003C', '', 9, '2026-02-30', 400, 188, '', '1']
    ]
};
const retired = [{ id: '20260227Τ', target: '20260222T' }, { id: '20260822G', target: '20260822J' }];
const render = (name, extra = {}) => renderModel(name, { project: 'synthetic-project', property: '123', index, retired, ...extra });

test('metadata follows the compact contract and sorts deterministically', () => {
    const articles = articleMetadata(index);
    assert.deepEqual(articles.map(a => a.article_id), ['20260222T', '20260822J', '20261001A', '20261002B', '20261003C']);
    // Primary category is categoryIndexes[0], not taxonomy order (Drivers before History here).
    assert.equal(articles.find(a => a.article_id === '20261002B').primary_category, 'Drivers');
    assert.deepEqual(articles.find(a => a.article_id === '20261001A'),
        { article_id: '20261001A', title: 'First', published_day: '2026-10-01', primary_category: 'News', author: 'Writer A' });
});

test('missing or invalid metadata becomes NULL, never a guess', () => {
    const broken = articleMetadata(index).find(a => a.article_id === '20261003C');
    assert.deepEqual(broken, { article_id: '20261003C', title: null, published_day: null, primary_category: null, author: null });
    assert.throws(() => articleMetadata({ ...index, p: [...index.p, index.p[0]] }), /duplicate article id/);
    assert.throws(() => articleMetadata({ v: 1, posts: [] }), /compact v2/);
});

test('article keys cover raw, upper- and lower-case percent-encoding', () => {
    assert.deepEqual(articleKeys('20261001A'), ['20261001A']);
    assert.deepEqual(articleKeys('20260227Τ'), ['20260227Τ', '20260227%CE%A4', '20260227%ce%a4']);
});

test('retired ids resolve to their surviving article', () => {
    const aliases = articleAliases(articleMetadata(index), retired);
    const lookup = key => aliases.find(alias => alias.article_key === key);
    for (const key of ['20260227%CE%A4', '20260227%ce%a4', '20260227Τ']) assert.deepEqual(lookup(key), { article_key: key, article_id: '20260222T', retired: true });
    assert.deepEqual(lookup('20260822G'), { article_key: '20260822G', article_id: '20260822J', retired: true });
    assert.equal(lookup('20260222T').retired, false);
    assert.equal(lookup('20991231Z'), undefined);
    const articles = articleMetadata(index);
    assert.throws(() => articleAliases(articles, [{ id: '20261001A', target: '20260222T' }]), /still a live article/);
    assert.throws(() => articleAliases(articles, [{ id: '20250101X', target: '20991231Z' }]), /not in the index/);
    assert.throws(() => articleAliases([{ article_id: 'a b' }, { article_id: 'a%20b' }], []), /more than one article/);
});

test('catalog summary aggregates categories, authors and missing fields', () => {
    const { summary } = buildMapping({ index, retired });
    assert.deepEqual(summary, {
        articles: 5,
        article_keys: 9,
        retired_keys: 4,
        by_primary_category: { '(unknown)': 1, Drivers: 1, History: 1, News: 2 },
        by_author: { '(unknown)': 1, 'Writer A': 2, 'Writer B': 2 },
        missing: { title: 1, published_day: 1, primary_category: 1, author: 1 }
    });
});

test('SQL literals escape quotes, backslashes and control characters', () => {
    assert.equal(sqlString("it's \\ \n"), "'it\\'s \\\\ \\x0a'");
    assert.equal(sqlString(null), 'NULL');
    assert.match(lookupSql(articleMetadata(index)), /\('20261003C', NULL, NULL, NULL, NULL\)/);
});

test('URL parsing: base.sql host and article-key regexes, executed', () => {
    const base = code(template('base'));
    const hostPath = new RegExp(base.match(/REGEXP_EXTRACT\(page_location, r'([^']+)'\) AS page_path/)[1]);
    const articleKey = new RegExp(base.match(/REGEXP_EXTRACT\(link_path, r'([^']+)'\) AS link_key/)[1]);
    const aliases = articleAliases(articleMetadata(index), retired);
    const resolve = url => {
        const pathname = (url.match(hostPath) || [])[1];
        const key = pathname && (pathname.match(articleKey) || [])[1];
        return key ? (aliases.find(alias => alias.article_key === key) || { article_id: '(unmapped)' }).article_id : null;
    };
    const site = 'https://f1-stories.gr/blog-module/blog-entries';
    assert.equal(resolve(`${site}/20261001A/article.html?utm_source=x#top`), '20261001A');
    assert.equal(resolve(`${site}/20261001A/`), '20261001A');
    assert.equal(resolve(`${site}/20260227%CE%A4/article.html`), '20260222T');
    assert.equal(resolve(`${site}/20260822G/article.html`), '20260822J');
    assert.equal(resolve(`${site}/20991231Z/article.html`), '(unmapped)');
    for (const url of [`${site}/20261001A/1.webp`, `${site}/`, `${site}/a/b/article.html`, 'https://f1-stories.gr/',
        'http://f1-stories.gr/blog-module/blog-entries/20261001A/article.html',
        'https://www.f1-stories.gr/blog-module/blog-entries/20261001A/article.html',
        'http://localhost:8080/blog-module/blog-entries/20261001A/article.html',
        'https://f1-stories.gr.example.com/blog-module/blog-entries/20261001A/article.html']) {
        assert.equal(resolve(url), null, url);
    }
});

test('classification: discovery source surfaces and publication-age buckets, executed', () => {
    const rules = [...code(template('13-article-discovery')).matchAll(/WHEN REGEXP_CONTAINS\(e\.page_path, r'([^']+)'\) THEN '([^']+)'/g)]
        .map(([, source, label]) => [new RegExp(source), label]);
    const surface = p => (rules.find(([re]) => re.test(p)) || [null, 'other'])[1];
    assert.deepEqual(['/', '/index.html', '/blog-module/blog-entries/x/article.html', '/blog-module/blog/entities/drivers/x/',
        '/blog-module/blog/', '/authors/x/', '/standings/', '/telemetry/'].map(surface),
    ['home', 'home', 'article', 'entity_hub', 'edition', 'authors', 'standings', 'other']);

    const ageSql = code(template('14-publication-age'));
    const thresholds = [...ageSql.matchAll(/WHEN age_days < (\d+) THEN '([^']+)'/g)].map(([, n, label]) => [Number(n), label]);
    const bucket = age => age === null ? 'unknown' : ((thresholds.find(([n]) => age < n) || [0, ageSql.match(/ELSE '([^']+)'/)[1]])[1]);
    assert.deepEqual(thresholds.map(([n]) => n), [...thresholds.map(([n]) => n)].sort((a, b) => a - b), 'ascending');
    assert.deepEqual([null, -1, 0, 1, 2, 6, 7, 29, 30, 89, 90, 364, 365].map(bucket),
        ['unknown', 'before_publication', 'day_0', 'day_1', 'days_2_6', 'days_2_6', 'days_7_29', 'days_7_29',
            'days_30_89', 'days_30_89', 'days_90_364', 'days_90_364', 'days_365_plus']);
});

test('every model renders read-only, bounded, consented, primary-host SQL', () => {
    const FORBIDDEN = /\b(user_pseudo_id|user_id|ga_session_id|user_properties|geo|device|traffic_source|collected_traffic_source|page_referrer|link_text|message|stack)\b/i;
    const WRITES = /\b(INSERT|UPDATE|DELETE|MERGE|TRUNCATE|DROP|ALTER|CREATE|GRANT|EXPORT|LOAD|CALL)\b/i;
    const base = code(template('base'));
    assert.match(base, /_TABLE_SUFFIX BETWEEN FORMAT_DATE\('%Y%m%d', @start_day\)\s+AND FORMAT_DATE\('%Y%m%d', LEAST\(@end_day, DATE_ADD\(@start_day, INTERVAL 89 DAY\), DATE_SUB\(@as_of_day, INTERVAL 4 DAY\)\)\)/);
    assert.match(base, /analytics_storage = 'Yes' AND page_path IS NOT NULL/);
    assert.equal(base.match(/events_\*/g).length, 1);
    for (const name of MODELS) {
        const text = code(template(name));
        assert.ok(!FORBIDDEN.test(text) && !FORBIDDEN.test(base), `${name}: minimized field`);
        assert.ok(!WRITES.test(text) && !WRITES.test(base), `${name}: write or DDL`);
        assert.match(text, name === '15-coverage' ? /FROM resolved r/ : /FROM editorial\b/, `${name}: source CTE`);
        if (name !== '15-coverage') assert.doesNotMatch(text, /FROM resolved\b/, `${name}: bypasses editorial`);
        const sql = render(name);
        assert.doesNotMatch(sql.replace(/'(?:[^'\\]|\\.)*'/g, "''"), /\{\{/, `${name}: placeholder left`);
        assert.ok(sql.includes('`synthetic-project.analytics_123.events_*`'), name);
        assert.equal(sql, render(name), `${name}: deterministic`);
    }
});

test('rendering keeps article text literal and validates inputs', () => {
    const sql = render('10-article-pageviews');
    assert.ok(sql.includes("'Title with \\'quotes\\' and $& and {{PROJECT_ID}}'"));
    assert.equal(render('11-category-pageviews', { index: { ...index, p: [...index.p].reverse() } }), render('11-category-pageviews'));
    assert.throws(() => render('99-unknown'), /unknown model/);
    assert.throws(() => render('10-article-pageviews', { project: 'Bad_Project' }), /project id/);
    assert.throws(() => render('10-article-pageviews', { property: 'G-X68J6MQKSM' }), /numeric/);
});

test('committed index and retired map satisfy the model invariants', () => {
    const { articles, aliases, summary } = buildMapping(readInputs());
    assert.ok(articles.length > 0);
    assert.deepEqual(summary.missing, { title: 0, published_day: 0, primary_category: 0, author: 0 });
    assert.ok(articles.every(a => PUBLIC_CATEGORIES.includes(a.primary_category)));
    assert.equal(new Set(aliases.map(a => a.article_key)).size, aliases.length);
    assert.equal(aliases.find(a => a.article_key === '20260227%CE%A4').article_id, '20260222T');
    assert.equal(aliases.find(a => a.article_key === '20260822G').article_id, '20260822J');
});
