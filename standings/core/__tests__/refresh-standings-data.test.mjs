import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const STUB = path.join(HERE, 'fixtures', 'refresh-fetch-stub.mjs');
const SOURCES = ['scripts/build/refresh-standings-data.mjs', 'blog-module/dirty-air-cache.js', 'standings/debrief-cache.js'];

const STANDINGS = 'standings/standings-cache.json';
const DIRTY_AIR = 'standings/dirty-air-cache.json';
const DIRTY_AIR_SPLIT = 'standings/dirty-air/9001.json';
const DIRTY_AIR_INDEX = 'standings/dirty-air/index.json';
const DEBRIEF = 'standings/debrief-cache.json';
const OPTIONAL_CACHES = [DIRTY_AIR, DIRTY_AIR_SPLIT, DIRTY_AIR_INDEX, DEBRIEF];

const cachedSession = key => ({
    session_key: key,
    date_start: '2026-03-01T14:00:00Z',
    maxLaps: 50,
    safetyCarSpans: [],
    rows: [{ driverNumber: '1', completedLaps: 50 }]
});

// The scripts resolve every output from their own location, so a copy keeps the checkout untouched.
function sandbox(t, extraDirtyAirSessions = []) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'refresh-standings-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const write = (file, value) => {
        fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        fs.writeFileSync(path.join(root, file), typeof value === 'string' ? value : JSON.stringify(value));
    };
    SOURCES.forEach(file => write(file, fs.readFileSync(path.join(REPO_ROOT, file), 'utf8')));

    const table = (key, code) => ({
        MRData: { StandingsTable: { season: '2026', StandingsLists: [{ season: '2026', round: '1', [key]: [{ code }] }] } }
    });
    write(STANDINGS, { generatedAt: 'seed', driverStandings: table('DriverStandings', 'OLD'), constructorStandings: table('ConstructorStandings', 'OLD') });
    write('standings/rounds/2026-1.json', { seed: true });
    write(DIRTY_AIR, { version: 1, year: 2026, generatedAt: 'seed', minisectors: 30, sessions: [cachedSession(9001), ...extraDirtyAirSessions] });
    write(DIRTY_AIR_SPLIT, cachedSession(9001));
    write(DIRTY_AIR_INDEX, { version: 1, year: 2026, generatedAt: 'seed', sessions: [{ session_key: 9001 }] });
    write(DEBRIEF, { version: 2, season: 2026, generatedAt: 'seed', rounds: [{ round: 1, singleLap: [{ code: 'OLD', lapTime: '1:30.000' }] }] });
    return root;
}

function refresh(root, stub = {}, args = []) {
    const calls = path.join(root, 'calls.log');
    const result = spawnSync(
        process.execPath,
        ['--import', STUB, path.join(root, SOURCES[0]), '--year', '2026', ...args],
        { encoding: 'utf8', env: { ...process.env, STUB_DIRTY_AIR_KEYS: '9001', STUB_CALLS: calls, ...stub } }
    );
    const lines = result.stdout.trim().split('\n');
    return { ...result, finalLine: lines[lines.length - 1], calls: fs.existsSync(calls) ? fs.readFileSync(calls, 'utf8') : '' };
}

const read = (root, file) => fs.readFileSync(path.join(root, file), 'utf8');
const snapshot = (root, files) => Object.fromEntries(files.map(file => [file, read(root, file)]));
const standingsRefreshed = root => JSON.parse(read(root, STANDINGS)).generatedAt !== 'seed';
const debriefRefreshed = root => JSON.parse(read(root, DEBRIEF)).rounds[0].singleLap[0].code === 'NEW';
const dirtyAirRan = result => result.stdout.includes('Dirty air cache saved');

function assertPartial(result, ...stages) {
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.finalLine, /PARTIAL/);
    assert.match(result.stdout, /^::warning .*PARTIAL/m);
    stages.forEach(stage => assert.ok(result.finalLine.includes(stage), `${stage} missing from: ${result.finalLine}`));
}

test('all stages succeed: exit 0, full success reported, no warning', t => {
    const root = sandbox(t);
    const result = refresh(root);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(standingsRefreshed(root));
    assert.ok(dirtyAirRan(result));
    assert.ok(debriefRefreshed(root));
    assert.doesNotMatch(result.stdout, /PARTIAL|::warning/);
    assert.match(result.finalLine, /all stages succeeded/);
});

test('Dirty Air failure keeps standings, still runs Debrief, reports PARTIAL', t => {
    const root = sandbox(t);
    const before = snapshot(root, [DIRTY_AIR, DIRTY_AIR_SPLIT, DIRTY_AIR_INDEX]);
    const result = refresh(root, { STUB_FAIL: 'dirty-air' });
    assertPartial(result, 'dirty-air');
    assert.ok(!result.finalLine.includes('debrief'));
    assert.ok(standingsRefreshed(root));
    assert.ok(debriefRefreshed(root));
    assert.deepEqual(snapshot(root, Object.keys(before)), before);
    assert.match(result.stderr, /HTTP 404/);
});

test('Debrief failure keeps standings and the Dirty Air refresh, reports PARTIAL', t => {
    const root = sandbox(t);
    const before = read(root, DEBRIEF);
    const result = refresh(root, { STUB_FAIL: 'debrief' });
    assertPartial(result, 'debrief');
    assert.ok(!result.finalLine.includes('dirty-air'));
    assert.ok(standingsRefreshed(root));
    assert.ok(dirtyAirRan(result));
    assert.equal(read(root, DEBRIEF), before);
    assert.match(result.stderr, /HTTP 404/);
});

test('both optional stages failing still exits 0 and names both', t => {
    const root = sandbox(t);
    const before = snapshot(root, OPTIONAL_CACHES);
    const result = refresh(root, { STUB_FAIL: 'dirty-air,debrief' });
    assertPartial(result, 'dirty-air', 'debrief');
    assert.ok(standingsRefreshed(root));
    assert.deepEqual(snapshot(root, OPTIONAL_CACHES), before);
});

test('primary fetch failure exits non-zero, writes nothing, skips optional stages', t => {
    const root = sandbox(t);
    const files = [STANDINGS, ...OPTIONAL_CACHES];
    const before = snapshot(root, files);
    const result = refresh(root, { STUB_FAIL: 'primary' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /HTTP 404/);
    assert.deepEqual(snapshot(root, files), before);
    assert.doesNotMatch(result.calls, /openf1/);
});

test('primary empty standings for the cached season fail without overwriting', t => {
    const root = sandbox(t);
    const before = read(root, STANDINGS);
    const result = refresh(root, { STUB_EMPTY: 'primary' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /empty standings/);
    assert.equal(read(root, STANDINGS), before);
});

test('an empty Dirty Air API response cannot wipe the cache or its split files', t => {
    const root = sandbox(t);
    const before = snapshot(root, [DIRTY_AIR, DIRTY_AIR_SPLIT, DIRTY_AIR_INDEX]);
    const result = refresh(root, { STUB_EMPTY: 'dirty-air' });
    assertPartial(result, 'dirty-air');
    assert.deepEqual(snapshot(root, Object.keys(before)), before);
    assert.ok(debriefRefreshed(root));
});

test('an empty Debrief API response cannot wipe the cached rounds', t => {
    const root = sandbox(t);
    const before = read(root, DEBRIEF);
    assertPartial(refresh(root, { STUB_EMPTY: 'debrief' }), 'debrief');
    assert.equal(read(root, DEBRIEF), before);
});

test('Debrief rounds that come back without lap data cannot replace populated rounds', t => {
    const root = sandbox(t);
    const before = read(root, DEBRIEF);
    assertPartial(refresh(root, { STUB_EMPTY: 'debrief-laps' }), 'debrief');
    assert.equal(read(root, DEBRIEF), before);
});

test('a different populated Dirty Air session cannot replace an existing one', t => {
    const root = sandbox(t);
    const bundle = JSON.parse(read(root, DIRTY_AIR));
    bundle.sessions = [cachedSession(9002)];
    fs.writeFileSync(path.join(root, DIRTY_AIR), JSON.stringify(bundle));
    const before = snapshot(root, [DIRTY_AIR, DIRTY_AIR_SPLIT, DIRTY_AIR_INDEX]);
    assertPartial(refresh(root), 'dirty-air');
    assert.deepEqual(snapshot(root, Object.keys(before)), before);
});

test('a different populated Debrief round cannot replace an existing one', t => {
    const root = sandbox(t);
    const cache = JSON.parse(read(root, DEBRIEF));
    cache.rounds[0].grandPrix = 'Another Grand Prix';
    fs.writeFileSync(path.join(root, DEBRIEF), JSON.stringify(cache));
    const before = read(root, DEBRIEF);
    assertPartial(refresh(root), 'debrief');
    assert.equal(read(root, DEBRIEF), before);
});

test('an invalid session key fails before any Dirty Air file is written', t => {
    const root = sandbox(t, [cachedSession('abc')]);
    const before = snapshot(root, [DIRTY_AIR, DIRTY_AIR_SPLIT, DIRTY_AIR_INDEX]);
    const result = refresh(root, { STUB_DIRTY_AIR_KEYS: '9001,abc,9002' });
    assertPartial(result, 'dirty-air');
    assert.match(result.finalLine, /unexpected session_key/);
    assert.deepEqual(snapshot(root, Object.keys(before)), before);
    assert.ok(!fs.existsSync(path.join(root, 'standings/dirty-air/9002.json')));
});

test('a single failed Dirty Air session is reported as PARTIAL', t => {
    const root = sandbox(t);
    const result = refresh(root, { STUB_DIRTY_AIR_KEYS: '9001,9002', STUB_FAIL: 'dirty-air-session' });
    assertPartial(result, 'dirty-air: 1 session failed');
    assert.equal(JSON.parse(read(root, DIRTY_AIR)).sessions[0].rows.length, 1);
});

test('a failed round snapshot is reported as PARTIAL', t => {
    const root = sandbox(t);
    fs.rmSync(path.join(root, 'standings/rounds/2026-1.json'));
    assertPartial(refresh(root, { STUB_EMPTY: 'race-name' }), 'round-snapshots');
    assert.ok(!fs.existsSync(path.join(root, 'standings/rounds/2026-1.json')));
});

test('repeated runs are safe after success and after partial failure', t => {
    const root = sandbox(t);
    assert.equal(refresh(root).status, 0);
    const afterFirst = snapshot(root, OPTIONAL_CACHES);
    assert.equal(refresh(root).status, 0);
    assert.deepEqual(snapshot(root, OPTIONAL_CACHES), afterFirst);

    for (let run = 0; run < 2; run += 1) {
        assertPartial(refresh(root, { STUB_FAIL: 'dirty-air,debrief' }), 'dirty-air', 'debrief');
        assert.deepEqual(snapshot(root, OPTIONAL_CACHES), afterFirst);
    }
});


test('empty new season replaces previous season standings', t => {
    const root = sandbox(t);
    const cache = JSON.parse(read(root, STANDINGS));
    for (const table of [cache.driverStandings, cache.constructorStandings]) table.MRData.StandingsTable.season = '2025';
    fs.writeFileSync(path.join(root, STANDINGS), JSON.stringify(cache));
    const result = refresh(root, { STUB_EMPTY: 'primary' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(read(root, STANDINGS)).driverStandings.MRData.StandingsTable.StandingsLists, []);
});

test('optional cache write failures preserve targets and clean temporary files', t => {
    for (const [target, stage] of [[DIRTY_AIR_SPLIT, 'dirty-air'], [DIRTY_AIR_INDEX, 'dirty-air'], [DIRTY_AIR, 'dirty-air'], [DEBRIEF, 'debrief']]) {
        const root = sandbox(t);
        const before = read(root, target);
        const result = refresh(root, { STUB_WRITE_FAIL: path.basename(target) });
        assertPartial(result, stage);
        assert.equal(read(root, target), before);
        assert.ok(!fs.readdirSync(path.dirname(path.join(root, target))).some(name => name.endsWith('.tmp')));
    }
});

test('Debrief retains each populated metric when stints disappear', t => {
    for (const [metric, row] of [['longRun', { avgLap: '1:30.000' }], ['tyreDeg', { deg: '0.000' }]]) {
        const root = sandbox(t);
        const cache = JSON.parse(read(root, DEBRIEF));
        cache.rounds[0][metric] = [row];
        fs.writeFileSync(path.join(root, DEBRIEF), JSON.stringify(cache));
        const before = read(root, DEBRIEF);
        const result = refresh(root);
        assertPartial(result, 'debrief');
        assert.match(result.stderr, new RegExp(metric));
        assert.equal(read(root, DEBRIEF), before);
    }
});

test('empty round standings are rejected even with force and rounds-only', t => {
    for (const empty of ['drivers', 'constructors']) {
        const root = sandbox(t);
        const file = 'standings/rounds/2026-1.json';
        const before = read(root, file);
        const result = refresh(root, { STUB_EMPTY: empty }, ['--force', '--rounds-only']);
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /1 failed/);
        assert.equal(read(root, file), before);
    }
});

test('malformed primary rows fail without replacing standings', t => {
    for (const failure of ['driver-row', 'constructor-row']) {
        const root = sandbox(t);
        const before = read(root, STANDINGS);
        const result = refresh(root, { STUB_FAIL: failure });
        assert.equal(result.status, 1);
        assert.match(result.stderr, /Malformed primary/);
        assert.equal(read(root, STANDINGS), before);
        assert.doesNotMatch(result.calls, /openf1/);
    }
});

test('a newly completed empty Dirty Air session reports PARTIAL', t => {
    const root = sandbox(t);
    const result = refresh(root, { STUB_DIRTY_AIR_KEYS: '9001,9002' });
    assertPartial(result, 'dirty-air: 1 session failed');
    assert.deepEqual(JSON.parse(read(root, DIRTY_AIR)).sessions.find(session => String(session.session_key) === '9002').rows, []);
});

test('force accepts withdrawn Dirty Air sessions and Debrief rounds with warnings', t => {
    const root = sandbox(t);
    const bundle = JSON.parse(read(root, DIRTY_AIR));
    bundle.sessions.push(cachedSession(9002));
    fs.writeFileSync(path.join(root, DIRTY_AIR), JSON.stringify(bundle));
    const cache = JSON.parse(read(root, DEBRIEF));
    cache.rounds.push({ round: 2, singleLap: [{ lapTime: '1:30.000' }] });
    fs.writeFileSync(path.join(root, DEBRIEF), JSON.stringify(cache));
    const result = refresh(root, {}, ['--force']);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /removing populated sessions: .*9002/);
    assert.match(result.stderr, /removing populated rounds or metrics: 2 singleLap/);
    assert.equal(JSON.parse(read(root, DIRTY_AIR)).sessions.length, 1);
    assert.equal(JSON.parse(read(root, DEBRIEF)).rounds.length, 1);
});
