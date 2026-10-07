import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { optimizePublicArticleImage } from '../public-article-images.mjs';

async function fixture(t, format = 'webp') {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'f1-public-images-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const src = path.join(root, `source.${format}`);
    const dest = path.join(root, `public.${format}`);
    const input = sharp(randomBytes(256 * 256 * 3), { raw: { width: 256, height: 256, channels: 3 } });
    await (format === 'webp' ? input.webp({ lossless: true }) : input.avif({ quality: 100, effort: 0 })).toFile(src);
    const options = { cacheRoot: path.join(root, 'cache'), maxBytes: 4096, maxWidth: 32 };
    const relPath = `blog-module/blog-entries/example/1.${format}`;
    return { src, dest, relPath, options };
}

for (const format of ['webp', 'avif']) {
    test(`${format} output is reused byte-for-byte without modifying its source`, async t => {
        const f = await fixture(t, format);
        const original = fs.readFileSync(f.src);
        const first = await optimizePublicArticleImage(f.src, f.dest, f.relPath, f.options);
        assert.equal(first.cacheHit, false);
        assert.equal(first.withinBudget, true);
        assert.equal((await sharp(f.dest).metadata()).width, 32);
        const output = fs.readFileSync(f.dest);
        const image = fs.readdirSync(f.options.cacheRoot).find(name => name.endsWith(`.${format}`));
        const cachedImage = path.join(f.options.cacheRoot, image);
        fs.utimesSync(cachedImage, 946684800, 946684800);
        fs.unlinkSync(f.dest);

        const second = await optimizePublicArticleImage(f.src, f.dest, f.relPath, f.options);
        assert.equal(second.cacheHit, true);
        assert.deepEqual(fs.readFileSync(f.dest), output);
        assert.deepEqual(fs.readFileSync(f.src), original);
        assert.equal(fs.statSync(cachedImage).mtimeMs, 946684800000);
    });
}

test('editing a source or changing the image policy invalidates only its cached output', async t => {
    const f = await fixture(t);
    await optimizePublicArticleImage(f.src, f.dest, f.relPath, f.options);
    const originalOutput = fs.readFileSync(f.dest);
    await sharp(f.src).negate().webp({ lossless: true }).toFile(`${f.src}.new`);
    fs.renameSync(`${f.src}.new`, f.src);
    assert.equal((await optimizePublicArticleImage(f.src, f.dest, f.relPath, f.options)).cacheHit, false);
    assert.notDeepEqual(fs.readFileSync(f.dest), originalOutput);
    assert.equal((await optimizePublicArticleImage(f.src, f.dest, f.relPath, f.options)).cacheHit, true);

    assert.equal((await optimizePublicArticleImage(f.src, f.dest, f.relPath, { ...f.options, maxWidth: 24 })).cacheHit, false);
    assert.equal((await sharp(f.dest).metadata()).width, 24);
    assert.equal((await optimizePublicArticleImage(f.src, f.dest, f.relPath, { ...f.options, maxBytes: 4000 })).cacheHit, false);
    // The original policy still reuses its own entry.
    assert.equal((await optimizePublicArticleImage(f.src, f.dest, f.relPath, f.options)).cacheHit, true);
});

test('damaged or incomplete cache entries are regenerated from the source', async t => {
    const f = await fixture(t);
    await optimizePublicArticleImage(f.src, f.dest, f.relPath, f.options);
    const expected = fs.readFileSync(f.dest);
    const files = fs.readdirSync(f.options.cacheRoot);
    const image = path.join(f.options.cacheRoot, files.find(name => name.endsWith('.webp')));
    const metadata = path.join(f.options.cacheRoot, files.find(name => name.endsWith('.json')));
    for (const damage of [
        () => fs.writeFileSync(image, Buffer.alloc(expected.length)),
        () => fs.writeFileSync(metadata, '{'),
        () => fs.writeFileSync(metadata, 'null'),
        () => fs.unlinkSync(image)
    ]) {
        damage();
        assert.equal((await optimizePublicArticleImage(f.src, f.dest, f.relPath, f.options)).cacheHit, false);
        assert.deepEqual(fs.readFileSync(f.dest), expected);
    }
});

test('images within budget and non-article images bypass optimization', async t => {
    const f = await fixture(t);
    assert.equal(await optimizePublicArticleImage(f.src, f.dest, 'images/example.webp', f.options), null);
    assert.equal(await optimizePublicArticleImage(f.src, f.dest, f.relPath, {
        ...f.options, maxBytes: fs.statSync(f.src).size
    }), null);
    assert.equal(fs.existsSync(f.options.cacheRoot), false);
});
