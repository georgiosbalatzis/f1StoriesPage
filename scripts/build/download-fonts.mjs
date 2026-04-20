#!/usr/bin/env node
// download-fonts.mjs — fetch + self-host Google Fonts (Greek + Latin subsets).
//
// Why self-host:
//   • Removes two render-blocking CDN origins (fonts.googleapis.com,
//     fonts.gstatic.com) from every page.
//   • Lets us preload a single critical woff2 with content-hash caching.
//   • Eliminates a cross-origin connection setup (~40–100ms cold).
//
// What it does:
//   1. Pretends to be a modern Chrome so Google serves woff2 + unicode-range.
//   2. Fetches the CSS for each family+weight combo we ship.
//   3. Parses every @font-face block, downloads the woff2 file.
//   4. Writes the woff2 files to assets/fonts/ with deterministic filenames.
//   5. Writes styles/fonts.css with the same @font-face rules, but with
//      `src:` pointing at the local paths.
//
// Idempotent: re-running compares existing file hashes; only writes on diff.
//
// Usage:
//   node scripts/build/download-fonts.mjs        # fetch + write
//   node scripts/build/download-fonts.mjs --dry  # print plan, don't write

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const FONTS_DIR = path.join(REPO_ROOT, 'assets', 'fonts');
const CSS_OUT = path.join(REPO_ROOT, 'styles', 'fonts.css');

// A realistic modern-Chrome UA. Google's CSS endpoint returns older
// TrueType URLs for non-woff2-capable clients, so a modern UA is required.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
           '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// The exact family/weight combos used in the HTML shells today, as audited
// by grep: Roboto 400/600/700 (main site), DM Sans 400/500/600/700 + 400i
// (blog/standings), Outfit 500/600/700/800 (blog/standings).
const FAMILIES = [
    {
        name: 'Roboto',
        // family=Roboto:wght@400;600;700
        cssFamily: 'Roboto:wght@400;600;700',
        weights: [400, 600, 700],
        italics: false
    },
    {
        name: 'DM Sans',
        // family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400
        cssFamily: 'DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400',
        weights: [400, 500, 600, 700],
        italics: [400]
    },
    {
        name: 'Outfit',
        // family=Outfit:wght@500;600;700;800
        cssFamily: 'Outfit:wght@500;600;700;800',
        weights: [500, 600, 700, 800],
        italics: false
    }
];

// Subsets we care about. Google's CSS endpoint returns multiple @font-face
// blocks per family, one per unicode-range (subset). We keep latin, latin-ext,
// and greek; drop cyrillic, vietnamese, etc.
const KEEP_SUBSETS = new Set(['latin', 'latin-ext', 'greek', 'greek-ext']);

// Heuristic matcher: Google's CSS has comments like `/* latin */` above each
// @font-face so we can tell subsets apart.
const SUBSET_COMMENT_RE = /\/\*\s*([a-z-]+)\s*\*\//g;

function slugify(s) {
    return s.toLowerCase().replace(/\s+/g, '-');
}

function sha256Short(buf) {
    return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8);
}

async function fetchText(url) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/css,*/*' } });
    if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
    return await res.text();
}

async function fetchBinary(url) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    return buf;
}

// Split a multi-family Google Fonts CSS response into per-@font-face blocks,
// annotated with the preceding subset comment.
function splitCss(css) {
    const blocks = [];
    const re = /\/\*\s*([a-z-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g;
    let m;
    while ((m = re.exec(css)) !== null) {
        blocks.push({ subset: m[1], css: m[2] });
    }
    return blocks;
}

function parseFace(css) {
    const get = (prop) => {
        const re = new RegExp(prop + ':\\s*([^;]+);', 'i');
        const m = css.match(re);
        return m ? m[1].trim() : null;
    };
    return {
        family: get('font-family')?.replace(/['"]/g, ''),
        style: get('font-style'),
        weight: get('font-weight'),
        unicodeRange: get('unicode-range'),
        src: get('src')
    };
}

function woff2UrlFrom(src) {
    // src: url(https://fonts.gstatic.com/…) format('woff2')
    const m = src.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/);
    return m ? m[1] : null;
}

// Filename scheme — deterministic, human-readable, no hash in name (the
// content hash goes in the fonts.css query string via stamp-html.mjs).
//   roboto-400.woff2
//   roboto-400-greek.woff2
//   dm-sans-400-italic.woff2
function fontFilename(family, weight, style, subset) {
    const parts = [slugify(family), String(weight)];
    if (style === 'italic') parts.push('italic');
    if (subset && subset !== 'latin') parts.push(subset);
    return parts.join('-') + '.woff2';
}

async function run() {
    const dry = process.argv.includes('--dry');
    fs.mkdirSync(FONTS_DIR, { recursive: true });
    fs.mkdirSync(path.dirname(CSS_OUT), { recursive: true });

    const emittedCss = [];
    let downloads = 0;
    let skipped = 0;

    emittedCss.push(`/* ============================================================`);
    emittedCss.push(`   fonts.css — self-hosted woff2 subsets (Greek + Latin).`);
    emittedCss.push(`   Generated by scripts/build/download-fonts.mjs; do not edit.`);
    emittedCss.push(`   Run: npm run build:fonts to refresh.`);
    emittedCss.push(`   ============================================================ */`);
    emittedCss.push('');

    for (const fam of FAMILIES) {
        const url = `https://fonts.googleapis.com/css2?family=${fam.cssFamily}&display=swap`;
        console.log(`fetch: ${fam.name}`);
        const css = await fetchText(url);
        const blocks = splitCss(css);
        if (!blocks.length) {
            console.warn(`  ! no @font-face blocks parsed for ${fam.name}`);
            continue;
        }

        for (const block of blocks) {
            if (!KEEP_SUBSETS.has(block.subset)) continue;
            const face = parseFace(block.css);
            if (!face.family || !face.src) continue;

            const weight = Number(face.weight) || 400;
            const style = face.style || 'normal';
            if (!fam.weights.includes(weight)) continue;
            if (style === 'italic' && !(Array.isArray(fam.italics) && fam.italics.includes(weight))) continue;

            const woff2Url = woff2UrlFrom(face.src);
            if (!woff2Url) continue;

            const filename = fontFilename(face.family, weight, style, block.subset);
            const absOut = path.join(FONTS_DIR, filename);
            const relOut = path.relative(REPO_ROOT, absOut).split(path.sep).join('/');

            if (!dry) {
                const existingHash = fs.existsSync(absOut)
                    ? sha256Short(fs.readFileSync(absOut))
                    : null;
                const buf = await fetchBinary(woff2Url);
                const newHash = sha256Short(buf);
                if (existingHash !== newHash) {
                    fs.writeFileSync(absOut, buf);
                    downloads++;
                    console.log(`  ✓ ${relOut}  (${(buf.length / 1024).toFixed(1)} KB, ${block.subset})`);
                } else {
                    skipped++;
                    console.log(`  · ${relOut}  (unchanged)`);
                }
            } else {
                console.log(`  · would download ${woff2Url} → ${relOut}`);
            }

            // Emit matching @font-face with local src. Keep unicode-range
            // so the browser loads the right subset on demand only.
            emittedCss.push(`/* ${face.family} ${weight}${style === 'italic' ? ' italic' : ''} — ${block.subset} */`);
            emittedCss.push(`@font-face {`);
            emittedCss.push(`  font-family: '${face.family}';`);
            emittedCss.push(`  font-style: ${style};`);
            emittedCss.push(`  font-weight: ${weight};`);
            emittedCss.push(`  font-display: swap;`);
            emittedCss.push(`  src: url('/${relOut}') format('woff2');`);
            if (face.unicodeRange) emittedCss.push(`  unicode-range: ${face.unicodeRange};`);
            emittedCss.push(`}`);
            emittedCss.push('');
        }
    }

    const cssText = emittedCss.join('\n');
    if (!dry) {
        fs.writeFileSync(CSS_OUT, cssText, 'utf8');
        console.log(`\n✓ wrote ${path.relative(REPO_ROOT, CSS_OUT)}`);
        console.log(`  downloaded: ${downloads}, unchanged: ${skipped}`);
    } else {
        console.log(`\n(dry-run) would write ${path.relative(REPO_ROOT, CSS_OUT)}`);
    }
}

run().catch(e => { console.error(e); process.exit(1); });
