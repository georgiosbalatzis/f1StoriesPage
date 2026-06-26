#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..', '..');
const CLIENT_PATH = path.join(REPO_ROOT, 'scripts', 'author', 'github-client.js');

function response(json, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        text: async () => JSON.stringify(json),
        json: async () => json
    };
}

function loadClientWithFetch(fetchImpl) {
    const context = {
        atob(value) {
            return Buffer.from(value, 'base64').toString('binary');
        },
        btoa(value) {
            return Buffer.from(value, 'binary').toString('base64');
        },
        console,
        fetch: fetchImpl,
        FileReader: class {},
        TextDecoder,
        TextEncoder,
        window: {}
    };
    vm.runInNewContext(fs.readFileSync(CLIENT_PATH, 'utf8'), context, {
        filename: CLIENT_PATH
    });
    return context.window.F1S_AUTHOR_GITHUB;
}

async function testCreatePullRequestFromTree() {
    const calls = [];
    const api = loadClientWithFetch(async (url, opts = {}) => {
        const apiPath = new URL(url).pathname.replace('/repos/acme/f1/', '');
        calls.push({ apiPath, opts });

        if (apiPath === 'git/ref/heads/main') return response({ object: { sha: 'base-sha' } });
        if (apiPath === 'git/refs') return response({ ref: 'refs/heads/author/blog/test-entry-202606230701xx' }, 201);
        if (apiPath === 'git/commits/base-sha') return response({ tree: { sha: 'base-tree' } });
        if (apiPath === 'git/trees') return response({ sha: 'new-tree' }, 201);
        if (apiPath === 'git/commits') return response({ sha: 'new-commit' }, 201);
        if (apiPath.startsWith('git/refs/heads/author/blog/test-entry-')) return response({ object: { sha: 'new-commit' } });
        if (apiPath === 'pulls') return response({ number: 7, html_url: 'https://github.com/acme/f1/pull/7' }, 201);

        throw new Error(`Unexpected API path: ${apiPath}`);
    });

    const client = api.createClient({
        owner: 'acme',
        repo: 'f1',
        baseBranch: 'main',
        messages: {
            readBase: 'read',
            createBranch: 'branch',
            readTree: 'tree',
            createCommit: 'commit',
            updateBranch: 'update',
            openPullRequest: 'pr'
        }
    });

    const progress = [];
    const result = await client.createPullRequestFromTree(
        'token',
        'blog',
        'Test Entry!',
        [{ path: 'blog-module/blog-entries/20260623G/source.txt', mode: '100644', type: 'blob', sha: 'blob-sha' }],
        'publish(blog): Test Entry',
        'Publish blog: 20260623G',
        'Body',
        message => progress.push(message)
    );

    assert.equal(result.commitSha, 'new-commit');
    assert.equal(result.pullRequest.number, 7);
    assert.deepEqual(progress, ['read', 'branch', 'tree', 'commit', 'update', 'pr']);
    assert.deepEqual(calls.map(call => call.apiPath), [
        'git/ref/heads/main',
        'git/refs',
        'git/commits/base-sha',
        'git/trees',
        'git/commits',
        calls[5].apiPath,
        'pulls'
    ]);

    const branchBody = JSON.parse(calls[1].opts.body);
    assert.match(branchBody.ref, /^refs\/heads\/author\/blog\/test-entry-/);
    assert.equal(branchBody.sha, 'base-sha');

    const treeBody = JSON.parse(calls[3].opts.body);
    assert.equal(treeBody.base_tree, 'base-tree');
    assert.equal(treeBody.tree[0].sha, 'blob-sha');

    const prBody = JSON.parse(calls[6].opts.body);
    assert.equal(prBody.title, 'Publish blog: 20260623G');
    assert.match(prBody.head, /^author\/blog\/test-entry-/);
    assert.equal(prBody.base, 'main');
    assert.equal(prBody.maintainer_can_modify, true);
}

function testPureHelpers() {
    const api = loadClientWithFetch(async () => {
        throw new Error('fetch should not be called');
    });

    assert.equal(api.slugForBranch('Hello F1 Stories!'), 'hello-f1-stories');
    assert.equal(api.slugForBranch(''), 'blog-entry');
    assert.equal(api.utf8ToBase64('F1'), 'RjE=');
    assert.equal(api.base64ToUtf8(api.utf8ToBase64('F1 Stories')), 'F1 Stories');
}

await testCreatePullRequestFromTree();
testPureHelpers();
console.log('author github client tests passed.');
