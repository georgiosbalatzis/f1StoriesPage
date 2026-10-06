const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { formatInline, sanitizeLinkUrl } = require('../../inline-markup');

test('[words](url) becomes a link; external links open in a new tab safely', () => {
    assert.equal(
        formatInline('Δες [το ρεπορτάζ](https://example.com/a?b=1&c=2) τώρα'),
        'Δες <a href="https://example.com/a?b=1&amp;c=2" target="_blank" rel="noopener noreferrer">το ρεπορτάζ</a> τώρα'
    );
});

test('links to f1stories.gr, site paths, anchors and mailto stay in the same tab', () => {
    assert.equal(formatInline('[x](https://f1stories.gr/standings/)'), '<a href="https://f1stories.gr/standings/">x</a>');
    assert.equal(formatInline('[x](https://www.f1stories.gr/)'), '<a href="https://www.f1stories.gr/">x</a>');
    assert.equal(formatInline('[x](/standings/?tab=drivers)'), '<a href="/standings/?tab=drivers">x</a>');
    assert.equal(formatInline('[x](#sources)'), '<a href="#sources">x</a>');
    assert.equal(formatInline('[mail](mailto:hello@f1stories.gr)'), '<a href="mailto:hello@f1stories.gr">mail</a>');
});

test('underscores and asterisks inside a URL are not treated as emphasis', () => {
    const html = formatInline('read [this](https://example.com/a_b_c/d*e*f) and _that_');
    assert.ok(html.includes('href="https://example.com/a_b_c/d*e*f"'), html);
    assert.ok(html.endsWith('and <em>that</em>'), html);
});

test('emphasis works inside the link text and around the link', () => {
    assert.equal(formatInline('[**bold** and _it_](https://example.com)'),
        '<a href="https://example.com" target="_blank" rel="noopener noreferrer"><strong>bold</strong> and <em>it</em></a>');
    assert.equal(formatInline('**see [this](https://example.com) now**'),
        '<strong>see <a href="https://example.com" target="_blank" rel="noopener noreferrer">this</a> now</strong>');
});

test('several links in one line, and one level of parentheses in a URL', () => {
    const html = formatInline('[a](https://a.example) και [b](https://en.wikipedia.org/wiki/Formula_One_(disambiguation))');
    assert.equal((html.match(/<a /g) || []).length, 2);
    assert.ok(html.includes('href="https://en.wikipedia.org/wiki/Formula_One_(disambiguation)"'), html);
});

test('unsafe or unsupported targets are never linked and stay escaped text', () => {
    for (const url of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<b>x</b>', '//evil.example/x', 'ftp://example.com/x',
        'https://user:pass@example.com/', 'vbscript:x', 'example.com/no-scheme']) {
        const html = formatInline(`[click](${url})`);
        assert.ok(!html.includes('<a '), `${url} -> ${html}`);
        assert.ok(!/href=/.test(html), `${url} -> ${html}`);
    }
    assert.equal(sanitizeLinkUrl('https://example.com/a b'), '', 'whitespace is rejected');
});

test('HTML in the label or the rest of the line is escaped', () => {
    const html = formatInline('<b>x</b> [<script>alert(1)</script>](https://example.com/?q="x")');
    assert.ok(!html.includes('<script>') && !html.includes('<b>'), html);
    assert.ok(!html.includes('"x"'), 'quotes in the URL are not allowed to break out of the attribute');
});

test('malformed or non-link brackets are left as text; image syntax is not a link', () => {
    assert.equal(formatInline('[just brackets] and (parens)'), '[just brackets] and (parens)');
    assert.equal(formatInline('[unclosed](https://example.com'), '[unclosed](https://example.com');
    assert.ok(!formatInline('![alt](https://example.com/i.png)').includes('<a '));
    assert.equal(formatInline('[](https://example.com)'), '[](https://example.com)');
});

test('existing bold/italic behaviour is unchanged', () => {
    assert.equal(formatInline('**b** __b2__ *i* _i2_ a & b'), '<strong>b</strong> <strong>b2</strong> <em>i</em> <em>i2</em> a &amp; b');
    assert.equal(formatInline(null), '');
});

test('the txt build turns links into anchors in paragraphs, headings, lists and tables', async () => {
    const { convertTxtToHtml } = require('../parse-txt');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-links-'));
    const file = path.join(dir, 'source.txt');
    fs.writeFileSync(file, [
        '---', 'category: News', 'title: T', '---', '',
        'Διάβασε [το άρθρο](https://example.com/a_b) εδώ.', '',
        '# Τίτλος με [link](https://example.com/h)', '',
        '- στοιχείο [λίστας](https://example.com/l)', '',
        '| Στήλη | Τιμή |', '|---|---|', '| [κελί](https://example.com/c) | 1 |', ''
    ].join('\n'));
    const html = await convertTxtToHtml(file);
    for (const href of ['https://example.com/a_b', 'https://example.com/h', 'https://example.com/l', 'https://example.com/c']) {
        assert.ok(html.includes(`<a href="${href}" target="_blank" rel="noopener noreferrer">`), href);
    }
    fs.rmSync(dir, { recursive: true, force: true });
});
