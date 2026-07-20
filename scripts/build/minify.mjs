#!/usr/bin/env node
// minify.mjs — produce .min.css / .min.js siblings for tracked assets.
//
// Why: the deployed site is GitHub Pages → plain file serving. We commit
// both the unminified source (for diffs + maintainer readability) and the
// minified output (what users actually download). HTML references the
// .min.* versions with a content-hash query string so the browser + SW
// only re-fetch on actual content change.
//
// Usage:
//   node scripts/build/minify.mjs           # build once
//   node scripts/build/minify.mjs --watch   # rebuild on source change
//
// Emits:
//   - <name>.min.<css|js> next to each source
//   - <name>.min.js.map (linked sourcemaps for JS)
//   - scripts/build/asset-manifest.json (path → { hash, bytes, sourceBytes })

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { build as esbuildBuild, transform as esbuildTransform } from 'esbuild';
import { bundle as lightningBundle, transform as lightningTransform, Features } from 'lightningcss';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const MANIFEST_PATH = path.join(REPO_ROOT, 'scripts', 'build', 'asset-manifest.json');

const CSS_INPUTS = [
    'styles.css',
    'home.css',
    'theme-overrides.css',
    'styles/shared-nav.css',
    'styles/critical-common.css',
    'styles/critical-standings.css',
    'styles/fonts.css',
    'styles/vendor/bootstrap.slim.css',
    'blog-module/blog-styles.css',
    'blog-module/blog/article-rail.css',
    'blog-module/blog/article-styles.css',
    'standings/standings.css',
    'standings/standings-polish.css',
    // Phase 7: per-tab stylesheets lazily injected by standings.js.
    'standings/tabs/quali-gaps.css',
    'standings/tabs/lap1-gains.css',
    'standings/tabs/tyre-pace.css',
    'standings/tabs/dirty-air.css',
    'standings/tabs/track-dominance.css',
    'standings/tabs/pit-stops.css',
    'standings/tabs/debrief.css',
    'standings/tabs/destructors.css'
];

const CSS_BUNDLE_INPUTS = new Set([
    'styles.css'
]);

const CSS_DEPENDENCIES = [
    'styles/layers.css'
];

const JS_INPUTS = [
    'scripts/theme-init.js',
    'scripts/hero-background-init.js',
    'scripts/external-redirect.js',
    'scripts/analytics.js',
    'scripts/cookie-consent.js',
    'scripts/shared-nav.js',
    'scripts/sw-register.js',
    'scripts/offline-page.js',
    'scripts/f1-optimized.js',
    'scripts/background-randomizer.js',
    'scripts/perf/error-beacon.js',
    'scripts/perf/web-vitals-beacon.js',
    'blog-module/blog-loader.js',
    'blog-module/blog-index.js',
    'blog-module/blog/article-rail.js',
    'blog-module/blog/article-script.js',
    'blog-module/blog/article-comments.js',
    'blog-module/blog-fixes.js'
];

const STANDINGS_TAB_ENTRIES = [
    'destructors', 'pit-stops', 'quali-gaps', 'lap1-gains',
    'tyre-pace', 'dirty-air', 'track-dominance', 'debrief'
];

function standingsEntryPoints() {
    return Object.fromEntries([
        ['standings', path.join(REPO_ROOT, 'standings', 'standings.js')],
        ...STANDINGS_TAB_ENTRIES.map(name => [
            `tabs/${name}`, path.join(REPO_ROOT, 'standings', 'tabs', `${name}.js`)
        ])
    ]);
}

function cleanStandingsGeneratedOutputs() {
    for (const dir of ['core', 'tabs']) {
        const absDir = path.join(REPO_ROOT, 'standings', dir);
        if (!fs.existsSync(absDir)) continue;
        for (const name of fs.readdirSync(absDir)) {
            if (/\.min\.js(?:\.map)?$/i.test(name)) fs.rmSync(path.join(absDir, name), { force: true });
        }
    }
    fs.rmSync(path.join(REPO_ROOT, 'standings', 'chunks'), { recursive: true, force: true });
}

async function buildStandingsGraph() {
    cleanStandingsGeneratedOutputs();
    const result = await esbuildBuild({
        absWorkingDir: REPO_ROOT,
        entryPoints: Object.values(standingsEntryPoints()),
        outdir: REPO_ROOT,
        outbase: REPO_ROOT,
        entryNames: '[dir]/[name].min',
        chunkNames: 'standings/chunks/[name]-[hash].min',
        bundle: true,
        splitting: true,
        format: 'esm',
        platform: 'browser',
        target: ['es2019'],
        minify: true,
        legalComments: 'none',
        sourcemap: 'external',
        metafile: true,
        logLevel: 'silent'
    });

    const rows = [];
    const outputs = result.metafile?.outputs || {};
    for (const [outputPath, meta] of Object.entries(outputs)) {
        const relOut = path.relative(REPO_ROOT, outputPath).replace(/\\/g, '/');
        if (!relOut.endsWith('.min.js')) continue;
        const bytes = fs.statSync(outputPath).size;
        if (meta.entryPoint) {
            const relSource = path.relative(REPO_ROOT, meta.entryPoint).replace(/\\/g, '/');
            rows.push({ rel: relSource, outRel: relOut, sourceBytes: fs.statSync(meta.entryPoint).size, bytes });
        }
    }
    return rows;
}

function sha256Short(buf) {
    return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8);
}

function readExistingManifest() {
    try {
        return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    } catch (_) {
        return null;
    }
}

function fmtBytes(b) {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

function minPathFor(rel) {
    const ext = path.extname(rel);
    return rel.slice(0, -ext.length) + '.min' + ext;
}

async function minifyCss(rel) {
    const abs = path.join(REPO_ROOT, rel);
    const source = fs.readFileSync(abs);
    const options = {
        filename: CSS_BUNDLE_INPUTS.has(rel) ? abs : rel,
        minify: true,
        sourceMap: false,
        include: Features.Nesting | Features.MediaQueries,
        targets: {
            // Modern browsers that also ship service workers.
            chrome: 90 << 16,
            firefox: 90 << 16,
            safari: 15 << 16,
            edge: 90 << 16
        }
    };
    const { code } = CSS_BUNDLE_INPUTS.has(rel)
        ? lightningBundle(options)
        : lightningTransform({ ...options, code: source });
    const outRel = minPathFor(rel);
    const outAbs = path.join(REPO_ROOT, outRel);
    fs.writeFileSync(outAbs, code);
    return { outRel, sourceBytes: source.length, bytes: code.length };
}

async function minifyJs(rel) {
    const abs = path.join(REPO_ROOT, rel);
    const source = fs.readFileSync(abs, 'utf8');
    const inlineSourceMap = rel !== 'scripts/perf/error-beacon.js';
    const result = await esbuildTransform(source, {
        loader: 'js',
        minify: true,
        sourcemap: inlineSourceMap ? 'external' : false,
        target: ['es2019'],
        legalComments: 'none',
        sourcefile: rel
    });
    const outRel = minPathFor(rel);
    const outAbs = path.join(REPO_ROOT, outRel);
    const sourcemapRel = outRel + '.map';
    const outputCode = inlineSourceMap
        ? result.code + `//# sourceMappingURL=${path.basename(sourcemapRel)}\n`
        : result.code;
    fs.writeFileSync(outAbs, outputCode);
    if (inlineSourceMap) {
        fs.writeFileSync(path.join(REPO_ROOT, sourcemapRel), result.map);
    }
    return { outRel, sourceBytes: Buffer.byteLength(source, 'utf8'), bytes: Buffer.byteLength(outputCode, 'utf8') };
}

async function buildOnce() {
    const manifest = {};
    const rows = [];

    for (const rel of CSS_INPUTS) {
        if (!fs.existsSync(path.join(REPO_ROOT, rel))) {
            console.warn(`skip (missing): ${rel}`);
            continue;
        }
        const { outRel, sourceBytes, bytes } = await minifyCss(rel);
        const hash = sha256Short(fs.readFileSync(path.join(REPO_ROOT, outRel)));
        manifest[rel] = { min: outRel, hash, bytes, sourceBytes };
        rows.push({ rel, outRel, sourceBytes, bytes });
    }

    for (const rel of JS_INPUTS) {
        if (!fs.existsSync(path.join(REPO_ROOT, rel))) {
            console.warn(`skip (missing): ${rel}`);
            continue;
        }
        const { outRel, sourceBytes, bytes } = await minifyJs(rel);
        const hash = sha256Short(fs.readFileSync(path.join(REPO_ROOT, outRel)));
        manifest[rel] = { min: outRel, hash, bytes, sourceBytes };
        rows.push({ rel, outRel, sourceBytes, bytes });
    }

    for (const row of await buildStandingsGraph()) {
        const hash = sha256Short(fs.readFileSync(path.join(REPO_ROOT, row.outRel)));
        manifest[row.rel] = { min: row.outRel, hash, bytes: row.bytes, sourceBytes: row.sourceBytes };
        rows.push(row);
    }

    const existingManifest = readExistingManifest();
    const filesUnchanged = existingManifest?.updatedAt
        && JSON.stringify(existingManifest.files || {}) === JSON.stringify(manifest);
    const payload = {
        updatedAt: filesUnchanged ? existingManifest.updatedAt : new Date().toISOString(),
        note: 'Generated by scripts/build/minify.mjs. Do not edit by hand. Run `npm run build:assets` to refresh.',
        files: manifest
    };
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');

    // Summary table.
    const nameW = Math.max(...rows.map(r => r.rel.length), 10);
    console.log(`\nminify results:\n`);
    console.log(`${'file'.padEnd(nameW)}  ${'source'.padStart(10)}  ${'min'.padStart(10)}  ${'saved'.padStart(8)}  ratio`);
    console.log('-'.repeat(nameW + 40));
    let totSrc = 0, totMin = 0;
    for (const r of rows) {
        const saved = r.sourceBytes - r.bytes;
        const ratio = r.sourceBytes === 0 ? 0 : (1 - r.bytes / r.sourceBytes) * 100;
        totSrc += r.sourceBytes;
        totMin += r.bytes;
        console.log(
            `${r.rel.padEnd(nameW)}  ${fmtBytes(r.sourceBytes).padStart(10)}  ${fmtBytes(r.bytes).padStart(10)}  ${fmtBytes(saved).padStart(8)}  ${ratio.toFixed(1)}%`
        );
    }
    console.log('-'.repeat(nameW + 40));
    const totalSaved = totSrc - totMin;
    const totalRatio = totSrc === 0 ? 0 : (1 - totMin / totSrc) * 100;
    console.log(
        `${'TOTAL'.padEnd(nameW)}  ${fmtBytes(totSrc).padStart(10)}  ${fmtBytes(totMin).padStart(10)}  ${fmtBytes(totalSaved).padStart(8)}  ${totalRatio.toFixed(1)}%\n`
    );
    console.log(`✓ manifest: ${path.relative(REPO_ROOT, MANIFEST_PATH)}`);
}

async function watch() {
    console.log('watching…');
    await buildOnce();
    const srcs = [...CSS_INPUTS, ...CSS_DEPENDENCIES, ...JS_INPUTS]
        .map(r => path.join(REPO_ROOT, r))
        .filter(fs.existsSync);
    for (const s of srcs) {
        fs.watch(s, { persistent: true }, async (ev) => {
            if (ev !== 'change' && ev !== 'rename') return;
            console.log(`\nchange: ${path.relative(REPO_ROOT, s)}`);
            try { await buildOnce(); }
            catch (e) { console.error('build failed:', e.message); }
        });
    }
}

const mode = process.argv.includes('--watch') ? 'watch' : 'once';
if (mode === 'watch') watch();
else buildOnce().catch(e => { console.error(e); process.exit(1); });
