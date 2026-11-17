import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HOME_SOURCE_SHA256 = '6aadb4e1bf315dbb30905d5ea528169165b98b85bacec62729358eb7ff05d8e5';
const PATCH = { left: 48, top: 32, width: 347, height: 64 };
const BAND = 4, HEADER_HEIGHT = 42, JPEG_QUALITY = 90;
const repo = fileURLToPath(new URL('../../', import.meta.url));

function lab(rgb) {
    const [r, g, b] = rgb.map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    const xyz = [(r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047, r * 0.2126729 + g * 0.7151522 + b * 0.072175, (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883].map(v => v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
    return [116 * xyz[1] - 16, 500 * (xyz[0] - xyz[1]), 200 * (xyz[1] - xyz[2])];
}

export async function boundaryDelta(image) {
    const { data, info } = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const sums = [[0, 0, 0], [0, 0, 0]], counts = [0, 0];
    const { left, top, width, height } = PATCH;
    for (let y = top - BAND; y < top + height + BAND; y++) for (let x = left - BAND; x < left + width + BAND; x++) {
        const inside = x >= left && x < left + width && y >= top && y < top + height;
        const inner = x >= left + BAND && x < left + width - BAND && y >= top + BAND && y < top + height - BAND;
        if (inner || (inside && x < left + 214 && y >= 36 && y < 78)) continue;
        const group = inside ? 0 : 1;
        for (let c = 0; c < 3; c++) sums[group][c] += data[(y * info.width + x) * info.channels + c];
        counts[group]++;
    }
    const colors = sums.map((sum, i) => lab(sum.map(v => v / counts[i])));
    return Math.hypot(...colors[0].map((v, i) => v - colors[1][i]));
}

export async function makeHomeCard(original, header) {
    if (createHash('sha256').update(original).digest('hex') !== HOME_SOURCE_SHA256) throw new Error('Unexpected home card source SHA-256');
    const { data, info } = await sharp(original).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width !== 1200 || info.height !== 630) throw new Error('Unexpected home card dimensions');
    const samples = [[], [], []], { left, top, width, height } = PATCH;
    for (let y = top - BAND; y < top + height + BAND; y++) for (let x = left - BAND; x < left + width + BAND; x++) {
        if (x >= left && x < left + width && y >= top && y < top + height) continue;
        for (let c = 0; c < 3; c++) samples[c].push(data[(y * info.width + x) * info.channels + c]);
    }
    const paper = samples.map(values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]);
    const patch = await sharp({ create: { width, height, channels: 3, background: { r: paper[0], g: paper[1], b: paper[2] } } }).png().toBuffer();
    const logo = await sharp(header).resize({ height: HEADER_HEIGHT, kernel: 'lanczos3' }).png().toBuffer();
    const result = await sharp(original).composite([{ input: patch, left, top }, { input: logo, left: 48, top: 36 }]).jpeg({ quality: JPEG_QUALITY }).toBuffer();
    const delta = await boundaryDelta(result);
    if (delta >= 1) throw new Error(`Home card patch ΔE76 ${delta} exceeds 1`);
    return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
const kit = process.argv[2];
if (!kit) throw new Error('Usage: node scripts/build/brand-assets.mjs <kitDir>');
const out = 'images/brand';
await fs.mkdir(out, { recursive: true });
for (const theme of ['Light', 'Dark']) {
    const source = path.join(kit, '03-Header', `F1-Stories-B-Header-${theme}.png`);
    for (const height of [36, 72]) {
        await sharp(source).resize({ height, kernel: 'lanczos3' }).webp({ quality: 90, alphaQuality: 100 }).toFile(`${out}/f1s-header-${theme.toLowerCase()}${height === 72 ? '@2x' : ''}.webp`);
    }
    for (const size of [16, 32]) await fs.copyFile(path.join(kit, '04-Favicons', `F1-Stories-B-Favicon-${theme}-${size}.png`), `${out}/favicon-${theme.toLowerCase()}-${size}.png`);
}
await sharp(path.join(kit, '03-Header/F1-Stories-B-Header-Light.png')).resize({ width: 600, kernel: 'lanczos3' }).png().toFile(`${out}/f1s-logo-600.png`);
await sharp(path.join(kit, '01-Original/F1-Stories-B-Original-Master.png')).resize(1200, 600, { kernel: 'lanczos3' }).jpeg({ quality: 88 }).toFile(`${out}/f1s-og-default.jpg`);
await fs.copyFile(path.join(kit, '04-Favicons/F1-Stories-B-Favicon-Light-180.png'), `${out}/apple-touch-icon.png`);
await fs.copyFile(path.join(kit, '04-Favicons/favicon-light.ico'), 'favicon.ico');

const original = await fs.readFile(process.argv[3] || path.join(repo, 'scripts/build/assets/home-social-source.jpg'));
await fs.mkdir('images/social', { recursive: true });
await fs.writeFile('images/social/home-brand-b2.jpg', await makeHomeCard(original, path.join(kit, '03-Header/F1-Stories-B-Header-Light.png')));
}
