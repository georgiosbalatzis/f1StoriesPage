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
    const context = {
        console,
        window: {}
    };
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
assert.equal(parsed.tag, 'F1');
assert.equal(parsed.category, 'Race-Analysis');
assert.equal(parsed.title, 'Title');
assert.equal(parsed.body, 'Body line 1\nBody line 2');

const decoded = articleSource.parseSourceText('Long-Tag Race-Analysis\n\nTitle\n\nBody\n', {
    decodeHeaderTokens: true
});
assert.equal(decoded.tag, 'Long Tag');
assert.equal(decoded.category, 'Race Analysis');

const fallback = articleSource.parseSourceText('');
assert.equal(fallback.tag, 'F1');
assert.equal(fallback.category, 'Racing');
assert.equal(fallback.title, '');
assert.equal(fallback.body, '');

assert.equal(
    articleSource.buildSourceText('Race Analysis', 'Driver Ratings', 'A\rTitle', 'Body\r\nnext'),
    'Race-Analysis Driver-Ratings\n\nATitle\n\nBody\nnext\n'
);

console.log('author article source tests passed.');
