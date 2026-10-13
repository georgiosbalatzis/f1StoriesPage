const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const T = require('../../taxonomy');
const source = fs.readFileSync(path.join(__dirname, '../../blog-index.js'), 'utf8');

function retainedMarks(instant, untils) {
    const marks = untils.map(until => ({ removed: false, getAttribute: () => until, remove() { this.removed = true; } }));
    const main = { classList: { contains: () => true }, querySelectorAll: () => marks, querySelector: () => null, addEventListener() {} };
    const document = { documentElement: {}, getElementById: id => id === 'main' ? main : null, addEventListener() {} };
    vm.runInNewContext(source, {
        window: { F1S_TAXONOMY: { ...T, athensDay: () => T.athensDay(new Date(instant)) } }, document, navigator: {}
    });
    return marks.map(mark => !mark.removed);
}

test('browser drops invalid, missing, future and exactly seven-day-old static NEW labels', () => {
    // Reader on 12 Oct: published on 12, 6, 5, 13 Oct, plus invalid/missing dates.
    assert.deepEqual(retainedMarks('2026-10-12T12:00:00Z',
        ['2026-10-18', '2026-10-12', '2026-10-11', '2026-10-19', '2026-02-31', '', null]),
    [true, true, false, false, false, false, false]);
    assert.deepEqual(retainedMarks('2026-11-12T12:00:00Z', ['2026-10-18', '2026-10-12']), [false, false]);
});

test('browser expiry changes at Athens midnight across summer, winter and DST weeks', () => {
    for (const [before, after, until] of [
        ['2026-10-12T20:59:59Z', '2026-10-12T21:00:00Z', '2026-10-12'],
        ['2027-01-12T21:59:59Z', '2027-01-12T22:00:00Z', '2027-01-12'],
        ['2026-03-29T20:59:59Z', '2026-03-29T21:00:00Z', '2026-03-29'],
        ['2026-10-25T21:59:59Z', '2026-10-25T22:00:00Z', '2026-10-25']
    ]) {
        assert.deepEqual(retainedMarks(before, [until]), [true], before);
        assert.deepEqual(retainedMarks(after, [until]), [false], after);
    }
});
