import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const workflow = fs.readFileSync(new URL('../../../.github/workflows/publish-blog.yml', import.meta.url), 'utf8');
const job = name => workflow.split(`\n  ${name}:\n`)[1].split(/\n  [a-z_]+:\n/)[0];
function script(jobName, stepName) {
    return job(jobName).split(`      - name: ${stepName}\n`)[1]
        .split('        run: |\n')[1].split(/\n      - /)[0]
        .split('\n').map(line => line.slice(10)).join('\n');
}

function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'f1-maintenance-patch-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const repo = path.join(root, 'repo');
    fs.mkdirSync(repo);
    const git = (...args) => {
        const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr);
        return result.stdout.trim();
    };
    const write = (file, contents) => {
        const target = path.join(repo, file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, contents);
    };
    const commit = () => {
        git('add', '-A');
        git('-c', 'user.name=Maintenance test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'fixture');
    };
    git('init', '-q');
    for (const file of ['assets/youtube-latest.json', 'standings/standings-cache.json',
        'standings/dirty-air-cache.json', 'standings/dirty-air/index.json',
        'standings/dirty-air/old-session.json', 'standings/rounds/2026-1.json',
        'standings/debrief-cache.json']) write(file, '{"version":1}\n');
    write('images/youtube/old.webp', Buffer.from([0, 1, 2, 3, 255]));
    write('images/youtube/kept.webp', Buffer.from([0, 1, 2, 3, 254]));
    write('README.md', 'original docs\n');
    commit();
    const output = path.join(root, 'output');
    const patch = path.join(root, 'maintenance.patch');
    const run = code => spawnSync('bash', ['-c', code], {
        cwd: repo, encoding: 'utf8', env: { ...process.env,
            RUNNER_TEMP: root, GITHUB_OUTPUT: output, PATCH: patch }
    });
    const prepare = (jobName, stepName) => {
        fs.writeFileSync(output, '');
        const result = run(script(jobName, stepName));
        assert.equal(result.status, 0, result.stderr);
        return fs.readFileSync(output, 'utf8').trim();
    };
    const apply = () => run(script('publish_data', 'Apply snapshot patch'));
    return { repo, git, write, commit, prepare, apply, patch };
}

test('slow fetching is read-only and only final publishing holds the article lock', () => {
    for (const name of ['refresh_youtube', 'refresh_standings_data']) {
        assert.match(job(name), /permissions:\n      contents: read/);
        assert.doesNotMatch(job(name), /content-publishing|commit-and-push/);
    }
    assert.match(job('publish_data'), /needs: \[refresh_youtube, refresh_standings_data\]/);
    assert.match(job('publish_data'), /group: content-publishing/);
    assert.match(job('publish_data'), /fetch-depth: 0/);
    assert.doesNotMatch(job('publish_data'), /actions\/setup|\.github\/actions\/setup|npm /);
});

for (const [jobName, stepName] of [
    ['refresh_youtube', 'Prepare YouTube patch'],
    ['refresh_standings_data', 'Prepare standings patch']
]) test(`${jobName} skips publishing when its data is unchanged`, t => {
    const f = fixture(t);
    // Unrelated source changes must not create a maintenance commit.
    f.write('README.md', 'unrelated docs\n');
    assert.equal(f.prepare(jobName, stepName), 'changed=false');
    assert.equal(fs.readFileSync(f.patch, 'utf8'), '');
});

test('YouTube patches preserve a newer article and carry binary additions, changes and deletions', t => {
    const f = fixture(t);
    const bytes = Buffer.from([0, 13, 10, 255, 128, 4]);
    f.write('assets/youtube-latest.json', '{"version":2}\n');
    f.write('images/youtube/new.webp', bytes);
    f.write('images/youtube/kept.webp', bytes);
    fs.unlinkSync(path.join(f.repo, 'images/youtube/old.webp'));
    f.write('README.md', 'unrelated fetch-job edit\n');
    assert.equal(f.prepare('refresh_youtube', 'Prepare YouTube patch'), 'changed=true');
    assert.doesNotMatch(fs.readFileSync(f.patch, 'utf8'), /README.md/);
    f.git('reset', '--hard', 'HEAD');
    f.write('blog-module/blog-entries/new/source.txt', 'new article\n');
    f.commit();
    const result = f.apply();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.readFileSync(path.join(f.repo, 'blog-module/blog-entries/new/source.txt'), 'utf8'), 'new article\n');
    assert.deepEqual(fs.readFileSync(path.join(f.repo, 'images/youtube/new.webp')), bytes);
    assert.deepEqual(fs.readFileSync(path.join(f.repo, 'images/youtube/kept.webp')), bytes);
    assert.equal(fs.existsSync(path.join(f.repo, 'images/youtube/old.webp')), false);
    assert.equal(fs.readFileSync(path.join(f.repo, 'assets/youtube-latest.json'), 'utf8'), '{"version":2}\n');
    assert.equal(fs.readFileSync(path.join(f.repo, 'README.md'), 'utf8'), 'original docs\n');
    assert.deepEqual(f.git('diff', '--cached', '--name-only').split('\n'), [
        'assets/youtube-latest.json', 'images/youtube/kept.webp', 'images/youtube/new.webp', 'images/youtube/old.webp'
    ]);
});

test('standings patches include split snapshots and their deletions after main moves', t => {
    const f = fixture(t);
    f.write('standings/standings-cache.json', '{"version":2}\n');
    f.write('standings/dirty-air-cache.json', '{"version":2}\n');
    f.write('standings/debrief-cache.json', '{"version":2}\n');
    f.write('standings/dirty-air/index.json', '{"version":2}\n');
    f.write('standings/dirty-air/new-session.json', '{"laps":[]}\n');
    f.write('standings/rounds/2026-2.json', '{"round":2}\n');
    fs.unlinkSync(path.join(f.repo, 'standings/dirty-air/old-session.json'));
    assert.equal(f.prepare('refresh_standings_data', 'Prepare standings patch'), 'changed=true');
    const changed = f.git('diff', '--cached', '--name-only');
    f.git('reset', '--hard', 'HEAD');
    f.write('README.md', 'newer docs\n');
    f.commit();
    const result = f.apply();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(f.git('diff', '--cached', '--name-only'), changed);
    assert.equal(fs.existsSync(path.join(f.repo, 'standings/dirty-air/old-session.json')), false);
    assert.equal(fs.readFileSync(path.join(f.repo, 'README.md'), 'utf8'), 'newer docs\n');
});

test('overlapping data refreshes fail before committing rather than overwriting newer data', t => {
    const f = fixture(t);
    f.write('assets/youtube-latest.json', '{"version":2}\n');
    f.prepare('refresh_youtube', 'Prepare YouTube patch');
    f.git('reset', '--hard', 'HEAD');
    f.write('assets/youtube-latest.json', '{"version":3}\n');
    f.commit();
    const head = f.git('rev-parse', 'HEAD');
    const result = f.apply();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /conflict/i);
    assert.equal(f.git('rev-parse', 'HEAD'), head);
    assert.equal(f.git('show', 'HEAD:assets/youtube-latest.json'), '{"version":3}');
});

test('an already-published snapshot applies cleanly without another commit', t => {
    const f = fixture(t);
    f.write('assets/youtube-latest.json', '{"version":2}\n');
    f.prepare('refresh_youtube', 'Prepare YouTube patch');
    f.commit();
    const result = f.apply();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(f.git('diff', '--cached', '--name-only'), '');
});
