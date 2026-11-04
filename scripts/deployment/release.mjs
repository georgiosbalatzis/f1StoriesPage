// Release gates for the pinned aggregate build. Pure checks; build.mjs runs the commands.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

export const ORIGIN = 'https://f1-stories.gr';

function walkFiles(root, prefix = '') {
    const out = [];
    for (const entry of fs.readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        const full = path.join(root, entry.name);
        if (fs.lstatSync(full).isSymbolicLink()) throw new Error(`Symlink in artifact directory is not allowed: ${rel}`);
        if (entry.isDirectory()) out.push(...walkFiles(full, rel));
        else if (entry.isFile()) out.push(rel);
        else throw new Error(`Unsupported filesystem entry in artifact directory: ${rel}`);
    }
    return out;
}

export function seedImageCache(source, destination) {
    if (!fs.existsSync(source)) return;
    fs.cpSync(source, destination, {
        recursive: true,
        filter: file => path.basename(file) !== 'report.json' && !fs.lstatSync(file).isSymbolicLink(),
    });
}
// application, repository, canonical path, output directory: the reviewed ownership map.
export const EXPECTED = [
    ['main', 'georgiosbalatzis/f1StoriesPage', '/', 'dist'],
    ['telemetry', 'georgiosbalatzis/f1-telemetry-dashboard', '/telemetry/', 'dist'],
    ['ghostcar', 'georgiosbalatzis/ghostcar', '/ghostcar/', 'dist'],
    ['tyres', 'georgiosbalatzis/Tyres', '/tyres/', 'dist'],
    ['betcast', 'georgiosbalatzis/BetCastVisualisation', '/betcast/', 'build'],
];

export function checkLock(config) {
    if (config.origin !== ORIGIN || config.applications?.length !== EXPECTED.length) throw new Error('Invalid origin/application lock');
    if (config.enabled && !config.releaseReady) throw new Error('Aggregation cannot be enabled before releaseReady');
    EXPECTED.forEach(([application, repository, canonicalPath, output], index) => {
        const app = config.applications[index];
        if (app.application !== application || app.repository !== repository || app.path !== canonicalPath || app.output !== output) throw new Error('Invalid source lock entry');
        if (app.path !== '/' && !/^[a-f0-9]{40}$/.test(app.sha || '')) throw new Error(`${application}: child source pins must be full commit SHAs`);
        if (!/^\d+$/.test(app.node || '')) throw new Error(`${application}: declare the Node major it is built with`);
        if (app.data) {
            if (app.data.ref !== 'main' || !app.data.paths?.length) throw new Error(`${application}: data may only follow the reviewed default branch`);
            for (const rel of app.data.paths) if (!/^[a-z0-9][a-z0-9_-]*$/.test(rel)) throw new Error(`${application}: unsafe data path ${rel}`);
        }
    });
    return config;
}

/** release: publishable; rehearsal: the same pinned build, for the dry run only; local: workspace sources. */
export function buildMode({ local, rehearsal }) {
    if (local && rehearsal) throw new Error('--rehearsal builds the pinned sources; it cannot be combined with --local');
    return local ? 'local' : rehearsal ? 'rehearsal' : 'release';
}

export function assertReleasable(config, { local, rehearsal = false }) {
    if (buildMode({ local, rehearsal }) === 'release' && !config.releaseReady) throw new Error('Release pins are not ready: commit reviewed migration changes and update child SHAs first');
}

export function checkSource(app, { sha, dirty }, { allowDirty }) {
    if (dirty && !allowDirty) throw new Error(`${app.application}: dirty sources require explicit --local --allow-dirty; release builds forbid them`);
    if (!allowDirty && app.sha && sha !== app.sha) throw new Error(`${app.application}: source SHA ${sha} does not match reviewed pin ${app.sha}`);
}

export function checkScript(app, pkg) {
    if (!pkg.scripts?.[app.build]) throw new Error(`${app.application}: pinned source lacks ${app.build}; commit migration changes and update source pins before release`);
    const floor = /^>=\s*(\d+)/.exec(pkg.engines?.node || '');
    if (floor && Number(app.node) < Number(floor[1])) throw new Error(`${app.application}: lock builds with Node ${app.node} but the package requires ${pkg.engines.node}`);
    for (const script of [app.data?.refresh].filter(Boolean)) if (!pkg.scripts[script]) throw new Error(`${app.application}: pinned source lacks ${script}`);
}

/** Environment for an application's own Node major; --node-bin MAJOR=DIR supplies other majors. */
export function nodeEnvironment(app, nodeBins, env = process.env) {
    const current = process.versions.node.split('.')[0];
    const bin = current === app.node ? null : nodeBins[app.node];
    if (current !== app.node && !bin) throw new Error(`${app.application}: requires Node ${app.node}.x (running ${process.version}); pass --node-bin ${app.node}=<directory>`);
    const result = { ...env, PATH: bin ? bin + path.delimiter + env.PATH : env.PATH };
    const version = spawnSync('node', ['--version'], { env: result, encoding: 'utf8' }).stdout?.trim() || '';
    if (version.split('.')[0] !== `v${app.node}`) throw new Error(`${app.application}: requires Node ${app.node}.x, found ${version || 'none'}`);
    return { env: result, version };
}

export function treeDigest(root, rels) {
    const digest = createHash('sha256');
    const walk = rel => {
        const full = path.join(root, rel);
        if (!fs.existsSync(full)) return;
        if (fs.statSync(full).isDirectory()) return fs.readdirSync(full).sort().forEach(name => walk(path.posix.join(rel, name)));
        digest.update(rel + '\0').update(fs.readFileSync(full));
    };
    rels.forEach(walk);
    return digest.digest('hex');
}

const TYRES_FORECAST_HOURS = 24; // TYRES' own stale-forecast threshold (src/ui/weather.ts)
const DAY = 86400000;

/** TYRES data must be generated by this build; forecasts the app itself would call stale are reported. */
export function checkFreshness(directory, builtAt) {
    const data = path.join(directory, 'tyres/data');
    const manifest = JSON.parse(fs.readFileSync(path.join(data, 'manifest.json'), 'utf8'));
    const built = Date.parse(builtAt);
    if (!(built - Date.parse(manifest.generatedAt) < 6 * 3600000)) throw new Error(`tyres: stale data snapshot (generated ${manifest.generatedAt}, built ${builtAt})`);
    const warnings = [];
    const weekends = path.join(data, 'weekends');
    for (const name of fs.existsSync(weekends) ? fs.readdirSync(weekends).sort() : []) {
        const weekend = JSON.parse(fs.readFileSync(path.join(weekends, name), 'utf8'));
        const [first, , last] = weekend.dates || [];
        if (!first || built < Date.parse(first) - 15 * DAY || built > Date.parse(last) + DAY) continue;
        const age = weekend.weather ? (built - Date.parse(weekend.weather.retrievedAt)) / 3600000 : Infinity;
        if (age > TYRES_FORECAST_HOURS) warnings.push(`${weekend.raceId}: forecast ${weekend.weather ? Math.round(age) + ' h old' : 'missing'}; TYRES labels it stale`);
    }
    return { dataGeneratedAt: manifest.generatedAt, latest: manifest.latest, warnings };
}

const CHILD_CACHE_SCHEMA = 1;

/** Content-addressed identity for an immutable child application build. */
export function childCacheKey(app, { nodeMajor = app.node, dataSha = null } = {}) {
    const payload = {
        schema: CHILD_CACHE_SCHEMA,
        application: app.application,
        repository: app.repository,
        sha: app.sha,
        path: app.path,
        output: app.output,
        build: app.build,
        nodeMajor: String(nodeMajor),
        data: app.data ? { ref: app.data.ref, paths: app.data.paths, refresh: app.data.refresh || null, sha: dataSha } : null,
    };
    return `${app.application}-${createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 24)}`;
}

/** Save a built child application output directory and its cryptographic file inventory to cacheRoot. */
export function saveChildCache(cacheRoot, app, metadata, outputDirectory, { dataSha = metadata.data?.sha || null } = {}) {
    if (!cacheRoot || app.path === '/' || metadata.dirty) return null;
    const key = childCacheKey(app, { nodeMajor: app.node, dataSha });
    const entryDir = path.join(cacheRoot, key);
    const outDir = path.join(entryDir, 'output');
    fs.rmSync(entryDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
    const entries = [];
    for (const rel of walkFiles(outputDirectory)) {
        const src = path.join(outputDirectory, rel);
        const data = fs.readFileSync(src);
        const dest = path.join(outDir, rel);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, data);
        entries.push({
            path: rel,
            bytes: data.length,
            sha256: createHash('sha256').update(data).digest('hex'),
        });
    }
    const manifest = {
        schemaVersion: CHILD_CACHE_SCHEMA,
        key,
        application: app.application,
        repository: app.repository,
        sourceSha: metadata.sourceSha,
        sourceDigest: metadata.sourceDigest,
        dirty: false,
        canonicalPath: app.path,
        output: app.output,
        build: app.build,
        version: metadata.version,
        nodeMajor: String(app.node),
        nodeVersion: metadata.nodeVersion,
        data: metadata.data || undefined,
        savedAt: new Date().toISOString(),
        entries,
    };
    fs.writeFileSync(path.join(entryDir, 'cache-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    return key;
}

/**
 * Restore a cached child application output directory into targetDirectory only if its provenance,
 * pin, data revision, freshness (for TYRES), and per-file SHA-256 digests are all verified.
 * Returns the restored metadata object on a valid hit, or null on any miss/mismatch/corruption.
 */
export function restoreChildCache(cacheRoot, app, targetDirectory, { nodeMajor = app.node, dataSha = null, builtAt = new Date().toISOString() } = {}) {
    if (!cacheRoot || app.path === '/') return null;
    try {
        const key = childCacheKey(app, { nodeMajor, dataSha });
        const entryDir = path.join(cacheRoot, key);
        const manifestFile = path.join(entryDir, 'cache-manifest.json');
        const outDir = path.join(entryDir, 'output');
        if (!fs.existsSync(manifestFile) || !fs.existsSync(outDir)) return null;
        const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
        if (manifest.schemaVersion !== CHILD_CACHE_SCHEMA || manifest.key !== key) return null;
        if (manifest.application !== app.application || manifest.repository !== app.repository) return null;
        if (manifest.sourceSha !== app.sha || manifest.dirty !== false) return null;
        if (manifest.canonicalPath !== app.path || manifest.output !== app.output || manifest.build !== app.build) return null;
        if (manifest.nodeMajor !== String(nodeMajor) || !/^[a-f0-9]{64}$/.test(manifest.sourceDigest || '')) return null;
        if (app.data) {
            if (!manifest.data || manifest.data.ref !== app.data.ref || manifest.data.sha !== dataSha) return null;
            if (JSON.stringify(manifest.data.paths) !== JSON.stringify(app.data.paths)) return null;
            if (!/^[a-f0-9]{64}$/.test(manifest.data.digest || '')) return null;
            if (app.data.refresh && (!manifest.data.refresh || manifest.data.refresh.script !== app.data.refresh || !/^[a-f0-9]{64}$/.test(manifest.data.refresh.digest || ''))) return null;
        }
        if (!Array.isArray(manifest.entries) || manifest.entries.length === 0) return null;
        const actualFiles = walkFiles(outDir);
        if (actualFiles.length !== manifest.entries.length) return null;
        const expectedByPath = new Map(manifest.entries.map(e => [e.path, e]));
        for (const rel of actualFiles) {
            const expected = expectedByPath.get(rel);
            if (!expected) return null;
            const data = fs.readFileSync(path.join(outDir, rel));
            if (data.length !== expected.bytes) return null;
            if (createHash('sha256').update(data).digest('hex') !== expected.sha256) return null;
        }
        if (app.application === 'tyres') {
            const probeRoot = fs.mkdtempSync(path.join(path.dirname(targetDirectory), 'tyres-probe-'));
            try {
                fs.symlinkSync(outDir, path.join(probeRoot, 'tyres'));
                checkFreshness(probeRoot, builtAt);
            } finally {
                fs.rmSync(probeRoot, { recursive: true, force: true });
            }
        }
        fs.rmSync(targetDirectory, { recursive: true, force: true });
        fs.mkdirSync(targetDirectory, { recursive: true });
        for (const rel of actualFiles) {
            const dest = path.join(targetDirectory, rel);
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.copyFileSync(path.join(outDir, rel), dest, fs.constants.COPYFILE_EXCL);
        }
        return {
            ...app,
            sourceSha: manifest.sourceSha,
            sourceDigest: manifest.sourceDigest,
            dirty: false,
            version: manifest.version,
            nodeVersion: manifest.nodeVersion,
            ...(manifest.data ? { data: manifest.data } : {}),
            directory: targetDirectory,
            cacheHit: true,
        };
    } catch {
        return null;
    }
}
