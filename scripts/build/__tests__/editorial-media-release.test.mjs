import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import sharp from 'sharp';

// This bounded register covers the eleven R5/R6 release cases, not archive clearance.
const root = fileURLToPath(new URL('../../../', import.meta.url));
const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/editorial-media-release.json', import.meta.url)));
const media = JSON.parse(fs.readFileSync(path.join(root, 'blog-module/media-metadata.json'))).images;
const posts = JSON.parse(fs.readFileSync(path.join(root, 'blog-module/blog-source-cache.json'))).posts;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const read = rel => fs.readFileSync(path.join(root, rel));
const walk = dir => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]) : [];
const publicFiles = walk(path.join(root, 'dist'));
const publicHashes = new Set(publicFiles.map(file => digest(fs.readFileSync(file))));
const pages = publicFiles.filter(file => file.endsWith('.html')).map(file => ({ file, html: fs.readFileSync(file, 'utf8') }));
const bodyText = html => (/<div class="rr-body article-content" data-body>([\s\S]*?)<section class="rr-pitwall"/.exec(html) || [])[1]
    ?.replace(/<figure\b[\s\S]*?<\/figure>/g, '').replace(/<div class="gallery-carousel"[\s\S]*/, '')
    .replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

test('release media verification requires a normal public build', () => {
    assert.ok(publicFiles.length, 'Run npm run build:public before test:build');
});

for (const item of fixture.cases) {
    test(`${item.id}/${item.slot}: neutral bytes, resolved references, stable article and social destination`, async () => {
        for (const [rel, approved] of Object.entries(item.outputs)) {
            for (const prefix of ['', 'dist/']) {
                // Truthful srcsets omit duplicate-width siblings; unused neutral source variants need not ship.
                if (prefix && !fs.existsSync(path.join(root, prefix + rel))) continue;
                const bytes = read(prefix + rel);
                assert.equal(digest(bytes), approved.sha256, prefix + rel);
                const meta = await sharp(bytes).metadata();
                assert.equal(meta.width, approved.width, rel);
                assert.equal(meta.height, approved.height, rel);
                assert.equal(meta.xmp, undefined, 'neutral artwork must not inherit withdrawn attribution');
            }
        }
        for (const original of item.originals) {
            assert.ok(!publicHashes.has(original.sha256), `withdrawn bytes shipped: ${original.path}`);
            if (original.baselinePublicSha256) assert.ok(!publicHashes.has(original.baselinePublicSha256), `old optimized bytes shipped: ${original.path}`);
        }
        for (const slot of item.slots) {
            const meta = media[`${item.id}/${slot}`];
            assert.equal(meta.type, 'graphic');
            assert.equal(meta.caption, item.caption);
            assert.equal(meta.credit, undefined);
            assert.equal(meta.synthetic, undefined);
            assert.equal(meta.rights, undefined, 'temporary treatment does not clear original rights');
        }
        const article = `blog-module/blog-entries/${item.id}/article.html`;
        const html = read('dist/' + article).toString();
        assert.ok(html.includes(`<link rel="canonical" href="https://f1stories.gr/${article}"`));
        assert.equal(digest(bodyText(html)), item.bodyTextSha256, 'article explanation changed');
        const post = posts.find(p => p.id === item.id);
        for (const [key, value] of Object.entries(item.editorial)) assert.deepEqual(post[key], value, `${item.id}: ${key}`);
        for (const marker of ['property="og:image"', 'name="twitter:image"']) {
            const tag = (html.match(/<meta\b[^>]+>/g) || []).find(tag => tag.includes(marker));
            assert.ok(tag?.includes(`content="${item.social}"`), marker);
        }
        const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1]);
        assert.ok(JSON.stringify(ld).includes(item.social), 'JSON-LD image changed');
        const socialPath = new URL(item.social).pathname;
        assert.ok(fs.existsSync(path.join(root, 'dist', socialPath)), 'social image missing');
        if (Number(item.slot) < 3) assert.ok(Object.hasOwn(item.outputs, socialPath.slice(1)), 'social image must use the neutral family');
        else assert.ok(html.includes(item.caption), 'withheld figure needs its truthful caption');

        let references = 0;
        // Follow just the changed families through article, home, discovery, NEXT UP and gallery markup.
        for (const { file, html: pageHtml } of pages) {
            for (const match of pageHtml.matchAll(/\b(?:src|srcset|href|content|data-full-src|imagesrcset)="([^"]+)"/g)) {
                for (const candidate of match[1].split(',').map(c => c.trim().split(/\s+/)[0])) {
                    if (!candidate) continue;
                    let url;
                    try { url = new URL(candidate, `https://f1stories.gr/${path.relative(path.join(root, 'dist'), file)}`); } catch { continue; }
                    const rel = decodeURIComponent(url.pathname).slice(1);
                    if (!Object.hasOwn(item.outputs, rel)) continue;
                    references++;
                    assert.equal(digest(read('dist/' + rel)), item.outputs[rel].sha256, `${file}: ${candidate}`);
                }
            }
        }
        assert.ok(references > 0, 'neutral family is not referenced');
    });
}

test('approved earlier treatments and uncertain archive assets remain unchanged', () => {
    for (const [rel, expected] of Object.entries(fixture.unchanged)) assert.equal(digest(read(rel)), expected, rel);
});

test('withdrawn bytes are absent from the production image cache', () => {
    const old = new Set(fixture.cases.flatMap(item => item.originals.flatMap(o => [o.sha256, o.baselinePublicSha256]).filter(Boolean)));
    for (const file of walk(path.join(root, '.build/public-images'))) assert.ok(!old.has(digest(fs.readFileSync(file))), file);
});
