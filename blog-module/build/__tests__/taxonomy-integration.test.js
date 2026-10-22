const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
// The homepage renderers read image sizes measured once per build (image-sizes.primeImageDimensions).
test.before(() => require('../image-sizes').primeImageDimensions());
const { PUBLIC_CATEGORIES, AUTHORS, findAuthor, authorLabel, authorThumb, getPostTaxonomy } = require('../../taxonomy');
const {
    buildIndexPosts, buildCompactIndexData, buildHomeLatest,
    loadEditorialSelection
} = require('../index');
const { refreshArticleTaxonomy, getEditorialProfile, renderArticleSources, renderAuthorCard } = require('../article-render');
const { extractMetadata } = require('../metadata');
const { convertTxtToHtml } = require('../parse-txt');
const { scoreRelatedPosts } = require('../related');

test('archive data separates public categories from searchable detail tags', async () => {
    const posts = await buildIndexPosts([{
        id: '20260901W', title: 'Hamilton at Ferrari', author: 'Author',
        date: '2026-09-01', readingTime: '3 min', excerpt: 'An article.',
        tag: 'F1', category: 'Racing,-2026,-Lewis-Hamilton,-Ferrari-F1'
    }]);
    assert.ok(posts[0].categories.every(category => PUBLIC_CATEGORIES.includes(category)));
    assert.ok(posts[0].tags.includes('Lewis Hamilton'));
    assert.ok(posts[0].tags.includes('Ferrari F1'));
    const compact = buildCompactIndexData(posts);
    assert.deepEqual(compact.c, PUBLIC_CATEGORIES);
    assert.deepEqual(compact.p[0][8].map(index => compact.c[index]), posts[0].categories);
    assert.deepEqual(compact.p[0][9].map(index => compact.t[index]), posts[0].tags);
});

test('compact archive thumbnail variants use an unambiguous run map', () => {
    const compact = buildCompactIndexData([
        { id: 'a', title: 'A', author: 'Author', date: '2026-09-03', thumbnail: '/blog-module/blog-entries/a/1.webp', thumbnailWidth: 400, thumbnailHeight: 225, excerpt: '', readingTime: '1 min', categories: ['News'], tags: [] },
        { id: 'b', title: 'B', author: 'Author', date: '2026-09-02', thumbnail: '/blog-module/blog-entries/b/1-card.webp', thumbnailWidth: 400, thumbnailHeight: 225, excerpt: '', readingTime: '1 min', categories: ['News'], tags: [] },
        { id: 'c', title: 'C', author: 'Author', date: '2026-09-01', thumbnail: '/blog-module/blog-entries/c/1-card.webp', thumbnailWidth: 400, thumbnailHeight: 225, excerpt: '', readingTime: '1 min', categories: ['News'], tags: [] },
        { id: 'd', title: 'D', author: 'Author', date: '2026-08-31', thumbnail: '/blog-module/blog-entries/d/1.webp', thumbnailWidth: 400, thumbnailHeight: 225, excerpt: '', readingTime: '1 min', categories: ['News'], tags: [] }
    ]);
    assert.equal(compact.h, '01,12,01');
});

test('compact archive marks which posts have an editable source.txt', () => {
    const row = (id, hasSource) => ({ id, title: id, author: 'Author', date: '2026-09-01', thumbnail: '', thumbnailWidth: 400, thumbnailHeight: 225, excerpt: '', readingTime: '1 min', categories: ['News'], tags: [], hasSource });
    assert.equal(buildCompactIndexData([row('a', true), row('b', true), row('c', false)]).s, '12,01');
    assert.equal(buildCompactIndexData([]).s, '');
});

test('source-less article taxonomy migration leaves body bytes intact and is idempotent', () => {
    const body = '<p>Ferrari-F1, original prose &amp; markup.</p><div><video src="race.mp4"></video></div>';
    const oldLabel = 'Racing,-70ς,-History,-F1-Legends';
    const html = `<script type="application/ld+json">{"@type":"Article","headline":"Original"}</script>
<span class="article-mini-bar__category">F1</span>
<span class="article-category-pill">F1</span>
<div class="article-meta"><span><svg class="icon" aria-hidden="true"><use href="#fa-tag"/></svg> ${oldLabel}</span></div>
<div class="article-rail-meta-list"><span><svg class="icon" aria-hidden="true"><use href="#fa-tag"/></svg> F1</span></div>
<div class="article-rail-card article-rail-tags" data-tags="${oldLabel}"><span class="article-rail-label">Tags</span><div class="article-tag-list" data-tag-list></div></div>
<div class="article-content">${body}</div>`;
    const post = { tag: 'F1', category: oldLabel };
    const updated = refreshArticleTaxonomy(html, post);
    assert.ok(updated.includes(`<div class="article-content">${body}</div>`));
    assert.ok(updated.includes('index.html?category=History'));
    assert.ok(!updated.includes(oldLabel));
    assert.ok(!updated.includes('data-tags='));
    const data = JSON.parse(updated.match(/application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.deepEqual(data.articleSection, getPostTaxonomy(post).categories);
    assert.equal(refreshArticleTaxonomy(updated, post), updated);
});

test('explicit source category survives detailed tags and front matter preserves first body words', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-taxonomy-source-'));
    const source = '\uFEFF---\r\ncategory: Opinion\r\ntags: 2026, Lewis Hamilton, Ferrari F1\r\ntitle: A title: with punctuation\r\n---\r\n\r\nOpening words must stay.\r\n\r\nSecond paragraph.\r\n';
    try {
        const file = path.join(directory, 'source.txt');
        fs.writeFileSync(file, source);
        const metadata = extractMetadata(file, source);
        const taxonomy = getPostTaxonomy(metadata);
        assert.deepEqual(taxonomy.categories, ['Opinion']);
        assert.equal(metadata.title, 'A title: with punctuation');
        const html = await convertTxtToHtml(file);
        assert.ok(html.startsWith('<p>Opening words must stay.</p>'));
        assert.ok(!html.includes('category:'));
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

test('editorial dossiers use a readable section label and only render safe explicit sources', () => {
    assert.deepEqual(getEditorialProfile('Technical'), { category: 'Technical', kind: 'technical', label: 'ΤΕΧΝΙΚΟ ΔΕΛΤΙΟ' });
    assert.equal(getEditorialProfile('Unknown').kind, 'journal');

    const sources = renderArticleSources(
        'FIA Technical Regulations | https://www.fia.com/regulation/category/110; Unsafe | javascript:alert(1); Formula 1 timing | https://www.formula1.com/en/results.html',
        getEditorialProfile('Technical')
    );
    assert.match(sources, /FIA Technical Regulations/);
    assert.match(sources, /Formula 1 timing/);
    assert.match(sources, /noopener noreferrer/);
    assert.doesNotMatch(sources, /javascript:/i);
});

test('archive index lists the primary category first', async () => {
    const [post] = await buildIndexPosts([{
        id: '20260901W', title: 'A driver analysis', author: 'Author', date: '2026-09-01',
        categories: ['Analysis', 'Drivers'], category: 'Drivers', readingTime: '3 min', excerpt: ''
    }]);
    assert.deepEqual(post.categories, ['Drivers', 'Analysis']);
});

test('journal selection file is optional and tolerates invalid JSON', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-selection-'));
    try {
        assert.deepEqual(loadEditorialSelection(path.join(directory, 'missing.json')), {});
        const broken = path.join(directory, 'broken.json');
        fs.writeFileSync(broken, '{ "lead": ');
        const warn = console.warn;
        console.warn = () => {};
        try { assert.deepEqual(loadEditorialSelection(broken), {}); } finally { console.warn = warn; }
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

test('an article takes its colour from the author-chosen primary category', () => {
    const html = '<article class="article-container" data-article-kind="analysis"><div class="article-header">x</div></article>'
        + '<div class="article-content"><p>Body.</p></div>';
    const updated = refreshArticleTaxonomy(html, { categories: ['Analysis', 'Drivers'], category: 'Drivers', author: 'Themis Charvalis' });
    assert.match(updated, /data-article-kind="drivers"/);
    assert.match(updated, /data-article-dossier="ΠΡΟΣΩΠΟ ΤΟΥ GRID"/);
});

test('every author resolves from the one list, by canonical name or slug', () => {
    assert.equal(AUTHORS.length, 6);
    for (const author of AUTHORS) {
        assert.equal(findAuthor(author.name), author);
        assert.equal(findAuthor(author.slug), author);
        assert.equal(authorLabel(author.name), author.label);
        assert.ok(author.portrait && author.specialty && author.bio && author.genitive && /^[A-Z]$/.test(author.code));
        assert.ok(fs.existsSync(path.join(__dirname, '..', '..', '..', authorThumb(author))), `${author.slug} thumbnail`);
    }
    // The house byline is a writer like the others; unknown names still pass through.
    assert.equal(findAuthor('F1 Stories Team').slug, 'f1-stories');
    assert.equal(authorLabel('F1 Stories Team'), 'F1 Stories');
    assert.equal(findAuthor('Guest Writer'), null);
    assert.equal(authorLabel('Guest Writer'), 'Guest Writer');
});

test('THE PADDOCK signs with short bylines and dates the wire, voices and archive', () => {
    const { renderHomeJournal, selectPaddock } = require('../index');
    const post = (id, author, category, extra = {}) => ({ id, title: `Story ${id}`, author, date: '2026-09-27', readingTime: '4 min', categories: [category], ...extra });
    const html = renderHomeJournal(selectPaddock([
        post('L', 'Themis Charvalis', 'Analysis'),
        post('V1', 'Giannis Poulikidis', 'Opinion'), post('V2', 'Guest Writer', 'Opinion'),
        post('A1', 'F1 Stories Team', 'History', { excerpt: 'From the archive.' }),
        post('W1', 'Georgios Balatzis', 'News'), post('W2', 'Georgios Balatzis', 'Drivers')
    ]), 'The lead dek.');
    // Stories without a card image in the repo render as text: the feature, then each desk.
    assert.match(html, /<article class="pd-analysis pd-analysis--text" data-kind="analysis">/);
    assert.match(html, /pd-analysis__dek">The lead dek\./);
    assert.match(html, /home-story__byline">Θ\. ΧΑΡΒΑΛΗΣ · <time datetime="2026-09-27">27 Σεπ 2026<\/time>/);
    assert.deepEqual([...html.matchAll(/<h4 class="pd-voice__title"><a [^>]+>«Story (\w+)»/g)].map(m => m[1]), ['V1', 'V2']);
    assert.match(html, /pd-voice__who"><img src="\/images\/avatars\/SV-96\.webp"[^>]*>ΓΙΑΝΝΗΣ ΠΟΥΛΙΚΙΔΗΣ/);
    // A writer outside the list has no portrait, only the name.
    assert.match(html, /pd-voice__who">GUEST WRITER</);
    assert.deepEqual([...html.matchAll(/<h4 class="pd-wire__title"><a [^>]+>Story (\w+)/g)].map(m => m[1]), ['W1', 'W2']);
    assert.match(html, /<time class="pd-wire__date" datetime="2026-09-27"><b>27<\/b>ΣΕΠ<span class="visually-hidden"> 2026<\/span><\/time>/);
    assert.match(html, /pd-archive__excerpt">From the archive\./);
    // Number and unit never wrap apart: a no-break space (U+00A0).
    assert.match(html, /<span>4 ΛΕΠΤΑ<\/span>/);
    assert.doesNotMatch(html, /\d ΛΕΠΤΑ/);
    assert.match(html, /home-story__kind">ΑΝΑΛΥΣΗ/);
    assert.match(html, /home-story__kind">ΙΣΤΟΡΙΑ/);
});

test('ON AIR signs an article like the Journal and shows square art whole', () => {
    const { renderOnAir } = require('../home-panels');
    const article = (id, title, date, extra = {}) => ({ id, title, date, url: `/blog-module/blog-entries/${id}/article.html`, image: `/blog-module/blog-entries/${id}/1.webp`, author: 'Giannis Poulikidis', ...extra });
    const html = renderOnAir([
        article('20261002J', 'BetCast #275: Το Grid', '2026-10-02'),
        article('20260924J', 'BetCast #274: Baku', '2026-09-24', { imageWidth: 300, imageHeight: 300 }),
        article('20260912J', 'BetCast #273: Προσπεράσεις', '2026-09-12', { imageWidth: 1672, imageHeight: 941 })
    ]);
    assert.match(html.split('<ol class="episodes"')[0], /home-story__byline">Γ\. ΠΟΥΛΙΚΙΔΗΣ</);
    assert.equal((html.match(/episode__thumb--contain/g) || []).length, 1);
    assert.match(html.match(/<a class="episode__thumb[^"]*" href="[^"]*20260924J[^>]*>/)[0], /episode__thumb--contain/);
    assert.doesNotMatch(html.match(/<a class="episode__thumb[^"]*" href="[^"]*20260912J[^>]*>/)[0], /contain/);
});

test('the homepage cover uses the article header photograph before the card thumbnail', async () => {
    const [hero] = await buildHomeLatest([{
        id: '20261007W', title: 'Hamilton', date: '2026-10-07',
        image: '/blog-module/blog-entries/20261007W/1.webp',
        backgroundImage: '/blog-module/blog-entries/20261007W/2.webp'
    }]);
    assert.equal(hero.heroImage, '/blog-module/blog-entries/20261007W/2.webp');
    assert.equal(hero.heroAvif, '/blog-module/blog-entries/20261007W/2.avif');
    assert.equal(hero.heroImageWidth, 1350);
    assert.equal(hero.heroImageHeight, 900);
});

test('THE GRID renders the top ten, scales bars to the leader, the points share and the pace to the slowest team', () => {
    const { renderNumbers } = require('../home-panels');
    const driver = (position, code, points, wins = 0) => ({ position: String(position), points: String(points), wins: String(wins), Driver: { code, givenName: 'G', familyName: code }, Constructors: [{ constructorId: 'mercedes', name: 'Mercedes' }] });
    const team = (position, name, points, wins) => ({ position: String(position), points: String(points), wins: String(wins), Constructor: { constructorId: name.toLowerCase(), name } });
    const table = (key, rows) => ({ MRData: { StandingsTable: { StandingsLists: [{ season: '2026', round: '15', [key]: rows }] } } });
    const standings = {
        driverStandings: table('DriverStandings', [driver(1, 'ANT', 200, 1), driver(2, 'RUS', 100, 2), ...['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].map((code, i) => driver(i + 3, code, 50 - i * 5))]),
        constructorStandings: table('ConstructorStandings', [team(1, 'Mercedes', 300, 11), team(2, 'Ferrari', 100, 0), team(3, 'Cadillac', 0, 0)])
    };
    const debrief = { rounds: [
        { round: 14, location: 'Madrid', racePacePrediction: [
            { code: 'MER', teamColor: '00D7B6', predictedLap: '1:39.611', gapToFirst: null },
            { code: 'AMR', teamColor: '229971', gapToFirst: '+0.500' },
            { code: 'FER', teamColor: 'ED1131', gapToFirst: '+1.000' }
        ] },
        { round: 15, location: 'Baku', racePacePrediction: [] }
    ] };
    const { boards, stamp, season } = renderNumbers(standings, debrief, () => '#123456');
    assert.equal(stamp, '<span>ΣΕΖΟΝ 2026</span><span>ΜΕΤΑ ΤΟΝ ΓΥΡΟ 15</span>');
    // Ten rows, real positions, bars and gaps against the leader.
    assert.deepEqual([...boards.matchAll(/tower-row__pos">(\d+)</g)].map(m => m[1]), ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
    assert.match(boards, /tower-row__code">RUS[\s\S]*?/);
    assert.match(boards, /--w:50%">\s*<span class="tower-row__pos">2</);
    assert.match(boards, /tower-row__gap">LEADER</);
    assert.match(boards, /tower-row__gap">−100</);
    assert.match(boards, /Mercedes · 1 νίκη/);
    assert.match(boards, /Mercedes · 2 νίκες/);
    // The points share counts only teams that have scored: 300 and 100 of 400.
    assert.match(boards, /aria-label="Mercedes 300, Ferrari 100"/);
    assert.match(boards, /<span>Mercedes<\/span><b>300<\/b><small>75%<\/small>/);
    assert.match(boards, /<span>Cadillac<\/span><b>0<\/b><small>0%<\/small>/);
    // The newest round with a prediction; the slowest shown team sits at the end of the track.
    assert.match(boards, /ΠΡΟΒΛΕΨΗ R14 · MADRID/);
    assert.match(boards, /--x:0%[\s\S]*--x:50%[\s\S]*--x:100%/);
    assert.match(boards, /1:39\.611/);
    // The cover's season line comes from the same snapshot: leader, gap to second, the leading team's wins out of
    // the completed rounds, then the pace prediction with its own round.
    assert.deepEqual([...season.matchAll(/<b>(.*?)<\/b><span>(.*?)<\/span>/g)].map(m => [m[1], m[2]]), [
        ['200', 'ANT · ΒΑΘΜΟΙ ΣΤΗΝ ΚΟΡΥΦΗ'], ['+100', 'ΔΙΑΦΟΡΑ ΑΠΟ RUS'], ['11<small>/15</small>', 'ΝΙΚΕΣ MERCEDES'], ['1:39.611', 'ΠΡΟΒΛΕΨΗ ΡΥΘΜΟΥ · MER · R14']
    ]);
    // A debrief from another season is not shown next to these standings; no standings, no season line.
    const otherSeason = renderNumbers(standings, { ...debrief, season: 2025 }, () => '#123456');
    assert.doesNotMatch(otherSeason.boards, /ΡΥΘΜΟΣ ΑΓΩΝΑ/);
    assert.doesNotMatch(otherSeason.season, /ΠΡΟΒΛΕΨΗ/);
    assert.deepEqual(renderNumbers(null, debrief, () => '#123456'), { boards: '', season: '', stamp: '', edition: '' });
});

test('the technical spread finds the article\'s team and shows its Friday numbers', () => {
    const { findTeamKey, renderTelemetry } = require('../home-panels');
    assert.equal(findTeamKey('Το B-spec της Williams και το πραγματικό τεστ'), 'williams');
    assert.equal(findTeamKey('Mercedes εναντίον Ferrari'), 'mercedes');
    assert.equal(findTeamKey('Η νέα εποχή των κανονισμών', 'Racing Bulls, 2026'), 'rb');
    assert.equal(findTeamKey('Red Bull RB22'), 'red_bull');
    assert.equal(findTeamKey('FIA 2026: κανονισμοί', ''), '');
    const round = {
        round: 14, grandPrix: 'Madrid GP', singleLapSession: 'Practice 2',
        teamIdealLap: [
            { pos: 1, teamKey: 'mercedes', teamName: 'Mercedes', idealLap: '1:33.524', gapToFirst: '+0.081', s1: '28.9', s2: '33.4', s3: '31.1' },
            { pos: 2, teamKey: 'ferrari', teamName: 'Ferrari', idealLap: '1:33.443', gapToFirst: null, s1: '28.8', s2: '33.4', s3: '31.1' },
            { pos: 3, teamKey: 'audi', teamName: 'Audi', idealLap: '1:34.701', gapToFirst: '+1.258', s1: '29.091', s2: '33.892', s3: '31.718' }
        ],
        cornerPerformance: [{ teamKey: 'audi', slowCorners: '+0.269', mediumCorners: '+0.568', fastCorners: '+0.604' }]
    };
    const audi = renderTelemetry(round, 'audi');
    assert.match(audi, /AUDI · ΙΔΑΝΙΚΟΣ ΓΥΡΟΣ ΟΜΑΔΑΣ/);
    assert.match(audi, /<span class="telemetry__sign">\+<\/span>1\.258/);
    assert.match(audi, /από την ταχύτερη \(Ferrari\) · 1:34\.701 · 3η από 3 ομάδες/);
    assert.match(audi, /R14 \/ MADRID GP/);
    assert.match(audi, /width:45%[\s\S]*width:94%[\s\S]*width:100%/);
    // No team named, or a team without data: the fastest team, and no corner bars without data.
    const fastest = renderTelemetry(round, '');
    assert.match(fastest, /FERRARI · ΙΔΑΝΙΚΟΣ ΓΥΡΟΣ ΟΜΑΔΑΣ/);
    assert.match(fastest, /telemetry__value">1:33\.443</);
    // The fastest ideal lap is first, whatever `pos` the bundle carries (Ferrari is listed with pos 2 here).
    assert.match(fastest, /Η ταχύτερη ομάδα · 1η από 3 ομάδες/);
    assert.doesNotMatch(fastest, /class="bars"/);
    assert.equal(renderTelemetry(null, 'audi'), '');
});

test('the homepage team gives every writer a spotlight card with their three newest stories', () => {
    const { renderHomeTeam } = require('../authors-page');
    const george = AUTHORS.find(author => author.slug === 'georgios-balatzis');
    const posts = [
        { id: 'A', title: 'Oldest', author: george.name, date: '2026-09-01' },
        { id: 'B', title: 'Newest', author: george.name, date: '2026-09-20' },
        { id: 'C', title: 'Other writer', author: 'Themis Charvalis', date: '2026-09-25' },
        { id: 'D', title: 'Second', author: george.name, date: '2026-09-15' },
        { id: 'E', title: 'Third', author: george.name, date: '2026-09-10' }
    ];
    const html = renderHomeTeam(posts);
    assert.equal((html.match(/class="team-card[ "]/g) || []).length, AUTHORS.length);
    assert.equal((html.match(/class="team-roster__item[ "]/g) || []).length, AUTHORS.length);
    // Only the first card and roster row start active; the page script takes over from there.
    assert.equal((html.match(/is-active/g) || []).length, 1);
    assert.equal((html.match(/is-current/g) || []).length, 1);
    // The roster tiles come first; the card is the spotlight article for the same writer.
    assert.ok(html.indexOf('class="team-roster"') < html.indexOf('data-team-spotlight'));
    const card = html.slice(html.indexOf('<article class="team-card" data-author-slug="georgios-balatzis"'));
    const stories = card.slice(card.indexOf('team-card__stories'), card.indexOf('</ul>'));
    assert.deepEqual([...stories.matchAll(/<span>([^<]+)<\/span><a[^>]*>([^<]+)</g)].map(m => [m[1], m[2]]),
        [['20 Σεπ 2026', 'Newest'], ['15 Σεπ 2026', 'Second'], ['10 Σεπ 2026', 'Third']]);
    assert.match(card, /ΟΛΑ ΤΑ ΑΡΘΡΑ ΤΟΥ ΓΙΩΡΓΟΥ/);
});

test('the article author card signs with the writer and degrades for an unknown name', () => {
    const card = renderAuthorCard({ author: 'Georgios Balatzis' });
    assert.match(card, /class="rr-pitwall__author" data-author-slug="georgios-balatzis"/);
    assert.match(card, /<h2 class="rr-pitwall__name" id="author-card-name">/, 'the pit wall is labelled by the writer');
    assert.match(card, /Γιώργος Μπαλατζής/);
    assert.match(card, /Τεχνική ανάλυση και αγωνιστικός ρυθμός/);
    assert.match(card, /index\.html\?author=georgios-balatzis">Όλα τα άρθρα του Γιώργου/);
    assert.match(card, /Instagram/);
    const team = renderAuthorCard({ author: 'F1 Stories Team' });
    assert.match(team, /data-author-slug="f1-stories"[\s\S]*F1S\.webp[\s\S]*Όλα τα άρθρα του F1 Stories/);
    assert.doesNotMatch(team, /Instagram/);
    const guest = renderAuthorCard({ author: 'Guest Writer' });
    assert.doesNotMatch(guest, /data-author-slug|<img|Instagram/);
    assert.match(guest, /id="author-card-name">Η ομάδα του F1 Stories</);
});

test('the author card migration replaces the old box once and stays idempotent', () => {
    const html = '<article class="article-container"><div class="article-header">x</div></article><div class="article-content"><p>Body.</p></div>\n'
        + '                    <div class="article-author-footer">\n                        <div class="author-box"><p class="author-name" id="author-name"><a href="/authors/">Old</a></p></div>\n                    </div>\n\n'
        + '                    <div class="sponsor-strip">S</div>';
    const post = { categories: ['Technical'], author: 'Thanasis Batalas' };
    const once = refreshArticleTaxonomy(html, post);
    assert.doesNotMatch(once, /author-box|article-author-footer/);
    assert.match(once, /data-author-slug="thanasis-batalas"[\s\S]*<div class="sponsor-strip">/);
    assert.equal(refreshArticleTaxonomy(once, post), once);
});

test('related articles use specific internal tags without rewarding generic F1 labels', () => {
    const base = { category: 'Analysis', categories: ['Analysis'], author: 'Author', date: '2026-09-01' };
    const post = { ...base, id: '1', tags: ['F1', 'Racing', 'Lewis Hamilton'] };
    const generic = { ...base, id: '2', tags: ['F1', 'Racing'] };
    const specific = { ...base, id: '3', tags: ['lewis hamilton'], author: 'Other' };
    assert.equal(scoreRelatedPosts([post, generic, specific], post, 0)[0].id, '3');
});

test('legacy headers keep comma-separated detail tags even when phrases contain spaces', () => {
    const metadata = extractMetadata('source.txt', 'F1 Racing, 2026, Lewis Hamilton, Ferrari F1\n\nA title\n\nBody text.');
    assert.equal(metadata.title, 'A title');
    const taxonomy = getPostTaxonomy(metadata);
    assert.ok(taxonomy.tags.includes('Lewis Hamilton'));
    assert.ok(taxonomy.tags.includes('Ferrari F1'));
    assert.deepEqual(taxonomy.categories, ['News']); // "2026" is only a tag; with no real category the post is News
    assert.ok(taxonomy.tags.includes('2026'));
});
