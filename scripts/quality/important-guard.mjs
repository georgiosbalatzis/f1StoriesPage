#!/usr/bin/env node
// Ratchet source CSS !important usage. Existing exceptions remain documented
// in the baseline; new declarations fail CI unless marked /* utility-important */.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASELINE = path.join(ROOT, 'perf', 'important-budget.json');
const roots = ['styles', 'blog-module', 'standings', 'privacy'];
const files = [];
function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.endsWith('.min.css')) continue;
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(abs);
        else if (entry.name.endsWith('.css')) files.push(abs);
    }
}
roots.forEach(dir => walk(path.join(ROOT, dir)));
const entries = [];
for (const file of files) {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
        if (!/!important\b/.test(line)) return;
        const context = `${lines[index - 1] || ''} ${line}`;
        if (/utility-important/.test(context)) return;
        entries.push(`${path.relative(ROOT, file)}:${index + 1}`);
    });
}
const budget = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
if (process.argv.includes('--update')) {
    budget.max = entries.length;
    fs.writeFileSync(BASELINE, JSON.stringify(budget, null, 2) + '\n');
    console.log(`✓ !important budget ratcheted to ${entries.length}`);
} else if (entries.length > budget.max) {
    console.error(`✗ source CSS contains ${entries.length} undocumented !important declarations (budget ${budget.max}).`);
    console.error(entries.slice(budget.max).map(entry => `  - ${entry}`).join('\n'));
    process.exit(1);
} else {
    console.log(`✓ source CSS !important usage: ${entries.length}/${budget.max}`);
}
