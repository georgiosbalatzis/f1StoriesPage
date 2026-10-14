import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateRoute, routeMetrics } from '../../perf/lighthouse-guard.mjs';

test('DOM budget reads legacy and Lighthouse 13 audit values', () => {
    for (const id of ['dom-size', 'dom-size-insight']) {
        const metrics = routeMetrics({ audits: { [id]: { numericValue: 1500 } } });
        assert.equal(metrics['dom-size'], 1500);
        assert.deepEqual(evaluateRoute({ thresholds: { 'dom-size': 1800 } }, metrics).failures, []);
        assert.deepEqual(evaluateRoute({ thresholds: { 'dom-size': 1400 } }, metrics).failures, ['dom-size: 1500.000 > 1400']);
    }
});

test('missing or invalid DOM metrics still fail the budget', () => {
    for (const audits of [{}, { 'dom-size-insight': { numericValue: null } }]) {
        assert.deepEqual(evaluateRoute({ thresholds: { 'dom-size': 1800 } }, routeMetrics({ audits })).failures,
            ['dom-size: missing Lighthouse metric']);
    }
});
