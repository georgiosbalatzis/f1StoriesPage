import assert from 'node:assert/strict';
import test from 'node:test';
import { sessionWindowCls } from '../../perf/tablet-cls-guard.mjs';

const shift = (startTime, value, hadRecentInput = false) => ({ startTime, value, hadRecentInput });

test('CLS is the largest session window, not the sum of every shift', () => {
    assert.equal(sessionWindowCls([]), 0);
    // 0.01 + 0.015 within a second form one window (0.025); a shift 2 s later starts a new one.
    assert.equal(sessionWindowCls([shift(1000, 0.01), shift(1500, 0.015), shift(3600, 0.012)]), 0.025);
    // A window closes after 5 s even when shifts keep arriving under a second apart.
    const steady = Array.from({ length: 12 }, (_, i) => shift(i * 900, 0.004));
    assert.ok(Math.abs(sessionWindowCls(steady) - 0.024) < 1e-9);
    // Order of entries does not matter.
    assert.equal(sessionWindowCls([shift(1500, 0.015), shift(1000, 0.01)]), 0.025);
});

test('shifts right after user input do not count', () => {
    assert.equal(sessionWindowCls([shift(1000, 0.3, true), shift(1200, 0.005)]), 0.005);
});

test('a gap of exactly one second starts a new CLS session', () => {
    assert.equal(sessionWindowCls([shift(0, 0.01), shift(1000, 0.02)]), 0.02);
});
