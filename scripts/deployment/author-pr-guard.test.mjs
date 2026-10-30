import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { authorPrProblems, main, ENTRIES } from './author-pr-guard.mjs';

const at = (folder, name) => `${ENTRIES}${folder}/${name}`;
const changed = (folder, name, status = 'modified', previous) => ({ filename: at(folder, name), status, ...(previous ? { previous_filename: previous } : {}) });
// Folder contents on main and at the tested commit; absent folders are null.
const lister = (base, head) => async (folder, side) => ({ base, head }[side][folder] ?? null);
const check = (branch, files, base = {}, head = {}) => authorPrProblems({ branch, files, list: lister(base, head) });
const article = ['source.txt', 'article.html', '1.webp', '1-card.webp', '3.webp'];

test('the edits and publications the author tools make pass', async () => {
    // Housekeeping edit: source rewritten, one image replaced.
    assert.deepEqual(await check('author/edit/20260416g-20261026101010-ab12', [changed('20260416G', 'source.txt'),
        changed('20260416G', '1.webp'), changed('20260416G', '1-card.webp', 'removed')],
    { '20260416G': article }, { '20260416G': article.filter(name => name !== '1-card.webp') }), []);
    // Greek and two-letter ids, and a source-less legacy page kept by its article.html.
    assert.deepEqual(await check('author/edit/20260227-x', [changed('20260227Τ', 'source.txt')], { '20260227Τ': article }, { '20260227Τ': article }), []);
    assert.deepEqual(await check('author/edit/20250514-2gf-x', [changed('20250514-2GF', '3.webp', 'removed')],
        { '20250514-2GF': ['article.html', '3.webp'] }, { '20250514-2GF': ['article.html'] }), []);
    // Generate: a new folder; "replace" of today's folder removes the old page and images and writes new ones.
    assert.deepEqual(await check('author/blog/20261026j-x', [changed('20261026J', 'source.txt', 'added'), changed('20261026J', '1.webp', 'added')],
        {}, { '20261026J': ['source.txt', '1.webp'] }), []);
    assert.deepEqual(await check('author/blog/20261026j-x', [changed('20261026J', 'source.txt'), changed('20261026J', 'article.html', 'removed'),
        changed('20261026J', '3.webp', 'removed')], { '20261026J': article }, { '20261026J': ['source.txt', '1.webp'] }), []);
    // ZIP import with a .docx source and a rename inside the folder.
    assert.deepEqual(await check('author/import/20261020w-x', [changed('20261020W', 'story.docx', 'added'),
        changed('20261020W', '4.webp', 'renamed', at('20261020W', '3.webp'))], {}, { '20261020W': ['story.docx', '4.webp'] }), []);
    // Housekeeping delete: every file in the folder removed.
    assert.deepEqual(await check('author/delete/20260416g-x', article.map(name => changed('20260416G', name, 'removed')),
        { '20260416G': article }, {}), []);
});

test('a rename or a change to another published folder is refused', async () => {
    const renamed = [...article.map(name => changed('20260416G', name, 'removed')), ...article.map(name => changed('20260420G', name, 'added'))];
    for (const branch of ['author/edit/20260416g-x', 'author/blog/20260420g-x', 'author/import/20260420g-x', 'author/delete/20260416g-x']) {
        assert.match((await check(branch, renamed, { '20260416G': article }, { '20260420G': article })).join('\n'), /touches 2 article folders/, branch);
    }
    // Git may report the move as renames; the old path counts too.
    const moved = article.map(name => changed('20260420G', name, 'renamed', at('20260416G', name)));
    assert.match((await check('author/edit/20260416g-x', moved, { '20260416G': article }, { '20260420G': article })).join('\n'), /touches 2 article folders/);
    // A second folder hidden behind a legitimate edit.
    assert.match((await check('author/edit/20260416g-x', [changed('20260416G', 'source.txt'), changed('20260222T', 'article.html', 'removed')],
        { '20260416G': article, '20260222T': article }, { '20260416G': article, '20260222T': [] })).join('\n'), /touches 2 article folders/);
});

test('only author/delete may remove an article, and only an existing one', async () => {
    const emptied = article.map(name => changed('20260416G', name, 'removed'));
    for (const branch of ['author/edit/20260416g-x', 'author/blog/20260416g-x', 'author/import/20260416g-x']) {
        assert.match((await check(branch, emptied, { '20260416G': article }, {})).join('\n'), /would no longer publish its article/, branch);
    }
    // Source and page removed, images left behind.
    assert.match((await check('author/edit/20260416g-x', [changed('20260416G', 'source.txt', 'removed'), changed('20260416G', 'article.html', 'removed')],
        { '20260416G': article }, { '20260416G': ['1.webp', '.source.txt', '~$story.docx'] })).join('\n'), /would no longer publish/);
    assert.match((await check('author/delete/20260416g-x', [changed('20260416G', 'source.txt', 'removed'), changed('20260416G', 'x.webp', 'added')],
        { '20260416G': article }, { '20260416G': ['x.webp'] })).join('\n'), /may only remove files \(.*x\.webp\)/);
    assert.match((await check('author/delete/20260416g-x', [changed('20260416G', 'source.txt', 'removed')])).join('\n'), /not on main/);
    assert.match((await check('author/edit/20260416g-x', [changed('20260416G', 'source.txt', 'added')], {}, { '20260416G': ['source.txt'] })).join('\n'), /edit of a folder that is not on main/);
});

test('paths outside one article folder and unknown branches are refused', async () => {
    for (const filename of ['README.md', '.github/workflows/quality.yml', `${ENTRIES}README.md`, `${ENTRIES}../index.html`, `${ENTRIES}a.b/article.html`]) {
        assert.match((await check('author/blog/x', [{ filename, status: 'added' }])).join('\n'), /outside an article folder/, filename);
    }
    assert.deepEqual(await check('feature/x', [changed('20260416G', 'source.txt')]), ['feature/x: not an author-tool branch']);
    assert.deepEqual(await check('author/other/x', [changed('20260416G', 'source.txt')]), ['author/other/x: not an author-tool branch']);
    assert.deepEqual(await check('author/edit/x', []), ['the PR changes no files']);
});

test('the CLI reads every page of files, both folder listings, and refuses a moved PR', async t => {
    const realFetch = globalThis.fetch, token = process.env.GH_TOKEN, exit = process.exitCode;
    t.after(() => { globalThis.fetch = realFetch; process.env.GH_TOKEN = token; process.exitCode = exit; });
    process.env.GH_TOKEN = 'test-token';
    const files = Array.from({ length: 101 }, (_, i) => changed('20260227Τ', `${i}.webp`, i ? 'modified' : 'removed'));
    const seen = [];
    globalThis.fetch = async url => {
        const route = new URL(url);
        seen.push(decodeURIComponent(route.pathname + route.search));
        const json = body => ({ ok: true, status: 200, json: async () => body });
        if (route.pathname.endsWith('/pulls/9')) return json({ head: { sha: 'tested', ref: 'author/edit/20260227-x' }, base: { sha: 'main-sha' } });
        if (route.pathname.endsWith('/pulls/9/files')) return json(route.searchParams.get('page') === '1' ? files.slice(0, 100) : files.slice(100));
        if (route.pathname.includes('/contents/')) return json([{ type: 'file', name: 'article.html' }, { type: 'dir', name: 'embeds' }]);
        return { ok: false, status: 500 };
    };
    process.exitCode = 0;
    await main(['--repo', 'o/r', '--pr', '9', '--sha', 'tested']);
    assert.equal(process.exitCode, 0);
    assert.deepEqual(seen.filter(route => route.includes('/files')), ['/repos/o/r/pulls/9/files?per_page=100&page=1', '/repos/o/r/pulls/9/files?per_page=100&page=2']);
    assert.deepEqual(seen.filter(route => route.includes('/contents/')), [
        `/repos/o/r/contents/${ENTRIES}20260227Τ?ref=main-sha`, `/repos/o/r/contents/${ENTRIES}20260227Τ?ref=tested`]);
    await assert.rejects(main(['--repo', 'o/r', '--pr', '9', '--sha', 'other']), /moved to tested; other was tested/);
});

test('Publish Article runs the guard from main on the tested commit before merging', () => {
    const workflow = fs.readFileSync(new URL('../../.github/workflows/auto-publish-author-pr.yml', import.meta.url), 'utf8');
    const step = name => workflow.indexOf(`- name: ${name}`);
    assert.ok(step('Resolve trusted author PR') < step('Check out the URL guard'));
    assert.ok(step('Check out the URL guard') < step('Keep published article URLs'));
    assert.ok(step('Keep published article URLs') < step('Merge author PR'));
    const checkout = workflow.slice(step('Check out the URL guard'), step('Keep published article URLs'));
    assert.match(checkout, /ref: \$\{\{ github\.event\.repository\.default_branch \}\}/);
    assert.match(checkout, /persist-credentials: false/);
    assert.match(checkout, /sparse-checkout: scripts\/deployment\/author-pr-guard\.mjs/);
    const guard = workflow.slice(step('Keep published article URLs'), step('Merge author PR'));
    assert.match(guard, /if: \$\{\{ steps\.pr\.outputs\.publish == 'true' \}\}/);
    assert.match(guard, /TESTED_SHA: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/);
    assert.match(guard, /node scripts\/deployment\/author-pr-guard\.mjs --repo "\$REPO" --pr "\$NUMBER" --sha "\$TESTED_SHA"/);
    assert.match(workflow.slice(step('Merge author PR')), /--match-head-commit "\$TESTED_SHA"/);
});

test('review branches are excluded by all trusted author automation boundaries', async () => {
    let listed = false;
    const branch = 'editorial/review/20261029G-20261029120000-abcd';
    const result = await authorPrProblems({ branch, files: [changed('20261029G', 'source.txt', 'added')], list: async () => { listed = true; } });
    assert.deepEqual(result, [`${branch}: not an author-tool branch`]);
    assert.equal(listed, false);
    const workflow = fs.readFileSync(new URL('../../.github/workflows/auto-publish-author-pr.yml', import.meta.url), 'utf8');
    const triggers = workflow.match(/    branches:\n((?:      - .*\n)+)/)[1].match(/author\/[^']+/g);
    assert.deepEqual(triggers, ['author/blog/**', 'author/import/**', 'author/delete/**', 'author/edit/**']);
    const branchCase = workflow.match(/          case "\$head_ref" in\n[\s\S]*?          esac/)[0].replace(/^          /gm, '');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'review-guard-'));
    try {
        const file = path.join(dir, 'output');
        const output = execFileSync('sh', ['-c', `head_ref="$1"; pr_number=1; GITHUB_OUTPUT="$2"; ${branchCase}\necho merge`, 'test', branch, file], { encoding: 'utf8' });
        assert.match(fs.readFileSync(file, 'utf8'), /publish=false/);
        assert.doesNotMatch(output, /merge/);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
