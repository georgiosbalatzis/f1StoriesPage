const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { extract, decode, buildResearchContent } = require('../research-content');

const wrap = body => `<html><div class="rr-body article-content" data-body>${body}</div><p>Outside</p></html>`;
test('extracts legacy prose, headings and nested list items with source locators and single-pass entities', () => {
    const result = extract(wrap('<h2 id="section-1">Heading &amp; title</h2><p>Legacy <b>text</b> &amp;lt; &#x3b1; &mdash;</p><ul><li>Parent<ul><li>Child</li></ul> ending</li></ul>'));
    assert.deepEqual(result.headings, [{ text: 'Heading & title', id: 'section-1' }]);
    assert.deepEqual(result.passages.map(p => [p.kind, p.ordinal, p.heading, p.text]), [
        ['heading', 0, 0, 'Heading & title'], ['paragraph', 1, 0, 'Legacy text &lt; α —'],
        ['list-item', 2, 0, 'Parent ending'], ['list-item', 3, 0, 'Child']
    ]);
    assert.equal(decode('&amp;copy; &copy; &#169;'), '&copy; © ©');
    assert.equal(decode('S&eacute;bastien&nbsp;&Agrave; &uuml; &lsquo;x&rsquo; &ldquo;y&rdquo; &ndash; &hellip; &euro; &unknown;'), 'Sébastien À ü ‘x’ “y” – … € &unknown;');
    assert.equal(extract(wrap('<p>S&eacute;bastien&nbsp;Buemi</p>')).passages[0].text, 'Sébastien Buemi');
    assert.equal(decode('&amp; &copy; &quot; &gt; &lt; &mdash; &#65; &#x3b1; &#0; &#xD800; &#1114112; &unknown;'), '& © " > < — A α � � � &unknown;');
});
test('excludes script, styles, hidden, table, gallery, related, author and tool chrome, retaining ordinals', () => {
    const body = '<script>"</div><p>fake</p>"</script><style>.x {content:"</div>"}</style><!-- <p>comment</p> -->' +
        '<template><p>template</p></template><nav><p>navigation</p></nav><footer><p>footer</p></footer>' +
        '<section class="rr-data"><h2>tool</h2><p>tool text</p></section><div class="betcast-article-block"><p>widget</p></div>' +
        '<div class="gallery-carousel"><p>gallery</p></div><div class="rr-related"><p>related</p></div>' +
        '<div class="rr-pitwall"><p>author</p></div><p hidden>hidden</p><table><tr><td><p>table</p></td></tr></table><p>Visible</p>';
    const result = extract(wrap(body));
    assert.deepEqual(result.passages.map(p => p.text), ['Visible']);
    assert.ok(result.passages[0].ordinal > 5);
});
test('rejects missing or malformed owned wrapper', () => {
    assert.equal(extract('<div class="article-content" data-body><p>x</p></div>').error, 'missing-body');
    assert.equal(extract('<div class="rr-body article-content" data-body><p>unclosed').error, 'malformed-body');
    assert.equal(extract(wrap('<script>unclosed')).error, 'malformed-body');
    assert.deepEqual(extract('<script>"<div class=\"rr-body article-content\" data-body><p>fake</p></div>"</script>' + wrap('<p>real</p>')).passages.map(p => p.text), ['real']);
});
test('build is deterministic, changes only one shard and manifest, and never writes article pages', t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'research-content-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const index = Buffer.from(JSON.stringify({ v: 2, p: [['20260101A', '', 0, '2026-01-01'], ['20260201B', '', 0, '2026-02-01'], ['20270101C', '', 0, '2027-01-01']] }));
    const article = id => path.join(root, 'blog-module/blog-entries', id, 'article.html');
    for (const id of ['20260101A', '20260201B']) {
        fs.mkdirSync(path.dirname(article(id)), { recursive: true });
        fs.writeFileSync(article(id), wrap('<p>A sufficiently long piece of published article prose here.</p>'));
    }
    const directory = path.join(root, 'scripts/author/research-content');
    const files = () => Object.fromEntries(fs.readdirSync(directory).sort().map(name => [name, fs.readFileSync(path.join(directory, name), 'utf8')]));
    const beforeArticle = fs.readFileSync(article('20260101A'));
    const manifest = buildResearchContent(root, index, '2026-10-29');
    assert.equal(manifest.coverage.eligible, 2); assert.equal(manifest.coverage.searchableProse, 2);
    const first = files(); buildResearchContent(root, index, '2026-10-29'); assert.deepEqual(files(), first);
    assert.deepEqual(fs.readFileSync(article('20260101A')), beforeArticle);
    fs.writeFileSync(article('20260101A'), wrap('<p>Changed sufficiently long published article prose here.</p>'));
    const changedArticle = fs.readFileSync(article('20260101A'));
    buildResearchContent(root, index, '2026-10-29');
    const second = files();
    assert.deepEqual(Object.keys(first).filter(name => first[name] !== second[name]), ['2026-01.json', 'manifest.json']);
    assert.deepEqual(fs.readFileSync(article('20260101A')), changedArticle);
    fs.writeFileSync(path.join(directory, '2020-01.json'), '{}'); buildResearchContent(root, index, '2026-10-29');
    assert.equal(fs.existsSync(path.join(directory, '2020-01.json')), false);
});
test('rejects oversized shards and excludes invalid or future identities', t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'research-limit-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const file = path.join(root, 'blog-module/blog-entries/20260101A/article.html');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, wrap('<p>' + 'x'.repeat(500001) + '</p>'));
    const index = Buffer.from(JSON.stringify({ v: 2, p: [['../unsafe', '', 0, '2026-01-01'], ['future', '', 0, '2027-01-01'], ['bad', '', 0, '2026-02-30'], ['20260101A', '', 0, '2026-01-01']] }));
    assert.throws(() => buildResearchContent(root, index, '2026-10-29'), /exceeds size limit/);
});
