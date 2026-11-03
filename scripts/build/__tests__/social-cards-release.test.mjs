import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import sharp from 'sharp';
import * as socialCards from '../social-cards.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const dist = path.join(root, 'dist');
const origin = 'https://f1-stories.gr/';
const reasons = new Set(['source-missing', 'source-invalid', 'source-unreadable', 'source-decode']);
const normalizeLogo = html => html.replaceAll('https://f1-stories.gr/images/logo.png', 'https://f1-stories.gr/images/icons/icon-512.png');
const jsonLd = html => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match => match[1]);

function metaValues(html, attribute, name) {
    return [...html.matchAll(/<meta\b[^>]*>/gi)].filter(([tag]) => {
        return new RegExp(`\\b${attribute}=["']${name}["']`, 'i').test(tag);
    }).map(([tag]) => /\bcontent=["']([^"']*)["']/i.exec(tag)?.[1]);
}

async function checkCard(record, html, prefix) {
    assert.match(record.sha256, /^[a-f0-9]{64}$/);
    assert.equal(record.file, `images/social/${prefix}-${record.sha256.slice(0, 20)}.jpg`);
    assert.equal(record.url, origin + record.file);
    for (const [attribute, name, value] of [
        ['property', 'og:image', record.url], ['name', 'twitter:image', record.url],
        ['property', 'og:image:width', '1200'], ['property', 'og:image:height', '630'],
        ['property', 'og:image:type', 'image/jpeg'], ['name', 'twitter:card', 'summary_large_image']
    ]) assert.deepEqual(metaValues(html, attribute, name), [value], `${record.page}: ${name}`);
    const alt = metaValues(html, 'property', 'og:image:alt');
    assert.equal(alt.length, 1, `${record.page}: og:image:alt`);
    assert.ok(alt[0], `${record.page}: empty og:image:alt`);
    const bytes = fs.readFileSync(path.join(dist, record.file));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), record.sha256);
    assert.ok(bytes.length <= 307200, `${record.page}: JPEG exceeds budget`);
    const info = await sharp(bytes).metadata();
    assert.equal(info.format, 'jpeg');
    assert.equal(info.width, 1200);
    assert.equal(info.height, 630);
}

test('Pages artifact ships a current cinematic card for every eligible article', async () => {
    const report = JSON.parse(fs.readFileSync(path.join(root, '.build/public-images/social-cards/report.json')));
    const posts = new Set(JSON.parse(fs.readFileSync(path.join(root, 'blog-module/blog-source-cache.json'))).posts.map(post => post.id));
    const entries = path.join(dist, 'blog-module/blog-entries');
    const eligible = new Set(fs.readdirSync(entries, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && posts.has(entry.name) && fs.existsSync(path.join(entries, entry.name, 'article.html')))
        .map(entry => `blog-module/blog-entries/${entry.name}/article.html`));
    const articles = report.records.filter(record => record.page !== 'index.html');
    assert.equal(articles.length, eligible.size);
    assert.equal(new Set(articles.map(record => record.page)).size, articles.length, 'duplicate article records');
    assert.deepEqual(new Set(articles.map(record => record.page)), eligible);
    assert.ok(socialCards.rendererKey, 'rendererKey must be exported');
    assert.equal(report.eligible, eligible.size);
    assert.equal(report.cards, eligible.size);
    assert.deepEqual(report.failures, []);
    assert.equal(report.legacyTemplate, 0);
    assert.equal(report.missingFiles, 0);
    assert.equal(report.cacheHits, articles.filter(record => record.cacheHit).length);
    assert.equal(report.truncated, articles.filter(record => record.truncated).length);
    assert.equal(report.overBudget, 0);
    assert.equal(report.metadataFailures, 0);
    assert.deepEqual(report.fallbacks, articles.filter(record => record.fallback).map(({ page, fallback }) => ({ page, reason: fallback })));

    for (const record of articles) {
        assert.equal(record.template, 'cinematic-v1', record.page);
        assert.equal(record.rendererKey, socialCards.rendererKey, record.page);
        assert.ok(!record.error, `${record.page}: ${record.error}`);
        if (record.fallback) assert.ok(reasons.has(record.fallback), `${record.page}: unknown fallback`);
        const html = fs.readFileSync(path.join(dist, record.page), 'utf8');
        const source = normalizeLogo(fs.readFileSync(path.join(root, record.page), 'utf8'));
        assert.deepEqual(jsonLd(html), jsonLd(source), `${record.page}: JSON-LD changed`);
        assert.ok(/<body\b/i.test(html) && /<body\b/i.test(source), `${record.page}: missing body`);
        // Bodies are rewritten by the artifact pipeline itself (sprite, image descriptors); social cards touch only <head>
        // (socialMetadata unit test) and body identity against the previous renderer is a base-vs-candidate dist check.
        assert.doesNotMatch(html.slice(html.search(/<body\b/i)), /images\/social\//);
        assert.doesNotMatch(html, /<link\b[^>]+(?:href|imagesrcset)=["'][^"']*images\/social\//i);
        await checkCard(record, html, 'article');
    }

    const homes = report.records.filter(record => record.page === 'index.html');
    assert.equal(homes.length, 1);
    const home = homes[0];
    const homeHtml = fs.readFileSync(path.join(dist, home.page), 'utf8');
    if (home.error) {
        assert.deepEqual(metaValues(homeHtml, 'property', 'og:image'), [origin + 'images/icons/icon-512.png']);
        assert.deepEqual(metaValues(homeHtml, 'name', 'twitter:image'), [origin + 'images/icons/icon-512.png']);
        assert.ok(fs.existsSync(path.join(dist, 'images/icons/icon-512.png')));
    } else {
        await checkCard(home, homeHtml, 'home');
    }
    assert.doesNotMatch(homeHtml.slice(homeHtml.search(/<body\b/i)), /images\/social\//);
    assert.doesNotMatch(homeHtml, /<link\b[^>]+(?:href|imagesrcset)=["'][^"']*images\/social\//i);
    assert.deepEqual(jsonLd(homeHtml), jsonLd(normalizeLogo(fs.readFileSync(path.join(root, home.page), 'utf8'))));
});
