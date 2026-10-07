import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const classifier = fileURLToPath(new URL('../classify-quality.mjs', import.meta.url));
const workflow = fs.readFileSync(new URL('../../../.github/workflows/quality.yml', import.meta.url), 'utf8');

function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'f1-quality-routing-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const repo = path.join(root, 'repo');
    fs.mkdirSync(repo);
    const git = (...args) => {
        const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr);
        return result.stdout.trim();
    };
    const write = (file, contents = 'fixture\n') => {
        const target = path.join(repo, file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, contents);
    };
    const commit = () => {
        git('add', '-A');
        git('-c', 'user.name=Quality test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'fixture');
        return git('rev-parse', 'HEAD');
    };
    git('init', '-q');
    write('README.md');
    write('blog-module/blog-entries/entry/source.txt');
    const base = commit();
    const output = path.join(root, 'output');
    const classify = (env = {}, cwd = repo, existingMerge = false) => {
        const head = git('rev-parse', 'HEAD');
        if (!existingMerge) {
            // Model GitHub's tested merge without changing the PR's file tree.
            const merge = git('-c', 'user.name=Quality test', '-c', 'user.email=test@example.invalid',
                'commit-tree', `${head}^{tree}`, '-p', base, '-p', head, '-m', 'tested merge');
            git('update-ref', '--no-deref', 'HEAD', merge);
        }
        fs.writeFileSync(output, '');
        const result = spawnSync(process.execPath, [classifier], { cwd, encoding: 'utf8',
            env: { ...process.env, GITHUB_EVENT_NAME: 'pull_request',
                PR_HEAD_SHA: head, GITHUB_OUTPUT: output, ...env } });
        if (!existingMerge) git('update-ref', '--no-deref', 'HEAD', head);
        assert.equal(result.status, 0, result.stderr);
        return fs.readFileSync(output, 'utf8').trim();
    };
    return { root, repo, git, write, commit, base, classify };
}

test('article-only PRs use content checks on scheduled, author and ordinary branches', t => {
    const f = fixture(t);
    f.write('blog-module/blog-entries/new/source.txt', 'new article\n');
    f.write('blog-module/blog-entries/new/hero.webp', Buffer.from([0, 1, 255]));
    f.commit();
    for (const branch of ['author/blog/new', 'author/import/new', 'author/delete/new',
        'author/edit/new', 'author/scheduled/new', 'editorial/new']) {
        assert.equal(f.classify({ GITHUB_HEAD_REF: branch }), 'content_only=true', branch);
    }
});

test('mixed changes require full checks even on author and scheduled branches', t => {
    const f = fixture(t);
    for (const file of ['package.json', 'package-lock.json', 'scripts/author/generate-page.js',
        'blog-module/blog/template.html', '.github/workflows/quality.yml', 'README.md']) {
        f.git('reset', '--hard', f.base);
        f.write('blog-module/blog-entries/entry/source.txt', 'edited article\n');
        f.write(file, 'changed code or configuration\n');
        f.commit();
        for (const branch of ['author/blog/edit', 'author/scheduled/edit']) {
            assert.equal(f.classify({ GITHUB_HEAD_REF: branch }), 'content_only=false', `${branch}: ${file}`);
        }
    }
});

test('article deletions and renames within entries use content checks', t => {
    const f = fixture(t);
    f.git('mv', 'blog-module/blog-entries/entry/source.txt', 'blog-module/blog-entries/entry/renamed.txt');
    f.commit();
    assert.equal(f.classify(), 'content_only=true');
    fs.unlinkSync(path.join(f.repo, 'blog-module/blog-entries/entry/renamed.txt'));
    f.commit();
    assert.equal(f.classify(), 'content_only=true');
});

test('renames crossing the content boundary require full checks in both directions', t => {
    const f = fixture(t);
    f.git('mv', 'README.md', 'blog-module/blog-entries/entry/imported.txt');
    f.commit();
    assert.equal(f.classify(), 'content_only=false');
    f.git('reset', '--hard', f.base);
    f.git('mv', 'blog-module/blog-entries/entry/source.txt', 'exported.txt');
    f.commit();
    assert.equal(f.classify(), 'content_only=false');
});

test('classification preserves unusual filenames instead of splitting them into fake paths', t => {
    const f = fixture(t);
    f.write('blog-module/blog-entries/entry/space tab\tline\nbreak.txt');
    f.commit();
    assert.equal(f.classify(), 'content_only=true');
    f.write('scripts/not-content\nblog-module/blog-entries/fake.txt');
    f.commit();
    assert.equal(f.classify(), 'content_only=false');
});

test('new code on main does not turn an unchanged article-only PR into a mixed PR', t => {
    const f = fixture(t);
    f.git('checkout', '-b', 'article');
    f.write('blog-module/blog-entries/entry/source.txt', 'edited article\n');
    const head = f.commit();
    f.git('checkout', '-b', 'new-main', f.base);
    f.write('scripts/new-runtime.js', 'new runtime\n');
    f.commit();
    // Checkout the synthetic merge just as pull_request checkout does.
    f.git('-c', 'user.name=Quality test', '-c', 'user.email=test@example.invalid', 'merge', '--no-edit', 'article');
    assert.equal(f.classify({ PR_HEAD_SHA: head }, f.repo, true), 'content_only=true');
});

test('large diffs cannot hide a code change behind a changed-file limit', t => {
    const f = fixture(t);
    for (let i = 0; i < 3010; i++) f.write(`blog-module/blog-entries/import/${i}.txt`);
    f.write('scripts/zzz-runtime.js');
    f.commit();
    assert.equal(f.classify(), 'content_only=false');
});

test('manual runs, empty diffs and unavailable comparisons fall back to full checks', t => {
    const f = fixture(t);
    f.git('-c', 'user.name=Quality test', '-c', 'user.email=test@example.invalid', 'commit', '--allow-empty', '-m', 'empty PR');
    assert.equal(f.classify(), 'content_only=false');
    f.write('blog-module/blog-entries/entry/source.txt', 'edited article\n');
    f.commit();
    for (const env of [
        { GITHUB_EVENT_NAME: 'workflow_dispatch' },
        { PR_HEAD_SHA: '' },
        { PR_HEAD_SHA: '--help' },
        { PR_HEAD_SHA: 'f'.repeat(40) }
    ]) assert.equal(f.classify(env), 'content_only=false');
    assert.equal(f.classify({}, f.root), 'content_only=false');
    assert.equal(f.classify({}, f.repo, true), 'content_only=false');
});

test('depth-two checkout classifies content while missing parents fall back to full checks', t => {
    const f = fixture(t);
    f.write('blog-module/blog-entries/entry/source.txt', 'edited article\n');
    const head = f.commit();
    const merge = f.git('-c', 'user.name=Quality test', '-c', 'user.email=test@example.invalid',
        'commit-tree', `${head}^{tree}`, '-p', f.base, '-p', head, '-m', 'tested merge');
    f.git('update-ref', 'refs/heads/ci', merge);
    for (const depth of [2, 1]) {
        const clone = path.join(f.root, `depth-${depth}`);
        f.git('clone', '--quiet', '--branch', 'ci', '--depth', String(depth), pathToFileURL(f.repo).href, clone);
        assert.equal(f.classify({ PR_HEAD_SHA: head }, clone, true), `content_only=${depth === 2}`);
    }
});

function step(name) {
    return workflow.split(`      - name: ${name}\n`)[1].split(/\n      - /)[0];
}

test('both routes preserve Quality gates and shared tests; only full checks package and audit', () => {
    assert.match(workflow, /name: Quality gates/);
    assert.doesNotMatch(workflow, /github.head_ref|startsWith\(/);
    assert.match(step('Checkout'), /fetch-depth: 2/);
    assert.match(step('Classify changed files'), /run: node scripts\/build\/classify-quality.mjs/);
    const routed = ['Restore optimized article images', 'Build public artifact',
        'Validate article content', 'Audit runtime dependencies'];
    for (const contentOnly of ['true', 'false', undefined]) {
        const steps = { changes: { outputs: { content_only: contentOnly } } };
        for (const name of routed) {
            const expression = step(name).match(/if: \$\{\{(.*?)\}\}/)[1];
            const runs = new Function('steps', `return (${expression});`)(steps);
            assert.equal(runs, name === 'Validate article content' ? contentOnly === 'true' : contentOnly !== 'true');
        }
    }
    for (const name of ['Run static source guard', 'Run author module tests',
        'Run standings module tests', 'Run security policy tests', 'Run publishing regression tests']) {
        assert.doesNotMatch(step(name), /\bif:/, name);
    }
    assert.match(step('Run publishing regression tests'), /quality-routing.test.mjs/);
});
