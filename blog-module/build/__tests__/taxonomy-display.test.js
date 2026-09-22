const test = require('node:test');
const assert = require('node:assert/strict');
const { categoryLabel, authorLabel, formatDate, formatReadingTime } = require('../../taxonomy');

test('category labels are Greek and fall back to the canonical value', () => {
    assert.equal(categoryLabel('News'), 'Ειδήσεις');
    assert.equal(categoryLabel('Technical'), 'Τεχνικά');
    assert.equal(categoryLabel('2026'), '2026');
    assert.equal(categoryLabel('Unknown'), 'Unknown');
});

test('author labels map canonical names to Greek display names', () => {
    assert.equal(authorLabel('Georgios Balatzis'), 'Γιώργος Μπαλατζής');
    assert.equal(authorLabel(' Themis Charvalis '), 'Θέμης Χαρβάλης');
    assert.equal(authorLabel('F1 Stories'), 'F1 Stories');
});

test('dates use fixed Greek month tables', () => {
    assert.equal(formatDate('2026-09-20'), '20 Σεπ 2026');
    assert.equal(formatDate('2026-05-03', 'long'), '3 Μαΐου 2026');
    assert.equal(formatDate('2026-09-20T10:00:00Z'), '20 Σεπ 2026');
    assert.equal(formatDate('not a date'), 'not a date');
});

test('reading time has one Greek format', () => {
    assert.equal(formatReadingTime('4 min'), '4 λεπτά');
    assert.equal(formatReadingTime('7 λεπ'), '7 λεπτά');
    assert.equal(formatReadingTime(1), '1 λεπτό');
    assert.equal(formatReadingTime(''), '');
});
