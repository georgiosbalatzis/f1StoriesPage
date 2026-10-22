const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { selectCastArticles, renderOnAir, splitEpisodeTitle, injectHomePanels } = require('../home-panels');
const { comparePosts } = require('../publish-order');

const article = (id, title, date = '2026-10-10', categories = ['Analysis']) => ({
    id, title, date, categories, author: 'Giannis Poulikidis',
    url: `/blog-module/blog-entries/${id}/article.html`,
    image: `/blog-module/blog-entries/${id}/1.webp`, imageWidth: 1600, imageHeight: 900
});

test.before(() => require('../image-sizes').primeImageDimensions());

test('explicit Cast prefixes match case insensitively with current and legacy numbering/punctuation', () => {
    const titles = [
        ['BetCast #276 - Singapore GP', 'BetCast #276', 'Singapore GP'],
        ['GRIDCAST #02 : Singapore - Ανάλυση', 'GRIDCAST #02', 'Singapore - Ανάλυση'],
        ['analystcast #1: Analysis', 'analystcast #1', 'Analysis'],
        ['Betcast #274 Baku', 'Betcast #274', 'Baku'],
        ['BetCast #272 .... Τέρμα γκάζι', 'BetCast #272', 'Τέρμα γκάζι'],
        ['BetCast #271.  Τέλος διακοπών', 'BetCast #271', 'Τέλος διακοπών'],
        ['Betcast: 267 Austria GP', 'Betcast #267', 'Austria GP'],
        ['BetCast 263: Προβλέψεις', 'BetCast #263', 'Προβλέψεις'],
        ['  gRiDcAsT : # 03 — GP  ', 'gRiDcAsT #03', 'GP'],
        ['AnalystCast – 4 | GP', 'AnalystCast #4', 'GP'],
        ['BetCast#270 Hungaroring', 'BetCast #270', 'Hungaroring'],
        ['AnalystCast: Season review', 'AnalystCast', 'Season review'],
        ['GridCast #05', 'GridCast #05', '']
    ];
    for (const [title, series, name] of titles) {
        const post = article('test', title);
        assert.deepEqual(splitEpisodeTitle(title), { series, name }, title);
        assert.deepEqual(selectCastArticles([post]), [post], title);
    }
});

test('only article title prefixes qualify; mentions, tags, categories, body and videos do not', () => {
    const unrelated = ['A BetCast #276 review', 'GridCaster #2', 'AnalystCasting #1', 'CoolDownRoom #263', 'GP analysis', ''];
    const posts = unrelated.map((title, i) => ({ ...article(`x${i}`, title, '2026-10-11', ['Betting']), tags: ['BetCast', 'GridCast', 'AnalystCast'], content: 'BetCast #1' }));
    posts.push({ ...article('invalid', 'GridCast #1'), date: 'invalid' });
    posts.push({ ...article('missing-url', 'GridCast #2'), url: undefined });
    posts.push({ ...article('wrong-url', 'GridCast #3'), url: '/blog-module/blog-entries/other/article.html' });
    posts.push({ ...article('external', 'BetCast #4'), url: 'https://www.youtube.com/watch?v=abcdefghijk' });
    posts.push({ title: 'AnalystCast #1', date: '2026-10-12' });
    assert.deepEqual(selectCastArticles(posts), []);
});

test('the newest three published records retain their categories, metadata and original URLs', () => {
    const posts = [
        article('20260930J', 'GridCast #01: Bahrain', '2026-09-30'),
        article('20261002J', 'BetCast #275: GP', '2026-10-02', ['Betting']),
        article('20261008J', 'GRIDCAST #02 : Singapore', '2026-10-08'),
        article('20261010J', 'Betcast #276 - Singapore', '2026-10-10', ['Betting'])
    ].sort(comparePosts);
    const before = JSON.stringify(posts);
    const selected = selectCastArticles(posts);
    assert.deepEqual(selected.map(post => post.id), ['20261010J', '20261008J', '20261002J']);
    selected.forEach((post, i) => assert.equal(post, posts[i]));
    assert.equal(JSON.stringify(posts), before);
    assert.deepEqual(selected.map(post => post.categories), [['Betting'], ['Analysis'], ['Betting']]);
    assert.deepEqual(selected.map(post => post.url), selected.map(post => `/blog-module/blog-entries/${post.id}/article.html`));
});

test('the selector preserves main-line same-day ordering and existing-order fallback', () => {
    const posts = ['A', 'Z', 'M', 'B'].map((id, i) => article(id, `GridCast #${i + 1}: GP`));
    for (const options of [
        { publishTimes: new Map([['A', 400], ['M', 300], ['Z', 200], ['B', 100]]) },
        { existingOrderById: new Map([['A', 0], ['M', 1], ['Z', 2], ['B', 3]]) }
    ]) {
        const ordered = [...posts].sort((a, b) => comparePosts(a, b, options));
        assert.deepEqual(selectCastArticles(ordered).map(post => post.id), ['A', 'M', 'Z']);
        assert.equal(renderOnAir(ordered), renderOnAir(ordered));
    }
});

test('IDs and genuine editions deduplicate across punctuation, case and leading zeros, independently per series', () => {
    const posts = [
        article('grid', 'GridCast #02: GP'),
        article('grid-copy', 'GRIDCAST: 2 — GP'),
        article('grid', 'GridCast #3: repeated ID'),
        article('bet', 'BetCast #2: GP', '2026-10-09', ['Betting']),
        article('analyst', 'AnalystCast #02: GP', '2026-10-08', ['Technical']),
        article('older', 'BetCast #1: GP', '2026-10-07', ['Betting'])
    ];
    assert.deepEqual(selectCastArticles(posts).map(post => post.id), ['grid', 'bet', 'analyst']);
});

test('historical and newer YouTube snapshots cannot displace article records', () => {
    const posts = [article('article', 'GridCast #2: GP')];
    for (const publishedAt of ['2020-01-01', '2099-01-01']) {
        const videos = [{ id: 'abcdefghijk', title: 'BetCast #999: Video', publishedAt }];
        assert.deepEqual(selectCastArticles([...videos, ...posts]), posts);
        assert.equal(renderOnAir([...videos, ...posts]), renderOnAir(posts));
        assert.equal(renderOnAir(videos), '');
    }
});

test('future AnalystCast publications enter automatically without placeholders or category assumptions', () => {
    const posts = [article('bet', 'BetCast #276: GP', '2026-10-10', ['Betting']), article('grid', 'GridCast #2: GP', '2026-10-08')];
    const html = renderOnAir(posts);
    assert.doesNotMatch(html, /ANALYSTCAST/);
    assert.equal((html.match(/episode--small/g) || []).length, 1);
    const future = article('analyst', 'AnalystCast #1: GP', '2026-10-23', ['Opinion']);
    const selected = selectCastArticles([future, ...posts]);
    assert.equal(selected[0], future);
    assert.deepEqual(selected[0].categories, ['Opinion']);
    assert.match(renderOnAir([future, ...posts]), /episode__tab">ANALYSTCAST \/ #1</);
    assert.equal(renderOnAir([]), '');
});

test('article rendering preserves image variants, dates, author and verified excerpt, with article labels', () => {
    const posts = [article('20261010J', 'Betcast #276 - Singapore', '2026-10-10', ['Betting']), article('20261008J', 'GRIDCAST #02 : Singapore - Ανάλυση', '2026-10-08')];
    posts[0].excerpt = 'Verified <summary> & details';
    const html = renderOnAir(posts);
    assert.match(html, /aria-label="Διαβάστε: Betcast #276: Singapore"/);
    assert.match(html, /home-story__byline">Γ\. ΠΟΥΛΙΚΙΔΗΣ</);
    assert.match(html, /datetime="2026-10-10">10 Οκτ 2026</);
    assert.match(html, /datetime="2026-10-08">8 Οκτ 2026</);
    assert.match(html, /1-card\.webp 400w, [^"]+1-mobile\.webp 800w, [^"]+1\.webp 1600w/);
    assert.match(html, /sizes="132px"/);
    assert.match(html, /episode__dek">Verified &lt;summary&gt; &amp; details</);
    assert.match(html, /ΤΕΛΕΥΤΑΙΟ ΑΡΘΡΟ/);
    assert.match(html, /aria-label="Περισσότερα άρθρα"/);
    assert.match(html, /<span>GRIDCAST #02<\/span>/);
    assert.doesNotMatch(html, /youtube|ytimg|data-video|fa-play|ΕΠΕΙΣΟΔΙΟ|επεισόδια|Αναπαραγωγή/);
    for (const title of ['GridCast #3: Analysis', 'AnalystCast #4: Analysis', 'BetCast #277: Predictions']) {
        assert.doesNotMatch(renderOnAir([article('test', title)]), /episode__dek/);
    }
});

test('an empty article pool clears previously rendered content', async () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-cast-'));
    const file = path.join(temp, 'index.html');
    try {
        fs.writeFileSync(file, ['home-onair', 'home-numbers', 'home-numbers-stamp', 'home-edition-round', 'home-season']
            .map(name => `<!-- f1s:${name}:begin -->stale<!-- f1s:${name}:end -->`).join(''));
        await injectHomePanels(file, []);
        assert.match(fs.readFileSync(file, 'utf8'), /<!-- f1s:home-onair:begin -->\s*<!-- f1s:home-onair:end -->/);
    } finally {
        fs.rmSync(temp, { recursive: true, force: true });
    }
});
