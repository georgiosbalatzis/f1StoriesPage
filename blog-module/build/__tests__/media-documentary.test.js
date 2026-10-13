// P3D Documentary Lens: the media contract (media-metadata.json), truthful srcsets, figure numbering, the chart
// scroller, whole gallery frames, NEXT UP picture uniqueness and the AVIF cap with provenance carried over.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const sharp = require('sharp');
const { validateRegister, loadMediaRegister, creditLineHtml, applyBodyMedia, cardDisclosureHtml, mediaAttributes, slotOf, AI_LABEL } = require('../media-meta');

test('gallery remediation captions and screenshot alt survive repeated rendering', () => {
    for (const [id, slot, caption] of [['20260508W', 4, 'Screenshot'], ['20261002W', 3, 'Γραφικό']]) {
        const body = `<div class="gallery-carousel" aria-label="Φωτογραφικό αρχείο: T"><div class="gallery-slide active" data-index="0"><picture><img src="${slot}.webp" alt="old photo" class="article-content-img"></picture></div></div>`;
        const once = applyBodyMedia(body, id);
        assert.match(once, new RegExp(caption));
        assert.doesNotMatch(once, /alt="old photo"/);
        assert.match(once, /aria-label="Αρχείο εικόνων: T"/);
        assert.match(once, /data-media="graphic"/);
        assert.equal(applyBodyMedia(once, id), once);
        assert.equal((once.match(/class="media-credit"/g) || []).length, 1);
    }
});
const { truthfulSrcset } = require('../image-sizes');
const { transformBody } = require('../race-report');
const { scoreRelatedPosts } = require('../related');
const { collectImageVariantTasks } = require('../../generate-image-variants');

const ENTRIES = path.join(__dirname, '..', '..', 'blog-entries');

test('same-path editorial replacements use measured hero and gallery dimensions, not stale cached ones', async t => {
    const { renderArticleHtml } = require('../article-render');
    const entry = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-replacement-'));
    t.after(() => fs.rmSync(entry, { recursive: true, force: true }));
    for (const name of ['1.webp', '1.avif']) fs.copyFileSync(path.join(ENTRIES, '20260817J', name), path.join(entry, name));
    const html = await renderArticleHtml({
        id: '20260817J', title: 'Test', category: 'News', date: '2026-08-17', author: 'F1 Stories',
        backgroundImage: '/blog-module/blog-entries/20260817J/1.webp',
        backgroundImageWidth: 1536, backgroundImageHeight: 1024,
        content: '<div class="gallery-slide active" data-index="0"><img src="1.webp" class="article-content-img" width="1536" height="1024"></div>'
    }, entry);
    assert.match(html, /rr-cover--inset/);
    assert.match(html, /--cover-w: 900px/);
    assert.match(html, /width="900" height="450"/);
    assert.doesNotMatch(html, /width="1536"|height="1024"/);
});

test('the register validates its vocabulary: suspicion is not a status, only documented AI is "confirmed"', () => {
    assert.deepEqual(validateRegister({ images: { 'X/1': { type: 'poster', focus: '50% 30%', synthetic: 'confirmed', rights: 'documented' } } }).errors, []);
    const { errors } = validateRegister({ images: { 'X/1': { type: 'selfie', synthetic: 'likely', focus: 'top', credit: '', photographer: 'A' }, bad: {} } });
    assert.equal(errors.length, 6, errors.join('\n'));
});

test('the published register points at real files and confirms AI only where the files document it', () => {
    const images = loadMediaRegister();
    for (const key of Object.keys(images)) {
        const [id, slot] = key.split('/');
        assert.ok(fs.existsSync(path.join(ENTRIES, id, `${slot}.webp`)), key);
    }
    const synthetic = Object.keys(images).filter(key => images[key].synthetic).map(key => key.split('/')[0]);
    assert.deepEqual([...new Set(synthetic)].sort(), ['20250706G', '20250715G', '20250721J']);
    // The documentation for each: the published 2.avif still carries IPTC trainedAlgorithmicMedia.
    return Promise.all(['20250706G', '20250715G', '20250721J'].map(async id => {
        const meta = await sharp(path.join(ENTRIES, id, '2.avif')).metadata();
        assert.match(String(meta.xmp || ''), /trainedAlgorithmicMedia/, id);
    }));
});

test('the credit line prints only what is recorded, escaped, and nothing at all for a missing record', () => {
    assert.equal(creditLineHtml(null), '');
    assert.equal(creditLineHtml({ type: 'poster', focus: '50% 50%' }), '');
    const line = creditLineHtml({ caption: 'A <b> "c"', captionLang: 'en', credit: 'AP Photo/X & Y', synthetic: 'confirmed' });
    assert.match(line, /<span class="media-credit__caption" lang="en">A &lt;b&gt; &quot;c&quot;<\/span>/);
    assert.match(line, /<span class="media-credit__label">Πηγή<\/span> AP Photo\/X &amp; Y/);
    assert.ok(line.includes(`<span class="media-credit__ai">${AI_LABEL}</span>`));
    assert.doesNotMatch(creditLineHtml({ credit: 'X' }), /δεν έχει καταγραφεί|source not recorded/i);
});

test('cards carry the AI label and containment only from the register', () => {
    assert.match(cardDisclosureHtml('20250721J', '/blog-module/blog-entries/20250721J/1-card.webp'), new RegExp(AI_LABEL));
    assert.equal(cardDisclosureHtml('20261011J', '/blog-module/blog-entries/20261011J/1-card.webp'), '');
    assert.equal(mediaAttributes('20261011J', '1-card.webp'), ' data-media="poster"');
    assert.equal(mediaAttributes('no-such-story', '1.webp'), '');
    assert.equal(slotOf('/blog-module/blog-entries/X/12-mobile.avif'), '12');
});

test('body figures get recorded alt, caption and credit, and re-rendering the result is stable', () => {
    const body = '<figure class="article-figure"><picture><img src="3.webp"\n srcset="3.webp" alt="T: εικόνα 3" class="article-content-img" data-full-src="3.webp" data-fallback-src="/blog-module/images/default-blog.jpg"></picture><figcaption>Image 3</figcaption></figure>'
        + '<figure class="article-figure"><img src="4.webp" alt="T: εικόνα 4" class="article-content-img"></figure>'
        + '<figure class="article-figure"><img src="7.webp" alt="keep" class="article-content-img"></figure>';
    const once = applyBodyMedia(body, '20260722T');
    assert.match(once, /alt="Γράφημα γραμμής: Εξέλιξη/);
    assert.match(once, /<figcaption>Image 3<!--media--><span class="media-credit">[\s\S]*FIA Race History Chart[\s\S]*<!--\/media--><\/figcaption>/);
    assert.match(once, /alt="keep"/, 'an image without a record is untouched');
    assert.doesNotMatch(once.split('4.webp')[1].split('</figure>')[0], /figcaption/, 'no record, no caption');
    assert.equal(applyBodyMedia(once, '20260722T'), once);
});

test('generic captions are numbered from 1 in reading order (they printed the file slot, from 3)', () => {
    const fig = n => `<figure class="article-figure"><img src="${n}.webp"><figcaption>Image ${n}</figcaption></figure>`;
    const out = transformBody(`<p>a</p>\n${fig(3)}\n<p>b</p>\n${fig(5)}\n<p>c</p>\n${fig(4)}`).html;
    assert.deepEqual([...out.matchAll(/<figcaption>Εικ\. (\d+)/g)].map(m => m[1]), ['1', '2', '3']);
    assert.equal(transformBody(out).html, out);
});

test('a chart sits in one labelled, focusable horizontal scroller, also on re-render', () => {
    const long = 'Λέξη '.repeat(30).trim() + '.';
    const out = transformBody(`<p>${long}</p>\n<p>Πώς άλλαξε το pace delta</p>\n<p>Μέση διαφορά ανά φάση.</p>\n<figure class="article-figure"><picture><source srcset="4.avif"><img src="4.webp"></picture><figcaption>Image 4</figcaption></figure>\n<p>${long}</p>`).html;
    assert.match(out, /<figure class="article-figure"><div class="rr-chart__scroll" tabindex="0" role="region" aria-label="Γράφημα: Πώς άλλαξε το pace delta \(οριζόντια κύλιση\)"><picture>[\s\S]*<\/picture><\/div><figcaption>/);
    const again = transformBody(out).html;
    assert.equal(again, out);
    assert.equal(again.split('rr-chart__scroll').length, 2);
});

test('gallery frames carry their own pixel height and load lazily, idempotently', () => {
    const slide = (i, h, extra = '') => `<div class="gallery-slide${i ? '' : ' active'}" data-index="${i}"><picture><source srcset="${i}.avif"><img src="${i}.webp" class="article-content-img" loading="${i ? 'lazy' : 'eager'}"${extra} decoding="async" width="800" height="${h}"></picture></div>`;
    const body = `<div class="gallery-carousel"><div class="gallery-carousel-slides">${slide(0, 533, ' fetchpriority="low"')}${slide(1, 1200)}</div></div>`;
    const out = transformBody(body).html;
    assert.match(out, /<img src="0\.webp" class="article-content-img" loading="lazy" decoding="async" width="800" height="533" style="--nat-h: 533px">/);
    assert.match(out, /height="1200" style="--nat-h: 1200px">/);
    assert.equal(transformBody(out).html, out);
    // `sizes` follows the frame: 800×1200 is 147px wide at the 220px phone strip and 267px at 400px.
    const sized = transformBody(body.replace(/<source srcset="1\.avif">/, '<source srcset="1.avif" sizes="770px">').replace('height="1200"', 'height="1200" sizes="770px"')).html;
    assert.equal((sized.match(/sizes="\(max-width: 733px\) 147px, 267px"/g) || []).length, 2, 'the <source> and the <img> of the frame');
});

test('figure images carry their pixel width, so a small file is never drawn at the 770px sizes slot', () => {
    const fig = '<figure class="article-figure">\n<picture>\n<source srcset="3-sm.webp 275w">\n<img src="3.webp"\n srcset="3-sm.webp 275w" sizes="(max-width: 820px) calc(100vw - 2rem), 770px" class="article-content-img" width="275" height="183" data-fallback-src="/x.jpg">\n</picture>\n</figure>';
    const out = transformBody(`<p>a</p>\n${fig}`).html;
    assert.match(out, /width="275" height="183" data-fallback-src="\/x\.jpg" style="--nat-w: 275px">/);
    assert.equal(transformBody(out).html, out);
});

test('srcset candidates are measured; a copy no wider than a smaller one is dropped', () => {
    const sizes = { '/e/1-card.webp': { width: 400 }, '/e/1-mobile.webp': { width: 350 }, '/e/1.webp': { width: 350 } };
    assert.equal(truthfulSrcset('/e', ['1-card.webp', '1-mobile.webp', '1.webp'], n => n, f => sizes[f]), '1-card.webp 400w');
    const wide = { '/e/2-mobile.avif': { width: 800 }, '/e/2.avif': { width: 2560 } };
    assert.equal(truthfulSrcset('/e', ['2-mobile.avif', '2.avif', 'missing.avif'], n => `x/${n}`, f => wide[f]), 'x/2-mobile.avif 800w, x/2.avif 2560w');
});

test('NEXT UP passes over a story whose card repeats the article cover or another card', () => {
    const post = (id, picture, extra = {}) => ({ id, picture, date: '2026-01-01', categories: ['News'], tags: ['ferrari'], ...extra });
    const posts = [post('a', 'P'), post('b', 'P'), post('c', 'Q'), post('d', 'Q'), post('e', 'R'), post('f', 'S')];
    const ids = scoreRelatedPosts(posts, posts[0], 0, p => [p.picture]).map(p => p.id);
    assert.deepEqual(ids, ['c', 'e', 'f']);
    assert.deepEqual(scoreRelatedPosts(posts, posts[0], 0).map(p => p.id), ['b', 'c', 'd'], 'without picture keys the order is unchanged');
});

test('an uncapped full AVIF is regenerated at 1600px with its XMP; capped and missing files behave as before', async () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-avif-'));
    try {
        const blogDir = path.join(temp, 'blog-entries');
        const dir = path.join(blogDir, 'x1');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(temp, 'blog-source-cache.json'), JSON.stringify({ posts: [{ id: 'x1', image: '/blog-module/blog-entries/x1/2.webp', backgroundImage: '/blog-module/blog-entries/x1/2.webp' }] }));
        fs.writeFileSync(path.join(dir, 'article.html'), '<img src="2.avif"><img src="2-mobile.webp"><img src="2-card.webp">');
        const xmp = '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/" Iptc4xmpExt:DigitalSourceType="http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"/></rdf:RDF></x:xmpmeta>';
        const canvas = width => sharp({ create: { width, height: Math.round(width / 2), channels: 3, background: '#335577' } });
        await canvas(2400).webp().toFile(path.join(dir, '2.webp'));
        await canvas(2400).avif().withXmp(xmp).toFile(path.join(dir, '2.avif'));
        await canvas(800).webp().toFile(path.join(dir, '2-mobile.webp'));
        await canvas(400).webp().toFile(path.join(dir, '2-card.webp'));
        const { tasks } = await collectImageVariantTasks({ blogDir, cardsOnly: true, force: false });
        assert.deepEqual(tasks.map(t => path.basename(t.dest)), ['2.avif']);
        assert.match(tasks[0].keepXmp, /trainedAlgorithmicMedia/);
        assert.equal(tasks[0].maxWidth, 1600);
        // Two encodes of the same task are byte-identical (deterministic derivatives).
        const encode = () => sharp(tasks[0].src).resize(1600, null, { withoutEnlargement: true }).withXmp(tasks[0].keepXmp).avif({ quality: 60 }).toBuffer();
        const [a, b] = await Promise.all([encode(), encode()]);
        assert.ok(a.equals(b));
        const meta = await sharp(a).metadata();
        assert.equal(meta.width, 1600);
        assert.match(String(meta.xmp), /trainedAlgorithmicMedia/);
        // Once capped, nothing more to do.
        fs.writeFileSync(path.join(dir, '2.avif'), a);
        assert.deepEqual((await collectImageVariantTasks({ blogDir, cardsOnly: true, force: false })).tasks, []);
        // An AVIF wider than its WebP source is the only high-resolution copy: kept, never re-encoded from the smaller file.
        await canvas(1600).webp().toFile(path.join(dir, '2.webp'));
        await canvas(3000).avif().toFile(path.join(dir, '2.avif'));
        assert.deepEqual((await collectImageVariantTasks({ blogDir, cardsOnly: true, force: false })).tasks, []);
    } finally {
        fs.rmSync(temp, { recursive: true, force: true });
    }
});
