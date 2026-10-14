import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

// The masthead countdown falls back to this inline calendar whenever the live schedule is unavailable.
// It must stay equal to the published race START times, checked here through real time-zone conversion.
const source = fs.readFileSync(new URL('../../shared-nav.js', import.meta.url), 'utf8');
const literal = source.slice(source.indexOf('var FALLBACK_RACES = ') + 'var FALLBACK_RACES = '.length, source.indexOf('];', source.indexOf('var FALLBACK_RACES')) + 1);
const fallback = JSON.parse(JSON.stringify(vm.runInNewContext(literal))); // plain objects: vm arrays carry another realm's prototype
const { rounds } = JSON.parse(fs.readFileSync(new URL('./fixtures/f1-2026-race-starts.json', import.meta.url), 'utf8'));

// Wall-clock time of an instant in an IANA zone, "YYYY-MM-DDTHH:mm".
function localIn(zone, ms) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
        timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).formatToParts(new Date(ms)).map(p => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

test('fallback calendar has every round of the season, once, in order', () => {
    assert.equal(fallback.length, rounds.length);
    const instants = fallback.map(r => Date.parse(r.date));
    assert.ok(instants.every(Number.isFinite), 'every date parses');
    assert.ok(fallback.every(r => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00Z$/.test(r.date)), 'explicit UTC instants');
    assert.deepEqual([...instants].sort((a, b) => a - b), instants, 'chronological');
    assert.equal(new Set(instants).size, instants.length, 'no duplicate instant');
});

test('every fallback race starts at its published local time in the venue time zone', () => {
    rounds.forEach((expected, index) => {
        const entry = fallback[index];
        assert.equal(localIn(expected.zone, Date.parse(entry.date)), expected.local,
            `round ${expected.round} ${expected.event}: ${entry.name} ${entry.date} is not ${expected.local} in ${expected.zone}`);
    });
});

test('round 16 (Bahrain GP relocated to Malaysia) is present', () => {
    assert.ok(fallback.some(r => r.date === '2026-10-04T07:00:00Z' && /Malaysia/.test(r.name)));
});

test('the Malaysian host country has its own flag for the live schedule path', () => {
    assert.match(source, /'Malaysia': '\\u\{1F1F2\}\\u\{1F1FE\}'/);
});
