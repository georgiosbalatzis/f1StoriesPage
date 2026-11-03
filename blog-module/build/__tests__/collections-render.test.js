const test = require('node:test');
const assert = require('node:assert/strict');
const { renderCollection, renderCollectionsIndex, collectionsAsideHtml } = require('../collections/render');
const { articleUrl } = require('../entities/hubs');

const posts = [
    { id: 'fixture-old', title: '<Πρώτο> & ιστορία', date: '2023-01-02', position: 1, reason: '<Γιατί> & εδώ' },
    { id: 'fixture-new', title: 'Δεύτερο', date: '2025-02-03', position: 2, excerpt: 'ARTICLE-OWN-EXCERPT' },
    { id: 'fixture-mid', title: 'Τρίτο', date: '2024-03-04', position: 3, reason: 'Τελευταίο' }
];
const selected = { collection: { slug: 'fixture', title: '<Τίτλος> & ιστορίες', description: 'Περιγραφή & δοκιμή',
    introduction: ['<Εισαγωγή> & κείμενο', 'Δεύτερη παράγραφος'] }, posts, lastmod: '2025-03-01', reasons: [], eligible: true };
const indexPosts = posts.map(post => ({ id: post.id, thumbnail: `/images/${post.id}.webp`, thumbnailWidth: 400, thumbnailHeight: 300 }));
const deps = { storyImage: post => post.thumbnail, renderStoryImage: (post, image, options) => `<img src="${image}" loading="${options.eager ? 'eager' : 'lazy'}">` };
const schema = head => JSON.parse(head.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
const graph = (head, type) => schema(head)['@graph'].find(item => item['@type'] === type);

test('collection renders curated articles, safe text, metadata and schema', () => {
    const result = renderCollection(selected, { deps, indexPosts });
    assert.equal(result.file, 'collections/fixture/index.html');
    assert.equal(result.path, '/blog-module/blog/collections/fixture/');
    assert.equal(result.changefreq, 'monthly');
    assert.equal(result.priority, '0.6');
    assert.equal(result.lastmod, selected.lastmod);
    assert.equal((result.main.match(/<h1\b/g) || []).length, 1);
    assert.match(result.head, /<title>&lt;Τίτλος&gt; &amp; ιστορίες \| F1 Stories<\/title>/);
    assert.match(result.head, /content="Περιγραφή &amp; δοκιμή"/);
    assert.match(result.head, /rel="canonical" href="https:\/\/f1-stories.gr\/blog-module\/blog\/collections\/fixture\/"/);
    assert.match(result.main, /&lt;Εισαγωγή&gt; &amp; κείμενο/);
    assert.match(result.main, /&lt;Πρώτο&gt; &amp; ιστορία/);
    assert.match(result.main, /<p class="ed-excerpt ed-excerpt--row">&lt;Γιατί&gt; &amp; εδώ<\/p>/);
    assert.match(result.main, /<span class="ed-date ed-num" aria-hidden="true">01<\/span>/);
    assert.ok(!/<time class="ed-date/.test(result.main), 'curated order replaces the date column');
    assert.ok(!result.main.includes('ARTICLE-OWN-EXCERPT'), 'only human reasons are shown');
    assert.equal((result.main.match(/loading="eager"/g) || []).length, 1);
    assert.equal((result.main.match(/loading="lazy"/g) || []).length, 2);
    const listHtml = result.main.match(/<ol class="ed-rows">(.*?)<\/ol>/)[1];
    assert.equal((listHtml.match(/<li\b/g) || []).length, 3);
    assert.equal((listHtml.match(/<p class="ed-excerpt ed-excerpt--row">/g) || []).length, 2, 'no fallback to article excerpts');
    const list = graph(result.head, 'ItemList');
    assert.deepEqual(list.itemListElement.map(item => item.url), posts.map(articleUrl));
    assert.deepEqual(list.itemListElement.map(item => item.position), [1, 2, 3]);
    assert.deepEqual(list.itemListElement.map(item => item.name), posts.map(post => post.title));
    assert.deepEqual(graph(result.head, 'BreadcrumbList').itemListElement.map(item => item.name), ['Αρχική', 'Άρθρα', 'Συλλογές', selected.collection.title]);
    assert.equal(graph(result.head, 'CollectionPage').dateModified, selected.lastmod);
    assert.equal(graph(result.head, 'CollectionPage').inLanguage, 'el');
    assert.match(result.main, /aria-label="Διαδρομή"/);
});

test('preview uses loopback collection URLs and noindex, retaining original article canonicals', () => {
    const result = renderCollection(selected, { deps, indexPosts, origin: 'http://127.0.0.1:4174', preview: true });
    assert.match(result.head, /name="robots" content="noindex, nofollow"/);
    assert.match(result.head, /rel="canonical" href="http:\/\/127\.0\.0\.1:4174\/blog-module\/blog\/collections\/fixture\/"/);
    assert.deepEqual(graph(result.head, 'ItemList').itemListElement.map(item => item.url), posts.map(articleUrl));
    assert.equal(graph(result.head, 'BreadcrumbList').itemListElement[2].item, 'http://127.0.0.1:4174/blog-module/blog/collections/');
});

test('index lists only passed selections in slug order with collection schema', () => {
    const other = { ...selected, collection: { ...selected.collection, slug: 'alpha', title: 'Άλφα' }, lastmod: '2025-04-01' };
    const result = renderCollectionsIndex([selected, other]);
    assert.equal(result.file, 'collections/index.html');
    assert.equal(result.lastmod, '2025-04-01');
    assert.equal((result.main.match(/<h1\b/g) || []).length, 1);
    const list = graph(result.head, 'ItemList').itemListElement;
    assert.deepEqual(list.map(item => item.url), ['https://f1-stories.gr/blog-module/blog/collections/alpha/', 'https://f1-stories.gr/blog-module/blog/collections/fixture/']);
    assert.ok(result.main.indexOf('/collections/alpha/') < result.main.indexOf('/collections/fixture/'));
    assert.deepEqual(graph(result.head, 'BreadcrumbList').itemListElement.map(item => item.name), ['Αρχική', 'Άρθρα', 'Συλλογές']);
    assert.match(result.main, /3 άρθρα/);
});

test('aside is absent without links and escapes supplied links', () => {
    assert.equal(collectionsAsideHtml([]), '');
    const html = collectionsAsideHtml([{ href: '/fixture/"', label: '<θέμα> &', count: 3 }]);
    assert.match(html, /aria-labelledby="ed-collections-title"/);
    assert.match(html, /href="\/blog-module\/blog\/collections\/"/);
    assert.match(html, /href="\/fixture\/&quot;"/);
    assert.match(html, /&lt;θέμα&gt; &amp;/);
    assert.match(html, /3 άρθρα/);
});
