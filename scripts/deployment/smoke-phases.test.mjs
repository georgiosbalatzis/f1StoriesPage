import { test } from 'node:test';
import assert from 'node:assert/strict';
import { smokePhases } from './smoke-phases.mjs';

test('deploy skips fixture phases but retains TYRES', () => {
    assert.deepEqual(smokePhases(['--deploy']), { mode: 'deploy', themes: false, fixtureFlows: false, tyresFlows: true });
    assert.deepEqual(smokePhases([]), { mode: 'full', themes: true, fixtureFlows: true, tyresFlows: true });
});
