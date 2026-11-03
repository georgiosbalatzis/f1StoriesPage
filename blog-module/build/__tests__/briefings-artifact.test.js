const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { writeBriefingPages } = require('../briefings/pages');
const { briefingsAsideHtml } = require('../briefings/render');
const { previewCandidates, stripScripts, containedFile } = require('../briefings/preview');
const { candidate } = require('../briefings/export-cli');

test('briefing pages remove withdrawn output and empty aside stays empty', t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'briefing-pages-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const stale = path.join(root, 'briefing/2026-w01/index.html');
    fs.mkdirSync(path.dirname(stale), { recursive: true });
    fs.writeFileSync(stale, 'stale');
    writeBriefingPages(root, [], '<html></html>');
    assert.equal(fs.existsSync(stale), false);
    assert.equal(briefingsAsideHtml([]), '');
});

test('preview and export reject blocked or retired editions', () => {
    const pending = { edition: { id: '2026-w01', status: 'draft' }, eligible: false, reasons: [{ code: 'approval' }] };
    assert.equal(candidate([pending], '2026-w01'), pending);
    assert.deepEqual(previewCandidates([pending]), [pending]);
    assert.throws(() => candidate([{ ...pending, edition: { ...pending.edition, status: 'retired' } }], '2026-w01'));
    assert.throws(() => previewCandidates([{ ...pending, reasons: [{ code: 'member', detail: 'missing' }] }]));
    assert.equal(stripScripts('<script src="/cookie-consent.js"></script><script src="/nav.js"></script>'), '<script src="/nav.js"></script>');
});

test('preview containment follows symlinks', t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'briefing-contained-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.writeFileSync(path.join(root, 'ok.txt'), 'ok');
    fs.symlinkSync(os.tmpdir(), path.join(root, 'outside'));
    assert.equal(containedFile(root, '/ok.txt'), fs.realpathSync(path.join(root, 'ok.txt')));
    assert.equal(containedFile(root, '/outside/anything'), null);
});

test('artifact validator checks files, order, sitemap, members and leaks', async t => {
    const { validateBriefings } = await import('../../../scripts/build/validate-public-artifact.mjs');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'briefing-artifact-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const origin = 'https://f1-stories.gr', prefix = 'blog-module/blog/briefing/';
    const article = id => `${origin}/blog-module/blog-entries/${id}/article.html`;
    const url = `${origin}/${prefix}2026-w01/`;
    const posts = ['a', 'b'].map(id => ({ id, date: '2026-01-01' }));
    const digest = 'a'.repeat(64);
    const selected = [{ edition: { id: '2026-w01', review: { contentSha256: digest } }, posts, eligible: true }];
    const approvedFiles = new Set([prefix + 'index.html', prefix + '2026-w01/index.html']);
    const options = { distRoot: root, selected, approvedFiles, sitemapUrls: new Set([`${origin}/${prefix}`, url]), today: '2026-11-03' };
    const write = (file, data) => { const dest = path.join(root, file); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, data); };
    const page = (canonical, links) => `<link rel="canonical" href="${canonical}"><ol>${links.map(link => `<li><a href="${link}">x</a></li>`).join('')}</ol><script type="application/ld+json">${JSON.stringify({ '@type': 'ItemList', itemListElement: links.map((link, i) => ({ position: i + 1, url: link })) })}</script>`;
    write('blog-module/blog-index-data.json', JSON.stringify({ p: posts.map(post => [post.id, '', '', post.date]) }));
    posts.forEach(post => write(`blog-module/blog-entries/${post.id}/article.html`, `<link rel="canonical" href="${article(post.id)}">`));
    write(prefix + 'index.html', page(`${origin}/${prefix}`, [url]));
    write(prefix + '2026-w01/index.html', page(url, posts.map(post => article(post.id))));
    const run = overrides => { const errors = []; validateBriefings(errors, { ...options, ...overrides }); return errors.join('\n'); };
    assert.equal(run(), '');
    write(prefix + 'extra/index.html', 'extra');
    write(prefix + '2026-w01/index.html', page(url, posts.slice().reverse().map(post => article(post.id))) + digest);
    assert.match(run({ sitemapUrls: new Set() }), /unapproved briefing output/);
    assert.match(run({ sitemapUrls: new Set() }), /sitemap.xml/);
    assert.match(run(), /visible briefing order/);
    assert.match(run(), /ItemList order/);
    assert.match(run(), /editorial data leaked/);
    fs.rmSync(path.join(root, prefix + 'index.html'));
    assert.match(run(), /missing approved briefing/);
    write(`blog-module/blog-entries/a/article.html`, `<link rel="canonical" href="${article('a')}"><meta http-equiv="refresh" content="0">`);
    assert.match(run(), /not a direct published story/);
    write(`blog-module/blog-entries/a/article.html`, `<link rel="canonical" href="${article('a')}"><meta name="robots" content="noindex">`);
    assert.match(run(), /not a direct published story/);
});

test('export and preview directories must resolve outside the repository, TMPDIR included', t => {
    const { assertOutsideRepository, freshDirectory } = require('../briefings/export-cli');
    const repo = fs.realpathSync(path.resolve(__dirname, '../../..'));
    assert.throws(() => assertOutsideRepository(path.join(repo, 'blog-module')), /outside the repository/);
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'briefing-out-'));
    t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
    assert.equal(assertOutsideRepository(outside), fs.realpathSync(outside));
    const link = path.join(outside, 'to-repo');
    fs.symlinkSync(path.join(repo, 'blog-module'), link);
    assert.throws(() => assertOutsideRepository(link), /outside the repository/);
    const saved = process.env.TMPDIR;
    t.after(() => { if (saved === undefined) delete process.env.TMPDIR; else process.env.TMPDIR = saved; });
    for (const tmp of [path.join(repo, 'blog-module'), link]) {
        process.env.TMPDIR = tmp;
        assert.throws(() => freshDirectory('briefing-test-'), /outside the repository/);
    }
    process.env.TMPDIR = outside;
    const fresh = freshDirectory('briefing-test-');
    assert.ok(fresh.startsWith(outside));
});

test('publication day: build:blog records it, later stages reuse it across Athens midnight', t => {
    const model = require('../briefings/model');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'briefing-day-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const file = path.join(dir, '.build/briefings/publication-day');
    assert.equal(model.publicationDay(file), require('../../taxonomy').athensDay()); // absent → today
    model.recordPublicationDay('2026-11-01', file);
    assert.equal(model.publicationDay(file), '2026-11-01');
    assert.throws(() => model.recordPublicationDay('2026-13-01', file));
    fs.writeFileSync(file, 'garbage\n');
    assert.equal(model.publicationDay(file), require('../../taxonomy').athensDay()); // invalid → today
    // A w44 edition approved on Monday 2026-11-02: generated on Sunday's day it is withheld, so the allowlist computed
    // with the recorded Sunday day (not the wall clock after midnight) must also be empty, and vice versa.
    const articles = [{ id: 'a', date: '2026-10-26' }, { id: 'b', date: '2026-10-27' }];
    const edition = { id: '2026-w44', status: 'published', title: 'Τ', description: 'Π', opening: ['Α'],
        sections: [{ heading: 'Ε', items: [{ articleId: 'a', rationale: 'Λ' }, { articleId: 'b', rationale: 'Λ' }] }],
        revised: '2026-11-01', review: { status: 'approved', kind: 'human', by: 'SYNTHETIC TEST', date: '2026-11-02', contentSha256: '' } };
    edition.review.contentSha256 = model.contentDigest(edition);
    const inputs = { manifest: { version: 1, editions: [edition] }, articles };
    const files = day => [...model.publicBriefingFiles(inputs, { today: day, isPublic: () => true, retired: [] })];
    model.recordPublicationDay('2026-11-01', file);
    assert.deepEqual(files(model.publicationDay(file)), []);
    model.recordPublicationDay('2026-11-02', file);
    assert.deepEqual(files(model.publicationDay(file)), ['blog-module/blog/briefing/index.html', 'blog-module/blog/briefing/2026-w44/index.html']);
});
