#!/usr/bin/env node
// Tests for the dry-run command helper used by docs/intelligence/bigquery-validation.md. Nothing here contacts BigQuery.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MODELS, AUDIENCE_MODELS, RUM_MODELS, renderModel, queryParameters, dryRunCommand } from '../editorial-model.mjs';

const index = { v: 2, a: ['Writer'], c: ['News'], p: [['20261001A', "It's @ 'quoted'", 0, '2026-10-01', 400, 188, '', '1', [0]]] };
const ids = { project: 'f1-stories-analytics', property: '485678890', index, retired: [] };
const PHASE_1 = { start_day: '2026-10-19', end_day: '2026-10-22', as_of_day: '2026-10-26', report_timezone: 'Europe/Athens',
    period: 'day', min_events: '30', min_observations: '30' };

test('every model references exactly its documented parameters', () => {
    const window = ['as_of_day', 'end_day', 'start_day'];
    const expected = name => {
        if (['15-coverage', '29-audience-coverage'].includes(name)) return window;
        if (name === '33-rum-coverage') return [...window, 'report_timezone'];
        if (RUM_MODELS.includes(name)) return [...window, 'min_observations', ...(name === '32-cwv-trend' ? ['period'] : []), 'report_timezone'];
        return [...window, 'min_events'];
    };
    for (const name of [...MODELS, ...AUDIENCE_MODELS, ...RUM_MODELS]) {
        assert.deepEqual(queryParameters(renderModel(name, ids)), expected(name).sort(), name);
    }
});

test('parameters inside comments and string literals are ignored', () => {
    assert.deepEqual(queryParameters("-- @commented\nSELECT 'a @quoted \\' @still', @used, @used FROM t WHERE x = @other"), ['other', 'used']);
});

test('printed commands only ever dry-run, in EU, with typed parameters', () => {
    for (const name of [...MODELS, ...AUDIENCE_MODELS, ...RUM_MODELS]) {
        const command = dryRunCommand(name, { ...ids, values: PHASE_1 });
        assert.match(command, /\| bq query --dry_run --location=EU --use_legacy_sql=false --project_id=f1-stories-analytics /, name);
        assert.doesNotMatch(command, /maximum_bytes_billed|--dry_run=false|[;&`$<>]/, `${name}: executes or is shell-unsafe`);
        for (const parameter of queryParameters(renderModel(name, ids))) assert.ok(command.includes(`--parameter=${parameter}:`), `${name}: ${parameter}`);
    }
    assert.match(dryRunCommand('32-cwv-trend', { ...ids, values: PHASE_1 }), /--parameter=period:STRING:day/);
    assert.match(dryRunCommand('30-cwv-summary', { ...ids, values: PHASE_1 }), /--parameter=report_timezone:STRING:Europe\/Athens/);
    assert.doesNotMatch(dryRunCommand('15-coverage', { ...ids, values: PHASE_1 }), /min_events/);
});

test('missing, invalid or shell-unsafe values are refused', () => {
    const attempt = (name, values) => () => dryRunCommand(name, { ...ids, values: { ...PHASE_1, ...values } });
    assert.throws(attempt('10-article-pageviews', { start_day: '2026-10-19; rm -rf /' }), /invalid value for @start_day/);
    assert.throws(attempt('10-article-pageviews', { min_events: '30 && echo' }), /invalid value for @min_events/);
    assert.throws(attempt('30-cwv-summary', { report_timezone: 'Europe/Athens $(id)' }), /invalid value for @report_timezone/);
    assert.throws(attempt('32-cwv-trend', { period: 'month' }), /invalid value for @period/);
    assert.throws(attempt('20-daily-activity', { as_of_day: undefined }), /missing or invalid value for @as_of_day/);
    assert.throws(() => dryRunCommand('10-article-pageviews', { ...ids, project: 'Bad;Project', values: PHASE_1 }), /project id/);
});
