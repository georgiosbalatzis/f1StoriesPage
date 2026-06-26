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
    const context = {
        console,
        window: {}
    };
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
    c: ['F1', 'Race Analysis', 'Strategy'],
    p: [
        ['20260623G', 'Race title', 1, '2026-06-23', 848, 400, 'Excerpt', '3 min', [0, 1]],
        ['20260622', 'Strategy title', 0, '2026-06-22', 0, 0, '', '', [2]]
    ]
};

const expanded = articleIndex.expandCompactPosts(compact);
assert.equal(expanded.length, 2);
assert.equal(expanded[0].id, '20260623G');
assert.equal(expanded[0].author, 'Georgios Balatzis');
assert.equal(expanded[0].tag, 'F1');
assert.equal(expanded[0].category, 'Race Analysis');
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
    tag: 'F1',
    category: 'Race Analysis',
    author: 'Georgios Balatzis'
});
assert.equal(filtered.length, 1);
assert.equal(filtered[0].id, '20260623G');
assert.equal(articleIndex.filterPosts(expanded, { query: 'missing' }).length, 0);

const options = articleIndex.collectFilterOptions(expanded);
assert.equal(options.tags.join(','), 'F1,Strategy');
assert.equal(options.categories.join(','), 'Race Analysis');
assert.equal(options.authors.join(','), 'F1 Stories Team,Georgios Balatzis');

console.log('author article index tests passed.');
