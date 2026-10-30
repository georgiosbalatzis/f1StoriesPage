import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const window = {};
vm.runInNewContext(fs.readFileSync(new URL('../github-client.js', import.meta.url), 'utf8'), { window });
const api = window.F1S_AUTHOR_GITHUB;

test('review branches preserve folder spelling and reject invalid refs', () => {
    const branch = api.reviewBranchName('20261029-2Τ');
    assert.match(branch, /^editorial\/review\/20261029-2Τ-\d{14}-[a-z0-9]+$/);
    assert.equal(api.folderFromAuthorBranch(branch), '20261029-2τ');
    for (const ref of ['editorial/review/a.b-20261029120000-abcd', 'editorial/review/a/b-20261029120000-abcd', 'editorial/review/a-123-x']) assert.equal(api.folderFromAuthorBranch(ref), '');
    assert.throws(() => api.reviewBranchName('../private'));
});

test('review text contains only controlled text and public article fields', () => {
    const pr = api.reviewPullRequest('20261029Τ', 'Τίτλος\n[δημόσιος]', false);
    assert.equal(pr.title, 'editorial(review): 20261029Τ — Τίτλος \\[δημόσιος\\]');
    assert.equal(pr.body, 'Συντακτικός έλεγχος για `blog-module/blog-entries/20261029Τ`.\n\nΕνέργεια: νέα δημοσίευση.\nΖητείται ανθρώπινος έλεγχος του δημόσιου diff.\nΟι επιτυχείς τεχνικοί έλεγχοι δεν αποτελούν συντακτική έγκριση.\nMerge από αρμόδιο άνθρωπο μετά την έγκριση του τελικού commit.');
    assert.match(api.reviewPullRequest('20261029Τ', 'Τίτλος', true).body, /επεξεργασία υπάρχοντος άρθρου/);
    assert.ok(!JSON.stringify(pr).includes('SYNTHETIC_PRIVATE_CANARY'));
});

test('review PR creation sends a non-draft PR on the fixed branch', async () => {
    const calls = [], browser = {};
    const fetch = async (url, options) => {
        const route = new URL(url).pathname, body = options.body && JSON.parse(options.body);
        calls.push({ route, method: options.method, body });
        const data = route.endsWith('/git/ref/heads/main') ? { object: { sha: 'base' } } :
            route.endsWith('/git/commits/base') ? { tree: { sha: 'tree' } } : { sha: 'new' };
        return { ok: true, status: 200, json: async () => data };
    };
    vm.runInNewContext(fs.readFileSync(new URL('../github-client.js', import.meta.url), 'utf8'), { window: browser, fetch });
    const text = browser.F1S_AUTHOR_GITHUB.reviewPullRequest('20261029Τ', 'Δημόσιος', false);
    await browser.F1S_AUTHOR_GITHUB.createClient().createPullRequestFromTree('synthetic-token', 'blog', '20261029Τ', [], 'public commit', text.title, text.body, null, true);
    const pr = calls.find(call => call.route.endsWith('/pulls')).body;
    assert.match(pr.head, /^editorial\/review\/20261029Τ-\d{14}-[a-z0-9]+$/);
    assert.equal(pr.draft, false); assert.equal(pr.body, text.body);
    assert.ok(!JSON.stringify(calls).includes('SYNTHETIC_PRIVATE_CANARY'));
});
