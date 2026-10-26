const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { XMLParser, XMLValidator } = require('fast-xml-parser');
const { isDay } = require('../../taxonomy');
const { formatSitemapDate, legalLastmod, renderSitemap } = require('../sitemap');

const origin = 'https://f1-stories.gr';
const blog = '/blog-module/blog/index.html';
const today = '2026-10-21';
const post = (id, date, extra = {}) => ({ id, date, ...extra });
function entries(xml) {
    assert.equal(XMLValidator.validate(xml), true);
    const parsed = new XMLParser({ ignoreAttributes: false }).parse(xml).urlset;
    assert.equal(parsed['@_xmlns'], 'http://www.sitemaps.org/schemas/sitemap/0.9');
    return parsed.url;
}
const dates = xml => Object.fromEntries(entries(xml).map(entry => [new URL(entry.loc).pathname, entry.lastmod]));

test('sitemap dates accept real calendar days and timezone-qualified timestamps only', () => {
    for (const value of [undefined, '', 'bad', '2026-02-30', '2026-02-30T12:00:00Z',
        '2026-13-01', '10/21/2026', '2026-10-21T12:00:00', 123]) {
        assert.equal(formatSitemapDate(value), '', String(value));
    }
    assert.equal(formatSitemapDate('2024-02-29'), '2024-02-29');
    assert.equal(formatSitemapDate('2026-10-20T23:30:00-03:00'), '2026-10-21');
});

test('listing dates use the newest published day, independent of input order or build metadata', () => {
    const posts = [post('old', '2026-10-01'), post('new', '2026-10-20'), post('middle', '2026-10-10'),
        post('invalid', '2026-02-30'), post('future', '2026-10-22'),
        ...[true, 'true'].map(draft => post(`draft-${draft}`, today, { draft })),
        ...[false, 'false'].map(published => post(`hidden-${published}`, today, { published })),
        ...['draft', 'unpublished', 'scheduled'].map(status => post(status, today, { status }))];
    const result = dates(renderSitemap(posts, [], { today }));
    assert.equal(result['/'], '2026-10-20');
    assert.equal(result[blog], '2026-10-20');
    assert.equal(result['/standings/'], undefined);
    assert.equal(result['/authors/'], undefined);
    for (const entry of entries(renderSitemap(posts, [], { today }))) {
        if (entry.lastmod) assert.ok(isDay(entry.lastmod));
    }
    const empty = dates(renderSitemap([], [], { today }));
    assert.equal(empty['/'], undefined);
    assert.equal(empty[blog], undefined);
});

test('adding listing dates preserves Edition and article entries, URL order and legacy hints', () => {
    const edition = [
        { file: 'section/news/index.html', path: '/blog-module/blog/section/news/', lastmod: '2026-10-18', changefreq: 'weekly', priority: '0.7' }
    ];
    const xml = renderSitemap([post('stable', '2026-10-20')], edition, { today });
    const urls = entries(xml);
    assert.equal(urls.filter(entry => entry.loc === origin + blog).length, 1);
    assert.equal(dates(xml)[blog], '2026-10-20');
    assert.deepEqual(urls.map(entry => entry.loc), [origin + '/', origin + blog,
        origin + edition[0].path, origin + '/standings/', origin + '/authors/',
        origin + '/privacy/privacy.html', origin + '/privacy/terms.html',
        origin + '/blog-module/blog-entries/stable/article.html']);
    assert.equal(urls[2].lastmod, '2026-10-18');
    assert.equal(urls[2].changefreq, 'weekly');
    assert.equal(urls[2].priority, 0.7);
    assert.equal(urls.at(-1).lastmod, '2026-10-20');
});

test('article locs percent-encode the folder id once and keep the path structure', () => {
    const ids = ['20261020W', '20261020-2W', '20250505GF', '20260227Τ', '2026%CE'];
    const urls = entries(renderSitemap(ids.map(id => post(id, '2026-10-20')), [], { today }))
        .filter(entry => entry.loc.includes('/blog-entries/'));
    const at = segment => `${origin}/blog-module/blog-entries/${segment}/article.html`;
    // A literal % in a folder name is encoded too, never read as an existing escape.
    assert.deepEqual(urls.map(entry => entry.loc),
        [at('20261020W'), at('20261020-2W'), at('20250505GF'), at('20260227%CE%A4'), at('2026%25CE')]);
    urls.forEach((entry, index) => {
        const segments = new URL(entry.loc).pathname.split('/');
        assert.deepEqual(segments.filter((_, i) => i !== 3), ['', 'blog-module', 'blog-entries', 'article.html']);
        assert.equal(decodeURIComponent(segments[3]), ids[index]);
        assert.equal(entry.lastmod, '2026-10-20');
    });
});

test('repeated and later unchanged builds are identical; publication updates only relevant entries', () => {
    const posts = [post('old', '2026-10-20')];
    const before = renderSitemap(posts, [], { today });
    assert.equal(renderSitemap(posts, [], { today }), before);
    assert.equal(renderSitemap(posts.map(p => ({ ...p, lastUpdated: '2026-10-23T12:00:00Z' })), [], { today: '2026-10-23' }), before);
    const after = renderSitemap([post('new', today), ...posts], [], { today });
    const beforeEntries = entries(before);
    const afterEntries = entries(after);
    assert.equal(dates(after)['/'], today);
    assert.equal(dates(after)[blog], today);
    assert.deepEqual(afterEntries.slice(2).filter(entry => !entry.loc.includes('/new/')), beforeEntries.slice(2));
});

test('legal dates come only from explicit source metadata and react to recorded content updates', t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'f1-sitemap-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const file = path.join(dir, 'privacy.html');
    const write = day => fs.writeFileSync(file, `<p class="legal-meta">Τελευταία ενημέρωση: <time datetime="${day}">Ημερομηνία</time></p>`);
    const render = () => renderSitemap([], [], { today, legalDates: { 'privacy.html': legalLastmod(file) } });
    assert.equal(legalLastmod(file), '');
    write('2026-09-09');
    const before = render();
    assert.equal(dates(before)['/privacy/privacy.html'], '2026-09-09');
    fs.utimesSync(file, new Date('2030-01-01'), new Date('2030-01-01'));
    fs.writeFileSync(path.join(dir, 'standings-cache.json'), '{"generatedAt":"2030-01-01T00:00:00Z"}');
    assert.equal(render(), before);
    write('2026-10-21');
    const after = render();
    assert.equal(after.replace('<lastmod>2026-10-21</lastmod>', '<lastmod>2026-09-09</lastmod>'), before);
    write('2026-02-30');
    assert.equal(legalLastmod(file), '');
    fs.writeFileSync(file, '<footer><time datetime="2026-10-21">Build date</time></footer>');
    assert.equal(legalLastmod(file), '');
});

test('generated sitemap XML has unique canonical URLs, existing targets and valid dates', () => {
    const root = path.resolve(__dirname, '../../..');
    const urls = entries(fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8'));
    assert.equal(new Set(urls.map(entry => entry.loc)).size, urls.length);
    for (const entry of urls) {
        const url = new URL(entry.loc);
        assert.equal(url.origin, origin);
        assert.equal(url.search + url.hash, '');
        const file = path.join(root, decodeURIComponent(url.pathname), url.pathname.endsWith('/') ? 'index.html' : '');
        const html = fs.readFileSync(file, 'utf8');
        const canonical = html.match(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/);
        assert.ok(canonical, file);
        assert.equal(canonical[1], entry.loc, file);
        if (entry.lastmod) assert.ok(isDay(entry.lastmod), entry.loc);
    }
    const result = dates(fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8'));
    for (const file of ['privacy.html', 'terms.html']) {
        assert.equal(result[`/privacy/${file}`], legalLastmod(path.join(root, 'privacy', file)));
    }
    assert.ok(result['/']);
    assert.ok(result[blog]);
    assert.equal(result['/standings/'], undefined);
    assert.equal(result['/authors/'], undefined);
});
