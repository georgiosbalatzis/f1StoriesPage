import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';

test('brand derivatives have the intended dimensions', async () => {
    for (const [name, width, height] of [
        ['f1s-header-light.webp', 182, 36], ['f1s-header-light@2x.webp', 364, 72],
        ['f1s-header-dark.webp', 173, 36], ['f1s-header-dark@2x.webp', 346, 72],
        ['f1s-logo-600.png', 600, 119], ['f1s-og-default.jpg', 1200, 600],
        ...['light', 'dark'].flatMap(theme => [16, 32].map(size => [`favicon-${theme}-${size}.png`, size, size])),
        ['apple-touch-icon.png', 180, 180]
    ]) {
        const meta = await sharp(`images/brand/${name}`).metadata();
        assert.deepEqual([meta.width, meta.height], [width, height], name);
    }
});

test('theme hook updates both favicon sizes', async () => {
    const { readFileSync } = await import('node:fs');
    const { runInNewContext } = await import('node:vm');
    for (const theme of ['light', 'dark']) {
        const attrs = new Map();
        const icons = [16, 32].map(size => ({ getAttribute: () => `${size}x${size}` }));
        const document = { documentElement: { setAttribute: (k, v) => attrs.set(k, v), removeAttribute: k => attrs.delete(k), getAttribute: k => attrs.get(k) }, querySelectorAll: () => icons };
        const window = { location: { search: '', pathname: '/' }, matchMedia: () => ({ matches: false }) };
        const storage = { getItem: () => theme };
        runInNewContext(readFileSync('scripts/theme-init.js', 'utf8'), { document, window, localStorage: storage, sessionStorage: storage });
        assert.deepEqual(icons.map(icon => icon.href), [16, 32].map(size => `/images/brand/favicon-${theme}-${size}.png`));
    }
});
