import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const dist = path.join(root, 'dist');

test('Pages artifact ships bounded cards or intact image fallbacks without changing hero loading or JSON-LD', async () => {
    const report = JSON.parse(fs.readFileSync(path.join(root, '.build/public-images/social-cards/report.json')));
    const posts = JSON.parse(fs.readFileSync(path.join(root, 'blog-module/blog-source-cache.json'))).posts;
    assert.equal(report.records.length, posts.length + 1);
    for (const record of report.records) {
        const html = fs.readFileSync(path.join(dist, record.page), 'utf8');
        const url = record.error ? (record.page === 'index.html' ? 'https://f1-stories.gr/images/icons/icon-512.png' : record.source) : record.url;
        assert.ok(html.includes(`property="og:image" content="${url}"`));
        assert.ok(html.includes(`name="twitter:image" content="${url}"`));
        assert.doesNotMatch(html.slice(html.indexOf('<body')), /images\/social\//);
        assert.doesNotMatch(html, /<link[^>]+(?:href|imagesrcset)="[^"]*images\/social\//);
        const sourceHtml = fs.readFileSync(path.join(root, record.page), 'utf8');
        assert.deepEqual([...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => m[1]),
            [...sourceHtml.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => m[1].replaceAll('https://f1-stories.gr/images/logo.png', 'https://f1-stories.gr/images/icons/icon-512.png')));
        if (record.error) {
            assert.ok(fs.existsSync(path.join(dist, decodeURIComponent(new URL(url).pathname))), 'fallback asset must ship');
            continue;
        }
        assert.ok(html.includes('property="og:image:width" content="1200"'));
        assert.ok(html.includes('property="og:image:height" content="630"'));
        assert.ok(html.includes('name="twitter:card" content="summary_large_image"'));
        const bytes = fs.readFileSync(path.join(dist, record.file));
        assert.equal(createHash('sha256').update(bytes).digest('hex'), record.sha256);
        assert.ok(bytes.length <= 300 * 1024);
        const metadata = await sharp(bytes).metadata();
        assert.equal(metadata.format, 'jpeg');
        assert.equal(metadata.width, 1200);
        assert.equal(metadata.height, 630);
        if (record.source) {
            const source = fs.readFileSync(path.join(dist, decodeURIComponent(new URL(record.source).pathname)));
            assert.equal(createHash('sha256').update(source).digest('hex'), record.sourceSha256);
        }
    }
});
