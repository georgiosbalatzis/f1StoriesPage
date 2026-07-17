#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const baseline = 726;
function cssFiles(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return cssFiles(rel);
    return entry.isFile() && rel.endsWith('.css') && !rel.endsWith('.min.css') ? [rel] : [];
  });
}
const files = ['styles.css', 'theme-overrides.css', 'home.css', ...cssFiles('styles'), ...cssFiles('standings'), ...cssFiles('blog-module')];
const count = [...new Set(files)].reduce((total, file) => total + (fs.readFileSync(path.join(root, file), 'utf8').match(/!important/g) || []).length, 0);
if (count > baseline) throw new Error(`CSS !important count increased: ${count} > ${baseline}`);
console.log(`CSS cascade baseline passed: ${count} !important declarations (ratchet ≤ ${baseline}).`);
