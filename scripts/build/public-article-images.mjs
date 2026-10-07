import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const CACHE_ROOT = fileURLToPath(new URL('../../.build/public-images/', import.meta.url));
const MAX_BYTES = Number(process.env.PUBLIC_IMAGE_MAX_BYTES || 300 * 1024);
const MAX_WIDTH = Number(process.env.PUBLIC_ARTICLE_IMAGE_MAX_WIDTH || 1600);
const QUALITIES = {
    avif: [52, 48, 44, 40, 36, 32, 28, 24, 20],
    webp: [82, 78, 74, 70, 66, 62, 58, 54, 50, 46, 42, 38, 34, 30, 26]
};
const hash = data => createHash('sha256').update(data).digest('hex');
// Changing this optimizer or its native encoders invalidates existing entries.
const OPTIMIZER = hash(fs.readFileSync(fileURLToPath(import.meta.url)) + JSON.stringify(sharp.versions));

export async function optimizePublicArticleImage(src, dest, relPath, {
    cacheRoot = CACHE_ROOT,
    maxBytes = MAX_BYTES,
    maxWidth = MAX_WIDTH
} = {}) {
    if (!/^blog-module\/blog-entries\/[^/]+\/[^/]+\.(?:avif|webp)$/i.test(relPath)) return null;
    const originalSize = fs.statSync(src).size;
    if (originalSize <= maxBytes) return null;

    const ext = path.extname(relPath).slice(1).toLowerCase();
    const input = fs.readFileSync(src);
    const key = hash(Buffer.concat([
        Buffer.from(JSON.stringify({ optimizer: OPTIMIZER, ext, maxBytes, maxWidth })),
        input
    ]));
    const cachedImage = path.join(cacheRoot, `${key}.${ext}`);
    const cachedMetadata = path.join(cacheRoot, `${key}.json`);

    try {
        const metadata = JSON.parse(fs.readFileSync(cachedMetadata, 'utf8'));
        const buffer = fs.readFileSync(cachedImage);
        if (metadata?.digest === hash(buffer) && metadata.outputSize === buffer.length) {
            fs.writeFileSync(dest, buffer);
            return { relPath, originalSize, outputSize: buffer.length, quality: metadata.quality,
                withinBudget: buffer.length <= maxBytes, cacheHit: true };
        }
    } catch (error) {
        // A missing, incomplete or damaged cache is only a miss; sources remain authoritative.
        if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
    }

    let best = null;
    for (const quality of QUALITIES[ext]) {
        const pipeline = sharp(input).rotate().resize({ width: maxWidth, withoutEnlargement: true });
        const buffer = ext === 'avif'
            ? await pipeline.avif({ quality, effort: 6 }).toBuffer()
            : await pipeline.webp({ quality, effort: 6 }).toBuffer();
        if (!best || buffer.length < best.buffer.length) best = { buffer, quality };
        if (buffer.length <= maxBytes) break;
    }

    fs.writeFileSync(dest, best.buffer);
    fs.mkdirSync(cacheRoot, { recursive: true });
    fs.writeFileSync(cachedImage, best.buffer);
    fs.writeFileSync(cachedMetadata, JSON.stringify({
        outputSize: best.buffer.length, quality: best.quality, digest: hash(best.buffer)
    }));
    return { relPath, originalSize, outputSize: best.buffer.length, quality: best.quality,
        withinBudget: best.buffer.length <= maxBytes, cacheHit: false };
}
