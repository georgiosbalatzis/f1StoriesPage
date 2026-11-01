import test from 'node:test';
import assert from 'node:assert/strict';

let instance = 0;
async function bridge() {
  return import(`../../../standings/core/race-desk-bridge.js?test=${instance++}`);
}

test('late subscriber receives latest independently accepted standings scopes and native year', async () => {
  const b = await bridge();
  const drivers = { season: '2026', round: '3' }, constructors = { season: '2026', round: '16' };
  const before = structuredClone([drivers, constructors]);
  b.setRaceDeskYear(2026);
  b.acceptRaceDeskScopes(drivers, [{}], constructors, [{}]);
  const seen = [];
  b.subscribeRaceDesk(() => seen.push(structuredClone(b.raceDeskState())));
  assert.deepEqual(seen, [[[['2026', '3'], ['2026', '16']], 2026]]);
  assert.deepEqual([drivers, constructors], before);
  drivers.round = '99';
  assert.deepEqual(b.raceDeskState()[0][0], ['2026', '3']);
  drivers.round = '3';
  b.acceptRaceDeskScopes(drivers, [{}], constructors, []);
  await Promise.resolve();
  assert.deepEqual(seen.at(-1), [[['2026', '3'], null], 2026]);
});

test('clears and empty rows cannot retain an earlier race; new updates notify one listener', async () => {
  const b = await bridge();
  b.setRaceDeskYear(2027);
  const row = {season:'2027',round:'1'};
  b.acceptRaceDeskScopes(row, [{}], row, [{}]);
  b.clearRaceDeskScopes();
  const seen = [];
  b.subscribeRaceDesk(() => seen.push(structuredClone(b.raceDeskState())));
  assert.deepEqual(seen, [[[null, null], 2027]]);
  b.acceptRaceDeskScopes(row, [], row, [{}]);
  await Promise.resolve();
  assert.deepEqual(seen.at(-1), [[null, ['2027', '1']], 2027]);
  b.clearRaceDeskScopes();
  await Promise.resolve();
  assert.deepEqual(seen.at(-1), [[null, null], 2027]);
  assert.equal(seen.length, 3);
});
