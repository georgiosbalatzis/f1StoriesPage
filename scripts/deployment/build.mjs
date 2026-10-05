#!/usr/bin/env node
// No publishing operations. Builds isolated snapshots and assembles one static artifact.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { assemble, prepareMain } from './assemble.mjs';

const mainRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const config = JSON.parse(fs.readFileSync(path.join(mainRoot, 'scripts/deployment/sources.json')));
const expected = [
    ['main', 'georgiosbalatzis/f1StoriesPage', '/', 'dist'],
    ['telemetry', 'georgiosbalatzis/f1-telemetry-dashboard', '/telemetry/', 'dist'],
    ['ghostcar', 'georgiosbalatzis/ghostcar', '/ghostcar/', 'dist'],
    ['betcast', 'georgiosbalatzis/BetCastVisualisation', '/betcast/', 'build'],
];
if (config.origin !== 'https://f1stories.gr' || config.applications.length !== expected.length) throw new Error('Invalid origin/application lock');
expected.forEach(([application, repository, canonicalPath, output], index) => {
    const app = config.applications[index];
    if (app.application !== application || app.repository !== repository || app.path !== canonicalPath || app.output !== output) throw new Error('Invalid source lock entry');
});
const args = process.argv.slice(2);
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const local = args.includes('--local');
const allowDirty = local && args.includes('--allow-dirty');
if (allowDirty && process.env.GITHUB_ACTIONS === 'true') throw new Error('Dirty local rehearsals are prohibited in GitHub Actions');
const workspace = path.resolve(option('--workspace') || path.join(mainRoot, '..'));
const destination = path.resolve(option('--output') || path.join(mainRoot, '.build/priority6/site'));
const reports = path.resolve(option('--reports') || path.join(destination, '..', 'reports'));
const existingMain = option('--main-output');
if (existingMain && !allowDirty) throw new Error('--main-output is a local non-release optimization only');
if (!local && !config.releaseReady) throw new Error('Release pins are not ready: commit reviewed migration changes and update child SHAs first');
const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'f1stories-assembly-'));
const command = (cmd, argv, cwd, capture = false) => {
    const result = spawnSync(cmd, argv, { cwd, env: { ...process.env, CI: 'true' }, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit', maxBuffer: 64 * 1024 * 1024 });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${cmd} ${argv.join(' ')} failed (${result.status})${capture ? ': ' + result.stderr : ''}`);
    return result.stdout?.trim();
};
const git = (cwd, ...argv) => command('git', argv, cwd, true);
const snapshots = [];
const baseline = option('--baseline');
try {
    for (const app of config.applications) {
        if (app.path !== '/' && !/^[a-f0-9]{40}$/.test(app.sha || '')) throw new Error('Child source pins must be full commit SHAs');
        const source = local ? path.join(workspace, app.repository.split('/')[1]) : app.application === 'main' ? mainRoot : path.join(staging, 'checkout-' + app.application);
        if (!local && app.application !== 'main') {
            // Anonymous, read-only public Git; never persist a token or assume cross-repo permissions.
            fs.mkdirSync(source);
            command('git', ['init', '--quiet'], source);
            command('git', ['-c', 'credential.helper=', 'fetch', '--depth=1', `https://github.com/${app.repository}.git`, app.sha], source);
            command('git', ['checkout', '--detach', 'FETCH_HEAD'], source);
        }
        const sha = git(source, 'rev-parse', 'HEAD');
        const dirty = !!git(source, 'status', '--porcelain');
        if (dirty && !allowDirty) throw new Error(`${app.application}: dirty sources require explicit --local --allow-dirty; release builds forbid them`);
        if (!allowDirty && app.sha && sha !== app.sha) throw new Error(`${app.application}: source SHA does not match reviewed pin`);
        const snapshot = path.join(staging, app.application);
        fs.mkdirSync(snapshot);
        // Only tracked/nonignored source, no node_modules/dist/scratch or environment-local secrets.
        const sourceNames = git(source, 'ls-files', '-z', '--cached', '--others', '--exclude-standard').split('\0').filter(Boolean).sort();
        const digest = createHash('sha256');
        for (const name of sourceNames) {
            const src = path.join(source, name);
            if (!fs.existsSync(src)) continue; // tracked deletion in a dirty rehearsal
            if (fs.lstatSync(src).isSymbolicLink()) throw new Error(`Source symlink requires review: ${name}`);
            if (!fs.statSync(src).isFile()) continue;
            const data = fs.readFileSync(src);
            digest.update(name + '\0').update(data);
            const target = path.join(snapshot, name);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.copyFileSync(src, target);
        }
        const pkg = JSON.parse(fs.readFileSync(path.join(snapshot, 'package.json')));
        if (!pkg.scripts[app.build]) throw new Error(`${app.application}: pinned source lacks ${app.build}; commit migration changes and update source pins before release`);
        const metadata = { ...app, sourceSha: sha, sourceDigest: digest.digest('hex'), dirty, version: pkg.version };
        if (app.application === 'main' && existingMain) {
            fs.cpSync(path.resolve(existingMain), path.join(snapshot, app.output), { recursive: true });
        } else {
            command('npm', ['ci', '--no-audit', '--no-fund'], snapshot);
            command('npm', ['run', app.build], snapshot);
        }
        metadata.directory = path.join(snapshot, app.output);
        if (baseline) {
            if (app.application !== 'main') command('npm', ['run', 'build'], snapshot);
            const legacyPath = app.application === 'main' ? '' : app.repository.split('/')[1];
            const baselineOutput = path.join(path.resolve(baseline), legacyPath);
            fs.mkdirSync(baselineOutput, { recursive: true });
            fs.cpSync(metadata.directory, baselineOutput, { recursive: true });
            if (app.application !== 'main') command('npm', ['run', app.build], snapshot);
        }
        if (app.application === 'main') prepareMain(metadata.directory);
        snapshots.push(metadata);
    }
    const result = assemble(snapshots, destination, { releaseEligible: !allowDirty && snapshots.every(app => !app.dirty), buildId: process.env.GITHUB_RUN_ID || 'local-rehearsal', builtAt: new Date().toISOString(), nodeVersion: process.version }, reports);
    fs.writeFileSync(path.join(reports, 'build-report.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ destination, reports, ...result }, null, 2));
} finally {
    fs.rmSync(staging, { recursive: true, force: true });
}
