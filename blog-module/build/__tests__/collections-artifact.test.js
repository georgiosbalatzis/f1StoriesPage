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
