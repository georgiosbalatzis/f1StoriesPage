#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { browser } from '../../config/site-config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const output = path.join(root, 'scripts', 'site-config.js');
const payload = JSON.stringify(browser);
const source = `/* Generated from config/site-config.json. Do not edit. */\n(function (global) {\n  global.F1S_SITE_CONFIG = Object.freeze(${payload});\n}(typeof window !== 'undefined' ? window : globalThis));\n`;
fs.writeFileSync(output, source, 'utf8');
console.log(`Generated ${path.relative(root, output)}`);
