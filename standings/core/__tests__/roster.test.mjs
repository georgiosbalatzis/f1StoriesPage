import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRosterByNumber, loadDriverRoster, supplementDriverRecords, teamDisplayName } from '../roster.js';

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

// Team names follow OpenF1's spelling, not Jolpica's.
const teamNames = Object.fromEntries(Object.values(roster).map(e => [e.constructorId, e.teamName]));
assert.equal(teamNames.rb, 'Racing Bulls');
assert.equal(teamNames.red_bull, 'Red Bull Racing');
assert.equal(teamNames.haas, 'Haas F1 Team');
assert.equal(teamNames.alpine, 'Alpine');
assert.equal(teamNames.cadillac, 'Cadillac');
assert.equal(teamDisplayName('unknown_team', 'Some Team'), 'Some Team', 'unknown constructors keep their Jolpica name');

// Supplement: only sessions OpenF1 did not answer for are filled.
const real = { session_key: 1, driver_number: 12, full_name: 'Kimi ANTONELLI', name_acronym: 'ANT', team_name: 'Mercedes' };
const merged = supplementDriverRecords([real], [1, 2], roster);
assert.equal(merged.filter(r => r.session_key === 1).length, 1, 'an answered session is untouched');
assert.equal(merged.filter(r => r.session_key === 1)[0], real);
const filled = merged.filter(r => r.session_key === 2);
assert.equal(filled.length, Object.keys(roster).length, 'an unanswered session gets the full roster');
assert.ok(filled.every(r => r.driver_number && r.full_name && r.name_acronym && r.team_name));
assert.deepEqual(supplementDriverRecords(null, [5], {}), [], 'no roster, no records');
assert.deepEqual(supplementDriverRecords([real], [1, 2], {}), [real]);

// loadDriverRoster never rejects
assert.deepEqual(await loadDriverRoster(() => Promise.reject(new Error('down'))), {});
assert.equal((await loadDriverRoster(() => Promise.resolve(snapshot)))[12].acronym, 'ANT');

// Diacritics are dropped from the family name, matching OpenF1 ("PEREZ", not "PÉREZ").
const accented = buildRosterByNumber({ MRData: { StandingsTable: { StandingsLists: [{ DriverStandings: [
    { Driver: { permanentNumber: '11', givenName: 'Sergio', familyName: 'Pérez', code: 'PER' }, Constructors: [{ name: 'Cadillac F1 Team', constructorId: 'cadillac' }] }
] }] } } });
assert.equal(accented[11].fullName, 'Sergio PEREZ');

// With activity, only drivers who took part in the session are filled in.
const lapsOf = [{ session_key: 9, driver_number: 12 }, { session_key: 9, driver_number: 63 }, { session_key: 8, driver_number: 1 }];
const limited = supplementDriverRecords([], [9], roster, lapsOf);
assert.deepEqual(limited.map(r => r.driver_number).sort((a, b) => a - b), [12, 63], 'only session 9 participants');
assert.equal(supplementDriverRecords([], [9], roster, []).length, 0, 'empty activity fills nothing');
