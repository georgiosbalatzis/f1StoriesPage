import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const workflow = readFileSync(new URL('../../../.github/workflows/auto-merge-dependencies.yml', import.meta.url), 'utf8');
const filter = workflow.match(/--arg sha "\$TESTED_SHA" '([\s\S]*?)' > \/dev\/null/)[1];
const repo = 'owner/site';
const pr = {
    state: 'open', draft: false, user: { login: 'dependabot[bot]' },
    base: { ref: 'main', repo: { full_name: repo } },
    head: { ref: 'dependabot/npm_and_yarn/example', sha: 'tested', repo: { full_name: repo } }
};
function eligible(value) {
    const result = spawnSync('jq', ['-e', '--arg', 'repo', repo, '--arg', 'sha', 'tested', filter], {
        input: JSON.stringify(value), encoding: 'utf8'
    });
    assert.ifError(result.error);
    assert.ok([0, 1].includes(result.status), result.stderr);
    return result.status === 0;
}

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
