const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { XMLParser } = require('fast-xml-parser');
const { formatDate } = require('../../taxonomy');
const { loadFoundation } = require('../entities');
const { TYPES, PAGE_SIZE, selectHubs, renderHub, buildHubPages, writeHubPages, composeHubPage, articleUrl, articleIsPublic, hubSitemap, publicHubFiles } = require('../entities/hubs');
const { renderSitemap } = require('../sitemap');
const ROOT = path.resolve(__dirname, '../../..');
const today = '2026-10-21';
const review = () => ({ status: 'approved', kind: 'human', by: 'fixture-editor', date: '2026-10-20' });
const deps = { storyImage: post => post.image || '', renderStoryImage: (post, image) => `<img src="${image}" alt="" width="400" height="225">` };
const options = { today, readSource: () => '---\n---\nReviewed subject.', isPublic: () => true, deps };
function fixture(type = 'driver', count = 3) {
    const entity = { id: `${type}:fixture`, type, slug: 'fixture', name: 'Fixture', labelEl: 'Ελληνικό όνομα', aliases: [{ value: 'Fixture', scope: 'article-tag' }],
        hub: { review: review(), introduction: { heading: 'Εγκεκριμένος ελληνικός τίτλος', text: 'Ακριβές εγκεκριμένο κείμενο.\n\nΔεύτερη παράγραφος.', review: review() } } };
    const articles = Array.from({ length: count }, (_, i) => ({ id: `fixture${String(i).padStart(3, '0')}`, title: `Πρωτότυπος τίτλος ${i}`, date: `2026-10-${i % 2 ? '02' : '01'}`,
        author: 'Georgios Balatzis', categories: ['Analysis'], tags: [], image: '/images/icons/icon-512.png', excerpt: 'Πρωτότυπο απόσπασμα.' }));
    const associations = articles.map(article => ({ entityId: entity.id, articleId: article.id, role: 'primary', discipline: 'f1', substantive: true, review: review(), tags: [], flags: [],
        evidence: { path: `blog-module/blog-entries/${article.id}/source.txt`, line: 3, quote: 'Reviewed subject.', note: 'Human reviewed F1 subject context.' } }));
    return { registry: { version: 1, entities: [entity] }, manifest: { version: 1, baseline: 'synthetic-only', associations }, articles, entity };
}
const build = (f, opts = {}) => buildHubPages(f.registry, f.manifest, f.articles, { ...options, ...opts });
const schema = page => JSON.parse(page.head.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
const temp = t => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'entity-hubs-test-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true })); return dir; };
const write = (root, rel, text) => { const file = path.join(root, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); return file; };

for (const type of Object.keys(TYPES)) test(`approved ${type} renders native static hub and metadata`, () => {
    const f = fixture(type), result = build(f), page = result.pages[0];
    assert.equal(result.pages.length, 1);
    assert.deepEqual([...publicHubFiles(f, options)], [`blog-module/blog/entities/${TYPES[type]}/fixture/index.html`]);
    assert.equal(page.path, `/blog-module/blog/entities/${TYPES[type]}/fixture/`);
    assert.match(page.head, new RegExp(`<link rel="canonical" href="https://f1-stories.gr${page.path}">`));
    assert.match(page.main, /class="ed-meta breadcrumb"/);
    assert.match(page.main, /3 εγκεκριμένα άρθρα/);
    assert.match(page.main, /ed-lead/);
    assert.match(page.main, /<img /);
    for (const article of f.articles) {
        assert.ok(page.main.includes(article.title));
        assert.ok(page.main.includes(article.excerpt));
        assert.ok(page.main.includes(articleUrl(article)));
        assert.ok(page.main.includes(formatDate(article.date)));
    }
    assert.match(page.main, /Ακριβές εγκεκριμένο κείμενο\./);
    assert.equal(schema(page)['@graph'].find(node => node['@type'] === 'CollectionPage').inLanguage, 'el');
    assert.doesNotMatch(page.head, /SportsEvent|SportsTeam|Person/);
    assert.doesNotMatch(page.main, /<script/);
});

test('publication approval is separate from introduction/count approval and fails closed', () => {
    const f = fixture(); f.entity.hub.review = { status: 'pending' };
    assert.equal(build(f).pages.length, 0);
    f.entity.hub.review = undefined;
    assert.throws(() => build(f), /invalid review/);
    f.entity.hub.review = { status: 'approved', kind: 'agent', by: 'agent', date: today };
    assert.throws(() => build(f), /human reviewer/);
});
test('missing, pending, undated or future introduction/heading approval prevents a page', () => {
    for (const change of [f => delete f.entity.hub.introduction, f => f.entity.hub.introduction.review = { status: 'pending' },
        f => delete f.entity.hub.introduction.heading, f => f.entity.hub.introduction.review.date = '2026-10-22']) {
        const f = fixture(); change(f); assert.equal(build(f).pages.length, 0);
    }
    const f = fixture(); delete f.entity.hub.introduction.review.date; assert.throws(() => build(f), /human reviewer/);
});
test('three substantive subjects and two distinct publication dates are required', () => {
    assert.equal(build(fixture('driver', 2)).pages.length, 0);
    const f = fixture(); f.manifest.associations[0].substantive = false; assert.equal(build(f).pages.length, 0);
    const sameDay = fixture(); sameDay.articles.forEach(post => post.date = '2026-10-01'); assert.equal(build(sameDay).pages.length, 0);
});
test('unpublished/future/invalid-date and missing public source articles do not count', () => {
    for (const metadata of [{ draft: true }, { draft: 'true' }, { published: false }, { published: 'false' }, { status: 'scheduled' }, { date: '2026-10-22' }, { date: '2026-02-31' }]) {
        const f = fixture(); Object.assign(f.articles[0], metadata); assert.equal(build(f).pages.length, 0);
    }
    assert.equal(build(fixture(), { isPublic: () => false }).pages.length, 0);
});
test('excluded, contextual mentions and pending proposals never count', () => {
    for (const role of ['excluded', 'mention', 'unresolved']) {
        const f = fixture(), item = f.manifest.associations[0]; item.role = role;
        if (role === 'unresolved') { item.review = { status: 'pending' }; item.proposedRole = 'primary'; }
        assert.equal(build(f).pages.length, 0);
    }
});
test('only F1 or explicitly human-reviewed mixed subject context counts', () => {
    for (const discipline of ['wec', 'wrc', 'motogp', 'other', 'unknown']) {
        const f = fixture(); f.manifest.associations[0].discipline = discipline; assert.equal(build(f).pages.length, 0);
    }
    const f = fixture(); f.manifest.associations[0].discipline = 'mixed'; assert.equal(build(f).pages.length, 1);
    f.manifest.associations[0].review.kind = 'agent'; assert.throws(() => build(f), /human reviewer/);
});
test('invalid references, duplicates, stale evidence and invalid registry fail the entire build', () => {
    const f = fixture(); f.manifest.associations[0].entityId = 'driver:unknown'; assert.throws(() => build(f), /unknown entity reference/);
    const g = fixture(); g.manifest.associations[0].articleId = 'unknown'; assert.throws(() => build(g), /unknown article reference/);
    const h = fixture(); h.manifest.associations.push(h.manifest.associations[0]); assert.throws(() => build(h), /duplicate/);
    assert.throws(() => build(fixture(), { readSource: () => 'changed' }), /no longer matches/);
    const i = fixture(); i.entity.slug = '../../elsewhere'; assert.throws(() => build(i), /invalid slug/);
});
test('ordering is deterministic newest-first with stable ID ties independent of input order', () => {
    const f = fixture('driver', 10), first = build(f);
    assert.deepEqual(first.hubs[0].posts.map(post => post.id), ['fixture001', 'fixture003', 'fixture005', 'fixture007', 'fixture009', 'fixture000', 'fixture002', 'fixture004', 'fixture006', 'fixture008']);
    f.articles.reverse(); f.manifest.associations.reverse(); assert.deepEqual(build(f).pages, first.pages);
});
test('pagination is disjoint, self-canonical, correctly linked and has no empty final page', () => {
    const f = fixture('driver', PAGE_SIZE * 2 + 1), { pages } = build(f);
    assert.equal(pages.length, 3);
    const urls = pages.flatMap(page => schema(page)['@graph'].find(node => node['@type'] === 'ItemList').itemListElement.map(item => item.url));
    assert.equal(urls.length, f.articles.length); assert.equal(new Set(urls).size, urls.length);
    assert.match(pages[1].head, / · Σελίδα 2/); assert.match(pages[1].head, /rel="canonical" href="[^" ]+\/page\/2\/"/);
    assert.match(pages[1].main, /rel="prev"/); assert.match(pages[1].main, /rel="next"/); assert.match(pages[1].main, /aria-current="page"/);
    assert.equal(schema(pages[2])['@graph'].find(node => node['@type'] === 'ItemList').itemListElement[0].position, PAGE_SIZE * 2 + 1);
    assert.equal(build(fixture('team', PAGE_SIZE)).pages.length, 1);
});
test('canonical article URL provenance rejects foreign URLs, queries, and changed article paths', () => {
    const f = fixture(); f.articles[0].url = 'https://elsewhere.test/'; assert.throws(() => build(f), /Invalid original article URL/);
    for (const url of ['/blog-module/blog-entries/other/article.html', '/blog-module/blog-entries/fixture000/article.html?x=1', '/blog-module/blog-entries/fixture000/article.html#part']) {
        assert.throws(() => articleUrl({ ...f.articles[0], url }), /Invalid original article URL/);
    }
});
test('public article check requires matching existing canonical and indexable HTML', t => {
    const dir = temp(t), post = fixture().articles[0];
    assert.equal(articleIsPublic(post, dir), false);
    write(dir, `blog-module/blog-entries/${post.id}/article.html`, `<link rel="canonical" href="${articleUrl(post)}">`);
    assert.equal(articleIsPublic(post, dir), true);
    write(dir, `blog-module/blog-entries/${post.id}/article.html`, `<link rel="canonical" href="${articleUrl(post)}"><meta name="robots" content="noindex">`);
    assert.equal(articleIsPublic(post, dir), false);
    for (const meta of ['<meta content="noindex" name="robots">', '<meta name=robots content=none>', '<meta content="noindex, follow" name="googlebot">']) {
        write(dir, `blog-module/blog-entries/${post.id}/article.html`, `<link href="${articleUrl(post)}" rel="canonical">${meta}`);
        assert.equal(articleIsPublic(post, dir), false);
    }
    write(dir, `blog-module/blog-entries/${post.id}/article.html`, `<link href="${articleUrl(post)}" rel="canonical">`);
    assert.equal(articleIsPublic(post, dir), true);
});
test('breadcrumb schema and CollectionPage describe only collection and existing articles', () => {
    const page = build(fixture()).pages[0], graph = schema(page)['@graph'];
    const crumbs = graph.find(node => node['@type'] === 'BreadcrumbList').itemListElement;
    assert.deepEqual(crumbs.map(item => item.position), [1, 2, 3]);
    assert.deepEqual(crumbs.map(item => item.name), ['Αρχική', 'Άρθρα', 'Ελληνικό όνομα']);
    assert.equal(crumbs[2].item, 'https://f1-stories.gr' + page.path);
    assert.equal(graph.find(node => node['@type'] === 'CollectionPage').mainEntity['@id'], 'https://f1-stories.gr' + page.path + '#articles');
});
test('sitemap only includes approved pages; lastmod reflects content/approval, never build time', () => {
    const f = fixture(), { pages } = build(f);
    assert.equal(pages[0].lastmod, '2026-10-20');
    const xml = renderSitemap([], pages, { today });
    assert.match(xml, /\/entities\/drivers\/fixture\//); assert.match(hubSitemap(pages), /<lastmod>2026-10-20<\/lastmod>/);
    f.entity.hub.introduction.review.date = today;
    assert.equal(build(f).pages[0].lastmod, today);
    f.entity.hub.review = { status: 'pending' };
    assert.doesNotMatch(renderSitemap([], build(f).pages, { today }), /\/entities\//);
});
test('stale cleanup removes only owned route files and preserves unrelated files/directories/symlinks', t => {
    const dir = temp(t), shell = fs.readFileSync(path.join(ROOT, 'blog-module/blog/index.html'), 'utf8');
    write(dir, 'index.html', shell);
    const obsolete = write(dir, 'entities/drivers/old/page/2/index.html', 'obsolete');
    const unrelated = ['entities/readme/index.html', 'entities/drivers/notes.txt', 'entities/drivers/old/keep.txt', 'entities/drivers/old/extra/index.html', 'section/keep/index.html'];
    unrelated.forEach(file => write(dir, file, 'unrelated'));
    fs.mkdirSync(path.join(dir, 'entities/teams/empty'), { recursive: true });
    const outside = temp(t); write(outside, 'fixture/index.html', 'outside');
    fs.symlinkSync(outside, path.join(dir, 'entities/circuits'));
    const pages = build(fixture()).pages;
    writeHubPages(dir, pages); assert.equal(fs.existsSync(obsolete), false);
    unrelated.forEach(file => assert.equal(fs.readFileSync(path.join(dir, file), 'utf8'), 'unrelated'));
    assert.ok(fs.existsSync(path.join(dir, 'entities/teams/empty'))); assert.ok(fs.existsSync(path.join(outside, 'fixture/index.html')));
    const generated = path.join(dir, pages[0].file), before = fs.statSync(generated).mtimeMs;
    writeHubPages(dir, pages); assert.equal(fs.statSync(generated).mtimeMs, before);
    writeHubPages(dir, []); assert.equal(fs.existsSync(generated), false);
    assert.throws(() => writeHubPages(dir, [{ ...pages[0], file: '../../escape.html' }]), /Invalid generated entity path/);
});
test('Greek, special characters and JSON-LD closing scripts round-trip without injecting markup', () => {
    const f = fixture(), value = 'Ελληνικά "νέα" & τ\' αγωνιστικά <script>alert(1)</script>';
    f.entity.hub.introduction.heading = value; f.entity.hub.introduction.text = value; f.articles[0].title = value;
    const page = build(f).pages[0];
    assert.doesNotMatch(page.main, /<script/); assert.match(page.main, /&lt;script&gt;/);
    assert.equal((page.head.match(/<script /g) || []).length, 1);
    assert.equal(schema(page)['@graph'].find(node => node['@type'] === 'ItemList').itemListElement.find(item => item.name === value).name, value);
    const parsed = new XMLParser({ ignoreAttributes: false }).parse(`<head>${page.head.replace(/<(meta|link)([^>]*?)>/g, '<$1$2/>')}</head>`);
    assert.equal(parsed.head.title, value + ' | F1 Stories');
});
test('rendering does not mutate article bodies, metadata, registry or associations', () => {
    const f = fixture(); f.articles.forEach(post => post.content = '<p>Immutable original body.</p>');
    const original = JSON.stringify(f); build(f); assert.equal(JSON.stringify(f), original);
    const real = loadFoundation(), before = JSON.stringify(real);
    assert.equal(buildHubPages(real.registry, real.manifest, real.articles, { today }).pages.length, 0);
    assert.equal(JSON.stringify(real), before); assert.equal(publicHubFiles(undefined, { today }).size, 0);
});
test('Norris local preview uses exact approved text and four articles, no production hub metadata', () => {
    const d = loadFoundation(), hubs = selectHubs(d.registry, d.manifest, d.articles, { today });
    const norris = hubs.find(hub => hub.entity.id === 'driver:lando-norris');
    assert.equal(norris.eligible, false); assert.deepEqual(norris.reasons, ['publication approval pending']);
    assert.deepEqual(norris.posts.map(post => post.id), ['20260927G', '20260824W', '20260822W', '20260725W']);
    const page = renderHub(norris, { deps, origin: 'http://127.0.0.1:4174', preview: true })[0];
    assert.match(page.head, /noindex, nofollow/); assert.match(page.head, /rel="canonical" href="http:\/\/127\.0\.0\.1:4174/);
    assert.doesNotMatch(page.head, /https:\/\/f1-stories\.gr\/blog-module\/blog\/entities/);
    const shell = fs.readFileSync(path.join(ROOT, 'blog-module/blog/index.html'), 'utf8');
    const html = composeHubPage(shell, page);
    assert.doesNotMatch(html, /src="\/blog-module\/(?:taxonomy|blog-index)/);
    assert.match(html, /shared-nav/); assert.match(html, /cookie-consent/);
    for (const paragraph of norris.entity.hub.introduction.text.split('\n\n')) assert.ok(page.main.includes(paragraph));
});

test('membership removal updates lastmod while excluded articles stay out of membership', () => {
    const f = fixture('driver', 4);
    f.manifest.associations[0].role = 'excluded';
    f.manifest.associations[0].review.date = today;
    const { pages, hubs } = build(f);
    assert.equal(hubs[0].posts.length, 3);
    assert.equal(pages[0].lastmod, today);
    assert.ok(!pages[0].main.includes(f.articles[0].title));
});
test('output and cleanup never follow entity-root, type, slug or file symlinks', t => {
    for (const rel of ['entities', 'entities/drivers', 'entities/drivers/fixture', 'entities/drivers/fixture/index.html']) {
        const dir = temp(t), outside = temp(t), page = build(fixture()).pages[0];
        const link = path.join(dir, rel); fs.mkdirSync(path.dirname(link), { recursive: true });
        const fileLink = rel.endsWith('index.html');
        const destination = fileLink ? write(outside, 'index.html', 'outside') : outside;
        fs.symlinkSync(destination, link);
        if (!fileLink) write(outside, 'drivers/old/index.html', 'outside');
        assert.throws(() => writeHubPages(dir, [page], 'shell'), /Refusing symlink/);
        writeHubPages(dir, [], 'shell');
        assert.equal(fs.readFileSync(fileLink ? destination : path.join(outside, 'drivers/old/index.html'), 'utf8'), 'outside');
    }
});

test('a dangling output symlink cannot create an external target', t => {
    const dir = temp(t), outside = temp(t), page = build(fixture()).pages[0];
    const link = path.join(dir, page.file), destination = path.join(outside, 'absent.html');
    fs.mkdirSync(path.dirname(link), { recursive: true });
    fs.symlinkSync(destination, link);
    assert.throws(() => writeHubPages(dir, [page], 'shell'), /Refusing symlink/);
    assert.equal(fs.existsSync(destination), false);
});

function stampingFixture(t) {
    const { spawnSync } = require('node:child_process');
    const dir = temp(t);
    const copy = rel => {
        fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
        fs.copyFileSync(path.join(ROOT, rel), path.join(dir, rel));
    };
    for (const file of ['stamp-html.mjs', 'article-editorial.mjs', 'article-scope.mjs', 'remove-retired-comments.mjs', 'asset-manifest.json']) copy(`scripts/build/${file}`);
    copy('blog-module/build/youtube-facade.js');
    copy('images/icons/sprite.svg');
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/build/asset-manifest.json'), 'utf8'));
    for (const info of Object.values(manifest.files)) if (info.min) copy(info.min);
    return { dir, stamp: () => {
        const result = spawnSync(process.execPath, ['scripts/build/stamp-html.mjs'], { cwd: dir, encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr);
    } };
}

test('all four entity routes use the real stamper without validating transient article evidence', t => {
    const { dir, stamp } = stampingFixture(t);
    const shell = fs.readFileSync(path.join(ROOT, 'blog-module/blog/index.html'), 'utf8');
    const pages = Object.keys(TYPES).flatMap(type => build(fixture(type)).pages);
    for (const page of pages) write(dir, `blog-module/blog/${page.file}`, composeHubPage(shell, page));
    const run = () => {
        stamp();
        return pages.map(page => fs.readFileSync(path.join(dir, 'blog-module/blog', page.file), 'utf8'));
    };
    const first = run();
    first.forEach((html, i) => {
        assert.ok(html.includes('https://f1-stories.gr' + pages[i].path));
        assert.match(html, /<h1 /);
        assert.match(html, /\/styles\/editorial\.min\.css\?v=/);
        assert.doesNotMatch(html, /src="\/blog-module\/blog-index/);
    });
    assert.deepEqual(run(), first, 'entity stamping is idempotent');
});

for (const boundary of ['entities', 'entities/drivers', 'entities/drivers/fixture', 'entities/drivers/fixture/index.html']) {
    test(`entity stamper preserves external HTML through ${boundary} symlinks`, t => {
        const { dir, stamp } = stampingFixture(t), outside = temp(t);
        const route = 'entities/drivers/fixture/index.html';
        const original = '<html><head><link rel="stylesheet" href="/styles/editorial.css"></head><body>External content.</body></html>';
        const fileLink = boundary === route;
        const target = write(outside, fileLink ? 'external.html' : route.slice(boundary.length + 1), original);
        const link = path.join(dir, 'blog-module/blog', boundary);
        fs.mkdirSync(path.dirname(link), { recursive: true });
        fs.symlinkSync(fileLink ? target : outside, link);
        stamp();
        assert.equal(fs.readFileSync(target, 'utf8'), original, 'stamping must not follow an entity symlink');
        assert.ok(fs.lstatSync(link).isSymbolicLink(), 'the original symlink is preserved');
    });
}
