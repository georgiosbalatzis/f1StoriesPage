import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveArticleScope } from '../article-scope.mjs';

test('an explicit scope cannot silently broaden to the article archive', t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'f1-article-scope-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    for (const id of ['20260913G', '20260912W']) {
        const directory = path.join(root, 'blog-module/blog-entries', id);
        fs.mkdirSync(directory, { recursive: true });
        fs.writeFileSync(path.join(directory, 'article.html'), '<article></article>');
    }
    assert.equal(resolveArticleScope([], root), null);
    assert.deepEqual(resolveArticleScope(['--article-ids=20260913G,20260913G'], root), [
        'blog-module/blog-entries/20260913G/article.html'
    ]);
    assert.equal(resolveArticleScope(['--article-ids', '20260913G,20260912W'], root).length, 2);
    for (const argv of [
        ['--article-ids'], ['--article-ids='], ['--article-ids=20260913G,'],
        ['--article-ids=../../index'], ['--article-ids=missing'],
        ['--article-ids', '--dry'], ['--article-ids=20260913G', '--article-ids=20260912W']
    ]) assert.throws(() => resolveArticleScope(argv, root), undefined, argv.join(' '));
});
