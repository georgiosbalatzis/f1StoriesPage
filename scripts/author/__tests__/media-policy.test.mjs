#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..', '..');
const MEDIA_POLICY_PATH = path.join(REPO_ROOT, 'scripts', 'author', 'media-policy.js');

function loadMediaPolicy() {
    const context = {
        console,
        window: {}
    };
    vm.runInNewContext(fs.readFileSync(MEDIA_POLICY_PATH, 'utf8'), context, {
        filename: MEDIA_POLICY_PATH
    });
    return context.window.F1S_AUTHOR_MEDIA_POLICY;
}

const mediaPolicy = loadMediaPolicy();

assert.equal(mediaPolicy.sanitizeImageExtension('photo.JPEG'), 'jpg');
assert.equal(mediaPolicy.sanitizeImageExtension('no-extension'), 'jpg');
assert.equal(mediaPolicy.formatFileSize(900), '900 B');
assert.equal(mediaPolicy.formatFileSize(1536), '1.5 KB');
assert.equal(mediaPolicy.formatFileSize(2 * 1024 * 1024), '2.00 MB');

assert.equal(mediaPolicy.isRawAuthorImage({ name: 'image.png', type: '' }), true);
assert.equal(mediaPolicy.isRawAuthorImage({ name: 'image.bin', type: 'image/jpeg' }), true);
assert.equal(mediaPolicy.isRawAuthorImage({ name: 'image.webp', type: 'image/webp' }), false);
assert.equal(mediaPolicy.isOptimizedAuthorImage({ name: 'image.avif', type: '' }), true);
assert.equal(mediaPolicy.isOptimizedAuthorImage({ name: 'image.bin', type: 'image/webp' }), true);

const rows = [
    null,
    { label: 'Raw', file: { name: 'raw.jpg', type: 'image/jpeg', size: 500 } },
    { label: 'Large', file: { name: 'large.webp', type: 'image/webp', size: 2048 } },
    { label: 'Unknown', file: { name: 'data.bin', type: 'application/octet-stream', size: 200 } },
    { label: 'Optimized', file: { name: 'ok.avif', type: 'image/avif', size: 100 } }
];

const evaluation = mediaPolicy.evaluate(rows, { largeBytes: 1024 });
assert.equal(evaluation.rows.length, 4);
assert.deepEqual(evaluation.rawRows.map(row => row.label), ['Raw']);
assert.deepEqual(evaluation.largeRows.map(row => row.label), ['Large']);
assert.deepEqual(evaluation.unrecognizedRows.map(row => row.label), ['Unknown']);
assert.equal(evaluation.hasWarnings, true);

const clean = mediaPolicy.evaluate([{ label: 'Optimized', file: { name: 'ok.webp', type: 'image/webp', size: 100 } }]);
assert.equal(clean.hasWarnings, false);

console.log('author media policy tests passed.');
