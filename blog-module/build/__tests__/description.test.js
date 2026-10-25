const assert = require('node:assert/strict');
const { test } = require('node:test');
const D = require('../description');

test('htmlToText keeps word boundaries at block edges and joins inline markup', () => {
    assert.equal(D.htmlToText('<p>Ferrari</p><p>και Mercedes</p>'), 'Ferrari και Mercedes');
    assert.equal(D.htmlToText('<h2>Η Ferrari</h2><p>Το κείμενο</p>'), 'Η Ferrari Το κείμενο');
    assert.equal(D.htmlToText('<ul><li>Ένα</li><li>Δύο</li></ul><ol><li>Τρία</li></ol>'), 'Ένα Δύο Τρία');
    assert.equal(D.htmlToText('<div><section><p>α</p><blockquote><p>β</p></blockquote></section></div>'), 'α β');
    assert.equal(D.htmlToText('Γραμμή<br>δεύτερη<br/>τρίτη<br />τέλος'), 'Γραμμή δεύτερη τρίτη τέλος');
    assert.equal(D.htmlToText('<p>F1 <strong>Stories</strong>. Mc<em>Laren</em> <a href="/x" title="a > b">εδώ</a></p>'), 'F1 Stories. McLaren εδώ');
});

test('htmlToText decodes entities once, and again only behind a doubled &amp;', () => {
    assert.equal(D.htmlToText('<p>McLaren &amp;amp; Mercedes</p>'), 'McLaren & Mercedes');
    assert.equal(D.htmlToText('<p>R&amp;D &amp;amp;amp; τέλος</p>'), 'R&D & τέλος');
    assert.equal(D.htmlToText('&quot;Η ομάδα&quot; &#8217;70s &#x2014; &laquo;ναι&raquo; &ldquo;ok&rdquo; &hellip;'), '"Η ομάδα" ’70s — «ναι» “ok” …');
    assert.equal(D.htmlToText('A&nbsp;B C D &#160; E'), 'A B C D E');
    // Unknown, invalid and control references are left as written; literal ampersands survive.
    assert.equal(D.htmlToText('&bogus; &#0; &#xD800; &#99999999; AT&T R & D'), '&bogus; &#0; &#xD800; &#99999999; AT&T R & D');
});

test('htmlToText preserves Greek text, punctuation and mixed scripts exactly', () => {
    const greek = 'Ήταν ένα «ωραίο» Grand Prix· τι έγινε; Η Ferrari, ο Leclerc και η Mercedes·';
    assert.equal(D.htmlToText(`<p>${greek}</p>`), greek);
    assert.equal(D.htmlToText('<p>ένα</p>'), 'ένα');
});

test('htmlToText leaves no markup, comments, code or furniture in the text', () => {
    assert.equal(D.htmlToText('<p>Α<!-- κρυφό --> Β</p><!-- betcast-snapshot:x -->'), 'Α Β');
    assert.equal(D.htmlToText('<p>Α</p><script>var s = "<p>x</p>";</script><style>p{color:red}</style><template><p>τ</p></template><p>Β</p>'), 'Α Β');
    assert.equal(D.htmlToText('<img src=x onerror="alert(1)"><p>Κείμενο</p>'), 'Κείμενο');
    assert.equal(D.htmlToText('<p>Πριν</p><table><tr><td>A</td><td>B</td></tr></table><p>Μετά</p>'), 'Πριν Μετά');
    assert.equal(D.htmlToText('<div class="gallery-carousel"><div class="gallery-slide"><picture><img alt="1 από 9"></picture></div><div class="gallery-carousel-counter">1 / 9</div></div>'), '');
    assert.equal(D.htmlToText('<div class="youtube-embed-container"><a class="youtube-facade" href="#"><img alt=""></a><div class="video-caption">Video: YouTube</div></div><div class="embed-container"><iframe src="x"></iframe></div>'), '');
    assert.equal(D.htmlToText('<section class="betcast-article-block"><p class="betcast-article-block__brand">BETCAST</p></section><p>Μετά <span aria-hidden="true">·</span>τέλος</p>'), 'Μετά τέλος');
    assert.equal(D.htmlToText('<section class="rr-data"><header class="rr-data__head"><p>Data</p></header></section><figure><img><figcaption>Λεζάντα</figcaption></figure><p>Κείμενο</p>'), 'Κείμενο');
    assert.equal(D.htmlToText('<p>Γράψε <code>a &lt; b &amp;&amp; c</code> και &lt;script&gt;alert(1)&lt;/script&gt;</p>'), 'Γράψε a < b && c και <script>alert(1)</script>');
    assert.equal(D.htmlToText(''), '');
    assert.equal(D.htmlToText(null), '');
    assert.equal(D.htmlToText('<p></p><div> </div>'), '');
});

const len = text => D.graphemes(text).length;
const words = (count, word = 'λέξη') => Array.from({ length: count }, () => word).join(' ');

test('clampDescription keeps complete text and never exceeds the limit, ellipsis included', () => {
    assert.equal(D.DESCRIPTION_MAX, 155);
    assert.equal(D.clampDescription(''), '');
    assert.equal(D.clampDescription('Σύντομο κείμενο.'), 'Σύντομο κείμενο.');
    const exact = 'α'.repeat(155);
    assert.equal(D.clampDescription(exact), exact);
    const long = words(40);
    const cut = D.clampDescription(long);
    assert.ok(len(cut) <= 155 && cut.endsWith('…') && !cut.endsWith(' …'), cut);
    assert.ok(long.startsWith(cut.slice(0, -1)), 'a prefix of whole words');
    assert.ok(!/ λέ…$/.test(cut));
    // No word boundary at all: a deterministic hard cut at a character boundary.
    assert.equal(D.clampDescription('β'.repeat(300)), `${'β'.repeat(154)}…`);
});

test('clampDescription prefers a whole sentence and drops dangling words and punctuation', () => {
    // The last sentence end within the limit, when it fills at least 60% of it; otherwise a word cut.
    assert.equal(D.clampDescription(`${words(20)}. ${words(30)}`), `${words(20)}.`);
    assert.ok(D.clampDescription(`${words(10)}. ${words(30)}`).endsWith('λέξη…'));
    const dangling = `${words(29, 'Ferrari')} και τα μονοθέσια της ομάδας συνεχίζουν`;
    assert.ok(!/(?:και|τα|της|,|–)…$/.test(D.clampDescription(dangling)));
    assert.equal(D.clampDescription(`${'α'.repeat(152)}, και ββββ`), `${'α'.repeat(152)}…`);
    assert.equal(D.clampDescription(`${'α'.repeat(148)} και ββββββ`), `${'α'.repeat(148)}…`);
    assert.equal(D.clampDescription(`${'α'.repeat(150)}, β γ δ ε ζ`), `${'α'.repeat(150)}, β…`);
    // A list number or an initial is not the end of a sentence.
    const numbered = `Γύροι: 63 | DRS: 2 1. ${words(40)}`;
    assert.ok(D.clampDescription(numbered).endsWith('…'));
});

test('clampDescription counts emoji, flags and combining marks as one character each', () => {
    const emoji = '🏎️';
    const flags = '🇬🇷';
    assert.equal(len(emoji), 1);
    assert.equal(len(flags), 1);
    assert.equal(len('έ'), 1);
    const text = `${(emoji + ' ').repeat(100)}`.trim();
    const cut = D.clampDescription(text);
    assert.ok(len(cut) <= 155);
    assert.ok(!/[\ud800-\udbff]…$/.test(cut), 'no broken surrogate pair');
    assert.equal(D.clampDescription(`${flags}${'ά'.repeat(160)}`), `${flags}${'ά'.repeat(153)}…`);
});

test('fallbackDescription describes the prose, drops a repeated title and never invents text', () => {
    const body = '<p>Η ιστορία της ομάδας</p><p>Η Ferrari κέρδισε στη Μόντσα μετά από μια δραματική μάχη.</p>';
    assert.equal(D.fallbackDescription(body, 'Η ιστορία της ομάδας'), 'Η Ferrari κέρδισε στη Μόντσα μετά από μια δραματική μάχη.');
    // An image-only gallery has no prose: its title describes it.
    const gallery = '<div class="gallery-carousel"><div class="gallery-carousel-counter">1 / 9</div></div>';
    assert.equal(D.fallbackDescription(gallery, 'F1 Liveries 2026'), 'F1 Liveries 2026');
    assert.equal(D.fallbackDescription('', 'Τίτλος άρθρου εδώ'), 'Τίτλος άρθρου εδώ');
    assert.ok(len(D.fallbackDescription(`<p>${words(80)}</p>`, 'Τ')) <= 155);
});

test('editorial excerpts are normalised for whitespace only and validated, never truncated or decoded', () => {
    const excerpt = '  Πώς η διαχείριση   ενέργειας\nκαθορίζει την ταχύτητα — «McLaren & Mercedes»; ';
    const out = D.articleDescription({ excerpt, title: 'Τ' }, '<p>σώμα</p>');
    assert.deepEqual(out, { excerpt: 'Πώς η διαχείριση ενέργειας καθορίζει την ταχύτητα — «McLaren & Mercedes»;', editorialExcerpt: true });
    assert.deepEqual(D.excerptIssues(out.excerpt), []);
    const long = 'α'.repeat(150) + ' β γ δ ε ζ';
    assert.equal(D.articleDescription({ excerpt: long }, '').excerpt, long);
    assert.deepEqual(D.excerptIssues(long), [{ code: 'long', length: 160 }]);
    assert.deepEqual(D.excerptIssues(`${'α'.repeat(151)} β γ`), []);
    assert.deepEqual(D.excerptIssues(''), [{ code: 'missing' }]);
    assert.deepEqual(D.excerptIssues('   '), [{ code: 'missing' }]);
    assert.deepEqual(D.excerptIssues(undefined), [{ code: 'missing' }]);
    assert.deepEqual(D.excerptIssues('Ferrari'), [{ code: 'short' }]);
    assert.deepEqual(D.excerptIssues('Η <b>Ferrari</b> κερδίζει στη Μόντσα'), [{ code: 'markup' }]);
    assert.deepEqual(D.excerptIssues('McLaren &amp; Mercedes στη μάχη'), [{ code: 'markup' }]);
    assert.deepEqual(D.excerptIssues('R&D, AT&T και 3 < 4 στη μάχη'), []);
    assert.deepEqual(D.excerptIssues("Ο Lewis's \"τελευταίος\" γύρος στη Ferrari"), []);
    assert.equal(D.articleDescription({ title: 'Τίτλος' }, '<p>Ένα δύο τρία τέσσερα.</p>').editorialExcerpt, undefined);
    assert.match(D.excerptMessage({ code: 'long', length: 170 }), /170 χαρακτήρες· το όριο είναι 155\. Συντόμευσέ τη κατά 15\./);
});

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function entriesRoot(ids) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-excerpts-'));
    ids.forEach(id => {
        fs.mkdirSync(path.join(root, 'blog-module/blog-entries', id), { recursive: true });
        if (!id.endsWith('gallery')) fs.writeFileSync(path.join(root, 'blog-module/blog-entries', id, 'source.txt'), '---\ntitle: T\n---\n');
    });
    return root;
}

function check(posts, exempt = []) {
    const root = entriesRoot(posts.map(post => post.id));
    try {
        D.checkExcerpts(posts, { exempt: new Set(exempt), root });
        return '';
    } catch (error) {
        return error.message;
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
}

const valid = 'Πώς η διαχείριση ενέργειας καθορίζει την πραγματική ταχύτητα των μονοθεσίων.';
const editorial = (id, excerpt, extra = {}) => ({ id, date: '2026-10-26', excerpt, editorialExcerpt: true, ...extra });
const generated = (id, extra = {}) => ({ id, date: '2026-10-26', excerpt: 'αυτόματο κείμενο εδώ', ...extra });

test('a new article needs a valid editorial excerpt to publish', () => {
    assert.match(check([generated('20261026J')]), /20261026J: Λείπει η περιγραφή άρθρου \(excerpt\)\..*excerpt: …/);
    assert.match(check([editorial('20261026J', 'α'.repeat(150) + ' β γ δ ε ζ')]), /20261026J: Η περιγραφή έχει 160 χαρακτήρες/);
    assert.match(check([editorial('20261026J', 'Η <em>Ferrari</em> στη Μόντσα σήμερα')]), /HTML ή κωδικούς χαρακτήρων/);
    assert.match(check([editorial('20261026J', 'Ferrari')]), /πολύ σύντομη/);
    assert.equal(check([editorial('20261026J', valid)]), '');
});

test('a backdated or renamed folder is new: only the listed articles are grandfathered', () => {
    assert.match(check([generated('20240101J', { date: '2024-01-01' })], ['20240102J']), /20240101J: Λείπει/);
    assert.equal(check([generated('20240102J', { date: '2024-01-02' })], ['20240102J']), '');
});

test('historical articles stay buildable; an excerpt an editor adds to one is still validated', () => {
    assert.equal(check([generated('20250405G'), generated('20250525G')], ['20250405G', '20250525G']), '');
    assert.equal(check([editorial('20250405G', valid)], ['20250405G']), '');
    assert.match(check([editorial('20250405G', 'McLaren &amp; Mercedes στη Suzuka')], ['20250405G']), /20250405G: Η περιγραφή περιέχει HTML/);
});

test('drafts, unpublished stories and source-less galleries are not blocked for a missing excerpt', () => {
    assert.equal(check([generated('20261026J', { draft: 'true' })]), '');
    assert.equal(check([generated('20261026J', { published: 'false' })]), '');
    assert.equal(check([generated('20261026J', { status: 'review' })]), '');
    assert.equal(check([generated('20261026-gallery')]), '');
    // A scheduled (future-dated) story is released and goes out on its day: it is checked now.
    assert.match(check([generated('20261231J', { date: '2026-12-31' })]), /20261231J: Λείπει/);
});

test('the grandfathered list holds exactly the articles published before the rule', () => {
    const exempt = D.loadExemptIds();
    const ids = JSON.parse(fs.readFileSync(path.join(__dirname, '../excerpt-exempt.json'), 'utf8')).ids;
    assert.equal(exempt.size, 413);
    assert.deepEqual(ids, [...ids].sort());
    assert.ok(exempt.has('20261024J') && exempt.has('20260227Τ'));
});

test('the backlog report states its order, flags weak descriptions and never claims traffic data', () => {
    const root = entriesRoot(['20260101J', '20260102J', '20260103W']);
    const page = body => `<link rel="canonical" href="x"><div class="article-content">${body}</div>`;
    const write = (id, body) => fs.writeFileSync(path.join(root, 'blog-module/blog-entries', id, 'article.html'), page(body));
    write('20260101J', `<p>${words(30)}</p>`);
    write('20260102J', '<div class="gallery-carousel"></div>');
    write('20260103W', `<p>${words(30)}</p>`);
    fs.rmSync(path.join(root, 'blog-module/blog-entries/20260103W/source.txt'));
    const posts = [
        { id: '20260101J', date: '2026-01-01', title: 'Α', excerpt: 'Μια αρκετά μεγάλη περιγραφή για να μην είναι σύντομη, με πολλές λέξεις μέσα της ως εδώ.' },
        { id: '20260102J', date: '2026-01-02', title: 'Γκαλερί', excerpt: 'Γκαλερί' },
        { id: '20260103W', date: '2026-01-03', title: 'Γ', excerpt: 'Μια αρκετά μεγάλη περιγραφή για να μην είναι σύντομη, με πολλές λέξεις μέσα της ως εκεί.' },
        { id: '20260104J', date: '2099-01-01', title: 'Μελλοντικό', excerpt: 'x' }
    ];
    try {
        const rows = D.describeArticles(posts, { today: '2026-10-24', root, isPublic: () => true });
        assert.deepEqual(rows.map(row => row.id), ['20260102J', '20260101J', '20260103W']);
        assert.deepEqual(rows[0].warnings, ['title only: no usable body prose', 'short (7 characters)']);
        const report = D.renderDescriptionReport(rows);
        assert.match(report, /Generated descriptions: 3 \(2 editable in the author tools, 1 without a source document\)/);
        assert.match(report, /Traffic data: none in the repository\. The backlog is not a traffic ranking/);
        assert.match(report, /3\. 20260103W · 2026-01-03 · no source document/);
        assert.match(report, /2\. 20260101J · 2026-01-01 · blog-module\/blog-entries\/20260101J\/source\.txt/);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('a built article carries one description in all four slots, never double-escaped, with the body untouched', async () => {
    const { processBlogEntry } = require('../worker');
    const { CONFIG } = require('../shared');
    const { articleBodyHtml } = require('../reading-time');
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-description-'));
    const originalBlogDir = CONFIG.BLOG_DIR;
    const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"' };
    const attr = value => value.replace(/&(amp|lt|gt|quot);/g, (match, name) => NAMED[name]);
    async function build(id, front) {
        const dir = path.join(tempDir, id);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'source.txt'), ['---', 'category: Technical', 'title: Η μάχη των φρένων', ...front, '---', '',
            'McLaren & Mercedes "στη" μάχη των φρένων', '', 'και η Ferrari ακολουθεί με 3 < 4 βελτιώσεις.'].join('\n'));
        const post = await processBlogEntry(dir);
        const html = fs.readFileSync(path.join(dir, 'article.html'), 'utf8');
        const tag = re => [...html.matchAll(re)].map(match => attr(match[1]));
        const lds = [...html.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g)].map(match => JSON.parse(match[1]));
        return {
            post, body: articleBodyHtml(html), raw: html.slice(0, html.indexOf('</head>')),
            values: [tag(/<meta name="description" content="([^"]*)">/g), tag(/<meta property="og:description" content="([^"]*)">/g),
                tag(/<meta name="twitter:description" content="([^"]*)">/g), lds.filter(data => /Article$/.test(data['@type'])).map(data => data.description)]
        };
    }
    try {
        CONFIG.BLOG_DIR = tempDir;
        const generated = await build('20261026J', []);
        const expected = 'McLaren & Mercedes "στη" μάχη των φρένων και η Ferrari ακολουθεί με 3 < 4 βελτιώσεις.';
        assert.equal(generated.post.excerpt, expected);
        assert.equal(generated.post.editorialExcerpt, undefined);
        generated.values.forEach(values => assert.deepEqual(values, [expected]));
        assert.doesNotMatch(generated.raw, /&amp;amp;|&amp;quot;|&amp;lt;/);
        assert.match(generated.raw, /content="McLaren &amp; Mercedes &quot;στη&quot;/);
        const excerpt = 'Πώς τα φρένα της McLaren & της Mercedes κρίνουν τη μάχη: «ανάλυση».';
        const editorial = await build('20261027J', [`excerpt: ${excerpt}`]);
        assert.equal(editorial.post.editorialExcerpt, true);
        editorial.values.forEach(values => assert.deepEqual(values, [excerpt]));
        assert.equal(editorial.body, generated.body, 'the description never changes the article body');
        assert.ok(!editorial.body.includes('ανάλυση'));
    } finally {
        CONFIG.BLOG_DIR = originalBlogDir;
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});
