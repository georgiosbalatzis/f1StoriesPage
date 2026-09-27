#!/usr/bin/env node
// author-image-ingest-check.mjs - run the author tools' image ingestion
// (scripts/author/image-tools.js prepareArticleImage) in Chromium and check
// what an author PR would receive:
// - at most ARTICLE_IMAGE_POLICY.maxWidth wide, at most maxBytes, real WebP;
// - aspect ratio kept, and images that fit are not resized;
// - a WebP that already fits is passed through byte for byte;
// - readers lose nothing measurable on real photos: the 1600 px AVIF the build
//   makes from the new master stays within MAX_AVIF_LOSS_DB PSNR of the one it
//   made from the previous tool output (a full-resolution WebP q0.9), both
//   measured against a Lanczos resize of the untouched source.
//
// Fixtures are generated deterministically, plus real article photos from
// the repo re-saved as camera-style JPEGs.

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const { chromium } = require('playwright-core');
const { Launcher } = require('chrome-launcher');

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const IMAGE_TOOLS = path.join(REPO_ROOT, 'scripts', 'author', 'image-tools.js');
const MAX_AVIF_LOSS_DB = 1.0;
const PUBLIC_MAX_WIDTH = 1600; // generate-image-variants.js FULL_MAX_WIDTH

// Real photos wider than 1600 px, already in the repo and not modified by the tools.
const REAL_PHOTOS = [
    'blog-module/blog-entries/20260829W/4.webp',
    'blog-module/blog-entries/20260725W/2.webp',
    'blog-module/blog-entries/20250323G/2.webp',
    'blog-module/blog-entries/20260910-4G/1.webp'
];

function chromePath() {
    return process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || Launcher.getFirstInstallation();
}

// A camera-like frame: smooth gradients, fine periodic detail and sensor noise.
async function syntheticPhoto(width, height) {
    const raw = Buffer.alloc(width * height * 3);
    let seed = 7;
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            const noise = ((seed >> 16) % 17) - 8;
            const stripes = ((x >> 3) + (y >> 3)) % 2 ? 18 : -18;
            const i = (y * width + x) * 3;
            raw[i] = Math.max(0, Math.min(255, (x * 255) / width + noise + stripes));
            raw[i + 1] = Math.max(0, Math.min(255, (y * 255) / height + noise));
            raw[i + 2] = Math.max(0, Math.min(255, 128 + noise - stripes));
        }
    }
    return sharp(raw, { raw: { width, height, channels: 3 } });
}

// Flat UI with sharp text-like edges (screenshots, graphics, tables).
async function syntheticGraphic(width, height) {
    const rows = [];
    for (let y = 40; y < height; y += 60) {
        rows.push(`<rect x="40" y="${y}" width="${width - 80}" height="36" fill="${y % 120 ? '#e10600' : '#15151e'}"/>`);
        rows.push(`<text x="60" y="${y + 26}" font-family="sans-serif" font-size="24" fill="#fff">Lap ${y} 1:23.456 +0.${y % 1000}</text>`);
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#f4f4f4"/>${rows.join('')}</svg>`;
    return sharp(Buffer.from(svg));
}

async function fixtures() {
    const list = [
        { name: 'camera-4000x2250.jpg', type: 'image/jpeg', buffer: await (await syntheticPhoto(4000, 2250)).jpeg({ quality: 92 }).toBuffer() },
        { name: 'portrait-2400x3200.jpg', type: 'image/jpeg', buffer: await (await syntheticPhoto(2400, 3200)).jpeg({ quality: 92 }).toBuffer() },
        { name: 'screenshot-2560x1440.png', type: 'image/png', buffer: await (await syntheticGraphic(2560, 1440)).png().toBuffer() },
        { name: 'wide-webp-3000x1500.webp', type: 'image/webp', buffer: await (await syntheticPhoto(3000, 1500)).webp({ quality: 90 }).toBuffer() },
        { name: 'fits-1200x675.webp', type: 'image/webp', buffer: await (await syntheticPhoto(1200, 675)).webp({ quality: 85 }).toBuffer(), expectPassthrough: true },
        { name: 'huge-6000x4000.jpg', type: 'image/jpeg', buffer: await (await syntheticPhoto(6000, 4000)).jpeg({ quality: 92 }).toBuffer() },
        { name: 'small-900x600.jpg', type: 'image/jpeg', buffer: await (await syntheticPhoto(900, 600)).jpeg({ quality: 90 }).toBuffer() }
    ];
    for (const relPath of REAL_PHOTOS) {
        const abs = path.join(REPO_ROOT, relPath);
        if (!fs.existsSync(abs)) continue;
        list.push({
            name: `${relPath.split('/').slice(-2).join('-').replace(/\.webp$/, '')}-camera.jpg`,
            type: 'image/jpeg',
            buffer: await sharp(abs).jpeg({ quality: 95 }).toBuffer(),
            photo: true
        });
    }
    return list;
}

function psnr(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i += 1) {
        const d = a[i] - b[i];
        sum += d * d;
    }
    const mse = sum / a.length;
    return mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse);
}

// The build's full-size AVIF variant (generate-image-variants.js), as raw RGB
// at the reference size.
async function avifVariantRaw(buffer, width, height) {
    const avif = await sharp(buffer).resize(PUBLIC_MAX_WIDTH, null, { withoutEnlargement: true }).avif({ quality: 60 }).toBuffer();
    return sharp(avif).resize(width, height, { fit: 'fill' }).removeAlpha().raw().toBuffer();
}

// PSNR of the reader-facing AVIF built from the previous and the new tool output.
async function readerQuality(legacy, master, source) {
    const meta = await sharp(source).metadata();
    const width = Math.min(PUBLIC_MAX_WIDTH, meta.width);
    const height = Math.round(meta.height * width / meta.width);
    const reference = await sharp(source).resize(width, height, { fit: 'fill', kernel: 'lanczos3' }).removeAlpha().raw().toBuffer();
    return {
        before: psnr(await avifVariantRaw(legacy, width, height), reference),
        after: psnr(await avifVariantRaw(master, width, height), reference)
    };
}

// What the tools did before the size policy: keep any WebP, convert anything
// else to a full-resolution WebP at 0.9.
const LEGACY_INGEST = `window.legacyIngest = async function (file) {
    const tools = window.F1S_AUTHOR_IMAGE_TOOLS;
    if (tools.isWebpFile(file)) return file;
    const img = await tools.loadImageFromFile(file, file.name);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    return tools.canvasToWebpBlob(canvas, 0.9, file.name);
};`;

async function main() {
    const executablePath = chromePath();
    if (!executablePath) {
        console.error('Chrome not found. Set CHROME_PATH or PUPPETEER_EXECUTABLE_PATH.');
        process.exit(2);
    }

    const server = http.createServer((req, res) => {
        if (req.url === '/image-tools.js') {
            res.writeHead(200, { 'content-type': 'text/javascript' });
            res.end(fs.readFileSync(IMAGE_TOOLS));
            return;
        }
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end(`<!doctype html><meta charset="utf-8"><script src="/image-tools.js"></script><script>${LEGACY_INGEST}</script>`);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ executablePath });
    const errors = [];
    const rows = [];

    try {
        const page = await browser.newPage();
        await page.goto(`http://127.0.0.1:${server.address().port}/`);
        const policy = await page.evaluate(() => window.F1S_AUTHOR_IMAGE_TOOLS.ARTICLE_IMAGE_POLICY);

        for (const fixture of await fixtures()) {
            const result = await page.evaluate(async ({ name, type, b64 }) => {
                const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
                const file = new File([bytes], name, { type });
                const started = performance.now();
                const out = await window.F1S_AUTHOR_IMAGE_TOOLS.prepareArticleImage(file, name);
                const ms = Math.round(performance.now() - started);
                const encode = async blob => {
                    const buffer = new Uint8Array(await blob.arrayBuffer());
                    let binary = '';
                    for (let i = 0; i < buffer.length; i += 0x8000) binary += String.fromCharCode.apply(null, buffer.subarray(i, i + 0x8000));
                    return btoa(binary);
                };
                return { name: out.name, type: out.type, same: out === file, b64: await encode(out), legacy: await encode(await window.legacyIngest(file)), ms };
            }, { name: fixture.name, type: fixture.type, b64: fixture.buffer.toString('base64') });

            const output = Buffer.from(result.b64, 'base64');
            const inMeta = await sharp(fixture.buffer).metadata();
            const outMeta = await sharp(output).metadata();
            const legacy = Buffer.from(result.legacy, 'base64');
            const quality = await readerQuality(legacy, output, fixture.buffer);
            const row = {
                fixture: fixture.name,
                input: `${inMeta.width}×${inMeta.height} ${(fixture.buffer.length / 1024).toFixed(0)} KB`,
                output: `${outMeta.width}×${outMeta.height} ${(output.length / 1024).toFixed(0)} KB ${outMeta.format}`,
                'repo KB (before → after)': `${(legacy.length / 1024).toFixed(0)} → ${(output.length / 1024).toFixed(0)}`,
                'reader AVIF dB (before → after)': `${quality.before.toFixed(1)} → ${quality.after.toFixed(1)}`,
                ms: result.ms,
                passthrough: result.same
            };
            rows.push(row);

            const fail = message => errors.push(`${fixture.name}: ${message}`);
            if (outMeta.format !== 'webp') fail(`output is ${outMeta.format}, not webp`);
            if (!/\.webp$/.test(result.name)) fail(`output name ${result.name} is not .webp`);
            if (outMeta.width > policy.maxWidth) fail(`output ${outMeta.width} px wide > ${policy.maxWidth}`);
            if (output.length > policy.maxBytes) fail(`output ${output.length} B > ${policy.maxBytes}`);
            if (inMeta.width <= policy.maxWidth && outMeta.width !== inMeta.width) fail('an image that fits was resized');
            const expectedHeight = inMeta.width > policy.maxWidth ? Math.round(inMeta.height * policy.maxWidth / inMeta.width) : inMeta.height;
            if (outMeta.height !== expectedHeight) fail(`height ${outMeta.height} ≠ ${expectedHeight} (aspect ratio)`);
            // Synthetic patterns mostly measure resampler differences; judge fidelity on real photos.
            if (fixture.photo && quality.before - quality.after > MAX_AVIF_LOSS_DB) {
                fail(`reader AVIF loses ${(quality.before - quality.after).toFixed(1)} dB PSNR (> ${MAX_AVIF_LOSS_DB} dB) against the previous tool output`);
            }
            if (fixture.expectPassthrough && !(result.same && output.equals(fixture.buffer))) fail('a fitting WebP was re-encoded instead of kept');
        }
    } finally {
        await browser.close();
        server.close();
    }

    console.table(rows);
    if (errors.length) {
        console.error('author image ingestion check failed:');
        errors.forEach(error => console.error(`  - ${error}`));
        process.exit(1);
    }
    console.log(`author image ingestion check passed: ${rows.length} fixtures, WebP within the size policy, reader AVIF on real photos within ${MAX_AVIF_LOSS_DB} dB of the previous tool.`);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
