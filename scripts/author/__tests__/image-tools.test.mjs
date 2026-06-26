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

console.log('author image tools tests passed.');
