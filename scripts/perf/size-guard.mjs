#!/usr/bin/env node
// size-guard.mjs — compare tracked file sizes against perf/size-budget.json.
//
// Usage:
//   node scripts/perf/size-guard.mjs              # check; exit 1 if any file >10% over budget
//   node scripts/perf/size-guard.mjs --update     # rewrite the budget with current sizes
//   node scripts/perf/size-guard.mjs --threshold 15   # custom tolerance %
//
// Designed for the pre-commit hook and the CI perf gate. No deps.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const BUDGET_PATH = path.join(REPO_ROOT, 'perf', 'size-budget.json');

const SOURCE_FILES = [
    'styles.css',
    'home.css',
    'theme-overrides.css',
    'styles/shared-nav.css',
    'blog-module/blog-styles.css',
    'blog-module/blog/article-styles.css',
    'standings/standings.css',
    'standings/standings.js',
    'scripts/analytics.js',
    'scripts/f1-optimized.js',
    'scripts/shared-nav.js',
    'scripts/sw-register.js',
    'scripts/cookie-consent.js',
    'scripts/background-randomizer.js',
    'scripts/perf/web-vitals-beacon.js',
    'blog-module/blog-loader.js',
    'blog-module/blog-index.js',
    'blog-module/blog-processor.js',
    'sw.js',
    'manifest.json'
];

// After Phase 1, every CSS/JS with a .min.<ext> sibling is also tracked so
// a regression in the minification pipeline surfaces in the budget check.
function deriveMinSiblings(files) {
    return files
        .filter(f => /\.(css|js)$/.test(f) && f !== 'blog-module/blog-processor.js' && f !== 'sw.js')
        .map(f => f.replace(/\.(css|js)$/, '.min.$1'));
}

const TRACKED_GLOBS = [...SOURCE_FILES, ...deriveMinSiblings(SOURCE_FILES)];

function parseArgs(argv) {
    const args = { update: false, threshold: 10 };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--update') args.update = true;
        else if (a === '--threshold') args.threshold = Number(argv[++i]) || 10;
    }
    return args;
}

function fileSize(relPath) {
    const abs = path.join(REPO_ROOT, relPath);
    try { return fs.statSync(abs).size; }
    catch { return null; }
}

function fmtBytes(b) {
    if (b == null) return '—';
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

function loadBudget() {
    if (!fs.existsSync(BUDGET_PATH)) return null;
    return JSON.parse(fs.readFileSync(BUDGET_PATH, 'utf8'));
}

function writeBudget(budget) {
    fs.mkdirSync(path.dirname(BUDGET_PATH), { recursive: true });
    fs.writeFileSync(BUDGET_PATH, JSON.stringify(budget, null, 2) + '\n', 'utf8');
}

function main() {
    const args = parseArgs(process.argv);
    const current = {};
    for (const rel of TRACKED_GLOBS) {
        const size = fileSize(rel);
        if (size != null) current[rel] = size;
    }

    if (args.update) {
        const budget = {
            updatedAt: new Date().toISOString(),
            thresholdPercent: args.threshold,
            note: 'Byte budgets for tracked JS/CSS/HTML assets. Run `npm run perf:budget` to check, `npm run perf:budget:update` to rewrite this file with current sizes. Threshold is the max % growth allowed before the check fails.',
            files: current
        };
        writeBudget(budget);
        console.log(`✓ budget updated: ${Object.keys(current).length} files, ${BUDGET_PATH}`);
        return;
    }

    const budget = loadBudget();
    if (!budget) {
        console.error(`✗ ${BUDGET_PATH} missing. Run: node scripts/perf/size-guard.mjs --update`);
        process.exit(2);
    }

    const threshold = budget.thresholdPercent ?? args.threshold;
    const rows = [];
    let violations = 0;
    let newFiles = 0;

    for (const rel of TRACKED_GLOBS) {
        const curr = current[rel];
        const base = budget.files[rel];
        if (curr == null) {
            rows.push({ rel, base, curr: null, delta: null, pct: null, status: 'MISSING' });
            continue;
        }
        if (base == null) {
            rows.push({ rel, base: null, curr, delta: null, pct: null, status: 'NEW' });
            newFiles++;
            continue;
        }
        const delta = curr - base;
        const pct = base === 0 ? 0 : (delta / base) * 100;
        const over = pct > threshold;
        if (over) violations++;
        rows.push({ rel, base, curr, delta, pct, status: over ? 'OVER' : 'ok' });
    }

    const nameW = Math.max(...rows.map(r => r.rel.length), 10);
    console.log(`\nPerformance budget (threshold +${threshold}%):\n`);
    console.log(`${'file'.padEnd(nameW)}  ${'baseline'.padStart(10)}  ${'current'.padStart(10)}  ${'Δ'.padStart(8)}  ${'Δ%'.padStart(7)}  status`);
    console.log('-'.repeat(nameW + 46));
    for (const r of rows) {
        const pctStr = r.pct == null ? '   —  ' : `${r.pct >= 0 ? '+' : ''}${r.pct.toFixed(1)}%`;
        const deltaStr = r.delta == null ? '   —  ' : `${r.delta >= 0 ? '+' : ''}${r.delta}`;
        console.log(
            `${r.rel.padEnd(nameW)}  ${fmtBytes(r.base).padStart(10)}  ${fmtBytes(r.curr).padStart(10)}  ${deltaStr.padStart(8)}  ${pctStr.padStart(7)}  ${r.status}`
        );
    }
    console.log('');

    if (violations > 0) {
        console.error(`✗ ${violations} file(s) exceeded the +${threshold}% budget.`);
        console.error('  Investigate or run: npm run perf:budget:update');
        process.exit(1);
    }
    if (newFiles > 0) {
        console.log(`ℹ ${newFiles} new file(s) not in budget yet. Run: npm run perf:budget:update`);
    }
    console.log('✓ all tracked files within budget.');
}

main();
