#!/usr/bin/env node
// build-icon-sprite.mjs — scan the repo for Font Awesome icon usages and
// emit a single SVG sprite containing one <symbol> per unique icon.
//
// Why:
//   Replacing the Font Awesome CDN (~80KB render-blocking CSS + a woff2
//   per icon font) with an inline SVG sprite cuts a third-party request
//   and ships only the icons we actually use.
//
// What it does:
//   1. Scans *.html / *.js / *.css under the repo (excluding node_modules,
//      blog-module/blog-entries, and other generated trees) for
//      `fa[srb] fa-<name>` class patterns.
//   2. Maps each (prefix, name) pair to an SVG file shipped by
//      @fortawesome/fontawesome-free (devDep). Resolves v5-era aliases
//      (fa-home → house, fa-times → xmark, …) by parsing icons.yml.
//   3. Reads each SVG, extracts viewBox + inner markup, and wraps it in
//      <symbol id="fa-<name>" viewBox="...">…</symbol> — id uses the
//      *alias* name so existing markup like `<use href="#fa-home"/>` works.
//   4. Writes the combined sprite to images/icons/sprite.svg.
//
// The sprite is later inlined into each HTML shell by stamp-html.mjs.
//
// Usage:
//   node scripts/build/build-icon-sprite.mjs          # scan + write
//   node scripts/build/build-icon-sprite.mjs --dry    # print plan only

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const FA_ROOT = path.join(REPO_ROOT, 'node_modules', '@fortawesome', 'fontawesome-free');
const FA_SVGS = path.join(FA_ROOT, 'svgs');
const FA_ICONS_YML = path.join(FA_ROOT, 'metadata', 'icons.yml');
const OUT_PATH = path.join(REPO_ROOT, 'images', 'icons', 'sprite.svg');

// Map `fa<prefix>` class → FA svgs subdir.
const PREFIX_DIR = { fas: 'solid', fab: 'brands', far: 'regular', fa: 'solid' };

// Source files to scan. Deliberately narrow: no node_modules, no generated
// article HTML (those will be re-generated in Phase 3c via blog-processor.js).
const SCAN_GLOBS = [
    '*.html',
    'blog-module/**/*.html',
    'privacy/**/*.html',
    'standings/**/*.html',
    'scripts/**/*.js',
    'blog-module/*.js',
    'standings/*.js'
];
// Scanned *for icon usage*. blog-entries/ is included because Phase 3c will
// regenerate those articles against this same sprite — capturing icons only
// used inside article bodies now (e.g. fa-spotify, fa-calendar, fa-folder)
// means the regeneration pass needs no further sprite updates.
const SCAN_EXCLUDES = [
    /\/node_modules\//,
    /\/blog-module\/generated\//,
    /\.min\.(js|css)$/,
    /\/dist\//
];

function walk(dir, out = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
        const abs = path.join(dir, e.name);
        if (SCAN_EXCLUDES.some(re => re.test(abs))) continue;
        if (e.isDirectory()) walk(abs, out);
        else if (/\.(html|js|css)$/.test(e.name)) out.push(abs);
    }
    return out;
}

// Two usage forms we scan for, post- and pre-Phase-3b migration:
//   1. `<use href="#fa-<name>"/>` — the canonical migrated form.
//      Prefix is unknown here, so we route it to 'fa' (solid default with
//      alias-map fallback to brands/regular).
//   2. `<i class="fa[srb]? fa-<name> …">` — the FA webfont form. Survives
//      on blog-entries articles until Phase 3c regenerates them, and in
//      any new code an author forgets to migrate.
const USE_RE   = /<use\s+href="#fa-([a-z0-9][a-z0-9-]*)"\s*\/?>/g;
const CLASS_RE = /\b(fas|fab|far|fa)\s+fa-([a-z0-9][a-z0-9-]*)\b/g;

function scanUsages() {
    const files = walk(REPO_ROOT).filter(f => !SCAN_EXCLUDES.some(re => re.test(f)));
    const usage = new Map(); // key: `${prefix}:${name}` → Set of source files
    const add = (prefix, name, rel) => {
        const key = `${prefix}:${name}`;
        if (!usage.has(key)) usage.set(key, new Set());
        usage.get(key).add(rel);
    };
    for (const abs of files) {
        const txt = fs.readFileSync(abs, 'utf8');
        const rel = path.relative(REPO_ROOT, abs);
        let m;
        USE_RE.lastIndex = 0;
        while ((m = USE_RE.exec(txt)) !== null) add('fa', m[1], rel);
        CLASS_RE.lastIndex = 0;
        while ((m = CLASS_RE.exec(txt)) !== null) add(m[1], m[2], rel);
    }
    return usage;
}

// Parse icons.yml to build an alias → canonical map. The file format is:
//   <canonical>:
//     ...
//     aliases:
//       names:
//         - <alias1>
//         - <alias2>
//     ...
// We only need the (top-level name, alias) pairs; everything else is ignored.
function loadAliasMap() {
    const text = fs.readFileSync(FA_ICONS_YML, 'utf8');
    const lines = text.split('\n');
    const map = new Map(); // alias → canonical
    let canonical = null;
    let inAliases = false;
    let inNames = false;
    for (const line of lines) {
        const top = line.match(/^([a-z0-9][a-z0-9-]*|'[^']+'):\s*$/);
        if (top) {
            canonical = top[1].replace(/^'|'$/g, '');
            inAliases = false;
            inNames = false;
            continue;
        }
        if (/^  aliases:\s*$/.test(line)) { inAliases = true; inNames = false; continue; }
        if (inAliases && /^    names:\s*$/.test(line)) { inNames = true; continue; }
        if (inNames) {
            const item = line.match(/^      - (.+)$/);
            if (item) {
                const alias = item[1].trim().replace(/^['"]|['"]$/g, '');
                if (canonical && !map.has(alias)) map.set(alias, canonical);
                continue;
            }
            // any line that doesn't match the list item shape ends the list
            if (line.length && !/^\s*#/.test(line)) inNames = false;
        }
        // any non-indented key ends the current icon block — handled by top match above
    }
    return map;
}

function resolveSvgPath(prefix, name, aliasMap) {
    const sub = PREFIX_DIR[prefix];
    if (!sub) return null;
    const direct = path.join(FA_SVGS, sub, `${name}.svg`);
    if (fs.existsSync(direct)) return { abs: direct, resolved: name };
    // Try aliases → canonical
    const canon = aliasMap.get(name);
    if (canon) {
        for (const alt of [sub, 'solid', 'brands', 'regular']) {
            const p = path.join(FA_SVGS, alt, `${canon}.svg`);
            if (fs.existsSync(p)) return { abs: p, resolved: canon, via: 'alias' };
        }
    }
    // Fallback: scan all three subdirs with the original name
    for (const alt of ['solid', 'brands', 'regular']) {
        const p = path.join(FA_SVGS, alt, `${name}.svg`);
        if (fs.existsSync(p)) return { abs: p, resolved: name, via: 'alt-prefix' };
    }
    return null;
}

// Extract viewBox + inner content from a single-<svg> file.
function extractSymbol(svgText) {
    const vbMatch = svgText.match(/viewBox="([^"]+)"/);
    const viewBox = vbMatch ? vbMatch[1] : '0 0 512 512';
    // Strip the outer <svg …> opening/closing and the license comment.
    const inner = svgText
        .replace(/<\?xml[^?]*\?>/g, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/^[\s\S]*?<svg[^>]*>/, '')
        .replace(/<\/svg>[\s\S]*$/, '')
        .trim();
    return { viewBox, inner };
}

function build(dry) {
    if (!fs.existsSync(FA_ROOT)) {
        console.error(`✗ ${FA_ROOT} not found — run: npm install`);
        process.exit(2);
    }
    const usage = scanUsages();
    const aliasMap = loadAliasMap();

    // Group usages by the *alias name* we'll use as the sprite symbol id.
    // Multiple (prefix, name) hits for the same name collapse into one symbol.
    const symbols = new Map(); // aliasName → { resolved, viewBox, inner, sources: Set, prefix }
    const missing = [];

    for (const [key, sources] of usage) {
        const [prefix, name] = key.split(':');
        // Ignore the plain "fa" used in "fa fa-coffee" etc. — treat as solid.
        const resolved = resolveSvgPath(prefix, name, aliasMap);
        if (!resolved) {
            missing.push({ prefix, name, sources: [...sources] });
            continue;
        }
        if (symbols.has(name)) {
            for (const s of sources) symbols.get(name).sources.add(s);
            continue;
        }
        const svg = fs.readFileSync(resolved.abs, 'utf8');
        const { viewBox, inner } = extractSymbol(svg);
        symbols.set(name, {
            resolved: resolved.resolved,
            viewBox,
            inner,
            sources,
            prefix
        });
    }

    const ordered = [...symbols.keys()].sort();
    const parts = [];
    parts.push('<?xml version="1.0" encoding="UTF-8"?>');
    parts.push('<!-- Generated by scripts/build/build-icon-sprite.mjs — do not edit. -->');
    parts.push('<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">');
    for (const name of ordered) {
        const s = symbols.get(name);
        parts.push(`  <symbol id="fa-${name}" viewBox="${s.viewBox}">${s.inner}</symbol>`);
    }
    parts.push('</svg>');
    const sprite = parts.join('\n') + '\n';

    console.log(`scanned: ${usage.size} (prefix,name) pair(s) across source files`);
    console.log(`symbols: ${symbols.size} unique icon(s)`);
    if (missing.length) {
        console.warn(`\n⚠ ${missing.length} icon(s) not resolved — the sprite omits these:`);
        for (const m of missing) console.warn(`    ${m.prefix} fa-${m.name}   (used in ${m.sources.join(', ')})`);
    }

    if (dry) {
        console.log(`\n(dry-run) would write ${path.relative(REPO_ROOT, OUT_PATH)} (${sprite.length} bytes)`);
        return;
    }
    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    const prev = fs.existsSync(OUT_PATH) ? fs.readFileSync(OUT_PATH, 'utf8') : null;
    if (prev === sprite) {
        console.log(`· ${path.relative(REPO_ROOT, OUT_PATH)} (unchanged, ${sprite.length} B)`);
        return;
    }
    fs.writeFileSync(OUT_PATH, sprite, 'utf8');
    console.log(`\n✓ wrote ${path.relative(REPO_ROOT, OUT_PATH)} (${sprite.length} B)`);
}

build(process.argv.includes('--dry'));
