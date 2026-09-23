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

for (const name of sponsors) {
    const source = path.join(root, 'images/sponsors', `${name}.webp`);
    const data = await sharp(source)
        .trim()
        .resize(320, 160, { fit: 'contain', background: '#00000000', withoutEnlargement: true })
        .webp({ lossless: true })
        .toBuffer();
    const destination = path.join(output, `${name}.webp`);
    if (!fs.existsSync(destination) || !fs.readFileSync(destination).equals(data)) {
        fs.writeFileSync(destination, data);
    }
    console.log(`${name}: ${data.length} bytes`);
}
