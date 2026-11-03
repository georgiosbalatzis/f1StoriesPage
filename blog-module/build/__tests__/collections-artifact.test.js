const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const origin = 'https://f1-stories.gr';
const prefix = 'blog-module/blog/collections/';
const article = id => `${origin}/blog-module/blog-entries/${id}/article.html`;
const collection = slug => `${origin}/${prefix}${slug}/`;
const write = (root, file, text) => { const target = path.join(root, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, text); };
const page = (url, links) => `<link rel="canonical" href="${url}"><ol>${links.map(link => `<li><a href="${link}">x</a></li>`).join('')}</ol><script type="application/ld+json">${JSON.stringify({ '@graph': [{ '@type': 'ItemList', itemListElement: links.map((url, i) => ({ position: i + 1, url })) }] })}</script>`;

test('collection artifact checks enforce membership, order, sitemap and approved links', async t => {
    const { validateCollections, collectDiscovery, newDiscovery, validateDiscoveryGraph } = await import('../../../scripts/build/validate-public-artifact.mjs');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'collections-artifact-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const posts = ['a', 'b', 'c'].map(id => ({ id, date: '2026-01-01' }));
    const selected = [{ collection: { slug: 'sample' }, posts, eligible: true }];
    const approvedFiles = new Set([prefix + 'index.html', prefix + 'sample/index.html']);
    const sitemapUrls = new Set([`${origin}/${prefix}`, collection('sample')]);
    const options = { distRoot: root, approvedFiles, selected, sitemapUrls, today: '2026-11-03' };
    write(root, 'blog-module/blog-index-data.json', JSON.stringify({ p: posts.map(post => [post.id, '', '', post.date]) }));
    for (const post of posts) write(root, `blog-module/blog-entries/${post.id}/article.html`, `<link rel="canonical" href="${article(post.id)}">`);
    write(root, prefix + 'index.html', page(`${origin}/${prefix}`, [collection('sample')]));
    write(root, prefix + 'sample/index.html', page(collection('sample'), posts.map(post => article(post.id))));
    let errors = [];
    validateCollections(errors, options);
    assert.deepEqual(errors, []);
    write(root, prefix + 'pending/index.html', 'pending');
    write(root, prefix + 'sample/index.html', page(collection('sample'), posts.slice().reverse().map(post => article(post.id))));
    errors = [];
    validateCollections(errors, { ...options, sitemapUrls: new Set([collection('pending')]) });
    assert.match(errors.join('\n'), /unapproved collection output/);
    assert.match(errors.join('\n'), /sitemap.xml/);
    assert.match(errors.join('\n'), /visible collection order/);
    assert.match(errors.join('\n'), /ItemList order/);
    const discovery = newDiscovery();
    collectDiscovery(discovery, `<a href="${collection('pending')}">pending</a>`, 'index.html');
    errors = [];
    validateDiscoveryGraph(errors, discovery, new Set(), { distRoot: root, approvedFiles: new Set(), approvedCollectionFiles: approvedFiles, today: options.today });
    assert.match(errors.join('\n'), /not an approved collection/);
    // Sol re-review: an unquoted href with zero eligible collections must still be caught.
    for (const html of ['<a href=/blog-module/blog/collections/pending/>x</a>', '<a class=x href = /blog-module/blog/collections/>x</a>',
        // Second re-review: `>` inside a quoted value, %-encoded and character-referenced paths.
        '<a title=">" href = /blog-module/blog/collections/pending/>x</a>', '<a href = /blog-module/blog/%63ollections/pending/>x</a>',
        '<a href="&#47;blog-module/blog/collections/pending/">x</a>', '<a href="&#x2F;blog-module&#47;blog/collections/pending/">x</a>']) {
        const unquoted = newDiscovery();
        collectDiscovery(unquoted, html, 'index.html');
        errors = [];
        validateDiscoveryGraph(errors, unquoted, new Set(), { distRoot: root, approvedFiles: new Set(), approvedCollectionFiles: new Set(), today: options.today });
        assert.match(errors.join('\n'), /not an approved collection/, html);
    }
    // `href=` text inside another attribute's quoted value is not the link; the first real href wins.
    const shadow = newDiscovery();
    collectDiscovery(shadow, '<a data-note=" href=/blog-module/blog/collections/pending/" href="/">Home</a>', 'x.html');
    assert.deepEqual(shadow.anchors.get('x.html'), ['index.html']);
});

// Sol final review counterexamples: unquoted/spaced attributes and URL suffixes must not pass.
test('artifact checks reject unquoted noindex, spaced refresh and non-canonical member links', async t => {
    const { validateCollections } = await import('../../../scripts/build/validate-public-artifact.mjs');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'collections-artifact-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const posts = ['a', 'b', 'c'].map(id => ({ id, date: '2026-01-01' }));
    const options = { distRoot: root, approvedFiles: new Set([prefix + 'index.html', prefix + 'sample/index.html']),
        selected: [{ collection: { slug: 'sample' }, posts, eligible: true }], sitemapUrls: new Set([`${origin}/${prefix}`, collection('sample')]), today: '2026-11-03' };
    const run = () => { const errors = []; validateCollections(errors, options); return errors.join('\n'); };
    write(root, 'blog-module/blog-index-data.json', JSON.stringify({ p: posts.map(post => [post.id, '', '', post.date]) }));
    for (const post of posts) write(root, `blog-module/blog-entries/${post.id}/article.html`, `<link rel="canonical" href="${article(post.id)}">`);
    write(root, prefix + 'index.html', page(`${origin}/${prefix}`, [collection('sample')]));
    write(root, prefix + 'sample/index.html', page(collection('sample'), posts.map(post => article(post.id))));
    assert.equal(run(), '');
    write(root, prefix + 'sample/index.html', '<meta name=googlebot content=noindex>' + page(collection('sample'), posts.map(post => article(post.id))));
    assert.match(run(), /sample\/index.html: invalid canonical or robots policy/);
    write(root, prefix + 'sample/index.html', page(collection('sample'), posts.map(post => article(post.id))));
    write(root, 'blog-module/blog-entries/b/article.html', `<link rel=canonical href=${article('b')}><meta http-equiv = "refresh" content="0;url=https://example.invalid/">`);
    assert.match(run(), /member b is not a direct published story/);
    write(root, 'blog-module/blog-entries/b/article.html', `<link rel="canonical" href="${article('b')}">`);
    const links = posts.map(post => article(post.id)); links[1] += '?variant=1';
    write(root, prefix + 'sample/index.html', page(collection('sample'), posts.map(post => article(post.id))).replace(/<ol>.*<\/ol>/, `<ol>${links.map(l => `<li><a href="${l}">x</a></li>`).join('')}</ol>`));
    assert.match(run(), /visible collection order does not match/);
});

test('reason text with replacement tokens stays literal; digest CLI accepts the npm form', () => {
    const { renderCollection } = require('../collections/render');
    const posts = ['x', 'y', 'z'].map((id, i) => ({ id, title: id, date: '2026-01-01', position: i + 1, reason: i ? 'ok' : "A $& B $' C" }));
    const html = renderCollection({ collection: { slug: 's', title: 'T', description: 'D', introduction: ['I'] }, posts, lastmod: '2026-01-01' },
        { deps: { storyImage: () => '', renderStoryImage: () => '' } }).main;
    assert.match(html, /<p class="ed-section__facts">A \$&amp; B \$' C<\/p><p class="ed-meta">/);
    assert.equal((html.match(/<p class="ed-meta">/g) || []).length, 3);
    const { execFileSync } = require('node:child_process');
    const model = path.join(__dirname, '../collections/model.js');
    const digest = execFileSync(process.execPath, [model, '--validate', '--digest', '2026-nea-techniki-epochi'], { encoding: 'utf8' }).trim();
    assert.match(digest, /^[a-f0-9]{64}$/);
});

test('drift recognizes generated collections and preview rejects invalid members', async () => {
    const { isGeneratedPath } = await import('../../../scripts/build/generated-drift-guard.mjs');
    const { isCollectionDiscoveryPage } = await import('../../../scripts/build/stamp-html.mjs');
    assert.equal(isCollectionDiscoveryPage(prefix + 'index.html'), true);
    assert.equal(isCollectionDiscoveryPage(prefix + 'sample/index.html'), true);
    assert.equal(isCollectionDiscoveryPage(prefix + 'sample/page/2/index.html'), false);
    assert.equal(isCollectionDiscoveryPage(prefix + 'Invalid/index.html'), false);
    const { previewCandidates } = require('../collections/preview');
    assert.equal(isGeneratedPath(prefix + 'index.html'), true);
    assert.equal(isGeneratedPath(prefix + 'sample/index.html'), true);
    assert.equal(isGeneratedPath(prefix + 'sample/notes.txt'), false);
    assert.throws(() => previewCandidates([{ collection: { slug: 'sample', status: 'draft' }, eligible: false, reasons: [{ code: 'member', detail: 'missing' }] }]), /member: missing/);
});
