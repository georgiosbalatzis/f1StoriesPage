const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { PUBLIC_CATEGORIES, AUTHORS, findAuthor, authorLabel, authorThumb, getPostTaxonomy } = require('../../taxonomy');
const {
    buildIndexPosts, buildCompactIndexData, buildHomeLatest,
    loadEditorialSelection, resolveJournalFront, renderJournalFront, renderLedgerRows
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

const frontPosts = Array.from({ length: 12 }, (_, index) => ({
    id: `p${index}`, title: `Story ${index}`, author: 'Georgios Balatzis',
    date: `2026-09-${String(20 - index).padStart(2, '0')}`, categories: ['Technical'], excerpt: 'Excerpt.', thumbnail: ''
}));

test('journal front falls back to the newest stories without a selection', () => {
    const front = resolveJournalFront(frontPosts, {});
    assert.equal(front.lead.id, 'p0');
    assert.deepEqual(front.secondary.map(post => post.id), ['p1', 'p2', 'p3']);
    assert.deepEqual(front.recent.map(post => post.id), ['p4', 'p5', 'p6', 'p7']);
    assert.deepEqual(front.deepReads, []);
    assert.deepEqual(front.warnings, []);
    assert.deepEqual(front.ids, ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7']);
});

test('journal front honours a valid selection and never repeats a story', () => {
    const front = resolveJournalFront(frontPosts, { lead: 'p5', secondary: ['p0', 'p5'], deepReads: ['p11', 'p10', 'p9'] });
    assert.equal(front.lead.id, 'p5');
    assert.deepEqual(front.secondary.map(post => post.id), ['p0', 'p1', 'p2']);
    assert.deepEqual(front.deepReads.map(post => post.id), ['p11', 'p10']);
    assert.deepEqual(front.recent.map(post => post.id), ['p3', 'p4', 'p6', 'p7']);
    assert.equal(new Set(front.ids).size, front.ids.length);
});

test('journal front drops unknown or deleted ids with a warning', () => {
    const front = resolveJournalFront(frontPosts, { lead: 'deleted-story', secondary: ['p3'], deepReads: ['gone'] });
    assert.equal(front.lead.id, 'p0');
    assert.deepEqual(front.secondary.map(post => post.id), ['p3', 'p1', 'p2']);
    assert.deepEqual(front.deepReads, []);
    assert.equal(front.warnings.length, 2);
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

test('journal front renders a text lead when the story has no image', () => {
    const html = renderJournalFront(resolveJournalFront(frontPosts, {}), { p0: 'A whole-sentence deck.' });
    assert.match(html, /class="journal-lead journal-lead--text" data-kind="technical"/);
    assert.match(html, /A whole-sentence deck\./);
    assert.doesNotMatch(html, /<img/);
    assert.match(html, /<span class="story-cat">ΤΕΧΝΙΚΑ<\/span>/);
});

test('archive ledger groups rows by month and marks the category signal', () => {
    const html = renderLedgerRows([
        { id: 'a', title: 'A', author: 'Themis Charvalis', date: '2026-09-02', categories: ['History'], readingTime: '4 min' },
        { id: 'b', title: 'B', author: 'Themis Charvalis', date: '2026-08-31', categories: ['Analysis', 'Drivers'], readingTime: '1 min' }
    ]);
    assert.equal((html.match(/class="ledger-month"/g) || []).length, 2);
    assert.match(html, /ΣΕΠΤΕΜΒΡΙΟΣ 2026[\s\S]*ΑΥΓΟΥΣΤΟΣ 2026/);
    assert.match(html, /data-kind="analysis"[\s\S]*ΑΝΑΛΥΣΗ/);
    assert.match(html, /2 ΣΕΠ<span class="visually-hidden"> 2026<\/span>/);
    assert.match(html, /Θέμης Χαρβάλης<\/span><span>1 λεπτό/);
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

test('the homepage journal numbers on from the cover and signs with short bylines', () => {
    const { renderHomeJournal } = require('../index');
    const post = (id, author, extra = {}) => ({ id, title: `Story ${id}`, author, date: '2026-09-27', readingTime: '4 min', categories: ['History'], ...extra });
    const html = renderHomeJournal([
        post('L', 'Themis Charvalis'),
        post('S1', 'F1 Stories Team'),
        post('S2', 'Guest Writer'),
        post('R1', 'Georgios Balatzis'), post('R2', 'Georgios Balatzis'), post('R3', 'Georgios Balatzis'), post('R4', 'Georgios Balatzis')
    ], 'The lead dek.');
    // Stories without a card image in the repo render as text-only.
    assert.equal((html.match(/home-story--text/g) || []).length, 3);
    assert.deepEqual([...html.matchAll(/home-story__idx" aria-hidden="true">(\d+)/g)].map(m => m[1]), ['02', '03', '04']);
    assert.deepEqual([...html.matchAll(/home-ledger__num" aria-hidden="true">(\d+)/g)].map(m => m[1]), ['05', '06', '07', '08']);
    assert.match(html, /<ol class="home-ledger" start="5">/);
    assert.match(html, /home-story__dek">The lead dek\./);
    assert.match(html, /Θ\. ΧΑΡΒΑΛΗΣ<\/p>/);
    assert.match(html, /F1 STORIES · 4 ΛΕΠΤΑ/);
    assert.match(html, /GUEST WRITER · 4 ΛΕΠΤΑ/);
    assert.match(html, /home-story__kind">ΙΣΤΟΡΙΑ/);
});

test('ON AIR shows the newest episode behind a facade and falls back to YouTube frames', () => {
    const { renderOnAir, splitEpisodeTitle } = require('../home-panels');
    assert.deepEqual(splitEpisodeTitle('BetCast #270  Hungaroring'), { series: 'BetCast #270', name: 'Hungaroring' });
    assert.deepEqual(splitEpisodeTitle('Charity Kart!'), { series: '', name: 'Charity Kart!' });
    const video = (id, title) => ({ id, title, publishedAt: '2026-07-25T12:00:00+00:00' });
    const html = renderOnAir({ videos: [video('l0vNNK6FO3g', 'BetCast #270  Hungaroring'), video('Q_SQJqa6CMU', 'Charity Kart!'), video('bad id', 'x'), video('iXCGUUeM-ag', 'CoolDownRoom #263')] },
        file => file.endsWith('l0vNNK6FO3g.webp'));
    assert.match(html, /data-video-id="l0vNNK6FO3g" data-video-title="BetCast #270: Hungaroring"/);
    assert.match(html, /episode__tab">BETCAST \/ #270</);
    // BetCast brings its own dek and hosts; a self-hosted lead keeps a width-based srcset.
    assert.match(html, /episode__dek/);
    assert.match(html, /<img alt="" src="\/images\/youtube\/l0vNNK6FO3g\.webp" srcset="[^"]+400w, [^"]+800w"/);
    // Invalid ids are skipped; a frame not fetched yet comes from YouTube.
    assert.equal((html.match(/episode--small/g) || []).length, 2);
    assert.match(html, /https:\/\/i\.ytimg\.com\/vi\/Q_SQJqa6CMU\/hqdefault\.jpg/);
    assert.match(html, /<span>F1 STORIES<\/span>/);
    assert.equal(renderOnAir({ videos: [] }), '');
});

test('ON AIR uses a newer published BetCast article when the YouTube snapshot is stale', () => {
    const { renderOnAir, selectEpisodes } = require('../home-panels');
    const snapshot = { videos: [{ id: 'l0vNNK6FO3g', title: 'BetCast #270: Hungaroring', publishedAt: '2026-07-25' }] };
    const article = (id, title, date) => ({ id, title, date, url: `/blog-module/blog-entries/${id}/article.html`, image: `/blog-module/blog-entries/${id}/1.webp`, author: 'Giannis Poulikidis' });
    const posts = [
        article('20260912J', 'BetCast #273: Προσπεράσεις', '2026-09-12'),
        article('20261004J', 'Ferrari update', '2026-10-04'),
        article('20261002J', 'BetCast #275: Το Grid', '2026-10-02'),
        article('20260725J', 'BetCast #270: Hungaroring', '2026-07-25'),
        article('invalid', 'BetCast #999: Invalid date', 'invalid')
    ];
    assert.deepEqual(selectEpisodes(snapshot, posts).map(item => item.id), ['20261002J', '20260912J', 'l0vNNK6FO3g']);
    const html = renderOnAir(snapshot, () => false, posts);
    const lead = html.slice(0, html.indexOf('<ol class="episodes"'));
    assert.match(lead, /episode__tab">BETCAST \/ #275</);
    assert.match(lead, /ΤΕΛΕΥΤΑΙΟ ΕΠΕΙΣΟΔΙΟ/);
    assert.match(lead, /datetime="2026-10-02">2 Οκτ 2026/);
    assert.match(lead, /href="\/blog-module\/blog-entries\/20261002J\/article\.html"/);
    assert.match(lead, /aria-label="Διαβάστε: BetCast #275: Το Grid"/);
    assert.doesNotMatch(lead, /data-video-id|#fa-play/);
    assert.match(html, /https:\/\/www\.youtube\.com\/watch\?v=l0vNNK6FO3g/);
    assert.match(renderOnAir(null, () => false, posts), /BETCAST \/ #275/);

    // A fresh feed takes over again without a manual homepage change.
    const fresh = { videos: [{ id: 'Q_SQJqa6CMU', title: 'BetCast #276: Next race', publishedAt: '2026-10-07' }] };
    const refreshedLead = renderOnAir(fresh, () => false, posts).split('<ol class="episodes"')[0];
    assert.match(refreshedLead, /data-video-id="Q_SQJqa6CMU"/);
    assert.match(refreshedLead, /BETCAST \/ #276/);
    assert.match(refreshedLead, /datetime="2026-10-07"/);
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

test('THE NUMBERS renders the top five, scales bars to the leader and pace to the fifth team', () => {
    const { renderNumbers } = require('../home-panels');
    const driver = (position, code, points) => ({ position: String(position), points: String(points), Driver: { code, familyName: code }, Constructors: [{ constructorId: 'mercedes', name: 'Mercedes' }] });
    const team = (position, name, points, wins) => ({ position: String(position), points: String(points), wins: String(wins), Constructor: { constructorId: name.toLowerCase(), name } });
    const table = (key, rows) => ({ MRData: { StandingsTable: { StandingsLists: [{ season: '2026', round: '15', [key]: rows }] } } });
    const standings = {
        driverStandings: table('DriverStandings', [driver(1, 'ANT', 200), driver(2, 'RUS', 100), driver(3, 'A', 50), driver(4, 'B', 40), driver(5, 'C', 30), driver(6, 'D', 20)]),
        constructorStandings: table('ConstructorStandings', [team(1, 'Mercedes', 300, 1), team(2, 'Ferrari', 150, 0)])
    };
    const debrief = { rounds: [
        { round: 14, location: 'Madrid', racePacePrediction: [
            { code: 'MER', teamColor: '00D7B6', predictedLap: '1:39.611', gapToFirst: null },
            { code: 'AMR', teamColor: '229971', gapToFirst: '+0.500' },
            { code: 'FER', teamColor: 'ED1131', gapToFirst: '+1.000' }
        ] },
        { round: 15, location: 'Baku', racePacePrediction: [] }
    ] };
    const { boards, stamp } = renderNumbers(standings, debrief, () => '#123456');
    assert.equal(stamp, '<span>ΣΕΖΟΝ 2026</span><span>ΜΕΤΑ ΤΟΝ ΓΥΡΟ 15</span>');
    assert.equal((boards.match(/board-row__code/g) || []).length, 5);
    assert.match(boards, /RUS[\s\S]*?width:50%/);
    assert.match(boards, /1 ΝΙΚΗ/);
    assert.match(boards, /0 ΝΙΚΕΣ/);
    // The newest round with a prediction; the slowest shown team sits at the end of the track.
    assert.match(boards, /R14 · MADRID/);
    assert.match(boards, /--x:0%[\s\S]*--x:50%[\s\S]*--x:100%/);
    assert.match(boards, /1:39\.611/);
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
    assert.match(fastest, /Η ταχύτερη ομάδα · 2η από 3 ομάδες/);
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
    const card = html.slice(html.indexOf('data-author-slug="georgios-balatzis"'));
    const stories = card.slice(card.indexOf('team-card__stories'), card.indexOf('</ul>'));
    assert.deepEqual([...stories.matchAll(/<span>([^<]+)<\/span><a[^>]*>([^<]+)</g)].map(m => [m[1], m[2]]),
        [['20 Σεπ 2026', 'Newest'], ['15 Σεπ 2026', 'Second'], ['10 Σεπ 2026', 'Third']]);
    assert.match(card, /ΟΛΑ ΤΑ ΑΡΘΡΑ ΤΟΥ ΓΙΩΡΓΟΥ/);
});

test('the article author card signs with the writer and degrades for an unknown name', () => {
    const card = renderAuthorCard({ author: 'Georgios Balatzis' });
    assert.match(card, /class="author-card" data-author-slug="georgios-balatzis"/);
    assert.match(card, /Γιώργος Μπαλατζής/);
    assert.match(card, /Τεχνική ανάλυση και αγωνιστικός ρυθμός/);
    assert.match(card, /index\.html\?author=georgios-balatzis">Όλα τα άρθρα του Γιώργου/);
    assert.match(card, /Instagram/);
    const team = renderAuthorCard({ author: 'F1 Stories Team' });
    assert.match(team, /data-author-slug="f1-stories"[\s\S]*F1S\.webp[\s\S]*Όλα τα άρθρα του F1 Stories/);
    assert.doesNotMatch(team, /Instagram/);
    const guest = renderAuthorCard({ author: 'Guest Writer' });
    assert.doesNotMatch(guest, /data-author-slug|<img|Instagram/);
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
