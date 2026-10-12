// The cover photograph offers its 800px copy beside a 1,600px master, so a phone does not fetch the larger file.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { injectHomepageHero } = require('../index');
const { CONFIG } = require('../shared');

const shell = '<link id="hero-image-preload" rel="preload" as="image" href="/x.avif">'
    + '<picture id="hero-picture"><source id="hero-source-avif" type="image/avif" srcset="/x.avif"><source id="hero-source-webp" type="image/webp" srcset="/x.webp">'
    + '<img id="hero-image" src="/x.webp" width="1" height="1"></picture>';

function render(files, hero) {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-hero-'));
    const original = CONFIG.BLOG_DIR;
    try {
        CONFIG.BLOG_DIR = path.join(temp, 'blog-module', 'blog-entries');
        fs.mkdirSync(path.join(CONFIG.BLOG_DIR, 's1'), { recursive: true });
        for (const name of files) fs.writeFileSync(path.join(CONFIG.BLOG_DIR, 's1', name), '');
        fs.writeFileSync(path.join(temp, 'index.html'), shell);
        injectHomepageHero({ id: 's1', title: 'T', heroImage: '/blog-module/blog-entries/s1/1.webp', heroAvif: '/blog-module/blog-entries/s1/1.avif', ...hero });
        return fs.readFileSync(path.join(temp, 'index.html'), 'utf8');
    } finally {
        CONFIG.BLOG_DIR = original;
        fs.rmSync(temp, { recursive: true, force: true });
    }
}

const all = ['1.webp', '1.avif', '1-card.webp', '1-mobile.webp', '1-mobile.avif'];

test('a wide master is offered with its 800px copy, widest first', () => {
    const html = render(all, { heroImageWidth: 1600, heroImageHeight: 900 });
    assert.match(html, /id="hero-source-avif"[^>]*srcset="\/blog-module\/blog-entries\/s1\/1\.avif 1600w, \/blog-module\/blog-entries\/s1\/1-mobile\.avif 800w"[^>]*sizes=/);
    assert.match(html, /id="hero-image-preload"[^>]*imagesrcset="[^"]*1\.avif 1600w, [^"]*1-mobile\.avif 800w"/);
});

test('a master of 800px or less keeps the single-file delivery', () => {
    const html = render(all, { heroImageWidth: 770, heroImageHeight: 513 });
    assert.match(html, /id="hero-source-avif" type="image\/avif" srcset="\/blog-module\/blog-entries\/s1\/1\.avif">/);
    assert.doesNotMatch(html, /imagesrcset|\sw,|\d+w/);
});

test('missing 800px copies fall back to the single file', () => {
    const html = render(['1.webp', '1.avif'], { heroImageWidth: 1600, heroImageHeight: 900 });
    assert.doesNotMatch(html, /\d+w[,"]/);
});
