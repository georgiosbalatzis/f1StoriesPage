#!/usr/bin/env node
// media-qa.mjs - static regression gate for editorial images in the generated pages (no browser needed).
//
// Reads every article page, the homepage, the Edition Index and its static section/month pages, and checks:
//   1. Every local image a page names (src, srcset, preload) exists.
//   2. srcset width descriptors are true: "x.webp 800w" means x.webp is 800px wide.
//   3. width/height attributes keep the file's own proportions (no reserved box of the wrong shape).
//   4. The article cover is the LCP candidate: eager, fetchpriority=high, never lazy, and its preload names a file
//      the <picture> really offers.
//   5. Media contract (blog-module/media-metadata.json): every disclosed synthetic image carries its visible label,
//      graphic covers are marked for containment, documented captions/credits render, and no page prints a credit
//      or label the register does not hold.
//   6. Technical charts sit in a keyboard-focusable, labelled horizontal scroller.
//   7. Generic figure captions are numbered from 1 in reading order.
//
//   npm run qa:media            (checks dist; --root=. checks generated source pages)
//   flags: --root=<dir>  --no-fail  --json=<file>

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { assertPreservedPublicMedia } from '../build/public-media-integrity.mjs';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = new Map(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=')));
const ROOT = path.resolve(REPO_ROOT, args.get('root') || 'dist');
const ENTRIES = path.join(ROOT, 'blog-module/blog-entries');
const media = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'blog-module/media-metadata.json'), 'utf8'));

try {
    for (const rel of ['index.html', 'blog-module/blog/index.html', 'blog-module/blog-index-data.json', 'blog-module/blog-entries']) {
        if (!fs.existsSync(path.join(ROOT, rel))) throw new Error(`missing ${rel}`);
    }
    const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'blog-module/blog-index-data.json'), 'utf8'));
    const posts = index.p || index.posts;
    if (!Array.isArray(posts) || !posts.length) throw new Error('empty article index');
    for (const post of posts) {
        const id = Array.isArray(post) ? post[0] : post.id;
        if (!id || !fs.existsSync(path.join(ENTRIES, id, 'article.html'))) throw new Error(`missing article page ${id}`);
    }
    assertPreservedPublicMedia(ROOT);
} catch (error) {
    console.error(`Media QA needs complete built output at ${ROOT}: ${error.message} Run npm run build:public first (or --root=. after generating source pages).`);
    process.exit(1);
}

const results = [];
const check = (group, name, ok, detail = '') => {
    results.push({ group, name, ok: !!ok, detail: String(detail) });
};

const dimsCache = new Map();
async function dims(file) {
    if (!dimsCache.has(file)) {
        dimsCache.set(file, fs.existsSync(file) ? sharp(file).metadata().then(m => ({ width: m.width, height: m.height })).catch(() => null) : Promise.resolve(null));
    }
    return dimsCache.get(file);
}

function walk(dir, out = []) {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(abs, out);
        else if (entry.name === 'index.html') out.push(abs);
    }
    return out;
}

const pages = [
    ...fs.readdirSync(ENTRIES).map(id => path.join(ENTRIES, id, 'article.html')).filter(file => fs.existsSync(file)),
    path.join(ROOT, 'index.html'),
    path.join(ROOT, 'blog-module/blog/index.html'),
    ...walk(path.join(ROOT, 'blog-module/blog/section')),
    ...walk(path.join(ROOT, 'blog-module/blog/archive'))
].filter(file => fs.existsSync(file));

const attr = (tag, name) => {
    const m = new RegExp(`\\s${name}="([^"]*)"`, 'i').exec(tag);
    return m ? m[1].replace(/&amp;/g, '&') : null;
};
const localFile = (page, url) => {
    if (!url || /^(?:https?:|data:|\/\/)/i.test(url)) return null;
    const clean = decodeURIComponent(url.split(/[?#]/)[0]);
    return clean.startsWith('/') ? path.join(ROOT, clean) : path.join(path.dirname(page), clean);
};
const candidates = value => String(value || '').split(',').map(part => part.trim()).filter(Boolean)
    .map(part => { const [url, descriptor = ''] = part.split(/\s+/); return { url, descriptor }; });

const stats = { pages: 0, images: 0, candidates: 0, falseDescriptors: 0, pagesWithFalseDescriptors: new Set(), missing: 0, ratioOff: 0 };
const rel = file => path.relative(ROOT, file);

for (const page of pages) {
    const html = fs.readFileSync(page, 'utf8');
    const name = rel(page);
    stats.pages += 1;
    const tags = html.match(/<(?:img|source)\b[^>]*>|<link\b[^>]*rel="preload"[^>]*as="image"[^>]*>/gi) || [];
    for (const tag of tags) {
        const isImg = /^<img/i.test(tag);
        const src = attr(tag, 'src') || attr(tag, 'href');
        const srcset = attr(tag, 'srcset') || attr(tag, 'imagesrcset');
        if (isImg) stats.images += 1;
        const named = [src, attr(tag, 'data-full-src'), ...candidates(srcset).map(c => c.url)].filter(Boolean);
        for (const url of named) {
            const file = localFile(page, url);
            if (!file) continue;
            if (!fs.existsSync(file)) { stats.missing += 1; check('references', `${name}: ${url}`, false, 'file does not exist'); }
        }
        for (const { url, descriptor } of candidates(srcset)) {
            if (!/^\d+w$/.test(descriptor)) continue;
            const file = localFile(page, url);
            if (!file) continue;
            stats.candidates += 1;
            const d = await dims(file);
            if (d && d.width !== parseInt(descriptor, 10)) {
                stats.falseDescriptors += 1;
                stats.pagesWithFalseDescriptors.add(name);
                check('srcset', `${name}: ${url} ${descriptor}`, false, `file is ${d.width}px wide`);
            }
        }
        if (isImg && src) {
            const file = localFile(page, src);
            const w = Number(attr(tag, 'width'));
            const h = Number(attr(tag, 'height'));
            const d = file && await dims(file);
            if (d && w && h && Math.abs(w / h - d.width / d.height) > 0.02 * (d.width / d.height)) {
                stats.ratioOff += 1;
                check('dimensions', `${name}: ${src}`, false, `attrs ${w}×${h}, file ${d.width}×${d.height}`);
            }
        }
    }

    if (!/\/article\.html$/.test(page)) continue;
    const id = path.basename(path.dirname(page));
    const cover = /<figure class="rr-cover__media"[^>]*>[\s\S]*?<\/figure>/.exec(html);
    if (cover) {
        const img = /<img\b[^>]*>/.exec(cover[0])[0];
        check('lcp', `${id}: cover eager + high priority`, attr(img, 'loading') === 'eager' && attr(img, 'fetchpriority') === 'high');
        const preload = /<link rel="preload" as="image"[^>]*>/.exec(html);
        const offered = new Set([attr(img, 'src'), ...candidates(attr(img, 'srcset')).map(c => c.url),
            ...[...cover[0].matchAll(/<source\b[^>]*>/g)].flatMap(s => candidates(attr(s[0], 'srcset')).map(c => c.url))]);
        const preloaded = preload ? [attr(preload[0], 'href'), ...candidates(attr(preload[0], 'imagesrcset')).map(c => c.url)] : [];
        check('lcp', `${id}: preload matches the cover`, preload && preloaded.every(url => offered.has(url)), preloaded.join(' '));
    }
    const body = (/<div class="rr-body article-content" data-body>([\s\S]*?)<section class="rr-pitwall"/.exec(html) || [])[1] || '';
    // Charts: scroller present, focusable and labelled.
    const charts = [...body.matchAll(/<div class="rr-chart">[\s\S]*?<\/figure>\s*<\/div>/g)];
    charts.forEach((chart, i) => {
        const scroller = /<div class="rr-chart__scroll"[^>]*>/.exec(chart[0]);
        check('charts', `${id}: chart ${i + 1} scroller`, scroller && /tabindex="0"/.test(scroller[0]) && /role="region"/.test(scroller[0]) && /aria-label="[^"]+"/.test(scroller[0]));
    });
    // No enlargement: every figure image is capped at its own pixel width (--nat-w = its width attribute).
    for (const fig of body.matchAll(/<figure class="article-figure">[\s\S]*?<\/figure>/g)) {
        const img = (/<img\b[^>]*\bclass="article-content-img"[^>]*>/.exec(fig[0]) || [])[0];
        if (img) check('no-upscale', `${id}: ${attr(img, 'src')} capped at its width`, attr(img, 'style') === `--nat-w: ${attr(img, 'width')}px`, attr(img, 'style'));
    }
    // Generic captions count from 1.
    const generic = [...body.matchAll(/<figcaption>Εικ\. (\d+)/g)].map(m => Number(m[1]));
    if (generic.length) check('captions', `${id}: figure numbers 1..n`, generic.every((n, i) => n === i + 1), generic.join(','));
    // Media contract.
    const coverSrc = cover ? attr(/<img\b[^>]*>/.exec(cover[0])[0], 'src') : '';
    const coverSlot = /(?:^|\/)(\d+)(?:-mobile)?\.(?:webp|avif)/.exec(coverSrc || '')?.[1];
    const coverKey = coverSlot ? `${id}/${coverSlot}` : null;
    const coverMeta = coverKey ? media.images[coverKey] : null;
    const disclosed = /class="media-credit__ai"/.test(html);
    const synthetic = Object.entries(media.images || {}).some(([key, m]) => key.startsWith(`${id}/`) && m.synthetic === 'confirmed');
    check('synthetic', `${id}: AI disclosure only where the register confirms it`, disclosed === synthetic);
    if (coverMeta?.synthetic === 'confirmed') {
        check('synthetic', `${id}: approved visible cover disclosure`, cover[0].includes('Εικονογράφηση δημιουργημένη με AI'));
        const avif = path.join(ENTRIES, id, `${coverSlot}.avif`);
        const metadata = fs.existsSync(avif) ? await sharp(avif).metadata() : null;
        check('provenance', `${id}: published AVIF retains its verified AI marker`, metadata?.xmp?.toString().includes('trainedAlgorithmicMedia') && metadata.xmp.toString().includes('Made with Google AI'));
    }
    if (coverMeta && coverMeta.type && coverMeta.type !== 'photo') {
        check('graphic', `${id}: cover marked ${coverMeta.type}`, new RegExp(`<figure class="rr-cover__media"[^>]*data-media="${coverMeta.type}"`).test(html));
    }
    if (coverMeta && coverMeta.credit) check('credit', `${id}: cover credit rendered`, html.includes(coverMeta.credit.replace(/&/g, '&amp;')));
}

// Every register entry must point at a real file and use the documented vocabulary.
const TYPES = new Set(['photo', 'archival', 'poster', 'graphic', 'diagram', 'chart', 'illustration', 'render']);
for (const [key, m] of Object.entries(media.images || {})) {
    const [id, slot] = key.split('/');
    // The register describes authoritative originals; unreferenced originals need not ship.
    check('register', `${key}: authoritative file exists`, fs.existsSync(path.join(REPO_ROOT, 'blog-module/blog-entries', id, `${slot}.webp`)));
    if (m.type) check('register', `${key}: type`, TYPES.has(m.type), m.type);
}

const failed = results.filter(r => !r.ok);
const groups = {};
for (const r of results) {
    groups[r.group] = groups[r.group] || { pass: 0, fail: 0 };
    groups[r.group][r.ok ? 'pass' : 'fail'] += 1;
}
const summary = {
    pages: stats.pages, images: stats.images, srcsetCandidates: stats.candidates, falseDescriptors: stats.falseDescriptors,
    pagesWithFalseDescriptors: stats.pagesWithFalseDescriptors.size, missingFiles: stats.missing, ratioMismatches: stats.ratioOff, groups
};
console.log(JSON.stringify(summary, null, 2));
failed.slice(0, Number(args.get('show') || 40)).forEach(r => console.error(`FAIL [${r.group}] ${r.name} ${r.detail}`));
if (failed.length > 40) console.error(`... ${failed.length - 40} more failures`);
if (args.get('json')) fs.writeFileSync(args.get('json'), JSON.stringify({ summary, failed }, null, 2));
if (failed.length && !args.has('no-fail')) process.exit(1);
