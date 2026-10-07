import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import generator from '../../../blog-module/generate-image-variants.js';

const generatorPath = fileURLToPath(new URL('../../../blog-module/generate-image-variants.js', import.meta.url));

async function fixture(t, { source = false, html = '' } = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'f1-variant-demand-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const blogDir = path.join(root, 'blog-module', 'blog-entries');
    const entry = path.join(blogDir, 'story');
    fs.mkdirSync(entry, { recursive: true });
    const webp = await sharp({ create: { width: 1000, height: 600, channels: 3, background: '#357' } }).webp().toBuffer();
    for (const name of ['1.webp', '2.webp', '3.webp']) fs.writeFileSync(path.join(entry, name), webp);
    fs.writeFileSync(path.join(entry, 'article.html'), html);
    if (source) fs.writeFileSync(path.join(entry, 'source.txt'), 'article source');
    const post = { id: 'story', image: '/blog-module/blog-entries/story/1.webp', backgroundImage: '/blog-module/blog-entries/story/2.webp' };
    const cache = posts => fs.writeFileSync(path.join(root, 'blog-module', 'blog-source-cache.json'), JSON.stringify({ posts }));
    const older = () => cache([...Array.from({ length: 4 }, (_, i) => ({ id: `newer-${i}` })), post]);
    older();
    const tasks = async options => (await generator.collectImageVariantTasks({ blogDir, cardsOnly: true, ...options })).tasks;
    const names = async options => (await tasks(options)).map(task => path.basename(task.dest)).sort();
    return { root, blogDir, entry, post, cache, older, tasks, names };
}

test('new source-backed stories get responsive heroes and archive cards without unused variants', async t => {
    const f = await fixture(t, { source: true });
    assert.deepEqual(await f.names(), ['1-card.webp', '1-mobile.webp', '2-mobile.avif', '2-mobile.webp', '2.avif']);
    f.post.image = f.post.backgroundImage;
    f.older();
    assert.ok((await f.names()).includes('2-card.webp'), 'a selected background can become the card image');
});

test('source-less articles retain only referenced hero variants, including with --force', async t => {
    const f = await fixture(t, { html: '<source srcset="2.avif 1600w"><img src="2.webp"><div class="gallery-thumb"><img src="3.webp"></div>' });
    const expected = ['1-card.webp', '1-mobile.webp', '2.avif', '3-thumb.webp'];
    assert.deepEqual(await f.names(), expected);
    assert.deepEqual(await f.names({ force: true }), expected);
    fs.writeFileSync(path.join(f.entry, '2.avif'), 'existing variant');
    assert.ok(!(await f.names()).includes('2.avif'));
    assert.ok((await f.names({ force: true })).includes('2.avif'));
    assert.ok((await f.names({ cardsOnly: false })).includes('3-sm.avif'), 'full backfill still supports content images');
});

test('homepage promotion uses fresh metadata and generates the newly selected AVIF', async t => {
    const f = await fixture(t);
    assert.ok(!(await f.names()).includes('1.avif'));
    f.cache([f.post]);
    assert.ok((await f.names()).includes('1.avif'));
    f.post.image = f.post.backgroundImage;
    f.cache([f.post]);
    const names = await f.names();
    assert.ok(names.includes('2.avif'));
    assert.ok(names.includes('2-card.webp'));
    assert.ok(names.includes('2-mobile.webp'));
    assert.ok(!names.includes('1.avif'));
    f.older();
    assert.ok(!(await f.names()).includes('2.avif'));
});

test('the CLI generates demanded variants once and leaves unused files absent on repeat runs', async t => {
    const f = await fixture(t, { source: true });
    const moduleDir = path.dirname(f.blogDir);
    fs.copyFileSync(generatorPath, path.join(moduleDir, 'generate-image-variants.js'));
    fs.symlinkSync(path.join(path.dirname(generatorPath), 'build'), path.join(moduleDir, 'build'));
    fs.symlinkSync(path.resolve(path.dirname(generatorPath), '..', 'node_modules'), path.join(f.root, 'node_modules'));
    const originals = ['1.webp', '2.webp', '3.webp'].map(name => fs.readFileSync(path.join(f.entry, name)));
    const run = () => execFileSync(process.execPath, [path.join(moduleDir, 'generate-image-variants.js'), '--run', '--cards-only'], { encoding: 'utf8' });
    run();
    assert.deepEqual(await f.names(), []);
    for (const name of ['1-card.webp', '1-mobile.webp', '2.avif', '2-mobile.avif', '2-mobile.webp']) {
        assert.ok((await sharp(path.join(f.entry, name)).metadata()).width <= (name.includes('-card') ? 400 : 1600));
    }
    assert.match(run(), /All variants already exist/);
    for (const name of ['1.avif', '1-mobile.avif', '2-card.webp']) assert.ok(!fs.existsSync(path.join(f.entry, name)));
    ['1.webp', '2.webp', '3.webp'].forEach((name, i) => assert.deepEqual(fs.readFileSync(path.join(f.entry, name)), originals[i]));
});
