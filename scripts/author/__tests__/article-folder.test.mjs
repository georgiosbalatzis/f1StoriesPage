#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..', '..');
const FOLDER_PATH = path.join(REPO_ROOT, 'scripts', 'author', 'article-folder.js');

function loadArticleFolder() {
    const context = {
        console,
        window: {}
    };
    vm.runInNewContext(fs.readFileSync(FOLDER_PATH, 'utf8'), context, {
        filename: FOLDER_PATH
    });
    return context.window.F1S_AUTHOR_ARTICLE_FOLDER;
}

const folders = loadArticleFolder();

assert.equal(folders.codeForAuthor('Georgios Balatzis'), 'G');
assert.equal(folders.codeForAuthor('Unknown Author'), '');
assert.equal(folders.authorForCode('W'), 'Themis Charvalis');
assert.equal(folders.authorForCode(''), 'F1 Stories Team');
assert.equal(folders.authorFromFolderName('20260623G'), 'Georgios Balatzis');
assert.equal(folders.authorFromFolderName('20260623'), 'F1 Stories Team');
assert.equal(folders.authorFromFolderName('bad-folder'), null);

const parts = folders.folderParts('20260416-2G');
assert.equal(parts.date, '2026-04-16');
assert.equal(parts.suffix, 2);
assert.equal(parts.authorCode, 'G');

const noSuffix = folders.folderParts('20260416W');
assert.equal(noSuffix.date, '2026-04-16');
assert.equal(noSuffix.suffix, null);
assert.equal(noSuffix.authorCode, 'W');

assert.equal(folders.folderParts('2026-04-16G'), null);
assert.equal(folders.buildFolderName('2026-04-16', 'G', null), '20260416G');
assert.equal(folders.buildFolderName('2026-04-16', 'G', 2), '20260416-2G');
assert.equal(folders.buildFolderName('bad-date', 'G', null), null);
assert.equal(folders.todayYYYYMMDD(new Date(2026, 5, 3)), '20260603');

console.log('author article folder tests passed.');
