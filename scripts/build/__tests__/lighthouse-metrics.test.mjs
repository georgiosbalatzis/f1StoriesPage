import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateRoute, inlineCssBytes, routeMetrics } from '../../perf/lighthouse-guard.mjs';

test('DOM budget reads legacy and Lighthouse 13 audit values', () => {
    for (const id of ['dom-size', 'dom-size-insight']) {
        const metrics = routeMetrics({ audits: { [id]: { numericValue: 1500 } } });
        assert.equal(metrics['dom-size'], 1500);
        assert.deepEqual(evaluateRoute({ thresholds: { 'dom-size': 1800 } }, metrics).failures, []);
        assert.deepEqual(evaluateRoute({ thresholds: { 'dom-size': 1400 } }, metrics).failures, ['dom-size: 1500.000 > 1400']);
    }
});

test('inline CSS is measured in uncompressed bytes, separately from transferred stylesheets', () => {
    // "Ω" is two bytes in UTF-8; attributes and other elements are not CSS.
    const html = '<head><style>a{color:red}</style>\n<style media="print">b::after{content:"Ω"}</style></head><body><p style="x">t</p></body>';
    assert.equal(inlineCssBytes(html), 'a{color:red}'.length + Buffer.byteLength('b::after{content:"Ω"}'));
    assert.equal(inlineCssBytes('<link rel="stylesheet" href="/s.css">'), 0);
    const metrics = {
        ...routeMetrics({ audits: { 'resource-summary': { details: { items: [
            { resourceType: 'stylesheet', transferSize: 4321, resourceSize: 25000 }
        ] } } } }),
        'inline-css-bytes': 126407
    };
    assert.equal(metrics['route-css-bytes'], 4321);
    assert.deepEqual(evaluateRoute({ thresholds: { 'route-css-bytes': 180000, 'inline-css-bytes': 140000 } }, metrics).failures, []);
    assert.deepEqual(evaluateRoute({ thresholds: { 'route-css-bytes': 180000, 'inline-css-bytes': 120000 } }, metrics).failures,
        ['inline-css-bytes: 126407.000 > 120000']);
    assert.deepEqual(evaluateRoute({ thresholds: { 'route-css-bytes': 4000, 'inline-css-bytes': 140000 } }, metrics).failures,
        ['route-css-bytes: 4321.000 > 4000']);
    assert.deepEqual(evaluateRoute({ thresholds: { 'inline-css-bytes': 140000 } }, {}).failures,
        ['inline-css-bytes: missing Lighthouse metric']);
});

test('missing or invalid DOM metrics still fail the budget', () => {
    for (const audits of [{}, { 'dom-size-insight': { numericValue: null } }]) {
        assert.deepEqual(evaluateRoute({ thresholds: { 'dom-size': 1800 } }, routeMetrics({ audits })).failures,
            ['dom-size: missing Lighthouse metric']);
    }
});
