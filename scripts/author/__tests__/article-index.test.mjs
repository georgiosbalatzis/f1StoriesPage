#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..', '..');
const INDEX_PATH = path.join(REPO_ROOT, 'scripts', 'author', 'article-index.js');

function loadArticleIndex() {
    const context = { console };
    context.window = context;
    vm.runInNewContext(fs.readFileSync(path.join(REPO_ROOT, 'blog-module', 'taxonomy.js'), 'utf8'), context);
    vm.runInNewContext(fs.readFileSync(INDEX_PATH, 'utf8'), context, {
        filename: INDEX_PATH
    });
    return context.window.F1S_AUTHOR_ARTICLE_INDEX;
}

const articleIndex = loadArticleIndex();

assert.equal(
    articleIndex.defaultThumbnailForPost('2026 06 23G'),
    '/blog-module/blog-entries/2026%2006%2023G/1-card.webp'
);

const compact = {
    v: 2,
    a: ['F1 Stories Team', 'Georgios Balatzis'],
    c: ['Analysis', '2026', 'Technical'],
    t: ['Lewis Hamilton', 'Ferrari F1', 'Strategy'],
    p: [
        ['20260623G', 'Race title', 1, '2026-06-23', 848, 400, 'Excerpt', '3 min', [0, 1], [0, 1]],
        ['20260622', 'Strategy title', 0, '2026-06-22', 0, 0, '', '', [2], ['Strategy']]
    ]
};

const expanded = articleIndex.expandCompactPosts(compact);
assert.equal(expanded.length, 2);
assert.equal(expanded[0].id, '20260623G');
assert.equal(expanded[0].author, 'Georgios Balatzis');
assert.equal(expanded[0].tag, undefined, 'The first public category is not a tag');
assert.equal(expanded[0].category, 'Analysis');
assert.equal(expanded[0].tags.join(','), 'Lewis Hamilton,Ferrari F1');
assert.equal(expanded[0].categories.join(','), 'Analysis,2026');
assert.equal(expanded[0].imageWidth, 848);
assert.equal(expanded[0].url, '/blog-module/blog-entries/20260623G/article.html');
assert.equal(expanded[1].imageWidth, 400);
assert.equal(expanded[1].imageHeight, 188);

assert.equal(articleIndex.expandCompactPosts({ v: 1 }), null);
assert.equal(articleIndex.extractPosts(compact).length, 2);
assert.equal(articleIndex.extractPosts({ posts: [{ id: 'legacy' }] })[0].id, 'legacy');
assert.equal(articleIndex.extractPosts([{ id: 'array' }])[0].id, 'array');

const sorted = articleIndex.sortNewestFirst([
    { id: 'old', dateISO: '2026-01-01' },
    { id: 'new', date: '2026-03-01' },
    { id: 'mid', dateISO: '2026-02-01' }
]);
assert.equal(sorted.map(post => post.id).join(','), 'new,mid,old');

const filtered = articleIndex.filterPosts(expanded, {
    query: 'georgios',
    tag: 'Lewis Hamilton',
    category: 'Analysis',
    author: 'Georgios Balatzis'
});
assert.equal(filtered.length, 1);
assert.equal(filtered[0].id, '20260623G');
assert.equal(articleIndex.filterPosts(expanded, { query: 'missing' }).length, 0);
assert.equal(articleIndex.filterPosts(expanded, { query: 'Ferrari F1' }).length, 1);
assert.equal(articleIndex.filterPosts(expanded, { category: '2026' }).length, 1);
assert.equal(articleIndex.filterPosts(expanded, { tag: 'Analysis' }).length, 0);

const options = articleIndex.collectFilterOptions(expanded);
assert.equal(options.tags.join(','), 'Ferrari F1,Lewis Hamilton,Strategy');
assert.equal(options.categories.join(','), 'Analysis,Technical,2026');
assert.equal(options.authors.join(','), 'F1 Stories Team,Georgios Balatzis');

const noTags = articleIndex.expandCompactPosts({ v: 2, c: ['News'], p: [['id', 'Title', 0, '', 0, 0, '', '', [0]]] });
assert.equal(noTags[0].tags.length, 0, 'Older compact rows must not invent internal tags from their categories');

const enriched = articleIndex.mergeInternalMetadata(expanded, { posts: [{ id: '20260623G', category: 'Analysis', tags: ['Racecraft'] }] });
assert.equal(enriched.length, expanded.length, 'An incomplete metadata cache must not remove current articles');
assert.equal(enriched[0].category, expanded[0].category);
assert.equal(enriched[0].tags.join(','), 'Racecraft');
assert.equal(enriched[1].tags.join(','), 'Strategy');

console.log('author article index tests passed.');
