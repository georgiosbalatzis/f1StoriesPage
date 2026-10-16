import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getCachedHeadshotResult } from '../drivers-meta.js';

test('known drivers retain local portraits, aliases and crop positions', () => {
    assert.deepEqual(getCachedHeadshotResult('arvid_lidblad', '', 'https://example.com/c_fill,w_800/photo.png'), {
        url: '/images/drivers/lindblad.webp',
        style: ' style="object-position:center top;"'
    });
});

test('unknown drivers retain the supplied remote portrait or empty fallback', () => {
    assert.deepEqual(getCachedHeadshotResult('unknown', '', 'https://example.com/c_fill,w_800/photo.png'), {
        url: 'https://example.com/c_fill,w_80/photo.png',
        style: ''
    });
    assert.deepEqual(getCachedHeadshotResult('unknown', '', ''), { url: '', style: '' });
});
