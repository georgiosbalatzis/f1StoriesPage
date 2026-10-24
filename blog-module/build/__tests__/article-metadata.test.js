const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { articleDates } = require('../article-dates');
const { renderArticleHtml } = require('../article-render');

const dates = input => articleDates({ id: 'x', ...input });

test('editor timestamps keep the offset Athens really had: +03:00 in summer, +02:00 in winter, UTC converted', () => {
    assert.equal(dates({ dateISO: '2026-07-12', publishedAtISO: '2026-07-12T18:05:00+03:00' }).published.iso, '2026-07-12T18:05:00+03:00');
    assert.equal(dates({ dateISO: '2026-01-15', publishedAtISO: '2026-01-15T09:40+02:00' }).published.iso, '2026-01-15T09:40:00+02:00');
    assert.equal(dates({ dateISO: '2026-10-24', publishedAtISO: '2026-10-24T07:30:00Z' }).published.iso, '2026-10-24T10:30:00+03:00');
    assert.equal(dates({ dateISO: '2026-01-15', publishedAtISO: '2026-01-15T07:40:00+00:00' }).published.iso, '2026-01-15T09:40:00+02:00');
});

test('daylight-saving edges: the skipped spring hour is rejected, both repeated autumn instants are kept apart', () => {
    assert.throws(() => dates({ dateISO: '2026-03-29', publishedAtISO: '2026-03-29T03:30:00+02:00' }), /Athens was at UTC\+03:00/);
    const first = dates({ dateISO: '2026-10-25', publishedAtISO: '2026-10-25T03:30:00+03:00' }).published;
    const second = dates({ dateISO: '2026-10-25', publishedAtISO: '2026-10-25T03:30:00+02:00' }).published;
    assert.equal(first.iso, '2026-10-25T03:30:00+03:00');
    assert.equal(second.iso, '2026-10-25T03:30:00+02:00');
    assert.equal(second.ms - first.ms, 3600 * 1000);
    assert.throws(() => dates({ dateISO: '2026-07-12', publishedAtISO: '2026-07-12T18:05:00+02:00' }), /UTC\+02:00, but Athens was at UTC\+03:00/);
});

test('date-only history stays date-only; no update is claimed when none was recorded', () => {
    const legacy = dates({ dateISO: '2025-04-10' });
    assert.deepEqual(legacy.published, { iso: '2025-04-10', day: '2025-04-10' });
    assert.equal(legacy.modified, null);
    assert.equal(dates({ dateISO: '2025-04-10', updatedDateISO: '2025-05-01' }).modified.iso, '2025-05-01');
});

test('malformed, impossible and contradictory dates fail with a reason', () => {
    for (const bad of ['2026-07-12 18:05', '2026-07-12T18:05+0300', '2026-07-12T18:05', 'yesterday', '2026-07-12T24:00:00+03:00']) {
        assert.throws(() => dates({ dateISO: '2026-07-12', publishedAtISO: bad }), /publishedAtISO/, bad);
    }
    assert.throws(() => dates({ dateISO: '2026-02-30' }), /not a real calendar date/);
    assert.throws(() => dates({ dateISO: '2026-02-28', publishedAtISO: '2026-02-30T10:00:00+02:00' }), /not a real calendar date/);
    assert.throws(() => dates({ dateISO: '2026-07-12', publishedAtISO: '2026-07-13T00:30:00+03:00' }), /falls on 2026-07-13 in Athens/);
    assert.throws(() => dates({ dateISO: '2026-07-12', publishedAtISO: '2026-07-12T18:05:00+03:00', updatedDateISO: '2026-07-12T17:00:00+03:00' }), /precedes/);
    assert.throws(() => dates({ dateISO: '2026-07-12', updatedDateISO: '2026-07-11' }), /precedes/);
    assert.throws(() => dates({ dateISO: '2026-07-12', updatedDateISO: '2026-07-32' }), /updatedDateISO/);
});

test('the result does not depend on the machine time zone', () => {
    const script = `const { articleDates } = require(${JSON.stringify(path.join(__dirname, '..', 'article-dates.js'))});
        process.stdout.write(JSON.stringify(['2026-03-29T05:00:00+03:00', '2026-10-25T03:30:00+02:00', '2026-01-15T07:40:00Z']
            .map(publishedAtISO => articleDates({ id: 'x', dateISO: publishedAtISO.slice(0, 10), publishedAtISO }).published.iso)));`;
    const outputs = ['UTC', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Asia/Kolkata'].map(TZ =>
        execFileSync(process.execPath, ['-e', script], { env: { ...process.env, TZ }, encoding: 'utf8' }));
    assert.deepEqual(new Set(outputs).size, 1);
    assert.deepEqual(JSON.parse(outputs[0]), ['2026-03-29T05:00:00+03:00', '2026-10-25T03:30:00+02:00', '2026-01-15T09:40:00+02:00']);
});

function post(overrides = {}) {
    return {
        id: '20260115G', title: 'Δοκιμή', author: 'Georgios Balatzis', date: '2026-01-15', dateISO: '2026-01-15', displayDate: '15 Ιανουαρίου 2026',
        category: 'News', categories: ['News'], excerpt: 'Περίληψη', image: '/blog-module/images/default-blog.jpg',
        backgroundImage: '/blog-module/images/default-blog.jpg', sources: '', comments: 0, content: '<p>Κείμενο.</p>', ...overrides
    };
}

// Renders a real article from the shared template; `source` becomes the entry's front-matter document.
async function render(overrides, source) {
    const entryPath = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-metadata-'));
    try {
        if (source !== undefined) fs.writeFileSync(path.join(entryPath, 'source.txt'), source);
        return await renderArticleHtml(post(overrides), entryPath, '20260115G');
    } finally {
        fs.rmSync(entryPath, { recursive: true, force: true });
    }
}

const head = html => html.slice(0, html.indexOf('</head>'));
const meta = (html, name) => [...head(html).matchAll(new RegExp(`<meta property="${name}" content="([^"]*)">`, 'g'))].map(match => match[1]);
const articleLd = html => [...head(html).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map(match => JSON.parse(match[1])).filter(data => /Article$/.test(data['@type']));
const frontMatter = fields => `---\n${Object.entries(fields).map(([key, value]) => `${key}: ${value}`).join('\n')}\n---\n\nΚείμενο.\n`;

test('NewsArticle only for a story an editor filed under News; the no-signal legacy default stays Article', async () => {
    const filed = await render({}, frontMatter({ category: 'News', tags: 'F1', title: 'Δοκιμή' }));
    const defaulted = await render({});
    const technical = await render({ category: 'Technical', categories: ['Technical'] }, frontMatter({ category: 'Technical', tags: 'F1', title: 'Δοκιμή' }));
    assert.equal(articleLd(filed)[0]['@type'], 'NewsArticle');
    assert.equal(articleLd(defaulted)[0]['@type'], 'Article');
    assert.equal(articleLd(technical)[0]['@type'], 'Article');
    for (const html of [filed, defaulted, technical]) {
        const [data] = articleLd(html);
        assert.equal(articleLd(html).length, 1);
        assert.equal(data.publisher['@id'], 'https://f1-stories.gr/#organization');
        assert.deepEqual(meta(html, 'article:section'), [data.articleSection[0]]);
        assert.deepEqual(meta(html, 'og:type'), ['article']);
    }
});

test('a recorded publication instant and update reach JSON-LD, Open Graph and every time element consistently', async () => {
    const html = await render({}, frontMatter({ category: 'News', tags: 'F1', title: 'Δοκιμή',
        publishedAtISO: '2026-01-15T09:40:00+02:00', updatedDateISO: '2026-01-16T08:00:00Z' }));
    const [data] = articleLd(html);
    assert.equal(data.datePublished, '2026-01-15T09:40:00+02:00');
    assert.equal(data.dateModified, '2026-01-16T10:00:00+02:00');
    assert.deepEqual(meta(html, 'article:published_time'), [data.datePublished]);
    assert.deepEqual(meta(html, 'article:modified_time'), [data.dateModified]);
    assert.match(html, /<time class="rr-edition__date" datetime="2026-01-15T09:40:00\+02:00">15\.01\.2026<\/time>/);
    assert.match(html, /Δημοσίευση: <time datetime="2026-01-15T09:40:00\+02:00">15 Ιανουαρίου 2026<\/time>/);
    assert.match(html, /Ενημέρωση: <time datetime="2026-01-16T10:00:00\+02:00">16 Ιανουαρίου 2026<\/time>/);
});

test('without recorded instants the page stays date-only and claims no modification', async () => {
    const html = await render({});
    const [data] = articleLd(html);
    assert.equal(data.datePublished, '2026-01-15');
    assert.equal(data.dateModified, '2026-01-15');
    assert.deepEqual(meta(html, 'article:published_time'), ['2026-01-15']);
    assert.deepEqual(meta(html, 'article:modified_time'), []);
    assert.match(html, /Δεν έχει καταγραφεί νεότερη ενημέρωση\./);
    assert.equal(await render({}), html, 'repeat renders are byte-identical');
});

test('invalid source dates stop the render instead of publishing a wrong instant', async () => {
    await assert.rejects(render({}, frontMatter({ category: 'News', publishedAtISO: '2026-01-15T09:40:00+03:00' })), /Athens was at UTC\+02:00/);
    await assert.rejects(render({}, frontMatter({ category: 'News', updatedDateISO: '2026-01-14' })), /precedes/);
});

test('unsafe title and description characters stay inert in JSON-LD and attributes', async () => {
    const hostile = 'Fast & "loud" </script><script>alert(1)</script> it\'s   «ΕΛ»';
    const html = await render({ title: hostile, excerpt: hostile });
    const [data] = articleLd(html);
    assert.equal(data.headline, hostile);
    assert.equal(data.description, hostile);
    assert.equal((head(html).match(/<script>alert/g) || []).length, 0);
    assert.ok(meta(html, 'og:description')[0].includes('&amp; &quot;loud&quot; &lt;/script&gt;'));
    assert.doesNotMatch(meta(html, 'og:description')[0], /&amp;amp;/);
});

test('new head tags share existing lines, so entity evidence line numbers stay valid', async () => {
    const template = fs.readFileSync(path.join(__dirname, '..', '..', 'blog', 'template.html'), 'utf8');
    const html = await render({}, frontMatter({ category: 'News', publishedAtISO: '2026-01-15T09:40:00+02:00', updatedDateISO: '2026-01-16' }));
    const lines = text => text.slice(0, text.indexOf('</head>')).split('\n').length;
    assert.equal(lines(html), lines(template));
    assert.match(html, /<meta property="og:type" content="article"><meta property="article:published_time"[^\n]*article:section/);
});
