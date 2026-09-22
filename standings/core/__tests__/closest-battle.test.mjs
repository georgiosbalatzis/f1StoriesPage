import test from 'node:test';
import assert from 'node:assert/strict';

// standings-polish.js looks up its panels at module load; a minimal stub is enough here.
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
const { findClosestBattle } = await import('../../standings-polish.js');

const row = (name, points) => ({ name, points: String(points) });

test('a zero-point tie at the back is not the closest battle', () => {
    const rows = [row('A', 292), row('B', 211), row('C', 191), row('D', 186), row('E', 167),
        row('F', 145), row('G', 120), row('H', 71), row('I', 60), row('J', 40),
        row('K', 12), row('L', 5), row('M', 0), row('N', 0)];
    const battle = findClosestBattle(rows);
    assert.equal(battle.current.name, 'D');
    assert.equal(battle.ahead.name, 'C');
    assert.equal(battle.gap, 5);
});

test('falls back to P1–P2 when no scoring pair exists in the top 10', () => {
    const rows = [row('A', 0), row('B', 0), row('C', 0)];
    const battle = findClosestBattle(rows);
    assert.equal(battle.ahead.name, 'A');
    assert.equal(battle.current.name, 'B');
});
