const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const T = require('../../taxonomy');
const { renderArticleHtml, refreshArticleTaxonomy } = require('../article-render');
const { route } = require('../discovery');
const { renderAuthorProfile, renderHomeTeam } = require('../authors-page');
const { writeAuthorPages } = require('../author-pages');
const { renderSitemap } = require('../sitemap');
const { analyzeBody, checkBodyLinks, internalPath, summarize } = require('../body-links');
const { articleIsPublic } = require('../entities/hubs');

const SITE = 'https://f1-stories.gr';
const tmp = prefix => fs.mkdtempSync(path.join(os.tmpdir(), prefix));
const write = (root, rel, text) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
};

// ── Category links and breadcrumbs ─────────────────────────────────────────

test('every public category has one static section page; anything else gets no link', () => {
    for (const category of T.PUBLIC_CATEGORIES) {
        assert.equal(T.sectionPath(category), route.section(T.categoryKind(category)));
        assert.match(T.sectionPath(category), /^\/blog-module\/blog\/section\/[a-z]+\/$/);
    }
    assert.equal(new Set(T.PUBLIC_CATEGORIES.map(T.sectionPath)).size, 8);
    for (const unknown of ['Unknown', '', 'news', 'journal', undefined, '__proto__']) assert.equal(T.sectionPath(unknown), '');
});

function post(overrides = {}) {
    return {
        id: '20260115G', title: 'Δοκιμή', author: 'Georgios Balatzis', date: '2026-01-15', dateISO: '2026-01-15', displayDate: '15 Ιανουαρίου 2026',
        category: 'Technical', categories: ['Technical', 'Teams'], excerpt: 'Περίληψη', image: '/blog-module/images/default-blog.jpg',
        backgroundImage: '/blog-module/images/default-blog.jpg', sources: '', comments: 0, content: '<p>Κείμενο.</p>', ...overrides
    };
}

async function render(overrides) {
    const entryPath = tmp('f1s-links-');
    try {
        return await renderArticleHtml(post(overrides), entryPath, '20260115G');
    } finally {
        fs.rmSync(entryPath, { recursive: true, force: true });
    }
}

const ld = (html, type) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map(match => JSON.parse(match[1])).filter(data => data['@type'] === type || (type === 'Article' && /Article$/.test(data['@type'])));
const crumbs = html => /<nav class="rr-crumbs" aria-label="Διαδρομή"><ol>([\s\S]*?)<\/ol><\/nav>/.exec(html)[1];

test('an article states Home → primary section → itself, alike in the cover strip and BreadcrumbList', async () => {
    const html = await render();
    const [list] = ld(html, 'BreadcrumbList');
    const url = `${SITE}/blog-module/blog-entries/20260115G/article.html`;
    assert.deepEqual(list.itemListElement, [
        { '@type': 'ListItem', position: 1, name: 'F1 Stories', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'Τεχνικά', item: `${SITE}/blog-module/blog/section/technical/` },
        { '@type': 'ListItem', position: 3, name: 'Δοκιμή', item: url }
    ]);
    assert.match(html, new RegExp(`<link rel="canonical" href="${url}">`));
    assert.equal(crumbs(html), '<li><a href="/">F1 Stories</a></li><li><span aria-hidden="true">/</span> <a href="/blog-module/blog/section/technical/">Τεχνικά</a></li>'
        + '<li class="visually-hidden" aria-current="page">Δοκιμή</li>');
    // The primary category also leads the kicker, to the same static page; no category query link remains.
    assert.match(html, /<p class="rr-kicker"><a href="\/blog-module\/blog\/section\/technical\/">Τεχνικά<\/a>/);
    assert.doesNotMatch(html, /\?category=/);
    assert.deepEqual(ld(html, 'Article')[0].articleSection, ['Technical', 'Teams']);
});

test('the explicit primary category leads, and Greek, quotes and markup in a title stay escaped', async () => {
    const hostile = 'Η «Ferrari» & ο "Leclerc" </script><b>';
    const html = await render({ title: hostile, category: 'Teams' });
    const [list] = ld(html, 'BreadcrumbList');
    assert.equal(list.itemListElement[1].item, `${SITE}/blog-module/blog/section/teams/`);
    assert.equal(list.itemListElement[2].name, hostile);
    assert.match(crumbs(html), /aria-current="page">Η «Ferrari» &amp; ο "Leclerc" &lt;\/script&gt;&lt;b&gt;<\/li>$/);
    assert.equal((html.match(/<\/script><b>/g) || []).length, 0);
});

test('the legacy taxonomy refresh links each category to its own section page', () => {
    const html = '<a href="/blog-module/blog/index.html?category=News" class="article-category-pill">x</a>'
        + '<div class="article-meta"><span><svg class="icon" aria-hidden="true"><use href="#fa-tag"/></svg> old</span></div>';
    const updated = refreshArticleTaxonomy(html, { id: 'x', title: 't', category: 'History', categories: ['History', 'Drivers'], date: '2026-01-01' });
    assert.match(updated, /<a href="\/blog-module\/blog\/section\/history\/" class="article-category-pill">Ιστορία<\/a>/);
    assert.match(updated, /<a href="\/blog-module\/blog\/section\/history\/" class="article-category-link">Ιστορία<\/a> <a href="\/blog-module\/blog\/section\/drivers\/" class="article-category-link">Οδηγοί<\/a>/);
});

// ── Author identity ────────────────────────────────────────────────────────

test('bylines, cards, trust panel and JSON-LD name the writer as displayed and point to the static profile', async () => {
    const html = await render();
    assert.match(html, /<a href="\/authors\/georgios-balatzis\/" class="article-author-link">Γιώργος Μπαλατζής<\/a>/);
    assert.match(html, /id="author-card-name"><a href="\/authors\/georgios-balatzis\/">Γιώργος Μπαλατζής<\/a>/);
    assert.match(html, /ΣΥΝΤΑΚΤΗΣ<\/span><strong><a href="\/authors\/georgios-balatzis\/">/);
    // The archive link stays the filtered article list, not the profile.
    assert.match(html, /<a href="\/blog-module\/blog\/index\.html\?author=georgios-balatzis">Όλα τα άρθρα του Γιώργου/);
    assert.doesNotMatch(html, /\/authors\/\?author=/);
    assert.deepEqual(ld(html, 'Article')[0].author, { '@type': 'Person', '@id': `${SITE}/authors/georgios-balatzis/#person`, name: 'Γιώργος Μπαλατζής', url: `${SITE}/authors/georgios-balatzis/` });
});

test('the house byline is the publisher, never a person; an unknown name stays a plain name', async () => {
    assert.deepEqual(ld(await render({ author: 'F1 Stories Team' }), 'Article')[0].author, { '@type': 'Organization', '@id': `${SITE}/#organization`, name: 'F1 Stories' });
    const unknown = await render({ author: 'Guest Writer' });
    assert.deepEqual(ld(unknown, 'Article')[0].author, { '@type': 'Person', name: 'Guest Writer' });
    assert.match(unknown, /<a href="\/authors\/" class="article-author-link">Guest Writer<\/a>/);
});

test('directory and homepage team cards link each writer to the profile page', () => {
    const author = T.findAuthor('georgios-balatzis');
    const profile = renderAuthorProfile(author, 0, new Map());
    assert.equal((profile.match(/href="\/authors\/georgios-balatzis\/"/g) || []).length, 2);
    assert.match(profile, /href="\/blog-module\/blog\/index\.html\?author=georgios-balatzis">Όλα τα άρθρα/);
    const team = renderHomeTeam([]);
    assert.equal((team.match(/<a href="\/authors\/[a-z0-9-]+\/">/g) || []).length, T.AUTHORS.length * 2);
    assert.doesNotMatch(profile + team, /\/authors\/\?author=/);
});

// ── Static author pages ────────────────────────────────────────────────────

const SHELL = `<!doctype html>
<html lang="el"><head>
  <meta name="robots" content="max-image-preview:large"><meta property="og:locale" content="el_GR"><meta property="og:site_name" content="F1 Stories">
  <title>Οι συντάκτες | F1 Stories</title>
  <meta name="description" content="Κατάλογος.">
  <link rel="canonical" href="https://f1-stories.gr/authors/">
</head><body>
  <div class="authors-intro">
    <div class="authors-edition"><span>F1 STORIES / ΟΙ ΑΝΘΡΩΠΟΙ</span><span>ΠΕΝΤΕ ΦΩΝΕΣ</span></div>
    <div><h1>Οι φωνές<span class="editorial-accent">.</span></h1></div>
    <div class="authors-intro__copy"><p>Εισαγωγή.</p></div>
  </div>
  <a class="authors-directory-back" data-author-directory-back href="/authors/" hidden>← Όλοι οι συντάκτες</a>
  <div class="author-directory" data-author-directory aria-live="polite">
    <!-- f1s:authors-directory:begin -->
    <article>όλοι</article>
    <!-- f1s:authors-directory:end -->
  </div>
</body></html>`;

function authorSite() {
    const root = tmp('f1s-authors-');
    write(root, 'authors/index.html', SHELL);
    write(root, 'authors/retired-writer/index.html', 'stale');
    write(root, 'authors/Not_A_Slug/index.html', 'not owned');
    fs.mkdirSync(path.join(root, 'authors/assets'));
    return root;
}

const stories = [
    { id: '20261020G', title: 'Νεότερο', author: 'Georgios Balatzis', date: '2026-10-20' },
    { id: '20261030G', title: 'Μελλοντικό', author: 'Georgios Balatzis', date: '2026-10-30' },
    { id: '20261019G', title: 'Πρόχειρο', author: 'Georgios Balatzis', date: '2026-10-19', draft: true },
    { id: '20261018G', title: 'Μη δημόσια σελίδα', author: 'Georgios Balatzis', date: '2026-10-18' },
    { id: '20260101G', title: 'Παλαιότερο & "σημαντικό"', author: 'Georgios Balatzis', date: '2026-01-01' },
    { id: '20261021W', title: 'Άλλος συντάκτης', author: 'Themis Charvalis', date: '2026-10-21' },
    { id: '20261010F', title: 'Ομαδικό', author: 'F1 Stories Team', date: '2026-10-10' }
];

test('one standalone page per author record, with its own canonical, metadata, h1 and published stories only', () => {
    const root = authorSite();
    try {
        const pages = writeAuthorPages(stories, { today: '2026-10-24', htmlPath: path.join(root, 'authors/index.html'), isPublic: story => story.id !== '20261018G' });
        assert.deepEqual(pages.map(page => page.path), T.AUTHORS.map(author => `/authors/${author.slug}/`));
        const canonicals = T.AUTHORS.map(author => {
            const html = fs.readFileSync(path.join(root, 'authors', author.slug, 'index.html'), 'utf8');
            const canonical = /<link rel="canonical" href="([^"]+)">/.exec(html)[1];
            assert.equal(canonical, `${SITE}/authors/${author.slug}/`);
            assert.equal((html.match(/<link rel="canonical"/g) || []).length, 1);
            assert.equal((html.match(/<h1>/g) || []).length, 1);
            assert.match(html, new RegExp(`<meta property="og:url" content="${canonical}">`));
            assert.match(html, new RegExp(`<meta property="og:image" content="${SITE}${author.portrait}">`));
            assert.match(html, /<meta name="robots" content="max-image-preview:large">/);
            assert.match(html, /class="author-profile is-selected"/);
            assert.doesNotMatch(html, /authors-intro__copy|aria-live| hidden>|f1s:authors-directory/);
            return canonical;
        });
        assert.equal(new Set(canonicals).size, T.AUTHORS.length);

        const html = fs.readFileSync(path.join(root, 'authors/georgios-balatzis/index.html'), 'utf8');
        assert.match(html, /<title>Γιώργος Μπαλατζής · Συντάκτης \| F1 Stories<\/title>/);
        assert.match(html, /<h1>Γιώργος Μπαλατζής<span class="editorial-accent">\.<\/span><\/h1>/);
        assert.match(html, /<span>ΤΕΧΝΙΚΑ · ΔΕΔΟΜΕΝΑ<\/span><\/div>/);
        assert.match(html, /<img src="\/images\/avatars\/FA\.webp" alt="Γιώργος Μπαλατζής" width="240" height="240" loading="eager"/);
        const listed = [...html.matchAll(/<li><time datetime="([^"]+)">[^<]+<\/time><a href="\/blog-module\/blog-entries\/([^/]+)\/article\.html">/g)].map(match => match[2]);
        assert.deepEqual(listed, ['20261020G', '20260101G'], 'newest first; future, draft, non-public and other writers left out');
        assert.match(html, /Παλαιότερο &amp; &quot;σημαντικό&quot;/);
        const [schema] = ld(html, 'ProfilePage');
        assert.deepEqual(schema.mainEntity, { '@type': 'Person', '@id': `${SITE}/authors/georgios-balatzis/#person`, name: 'Γιώργος Μπαλατζής',
            url: `${SITE}/authors/georgios-balatzis/`, image: `${SITE}/images/avatars/FA.webp`, description: 'Τεχνική ανάλυση και αγωνιστικός ρυθμός',
            sameAs: ['https://www.instagram.com/borgos_gialatzis/'] });

        // The publication's own Instagram (footer) is not a writer's identity.
        assert.equal(ld(fs.readFileSync(path.join(root, 'authors/themis-charvalis/index.html'), 'utf8'), 'ProfilePage')[0].mainEntity.sameAs, undefined);

        const house = fs.readFileSync(path.join(root, 'authors/f1-stories/index.html'), 'utf8');
        assert.deepEqual(ld(house, 'ProfilePage')[0].mainEntity, { '@type': 'Organization', '@id': `${SITE}/#organization`, name: 'F1 Stories', url: `${SITE}/` });
        assert.doesNotMatch(house, /"@type":"Person"/);
        assert.match(house, /<meta property="og:type" content="website">/);
        assert.match(house, /συντακτική ομάδα του F1 Stories, όχι σε έναν συντάκτη/);

        // Retired records lose their page; folders the build does not own are left alone.
        assert.equal(fs.existsSync(path.join(root, 'authors/retired-writer')), false);
        assert.equal(fs.readFileSync(path.join(root, 'authors/Not_A_Slug/index.html'), 'utf8'), 'not owned');
        assert.ok(fs.existsSync(path.join(root, 'authors/assets')));
        assert.equal(fs.readFileSync(path.join(root, 'authors/index.html'), 'utf8'), SHELL);

        const again = fs.readFileSync(path.join(root, 'authors/georgios-balatzis/index.html'), 'utf8');
        writeAuthorPages(stories, { today: '2026-10-24', htmlPath: path.join(root, 'authors/index.html'), isPublic: story => story.id !== '20261018G' });
        assert.equal(fs.readFileSync(path.join(root, 'authors/georgios-balatzis/index.html'), 'utf8'), again, 'repeat builds are byte-identical');
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('a changed /authors/ shell stops the build instead of publishing a broken page', () => {
    const root = authorSite();
    try {
        write(root, 'authors/index.html', SHELL.replace(/<h1>[\s\S]*?<\/h1>/, ''));
        assert.throws(() => writeAuthorPages(stories, { today: '2026-10-24', htmlPath: path.join(root, 'authors/index.html'), isPublic: () => true }), /h1 not found/);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('the sitemap lists each profile once after the directory, with no invented lastmod', () => {
    const xml = renderSitemap([], [], { today: '2026-10-24', authors: [{ path: '/authors/a-writer/' }, { path: '/authors/b-writer/' }] });
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
    assert.deepEqual(locs.slice(locs.indexOf(`${SITE}/authors/`), locs.indexOf(`${SITE}/authors/`) + 3), [`${SITE}/authors/`, `${SITE}/authors/a-writer/`, `${SITE}/authors/b-writer/`]);
    assert.doesNotMatch(/<url>\s*<loc>https:\/\/f1-stories\.gr\/authors\/a-writer\/<\/loc>([\s\S]*?)<\/url>/.exec(xml)[1], /lastmod/);
    assert.doesNotMatch(xml, /\?author=/);
});

test('a Greek folder id is a valid original article URL and its page can be public', () => {
    const root = tmp('f1s-greek-');
    try {
        const id = '20260227Τ';
        write(root, `blog-module/blog-entries/${id}/article.html`, `<link rel="canonical" href="${SITE}/blog-module/blog-entries/${encodeURIComponent(id)}/article.html">`);
        assert.equal(articleIsPublic({ id }, root), true);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

// ── Contextual body links ──────────────────────────────────────────────────

function linkSite() {
    const root = tmp('f1s-body-');
    const body = links => `<div class="rr-body article-content" data-body>${links}</div>`;
    write(root, 'blog-module/blog-entries/20261001G/article.html', body('<p>Παλαιότερο.</p>'));
    write(root, 'blog-module/blog-entries/20261030G/article.html', body('<p>Μελλοντικό.</p>'));
    write(root, 'blog-module/blog-entries/20261028G/article.html', body('<p>Μεταγενέστερο.</p>'));
    write(root, 'blog-module/blog/entities/drivers/lando-norris/index.html', 'hub');
    write(root, 'blog-module/blog/section/technical/index.html', 'section');
    write(root, 'standings/index.html', 'standings');
    return { root, body };
}

const published = new Map([['20261001G', { id: '20261001G', date: '2026-10-01' }], ['20261026G', { id: '20261026G', date: '2026-10-26' }], ['20261028G', { id: '20261028G', date: '2026-10-28' }]]);

test('only distinct, existing, earlier F1 Stories destinations in the body count', () => {
    const { root } = linkSite();
    try {
        const html = [
            '<a href="../20261001G/article.html">Η προηγούμενη ανάλυση</a>',
            '<a href="https://www.f1-stories.gr/blog-module/blog-entries/20261001G/article.html#section-2">ξανά, με fragment</a>',
            '<a href="https://f1-stories.gr/blog-module/blog/entities/drivers/lando-norris/">Lando Norris</a>',
            '<a href="/blog-module/blog/section/technical/index.html">Τεχνικά</a>',
            '<a href="/standings/?tab=drivers">βαθμολογία</a>',
            '<a href="#section-1">ενότητα</a>',
            '<a href="https://www.formula1.com/">F1</a>',
            '<a href="mailto:myf1stories@gmail.com">mail</a>',
            '<a href="/blog-module/blog-entries/20261026G/article.html">αυτό το άρθρο</a>',
            '<a href="/blog-module/blog-entries/20261028G/article.html">μεταγενέστερο</a>',
            '<a href="/blog-module/blog-entries/20261030G/article.html">πρόχειρο</a>',
            '<a href="/blog-module/blog-entries/20991231G/article.html">ανύπαρκτο</a>',
            '<a id="_anchor">χωρίς href</a>'
        ].join(' ');
        const report = analyzeBody({ id: '20261026G', date: '2026-10-26' }, html, published, root);
        assert.deepEqual(report.links.map(link => link.kind), ['article', 'article', 'hub', 'section', 'page', 'self', 'later', 'unpublished', 'broken']);
        assert.equal(report.contextual, 3, 'the same story twice counts once; tools, self, later, drafts and dead links never count');
        assert.equal(report.isNew, true);
        assert.equal(internalPath('//f1-stories.gr/x', `${SITE}/a/`), '/x');
        assert.equal(internalPath('javascript:alert(1)', `${SITE}/a/`), '');
        assert.equal(internalPath('https://f1-stories.gr.evil.com/x', `${SITE}/a/`), '');
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('a new article fails on a dead body link and is advised below two; legacy stories only report', () => {
    const { root, body } = linkSite();
    const options = { today: '2026-10-29', root, isPublic: () => true };
    const posts = [
        { id: '20261001G', title: 'legacy', date: '2026-10-01' },
        { id: '20261028G', title: 'new', date: '2026-10-28' }
    ];
    const warn = console.warn;
    const log = console.log;
    const warnings = [];
    console.warn = message => warnings.push(message);
    console.log = () => {};
    try {
        write(root, 'blog-module/blog-entries/20261001G/article.html', body('<a href="/blog-module/blog-entries/20990101G/article.html">dead</a>'));
        const reports = checkBodyLinks(posts, options);
        assert.equal(summarize(reports).broken, 1, 'a legacy dead link is reported, not fatal');
        assert.deepEqual(summarize(reports).attention, ['20261028G']);
        assert.match(warnings.join('\n'), /20261028G: 0 contextual internal links/);

        write(root, 'blog-module/blog-entries/20261028G/article.html', body('<a href="https://f1-stories.gr/blog-module/blog-entries/20261030G/article.html">σε πρόχειρο</a>'));
        assert.throws(() => checkBodyLinks(posts, options), /20261028G: the body link https:\/\/f1-stories\.gr\/blog-module\/blog-entries\/20261030G\/article\.html does not lead to a published F1 Stories page/);

        write(root, 'blog-module/blog-entries/20261028G/article.html', body('<a href="../20261001G/article.html">α</a> <a href="/blog-module/blog/section/technical/">β</a>'));
        warnings.length = 0;
        assert.equal(checkBodyLinks(posts, options).find(report => report.id === '20261028G').contextual, 2);
        assert.equal(warnings.length, 0);
    } finally {
        console.warn = warn;
        console.log = log;
        fs.rmSync(root, { recursive: true, force: true });
    }
});
