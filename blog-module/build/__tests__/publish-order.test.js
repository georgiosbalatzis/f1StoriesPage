const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { loadPublishTimes, comparePosts } = require('../publish-order');

// A throwaway repository whose commits carry exact times, so the tests do not depend on this repo's history.
function repo(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'f1-publish-order-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const git = (args, at) => {
        const env = { ...process.env, GIT_AUTHOR_NAME: 'T', GIT_AUTHOR_EMAIL: 't@example.invalid', GIT_COMMITTER_NAME: 'T', GIT_COMMITTER_EMAIL: 't@example.invalid' };
        if (at) { env.GIT_AUTHOR_DATE = at; env.GIT_COMMITTER_DATE = at; }
        const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', env });
        assert.equal(result.status, 0, result.stderr);
        return result.stdout.trim();
    };
    git(['init', '-q', '-b', 'main']);
    const add = (id, at, file = 'source.txt') => {
        const target = path.join(root, 'blog-module/blog-entries', id, file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, `${id} ${at}\n`);
        git(['add', '-A']);
        git(['commit', '-q', '-m', `add ${id}`], at);
    };
    return { root, git, add };
}

const post = (id, date = '2026-10-07') => ({ id, date });
const unix = iso => Math.floor(Date.parse(iso) / 1000);

test('same-day articles are ordered by when they reached main, not by author letter', t => {
    const r = repo(t);
    r.add('20261007W', '2026-10-07T03:19:52+03:00'); // Themis, early in the morning
    r.add('20261007G', '2026-10-07T12:26:59+03:00'); // Georgios, later the same day
    const publishTimes = loadPublishTimes(r.root);
    assert.equal(publishTimes.get('20261007W'), unix('2026-10-07T03:19:52+03:00'));
    assert.equal(publishTimes.get('20261007G'), unix('2026-10-07T12:26:59+03:00'));
    const sorted = [post('20261007W'), post('20261007G')].sort((a, b) => comparePosts(a, b, { publishTimes }));
    assert.deepEqual(sorted.map(p => p.id), ['20261007G', '20261007W']);

    // The letter no longer decides it: the later article wins whichever author wrote it.
    const r2 = repo(t);
    r2.add('20261006G', '2026-10-06T09:00:00+03:00');
    r2.add('20261006W', '2026-10-06T21:00:00+03:00');
    const times2 = loadPublishTimes(r2.root);
    assert.deepEqual([post('20261006G', '2026-10-06'), post('20261006W', '2026-10-06')].sort((a, b) => comparePosts(a, b, { publishTimes: times2 })).map(p => p.id), ['20261006W', '20261006G']);
});

test('the day still outranks the time, and an article is dated by the first commit that added any of its files', t => {
    const r = repo(t);
    r.add('20261005W', '2026-10-05T23:50:00+03:00');
    r.add('20261006G', '2026-10-06T00:10:00+03:00');
    r.add('20261005W', '2026-10-07T10:00:00+03:00', '1.webp'); // images added later do not move the article
    const publishTimes = loadPublishTimes(r.root);
    assert.equal(publishTimes.get('20261005W'), unix('2026-10-05T23:50:00+03:00'));
    assert.deepEqual([post('20261005W', '2026-10-05'), post('20261006G', '2026-10-06')].sort((a, b) => comparePosts(a, b, { publishTimes })).map(p => p.id), ['20261006G', '20261005W']);
});

test('a merge counts at the time it landed on main, not when its branch commits were written', t => {
    const r = repo(t);
    r.add('20261007W', '2026-10-07T03:00:00+03:00');
    r.git(['checkout', '-q', '-b', 'author-pr']);
    r.add('20261007G', '2026-10-06T22:00:00+03:00'); // written the evening before
    r.git(['checkout', '-q', 'main']);
    r.git(['merge', '-q', '--no-ff', '-m', 'Merge author-pr', 'author-pr'], '2026-10-07T14:00:00+03:00');
    const publishTimes = loadPublishTimes(r.root);
    assert.equal(publishTimes.get('20261007G'), unix('2026-10-07T14:00:00+03:00'));
    assert.deepEqual([post('20261007W'), post('20261007G')].sort((a, b) => comparePosts(a, b, { publishTimes })).map(p => p.id), ['20261007G', '20261007W']);
});

test('without trustworthy history the previous order and then the folder name decide, as before', t => {
    const r = repo(t);
    r.add('20261007W', '2026-10-07T03:19:52+03:00');
    r.add('20261007G', '2026-10-07T12:26:59+03:00');
    r.add('20261007J', '2026-10-07T13:00:00+03:00');
    // A depth-1 clone sees every article as added by its single commit: unusable, so no times at all.
    const clone = fs.mkdtempSync(path.join(os.tmpdir(), 'f1-publish-order-clone-'));
    t.after(() => fs.rmSync(clone, { recursive: true, force: true }));
    const cloned = spawnSync('git', ['clone', '-q', '--depth', '1', `file://${r.root}`, clone], { encoding: 'utf8' });
    assert.equal(cloned.status, 0, cloned.stderr);
    assert.equal(loadPublishTimes(clone).size, 0);
    assert.equal(loadPublishTimes(os.tmpdir()).size, 0, 'outside a repository');

    const none = new Map();
    const byLetter = [post('20261007G'), post('20261007W'), post('20261007J')].sort((a, b) => comparePosts(a, b, { publishTimes: none }));
    assert.deepEqual(byLetter.map(p => p.id), ['20261007W', '20261007J', '20261007G']);
    const existingOrderById = new Map([['20261007G', 0], ['20261007W', 1]]);
    const kept = [post('20261007W'), post('20261007G')].sort((a, b) => comparePosts(a, b, { publishTimes: none, existingOrderById }));
    assert.deepEqual(kept.map(p => p.id), ['20261007G', '20261007W'], 'a build that already placed both keeps its order');
});

test('the ordering is stable whichever way the input arrives', t => {
    const r = repo(t);
    ['20261007F', '20261007G', '20261007J', '20261007W'].forEach((id, i) => r.add(id, `2026-10-07T0${i + 1}:00:00+03:00`));
    const publishTimes = loadPublishTimes(r.root);
    const ids = ['20261007F', '20261007G', '20261007J', '20261007W'];
    const expected = ['20261007W', '20261007J', '20261007G', '20261007F'];
    for (const input of [ids, [...ids].reverse(), ['20261007J', '20261007W', '20261007F', '20261007G']]) {
        assert.deepEqual(input.map(id => post(id)).sort((a, b) => comparePosts(a, b, { publishTimes })).map(p => p.id), expected);
    }
});
