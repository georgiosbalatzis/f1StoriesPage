#!/usr/bin/env node
// generate-image-variants.js
// Backfills AVIF and small (800px) srcset variants for all existing blog-entry images.
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
const BLOG_DIR = path.join(__dirname, 'blog-entries');
const SM_MAX_WIDTH = 800;
const FULL_MAX_WIDTH = 1600;

// ─── Worker thread ────────────────────────────────────────────────────────────
if (!isMainThread) {
    (async () => {
        const { tasks } = workerData;
        const results = [];
        for (const { src, dest, format, maxWidth, quality } of tasks) {
            try {
                let p = sharp(src);
                if (maxWidth) p = p.resize(maxWidth, null, { withoutEnlargement: true });
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
async function main() {
    const entries = fs.readdirSync(BLOG_DIR).filter(name => {
        const full = path.join(BLOG_DIR, name);
        return fs.statSync(full).isDirectory();
    });

    // Collect all conversion tasks
    const allTasks = [];

    for (const folder of entries) {
        const entryPath = path.join(BLOG_DIR, folder);
        const files = fs.readdirSync(entryPath);

        // Find numbered content images: 3.webp, 4.webp, ... (not 1/2 = hero/bg)
        const contentWebps = files.filter(f => /^\d+\.webp$/i.test(f) && parseInt(f) >= 3);

        for (const webpFile of contentWebps) {
            const num  = path.parse(webpFile).name;        // "3"
            const src  = path.join(entryPath, webpFile);

            const variants = [
                // Full-size AVIF
                { dest: path.join(entryPath, `${num}.avif`),    format: 'avif', quality: 60, maxWidth: FULL_MAX_WIDTH },
                // Small WebP
                { dest: path.join(entryPath, `${num}-sm.webp`), format: 'webp', quality: 80, maxWidth: SM_MAX_WIDTH },
                // Small AVIF
                { dest: path.join(entryPath, `${num}-sm.avif`), format: 'avif', quality: 60, maxWidth: SM_MAX_WIDTH },
            ];

            for (const v of variants) {
                if (!FORCE && fs.existsSync(v.dest)) continue;   // already done
                allTasks.push({ src, ...v });
            }
        }

        // Hero/bg images (1.webp, 2.webp) — AVIF only, no sm needed
        const heroWebps = files.filter(f => /^[12]\.webp$/i.test(f));
        for (const webpFile of heroWebps) {
            const num = path.parse(webpFile).name;
            const dest = path.join(entryPath, `${num}.avif`);
            if (!FORCE && fs.existsSync(dest)) continue;
            allTasks.push({ src: path.join(entryPath, webpFile), dest, format: 'avif', quality: 60, maxWidth: FULL_MAX_WIDTH });
        }
    }

    if (DRY_RUN) {
        console.log(`[dry-run] Would generate ${allTasks.length} image variants across ${entries.length} entries.`);
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

main().catch(e => { console.error(e); process.exit(1); });
