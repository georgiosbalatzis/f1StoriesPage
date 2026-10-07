import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const read = file => fs.readFileSync(new URL(`../../../${file}`, import.meta.url), 'utf8');
const pages = read('.github/workflows/deploy-pages.yml');
const maintenance = read('.github/workflows/publish-blog.yml');
const preparation = read('.github/actions/build-pages/action.yml');
const setup = read('.github/actions/setup/action.yml');
const job = (workflow, name) => workflow.split(`\n  ${name}:\n`)[1].split(/\n  [a-z_]+:\n/)[0];

test('trusted article generation prepares Pages with one checkout and dependency setup', () => {
    const publisher = job(maintenance, 'publish_blog');
    assert.equal((publisher.match(/uses: actions\/checkout@/g) || []).length, 1);
    assert.equal((publisher.match(/uses: \.\/\.github\/actions\/setup/g) || []).length, 1);
    assert.match(publisher, /pages: read/);
    assert.doesNotMatch(publisher, /pages: write|id-token:/);
    assert.match(publisher, /dependency_hash: \$\{\{ steps.setup.outputs.dependency_hash \}\}/);
    assert.ok(publisher.indexOf('name: Commit generated artifacts') < publisher.indexOf('uses: ./.github/actions/build-pages'));
    assert.match(publisher, /artifact_ready: \$\{\{ steps.pages.outcome == 'success' \}\}/);
    assert.match(job(maintenance, 'deploy'), /artifact_ready: \$\{\{ needs.publish_blog.outputs.artifact_ready == 'true' \}\}/);
    assert.doesNotMatch(preparation, /actions\/checkout|actions\/setup-node/);
});

test('ready artifacts skip building but failed, cancelled or unprepared builds cannot deploy', () => {
    const buildExpression = job(pages, 'build').match(/if: \$\{\{(.*?)\}\}/)[1];
    const deployExpression = job(pages, 'deploy').match(/if: \$\{\{(.*?)\}\}/)[1];
    const build = new Function('inputs', `return (${buildExpression});`);
    const deploy = new Function('inputs', 'needs', 'cancelled', `return (${deployExpression});`);
    assert.equal(build({}), true); // workflow_dispatch has no reusable inputs
    for (const ready of [false, true]) {
        assert.equal(build({ artifact_ready: ready }), !ready);
        for (const result of ['success', 'skipped', 'failure', 'cancelled']) {
            const inputs = { artifact_ready: ready }, needs = { build: { result } };
            assert.equal(deploy(inputs, needs, () => false), result === 'success' || (ready && result === 'skipped'));
            assert.equal(deploy(inputs, needs, () => true), false);
        }
    }
});

test('both preparation modes retain validation and upload only validated dist', () => {
    assert.match(job(pages, 'build'), /uses: \.\/\.github\/actions\/build-pages/);
    assert.match(preparation, /run: npm run build:public/);
    assert.match(preparation, /run: npm run quality:static/);
    assert.match(preparation, /run: npm run audit:runtime/);
    assert.match(preparation, /run: npm run test:integration -- --site dist/);
    assert.match(preparation, /path: dist/);
    assert.ok(preparation.indexOf('run: npm run audit:runtime') < preparation.indexOf('name: Upload Pages artifact'));
    assert.ok(preparation.indexOf('run: npm run test:integration') < preparation.indexOf('name: Upload Pages artifact'));
});

test('a rebase reuses dependencies unless package.json or its lockfile changed', t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'f1-pages-dependencies-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const run = (cmd, args, env = {}) => spawnSync(cmd, args, { cwd: root, encoding: 'utf8', env: { ...process.env, ...env } });
    assert.equal(run('git', ['init', '-q']).status, 0);
    fs.writeFileSync(path.join(root, 'package.json'), '{"name":"fixture"}\n');
    fs.writeFileSync(path.join(root, 'package-lock.json'), '{"lockfileVersion":3}\n');
    const bin = path.join(root, 'bin');
    fs.mkdirSync(bin);
    const calls = path.join(root, 'npm-calls');
    fs.writeFileSync(path.join(bin, 'npm'), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$NPM_CALLS"\n', { mode: 0o755 });
    const output = path.join(root, 'output');
    const install = setup.split('      run: |\n')[1].split('\n').map(line => line.slice(8)).join('\n');
    const refresh = preparation.split('      run: |\n')[1].split(/\n    - /)[0]
        .split('\n').map(line => line.slice(8)).join('\n');
    const env = { PATH: `${bin}:${process.env.PATH}`, NPM_CALLS: calls, GITHUB_OUTPUT: output };
    assert.equal(run('bash', ['-e', '-c', install], env).status, 0);
    const hash = fs.readFileSync(output, 'utf8').trim().split('=')[1];
    assert.ok(hash);
    fs.writeFileSync(calls, '');
    const invoke = () => {
        const result = run('bash', ['-c', refresh], { ...env, INSTALLED_HASH: hash });
        assert.equal(result.status, 0, result.stderr);
    };
    invoke();
    assert.equal(fs.readFileSync(calls, 'utf8'), '');
    fs.writeFileSync(path.join(root, 'article.html'), 'unrelated generated update');
    invoke();
    assert.equal(fs.readFileSync(calls, 'utf8'), '');
    for (const file of ['package-lock.json', 'package.json']) {
        const original = fs.readFileSync(path.join(root, file));
        fs.appendFileSync(path.join(root, file), '\n');
        fs.writeFileSync(calls, '');
        invoke();
        assert.equal(fs.readFileSync(calls, 'utf8'), 'ci --no-audit --no-fund\n');
        fs.writeFileSync(path.join(root, file), original);
    }
});
