const test = require('node:test');
const assert = require('node:assert/strict');
const { briefingDocument, exportHtml, exportText } = require('../briefings/export');
const { tags, decodeEntities } = require('../html-attributes');

const items = [
    { id: '20261026A', title: `Άρθρο < & " ' $& $'`, author: 'SYNTHETIC TEST', date: '2026-10-26', rationale: 'ά και α\u0301', context: true },
    { id: '20261027A', title: 'Δεύτερο', author: 'SYNTHETIC TEST', date: '2026-10-27', rationale: 'Δεύτερη αιτία' }
];
const selected = { eligible: false, edition: { id: '2026-w44', title: 'Τίτλος', description: 'Περιγραφή', opening: ['Εισαγωγή'], closing: ['Τέλος'] },
    period: { week: 44, start: '2026-10-26', end: '2026-11-01' }, sections: [{ heading: 'Ενότητα', intro: 'Πλαίσιο', items }] };

test('exports retain reading order, literal Unicode and safe markup', () => {
    const doc = briefingDocument(selected);
    const html = exportHtml(doc), text = exportText(doc);
    assert.equal(doc.draft, true);
    assert.equal(doc.sections[0].items[0].context, true);
    assert.equal(doc.sections[0].items[1].context, false);
    assert.match(html, /^<!doctype html>/);
    assert.match(text, /^ΠΡΟΣΧΕΔΙΟ — δεν έχει εγκριθεί για δημοσίευση/);
    assert.match(html, /ΠΡΟΣΧΕΔΙΟ — δεν έχει εγκριθεί για δημοσίευση/);
    const parsed = tags(html);
    assert.ok(parsed.every(tag => ['html', 'meta', 'title', 'body', 'h1', 'h2', 'p', 'ol', 'li', 'a', 'strong', 'span'].includes(tag.name)));
    assert.ok(parsed.filter(tag => !tag.close).every(tag => Object.keys(tag.attrs).every(key => ['lang', 'charset', 'href'].includes(key))));
    const decoded = decodeEntities(html.replace(/<[^>]+>/g, ' '));
    let htmlAt = 0, textAt = 0;
    for (const item of doc.sections[0].items) {
        assert.match(item.url, /^https:\/\/f1-stories\.gr\//);
        for (const value of [item.title, item.rationale, item.url]) {
            htmlAt = decoded.indexOf(value, htmlAt); textAt = text.indexOf(value, textAt);
            assert.ok(htmlAt >= 0 && textAt >= 0, value);
            htmlAt += value.length; textAt += value.length;
        }
    }
    assert.ok(html.includes('ά και α\u0301') && text.includes('ά και α\u0301'));
    assert.doesNotMatch(html + text, /unsubscribe|newsletter|\{\{/i);
    assert.doesNotMatch(text, /\r/);
    assert.ok(text.endsWith('\n'));
    assert.equal(exportHtml(doc), html);
    assert.equal(exportText(doc), text);
    const approved = briefingDocument({ ...selected, eligible: true });
    assert.doesNotMatch(exportHtml(approved) + exportText(approved), /ΠΡΟΣΧΕΔΙΟ/);
});
