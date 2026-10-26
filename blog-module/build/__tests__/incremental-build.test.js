// Incremental article builds decide by input content, not file times (input-digest.js). The full npm run build:public
// sequence is covered by scripts/build/incremental-build-check.mjs (npm run test:incremental).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { CONFIG, utils } = require('../shared');
const { inputDigest, isInputDigest } = require('../input-digest');
const { classifyEntry, recordInputDigests } = require('../index');
const { processBlogEntry } = require('../worker');

const PAGE = '<img class="article-header-img" srcset="/hero-sm.webp 800w"><div class="rr-body article-content" data-body><p>Σώμα.</p></div>';
const SOURCE = text => `---\ncategory: Technical\ntags: Ferrari\ntitle: Δοκιμή\nexcerpt: Μια σύντομη περιγραφή για τη δοκιμή του incremental build χωρίς χρονοσφραγίδες.\n---\n\n${text}\n`;

function workspace(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-incremental-'));
    const original = CONFIG.BLOG_DIR;
    CONFIG.BLOG_DIR = root;
    t.after(() => { CONFIG.BLOG_DIR = original; fs.rmSync(root, { recursive: true, force: true }); });
    return root;
}
function entry(root, id, files) {
    const dir = path.join(root, id);
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, data] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
        fs.writeFileSync(path.join(dir, name), data);
    }
    return dir;
}
// Every file in the folder gets the same time, newest last if given: what a checkout or a later restamp leaves.
function stamp(dir, newest = 'article.html') {
    const t = new Date('2026-10-01T12:00:00Z');
    for (const name of fs.readdirSync(dir)) if (fs.statSync(path.join(dir, name)).isFile()) fs.utimesSync(path.join(dir, name), t, t);
    if (newest) fs.utimesSync(path.join(dir, newest), new Date(t.getTime() + 60_000), new Date(t.getTime() + 60_000));
}
const recorded = dir => ({ id: path.basename(dir), inputDigest: inputDigest(dir) });
const action = (dir, cached) => classifyEntry(dir, { cachedPostsById: new Map(cached ? [[cached.id, cached]] : []) }).action;

test('A: an edited source is rebuilt even when the page is newer, and the new text reaches the page', async t => {
    const root = workspace(t);
    const dir = entry(root, '20261020G', { 'source.txt': SOURCE('Πρώτη εκδοχή του κειμένου.') });
    await processBlogEntry(dir);
    const cached = recorded(dir);
    stamp(dir);
    assert.equal(action(dir, cached), 'skip', 'unchanged and recorded: skipped');

    fs.writeFileSync(path.join(dir, 'source.txt'), SOURCE('Δεύτερη εκδοχή του κειμένου.'));
    stamp(dir);
    assert.ok(fs.statSync(path.join(dir, 'article.html')).mtimeMs > fs.statSync(path.join(dir, 'source.txt')).mtimeMs);
    assert.equal(action(dir, cached), 'build');
    await processBlogEntry(dir);
    const html = fs.readFileSync(path.join(dir, 'article.html'), 'utf8');
    assert.match(html, /Δεύτερη εκδοχή του κειμένου\./);
    assert.doesNotMatch(html, /Πρώτη εκδοχή/);
});

test('B and H: changed bytes with preserved or equal timestamps are rebuilt; unchanged ones are not', t => {
    const root = workspace(t);
    const dir = entry(root, '20261021G', { 'source.txt': SOURCE('Κείμενο.'), 'article.html': PAGE });
    const cached = recorded(dir);
    stamp(dir, null);
    assert.equal(action(dir, cached), 'skip', 'checkout: equal times, same content');
    const before = fs.statSync(path.join(dir, 'source.txt'));
    fs.writeFileSync(path.join(dir, 'source.txt'), SOURCE('Κείμενο!'));
    fs.utimesSync(path.join(dir, 'source.txt'), before.atime, before.mtime);
    assert.equal(action(dir, cached), 'build', 'same mtime, different bytes');
});

test('C: unchanged inputs skip, the digest is stable and ignores build outputs, file order and file times', t => {
    const root = workspace(t);
    const dir = entry(root, '20261022G', { 'source.txt': SOURCE('Κείμενο.'), 'article.html': PAGE, '1.webp': 'image-one', '3.webp': 'image-three' });
    const digest = inputDigest(dir);
    assert.ok(isInputDigest(digest));
    assert.equal(inputDigest(dir), digest, 'repeatable');
    for (const [name, data] of [['article.html', `${PAGE}<!-- restamped -->`], ['1-card.webp', 'v'], ['1-mobile.webp', 'v'], ['1-sm.avif', 'v'],
        ['1.avif', 'v'], ['3-thumb.webp', 'v'], ['embeds/telemetry-0123456789abcdef0123-wideDark.svg', 'v'], ['.DS_Store', 'v']]) {
        fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
        fs.writeFileSync(path.join(dir, name), data);
    }
    stamp(dir, '1.webp');
    assert.equal(inputDigest(dir), digest, 'outputs and times do not count');
    assert.equal(action(dir, { id: '20261022G', inputDigest: digest }), 'skip');
    // A copy elsewhere (another checkout) has the same identity.
    const copy = entry(root, '20261023G', {});
    fs.cpSync(dir, copy, { recursive: true });
    assert.equal(inputDigest(copy), digest);
});

test('D: a DOCX source change is detected and DOCX keeps precedence over TXT', t => {
    const root = workspace(t);
    const dir = entry(root, '20261024G', { 'story.docx': 'docx-bytes-v1', 'notes.txt': 'σημειώσεις', 'article.html': PAGE });
    assert.equal(utils.findSourceDocument(fs.readdirSync(dir)), 'story.docx');
    const cached = recorded(dir);
    stamp(dir);
    assert.equal(action(dir, cached), 'skip');
    fs.writeFileSync(path.join(dir, 'story.docx'), 'docx-bytes-v2');
    stamp(dir);
    assert.equal(action(dir, cached), 'build');
    // Replacing the source document with another file is a change too.
    fs.renameSync(path.join(dir, 'story.docx'), path.join(dir, 'renamed.docx'));
    fs.writeFileSync(path.join(dir, 'renamed.docx'), 'docx-bytes-v1');
    assert.equal(action(dir, cached), 'build');
});

test('E: source-less legacy pages and cached galleries are reused as before and get no digest', t => {
    const root = workspace(t);
    const legacy = entry(root, '20250405G', { 'article.html': PAGE, '1.webp': 'image' });
    const posts = [{ id: '20250405G' }];
    const classifications = new Map([['20250405G', classifyEntry(legacy, { cachedPostsById: new Map([['20250405G', posts[0]]]) })]]);
    assert.equal(classifications.get('20250405G').action, 'reuse-cached');
    recordInputDigests(posts, classifications, new Set());
    assert.equal(posts[0].inputDigest, undefined);
    assert.equal(fs.readFileSync(path.join(legacy, 'article.html'), 'utf8'), PAGE);
});

test('F: media, CSV, embed and telemetry-bundle edits rebuild; touching an unchanged image does not', t => {
    const root = workspace(t);
    const dir = entry(root, '20261025G', { 'source.txt': SOURCE('Κείμενο.'), 'article.html': PAGE, '3.webp': 'image-v1',
        'data.csv': 'a,b\n1,2\n', 'widget.html': '<div data-f1s-raw-widget>v1</div>', 'embeds/lap.f1embed.json': '{"v":1}' });
    const cached = recorded(dir);
    stamp(dir);
    fs.utimesSync(path.join(dir, '3.webp'), new Date(), new Date());
    assert.equal(action(dir, cached), 'skip', 'a touched but unchanged image is not a change');
    for (const [name, data] of [['3.webp', 'image-v2'], ['data.csv', 'a,b\n1,3\n'], ['widget.html', '<div data-f1s-raw-widget>v2</div>'], ['embeds/lap.f1embed.json', '{"v":2}']]) {
        const original = fs.readFileSync(path.join(dir, name));
        fs.writeFileSync(path.join(dir, name), data);
        stamp(dir);
        assert.equal(action(dir, cached), 'build', `${name} changed`);
        fs.writeFileSync(path.join(dir, name), original);
    }
    fs.writeFileSync(path.join(dir, '4.webp'), 'new image');
    assert.equal(action(dir, cached), 'build', 'an added image');
    // The page-content checks still apply: a page without its responsive hero is rebuilt.
    fs.rmSync(path.join(dir, '4.webp'));
    fs.writeFileSync(path.join(dir, 'article.html'), '<p>no hero</p>');
    assert.equal(action(dir, cached), 'build');
});

test('G: a record without a digest is rebuilt whatever the file times, then records it; bad digests are not trusted', t => {
    const root = workspace(t);
    // A source-less page whose folder has just gained a source document: the cached record has no digest and the old
    // page is newer than the new source. Restored or misleading times must not keep that page.
    const dir = entry(root, '20261026G', { 'source.txt': SOURCE('Κείμενο.'), 'article.html': PAGE });
    const legacy = { id: '20261026G' };
    for (const newest of ['article.html', 'source.txt', null]) {
        stamp(dir, newest);
        assert.equal(action(dir, legacy), 'build', `no digest, newest ${newest || 'none'}: rebuilt`);
    }
    const classifications = new Map([['20261026G', classifyEntry(dir, { cachedPostsById: new Map([['20261026G', legacy]]) })]]);
    recordInputDigests([legacy], classifications, new Set(['20261026G']));
    assert.equal(legacy.inputDigest, inputDigest(dir));
    const again = { ...legacy };
    recordInputDigests([again], classifications, new Set());
    assert.equal(again.inputDigest, legacy.inputDigest, 'stable on the next run');
    for (const newest of ['article.html', 'source.txt', null]) {
        stamp(dir, newest);
        assert.equal(action(dir, legacy), 'skip', `recorded and unchanged, newest ${newest || 'none'}: skipped`);
    }
    for (const bad of ['abc', 'A'.repeat(64), 123, null, '0'.repeat(64)]) {
        assert.equal(action(dir, { id: '20261026G', inputDigest: bad }), 'build', JSON.stringify(bad));
    }
    // A rebuilt post always records the digest of what it was built from.
    const built = { id: '20261026G', inputDigest: '0'.repeat(64) };
    recordInputDigests([built], classifications, new Set(['20261026G']));
    assert.equal(built.inputDigest, inputDigest(dir));
});

test('I: a Greek folder id keeps its path, digest identity and percent-encoded canonical', async t => {
    const root = workspace(t);
    const id = '20261027Λ';
    const dir = entry(root, id, { 'source.txt': SOURCE('Ελληνικός φάκελος.') });
    const post = await processBlogEntry(dir);
    assert.equal(post.id, id);
    const cached = recorded(dir);
    assert.equal(action(dir, cached), 'skip');
    assert.match(fs.readFileSync(path.join(dir, 'article.html'), 'utf8'),
        /<link rel="canonical" href="https:\/\/f1-stories\.gr\/blog-module\/blog-entries\/20261027%CE%9B\/article\.html">/);
    fs.appendFileSync(path.join(dir, 'source.txt'), '\nΝέα παράγραφος.\n');
    assert.equal(action(dir, cached), 'build');
});
