#!/usr/bin/env node
// rendering-sink-guard.mjs - keeps raw HTML rendering sinks from growing silently.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const BASELINE_PATH = path.join(REPO_ROOT, 'quality', 'rendering-sinks-baseline.json');
const UPDATE = process.argv.includes('--update');

const EXCLUDED_PREFIXES = [
    'archive/',
    'blog-module/blog-entries/',
    'dist/',
    'node_modules/'
];

const EXCLUDED_FILES = new Set([
    'scripts/quality/rendering-sink-guard.mjs'
]);

const SCANNED_EXTENSIONS = new Set(['.html', '.js', '.mjs']);

function sourceFiles() {
    return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
        cwd: REPO_ROOT,
        encoding: 'utf8'
    }).split(/\r?\n/).filter(Boolean).sort();
}

function shouldSkip(relPath) {
    if (EXCLUDED_FILES.has(relPath)) return true;
    return EXCLUDED_PREFIXES.some(prefix => relPath.startsWith(prefix));
}

function emptyCounts() {
    return {
        innerHTML: 0,
        outerHTML: 0,
        insertAdjacentHTML: 0,
        total: 0
    };
}

function countMatches(text, pattern) {
    return Array.from(String(text || '').matchAll(pattern)).length;
}

function scanFile(relPath) {
    const text = fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
    const counts = emptyCounts();
    counts.innerHTML = countMatches(text, /\.(?:innerHTML)\s*=/g);
    counts.outerHTML = countMatches(text, /\.(?:outerHTML)\s*=/g);
    counts.insertAdjacentHTML = countMatches(text, /\binsertAdjacentHTML\s*\(/g);
    counts.total = counts.innerHTML + counts.outerHTML + counts.insertAdjacentHTML;
    return counts;
}

function scanFiles() {
    const files = sourceFiles().filter(relPath => {
        if (shouldSkip(relPath)) return false;
        return SCANNED_EXTENSIONS.has(path.extname(relPath).toLowerCase());
    });
    const results = {};
    for (const relPath of files) {
        const counts = scanFile(relPath);
        if (counts.total > 0) results[relPath] = counts;
    }
    return results;
}

function loadBaseline() {
    if (!fs.existsSync(BASELINE_PATH)) {
        throw new Error(`Missing rendering sink baseline at ${path.relative(REPO_ROOT, BASELINE_PATH)}. Run npm run quality:rendering:update after reviewing current sinks.`);
    }
    return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
}

function writeBaseline(files) {
    fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
    const baseline = {
        version: 1,
        updated: new Date().toISOString().slice(0, 10),
        description: 'Reviewed raw HTML rendering sink counts. Lower this baseline as sinks move to DOM construction or trusted rendering helpers.',
        ignoredPrefixes: EXCLUDED_PREFIXES,
        ignoredFiles: Array.from(EXCLUDED_FILES).sort(),
        files
    };
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n');
}

function countAtMost(actual, allowed, key) {
    return (actual && actual[key] || 0) <= (allowed && allowed[key] || 0);
}

function compareToBaseline(actualFiles, baselineFiles) {
    const errors = [];
    const paths = new Set([...Object.keys(actualFiles), ...Object.keys(baselineFiles)]);
    for (const relPath of [...paths].sort()) {
        const actual = actualFiles[relPath] || emptyCounts();
        const allowed = baselineFiles[relPath] || emptyCounts();
        for (const key of ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'total']) {
            if (!countAtMost(actual, allowed, key)) {
                errors.push(`${relPath}: ${key} count grew from ${allowed[key] || 0} to ${actual[key] || 0}`);
            }
        }
    }
    return errors;
}

function main() {
    const actualFiles = scanFiles();

    if (UPDATE) {
        writeBaseline(actualFiles);
        console.log(`Rendering sink baseline updated: ${Object.keys(actualFiles).length} files with raw HTML sinks.`);
        return;
    }

    const baseline = loadBaseline();
    const errors = compareToBaseline(actualFiles, baseline.files || {});
    if (errors.length) {
        console.error('Rendering sink guard failed:');
        errors.forEach(error => console.error(`- ${error}`));
        console.error('Review the new raw HTML sinks. Prefer DOM construction or an approved trusted-rendering helper. If intentional, run npm run quality:rendering:update.');
        process.exit(1);
    }

    console.log(`Rendering sink guard passed: ${Object.keys(actualFiles).length} files are within the reviewed raw HTML baseline.`);
}

main();
