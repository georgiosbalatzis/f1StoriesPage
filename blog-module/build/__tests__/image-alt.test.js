const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { renderHomeJournal, renderCoverFrames, renderHomeTech } = require('../index');
const { renderOnAir } = require('../home-panels');
const { mediaFor, applyBodyMedia } = require('../media-meta');
const { escapeHtmlAttribute } = require('../shared');

test.before(() => require('../image-sizes').primeImageDimensions());

const root = path.resolve(__dirname, '../../..');
const story = (id, title = 'Τίτλος άρθρου') => ({
    id, title, categories: ['Opinion'], date: '2026-10-11', author: 'Giannis Poulikidis',
    thumbnail: `/blog-module/blog-entries/${id}/1-card.webp`, url: `/blog-module/blog-entries/${id}/article.html`
});
const images = html => [...html.matchAll(/<img\b[^>]*>/g)].map(match => match[0]);

test('standalone editorial figures use verified descriptions; only alt changes in their markup', () => {
    const record = mediaFor('20261011J', '1');
    const original = record.alt;
    const render = () => renderHomeJournal({ voices: [story('20261011J')] });
    try {
        record.alt = '';
        const decorative = render();
        record.alt = 'Σύνθεση «Ferrari» με "Hamilton" & <Vasseur>.';
        const informative = render();
        assert.ok(informative.includes(`alt="${escapeHtmlAttribute(record.alt)}"`));
        assert.equal(informative.replace(/\balt="[^"]*"/g, 'alt=""'), decorative);
        assert.ok(images(informative).some(tag => /avatars\//.test(tag) && /alt=""/.test(tag)), 'named author portraits stay empty');
    } finally {
        record.alt = original;
    }
});

test('headline links and duplicate technical previews retain empty alt, even with recorded descriptions', () => {
    const frames = renderCoverFrames([story('20261011J')]);
    assert.ok(images(frames).every(tag => /\salt=""/.test(tag)));
    assert.match(frames, />Τίτλος άρθρου<\/span><\/a>/);
    const tech = renderHomeTech(story('20261015G'), 'Περιγραφή ανάλυσης', '', '');
    assert.match(tech, /class="tech-photo__media"[^>]*tabindex="-1" aria-hidden="true"><img[^>]*alt=""/);
    assert.match(tech, /<h2[^>]*><a[^>]+>Τίτλος άρθρου<\/a>/);
});

test('Cast article image links keep their Greek action name and do not repeat it in alt', () => {
    const article = { ...story('20261010J', 'BetCast #276: Singapore GP'), image: '/blog-module/blog-entries/20261010J/1.webp' };
    const articleHtml = renderOnAir([article]);
    assert.match(articleHtml, /aria-label="Διαβάστε: BetCast #276: Singapore GP"/);
    assert.ok(images(articleHtml).every(tag => /\salt=""/.test(tag)));

});

test('gallery photographs have distinct descriptions and repeated metadata application is stable', () => {
    const body = [3, 4].map(slot => `<div class="gallery-slide"><img src="${slot}.webp" alt="Τίτλος: φωτογραφία ${slot}" class="article-content-img"></div>`).join('');
    const rendered = applyBodyMedia(body, '20261020W');
    for (const slot of [3, 4]) assert.ok(rendered.includes(`alt="${mediaFor('20261020W', slot).alt}"`));
    assert.notEqual(mediaFor('20261020W', 3).alt, mediaFor('20261020W', 4).alt);
    assert.doesNotMatch(rendered, /Τίτλος: φωτογραφία/);
    assert.equal(applyBodyMedia(rendered, '20261020W'), rendered);
});

test('published homepage, article, category and archive samples always declare alt; article descriptions use metadata', () => {
    const files = ['index.html', 'blog-module/blog/section/technical/index.html', 'blog-module/blog/archive/2026/10/index.html'];
    for (const [id, slot] of [['20261020W', 2], ['20261015G', 1], ['20261011J', 1]]) {
        const file = `blog-module/blog-entries/${id}/article.html`;
        files.push(file);
        const html = fs.readFileSync(path.join(root, file), 'utf8');
        const cover = images(html).find(tag => /class="article-header-img"/.test(tag));
        assert.ok(cover.includes(`alt="${escapeHtmlAttribute(mediaFor(id, slot).alt)}"`), file);
    }
    for (const file of files) {
        const tags = images(fs.readFileSync(path.join(root, file), 'utf8'));
        assert.ok(tags.length > 0, file);
        for (const tag of tags) assert.match(tag, /\salt="[^"]*"/, `${file}: ${tag}`);
    }
});
