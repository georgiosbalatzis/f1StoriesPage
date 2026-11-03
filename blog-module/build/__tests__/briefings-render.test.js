const test = require('node:test');
const assert = require('node:assert/strict');
const { renderBriefing, renderBriefingsIndex, briefingsAsideHtml } = require('../briefings/render');
const { periodLabel } = require('../briefings/export');

const posts = [
    { id: '20261026A', title: `Πρώτο < & " ' $& $'`, author: 'SYNTHETIC TEST', date: '2026-10-26', rationale: `Λόγος < & " ' $& $'` },
    { id: '20261027A', title: 'Δεύτερο', author: 'SYNTHETIC TEST', date: '2026-10-27', rationale: 'Αναδρομή', context: true }
];
const selected = { edition: { id: '2026-w44', title: 'Τίτλος', description: 'Περιγραφή', opening: ['Αρχή'], closing: ['Τέλος'] },
    period: { year: 2026, week: 44, start: '2026-10-26', end: '2026-11-01' },
    sections: [{ heading: 'Ενότητα', intro: 'Εισαγωγή', items: [posts[0]] }, { heading: 'Άλλη', items: [posts[1]] }], posts, lastmod: '2026-11-02', eligible: true };
const deps = { storyImage: () => '', renderStoryImage: () => '' };

test('periods include Greek month and year boundaries', () => {
    assert.equal(periodLabel(selected.period), 'Εβδομάδα 44 · 26 Οκτωβρίου – 1 Νοεμβρίου 2026');
    assert.equal(periodLabel({ week: 45, start: '2026-11-02', end: '2026-11-08' }), 'Εβδομάδα 45 · 2 – 8 Νοεμβρίου 2026');
    assert.equal(periodLabel({ week: 53, start: '2026-12-28', end: '2027-01-03' }), 'Εβδομάδα 53 · 28 Δεκεμβρίου 2026 – 3 Ιανουαρίου 2027');
});

test('edition has ordered headings, literal escaped rationale and matching structured data', () => {
    const page = renderBriefing(selected, { deps });
    assert.equal((page.main.match(/<h1\b/g) || []).length, 1);
    assert.deepEqual([...page.main.matchAll(/<h([123])\b/g)].map(m => m[1]), ['1', '2', '3', '2', '3']);
    assert.match(page.main, /Λόγος &lt; &amp; &quot; &#39; \$&amp; \$&#39;/);
    assert.match(page.main, /Για αναδρομή/);
    assert.ok(page.main.indexOf('Πρώτο') < page.main.indexOf('Δεύτερο'));
    const schema = JSON.parse(page.head.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
    const list = schema['@graph'].find(x => x['@type'] === 'ItemList');
    assert.deepEqual(list.itemListElement.map(x => x.name), posts.map(x => x.title));
    assert.deepEqual(list.itemListElement.map(x => x.position), [1, 2]);
    assert.equal(page.file, 'briefing/2026-w44/index.html');
    assert.doesNotMatch(page.head + page.main, /noindex|ΠΡΟΣΧΕΔΙΟ/);
    const preview = renderBriefing(selected, { deps, preview: true });
    assert.match(preview.head, /noindex, nofollow/);
    assert.match(preview.main, /ΠΡΟΣΧΕΔΙΟ — δεν έχει εγκριθεί για δημοσίευση/);
});

test('index sorts newest first and aside is conditional', () => {
    const older = { ...selected, edition: { ...selected.edition, id: '2026-w43', title: 'Παλιά' } };
    const page = renderBriefingsIndex([older, selected]);
    assert.ok(page.main.indexOf('Τίτλος') < page.main.indexOf('Παλιά'));
    const schema = JSON.parse(page.head.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
    assert.deepEqual(schema['@graph'][1].itemListElement.map(x => x.name), ['Τίτλος', 'Παλιά']);
    assert.equal(briefingsAsideHtml([]), '');
    assert.match(briefingsAsideHtml([{ href: '/test/', label: 'Έκδοση & άλλη' }]), /Όλες οι εκδόσεις.*Έκδοση &amp; άλλη/);
    assert.match(renderBriefingsIndex([], { preview: true }).main, /ΠΡΟΣΧΕΔΙΟ/);
});
