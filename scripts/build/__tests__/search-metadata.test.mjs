import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateSearchMetadata } from '../validate-public-artifact.mjs';

const ARTICLE = 'blog-module/blog-entries/20260115G/article.html';
const URL = `https://f1-stories.gr/${ARTICLE}`;

function articleHead({ type = 'NewsArticle', section = 'News', published = '2026-01-15T09:40:00+02:00', modified = published,
    publishedTime = published, modifiedTime = '', robots = 'max-image-preview:large', extra = '', ld } = {}) {
    const data = ld ?? JSON.stringify({ '@context': 'https://schema.org', '@type': type, headline: 'Δοκιμή', articleSection: [section],
        datePublished: published, dateModified: modified, publisher: { '@type': 'Organization', '@id': 'https://f1-stories.gr/#organization' },
        mainEntityOfPage: { '@type': 'WebPage', '@id': URL } });
    return `<html><head><meta name="robots" content="${robots}"><meta property="og:locale" content="el_GR"><meta property="og:site_name" content="F1 Stories">
        <meta property="og:url" content="${URL}"><meta property="og:type" content="article"><meta property="article:published_time" content="${publishedTime}">`
        + `${modifiedTime ? `<meta property="article:modified_time" content="${modifiedTime}">` : ''}<meta property="article:section" content="${section}">${extra}
        <link rel="canonical" href="${URL}"><script type="application/ld+json">${data}</script></head><body></body></html>`;
}

const check = (html, relPath = ARTICLE) => {
    const errors = [];
    validateSearchMetadata(errors, html, relPath);
    return errors;
};

test('a consistent article, a date-only legacy article and a public page pass', () => {
    assert.deepEqual(check(articleHead()), []);
    assert.deepEqual(check(articleHead({ type: 'Article', section: 'History', published: '2025-04-10' })), []);
    assert.deepEqual(check(articleHead({ modified: '2026-01-16T10:00:00+02:00', modifiedTime: '2026-01-16T10:00:00+02:00' })), []);
    const page = '<head><meta name="robots" content="max-image-preview:large"><meta property="og:locale" content="el_GR"><meta property="og:site_name" content="F1 Stories"><link rel="canonical" href="https://f1-stories.gr/"></head>';
    assert.deepEqual(check(page, 'index.html'), []);
});

test('malformed, wrongly offset and backwards dates are rejected', () => {
    assert.match(check(articleHead({ published: '2026-01-15 09:40', publishedTime: '2026-01-15 09:40' })).join(), /datePublished .* is not a calendar date/);
    assert.match(check(articleHead({ published: '2026-07-12T18:05:00+02:00', publishedTime: '2026-07-12T18:05:00+02:00' })).join(), /datePublished/);
    assert.match(check(articleHead({ modified: '2026-01-15T08:00:00+02:00' })).join(), /dateModified precedes datePublished/);
});

test('contradictory metadata between JSON-LD and Open Graph is rejected', () => {
    assert.match(check(articleHead({ publishedTime: '2026-01-14' })).join(), /article:published_time must equal datePublished/);
    assert.match(check(articleHead({ modified: '2026-01-16', modifiedTime: '2026-01-17' })).join(), /article:modified_time must equal dateModified/);
    assert.match(check(articleHead({ type: 'NewsArticle', section: 'History' })).join(), /NewsArticle requires the News primary section/);
});

test('duplicate Open Graph fields and extra robots tags are rejected', () => {
    assert.match(check(articleHead({ extra: '<meta property="og:site_name" content="F1 Stories">' })).join(), /duplicate Open Graph properties og:site_name/);
    assert.match(check(articleHead({ extra: '<meta name="robots" content="noindex">' })).join(), /at most one robots meta tag/);
    assert.match(check(articleHead({ robots: 'max-image-preview:standard' })).join(), /must be "max-image-preview:large"/);
});

test('restricted pages must keep noindex and are not given the public policy', () => {
    assert.deepEqual(check('<head><meta name="robots" content="noindex, nofollow"></head>', 'generate.html'), []);
    assert.match(check('<head><meta name="robots" content="max-image-preview:large"></head>', 'housekeeping.html').join(), /lost its noindex/);
});

test('an article without exactly one Article block, or with a foreign publisher, is rejected', () => {
    const ld = JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList' });
    assert.match(check(articleHead({ ld })).join(), /exactly one Article or NewsArticle/);
    const foreign = JSON.stringify({ '@type': 'Article', articleSection: ['News'], datePublished: '2026-01-15', dateModified: '2026-01-15', publisher: { name: 'Other' } });
    assert.match(check(articleHead({ ld: foreign, type: 'Article', published: '2026-01-15' })).join(), /publisher must reference/);
});
