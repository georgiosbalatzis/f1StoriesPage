#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..', '..');
const IMAGE_TOOLS_PATH = path.join(REPO_ROOT, 'scripts', 'author', 'image-tools.js');

function loadImageTools() {
    const context = {
        console,
        window: {}
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

// Article image policy: 2x the widest public variant, and the repo media guard cap.
const policy = tools.ARTICLE_IMAGE_POLICY;
assert.equal(policy.maxWidth, 2 * 1600, '2 x FULL_MAX_WIDTH / PUBLIC_ARTICLE_IMAGE_MAX_WIDTH');
const mediaBudget = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'perf', 'article-media-budget.json'), 'utf8'));
assert.equal(policy.maxBytes, mediaBudget.limits.singleOptimizedImageBytes, 'the tools must produce what perf:article-media accepts');
assert.equal(policy.qualities[0], 0.9, 'first step is the quality the tools always used');

assert.deepEqual({ ...tools.scaledSize(4690, 2639, 3200) }, { width: 3200, height: 1801 });
assert.deepEqual({ ...tools.scaledSize(3392, 1908, 3200) }, { width: 3200, height: 1800 });
assert.deepEqual({ ...tools.scaledSize(3200, 1800, 3200) }, { width: 3200, height: 1800 });
assert.deepEqual({ ...tools.scaledSize(1200, 800, 3200) }, { width: 1200, height: 800 });
assert.deepEqual({ ...tools.scaledSize(20000, 1, 3200) }, { width: 3200, height: 1 });

const plan = info => ({ ...tools.planArticleImage(info) });
// A WebP that already fits is kept byte for byte (no generation loss).
assert.deepEqual(plan({ webp: true, width: 3072, height: 4096, bytes: 1000 * 1024 }), { keep: true, resize: false, width: 3072, height: 4096 });
// Too wide: resized, whatever the format.
assert.deepEqual(plan({ webp: true, width: 3392, height: 1908, bytes: 900 * 1024 }), { keep: false, resize: true, width: 3200, height: 1800 });
assert.deepEqual(plan({ webp: false, width: 6000, height: 4000, bytes: 9e6 }), { keep: false, resize: true, width: 3200, height: 2133 });
// Fits the width but not the byte cap: re-encoded at the same size.
assert.deepEqual(plan({ webp: true, width: 2491, height: 1619, bytes: 1100 * 1024 }), { keep: false, resize: false, width: 2491, height: 1619 });
// Not WebP: converted at its own size, as before.
assert.deepEqual(plan({ webp: false, width: 4000, height: 2250, bytes: 5e6 }), { keep: false, resize: true, width: 3200, height: 1800 });
assert.deepEqual(plan({ webp: false, width: 800, height: 600, bytes: 90 * 1024 }), { keep: false, resize: false, width: 800, height: 600 });
assert.equal(tools.ensureWebpFile, tools.prepareArticleImage);

console.log('author image tools tests passed.');
