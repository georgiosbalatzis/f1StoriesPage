const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { WORDS_PER_MINUTE, countWords, readingTimeFromWords, wordsInHtml, articleBodyHtml, readingTimeFromPage } = require('../reading-time');
const { renderArticleHtml, refreshArticleTaxonomy } = require('../article-render');

const words = n => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');

test('policy: words / 200 rounded up, never below one minute', () => {
    assert.equal(WORDS_PER_MINUTE, 200);
    for (const [count, expected] of [[0, '1 min'], [1, '1 min'], [200, '1 min'], [201, '2 min'], [399, '2 min'], [400, '2 min'], [401, '3 min'], [4621, '24 min']]) {
        assert.equal(readingTimeFromWords(count), expected, String(count));
    }
});

test('Greek and English text are counted as one word per whitespace-separated token', () => {
    assert.equal(countWords('Ο Λιούις Χάμιλτον οδήγησε τη Ferrari  στο\nSepang'), 8);
    assert.equal(countWords('The Bahrain Grand Prix in Malaysia'), 6);
    assert.equal(countWords('  '), 0);
    assert.equal(countWords('a&nbsp;b &#160; c'), 3, 'non-breaking spaces separate words, as in the browser text content');
    assert.equal(wordsInHtml('<p>Δύο <strong>λέξεις</strong></p>\n<p>τρεις</p>'), 3);
});

test('the article body is found with balanced nested divs; a page without one measures nothing', () => {
    const page = `<div class="x"><div class="article-content">\n<div class="gallery">\n<div>${words(10)}</div>\n</div>\n<p>${words(5)}</p>\n</div>\n<div class="author-card">${words(900)}</div></div>`;
    assert.equal(wordsInHtml(articleBodyHtml(page)), 15, 'the author card after the body is not counted');
    assert.equal(readingTimeFromPage(page), '1 min');
    assert.equal(readingTimeFromPage(`<div class="article-content"><p>${words(1300)}</p></div>`), '7 min');
    assert.equal(readingTimeFromPage('<div class="other"></div>'), '');
});

function post(overrides = {}) {
    return {
        id: '20260101G', title: 'Δοκιμή', author: 'Georgios Balatzis', date: '2026-01-01', dateISO: '2026-01-01', displayDate: '1 Ιανουαρίου 2026',
        category: 'News', categories: ['News'], excerpt: 'x', image: '/blog-module/images/default-blog.jpg', backgroundImage: '/blog-module/images/default-blog.jpg',
        sources: '', comments: 0, ...overrides,
    };
}

async function renderToString(overrides) {
    const entryPath = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-reading-'));
    try {
        await renderArticleHtml(post(overrides), entryPath, '20260101G');
        return fs.readFileSync(path.join(entryPath, 'article.html'), 'utf8');
    } finally { fs.rmSync(entryPath, { recursive: true, force: true }); }
}

const badge = html => (html.match(/<span id="reading-time-value">([^<]*)<\/span>/) || [])[1];

test('a generated page carries the real reading time in its static HTML, for Greek and English bodies', async () => {
    const greek = `<p>${Array.from({ length: 1300 }, () => 'λέξη').join(' ')}</p>`;
    const english = `<p>${Array.from({ length: 210 }, () => 'word').join(' ')}</p>`;
    assert.equal(badge(await renderToString({ content: greek, readingTime: readingTimeFromWords(wordsInHtml(greek)) })), '7 λεπτά ανάγνωσης');
    assert.equal(badge(await renderToString({ content: english, readingTime: readingTimeFromWords(wordsInHtml(english)) })), '2 λεπτά ανάγνωσης');
    assert.equal(badge(await renderToString({ content: '<p>μία</p>', readingTime: '1 min' })), '1 λεπτό ανάγνωσης', 'singular is grammatical, unlike the old client rewrite');
});

test('the badge is never the old hard-coded placeholder, even when a post lacks readingTime', async () => {
    const html = await renderToString({ content: `<p>${words(450)}</p>`, readingTime: undefined });
    assert.equal(badge(html), '3 λεπτά ανάγνωσης');
    assert.doesNotMatch(html, /ARTICLE_READING_TIME/);
});

test('source-less pages are refreshed in place from the stored reading time', () => {
    const page = '<div><span class="reading-time-badge"><span id="reading-time-value">5 λεπτά ανάγνωσης</span></span><div class="article-content"><p>x</p></div></div>';
    assert.equal(badge(refreshArticleTaxonomy(page, post({ readingTime: '16 min' }))), '16 λεπτά ανάγνωσης');
    assert.equal(badge(refreshArticleTaxonomy(page, post({ readingTime: undefined }))), '5 λεπτά ανάγνωσης', 'no data: leave the page as it is');
});
