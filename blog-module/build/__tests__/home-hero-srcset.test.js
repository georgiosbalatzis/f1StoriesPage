// The cover photograph offers its 800px copy beside a 1,600px master, so a phone does not fetch the larger file.
// Width descriptors are the files' measured widths, so the fixtures are real images of the stated sizes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const sharp = require('sharp');
const { injectHomepageHero, renderCoverFrames, renderCoverFramePreloads } = require('../index');
const { CONFIG } = require('../shared');
const { primeImageDimensions } = require('../image-sizes');

const shell = '<link id="hero-image-preload" rel="preload" as="image" href="/x.avif">'
    + '<picture id="hero-picture"><source id="hero-source-avif" type="image/avif" srcset="/x.avif"><source id="hero-source-webp" type="image/webp" srcset="/x.webp">'
    + '<img id="hero-image" src="/x.webp" width="1" height="1"></picture>';

// The generator's widths for a master of `width` px: full AVIF capped at 1600, mobile at 800, card at 400.
const widthOf = (name, width) => ({ '1.webp': width, '1.avif': Math.min(width, 1600), '1-card.webp': Math.min(width, 400) }[name.replace(/^2/, '1')] || Math.min(width, 800));

// Writes real images of the stated widths (height from `ratio`) for story s1, then runs `fn` with CONFIG pointed there.
async function withEntry(files, masterWidth, fn, ratio = 16 / 9) {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-hero-'));
    const original = CONFIG.BLOG_DIR;
    try {
        CONFIG.BLOG_DIR = path.join(temp, 'blog-module', 'blog-entries');
        fs.mkdirSync(path.join(CONFIG.BLOG_DIR, 's1'), { recursive: true });
        for (const name of files) {
            const width = widthOf(name, masterWidth);
            const image = sharp({ create: { width, height: Math.round(width / ratio), channels: 3, background: '#556677' } });
            await image[name.endsWith('.avif') ? 'avif' : 'webp']().toFile(path.join(CONFIG.BLOG_DIR, 's1', name));
        }
        await primeImageDimensions(CONFIG.BLOG_DIR);
        return fn(temp);
    } finally {
        CONFIG.BLOG_DIR = original;
        fs.rmSync(temp, { recursive: true, force: true });
    }
}

function render(files, hero) {
    return withEntry(files, hero.heroImageWidth, temp => {
        fs.writeFileSync(path.join(temp, 'index.html'), shell);
        injectHomepageHero({ id: 's1', title: 'T', heroImage: '/blog-module/blog-entries/s1/1.webp', heroAvif: '/blog-module/blog-entries/s1/1.avif', ...hero });
        return fs.readFileSync(path.join(temp, 'index.html'), 'utf8');
    });
}

const all = ['1.webp', '1.avif', '1-card.webp', '1-mobile.webp', '1-mobile.avif'];

test('a wide master is offered with its 800px copy, widest first', async () => {
    const html = await render(all, { heroImageWidth: 1600, heroImageHeight: 900 });
    assert.match(html, /id="hero-source-avif"[^>]*srcset="\/blog-module\/blog-entries\/s1\/1\.avif 1600w, \/blog-module\/blog-entries\/s1\/1-mobile\.avif 800w"[^>]*sizes=/);
    assert.match(html, /id="hero-image-preload"[^>]*imagesrcset="[^"]*1\.avif 1600w, [^"]*1-mobile\.avif 800w"/);
});

test('a master wider than 1600px is described at its real width; the capped AVIF at 1600', async () => {
    const html = await render(all, { heroImageWidth: 2400, heroImageHeight: 1350 });
    assert.match(html, /id="hero-source-avif"[^>]*srcset="[^"]*1\.avif 1600w, [^"]*1-mobile\.avif 800w"/);
    assert.match(html, /id="hero-source-webp"[^>]*srcset="[^"]*1\.webp 2400w, [^"]*1-mobile\.webp 800w, [^"]*1-card\.webp 400w"/);
});

test('a master of 800px or less keeps the single-file delivery', async () => {
    const html = await render(all, { heroImageWidth: 770, heroImageHeight: 513 });
    assert.match(html, /id="hero-source-avif" type="image\/avif" srcset="\/blog-module\/blog-entries\/s1\/1\.avif">/);
    assert.doesNotMatch(html, /imagesrcset|\sw,|\d+w/);
});

test('missing 800px copies fall back to the single file', async () => {
    const html = await render(['1.webp', '1.avif'], { heroImageWidth: 1600, heroImageHeight: 900 });
    assert.doesNotMatch(html, /\d+w[,"]/);
});

test('a story with a separate 2.webp cover is offered at its widths too, behind a typed AVIF preload', async () => {
    const html = await render(['2.webp', '2.avif', '2-mobile.webp', '2-mobile.avif'], {
        heroImage: '/blog-module/blog-entries/s1/2.webp', heroAvif: '/blog-module/blog-entries/s1/2.avif', heroImageWidth: 1600, heroImageHeight: 900
    });
    assert.match(html, /id="hero-source-avif"[^>]*srcset="[^"]*\/2\.avif 1600w, [^"]*\/2-mobile\.avif 800w"/);
    assert.match(html, /id="hero-source-webp"[^>]*srcset="[^"]*\/2\.webp 1600w, [^"]*\/2-mobile\.webp 800w"/);
    assert.match(html, /id="hero-image-preload"[^>]*href="[^"]*\/2\.avif"[^>]*type="image\/avif"[^>]*imagesrcset="[^"]*\/2\.avif 1600w, [^"]*\/2-mobile\.avif 800w"/);
});

test('without AVIF the preload is untyped and follows the WebP candidates the picture uses', async () => {
    const html = await render(['1.webp', '1-card.webp', '1-mobile.webp'], { heroAvif: '', heroImageWidth: 1600, heroImageHeight: 900 });
    assert.match(html, /id="hero-image-preload"[^>]*href="[^"]*\/1\.webp"/);
    assert.doesNotMatch(html, /id="hero-image-preload"[^>]*type=/);
    assert.match(html, /id="hero-image-preload"[^>]*imagesrcset="[^"]*\/1\.webp 1600w, [^"]*\/1-mobile\.webp 800w, [^"]*\/1-card\.webp 400w"/);
});

// A frame's preload names exactly the candidates and sizes its picture uses from 768px, so it is never a second download.
async function framePreload(files) {
    const post = { id: 's1', title: 'T', image: '/blog-module/blog-entries/s1/1.webp', categories: ['News'] };
    const source = () => ({ image: post.image, imageWidth: 1200, imageHeight: 800 });
    return withEntry(files, 1200, () => ({ frame: renderCoverFrames([post], source), preload: renderCoverFramePreloads([post], source) }), 1.5);
}

test('frame preloads mirror the AVIF source when there is one, and the WebP candidates otherwise', async () => {
    const attr = (html, tag, name) => new RegExp(`<${tag}\\b[^>]*\\s${name}="([^"]*)"`).exec(html)[1];
    const avif = await framePreload(['1.webp', '1.avif', '1-card.webp', '1-mobile.webp', '1-mobile.avif']);
    assert.match(avif.preload, /^\n {4}<link rel="preload" as="image" media="\(min-width: 768px\)" type="image\/avif" href="[^"]*\/1\.avif" /);
    assert.equal(attr(avif.preload, 'link', 'imagesrcset'), attr(avif.frame, 'source', 'srcset'));
    assert.equal(attr(avif.preload, 'link', 'imagesizes'), attr(avif.frame, 'source', 'sizes'));
    assert.equal(attr(avif.frame, 'source', 'media'), '(min-width: 768px)');
    assert.equal(attr(avif.preload, 'link', 'fetchpriority'), 'high');

    const webp = await framePreload(['1.webp', '1-card.webp', '1-mobile.webp']);
    assert.doesNotMatch(webp.preload, /type=/);
    assert.equal(attr(webp.preload, 'link', 'imagesrcset'), attr(webp.frame, 'img', 'srcset'));
    assert.equal(attr(webp.preload, 'link', 'imagesizes'), attr(webp.frame, 'img', 'sizes'));

    assert.equal((await framePreload(['1.webp'])).preload, '', 'no card, no candidates, no preload');
});
