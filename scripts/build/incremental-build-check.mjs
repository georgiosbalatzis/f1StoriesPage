#!/usr/bin/env node
// End-to-end check of incremental article builds through the real `npm run build:public` sequence, in a temporary
// git worktree (the checkout itself is never touched): a cold build, a warm build that must change nothing, two
// standalone `npm run build:blog` runs that must keep entity evidence valid and every article page byte-identical,
// then an edited source.txt whose page is made newer than it, which must still reach article.html and dist/.
// Usage: node scripts/build/incremental-build-check.mjs [--ref <git ref>] [--keep]   (npm run test:incremental)
import { execFileSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
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

function npm(cwd, script) {
    const result = spawnSync('npm', ['run', '-s', script], {
        cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH}` }
    });
    return { ok: result.status === 0, output: `${result.stdout}${result.stderr}` };
}

function build(cwd) {
    const started = Date.now();
    const { ok, output } = npm(cwd, 'build:public');
    if (!ok) throw new Error(`build:public failed:\n${output.slice(-3000)}`);
    const total = /Total: (\d+) posts \((\d+) built, (\d+) rebuilt from skipped, (\d+) cached\)/.exec(output);
    return { seconds: Math.round((Date.now() - started) / 100) / 10, built: Number(total?.[2]), cached: Number(total?.[4]) };
}

// SHA-256 of every article page, and of the whole tracked working state.
function pageHashes(cwd) {
    const entries = path.join(cwd, 'blog-module/blog-entries');
    return new Map(fs.readdirSync(entries).filter(id => fs.existsSync(path.join(entries, id, 'article.html')))
        .map(id => [id, crypto.createHash('sha256').update(fs.readFileSync(path.join(entries, id, 'article.html'))).digest('hex')]));
}
const treeState = cwd => crypto.createHash('sha256').update(git(cwd, 'diff', 'HEAD', '--binary')).digest('hex');

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
    const afterCold = treeState(tree);
    report.cold.changedTracked = git(tree, 'status', '--porcelain').split('\n').filter(Boolean).map(entry => entry.slice(3));
    report.warm = build(tree);
    if (report.warm.built !== 0) report.problems.push(`warm build rebuilt ${report.warm.built} articles`);
    if (treeState(tree) !== afterCold) report.problems.push('the warm build changed what the cold build produced');

    // Standalone `npm run build:blog`, twice: entity evidence stays valid and every article page stays byte-identical
    // to what build:public produced; a following build:public reproduces the same tree.
    const pages = pageHashes(tree);
    report.standalone = [];
    for (const run of [1, 2]) {
        const blog = npm(tree, 'build:blog');
        const validate = npm(tree, 'entities:validate');
        const now = pageHashes(tree);
        const changedPages = [...pages].filter(([id, hash]) => now.get(id) !== hash).map(([id]) => id);
        report.standalone.push({ run, buildOk: blog.ok, evidenceOk: validate.ok, changedPages: changedPages.length });
        if (!blog.ok) report.problems.push(`standalone build:blog ${run} failed: ${blog.output.match(/Error: .*/)?.[0] || blog.output.slice(-300)}`);
        if (!validate.ok) report.problems.push(`entities:validate after standalone build:blog ${run} failed: ${validate.output.match(/Error: .*/)?.[0] || ''}`);
        if (changedPages.length) report.problems.push(`standalone build:blog ${run} changed ${changedPages.length} article pages (first: ${changedPages[0]})`);
    }
    build(tree);
    if (treeState(tree) !== afterCold) report.problems.push('build:public after standalone builds did not reproduce the same tree');

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
