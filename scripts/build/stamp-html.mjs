#!/usr/bin/env node
// stamp-html.mjs — rewrite tracked HTML files to reference .min.* assets
// with a content-hash query string from scripts/build/asset-manifest.json.
//
// Idempotent: re-running produces identical output. Only the content hash
// changes when the underlying asset changes.
//
// Scope: explicit list of HTML files below. Deliberately does NOT touch
// blog-module/blog-entries/**/article.html — those are committed content
// artifacts that will be regenerated on the next blog rebuild via the
// (already-stamped) blog-module/blog/template.html.
//
// Usage:
//   node scripts/build/stamp-html.mjs
//   node scripts/build/stamp-html.mjs --dry   # print planned edits only

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const MANIFEST_PATH = path.join(REPO_ROOT, 'scripts', 'build', 'asset-manifest.json');

// HTML files whose asset references we rewrite. Add to this list with care
// — stamping a file with external asset references is fine; stamping a
// content-committed article is NOT (see module header).
const TARGET_HTML = [
    'index.html',
    'offline.html',
    'standings/index.html',
    'blog-module/blog/index.html',
    'blog-module/blog/template.html',
    '404.html'
];

function loadManifest() {
    if (!fs.existsSync(MANIFEST_PATH)) {
        console.error(`✗ manifest missing: ${MANIFEST_PATH}\n  run: npm run build:assets`);
        process.exit(2);
    }
    const payload = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    return payload.files || {};
}

function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Match every way a ref to sourceRel might appear in an HTML attribute:
//   href="/styles.css"                    (root-absolute)
//   href="styles/shared-nav.css"          (relative with subpath)
//   href="standings.css"                  (bare basename, usually same-dir)
//   href="styles.css?v=anything"          (existing query string, any form)
// The minified replacement mirrors the same prefix form to keep the page
// happy regardless of its own location in the tree.
function buildPatternsFor(sourceRel) {
    const basename = path.basename(sourceRel);                  // e.g. styles.css
    const minBasename = path.basename(sourceRel).replace(/\.(css|js)$/, '.min.$1');
    const minRel = sourceRel.replace(/\.(css|js)$/, '.min.$1');
    const refs = [];
    // Root-absolute form: "/styles/shared-nav.css"
    refs.push({ from: '/' + sourceRel, to: '/' + minRel });
    // Relative-with-subpath form: "styles/shared-nav.css"
    if (sourceRel.includes('/')) {
        refs.push({ from: sourceRel, to: minRel });
    }
    // Bare basename (only if the source has no subpath, else ambiguous)
    if (!sourceRel.includes('/') || sourceRel.split('/').length === 2) {
        refs.push({ from: basename, to: minBasename });
    }
    return refs.map(ref => ({
        regex: new RegExp(
            `(href|src)=("|')(` + escapeRegex(ref.from) + `)(\\?[^"']*)?(\\2)`,
            'g'
        ),
        toRef: ref.to,
        source: sourceRel
    }));
}

function buildPatternsFromManifest(manifest) {
    const out = [];
    for (const [sourceRel, info] of Object.entries(manifest)) {
        const patterns = buildPatternsFor(sourceRel);
        for (const p of patterns) {
            out.push({ ...p, hash: info.hash });
        }
    }
    // Sort longer `from` refs first so "/scripts/perf/web-vitals-beacon.js"
    // wins before a generic "web-vitals-beacon.js" rule ever runs.
    out.sort((a, b) => b.regex.source.length - a.regex.source.length);
    return out;
}

function rewrite(html, patterns) {
    let result = html;
    const hits = [];
    for (const p of patterns) {
        result = result.replace(p.regex, (match, attr, q) => {
            const stamped = `${attr}=${q}${p.toRef}?v=${p.hash}${q}`;
            if (match !== stamped) {
                hits.push({ source: p.source, from: match, to: stamped });
            }
            return stamped;
        });
    }
    return { result, hits };
}

function main() {
    const manifest = loadManifest();
    const patterns = buildPatternsFromManifest(manifest);
    const dry = process.argv.includes('--dry');
    let totalHits = 0;

    for (const rel of TARGET_HTML) {
        const abs = path.join(REPO_ROOT, rel);
        if (!fs.existsSync(abs)) {
            console.warn(`skip (missing): ${rel}`);
            continue;
        }
        const original = fs.readFileSync(abs, 'utf8');
        const { result, hits } = rewrite(original, patterns);
        if (hits.length === 0) {
            console.log(`· ${rel}  (no changes)`);
            continue;
        }
        totalHits += hits.length;
        console.log(`\n${rel}  →  ${hits.length} rewrite(s)`);
        for (const h of hits) {
            console.log(`    ${h.from}\n  → ${h.to}`);
        }
        if (!dry && original !== result) {
            fs.writeFileSync(abs, result, 'utf8');
        }
    }

    if (dry) console.log(`\n(dry-run) ${totalHits} rewrite(s) planned.`);
    else console.log(`\n✓ stamped ${totalHits} reference(s) across ${TARGET_HTML.length} file(s).`);
}

main();
