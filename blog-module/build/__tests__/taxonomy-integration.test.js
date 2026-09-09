const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { PUBLIC_CATEGORIES, getPostTaxonomy } = require('../../taxonomy');
const { buildIndexPosts, buildCompactIndexData, summarizeCategories } = require('../index');
const { refreshArticleTaxonomy } = require('../article-render');
const { extractMetadata } = require('../metadata');
const { convertTxtToHtml } = require('../parse-txt');
const { scoreRelatedPosts } = require('../related');

test('archive data separates public categories from searchable detail tags', async () => {
    const posts = await buildIndexPosts([{
        id: '20260901W', title: 'Hamilton at Ferrari', author: 'Author',
        date: '2026-09-01', readingTime: '3 min', excerpt: 'An article.',
        tag: 'F1', category: 'Racing,-2026,-Lewis-Hamilton,-Ferrari-F1'
    }]);
    assert.ok(posts[0].categories.every(category => PUBLIC_CATEGORIES.includes(category)));
    assert.ok(posts[0].tags.includes('Lewis Hamilton'));
    assert.ok(posts[0].tags.includes('Ferrari F1'));
    const compact = buildCompactIndexData(posts);
    assert.deepEqual(compact.c, PUBLIC_CATEGORIES);
    assert.deepEqual(compact.p[0][8].map(index => compact.c[index]), posts[0].categories);
    assert.deepEqual(compact.p[0][9].map(index => compact.t[index]), posts[0].tags);
    assert.deepEqual(summarizeCategories(posts).map(category => category.name), PUBLIC_CATEGORIES);
    assert.equal(summarizeCategories(posts).find(category => category.name === '2026').count, 1);
});

test('source-less article taxonomy migration leaves body bytes intact and is idempotent', () => {
    const body = '<p>Ferrari-F1, original prose &amp; markup.</p><div><video src="race.mp4"></video></div>';
    const oldLabel = 'Racing,-70ς,-History,-F1-Legends';
    const html = `<script type="application/ld+json">{"@type":"Article","headline":"Original"}</script>
<span class="article-mini-bar__category">F1</span>
<span class="article-category-pill">F1</span>
<div class="article-meta"><span><svg class="icon" aria-hidden="true"><use href="#fa-tag"/></svg> ${oldLabel}</span></div>
<div class="article-rail-meta-list"><span><svg class="icon" aria-hidden="true"><use href="#fa-tag"/></svg> F1</span></div>
<div class="article-rail-card article-rail-tags" data-tags="${oldLabel}"><span class="article-rail-label">Tags</span><div class="article-tag-list" data-tag-list></div></div>
<div class="article-content">${body}</div>`;
    const post = { tag: 'F1', category: oldLabel };
    const updated = refreshArticleTaxonomy(html, post);
    assert.ok(updated.includes(`<div class="article-content">${body}</div>`));
    assert.ok(updated.includes('index.html?category=History'));
    assert.ok(!updated.includes(oldLabel));
    assert.ok(!updated.includes('data-tags='));
    const data = JSON.parse(updated.match(/application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.deepEqual(data.articleSection, getPostTaxonomy(post).categories);
    assert.equal(refreshArticleTaxonomy(updated, post), updated);
});

test('explicit source category survives detailed tags and front matter preserves first body words', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-taxonomy-source-'));
    const source = '\uFEFF---\r\ncategory: Opinion\r\ntags: 2026, Lewis Hamilton, Ferrari F1\r\ntitle: A title: with punctuation\r\n---\r\n\r\nOpening words must stay.\r\n\r\nSecond paragraph.\r\n';
    try {
        const file = path.join(directory, 'source.txt');
        fs.writeFileSync(file, source);
        const metadata = extractMetadata(file, source);
        const taxonomy = getPostTaxonomy(metadata);
        assert.deepEqual(taxonomy.categories, ['Opinion']);
        assert.equal(metadata.title, 'A title: with punctuation');
        const html = await convertTxtToHtml(file);
        assert.ok(html.startsWith('<p>Opening words must stay.</p>'));
        assert.ok(!html.includes('category:'));
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

test('related articles use specific internal tags without rewarding generic F1 labels', () => {
    const base = { category: 'Analysis', categories: ['Analysis'], author: 'Author', date: '2026-09-01' };
    const post = { ...base, id: '1', tags: ['F1', 'Racing', 'Lewis Hamilton'] };
    const generic = { ...base, id: '2', tags: ['F1', 'Racing'] };
    const specific = { ...base, id: '3', tags: ['lewis hamilton'], author: 'Other' };
    assert.equal(scoreRelatedPosts([post, generic, specific], post, 0)[0].id, '3');
});

test('legacy headers keep comma-separated detail tags even when phrases contain spaces', () => {
    const metadata = extractMetadata('source.txt', 'F1 Racing, 2026, Lewis Hamilton, Ferrari F1\n\nA title\n\nBody text.');
    assert.equal(metadata.title, 'A title');
    const taxonomy = getPostTaxonomy(metadata);
    assert.ok(taxonomy.tags.includes('Lewis Hamilton'));
    assert.ok(taxonomy.tags.includes('Ferrari F1'));
    assert.ok(taxonomy.categories.includes('2026'));
});
