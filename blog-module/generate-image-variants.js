#!/usr/bin/env node
// generate-image-variants.js
// Backfills variants used by article heroes, archive cards and the homepage.
// Safe to re-run: skips files that already exist.
//
// Usage:
//   node blog-module/generate-image-variants.js            # dry run preview
//   node blog-module/generate-image-variants.js --run      # actually generate
//   node blog-module/generate-image-variants.js --run --force  # regenerate even if exists

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const sharp = require('sharp');

const DRY_RUN = !process.argv.includes('--run');
const FORCE   = process.argv.includes('--force');
const CARDS_ONLY = process.argv.includes('--cards-only');
const BLOG_DIR = path.join(__dirname, 'blog-entries');
const SM_MAX_WIDTH = 800;
const FULL_MAX_WIDTH = 1600;
const CARD_MAX_WIDTH = 400;
const MOBILE_HERO_MAX_WIDTH = 800;
// Gallery thumbnails are a 76×52 CSS box with object-fit: cover, so cover 3× of it.
const THUMB_BOX = { width: 228, height: 156 };

// ─── Worker thread ────────────────────────────────────────────────────────────
if (!isMainThread) {
    (async () => {
        const { tasks } = workerData;
        const results = [];
        for (const { src, dest, format, maxWidth, box, quality } of tasks) {
            try {
                let p = sharp(src);
                if (maxWidth) p = p.resize(maxWidth, null, { withoutEnlargement: true });
                if (box) p = p.resize(box.width, box.height, { fit: 'outside', withoutEnlargement: true });
                await p[format]({ quality }).toFile(dest);
                results.push({ dest, ok: true });
            } catch (e) {
                results.push({ dest, ok: false, err: e.message });
            }
        }
        parentPort.postMessage(results);
    })();
    return;
}

// ─── Main thread ──────────────────────────────────────────────────────────────
const { utils } = require('./build/shared');

async function collectImageVariantTasks({ blogDir = BLOG_DIR, cardsOnly = CARDS_ONLY, force = FORCE } = {}) {
    // The builder writes this cache before generating variants. Use its current
    // image selections, rather than the previous build's homepage/index files.
    const cachePath = path.join(path.dirname(blogDir), 'blog-source-cache.json');
    const posts = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, 'utf8')).posts : [];
    const postsById = new Map(posts.map(post => [post.id, post]));
    const homepageIds = new Set(posts.slice(0, 4).map(post => post.id));
    const imageBase = value => /^([12])\.webp$/i.exec(path.basename(String(value || '').split('?')[0]))?.[1];
    const entries = fs.readdirSync(blogDir).filter(name => {
        const full = path.join(blogDir, name);
        return fs.statSync(full).isDirectory();
    });

    // Collect all conversion tasks
    const allTasks = [];

    for (const folder of entries) {
        const entryPath = path.join(blogDir, folder);
        const files = fs.readdirSync(entryPath);

        // Find numbered content images: 3.webp, 4.webp, ... (not 1/2 = hero/bg)
        const contentWebps = files.filter(f => /^\d+\.webp$/i.test(f) && parseInt(f) >= 3);

        for (const webpFile of contentWebps) {
            if (cardsOnly) continue;
            const num  = path.parse(webpFile).name;        // "3"
            const src  = path.join(entryPath, webpFile);
            const sourceWidth = (await sharp(src).metadata()).width || 0;

            const variants = [
                // Full-size AVIF
                { dest: path.join(entryPath, `${num}.avif`), format: 'avif', quality: 60, maxWidth: FULL_MAX_WIDTH }
            ];
            if (sourceWidth > SM_MAX_WIDTH) {
                variants.push(
                    { dest: path.join(entryPath, `${num}-sm.webp`), format: 'webp', quality: 80, maxWidth: SM_MAX_WIDTH },
                    { dest: path.join(entryPath, `${num}-sm.avif`), format: 'avif', quality: 60, maxWidth: SM_MAX_WIDTH }
                );
            }

            for (const v of variants) {
                if (!force && fs.existsSync(v.dest)) continue;   // already done
                allTasks.push({ src, ...v });
            }
        }

        // Gallery thumbnails, for every image a built gallery shows (also with --cards-only,
        // which the blog build uses).
        const articlePath = path.join(entryPath, 'article.html');
        const html = fs.existsSync(articlePath) ? fs.readFileSync(articlePath, 'utf8') : '';
        if (html) {
            const nums = new Set([...html.matchAll(/class="gallery-thumb[^"]*"[^>]*>\s*<img src="(\d+)(?:-sm|-thumb)?\.webp"/g)].map(m => m[1]));
            for (const num of nums) {
                const src = path.join(entryPath, `${num}.webp`);
                const dest = path.join(entryPath, `${num}-thumb.webp`);
                if (fs.existsSync(src) && (force || !fs.existsSync(dest))) {
                    allTasks.push({ src, dest, format: 'webp', quality: 80, box: THUMB_BOX });
                }
            }
        }

        // Source-less articles keep their existing media: backfill only variants
        // they already reference. Source-backed heroes can be rendered again,
        // so prepare their responsive picture even on a first publication.
        const needed = new Set([...html.matchAll(/\b([12](?:-mobile|-card)?\.(?:avif|webp))\b/g)].map(match => match[1]));
        const post = postsById.get(folder);
        const cardBase = imageBase(post?.image) || '1';
        // 1-card.webp is also the compact archive's default thumbnail.
        for (const base of new Set(['1', cardBase])) {
            needed.add(`${base}-card.webp`);
            needed.add(`${base}-mobile.webp`);
        }
        if (utils.findSourceDocument(files)) {
            const heroBase = imageBase(post?.backgroundImage || post?.image) || (files.includes('2.webp') ? '2' : '1');
            needed.add(`${heroBase}.avif`);
            needed.add(`${heroBase}-mobile.avif`);
            needed.add(`${heroBase}-mobile.webp`);
        }
        if (homepageIds.has(folder)) {
            const homepageBase = imageBase(post.image || post.backgroundImage);
            if (homepageBase) needed.add(`${homepageBase}.avif`);
        }

        // Hero/bg images (1.webp, 2.webp), only for an actual consumer.
        const heroWebps = files.filter(f => /^[12]\.webp$/i.test(f));
        for (const webpFile of heroWebps) {
            const num = path.parse(webpFile).name;
            const src = path.join(entryPath, webpFile);
            const variants = [
                { dest: path.join(entryPath, `${num}.avif`), format: 'avif', quality: 60, maxWidth: FULL_MAX_WIDTH },
                { dest: path.join(entryPath, `${num}-mobile.webp`), format: 'webp', quality: 60, maxWidth: MOBILE_HERO_MAX_WIDTH },
                { dest: path.join(entryPath, `${num}-mobile.avif`), format: 'avif', quality: 60, maxWidth: MOBILE_HERO_MAX_WIDTH },
                { dest: path.join(entryPath, `${num}-card.webp`), format: 'webp', quality: 60, maxWidth: CARD_MAX_WIDTH }
            ];
            for (const v of variants) {
                if (!needed.has(path.basename(v.dest))) continue;
                if (!force && fs.existsSync(v.dest)) continue;
                allTasks.push({ src, ...v });
            }
        }
    }

    return { tasks: allTasks, entryCount: entries.length };
}

async function main() {
    const { tasks: allTasks, entryCount } = await collectImageVariantTasks();
    if (DRY_RUN) {
        console.log(`[dry-run] Would generate ${allTasks.length} image variants across ${entryCount} entries.`);
        console.log('Run with --run to execute, --run --force to regenerate all.');
        const byFormat = {};
        for (const t of allTasks) { byFormat[t.format] = (byFormat[t.format] || 0) + 1; }
        console.log('Breakdown:', byFormat);
        return;
    }

    if (allTasks.length === 0) {
        console.log('All variants already exist. Use --force to regenerate.');
        return;
    }

    console.log(`Generating ${allTasks.length} variants using ${os.cpus().length} workers...`);

    // Split tasks across workers
    const numWorkers = Math.min(os.cpus().length, allTasks.length);
    const chunkSize  = Math.ceil(allTasks.length / numWorkers);
    const chunks     = Array.from({ length: numWorkers }, (_, i) =>
        allTasks.slice(i * chunkSize, (i + 1) * chunkSize)
    ).filter(c => c.length > 0);

    let done = 0, errors = 0;
    const start = Date.now();

    await Promise.all(chunks.map(tasks => new Promise((resolve) => {
        const worker = new Worker(__filename, { workerData: { tasks } });
        worker.on('message', (results) => {
            for (const r of results) {
                if (r.ok) { done++; } else { errors++; console.error(`  ERROR: ${r.dest} — ${r.err}`); }
            }
            const elapsed = ((Date.now() - start) / 1000).toFixed(1);
            process.stdout.write(`\r  ${done + errors}/${allTasks.length} (${elapsed}s)   `);
            resolve();
        });
        worker.on('error', (e) => { console.error(e); resolve(); });
    })));

    console.log(`\nDone. ${done} generated, ${errors} errors in ${((Date.now() - start) / 1000).toFixed(1)}s`);
}

if (require.main === module) {
    main().catch(e => { console.error(e); process.exit(1); });
}

module.exports = { collectImageVariantTasks };
