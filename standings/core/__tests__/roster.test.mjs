import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRosterByNumber } from '../roster.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const snapshot = JSON.parse(fs.readFileSync(path.join(root, 'standings', 'standings-cache.json'), 'utf8'));
const roster = buildRosterByNumber(snapshot.driverStandings);

// The committed snapshot names every current driver by car number, in the shape the headshot lookup expects.
assert.ok(Object.keys(roster).length >= 20, 'roster covers the grid');
assert.equal(roster[12].acronym, 'ANT');
assert.equal(roster[12].lastName, 'Antonelli');
assert.match(roster[12].fullName, /ANTONELLI$/, 'family name upper-cased like OpenF1 full_name');
assert.equal(roster[12].teamName, 'Mercedes');
assert.ok(roster[12].constructorId, 'constructor id kept for the team colour');
for (const entry of Object.values(roster)) {
    assert.ok(entry.acronym.length === 3 && entry.fullName && entry.teamName, `incomplete roster entry #${entry.driverNumber}`);
}

// Malformed or missing payloads give an empty roster instead of throwing.
for (const bad of [null, undefined, {}, { MRData: {} }, { MRData: { StandingsTable: { StandingsLists: [] } } }]) {
    assert.deepEqual(buildRosterByNumber(bad), {});
}
// Drivers without a usable number are skipped.
const partial = buildRosterByNumber({ MRData: { StandingsTable: { StandingsLists: [{ DriverStandings: [
    { Driver: { givenName: 'No', familyName: 'Number', code: 'NON' }, Constructors: [] },
    { Driver: { permanentNumber: '7', givenName: 'Test', familyName: 'Driver', code: 'tst' }, Constructors: [{ name: 'Team', constructorId: 'team' }] }
] }] } } });
assert.deepEqual(Object.keys(partial), ['7']);
assert.equal(partial[7].acronym, 'TST');
