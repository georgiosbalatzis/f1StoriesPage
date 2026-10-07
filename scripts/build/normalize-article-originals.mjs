#!/usr/bin/env node
// normalize-article-originals.mjs - apply the author tools' article image
// policy (ARTICLE_IMAGE_POLICY in scripts/author/image-tools.js) to article
// originals that are already in the repository, with sharp (Lanczos resize).
//
// Only originals (blog-module/blog-entries/<entry>/<n>.webp) are touched; the
// AVIF / -sm / -mobile / -card / -thumb variants already made from them stay
// as they are, so readers' responsive images do not change.
//
//   node scripts/build/normalize-article-originals.mjs            # dry run: originals over the byte cap
//   node scripts/build/normalize-article-originals.mjs --write    # rewrite them
//   node scripts/build/normalize-article-originals.mjs --all      # also every original wider than maxWidth
//   node scripts/build/normalize-article-originals.mjs <path>...  # only these files

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const IMAGE_TOOLS = path.join(REPO_ROOT, 'scripts', 'author', 'image-tools.js');
const ORIGINAL_RE = /^blog-module\/blog-entries\/[^/]+\/\d+\.webp$/;

export function loadImagePolicy() {
    const context = { window: {} };
    vm.runInNewContext(fs.readFileSync(IMAGE_TOOLS, 'utf8'), context, { filename: IMAGE_TOOLS });
    const tools = context.window.F1S_AUTHOR_IMAGE_TOOLS;
    return { policy: tools.ARTICLE_IMAGE_POLICY, planArticleImage: tools.planArticleImage };
}

function trackedOriginals() {
    return execFileSync('git', ['ls-files', '-z', '--', 'blog-module/blog-entries'], { cwd: REPO_ROOT, encoding: 'utf8' })
        .split('\0')
        .filter(relPath => ORIGINAL_RE.test(relPath));
}

async function encode(input, plan, policy) {
    let best = null;
    for (const quality of policy.qualities) {
        const buffer = await sharp(input)
            .rotate()
            .resize({ width: plan.width, withoutEnlargement: true, kernel: 'lanczos3' })
            .webp({ quality: Math.round(quality * 100), effort: 6 })
            .toBuffer();
        if (!best || buffer.length < best.buffer.length) best = { buffer, quality };
        if (buffer.length <= policy.maxBytes) break;
    }
    if (!best || best.buffer.length > policy.maxBytes) {
        throw new Error('Original could not fit the image budget; use the browser author tools to reduce dimensions.');
    }
    return best;
}

async function main() {
    const args = process.argv.slice(2);
    const write = args.includes('--write');
    const all = args.includes('--all');
    const explicit = args.filter(arg => !arg.startsWith('--'));
    const { policy, planArticleImage } = loadImagePolicy();

    const candidates = explicit.length ? explicit : trackedOriginals();
    const rows = [];
    for (const relPath of candidates) {
        const abs = path.join(REPO_ROOT, relPath);
        if (!ORIGINAL_RE.test(relPath) || !fs.existsSync(abs)) {
            console.error(`skip ${relPath}: not an article original`);
            continue;
        }
        const bytes = fs.statSync(abs).size;
        const meta = await sharp(abs).metadata();
        const plan = planArticleImage({ webp: meta.format === 'webp', width: meta.width, height: meta.height, bytes });
        if (plan.keep) continue;
        if (!explicit.length && !all && bytes <= policy.maxBytes) continue;

        const input = fs.readFileSync(abs);
        const out = await encode(input, plan, policy);
        const outMeta = await sharp(out.buffer).metadata();
        rows.push({ relPath, from: `${meta.width}×${meta.height} ${(bytes / 1024).toFixed(0)} KB`, to: `${outMeta.width}×${outMeta.height} ${(out.buffer.length / 1024).toFixed(0)} KB q${Math.round(out.quality * 100)}`, saved: bytes - out.buffer.length });
        if (write && out.buffer.length < bytes) fs.writeFileSync(abs, out.buffer);
    }

    if (rows.length) console.table(rows.map(({ saved, ...row }) => row));
    const saved = rows.reduce((sum, row) => sum + Math.max(0, row.saved), 0);
    console.log(`${write ? 'rewrote' : 'would rewrite'} ${rows.length} original(s), ${(saved / 1024 / 1024).toFixed(2)} MB smaller`
        + ` (policy: ≤ ${policy.maxWidth} px wide, ≤ ${(policy.maxBytes / 1024).toFixed(0)} KB)`);
    if (write && rows.length) console.log('Rebuild the affected articles (npm run build:blog) so width/height and srcset follow the new size.');
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
