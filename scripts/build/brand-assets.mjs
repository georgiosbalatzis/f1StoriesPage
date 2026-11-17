import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

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
