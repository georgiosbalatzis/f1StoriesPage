import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import sharp from 'sharp';
import { XMLParser } from 'fast-xml-parser';
import { buildSocialCards, renderSocialCard, socialMetadata } from '../social-cards.mjs';
import { examples } from '../social-card-examples.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const meta = html => new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' })
    .parse(html.replace(/<(meta|link)([^>]*?)>/g, '<$1$2/>')).head.meta;
const fields = html => Object.fromEntries(meta(html).map(m => [m.property || m.name, m.content]));
const page = '<head><meta property="og:image" content="https://f1-stories.gr/photo.webp"><meta name="twitter:image" content="https://f1-stories.gr/photo.webp"><link rel="canonical" href="https://f1-stories.gr/article.html"></head><body><img src="/hero.webp" loading="eager"></body>';

test('review examples preserve Greek and punctuation within the 1200×630 JPEG budget', async () => {
    for (const example of examples) {
        const image = example.image ? fs.readFileSync(path.join(root, 'blog-module/blog-entries', example.image)) : null;
        const { data, layout } = await renderSocialCard({ ...example, image });
        const info = await sharp(data).metadata();
        assert.equal(info.format, 'jpeg');
        assert.equal(info.width, 1200);
        assert.equal(info.height, 630);
        assert.ok(data.length <= 300 * 1024);
        assert.equal(info.exif, undefined);
        assert.equal(layout.truncated, false, example.name);
        if (!example.home) assert.equal(layout.displayText, example.title);
        assert.ok(layout.width <= (example.home ? 810 : 632));
        assert.ok(layout.height <= (example.home ? 350 : 310));
    }
});

test('extreme titles wrap unbroken words and truncate by grapheme at a readable minimum', async () => {
    const image = fs.readFileSync(path.join(root, 'images/logo-256.webp'));
    for (const title of ['αεροδυναμική'.repeat(150), 'Άνθρωποι, μονοθέσια & «ιστορίες» '.repeat(80)]) {
        const { layout } = await renderSocialCard({ title, image });
        assert.ok(layout.fontSize >= 28);
        assert.ok(layout.height <= 310);
        assert.equal(layout.truncated, true);
        assert.ok(layout.displayText.endsWith('…'));
    }
    await assert.rejects(renderSocialCard({ title: 'Formula 1', image }, 1), /exceeds/);
});

test('metadata replacement escapes text and leaves canonical, structured data and hero markup intact', () => {
    const title = `Ελλάδα & <script>"νέα"</script> τ' αγώνα`;
    const original = page.replace('</head>', '<meta property="og:image" content="duplicate"><script type="application/ld+json">{"image":"/original.webp"}</script></head>');
    const result = socialMetadata(original, { url: 'https://f1-stories.gr/images/social/a.jpg', title });
    // JSON-LD is deliberately untouched; remove it only for the XML fixture parser.
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

function fixture(t) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'f1-social-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    fs.mkdirSync(path.join(dir, 'blog-module'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'blog-module/blog-source-cache.json'), JSON.stringify({ posts: [{ id: 'story', title: 'Ειδήσεις & αναλύσεις', category: 'News', author: 'Unknown author' }] }));
    const article = 'blog-module/blog-entries/story/article.html';
    fs.mkdirSync(path.dirname(path.join(dir, article)), { recursive: true });
    fs.writeFileSync(path.join(dir, article), page);
    fs.writeFileSync(path.join(dir, 'index.html'), page);
    fs.copyFileSync(path.join(root, 'images/logo-256.webp'), path.join(dir, 'photo.webp'));
    return { dir, article, options: { repoRoot: dir, distRoot: dir, htmlFiles: ['index.html', article], warn() {} } };
}

test('cold/warm builds are byte-identical, immutable-named and reuse only validated cache entries', async t => {
    const f = fixture(t);
    const initial = await buildSocialCards(f.options);
    assert.equal(initial.records.filter(r => r.cacheHit).length, 0);
    let calls = 0;
    const rerun = async () => {
        fs.writeFileSync(path.join(f.dir, f.article), page);
        fs.writeFileSync(path.join(f.dir, 'index.html'), page);
        return buildSocialCards({ ...f.options, render: async (...args) => { calls++; return renderSocialCard(...args); } });
    };
    const warm = await rerun();
    assert.equal(calls, 0);
    assert.deepEqual(warm.records.map(r => [r.file, r.sha256]), initial.records.map(r => [r.file, r.sha256]));
    for (const file of fs.readdirSync(path.join(f.dir, '.build/public-images/social-cards')).filter(f => f.endsWith('.jpg'))) fs.writeFileSync(path.join(f.dir, '.build/public-images/social-cards', file), 'corrupt');
    const repaired = await rerun();
    assert.equal(calls, 2);
    assert.deepEqual(repaired.files, initial.files);
    const source = JSON.parse(fs.readFileSync(path.join(f.dir, 'blog-module/blog-source-cache.json')));
    source.posts[0].title += ' — νέο';
    fs.writeFileSync(path.join(f.dir, 'blog-module/blog-source-cache.json'), JSON.stringify(source));
    const changed = await rerun();
    assert.equal(calls, 3, 'only the changed article is re-rendered');
    assert.equal(changed.records[0].file, initial.records[0].file, 'home does not borrow article inputs');
    assert.notEqual(changed.records[1].file, initial.records[1].file);
    await sharp({ create: { width: 50, height: 50, channels: 3, background: '#a82e1c' } }).webp().toFile(path.join(f.dir, 'photo.webp'));
    const newImage = await rerun();
    assert.equal(calls, 4, 'changed source pixels invalidate the article card');
    assert.notEqual(newImage.records[1].file, changed.records[1].file);
});

test('generation failures retain the article image and use the stable brand fallback for home', async t => {
    const f = fixture(t);
    const result = await buildSocialCards({ ...f.options, render: async () => { throw new Error('encoder/font unavailable'); } });
    assert.equal(result.files.length, 0);
    assert.equal(result.records.filter(r => r.error).length, 2);
    assert.equal(fs.readFileSync(path.join(f.dir, f.article), 'utf8'), page);
    assert.equal(fields(fs.readFileSync(path.join(f.dir, 'index.html'), 'utf8'))['og:image'], 'https://f1-stories.gr/images/icons/icon-512.png');
});

test('external or escaping source paths never trigger image reads outside the public artifact', async t => {
    const f = fixture(t);
    for (const url of ['https://example.com/photo.webp', 'https://f1-stories.gr/%2e%2e%2foutside.webp']) {
        fs.writeFileSync(path.join(f.dir, f.article), page.replaceAll('https://f1-stories.gr/photo.webp', url));
        let called = false;
        const result = await buildSocialCards({ ...f.options, htmlFiles: [f.article], render: async () => { called = true; } });
        assert.equal(called, false);
        assert.ok(result.records[0].error);
    }
});
