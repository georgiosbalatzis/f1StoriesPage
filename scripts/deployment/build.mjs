#!/usr/bin/env node
// No publishing operations. Builds isolated snapshots and assembles one static artifact.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { assemble, prepareMain } from './assemble.mjs';
import { assertReleasable, checkLock, checkScript, checkSource, nodeEnvironment, treeDigest } from './release.mjs';

const mainRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const config = checkLock(JSON.parse(fs.readFileSync(path.resolve(option('--sources') || path.join(mainRoot, 'scripts/deployment/sources.json')))));
const local = args.includes('--local');
const allowDirty = local && args.includes('--allow-dirty');
if (allowDirty && process.env.GITHUB_ACTIONS === 'true') throw new Error('Dirty local rehearsals are prohibited in GitHub Actions');
const workspace = path.resolve(option('--workspace') || path.join(mainRoot, '..'));
const destination = path.resolve(option('--output') || path.join(mainRoot, '.build/priority6/site'));
const reports = path.resolve(option('--reports') || path.join(destination, '..', 'reports'));
const existingMain = option('--main-output');
if (existingMain && !allowDirty) throw new Error('--main-output is a local non-release optimization only');
// --node-bin 24=/opt/node24/bin: a directory holding the Node major an application declares.
const nodeBins = Object.fromEntries(args.flatMap((arg, i) => arg === '--node-bin' ? [args[i + 1].split(/=(.*)/s).slice(0, 2)] : []));
assertReleasable(config, { local });
const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'f1stories-assembly-'));
const command = (cmd, argv, cwd, capture = false, env = process.env) => {
    const result = spawnSync(cmd, argv, { cwd, env: { ...env, CI: 'true' }, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit', maxBuffer: 64 * 1024 * 1024 });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${cmd} ${argv.join(' ')} failed (${result.status})${capture ? ': ' + result.stderr : ''}`);
    return result.stdout?.trim();
};
const git = (cwd, ...argv) => command('git', argv, cwd, true);
// Anonymous, read-only public Git; never persist a token or assume cross-repo permissions.
const fetchCommit = (cwd, repository, ref) => command('git', ['-c', 'credential.helper=', 'fetch', '--quiet', '--depth=1', `https://github.com/${repository}.git`, ref], cwd, true);
const snapshots = [];
const baseline = option('--baseline');
const builtAt = new Date().toISOString();
try {
    for (const app of config.applications) {
        const source = local ? path.join(workspace, app.repository.split('/')[1]) : app.application === 'main' ? mainRoot : path.join(staging, 'checkout-' + app.application);
        if (!local && app.application !== 'main') {
            fs.mkdirSync(source);
            command('git', ['init', '--quiet'], source);
            try { fetchCommit(source, app.repository, app.sha); } catch (error) { throw new Error(`${app.application}: pinned commit ${app.sha} is unavailable from ${app.repository}; refusing to substitute another version (${error.message})`); }
            command('git', ['checkout', '--quiet', '--detach', 'FETCH_HEAD'], source);
        }
        if (!fs.existsSync(path.join(source, 'package.json'))) throw new Error(`${app.application}: source checkout missing at ${source}`);
        const sha = git(source, 'rev-parse', 'HEAD');
        const dirty = !!git(source, 'status', '--porcelain');
        checkSource(app, { sha, dirty }, { allowDirty });
        const node = nodeEnvironment(app, nodeBins);
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
        checkScript(app, pkg);
        const metadata = { ...app, sourceSha: sha, sourceDigest: digest.digest('hex'), dirty, version: pkg.version, nodeVersion: node.version };
        if (app.data) {
            // Code stays pinned; reviewed data follows the default branch, recorded by commit and digest.
            metadata.data = { ref: app.data.ref, paths: app.data.paths, sha };
            if (!local) {
                const head = git(source, 'ls-remote', `https://github.com/${app.repository}.git`, `refs/heads/${app.data.ref}`).split('\t')[0];
                if (!/^[a-f0-9]{40}$/.test(head)) throw new Error(`${app.application}: cannot resolve reviewed data branch ${app.data.ref}`);
                if (head !== sha) {
                    fetchCommit(source, app.repository, head);
                    for (const rel of app.data.paths) fs.rmSync(path.join(snapshot, rel), { recursive: true, force: true });
                    const archive = spawnSync('git', ['archive', '--format=tar', head, ...app.data.paths], { cwd: source, maxBuffer: 512 * 1024 * 1024 });
                    if (archive.status !== 0) throw new Error(`${app.application}: data paths missing at ${head}`);
                    const extract = spawnSync('tar', ['-x', '-C', snapshot], { input: archive.stdout });
                    if (extract.status !== 0) throw new Error(`${app.application}: data extraction failed`);
                }
                metadata.data.sha = head;
            }
            metadata.data.digest = treeDigest(snapshot, app.data.paths);
        }
        if (app.application === 'main' && existingMain) {
            fs.cpSync(path.resolve(existingMain), path.join(snapshot, app.output), { recursive: true });
        } else {
            command('npm', ['ci', '--no-audit', '--no-fund'], snapshot, false, node.env);
            if (app.data?.refresh) {
                metadata.data.refresh = { script: app.data.refresh, at: new Date().toISOString() };
                command('npm', ['run', app.data.refresh], snapshot, false, node.env);
                metadata.data.refresh.digest = treeDigest(snapshot, app.data.paths);
            }
            command('npm', ['run', app.build], snapshot, false, node.env);
        }
        metadata.directory = path.join(snapshot, app.output);
        if (baseline) {
            if (app.application !== 'main') command('npm', ['run', 'build'], snapshot, false, node.env);
            const legacyPath = app.application === 'main' ? '' : app.repository.split('/')[1];
            const baselineOutput = path.join(path.resolve(baseline), legacyPath);
            fs.mkdirSync(baselineOutput, { recursive: true });
            fs.cpSync(metadata.directory, baselineOutput, { recursive: true });
            if (app.application !== 'main') command('npm', ['run', app.build], snapshot, false, node.env);
        }
        if (app.application === 'main') prepareMain(metadata.directory);
        snapshots.push(metadata);
    }
    const result = assemble(snapshots, destination, { releaseEligible: !allowDirty && snapshots.every(app => !app.dirty), buildId: process.env.GITHUB_RUN_ID || 'local-rehearsal', builtAt, nodeVersion: process.version }, reports);
    fs.writeFileSync(path.join(reports, 'build-report.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ destination, reports, ...result }, null, 2));
} finally {
    fs.rmSync(staging, { recursive: true, force: true });
}
