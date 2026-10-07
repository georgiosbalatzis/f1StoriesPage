import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.document = { getElementById: () => null };
globalThis.window = {};
const { buildLapTimeAxisValues, buildTyrePaceSvg, buildTyrePaceSessionData } = await import('../../tabs/tyre-pace.js');

const laps = durations => durations.map((duration, index) => ({ duration, lapNumber: index + 1, compound: index % 2 ? 'SOFT' : 'HARD' }));
const circles = svg => Array.from(svg.matchAll(/<circle[^>]*cx="([\d.]+)" cy="([\d.]+)"/g), match => ({ x: Number(match[1]), y: Number(match[2]) }));

test('axis ticks stay readable across mixed wet and dry pace ranges', () => {
    for (const [min, max] of [[98.22, 234.025], [90.1, 97.8], [108.702, 112.884], [91, 91]]) {
        const ticks = buildLapTimeAxisValues(min, max);
        assert.ok(ticks.length <= 10);
        assert.ok(ticks[0] <= min);
        assert.ok(ticks[ticks.length - 1] >= max);
        assert.ok(ticks.every((tick, index) => index === 0 || tick > ticks[index - 1]));
    }
    assert.deepEqual(buildLapTimeAxisValues(NaN, NaN), []);
});

test('density stays within each driver’s observed times and uses the team colour', () => {
    const svg = buildTyrePaceSvg(laps([91, 92, 92.1, 92.2, 94]), 90, 100, 'FF8000');
    assert.match(svg, /class="tyre-pace-violin".*fill="#ff8000"/);
    const coordinates = Array.from(svg.match(/d="M ([^"]+)"/)[1].matchAll(/([\d.]+),([\d.]+)/g), match => ({ x: Number(match[1]), y: Number(match[2]) }));
    assert.equal(coordinates[0].x, 42);
    assert.equal(coordinates[96].x, 42);
    assert.ok(coordinates.every(point => point.x >= 12 && point.x <= 72 && point.y >= 285.6 && point.y <= 422.4));
    assert.doesNotMatch(svg, /NaN|Infinity/);
});

test('every lap keeps its exact vertical time, including nearly identical laps', () => {
    const durations = [91, 91.005, 91.01, 91.015, 91.02, 91.025, 91.03, 91.035, 91.04, 91.045, 91.05];
    const points = circles(buildTyrePaceSvg(laps(durations), 90, 100, 'FF8000'));
    assert.equal(points.length, durations.length);
    points.forEach((point, index) => {
        assert.ok(Math.abs(point.y - (12 + (100 - durations[index]) / 10 * 456)) <= 0.0051);
        assert.ok(point.x >= 15 && point.x <= 69);
    });
    for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) assert.ok(Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y) >= 4.6);
    }
});

test('median is calculated from laps rather than the midpoint of the observed range', () => {
    const odd = buildTyrePaceSvg(laps([90, 91, 99]), 90, 100, 'FF8000');
    const even = buildTyrePaceSvg(laps([90, 91, 93, 99]), 90, 100, 'FF8000');
    assert.match(odd, /class="tyre-pace-median"[^>]*y1="422.40"/);
    assert.match(even, /class="tyre-pace-median"[^>]*y1="376.80"/);
    assert.match(odd, /Διάμεσος 1:31.000/);
});

test('empty, single-lap and constant-time samples do not invent a density', () => {
    assert.equal(buildTyrePaceSvg([], 90, 100, 'FF8000'), '');
    for (const durations of [[91], [91, 91, 91]]) {
        const svg = buildTyrePaceSvg(laps(durations), 91, 91, 'FF8000');
        assert.doesNotMatch(svg, /tyre-pace-violin|NaN|Infinity/);
        assert.equal(circles(svg).length, durations.length);
    }
});

test('dense samples retain all lap markers with deterministic positions and tyre tooltips', () => {
    const sample = laps(Array(60).fill(91));
    const svg = buildTyrePaceSvg(sample, 90, 100, 'FF8000');
    assert.equal(circles(svg).length, 60);
    assert.equal(svg, buildTyrePaceSvg(sample.slice().reverse(), 90, 100, 'FF8000'));
    assert.match(svg, /Hard · Γύρος 1 · 1:31.000/);
    assert.match(svg, /Soft · Γύρος 2 · 1:31.000/);
});

test('session samples exclude pit laps and slow outliers while retaining tyre assignments', () => {
    const session = { session_key: 42 };
    const drivers = [{ session_key: 42, driver_number: 4, name_acronym: 'NOR', full_name: 'Lando Norris', team_name: 'McLaren' }];
    const samples = [90, 91, 110, 93, 120, 92, 94].map((duration, index) => ({ driver_number: 4, lap_number: index + 2, lap_duration: duration, is_pit_out_lap: index === 4 }));
    const stints = [{ driver_number: 4, stint_number: 1, lap_start: 2, lap_end: 5, compound: 'MEDIUM' }, { driver_number: 4, stint_number: 2, lap_start: 6, lap_end: 8, compound: 'HARD' }];
    const data = buildTyrePaceSessionData(session, drivers, samples, stints);
    assert.deepEqual(data.rows[0].laps.map(lap => [lap.lapNumber, lap.compound]), [[2, 'MEDIUM'], [3, 'MEDIUM'], [7, 'HARD'], [8, 'HARD']]);
    assert.equal(data.validLapCount, 4);
    assert.equal(data.minTime, 90);
    assert.equal(data.maxTime, 94);
});

test('wet laps are filtered against the same driver and compound, not a dry-tyre best', () => {
    const session = { session_key: 42 };
    const drivers = [4, 12].map(driver_number => ({ session_key: 42, driver_number, name_acronym: String(driver_number) }));
    const samples = [110, 114, 130, 90, 92, 110].map((lap_duration, index) => ({ driver_number: 4, lap_number: index + 2, lap_duration }));
    samples.push({ driver_number: 12, lap_number: 2, lap_duration: 140 });
    const stints = [
        { driver_number: 4, stint_number: 1, lap_start: 2, lap_end: 4, compound: 'INTERMEDIATE' },
        { driver_number: 4, stint_number: 2, lap_start: 5, lap_end: 7, compound: 'SOFT' },
        { driver_number: 12, stint_number: 1, lap_start: 2, lap_end: 2, compound: 'INTERMEDIATE' }
    ];
    const data = buildTyrePaceSessionData(session, drivers, samples, stints);
    assert.deepEqual(data.rows[0].laps.map(lap => [lap.duration, lap.compound]), [[110, 'INTERMEDIATE'], [114, 'INTERMEDIATE'], [90, 'SOFT'], [92, 'SOFT']]);
    assert.deepEqual(data.rows[1].laps.map(lap => lap.duration), [140]);
    assert.equal(data.validLapCount, 5);
    assert.equal(data.maxTime, 140);
    const svg = buildTyrePaceSvg(data.rows[0].laps, data.minTime, data.maxTime, '00D2BE');
    assert.equal((svg.match(/fill="rgb\(16, 185, 129\)"/g) || []).length, 2);
});

test('standing-start and explicitly incomplete sector records are excluded before pace filtering', () => {
    const samples = [160, 234, 112, 90, 240, 101].map((lap_duration, index) => ({
        driver_number: 12, lap_number: index + 1, lap_duration,
        duration_sector_1: lap_duration / 3, duration_sector_2: lap_duration / 3, duration_sector_3: lap_duration / 3
    }));
    samples[1].duration_sector_3 = null;
    samples[4].duration_sector_2 = 0;
    for (const field of ['duration_sector_1', 'duration_sector_2', 'duration_sector_3']) delete samples[5][field];
    const data = buildTyrePaceSessionData({ session_key: 42 }, [{ session_key: 42, driver_number: 12 }], samples, [
        { driver_number: 12, stint_number: 1, lap_start: 1, lap_end: 3, compound: 'INTERMEDIATE' },
        { driver_number: 12, stint_number: 2, lap_start: 4, lap_end: 6, compound: 'SOFT' }
    ]);
    assert.deepEqual(data.rows[0].laps.map(lap => lap.lapNumber), [3, 4, 6]);
    assert.equal(data.maxTime, 112);
    assert.ok(data.rows[0].laps.some(lap => lap.compound === 'INTERMEDIATE'));
});
