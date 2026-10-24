// P3B-R3: editorial heading semantics. Older imports carry their section titles as plain paragraphs; only lines that
// form a recurring section structure between full paragraphs become headings. Specification lists, list items after a
// lead-in and lone short lines stay paragraphs, and navigation is built only from confirmed sections and data stops.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { transformBody } = require('../race-report');
const { renderArticleHtml } = require('../article-render');

const para = n => `<p>${'Η Formula 1 άλλαξε εκείνη τη χρονιά και ο κινητήρας έγραψε ιστορία στις πίστες. '.repeat(n).trim()}</p>`;
const subheads = html => [...html.matchAll(/<h2 [^>]*class="rr-subhead"[^>]*>([\s\S]*?)<\/h2>/g)].map(m => m[1]);
const tool = '<div class="embed-container embed-iframe">\n<iframe src="https://f1-stories.gr/standings/?tab=debrief&amp;embed=1&amp;debriefRound=16" title="Debrief Παρασκευής — F1 Stories" loading="lazy"></iframe>\n</div>';

// Modelled on a 2025 engine profile: a real section title, then a specification list whose LAST line ("Καύσιμο: …")
// happens to be followed by a long paragraph, and a titles list closed by "Σύνολο Νικών: 25".
const specArticle = [
    para(2), para(2),
    '<p>Τεχνικά Χαρακτηριστικά</p>', para(2),
    '<p>Κατασκευαστής: Porsche (για λογαριασμό της TAG)</p>', '<p>Τύπος: V6 80° twin-turbo</p>', '<p>Κυβισμός: 1.5 λίτρα</p>',
    '<p>Καύσιμο: Ειδικά μείγματα που μεταβάλλονταν ανάλογα με την πίστα</p>', para(3),
    '<p>Τίτλοι που κατέκτησε:</p>', '<p>Παγκόσμιο Πρωτάθλημα Οδηγών 1984 – Niki Lauda</p>', '<p>Σύνολο Νικών: 25</p>', para(3),
    '<p>Η κληρονομιά του κινητήρα</p>', para(3)
].join('\n');

test('defect fixture: specification labels at the end of a list stay paragraphs', () => {
    const out = transformBody(specArticle);
    const found = subheads(out.html);
    assert.ok(!found.some(t => t.startsWith('Καύσιμο')), `"Καύσιμο: …" must not be a heading (got ${JSON.stringify(found)})`);
    assert.ok(!found.includes('Σύνολο Νικών: 25'), 'a "label: number" line is data, not a section');
    assert.ok(!out.entries.some(e => /Καύσιμο|Σύνολο Νικών/.test(e.label)), 'specification labels are not navigable');
    assert.match(out.html, /<p>Καύσιμο: Ειδικά μείγματα που μεταβάλλονταν ανάλογα με την πίστα<\/p>/, 'the paragraph is kept verbatim');
});

test('genuine section titles that recur between full paragraphs become headings, in order', () => {
    const out = transformBody(specArticle);
    assert.deepEqual(subheads(out.html), ['Τεχνικά Χαρακτηριστικά', 'Η κληρονομιά του κινητήρα']);
    assert.deepEqual(out.entries.map(e => [e.id, e.n, e.label]), [['section-1', 1, 'Τεχνικά Χαρακτηριστικά'], ['section-2', 2, 'Η κληρονομιά του κινητήρα']]);
    assert.match(out.html, /<h2 id="section-1" class="rr-subhead">Τεχνικά Χαρακτηριστικά<\/h2>/);
});

test('short ordinary paragraphs stay paragraphs: list items after a lead-in, results runs, a lone short line', () => {
    const leadIn = transformBody([para(2), '<p>Το 2025 η ομάδα συμμετείχε με:</p>', '<p>Aston Martin Vantage GT3 σε ορισμένα projects</p>', para(2),
        '<p>Πρώτη ενότητα του άρθρου</p>', para(2), '<p>Δεύτερη ενότητα του άρθρου</p>', para(2)].join('\n'));
    assert.deepEqual(subheads(leadIn.html), ['Πρώτη ενότητα του άρθρου', 'Δεύτερη ενότητα του άρθρου'], 'the item after "…με:" is list content');
    const results = transformBody([para(2), '<p>2010 Sebastian Vettel Abu Dhabi</p>', '<p>Ο νεότερος πρωταθλητής όλων</p>', '<p>2012 Sebastian Vettel Interlagos</p>',
        '<p>Το χαοτικό φινάλε που έμεινε στην ιστορία</p>', para(3)].join('\n'));
    assert.deepEqual(subheads(results.html), [], 'the last line of a results list is not a section');
    const lone = transformBody([para(2), '<p>Ρώμη, όνειρα και μυρωδιά από καύσιμο</p>', para(3), para(3)].join('\n'));
    assert.deepEqual(subheads(lone.html), [], 'one short line is not a section structure: ambiguous, so it stays a paragraph');
});

test('a short closing sentence or an author-bold heading line before a title does not hide it', () => {
    const out = transformBody([para(2), '<p>Αυτό δεν ήταν παρά μόνο η αρχή.</p>', '<p>Η Χρυσή Τετραετία</p>', para(2),
        '<p><strong>🛠️ Τεχνική Αντιπαράθεση</strong></p>', '<p><strong>McLaren MP4/16: Η Σταθερότητα</strong></p>', para(2)].join('\n'));
    assert.deepEqual(out.entries.map(e => e.label), ['Η Χρυσή Τετραετία', 'McLaren MP4/16: Η Σταθερότητα']);
    const brands = transformBody([para(2), '<p>Ας ξεκινήσουμε από τα γνωστά.</p>', '<p>Stoiximan</p>', para(2), '<p>Bwin</p>', para(2), '<p>Bet365</p>', para(2)].join('\n'));
    assert.deepEqual(brands.entries.map(e => e.label), ['Stoiximan', 'Bwin', 'Bet365'], 'short labels of a recurring structure are all kept');
});

test('an article without confirmed headings has no section entries and no navigation', async () => {
    const out = transformBody([para(2), para(3), '<p>Σύντομη φράση χωρίς τελεία</p>', para(3)].join('\n'));
    assert.deepEqual(out.entries, []);
    assert.equal(out.sections, 0);
    const page = await render([para(2), para(3)].join('\n'));
    assert.doesNotMatch(page, /class="rr-tower"|class="rr-contents"|class="rr-sectorbar__segs"/);
});

test('authored headings are the authority: they are kept and no paragraph is promoted beside them', () => {
    const out = transformBody(['<h2>Πρώτο κεφάλαιο</h2>', para(2), '<p>Σύντομη γραμμή χωρίς τελεία</p>', para(3), '<h3 id="mine">Δεύτερο</h3>', para(2)].join('\n'));
    assert.deepEqual(subheads(out.html), []);
    assert.deepEqual(out.entries.map(e => e.id), ['section-1', 'mine']);
});

test('headings promoted by an earlier build are re-evaluated, not trusted', () => {
    const published = transformBody(specArticle).html
        .replace('<p>Καύσιμο: Ειδικά', '<p id="section-9" class="rr-subhead" role="heading" aria-level="2">Καύσιμο: Ειδικά');
    const again = transformBody(published);
    assert.ok(!subheads(again.html).some(t => t.startsWith('Καύσιμο')), 'a stale promotion is removed');
    assert.equal(again.html, transformBody(specArticle).html, 'the result equals a fresh transform of the original');
    assert.equal(transformBody(again.html).html, again.html, 'and stays idempotent');
});

test('Greek typography and heading order are preserved', () => {
    const titles = ['Ο Häkkinen δεν ήταν απλώς πρωταθλητής', '2017: Όταν η βροχή άλλαξε τα πάντα', 'Η τελική ετυμηγορία'];
    const out = transformBody([para(2), ...titles.flatMap(t => [`<p>${t}</p>`, para(2)])].join('\n'));
    assert.deepEqual(subheads(out.html), titles, 'text, tonos, diaeresis and Latin names are carried verbatim');
    assert.deepEqual(out.entries.map(e => e.n), [1, 2, 3]);
    assert.deepEqual([...out.html.matchAll(/<(h[1-6]|p)[^>]*class="rr-subhead"/g)].map(m => m[1]), ['h2', 'h2', 'h2'], 'inferred sections are native h2 under the page h1');
});

test('running order, phone contents and data stops come from confirmed structure only', async () => {
    const body = [para(2), '<p>Πρώτη ενότητα του άρθρου</p>', para(2), tool, para(2), '<p>Δεύτερη ενότητα του άρθρου</p>', para(2),
        '<p>Κατασκευαστής: Porsche</p>', '<p>Καύσιμο: Ειδικά μείγματα</p>', para(2)].join('\n');
    const page = await render(body);
    const tower = (/<nav class="rr-tower"[\s\S]*?<\/nav>/.exec(page) || [''])[0];
    const hrefs = [...tower.matchAll(/href="#([^"]+)"/g)].map(m => m[1]);
    assert.deepEqual(hrefs, ['section-1', 'data-1', 'section-2'], 'sections and the data stop, in reading order');
    hrefs.forEach(id => assert.match(page, new RegExp(`id="${id}"`), `#${id} has a target`));
    assert.match(tower, /<li class="is-data"><a href="#data-1"><span class="rr-ro__no">DATA<\/span><span class="rr-ro__label">DEBRIEF<\/span>/);
    const contents = (/<details class="rr-contents">[\s\S]*?<\/details>/.exec(page) || [''])[0];
    assert.deepEqual([...contents.matchAll(/href="#([^"]+)"/g)].map(m => m[1]), hrefs, 'the phone list mirrors the tower');
    assert.equal((page.match(/<ol class="rr-sectorbar__segs"[^>]*>([\s\S]*?)<\/ol>/) || ['', ''])[1].match(/<li>/g).length, 2, 'one sector segment per section');
    const twoEntries = await render([para(2), '<p>Πρώτη ενότητα του άρθρου</p>', para(2), '<p>Δεύτερη ενότητα του άρθρου</p>', para(2)].join('\n'));
    assert.match(twoEntries, /class="rr-tower"/);
    assert.doesNotMatch(twoEntries, /class="rr-contents"/, 'the phone list needs three or more stops');
});

test('generated structured data is valid and agrees with the taxonomy', async () => {
    const page = await render(para(2), { title: 'Ο τίτλος «με εισαγωγικά» & σύμβολα', categories: ['Analysis', 'Drivers'], category: 'Analysis' });
    const blocks = [...page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
    assert.deepEqual(blocks.map(b => b['@type']), ['Article', 'BreadcrumbList'], 'exactly one Article and one BreadcrumbList');
    const [article, crumbs] = blocks;
    const canonical = (/<link rel="canonical" href="([^"]+)"/.exec(page) || [])[1];
    assert.equal(canonical, 'https://f1-stories.gr/blog-module/blog-entries/20260101G/article.html');
    assert.equal(article.headline, 'Ο τίτλος «με εισαγωγικά» & σύμβολα');
    assert.deepEqual(article.articleSection, ['Analysis', 'Drivers']);
    assert.equal(article.mainEntityOfPage['@id'], canonical);
    assert.equal(article.datePublished, '2026-01-01');
    assert.equal(article.author.name, 'Γιώργος Μπαλατζής');
    assert.equal(article.author.url, 'https://f1-stories.gr/authors/georgios-balatzis/');
    assert.deepEqual(crumbs.itemListElement.map(i => [i.position, i.name, i.item]), [
        [1, 'F1 Stories', 'https://f1-stories.gr/'],
        [2, 'Ανάλυση', 'https://f1-stories.gr/blog-module/blog/section/analysis/'],
        [3, 'Ο τίτλος «με εισαγωγικά» & σύμβολα', canonical]
    ]);
});

// P3B-R4: confirmed sections are native headings.
test('confirmed sections are native h2 elements with their text and inline markup, without ARIA heading roles', () => {
    const out = transformBody([para(2), '<p><strong>Θεωρία #1: Η Κρεμαγιέρα</strong> – <em>Alonso</em> &amp; Stroll</p>', para(2), '<p>Η κληρονομιά</p>', para(2)].join('\n'));
    assert.match(out.html, /<h2 id="section-1" class="rr-subhead"><strong>Θεωρία #1: Η Κρεμαγιέρα<\/strong> – <em>Alonso<\/em> &amp; Stroll<\/h2>/);
    assert.match(out.html, /<h2 id="section-2" class="rr-subhead">Η κληρονομιά<\/h2>/);
    assert.doesNotMatch(out.html, /role="heading"|aria-level/);
    assert.doesNotMatch(out.html, /<p[^>]*class="rr-subhead"/);
});

test('an inferred h2 from an earlier build is re-judged, never taken for an authored heading', () => {
    const fresh = transformBody(specArticle).html;
    // A stale inferred h2 on a specification line must go back to being a paragraph...
    const stale = fresh.replace('<p>Καύσιμο: Ειδικά μείγματα που μεταβάλλονταν ανάλογα με την πίστα</p>',
        '<h2 id="section-7" class="rr-subhead">Καύσιμο: Ειδικά μείγματα που μεταβάλλονταν ανάλογα με την πίστα</h2>');
    assert.notEqual(stale, fresh);
    assert.equal(transformBody(stale).html, fresh, 'the stale h2 is undone and the real sections are kept');
    // ...and the inferred h2s themselves must not switch the article to "authored headings" (which would freeze them).
    assert.equal(transformBody(fresh).html, fresh, 'idempotent across rebuilds');
    assert.deepEqual(transformBody(fresh).entries.map(e => e.id), ['section-1', 'section-2']);
});

test('authored headings stay exactly as written', () => {
    const body = ['<h2>Πρώτο κεφάλαιο</h2>', para(2), '<h3 id="mine">Υποενότητα <em>B</em></h3>', para(2), '<h2>Δεύτερο</h2>', para(2)].join('\n');
    const out = transformBody(body);
    assert.match(out.html, /<h2 id="section-1">Πρώτο κεφάλαιο<\/h2>[\s\S]*<h3 id="mine">Υποενότητα <em>B<\/em><\/h3>[\s\S]*<h2 id="section-3">Δεύτερο<\/h2>/);
    assert.doesNotMatch(out.html, /rr-subhead/);
});

test('a body h1 (Word import) becomes an h2 section; the title stays the only h1', () => {
    const out = transformBody(['<h1>Παρασκευή – Δοκιμές &amp; Τεχνική</h1>', para(2), '<h3>Λεπτομέρεια</h3>', para(2), '<h1 class="x">Κυριακή</h1>', para(2)].join('\n'));
    assert.doesNotMatch(out.html, /<h1\b/);
    // Existing h2/h3 keep the former contents list numbering (section-N over h2/h3); the former h1s are numbered after.
    assert.match(out.html, /<h2 id="section-2">Παρασκευή – Δοκιμές &amp; Τεχνική<\/h2>[\s\S]*<h3 id="section-1">Λεπτομέρεια<\/h3>[\s\S]*<h2 id="section-3" class="x">Κυριακή<\/h2>/);
    assert.deepEqual(out.entries.map(e => e.label), ['Παρασκευή – Δοκιμές &amp; Τεχνική', 'Λεπτομέρεια', 'Κυριακή']);
});

test('empty or media-only headings keep their markup and id but are not navigation', () => {
    const body = ['<h2>Πρώτο</h2>', para(2), '<h3><a id="_bookmark"></a></h3>', para(2),
        '<h3><a id="_b2"></a> <figure class="article-figure"><img src="3.webp" alt=""><figcaption>Image 3</figcaption></figure></h3>', para(2), '<h2>Δεύτερο</h2>', para(2)].join('\n');
    const out = transformBody(body);
    assert.match(out.html, /<h3 id="section-2"><a id="_bookmark"><\/a><\/h3>/);
    assert.match(out.html, /<h3 id="section-3"><a id="_b2"><\/a> <figure/);
    assert.deepEqual(out.entries.map(e => [e.id, e.n]), [['section-1', 1], ['section-4', 2]], 'only headings with words of their own, numbered 01, 02');
    assert.equal(out.sections, 2);
});

test('a new section id never collides with an id the body already uses', () => {
    const out = transformBody(['<h2 id="section-2">Υπάρχον</h2>', para(2), '<h1>Νέο</h1>', para(2), '<h3>Τρίτο</h3>', para(2)].join('\n'));
    const ids = [...out.html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
    assert.deepEqual(ids, ['section-2', 'section-4', 'section-3'], 'existing ids kept; new ones take the next free number');
    assert.equal(transformBody(out.html).html, out.html, 'stable on rebuild');
});

test('a generated page has one h1, a descending outline, unique ids and resolvable, unique section links', async () => {
    const body = [para(2), '<p>Πρώτη ενότητα του άρθρου</p>', para(2), tool, para(2), '<p>Δεύτερη ενότητα – Verstappen vs Hamilton</p>', para(2),
        '<p>Κατασκευαστής: Porsche</p>', '<p>Καύσιμο: Ειδικά μείγματα</p>', para(2), '<p>Τρίτη ενότητα</p>', para(2)].join('\n');
    const page = await render(body);
    const main = (/<main[\s\S]*<\/main>/.exec(page) || [''])[0];
    assert.equal((page.match(/<h1\b/g) || []).length, 1, 'exactly one h1: the article title');
    const articleBody = (/<div class="rr-body article-content" data-body>([\s\S]*?)<\/div>\s*<\/div>\s*<section class="rr-pitwall"/.exec(page) || [])[1];
    const outline = [...articleBody.matchAll(/<(h[1-6])\b/g)].map(m => m[1]);
    assert.deepEqual(outline, ['h2', 'h2', 'h2'], 'the body opens at h2 under the title; no level is skipped');
    const ids = [...page.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
    assert.equal(new Set(ids).size, ids.length, `duplicate ids: ${ids.filter((x, i) => ids.indexOf(x) !== i)}`);
    const tower = [...((/<nav class="rr-tower"[\s\S]*?<\/nav>/.exec(main) || [''])[0]).matchAll(/href="#([^"]+)"/g)].map(m => m[1]);
    assert.deepEqual(tower, ['section-1', 'data-1', 'section-2', 'section-3']);
    assert.equal(new Set(tower).size, tower.length, 'no duplicate navigation destinations');
    tower.forEach(id => assert.ok(ids.includes(id), `#${id} resolves`));
    assert.match(articleBody, /<p>Κατασκευαστής: Porsche<\/p>\s*<p>Καύσιμο: Ειδικά μείγματα<\/p>/, 'specification lines stay paragraphs');
    assert.doesNotMatch(articleBody, /<p>\s*<h2|<h2[^>]*>[^<]*<(p|div|section)\b/, 'no heading nested in or around block content');
});

async function render(content, overrides = {}) {
    const entryPath = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-headings-'));
    try {
        await renderArticleHtml({
            id: '20260101G', title: 'Δοκιμή', author: 'Georgios Balatzis', date: '2026-01-01', dateISO: '2026-01-01', displayDate: '1 Ιανουαρίου 2026',
            category: 'News', categories: ['News'], excerpt: 'x', image: '/blog-module/images/default-blog.jpg', backgroundImage: '/blog-module/images/default-blog.jpg',
            sources: '', comments: 0, content, ...overrides
        }, entryPath, '20260101G');
        return fs.readFileSync(path.join(entryPath, 'article.html'), 'utf8');
    } finally { fs.rmSync(entryPath, { recursive: true, force: true }); }
}
