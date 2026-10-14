const assert = require('node:assert/strict');
const test = require('node:test');
const T = require('../../taxonomy');

test('isDay accepts only real calendar days', () => {
    assert.equal(T.isDay('2026-10-12'), true);
    assert.equal(T.isDay('2028-02-29'), true);
    for (const bad of ['', null, undefined, '2026-13-01', '2026-02-30', '2027-02-29', '2026-1-1', '20261012', '2026-10-12T00:00:00', 'soon']) {
        assert.equal(T.isDay(bad), false, String(bad));
    }
});

test('addDays moves across months, years and leap days', () => {
    assert.equal(T.addDays('2026-10-12', -6), '2026-10-06');
    assert.equal(T.addDays('2026-10-03', -6), '2026-09-27');
    assert.equal(T.addDays('2027-01-02', -6), '2026-12-27');
    assert.equal(T.addDays('2028-03-01', -1), '2028-02-29');
    assert.equal(T.addDays('2026-10-12', -365), '2025-10-12');
});

test('a story is NEW for seven calendar days, the publication day included', () => {
    const today = '2026-10-12';
    assert.equal(T.isNewStory('2026-10-12', today), true);
    assert.equal(T.isNewStory('2026-10-06', today), true, 'the 7th day still counts');
    assert.equal(T.isNewStory('2026-10-05', today), false, 'the 8th day does not');
    assert.equal(T.newUntil('2026-10-06'), '2026-10-12', 'last NEW day = publication day + 6');
    assert.equal(T.isNewStory('2026-10-12', T.newUntil('2026-10-06')), true);
    assert.equal(T.isNewStory('2026-10-06', T.addDays(T.newUntil('2026-10-06'), 1)), false);
});

test('NEW is never claimed for a future, missing or malformed date', () => {
    assert.equal(T.isNewStory('2026-10-13', '2026-10-12'), false, 'future (scheduled or mis-typed)');
    assert.equal(T.isNewStory('', '2026-10-12'), false);
    assert.equal(T.isNewStory(undefined, '2026-10-12'), false);
    assert.equal(T.isNewStory('2026-02-31', '2026-10-12'), false);
    assert.equal(T.isNewStory('2026-10-12', ''), false, 'no reference day, no NEW');
});

test('athensDay is the calendar day in Athens, not the machine time zone', () => {
    // 22:30 UTC on 12 Oct is already 13 Oct in Athens (UTC+3 in summer time).
    assert.equal(T.athensDay(new Date('2026-10-12T22:30:00Z')), '2026-10-13');
    assert.equal(T.athensDay(new Date('2026-10-12T20:59:00Z')), '2026-10-12');
    // Winter time (UTC+2): 22:30 UTC on 12 Jan is 13 Jan 00:30 in Athens.
    assert.equal(T.athensDay(new Date('2027-01-12T22:30:00Z')), '2027-01-13');
});

test('Athens midnight and both DST transitions use calendar days, not elapsed hours', () => {
    for (const [instant, day] of [
        ['2026-10-12T20:59:59Z', '2026-10-12'], ['2026-10-12T21:00:00Z', '2026-10-13'],
        ['2027-01-12T21:59:59Z', '2027-01-12'], ['2027-01-12T22:00:00Z', '2027-01-13'],
        ['2026-03-29T00:59:59Z', '2026-03-29'], ['2026-03-29T01:00:00Z', '2026-03-29'],
        ['2026-10-25T00:59:59Z', '2026-10-25'], ['2026-10-25T01:00:00Z', '2026-10-25']
    ]) assert.equal(T.athensDay(new Date(instant)), day, instant);
    for (const publication of ['2026-03-26', '2026-10-22']) {
        assert.equal(T.isNewStory(publication, T.addDays(publication, 6)), true);
        assert.equal(T.isNewStory(publication, T.addDays(publication, 7)), false);
    }
});

test('month names and pagination windows', () => {
    assert.equal(T.monthName('2026-10'), 'Οκτώβριος 2026');
    assert.equal(T.monthShort('2026-05'), 'ΜΑΪ');
    assert.deepEqual(T.pageItems(1, 1), [1]);
    assert.deepEqual(T.pageItems(3, 6), [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(T.pageItems(1, 14), [1, 2, '…', 14]);
    assert.deepEqual(T.pageItems(7, 14), [1, '…', 6, 7, 8, '…', 14]);
    assert.deepEqual(T.pageItems(14, 14), [1, '…', 13, 14]);
    assert.equal(T.plural(1, 'ιστορία', 'ιστορίες'), '1 ιστορία');
    assert.equal(T.plural(0, 'ιστορία', 'ιστορίες'), '0 ιστορίες');
});

test('section identifiers stay the stable category kinds', () => {
    // These identifiers are public URLs (/blog-module/blog/section/<kind>/): changing one breaks shared links.
    assert.deepEqual(T.PUBLIC_CATEGORIES.map(T.categoryKind), ['news', 'analysis', 'technical', 'history', 'opinion', 'betting', 'drivers', 'teams']);
    assert.equal(T.PUBLIC_CATEGORIES.includes('2026'), false, '2026 is a tag, never a section');
});
