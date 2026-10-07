#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..', '..');
const IMAGE_TOOLS_PATH = path.join(REPO_ROOT, 'scripts', 'author', 'image-tools.js');

function loadImageTools(browser = {}) {
    const context = {
        console,
        window: {},
        ...browser
    };
    vm.runInNewContext(fs.readFileSync(IMAGE_TOOLS_PATH, 'utf8'), context, {
        filename: IMAGE_TOOLS_PATH
    });
    return context.window.F1S_AUTHOR_IMAGE_TOOLS;
}

const tools = loadImageTools();

assert.equal(tools.sanitizeImageExtension('photo.JPEG'), 'jpg');
assert.equal(tools.sanitizeImageExtension('photo.webp'), 'webp');
assert.equal(tools.sanitizeImageExtension('no-extension'), 'jpg');
assert.equal(tools.replaceFileExtension('photo.jpeg', 'webp'), 'photo.webp');
assert.equal(tools.replaceFileExtension('', 'webp'), 'image.webp');
assert.equal(tools.mimeTypeForExtension('jpg'), 'image/jpeg');
assert.equal(tools.mimeTypeForExtension('txt'), 'text/plain');
assert.equal(tools.mimeTypeForExtension('unknown'), 'application/octet-stream');
assert.equal(tools.isWebpFile({ name: 'image.webp', type: '' }), true);
assert.equal(tools.isWebpFile({ name: 'image.jpg', type: 'image/webp' }), true);
assert.equal(tools.isWebpFile({ name: 'image.jpg', type: 'image/jpeg' }), false);

// Browser output must fit the public artifact without another compression pass.
const policy = tools.ARTICLE_IMAGE_POLICY;
assert.equal(policy.maxWidth, 1600, 'FULL_MAX_WIDTH / PUBLIC_ARTICLE_IMAGE_MAX_WIDTH');
const mediaBudget = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'perf', 'article-media-budget.json'), 'utf8'));
assert.equal(policy.maxBytes, 300 * 1024, 'PUBLIC_IMAGE_MAX_BYTES');
assert.ok(policy.maxBytes <= mediaBudget.limits.singleOptimizedImageBytes);
assert.equal(policy.qualities[0], 0.9, 'first step is the quality the tools always used');

assert.deepEqual({ ...tools.scaledSize(4690, 2639, 3200) }, { width: 3200, height: 1801 });
assert.deepEqual({ ...tools.scaledSize(3392, 1908, 3200) }, { width: 3200, height: 1800 });
assert.deepEqual({ ...tools.scaledSize(3200, 1800, 3200) }, { width: 3200, height: 1800 });
assert.deepEqual({ ...tools.scaledSize(1200, 800, 3200) }, { width: 1200, height: 800 });
assert.deepEqual({ ...tools.scaledSize(20000, 1, 3200) }, { width: 3200, height: 1 });

const plan = info => ({ ...tools.planArticleImage(info) });
// A WebP that already fits is kept byte for byte (no generation loss).
assert.deepEqual(plan({ webp: true, width: 1200, height: 1600, bytes: 300 * 1024 }), { keep: true, resize: false, width: 1200, height: 1600 });
// Too wide: resized, whatever the format.
assert.deepEqual(plan({ webp: true, width: 3392, height: 1908, bytes: 900 * 1024 }), { keep: false, resize: true, width: 1600, height: 900 });
assert.deepEqual(plan({ webp: false, width: 6000, height: 4000, bytes: 9e6 }), { keep: false, resize: true, width: 1600, height: 1067 });
// Fits the width but not the byte cap: re-encoded at the same size.
assert.deepEqual(plan({ webp: true, width: 1200, height: 800, bytes: 301 * 1024 }), { keep: false, resize: false, width: 1200, height: 800 });
// Not WebP: converted at its own size, as before.
assert.deepEqual(plan({ webp: false, width: 4000, height: 2250, bytes: 5e6 }), { keep: false, resize: true, width: 1600, height: 900 });
assert.deepEqual(plan({ webp: false, width: 800, height: 600, bytes: 90 * 1024 }), { keep: false, resize: false, width: 800, height: 600 });
assert.equal(tools.ensureWebpFile, tools.prepareArticleImage);

// An unsupported WebP encoder must not silently upload PNG bytes as WebP.
await assert.rejects(tools.canvasToWebpBlob({
    toBlob(callback) { callback({ type: 'image/png', size: 100 }); }
}, 0.9, 'Hero'), /Hero.*cannot encode WebP/);
await assert.rejects(tools.canvasToWebpBlob({
    toBlob(callback) { callback(null); }
}, 0.9, 'Header'), /Header.*could not be converted/);
const webpBlob = { type: 'image/webp', size: 100 };
assert.equal(await tools.canvasToWebpBlob({
    toBlob(callback, type, quality) {
        assert.equal(type, 'image/webp');
        assert.equal(quality, 0.82);
        callback(webpBlob);
    }
}, 0.82), webpBlob);

// Exercise the async retry path in CI without a browser installation. Actual
// encoder/decoder behavior is covered separately by qa:author-images.
function mockBrowserTools(encode) {
    return loadImageTools({
        File,
        URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} },
        Image: class {
            naturalWidth = 80;
            naturalHeight = 60;
            set src(value) { queueMicrotask(() => this.onload()); }
        },
        document: { createElement() {
            return {
                getContext() { return { drawImage() {} }; },
                toBlob(callback, type, quality) {
                    callback(new Blob([new Uint8Array(encode(this.width, this.height, quality))], { type }));
                }
            };
        } }
    });
}
const overBudget = new File(['RIFF0000WEBP', new Uint8Array(200)], 'original.webp', { type: 'image/webp', lastModified: 123 });
const tinyPolicy = { maxWidth: 80, maxBytes: 100, qualities: [0.9, 0.5] };
const attempts = [];
const resized = await mockBrowserTools((width, height, quality) => {
    attempts.push({ width, height, quality });
    return width === 80 ? 300 : 90;
}).prepareArticleImage(overBudget, 'Oversized', tinyPolicy);
assert.equal(resized.size, 90, 'never pass through an oversized original when encoding is larger');
assert.equal(resized.type, 'image/webp');
assert.equal(resized.lastModified, 123);
assert.deepEqual(attempts, [
    { width: 80, height: 60, quality: 0.9 },
    { width: 80, height: 60, quality: 0.5 },
    { width: 46, height: 35, quality: 0.9 }
]);
const atLowerQuality = await mockBrowserTools((width, height, quality) => quality === 0.9 ? 200 : 90)
    .prepareArticleImage(overBudget, 'Quality', tinyPolicy);
assert.equal(atLowerQuality.size, 90);
await assert.rejects(mockBrowserTools(() => 200).prepareArticleImage(overBudget, 'Impossible', tinyPolicy), /Impossible.*could not fit/);

console.log('author image tools tests passed.');
