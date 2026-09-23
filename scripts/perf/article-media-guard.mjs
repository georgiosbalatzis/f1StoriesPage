#!/usr/bin/env node
// article-media-guard.mjs - track repository-side article media growth.
//
// This complements public-image-guard.mjs. The public guard protects dist/
// payload size for readers. This guard protects the git repository from
// silently accumulating raw or oversized article media.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const BUDGET_PATH = path.join(REPO_ROOT, 'perf', 'article-media-budget.json');
const ARTICLE_ROOT = 'blog-module/blog-entries';
const DEFAULT_THRESHOLD_PERCENT = 5;
const DEFAULT_LIMITS = {
    singleRawImageBytes: 3.25 * 1024 * 1024,
    singleOptimizedImageBytes: 1 * 1024 * 1024
};

const MEDIA_RE = /\.(?:avif|webp|png|jpe?g|gif)$/i;
const RAW_RE = /\.(?:png|jpe?g|gif)$/i;
const OPTIMIZED_RE = /\.(?:avif|webp)$/i;

function parseArgs(argv) {
    const args = { update: false, threshold: DEFAULT_THRESHOLD_PERCENT };
    for (let i = 2; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--update') args.update = true;
        else if (arg === '--threshold') args.threshold = Number(argv[++i]) || DEFAULT_THRESHOLD_PERCENT;
    }
    return args;
}

function toPosix(relPath) {
    return relPath.split(path.sep).join('/');
}

function fmtBytes(bytes) {
    if (bytes == null) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function trackedArticleFiles() {
    const output = execFileSync('git', ['ls-files', '-z', '--', ARTICLE_ROOT], {
        cwd: REPO_ROOT,
        encoding: 'buffer'
    });
    return output
        .toString('utf8')
        .split('\0')
        .filter(Boolean)
        .map(toPosix);
}

function classify(relPath) {
    const fileName = path.posix.basename(relPath);
    if (/-card\.webp$/i.test(fileName)) return 'card';
    if (/-sm\.(?:avif|webp)$/i.test(fileName)) return 'small';
    if (RAW_RE.test(relPath)) return 'raw';
    return 'optimized';
}

function readRows() {
    return trackedArticleFiles()
        .filter(relPath => MEDIA_RE.test(relPath))
        .filter(relPath => fs.existsSync(path.join(REPO_ROOT, relPath)))
        .map(relPath => {
            const absPath = path.join(REPO_ROOT, relPath);
            const size = fs.statSync(absPath).size;
            return {
                relPath,
                size,
                ext: path.extname(relPath).toLowerCase(),
                kind: classify(relPath),
                raw: RAW_RE.test(relPath),
                optimized: OPTIMIZED_RE.test(relPath)
            };
        })
        .sort((a, b) => a.relPath.localeCompare(b.relPath));
}

function sum(rows) {
    return rows.reduce((total, row) => total + row.size, 0);
}

function maxSize(rows) {
    return rows.reduce((max, row) => Math.max(max, row.size), 0);
}

function countByExt(rows) {
    const result = {};
    rows.forEach(row => {
        if (!result[row.ext]) result[row.ext] = { count: 0, bytes: 0 };
        result[row.ext].count += 1;
        result[row.ext].bytes += row.size;
    });
    return result;
}

function buildInventory(rows) {
    const raw = rows.filter(row => row.raw);
    const optimized = rows.filter(row => row.optimized);
    const card = rows.filter(row => row.kind === 'card');
    const small = rows.filter(row => row.kind === 'small');

    return {
        totalFiles: rows.length,
        totalBytes: sum(rows),
        rawFiles: raw.length,
        rawBytes: sum(raw),
        optimizedFiles: optimized.length,
        optimizedBytes: sum(optimized),
        cardFiles: card.length,
        cardBytes: sum(card),
        smallFiles: small.length,
        smallBytes: sum(small),
        largestRawBytes: maxSize(raw),
        largestOptimizedBytes: maxSize(optimized),
        byExtension: countByExt(rows)
    };
}

function loadBudget() {
    if (!fs.existsSync(BUDGET_PATH)) return null;
    return JSON.parse(fs.readFileSync(BUDGET_PATH, 'utf8'));
}

function writeBudget(budget) {
    fs.mkdirSync(path.dirname(BUDGET_PATH), { recursive: true });
    fs.writeFileSync(BUDGET_PATH, JSON.stringify(budget, null, 2) + '\n', 'utf8');
}

function printInventory(inventory) {
    console.log('Article media inventory:');
    console.log(`  tracked media files: ${inventory.totalFiles}`);
    console.log(`  tracked media bytes: ${fmtBytes(inventory.totalBytes)}`);
    console.log(`  optimized images:    ${inventory.optimizedFiles} (${fmtBytes(inventory.optimizedBytes)})`);
    console.log(`  raw source images:   ${inventory.rawFiles} (${fmtBytes(inventory.rawBytes)})`);
    console.log(`  card variants:       ${inventory.cardFiles} (${fmtBytes(inventory.cardBytes)})`);
    console.log(`  small variants:      ${inventory.smallFiles} (${fmtBytes(inventory.smallBytes)})`);
}

function printLargest(title, rows, limit = 12) {
    if (!rows.length) return;
    console.log(title);
    rows
        .slice()
        .sort((a, b) => b.size - a.size || a.relPath.localeCompare(b.relPath))
        .slice(0, limit)
        .forEach(row => {
            console.log(`  ${fmtBytes(row.size).padStart(9)}  ${row.relPath}`);
        });
}

function allowedWithGrowth(base, thresholdPercent) {
    return Math.ceil(base * (1 + thresholdPercent / 100));
}

function checkGrowthMetric(name, current, base, thresholdPercent, errors) {
    const allowed = allowedWithGrowth(base, thresholdPercent);
    if (current > allowed) {
        errors.push(`${name}: ${current} exceeds budget ${allowed} (baseline ${base}, threshold +${thresholdPercent}%)`);
    }
}

function checkByteGrowthMetric(name, current, base, thresholdPercent, errors) {
    const allowed = allowedWithGrowth(base, thresholdPercent);
    if (current > allowed) {
        errors.push(`${name}: ${fmtBytes(current)} exceeds budget ${fmtBytes(allowed)} (baseline ${fmtBytes(base)}, threshold +${thresholdPercent}%)`);
    }
}

function checkBudget(rows, inventory, budget) {
    const errors = [];
    const threshold = Number(budget.thresholdPercent ?? DEFAULT_THRESHOLD_PERCENT);
    const baseline = budget.metrics || {};
    const limits = Object.assign({}, DEFAULT_LIMITS, budget.limits || {});
    const rawPaths = new Set(budget.rawPaths || []);

    checkGrowthMetric('totalFiles', inventory.totalFiles, baseline.totalFiles || 0, threshold, errors);
    checkByteGrowthMetric('totalBytes', inventory.totalBytes, baseline.totalBytes || 0, threshold, errors);
    checkGrowthMetric('optimizedFiles', inventory.optimizedFiles, baseline.optimizedFiles || 0, threshold, errors);
    checkByteGrowthMetric('optimizedBytes', inventory.optimizedBytes, baseline.optimizedBytes || 0, threshold, errors);

    if (inventory.rawFiles > (baseline.rawFiles || 0)) {
        errors.push(`rawFiles: ${inventory.rawFiles} exceeds baseline ${baseline.rawFiles || 0}; new raw article images must be reviewed explicitly`);
    }
    if (inventory.rawBytes > (baseline.rawBytes || 0)) {
        errors.push(`rawBytes: ${fmtBytes(inventory.rawBytes)} exceeds baseline ${fmtBytes(baseline.rawBytes || 0)}; raw source media should not grow silently`);
    }

    rows.filter(row => row.raw && !rawPaths.has(row.relPath)).forEach(row => {
        errors.push(`${row.relPath}: new raw article image is not in the reviewed raw media baseline`);
    });

    rows.filter(row => row.raw && row.size > limits.singleRawImageBytes).forEach(row => {
        errors.push(`${row.relPath}: raw image ${fmtBytes(row.size)} exceeds single-file limit ${fmtBytes(limits.singleRawImageBytes)}`);
    });

    rows.filter(row => row.optimized && row.size > limits.singleOptimizedImageBytes).forEach(row => {
        errors.push(`${row.relPath}: optimized image ${fmtBytes(row.size)} exceeds single-file limit ${fmtBytes(limits.singleOptimizedImageBytes)}`);
    });

    return errors;
}

function main() {
    const args = parseArgs(process.argv);
    const rows = readRows();
    const inventory = buildInventory(rows);
    const rawRows = rows.filter(row => row.raw);
    const optimizedRows = rows.filter(row => row.optimized);

    if (args.update) {
        writeBudget({
            updatedAt: new Date().toISOString(),
            thresholdPercent: args.threshold,
            note: 'Repository-side article media budget. Public delivery size is checked separately by scripts/perf/public-image-guard.mjs. New raw article images should not appear unless this baseline is intentionally updated in review.',
            limits: DEFAULT_LIMITS,
            metrics: inventory,
            rawPaths: rawRows.map(row => row.relPath).sort()
        });
        console.log(`article media budget updated: ${BUDGET_PATH}`);
        printInventory(inventory);
        return;
    }

    const budget = loadBudget();
    if (!budget) {
        console.error(`Missing ${BUDGET_PATH}. Run: node scripts/perf/article-media-guard.mjs --update`);
        process.exit(2);
    }

    printInventory(inventory);
    printLargest('Largest raw article images:', rawRows);
    printLargest('Largest optimized article images:', optimizedRows);

    const errors = checkBudget(rows, inventory, budget);
    if (errors.length) {
        console.error('article media budget failed:');
        errors.slice(0, 80).forEach(error => console.error(`  - ${error}`));
        if (errors.length > 80) console.error(`  ... ${errors.length - 80} more`);
        process.exit(1);
    }

    console.log('article media budget passed.');
}

main();
