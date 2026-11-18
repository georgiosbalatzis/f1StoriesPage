import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const workflow = readFileSync(new URL('../../../.github/workflows/auto-merge-dependencies.yml', import.meta.url), 'utf8');
const filter = workflow.match(/--arg sha "\$TESTED_SHA" '([\s\S]*?)' > \/dev\/null/)[1];
const fileFilter = workflow.match(/--argjson count "\$changed_files" '([\s\S]*?)' > \/dev\/null/)[1];
const repo = 'owner/site';
const pr = {
    state: 'open', draft: false, user: { login: 'dependabot[bot]' },
    base: { ref: 'main', repo: { full_name: repo } },
    head: { ref: 'dependabot/npm_and_yarn/example-1.2.4', sha: 'tested', repo: { full_name: repo } },
    title: 'chore(deps): bump example from 1.2.3 to 1.2.4', changed_files: 2
};
function matches(value, args, expression) {
    const result = spawnSync('jq', ['-e', ...args, expression], {
        input: JSON.stringify(value), encoding: 'utf8'
    });
    assert.ifError(result.error);
    assert.ok([0, 1].includes(result.status), result.stderr);
    return result.status === 0;
}
const eligible = value => matches(value, ['--arg', 'repo', repo, '--arg', 'sha', 'tested'], filter);

test('dependency auto-merge only accepts the tested, same-repository Dependabot PR', () => {
    assert.equal(eligible(pr), true);
    for (const change of [
        { state: 'closed' }, { draft: true }, { user: { login: 'someone-else' } },
        { base: { ...pr.base, ref: 'release' } },
        { base: { ...pr.base, repo: { full_name: 'other/site' } } },
        { head: { ...pr.head, sha: 'untested' } },
        { head: { ...pr.head, ref: 'feature/example' } },
        { head: { ...pr.head, repo: { full_name: 'fork/site' } } }
    ]) assert.equal(eligible({ ...pr, ...change }), false, JSON.stringify(change));
    assert.match(workflow, /--match-head-commit "\$TESTED_SHA"/);
    assert.match(workflow, /workflow_run.conclusion == 'success'/);
});

test('only supported npm patch and minor titles and branches qualify', () => {
    const npm = (title, ref, count = 2) => eligible({ ...pr, title, head: { ...pr.head, ref }, changed_files: count });
    assert.equal(npm('chore(deps): bump @scope/example from 1.9.8 to 1.10.0', 'dependabot/npm_and_yarn/scope/example-1.10.0'), true);
    assert.equal(npm('chore(deps): bump example from 1.2.0 to 1.3.0', 'dependabot/npm_and_yarn/example-1.3.0'), true);
    assert.equal(npm('chore(deps): bump example from 0.8.1 to 0.8.2', 'dependabot/npm_and_yarn/example-0.8.2'), true);
    for (const group of ['dev-tooling', 'build-runtime']) {
        assert.equal(npm(`chore(deps): bump the ${group} group with 4 updates`, `dependabot/npm_and_yarn/${group}-35653276c1`), true);
    }
    for (const [title, ref, count] of [
        ['chore(deps): bump example from 1.2.3 to 2.0.0', 'dependabot/npm_and_yarn/example-2.0.0'],
        ['chore(deps): bump example from 0.8.4 to 0.9.0', 'dependabot/npm_and_yarn/example-0.9.0'],
        ['chore(deps): bump example from 0.0.1 to 0.0.2', 'dependabot/npm_and_yarn/example-0.0.2'],
        ['chore(deps): bump example from 1.2.3 to 1.2.2', 'dependabot/npm_and_yarn/example-1.2.2'],
        ['chore(deps): bump example from 1.2.3 to 1.2.4-beta.1', 'dependabot/npm_and_yarn/example-1.2.4-beta.1'],
        [pr.title, 'dependabot/npm_and_yarn/example-2.0.0'],
        [pr.title, 'dependabot/github_actions/example-1.2.4'],
        [pr.title, pr.head.ref, 3],
        ['chore(actions): bump the github-actions group across 2 directories with 3 updates', 'dependabot/github_actions/github-actions-35653276c1'],
        ['chore(deps): bump the other group with 2 updates', 'dependabot/npm_and_yarn/other-35653276c1']
    ]) assert.equal(npm(title, ref, count), false, title);
});

test('dependency auto-merge verifies the complete list contains only modified npm package files', () => {
    const manifest = { filename: 'package.json', status: 'modified' };
    const lock = { filename: 'package-lock.json', status: 'modified' };
    const eligibleFiles = files => matches(files, ['--argjson', 'count', '2'], fileFilter);
    assert.equal(eligibleFiles([manifest, lock]), true);
    assert.equal(eligibleFiles([lock]), false);
    assert.equal(eligibleFiles([lock, lock]), false);
    assert.equal(eligibleFiles([lock, { ...manifest, status: 'renamed' }]), false);
    assert.equal(eligibleFiles([lock, { ...manifest, filename: '.github/workflows/quality.yml' }]), false);
});

test('dependency auto-merge rejects lockfile entries that move to a new major version', () => {
    const lockFilter = workflow.match(/--slurpfile head "\$RUNNER_TEMP\/head-lock.json" '([\s\S]*?)' > \/dev\/null/)[1];
    const dir = mkdtempSync(path.join(tmpdir(), 'lock-majors-'));
    const write = (name, value) => {
        const file = path.join(dir, name);
        writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
        return file;
    };
    const lockfile = packages => ({ lockfileVersion: 3, packages: { '': { name: 'site', version: '1.0.0' }, ...packages } });
    const base = lockfile({
        'node_modules/example': { version: '1.2.3' },
        'node_modules/@scope/tool': { version: '0.4.1' },
        'node_modules/other/node_modules/example': { version: '2.0.0' },
        'node_modules/linked': { link: true },
        'node_modules/@xmldom/xmldom': { version: '0.8.10' },
        'node_modules/tiny': { version: '0.0.3' }
    });
    const accepts = (head, baseLock = base) => matches(null, [
        '-n', '--slurpfile', 'base', write('base.json', baseLock), '--slurpfile', 'head', write('head.json', head)
    ], lockFilter);
    try {
        assert.equal(accepts(base), true);
        const repoLock = readFileSync(new URL('../../../package-lock.json', import.meta.url), 'utf8');
        assert.equal(accepts(repoLock, repoLock), true);
        assert.equal(accepts(lockfile({
            'node_modules/example': { version: '2.1.0' },
            'node_modules/@scope/tool': { version: '0.4.9' },
            'node_modules/other/node_modules/example': { version: '1.9.0' },
            'node_modules/new-transitive': { version: '7.0.0' },
            'node_modules/@xmldom/xmldom': { version: '0.8.11' },
            'node_modules/tiny': { version: '0.0.3' }
        })), true);
        for (const packages of [
            { 'node_modules/example': { version: '3.0.0' } },
            { 'node_modules/@scope/tool': { version: '1.0.0' } },
            { 'node_modules/@xmldom/xmldom': { version: '0.9.0' } },
            { 'node_modules/tiny': { version: '0.0.4' } },
            { 'node_modules/nested/node_modules/@scope/tool': { version: '1.0.0' } },
            { 'node_modules/example': { version: 'git+https://example.invalid/example.git' } }
        ]) assert.equal(accepts(lockfile(packages)), false, JSON.stringify(packages));
        assert.equal(accepts({ lockfileVersion: 1, dependencies: {} }), false);
        assert.equal(accepts(base, { lockfileVersion: 1, dependencies: {} }), false);
        assert.equal(accepts('{"packages": {}}\n{"packages": {}}'), false);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
