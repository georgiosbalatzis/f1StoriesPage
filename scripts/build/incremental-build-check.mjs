#!/usr/bin/env node
// End-to-end check of incremental article builds through the real `npm run build:public` sequence, in a temporary
// git worktree (the checkout itself is never touched): a cold build, a warm build that must change nothing, then an
// edited source.txt whose page is made newer than it, which must still reach article.html and dist/.
// Usage: node scripts/build/incremental-build-check.mjs [--ref <git ref>] [--keep]   (npm run test:incremental)
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const ref = args.includes('--ref') ? args[args.indexOf('--ref') + 1] : 'HEAD';
const MARKER = 'INCREMENTAL-CHECK-MARKER';
// Only the trailing newline is dropped: porcelain status lines start with a meaningful space.
const git = (cwd, ...rest) => execFileSync('git', ['-C', cwd, ...rest], { encoding: 'utf8' }).replace(/\n$/, '');

function build(cwd) {
    const started = Date.now();
    const result = spawnSync('npm', ['run', '-s', 'build:public'], {
        cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH}` }
    });
    const output = `${result.stdout}${result.stderr}`;
    if (result.status !== 0) throw new Error(`build:public failed:\n${output.slice(-3000)}`);
    const total = /Total: (\d+) posts \((\d+) built, (\d+) rebuilt from skipped, (\d+) cached\)/.exec(output);
    return { seconds: Math.round((Date.now() - started) / 100) / 10, built: Number(total?.[2]), cached: Number(total?.[4]) };
}

// The first source-backed article (by id) with a long body line after its front matter: the edit lands in the body.
function pickArticle(cwd) {
    const entries = path.join(cwd, 'blog-module/blog-entries');
    for (const id of fs.readdirSync(entries).sort()) {
        const file = path.join(entries, id, 'source.txt');
        if (!fs.existsSync(file) || !fs.existsSync(path.join(entries, id, 'article.html'))) continue;
        const lines = fs.readFileSync(file, 'utf8').split('\n');
        const start = lines[0] === '---' ? lines.indexOf('---', 1) + 1 : 3;
        const line = lines.findIndex((text, index) => index > start && /^[\p{L}][^<>#\[\]|*_`]{120,}[.;]$/u.test(text));
        if (line > 0) return { id, file, line };
    }
    throw new Error('no editable source-backed article found');
}

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-incremental-check-'));
const tree = path.join(work, 'tree');
const report = { ref, commit: '', cold: null, warm: null, edit: null, problems: [] };
try {
    git(ROOT, 'worktree', 'add', '--detach', '--quiet', tree, ref);
    report.commit = git(tree, 'rev-parse', '--short', 'HEAD');
    fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(tree, 'node_modules'), 'dir');

    report.cold = build(tree);
    report.warm = build(tree);
    const afterWarm = git(tree, 'status', '--porcelain');
    if (report.warm.built !== 0) report.problems.push(`warm build rebuilt ${report.warm.built} articles`);
    if (afterWarm) report.problems.push(`warm build changed tracked files:\n${afterWarm}`);

    const { id, file, line } = pickArticle(tree);
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines[line] = lines[line].replace(/([.;])$/, ` ${MARKER}$1`);
    fs.writeFileSync(file, lines.join('\n'));
    // The generated page is newer than its edited source, as earlier build steps leave it.
    const page = path.join(path.dirname(file), 'article.html');
    const later = new Date(fs.statSync(file).mtimeMs + 60_000);
    fs.utimesSync(page, later, later);

    report.edit = { article: id, line: line + 1, ...build(tree) };
    const inPage = fs.readFileSync(page, 'utf8').includes(MARKER);
    const inDist = fs.readFileSync(path.join(tree, 'dist/blog-module/blog-entries', id, 'article.html'), 'utf8').includes(MARKER);
    report.edit.markerInPage = inPage;
    report.edit.markerInDist = inDist;
    report.edit.changed = git(tree, 'status', '--porcelain').split('\n').filter(Boolean).map(entry => entry.slice(3));
    if (!inPage || !inDist) report.problems.push(`the edited source of ${id} did not reach ${inPage ? 'dist/' : 'article.html'}`);
} catch (error) {
    report.problems.push(error.message);
} finally {
    if (!args.includes('--keep')) {
        try { git(ROOT, 'worktree', 'remove', '--force', tree); } catch (_) { /* reported below if it matters */ }
        fs.rmSync(work, { recursive: true, force: true });
    } else {
        report.kept = tree;
    }
}
console.log(JSON.stringify(report, null, 2));
if (report.problems.length) {
    console.error(`✗ incremental build check failed at ${ref}`);
    process.exitCode = 1;
} else {
    console.log(`✓ incremental build check passed at ${ref}`);
}
