#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..', '..');
const SOURCE_PATH = path.join(REPO_ROOT, 'scripts', 'author', 'article-source.js');

function loadArticleSource() {
    const context = { console };
    context.window = context;
    vm.runInNewContext(fs.readFileSync(path.join(REPO_ROOT, 'blog-module', 'taxonomy.js'), 'utf8'), context);
    vm.runInNewContext(fs.readFileSync(SOURCE_PATH, 'utf8'), context, {
        filename: SOURCE_PATH
    });
    return context.window.F1S_AUTHOR_ARTICLE_SOURCE;
}

const articleSource = loadArticleSource();

assert.equal(articleSource.normalizeZipPath('\\folder\\source.txt'), 'folder/source.txt');
assert.equal(articleSource.normalizeZipPath('./folder/source.txt'), 'folder/source.txt');
assert.equal(articleSource.normalizeZipPath('/folder/source.txt'), 'folder/source.txt');

const parsed = articleSource.parseSourceText('F1 Race-Analysis\r\n\r\nTitle\r\n\r\nBody line 1\r\nBody line 2\r\n');
assert.ok(parsed.tags.includes('F1'));
assert.equal(parsed.category, 'Analysis');
assert.equal(parsed.title, 'Title');
assert.equal(parsed.body, 'Body line 1\nBody line 2');

const decoded = articleSource.parseSourceText('Long-Tag Race-Analysis\n\nTitle\n\nBody\n', {
    decodeHeaderTokens: true
});
assert.ok(decoded.tags.includes('Long Tag'));
assert.equal(decoded.category, 'Analysis');

const fallback = articleSource.parseSourceText('');
assert.equal(fallback.tag, '');
assert.equal(fallback.category, 'News');
assert.equal(fallback.title, '');
assert.equal(fallback.body, '');

assert.equal(
    articleSource.buildSourceText('Lewis Hamilton, Ferrari F1', 'Analysis', 'A: title', 'Body\r\nnext'),
    '---\ncategory: Analysis\ntags: Lewis Hamilton, Ferrari F1\ntitle: A: title\n---\n\nBody\nnext\n'
);
assert.throws(() => articleSource.buildSourceText('', 'Racing,-Ferrari-F1', 'Title', 'Body'), /public category/);

const legacy = articleSource.parseSourceText('  \nF1 Racing,-2026,-Lewis-Hamilton,-Ferrari-F1\n\nA: legacy title\n\nFirst paragraph.\n\n[img-instert-tag]\n\nLast paragraph.\n');
assert.ok(legacy.tags.includes('Lewis Hamilton'));
assert.ok(legacy.tags.includes('Ferrari F1'));
const migrated = articleSource.parseSourceText(articleSource.buildSourceText(legacy.tags, legacy.category, legacy.title, legacy.body));
assert.equal(migrated.title, legacy.title);
assert.equal(migrated.body, legacy.body);
assert.deepEqual(Array.from(migrated.tags), Array.from(legacy.tags));

const frontmatter = articleSource.parseSourceText('\uFEFF\r\n---\r\ncategory: Opinion\r\ntags: Lewis Hamilton, Technical\r\ntitle: Tomorrow: a different grid\r\nauthor: F1 Stories Team\r\nexcerpt: One: two\r\n---\r\n\r\nAn article with\r\n\r\nmultiple paragraphs.\r\n');
assert.equal(frontmatter.category, 'Opinion');
assert.equal(frontmatter.categories.join(','), 'Opinion', 'Internal tag aliases must not add public categories to explicit frontmatter');
assert.equal(frontmatter.title, 'Tomorrow: a different grid');
assert.equal(frontmatter.body, 'An article with\n\nmultiple paragraphs.');
const rebuilt = articleSource.parseSourceText(articleSource.buildSourceText(frontmatter.tags, frontmatter.category, frontmatter.title, frontmatter.body, frontmatter.metadata));
assert.equal(rebuilt.metadata.author, 'F1 Stories Team');
assert.equal(rebuilt.metadata.excerpt, 'One: two');
assert.equal(rebuilt.body, frontmatter.body);
assert.equal(rebuilt.tags.join(','), frontmatter.tags.join(','));

const blankTags = articleSource.parseSourceText(articleSource.buildSourceText('', 'News', 'No tags', 'Body'));
assert.equal(blankTags.tags.length, 0);
assert.equal(blankTags.category, 'News');

const migratedSeries = articleSource.parseSourceText('F1 Racing\n\nBetcast #264\n\nBody', { id: '20260523J' });
assert.equal(migratedSeries.category, 'Betting', 'Editing a legacy series must retain its reviewed category');

const legacyFrontmatter = articleSource.parseSourceText('---\ncategory: Racing,-History,-Lewis-Hamilton\ntitle: A legacy frontmatter article\n---\n\nBody');
assert.equal(legacyFrontmatter.category, 'History');
assert.ok(legacyFrontmatter.tags.includes('Lewis Hamilton'));
assert.ok(legacyFrontmatter.tags.includes('Racing'));

console.log('author article source tests passed.');
