#!/usr/bin/env node
// Synthetic tests for the I-04 audience, acquisition and engagement models. No BigQuery: SQL is checked as text,
// and the allowlist functions, I-01 path classes and host rule are executed in JavaScript from the SQL itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { AUDIENCE_MODELS, MODELS_DIR, classifyPathSql, renderModel } from '../editorial-model.mjs';

const read = name => fs.readFileSync(path.join(MODELS_DIR, name), 'utf8');
const code = text => text.replace(/--.*$/gm, '');
const base = code(read('audience-base.sql'));
const functions = code(read('audience-functions.sql'));
const model = name => code(read(`${name}.sql`));
const index = { v: 2, a: ['Writer'], c: ['News'], p: [['20261001A', 'Synthetic', 0, '2026-10-01', 400, 188, '', '1', [0]]] };
const render = name => renderModel(name, { project: 'synthetic-project', property: '123', index, retired: [] });

// Executes one allowlist function from audience-functions.sql. Unknown rule shapes throw, so none is skipped.
function sqlFunction(name) {
    const block = functions.match(new RegExp(`CREATE TEMP FUNCTION ${name}\\(value STRING\\) AS \\(\\s*CASE([\\s\\S]*?)END\\s*\\);`));
    assert.ok(block, `function ${name}`);
    const rules = block[1].trim().split('\n').map(line => line.trim()).map(line => {
        let m;
        if ((m = line.match(/^WHEN value IS NULL OR TRIM\(value\) = '' THEN '([^']+)'$/))) return { blank: m[1] };
        if ((m = line.match(/^WHEN REGEXP_CONTAINS\(LOWER\(TRIM\(value\)\), r'([^']+)'\) THEN (?:'([^']+)'|(LOWER\(TRIM\(value\)\)))$/))) return { re: new RegExp(m[1]), label: m[2], passLower: !!m[3] };
        if ((m = line.match(/^ELSE (?:'([^']+)'|(TRIM\(value\)))$/))) return { otherwise: m[1], passTrim: !!m[2] };
        throw new Error(`${name}: unparsed rule ${line}`);
    });
    return value => {
        if (value === null || value.trim() === '') return rules.find(r => r.blank).blank;
        const v = value.trim().toLowerCase();
        const hit = rules.find(r => r.re && r.re.test(v));
        if (hit) return hit.passLower ? v : hit.label;
        const fallback = rules.find(r => 'otherwise' in r);
        return fallback.passTrim ? value.trim() : fallback.otherwise;
    };
}

// Executes I-01's classify_path, exactly as the renderer injects it.
function classifyPath() {
    const rules = classifyPathSql().split('\n').map(line => line.trim()).filter(line => /^(WHEN|ELSE)/.test(line)).map(line => {
        let m;
        if ((m = line.match(/^WHEN path IS NULL THEN '([^']+)'$/))) return [p => p === null, m[1]];
        if ((m = line.match(/^WHEN path IN \(([^)]+)\) THEN '([^']+)'$/))) { const set = m[1].split(',').map(s => s.trim().slice(1, -1)); return [p => set.includes(p), m[2]]; }
        if ((m = line.match(/^WHEN STARTS_WITH\(path, '([^']+)'\) THEN '([^']+)'$/))) { const prefix = m[1]; return [p => p !== null && p.startsWith(prefix), m[2]]; }
        if ((m = line.match(/^ELSE '([^']+)'$/))) return [() => true, m[1]];
        throw new Error(`classify_path: unparsed rule ${line}`);
    });
    return p => rules.find(([match]) => match(p))[1];
}

const WINDOW = /@start_day AS from_day,[\s\S]*?AS through_day/;
const SUFFIX = /_TABLE_SUFFIX BETWEEN FORMAT_DATE\('%Y%m%d', @start_day\)\s+AND FORMAT_DATE\('%Y%m%d', LEAST\(@end_day, DATE_ADD\(@start_day, INTERVAL 89 DAY\), DATE_SUB\(@as_of_day, INTERVAL 4 DAY\)\)\)/;
const HOST = /r'\^https:\/\/f1-stories\\\.gr\(\/\[\^\?#\]\*\)'/;
const CONSENT = "analytics_storage = 'Yes' AND page_path IS NOT NULL";

test('date window, maturity, host and consent rules are the I-03 base rules, verbatim', () => {
    const editorial = code(read('base.sql'));
    assert.equal(base.match(WINDOW)[0], editorial.match(WINDOW)[0]);
    assert.equal(base.match(SUFFIX)[0], editorial.match(SUFFIX)[0]);
    assert.equal(base.match(HOST)[0], editorial.match(HOST)[0]);
    assert.ok(editorial.includes(CONSENT) && base.includes(`${CONSENT} AND event_day <= through_day`));
    assert.ok(model('29-audience-coverage').includes(`(${CONSENT} AND event_day <= through_day) AS kept`));
    assert.equal(base.match(/events_\*/g).length, 1);

    const host = new RegExp(base.match(HOST)[0].slice(2, -1));
    assert.equal(('https://f1-stories.gr/standings/?utm_source=x#t'.match(host) || [])[1], '/standings/');
    for (const url of ['http://f1-stories.gr/', 'https://www.f1-stories.gr/', 'http://localhost:8080/', 'https://f1-stories.gr.example.com/']) {
        assert.equal(url.match(host), null, url);
    }
});

test('every audience model reads only through the shared base and the right CTE', () => {
    for (const name of AUDIENCE_MODELS) {
        const text = model(name);
        assert.equal(text.split('{{AUDIENCE_BASE}}').length, 2, `${name}: one base`);
        assert.ok(!text.includes('{{EDITORIAL_BASE}}') && !/events_\*/.test(text), `${name}: no second scan`);
        if (name === '29-audience-coverage') assert.match(text, /FROM events\b/);
        else assert.match(text, /FROM site\b/, name);
        if (name !== '29-audience-coverage') assert.doesNotMatch(text, /FROM events\b/, name);
        assert.doesNotMatch(text, /article_id|article_key/, `${name}: article level stays in I-03`);
    }
});

test('audience classifications: sections, device and country', () => {
    const section = classifyPath();
    assert.deepEqual(['/', '/blog-module/blog-entries/x/article.html', '/blog-module/blog/entities/drivers/x/', '/blog-module/blog/',
        '/standings/', '/authors/x/', '/privacy/privacy.html', '/telemetry/', '/ghostcar/', '/tyres/2026/x/', '/betcast/', '/x.html', null].map(section),
    ['home', 'article', 'entity_hub', 'edition', 'standings', 'authors', 'legal', 'tool_telemetry', 'tool_ghostcar', 'tool_tyres', 'tool_betcast', 'other', 'missing']);
    const device = sqlFunction('device_class');
    assert.deepEqual(['desktop', ' Mobile ', 'tablet', 'smart tv', 'console', '', null].map(device),
        ['desktop', 'mobile', 'tablet', 'smart_tv', 'other', '(unknown)', '(unknown)']);
    const country = sqlFunction('country_label');
    assert.deepEqual(['Greece', ' Cyprus ', '(not set)', '', null].map(country), ['Greece', 'Cyprus', '(unknown)', '(unknown)', '(unknown)']);
    assert.match(model('23-country'), /'\(other countries\)'/, 'small countries are merged');
    assert.doesNotMatch(model('22-device-category'), /country/, 'no device x country');
    assert.doesNotMatch(model('23-country'), /device_class/, 'no country x device');
});

test('unknown and unattributed stay unknown; nothing is labelled confirmed direct or organic', () => {
    const medium = sqlFunction('medium_class');
    const source = sqlFunction('source_family');
    const channel = sqlFunction('channel_class');
    assert.deepEqual([null, '', '(none)', '(not set)', '(data deleted)', 'organic', 'referral', 'Social', 'email', 'cpc', 'paid_social', 'weird'].map(medium),
        ['unattributed', 'unattributed', 'direct_or_unknown', 'not_set', 'data_deleted', 'organic_search_reported', 'referral', 'social', 'email', 'paid', 'paid', 'other_tagged']);
    assert.deepEqual([null, '(direct)', 'google', 'www.google.gr', 'gemini.google.com', 'm.facebook.com', 't.co', 'lnkd.in', 'wa.me', 'f1-stories.gr', 'georgiosbalatzis.github.io'].map(source),
        ['unattributed', 'direct_or_unknown', 'google', 'google', 'ai_assistant', 'facebook', 'x', 'linkedin', 'whatsapp', 'self_referral', 'legacy_site']);
    assert.deepEqual([null, 'Direct', 'Organic Search', 'Unassigned', 'Paid Search', 'AI Assistants'].map(channel),
        ['unattributed', 'direct_or_unknown', 'organic_search_reported', 'unassigned', 'paid', 'other']);
    const labels = [...functions.matchAll(/(?:THEN|ELSE) '([^']+)'/g)].map(m => m[1]);
    assert.ok(!labels.includes('direct') && !labels.includes('organic'), 'no confirmed direct/organic label');
    assert.ok(labels.filter(l => /organic/.test(l)).every(l => l.endsWith('_reported')));
});

test('untrusted strings never pass through', () => {
    const source = sqlFunction('source_family');
    for (const value of ['<script>alert(1)</script>', 'evil.example', 'box.com', 'notgoogle.com', 'google.com.evil.io', 'https://x.com/a?b']) {
        assert.equal(source(value), 'other_source', value);
    }
    assert.equal(sqlFunction('share_method')('<img onerror=1>'), 'other');
    assert.equal(sqlFunction('link_section_class')('free text'), 'other');
    // Only country_label returns its input, and only GA4's geo lookup supplies it.
    const passThrough = functions.split('CREATE TEMP FUNCTION ').slice(1).filter(block => block.includes('ELSE TRIM(value)'));
    assert.deepEqual(passThrough.map(block => block.match(/^\w+/)[0]), ['country_label']);
    // Every raw record leaf in the base is wrapped by a function or reduced to a presence test.
    const wrapped = /(?:device_class|country_label|medium_class|source_family|channel_class)\(\s*$|\($/;
    for (const m of base.matchAll(/(?<![\w.])(?:device|geo|traffic_source|collected_traffic_source|session_traffic_source_last_click)\.[\w.]+/g)) {
        const before = base.slice(0, m.index);
        const after = base.slice(m.index + m[0].length);
        assert.ok(wrapped.test(before) || /^ (?:IS NOT NULL|NOT IN \()/.test(after), `raw leaf ${m[0]}`);
    }
    for (const name of AUDIENCE_MODELS) {
        const text = model(name).replace(/classify_path\(s\.(?:page|link)_path\)/g, '').replace(/page_path IS NOT NULL/g, '');
        assert.doesNotMatch(text, /\b(?:page_path|link_path)\b/, `${name}: raw path`);
    }
});

test('privacy: only allowlisted fields and parameters are read', () => {
    const all = base + functions + AUDIENCE_MODELS.map(model).join('\n');
    assert.doesNotMatch(all, /\b(?:user_pseudo_id|user_id|ga_session_id|ga_session_number|user_properties|user_first_touch_timestamp|page_referrer|page_title|link_text|link_url|engagement_time_msec|ecommerce|items|search_term|manual_term|manual_content|campaign_id|srsltid)\b/);
    const leaves = [...base.matchAll(/(?<![\w.])((?:device|geo|traffic_source|collected_traffic_source|session_traffic_source_last_click)\.[\w.]+)/g)].map(m => m[1]);
    assert.deepEqual([...new Set(leaves)].sort(), ['collected_traffic_source.dclid', 'collected_traffic_source.gclid', 'collected_traffic_source.manual_campaign_name',
        'collected_traffic_source.manual_medium', 'collected_traffic_source.manual_source', 'device.category', 'geo.country',
        'session_traffic_source_last_click.cross_channel_campaign.default_channel_group', 'session_traffic_source_last_click.cross_channel_campaign.medium',
        'session_traffic_source_last_click.cross_channel_campaign.source', 'traffic_source.medium', 'traffic_source.name', 'traffic_source.source']);
    assert.deepEqual([...new Set([...base.matchAll(/key = '([^']+)'/g)].map(m => m[1]))].sort(), ['link_path', 'link_section', 'method', 'page_location', 'sponsored']);
});

test('acquisition scopes stay separate', () => {
    const scopes = { '24-acquisition-first-user': ['first_user', 'first_user_'], '25-acquisition-collected': ['event_collected', 'collected_'], '26-acquisition-session': ['session_last_click', 'session_'] };
    for (const [name, [scope, prefix]] of Object.entries(scopes)) {
        const text = model(name);
        assert.ok(text.includes(`'${scope}' AS attribution_scope`), name);
        const used = new Set([...text.matchAll(/s\.((?:first_user|collected|session)_\w+)/g)].map(m => m[1]));
        assert.ok(used.size > 0 && [...used].every(column => column.startsWith(prefix)), `${name}: ${[...used]}`);
    }
    for (const name of AUDIENCE_MODELS.filter(n => !(n in scopes) && n !== '29-audience-coverage')) {
        assert.doesNotMatch(model(name), /(?:first_user|collected|session)_(?:medium|source|channel|has|click)/, `${name}: no attribution`);
    }
    // Each base scope column comes from its own record only.
    for (const line of base.split('\n').filter(l => / AS (?:first_user|collected|session)_/.test(l))) {
        const scope = line.match(/ AS (first_user|collected|session)_/)[1];
        const record = { first_user: /(?<![\w.])traffic_source\./, collected: /collected_traffic_source\./, session: /session_traffic_source_last_click\./ }[scope];
        assert.match(line, record, line);
        for (const other of ['first_user', 'collected', 'session'].filter(s => s !== scope)) {
            const foreign = { first_user: /(?<![\w.])traffic_source\./, collected: /collected_traffic_source\./, session: /session_traffic_source_last_click\./ }[other];
            assert.doesNotMatch(line, foreign, line);
        }
    }
});

test('engagement and audience outputs are labelled as events, never users, sessions or durations', () => {
    const engagement = model('27-engagement-events');
    assert.match(engagement, /IN \('article_engaged', 'user_engagement', 'article_share', 'outbound_click', 'journal_search'\)/);
    assert.match(engagement, /THEN s\.share_method/);
    assert.match(engagement, /IF\(s\.sponsored, 'sponsored', 'not_sponsored'\)/);
    for (const name of AUDIENCE_MODELS) {
        for (const [, alias] of model(name).matchAll(/ AS (\w+)/g)) {
            // "first_user" names the attribution scope, not a user count.
            assert.doesNotMatch(alias.replace(/^first_user_/, ''), /user|visitor|reader|duration|bounce|retention|rate/, `${name}: ${alias}`);
            if (/session/.test(alias)) assert.ok(alias === 'session_start_events' || alias.startsWith('session_source') || alias.startsWith('session_channel'), `${name}: ${alias}`);
        }
        if (!/coverage/.test(name)) assert.match(model(name), /AS meets_min_events/, `${name}: sample flag`);
    }
});

test('coverage reports every classified field it depends on', () => {
    const coverage = model('29-audience-coverage');
    for (const field of ['device_class', 'country', 'first_user_source_family', 'collected_source_family', 'session_source_family',
        'session_channel_class', 'share_method', 'link_section', 'analytics_storage', 'page_path']) {
        assert.ok(coverage.includes(field), field);
    }
});

test('rendered SQL is deterministic, read-only and bounded', () => {
    const inventory = classifyPathSql();
    for (const name of AUDIENCE_MODELS) {
        const sql = render(name);
        assert.equal(sql, render(name), `${name}: deterministic`);
        assert.doesNotMatch(sql, /\{\{/, `${name}: placeholder left`);
        assert.ok(sql.includes(inventory), `${name}: I-01 classify_path verbatim`);
        assert.equal(sql.match(/^CREATE TEMP FUNCTION /gm).length, 8, name);
        assert.doesNotMatch(sql.replace(/^CREATE TEMP FUNCTION /gm, ''), /\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE|DROP|ALTER|CREATE|GRANT|EXPORT|LOAD|CALL|DECLARE|SET)\b/, `${name}: write`);
        assert.equal(sql.match(/events_\*/g).length, 1, `${name}: one bounded scan`);
        assert.match(sql, SUFFIX, name);
        assert.ok(sql.includes('`synthetic-project.analytics_123.events_*`'), name);
    }
});
