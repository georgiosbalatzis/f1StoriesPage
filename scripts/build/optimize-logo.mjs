#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const SOURCE_PATH = path.join(REPO_ROOT, 'images', 'logo.png');
const OUTPUT_DIR = path.join(REPO_ROOT, 'images');

const VARIANTS = [
    { file: 'logo-256.webp', width: 256, height: 256, format: 'webp', options: { quality: 82, effort: 6 } },
    { file: 'logo-256.avif', width: 256, height: 256, format: 'avif', options: { quality: 65, effort: 9 } },
    { file: 'logo-512.webp', width: 512, height: 512, format: 'webp', options: { quality: 82, effort: 6 } },
    { file: 'logo-512.avif', width: 512, height: 512, format: 'avif', options: { quality: 65, effort: 9 } }
];

async function main() {
    if (!fs.existsSync(SOURCE_PATH)) {
        throw new Error(`Logo source not found: ${SOURCE_PATH}`);
    }

    for (const variant of VARIANTS) {
        const outputPath = path.join(OUTPUT_DIR, variant.file);
        await sharp(SOURCE_PATH)
            .rotate()
            .resize(variant.width, variant.height, { fit: 'cover', position: 'center' })
            [variant.format](variant.options)
            .toFile(outputPath);
        console.log(`✓ ${path.relative(REPO_ROOT, outputPath)}`);
    }
}

main().catch(error => {
    console.error(error.message || error);
    process.exit(1);
});
