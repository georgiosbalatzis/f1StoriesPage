#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(__filename);

export const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
export const BLOG_ENTRIES_DIR = path.join(REPO_ROOT, 'blog-module', 'blog-entries');
export const INVENTORY_PATH = path.join(SCRIPT_DIR, 'mp3-inventory.json');
export const PRIVATE_MANIFEST_PATH = path.join(SCRIPT_DIR, 'mp3-manifest.json');
export const PUBLIC_MANIFEST_PATH = path.join(REPO_ROOT, 'blog-module', 'narration-manifest.json');
export const COMMANDS_PATH = path.join(SCRIPT_DIR, 'upload-mp3-commands.sh');

export function readJsonIfExists(filePath, fallback = null) {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function writeJson(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

export function normalizeBaseUrl(value) {
    const trimmed = String(value || '').trim();
    if (!trimmed) return '';
    return trimmed.replace(/\/+$/, '');
}

export function originFromUrl(value) {
    const normalized = normalizeBaseUrl(value);
    if (!normalized) return '';
    return new URL(normalized).origin;
}

export function repoRelativePath(absPath) {
    return path.relative(REPO_ROOT, absPath).split(path.sep).join('/');
}

export function shellQuote(value) {
    return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

export function listNarrationEntries() {
    if (!fs.existsSync(BLOG_ENTRIES_DIR)) return [];

    return fs.readdirSync(BLOG_ENTRIES_DIR, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => {
            const slug = entry.name;
            const absPath = path.join(BLOG_ENTRIES_DIR, slug, 'narration.mp3');
            return {
                slug,
                absPath,
                relPath: repoRelativePath(absPath),
                exists: fs.existsSync(absPath)
            };
        })
        .filter(entry => entry.exists)
        .sort((a, b) => a.slug.localeCompare(b.slug));
}
