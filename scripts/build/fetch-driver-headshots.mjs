#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const SOURCE_PATH = path.join(REPO_ROOT, 'standings', 'core', 'drivers-meta.js');
const OUTPUT_DIR = path.join(REPO_ROOT, 'images', 'drivers');
const USER_AGENT = 'Mozilla/5.0 (compatible; F1StoriesImageBuild/1.0)';

function readHeadshotMap() {
    const source = fs.readFileSync(SOURCE_PATH, 'utf8');
    const match = source.match(/export const DRIVER_HEADSHOTS = \{([\s\S]*?)\n\};/);
    if (!match) throw new Error(`Could not parse DRIVER_HEADSHOTS from ${SOURCE_PATH}`);

    const entries = [];
    const entryRe = /^\s*'([^']+)':\s*'([^']+)'\s*,?$/gm;
    let entryMatch;
    while ((entryMatch = entryRe.exec(match[1]))) {
        entries.push({ key: entryMatch[1], url: entryMatch[2] });
    }
    return entries;
}

function pickCanonicalSlug(keys) {
    const plainKeys = keys.filter(key => key.indexOf('_') === -1);
    if (plainKeys.length) {
        return plainKeys[0];
    }
    return keys[0].split('_').filter(Boolean).slice(-1)[0] || keys[0];
}

function groupByUrl(entries) {
    const groups = new Map();
    entries.forEach(entry => {
        const group = groups.get(entry.url) || [];
        group.push(entry.key);
        groups.set(entry.url, group);
    });
    return Array.from(groups.entries()).map(([url, keys]) => ({
        url,
        keys,
        fileSlug: pickCanonicalSlug(keys)
    }));
}

async function downloadBuffer(url) {
    const response = await fetch(url, {
        headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'image/avif,image/webp,image/png,image/jpeg,*/*'
        }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return Buffer.from(await response.arrayBuffer());
}

async function main() {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const groups = groupByUrl(readHeadshotMap());
    let created = 0;
    let skipped = 0;

    for (const group of groups) {
        const outputPath = path.join(OUTPUT_DIR, `${group.fileSlug}.webp`);
        if (fs.existsSync(outputPath)) {
            skipped++;
            console.log(`• skip ${path.relative(REPO_ROOT, outputPath)}`);
            continue;
        }

        const buffer = await downloadBuffer(group.url);
        await sharp(buffer)
            .rotate()
            .resize({ width: 600, withoutEnlargement: true, fit: 'inside' })
            .webp({ quality: 80, effort: 6 })
            .toFile(outputPath);
        created++;
        console.log(`✓ ${path.relative(REPO_ROOT, outputPath)}`);
    }

    console.log(`done: ${created} created, ${skipped} skipped`);
}

main().catch(error => {
    console.error(error.message || error);
    process.exit(1);
});
