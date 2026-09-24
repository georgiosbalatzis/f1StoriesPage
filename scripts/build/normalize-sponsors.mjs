#!/usr/bin/env node
// Remove transparent canvas margins without changing sponsor artwork or source files.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sponsors = ['Balatzis', 'ps', 'BalatzisDomika', 'am', 'bedhome', 'GrandRealm'];
const output = path.join(root, 'images/sponsors/normalized');
fs.mkdirSync(output, { recursive: true });

// 320×160 serves 2x screens (logos render at up to 160×68 CSS px); the -1x file serves 1x
// screens through srcset (stamp-html addDensitySrcset).
for (const name of sponsors) {
    const source = path.join(root, 'images/sponsors', `${name}.webp`);
    for (const [suffix, width, height] of [['', 320, 160], ['-1x', 160, 80]]) {
        const data = await sharp(source)
            .trim()
            .resize(width, height, { fit: 'contain', background: '#00000000', withoutEnlargement: true })
            .webp({ lossless: true })
            .toBuffer();
        const destination = path.join(output, `${name}${suffix}.webp`);
        if (!fs.existsSync(destination) || !fs.readFileSync(destination).equals(data)) {
            fs.writeFileSync(destination, data);
        }
        console.log(`${name}${suffix}: ${data.length} bytes`);
    }
}
