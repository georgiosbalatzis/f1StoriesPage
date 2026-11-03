import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import sharp from 'sharp';
import { XMLParser } from 'fast-xml-parser';
import media from '../../../blog-module/build/media-meta.js';
import { buildSocialCards, renderSocialCard, socialMetadata } from '../social-cards.mjs';
import { examples } from '../social-card-examples.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const meta = html => new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' }).parse(html.replace(/<(meta|link)([^>]*?)>/g, '<$1$2/>')).head.meta;
const fields = html => Object.fromEntries(meta(html).map(m => [m.property || m.name, m.content]));
const page = '<head><meta property="og:image" content="https://f1-stories.gr/blog-module/blog-entries/story/1.webp"><meta name="twitter:image" content="https://f1-stories.gr/blog-module/blog-entries/story/1.webp"><link rel="canonical" href="https://f1-stories.gr/article.html"></head><body><img src="/hero.webp" loading="eager"></body>';
const digest = data => createHash('sha256').update(data).digest('hex');
const source = (background = '#fff', width = 1600, height = 900) => sharp({ create: { width, height, channels: 3, background } }).png().toBuffer();

function fixture(t) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'f1-social-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const article = 'blog-module/blog-entries/story/article.html';
    fs.mkdirSync(path.join(dir, 'blog-module/blog-entries/story'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'blog-module/blog-source-cache.json'), JSON.stringify({ posts: [{ id: 'story', title: 'Ειδήσεις & αναλύσεις', author: 'Unknown author' }] }));
    fs.writeFileSync(path.join(dir, article), page);
    fs.writeFileSync(path.join(dir, 'index.html'), page);
    fs.copyFileSync(path.join(root, 'images/logo-256.webp'), path.join(dir, 'blog-module/blog-entries/story/1.webp'));
    return { dir, article, cache: path.join(dir, '.build/public-images/social-cards'), options: { repoRoot: dir, distRoot: dir, htmlFiles: ['index.html', article], warn() {} } };
}

function assertLayout(layout, minTop = 150) {
    assert.ok(layout.lines <= 4, `line count: ${layout.lines}`);
    assert.ok(layout.headlineTop >= minTop);
    assert.ok(layout.headlineBottom + 28 <= layout.accentTop);
    assert.ok(layout.height <= 300);
    if (layout.truncated) {
        assert.equal(layout.fontSize, 36);
        assert.ok(layout.displayText.endsWith('…'));
    }
}

test('home bytes remain identical on the recorded environment', async t => {
    if (process.platform !== 'darwin' || process.arch !== 'arm64') return t.skip('Home digest is specific to the recorded darwin/arm64 sharp environment');
    assert.equal(digest((await renderSocialCard({ home: true })).data), '14d541e377e16e2113189041fed03045969db47e4c1069510e05cc4e2755e383');
});

test('Greek, punctuation and long titles fit a cinematic JPEG', async () => {
    const image = await source();
    const titles = [examples[0].title, 'Ελλάδα Formula 1: ά έ ή ί ό ύ ώ ϊ ΐ, «νέα» & <markup> τ’ αγώνα \' "', examples[1].title, 'α'.repeat(400), 'α\u0301'.repeat(400)];
    for (const title of titles) {
        const { data, layout } = await renderSocialCard({ title, image });
        const info = await sharp(data).metadata();
        assert.equal(info.format, 'jpeg');
        assert.equal(info.width, 1200);
        assert.equal(info.height, 630);
        assert.ok(data.length <= 307200);
        assertLayout(layout);
        if (layout.truncated) {
            const prefix = layout.displayText.slice(0, -1);
            const normalized = title.normalize('NFC');
            assert.ok(normalized.startsWith(prefix));
            const boundaries = [...new Intl.Segmenter('el', { granularity: 'grapheme' }).segment(normalized)].map(part => part.index);
            assert.ok(boundaries.includes(prefix.length) || prefix.length === normalized.length);
        }
    }
    await assert.rejects(renderSocialCard({ title: 'Formula 1', image }, 1), /exceeds|budget/i);
});

test('contained media and synthetic disclosure preserve their reserved areas', async () => {
    const image = await source('#eee', 400, 900);
    for (const type of media.CONTAINED) {
        const { layout } = await renderSocialCard({ title: 'Μια ιστορία από την πίστα', image, media: { type }, disclosure: media.AI_LABEL });
        assertLayout(layout, 348);
        assert.ok(layout.disclosureBox, 'disclosure box is reported');
        assert.ok(layout.disclosureBox.top >= layout.headlineBottom || layout.disclosureBox.left >= layout.headlineRight);
    }
});

test('focus follows object-position and EXIF rotation is supported', async () => {
    const image = await sharp({ create: { width: 2000, height: 900, channels: 3, background: '#f00' } }).composite([{ input: await source('#00f', 1000, 900), left: 1000, top: 0 }]).png().toBuffer();
    const a = await renderSocialCard({ title: 'Δοκιμή', image, media: { focus: '0% 50%' } });
    const b = await renderSocialCard({ title: 'Δοκιμή', image, media: { focus: '100% 50%' } });
    assert.notEqual(digest(a.data), digest(b.data));
    const sample = async card => sharp(card.data).extract({ left: 600, top: 250, width: 1, height: 1 }).raw().toBuffer();
    const left = await sample(a);
    const right = await sample(b);
    assert.ok(left[0] > left[2] * 2 && right[2] > right[0] * 2, 'focus offsets must follow object-position');
    const portrait = await source('#123456', 400, 900);
    assert.equal((await sharp((await renderSocialCard({ title: 'Δοκιμή', image: portrait })).data).metadata()).width, 1200);
    const rotated = await sharp(portrait).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    assert.equal((await sharp((await renderSocialCard({ title: 'Δοκιμή', image: rotated })).data).metadata()).height, 630);
});

test('official logo remains recognizable and no accent stripe crosses the header', async () => {
    const image = await source();
    const { data } = await renderSocialCard({ title: 'Δοκιμή', image });
    const card = await sharp(data).raw().toBuffer({ resolveWithObject: true });
    const logo = await sharp(path.join(root, 'images/logo-256.webp')).resize(72, 72).ensureAlpha().raw().toBuffer();
    const pairs = [];
    for (let y = 0; y < 72; y++) for (let x = 0; x < 72; x++) {
        const i = (y * 72 + x) * 4;
        if (logo[i + 3] < 240) continue;
        const j = ((y + 36) * 1200 + x + 48) * card.info.channels;
        pairs.push([logo[i] + logo[i + 1] + logo[i + 2], card.data[j] + card.data[j + 1] + card.data[j + 2]]);
    }
    const means = [0, 1].map(c => pairs.reduce((sum, pair) => sum + pair[c], 0) / pairs.length);
    const covariance = pairs.reduce((sum, pair) => sum + (pair[0] - means[0]) * (pair[1] - means[1]), 0);
    const variance = [0, 1].map(c => pairs.reduce((sum, pair) => sum + (pair[c] - means[c]) ** 2, 0));
    assert.ok(covariance / Math.sqrt(variance[0] * variance[1]) > 0.75, 'rendered logo correlates with the official asset');
    let redPixels = 0;
    for (let y = 0; y < 140; y++) for (let x = 0; x < 200; x++) {
        if (x >= 48 && x < 120 && y >= 36 && y < 108) continue;
        const i = (y * 1200 + x) * card.info.channels;
        if (card.data[i] > 120 && card.data[i] > card.data[i + 1] * 1.8 && card.data[i] > card.data[i + 2] * 1.8) redPixels++;
    }
    assert.ok(redPixels < 100, `unexpected red stripe (${redPixels} pixels)`);
});

test('white and checkerboard sources retain dark backgrounds around every text region', async () => {
    const squares = [];
    for (let y = 0; y < 900; y += 100) for (let x = 0; x < 1600; x += 100) {
        if ((x / 100 + y / 100) % 2) squares.push({ input: await source('#777', 100, 100), left: x, top: y });
    }
    const checker = await sharp(await source()).composite(squares).png().toBuffer();
    for (const image of [await source(), checker]) {
        const { data, layout } = await renderSocialCard({ title: 'Ιστορίες από το πρωτάθλημα', author: 'Γιώργος Μπαλατζής', disclosure: media.AI_LABEL, image });
        const { data: pixels, info } = await sharp(data).raw().toBuffer({ resolveWithObject: true });
        const textMask = async (text, size, width) => sharp({ text: {
            text: `<span foreground="#ffffff" fallback="false">${text}</span>`, font: `IBM Plex Sans Semi-Bold ${size}`,
            fontfile: path.join(root, 'scripts/build/assets/IBMPlexSans-SemiBold.ttf'), width, wrap: 'word-char', rgba: true, dpi: 72, spacing: 4
        } }).png().toBuffer();
        const maskLayers = await Promise.all([
            ['F1 STORIES', 32, 600, layout.wordmarkBox], ['f1-stories.gr', 23, 400, layout.domainBox],
            [layout.displayText, layout.fontSize, 1104, { left: 48, top: layout.headlineTop }],
            ['Γιώργος Μπαλατζής', 26, 650, layout.bylineBox], [media.AI_LABEL, 17, 440, layout.disclosureBox]
        ].map(async ([text, size, width, box]) => ({ input: await textMask(text, size, width), left: box.left, top: box.top })));
        const maskBase = await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#000' } }).composite(maskLayers).png().toBuffer();
        const mask = await sharp(maskBase).greyscale().extractChannel(0).raw().toBuffer();
        for (const box of [layout.wordmarkBox, layout.domainBox, ...layout.headlineBoxes, layout.bylineBox, layout.disclosureBox]) {
            assert.ok(box && box.width > 0 && box.height > 0, 'all text boxes must be reported');
            const values = [];
            for (let y = Math.ceil(box.top); y < box.top + box.height; y += 3) for (let x = Math.ceil(box.left); x < box.left + box.width; x += 3) {
                let nearText = false;
                for (let dy = -3; dy <= 3 && !nearText; dy++) for (let dx = -3; dx <= 3; dx++) {
                    if (mask[(y + dy) * info.width + x + dx]) { nearText = true; break; }
                }
                if (nearText) continue;
                const i = (y * info.width + x) * info.channels;
                const rgb = [pixels[i], pixels[i + 1], pixels[i + 2]].map(v => v / 255);
                const linear = rgb.map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
                values.push(0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]);
            }
            values.sort((a, b) => a - b);
            assert.ok(values.length > 0 && values.at(-1) <= 0.1833, `insufficient text contrast: ${JSON.stringify(box)} ${values.at(-1)}`);
        }
    }
});

test('contained image keeps all four corners visible', async () => {
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00'];
    const patches = await Promise.all(colors.map(color => source(color, 60, 60)));
    const image = await sharp(await source('#888', 400, 200)).composite(patches.map((input, i) => ({ input, left: i % 2 ? 340 : 0, top: i > 1 ? 140 : 0 }))).png().toBuffer();
    for (const type of media.CONTAINED) {
        const { data } = await renderSocialCard({ title: 'Δοκιμή', image, media: { type } });
        const { data: pixels, info } = await sharp(data).raw().toBuffer({ resolveWithObject: true });
        const points = [[430, 158], [770, 158], [430, 298], [770, 298]];
        for (const [i, [x, y]] of points.entries()) {
            const offset = (y * info.width + x) * info.channels;
            const [r, g, b] = pixels.subarray(offset, offset + 3);
            const matches = [r > 150 && g < 100 && b < 100, g > 150 && r < 100 && b < 100, b > 150 && r < 100 && g < 100, r > 150 && g > 150 && b < 100];
            assert.ok(matches[i], `${type} lost corner ${i}`);
        }
    }
});

test('metadata replacement escapes text, removes duplicates and preserves the rest of the page', () => {
    const title = `Ελλάδα & <script>"νέα"</script> τ' αγώνα`;
    const original = page.replace('</head>', '<meta property="og:image" content="duplicate"><script type="application/ld+json">{"image":"/original.webp"}</script></head>');
    const result = socialMetadata(original, { url: 'https://f1-stories.gr/images/social/a.jpg', title });
    const parsed = fields(result.replace(/<script[\s\S]*?<\/script>/, ''));
    assert.equal(parsed['og:image:alt'], title);
    assert.equal(parsed['twitter:image:alt'], title);
    assert.equal(parsed['og:image'], parsed['twitter:image']);
    assert.equal(parsed['twitter:card'], 'summary_large_image');
    assert.equal(meta(result.replace(/<script[\s\S]*?<\/script>/, '')).filter(m => m.property === 'og:image').length, 1);
    assert.ok(result.includes('<link rel="canonical" href="https://f1-stories.gr/article.html">'));
    assert.ok(result.includes('<script type="application/ld+json">{"image":"/original.webp"}</script>'));
    assert.equal(result.slice(result.indexOf('<body>')), original.slice(original.indexOf('<body>')));
    assert.equal(socialMetadata(result, { url: parsed['og:image'], title }), result);
});

test('cold and warm builds produce immutable names and validate cache and provenance', async t => {
    const f = fixture(t);
    const initial = await buildSocialCards(f.options);
    let calls = 0;
    const rerun = async () => {
        fs.writeFileSync(path.join(f.dir, f.article), page);
        fs.writeFileSync(path.join(f.dir, 'index.html'), page);
        return buildSocialCards({ ...f.options, render: async (...args) => { calls++; return renderSocialCard(...args); } });
    };
    const warm = await rerun();
    assert.equal(calls, 0);
    assert.deepEqual(warm.records.map(r => [r.file, r.sha256]), initial.records.map(r => [r.file, r.sha256]));
    for (const record of warm.records) assert.match(record.file, /^images\/social\/(home|article)-[a-f0-9]{20}\.jpg$/);
    assert.equal(warm.records[1].template, 'cinematic-v1');
    assert.match(warm.records[1].rendererKey, /^[a-f0-9]{64}$/);
    const sidecars = fs.readdirSync(f.cache).filter(file => /^[a-f0-9]{64}\.json$/.test(file));
    assert.equal(sidecars.length, 2);
    for (const file of sidecars) {
        const name = path.join(f.cache, file);
        const item = JSON.parse(fs.readFileSync(name));
        item.template = 'obsolete';
        item.rendererKey = 'obsolete';
        fs.writeFileSync(name, JSON.stringify(item));
    }
    await rerun();
    assert.equal(calls, 2);
    for (const file of fs.readdirSync(f.cache).filter(file => file.endsWith('.jpg'))) fs.writeFileSync(path.join(f.cache, file), 'corrupt');
    await rerun();
    assert.equal(calls, 4);
    const postsPath = path.join(f.dir, 'blog-module/blog-source-cache.json');
    const posts = JSON.parse(fs.readFileSync(postsPath));
    posts.posts[0].title += ' — νέο';
    fs.writeFileSync(postsPath, JSON.stringify(posts));
    const changed = await rerun();
    assert.equal(calls, 5);
    assert.equal(changed.records[0].file, initial.records[0].file);
    assert.notEqual(changed.records[1].file, initial.records[1].file);
    fs.writeFileSync(path.join(f.dir, 'blog-module/blog-entries/story/1.webp'), await sharp({ create: { width: 50, height: 50, channels: 3, background: '#a82e1c' } }).webp().toBuffer());
    const newImage = await rerun();
    assert.equal(calls, 6);
    assert.notEqual(newImage.records[1].file, changed.records[1].file);
});

test('focus, media type and synthetic status invalidate only the article cache', async t => {
    const f = fixture(t);
    const original = media.mediaFor;
    t.after(() => { media.mediaFor = original; });
    let current = { type: 'photo', focus: '0% 50%' };
    media.mediaFor = () => current;
    let calls = 0;
    const run = async () => {
        fs.writeFileSync(path.join(f.dir, f.article), page);
        fs.writeFileSync(path.join(f.dir, 'index.html'), page);
        return buildSocialCards({ ...f.options, render: async (...args) => { calls++; return renderSocialCard(...args); } });
    };
    await run();
    await run();
    assert.equal(calls, 2);
    for (const meta of [{ type: 'photo', focus: '100% 50%' }, { type: 'archival', focus: '100% 50%' }, { type: 'archival', focus: '100% 50%', synthetic: 'confirmed' }]) {
        current = meta;
        await run();
    }
    assert.equal(calls, 5);
});

test('missing, invalid, unreadable and undecodable article sources receive branded cards', async t => {
    const f = fixture(t);
    const image = 'https://f1-stories.gr/blog-module/blog-entries/story/1.webp';
    for (const [url, reason] of [
        ['', 'source-missing'], ['https://example.com/photo.webp', 'source-invalid'],
        ['https://f1-stories.gr/%2e%2e%2foutside.webp', 'source-invalid'],
        ['https://f1-stories.gr/blog-module/blog-entries/other/1.webp', 'source-invalid'],
        ['https://f1-stories.gr/blog-module/blog-entries/story/missing.webp', 'source-unreadable'],
        ['https://f1-stories.gr/blog-module/blog-entries/story/bad.webp', 'source-decode']
    ]) {
        fs.writeFileSync(path.join(f.dir, 'blog-module/blog-entries/story/bad.webp'), 'not an image');
        fs.writeFileSync(path.join(f.dir, f.article), url ? page.replaceAll(image, url) : page.replace(/<meta (?:property="og:image"|name="twitter:image")[^>]*>/g, ''));
        const result = await buildSocialCards({ ...f.options, htmlFiles: [f.article] });
        const record = result.records[0];
        assert.equal(record.fallback, reason, url);
        assert.ok(record.file);
        assert.equal(record.error, undefined);
        assert.equal(fields(fs.readFileSync(path.join(f.dir, f.article), 'utf8'))['og:image'], record.url);
    }
});

test('warm cache does not decode source bytes', async t => {
    const f = fixture(t);
    const broken = (await source('#abc', 100, 100)).subarray(0, 70);
    await sharp(broken).metadata();
    await assert.rejects(sharp(broken).rotate().toBuffer());
    fs.writeFileSync(path.join(f.dir, 'blog-module/blog-entries/story/1.webp'), broken);
    const options = { ...f.options, htmlFiles: [f.article] };
    await buildSocialCards({ ...options, render: (args, limit) => renderSocialCard({ ...args, image: null }, limit) });
    fs.writeFileSync(path.join(f.dir, f.article), page);
    const result = await buildSocialCards({ ...options, render: () => { throw new Error('warm cache missed'); } });
    assert.equal(result.cacheHits, 1);
});

test('recognized brand assets are valid sources', async t => {
    const f = fixture(t);
    fs.mkdirSync(path.join(f.dir, 'images'), { recursive: true });
    fs.copyFileSync(path.join(root, 'images/logo-256.webp'), path.join(f.dir, 'images/logo-256.webp'));
    fs.writeFileSync(path.join(f.dir, f.article), page.replaceAll('https://f1-stories.gr/blog-module/blog-entries/story/1.webp', 'https://f1-stories.gr/images/logo-256.webp'));
    const result = await buildSocialCards({ ...f.options, htmlFiles: [f.article] });
    assert.equal(result.records[0].fallback, undefined);
});

test('article failures write a report before rejecting', async t => {
    const f = fixture(t);
    for (const mode of ['title', 'render', 'budget']) {
        const postsPath = path.join(f.dir, 'blog-module/blog-source-cache.json');
        fs.writeFileSync(postsPath, JSON.stringify({ posts: [{ id: 'story', title: mode === 'title' ? '' : 'Δοκιμή' }] }));
        fs.writeFileSync(path.join(f.dir, f.article), page);
        const options = { ...f.options, htmlFiles: [f.article], cacheRoot: path.join(f.dir, `cache-${mode}`) };
        if (mode === 'render') options.render = async () => { throw new Error('encoder/font unavailable'); };
        if (mode === 'budget') options.maxBytes = 1;
        await assert.rejects(buildSocialCards(options));
        const report = JSON.parse(fs.readFileSync(path.join(options.cacheRoot, 'report.json')));
        assert.ok(report.failures.length, mode);
    }
});

test('a source symlinked out of its article directory is rejected as source-invalid', async t => {
    const f = fixture(t);
    const outside = path.join(f.dir, 'blog-module/blog-entries/other');
    fs.mkdirSync(outside, { recursive: true });
    fs.writeFileSync(path.join(outside, 'real.webp'), await source('#abc', 1600, 900));
    fs.symlinkSync(path.join(outside, 'real.webp'), path.join(f.dir, 'blog-module/blog-entries/story/linked.webp'));
    fs.writeFileSync(path.join(f.dir, f.article), page.replaceAll('https://f1-stories.gr/blog-module/blog-entries/story/1.webp', 'https://f1-stories.gr/blog-module/blog-entries/story/linked.webp'));
    const result = await buildSocialCards({ ...f.options, htmlFiles: [f.article] });
    assert.equal(result.records[0].fallback, 'source-invalid');
    assert.ok(result.records[0].file);
});
