const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { PUBLIC_CATEGORIES, getPostTaxonomy } = require('../../taxonomy');
const {
    buildIndexPosts, buildCompactIndexData, summarizeCategories,
    loadEditorialSelection, resolveJournalFront, renderJournalFront, renderLedgerRows
} = require('../index');
const { refreshArticleTaxonomy, getEditorialProfile, renderArticleSources } = require('../article-render');
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
    assert.deepEqual(summarizeCategories(posts).map(category => category.name), PUBLIC_CATEGORIES);
    assert.equal(summarizeCategories(posts).find(category => category.name === '2026').count, 1);
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
    assert.deepEqual(getEditorialProfile(['Technical']), { category: 'Technical', kind: 'technical', label: 'ΤΕΧΝΙΚΟ ΔΕΛΤΙΟ' });
    assert.equal(getEditorialProfile(['Unknown']).kind, 'journal');

    const sources = renderArticleSources(
        'FIA Technical Regulations | https://www.fia.com/regulation/category/110; Unsafe | javascript:alert(1); Formula 1 timing | https://www.formula1.com/en/results.html',
        getEditorialProfile(['Technical'])
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
    assert.deepEqual(front.secondary.map(post => post.id), ['p1', 'p2']);
    assert.deepEqual(front.recent.map(post => post.id), ['p3', 'p4', 'p5', 'p6']);
    assert.deepEqual(front.deepReads, []);
    assert.deepEqual(front.warnings, []);
    assert.deepEqual(front.ids, ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6']);
});

test('journal front honours a valid selection and never repeats a story', () => {
    const front = resolveJournalFront(frontPosts, { lead: 'p5', secondary: ['p0', 'p5'], deepReads: ['p11', 'p10', 'p9'] });
    assert.equal(front.lead.id, 'p5');
    assert.deepEqual(front.secondary.map(post => post.id), ['p0', 'p1']);
    assert.deepEqual(front.deepReads.map(post => post.id), ['p11', 'p10']);
    assert.deepEqual(front.recent.map(post => post.id), ['p2', 'p3', 'p4', 'p6']);
    assert.equal(new Set(front.ids).size, front.ids.length);
});

test('journal front drops unknown or deleted ids with a warning', () => {
    const front = resolveJournalFront(frontPosts, { lead: 'deleted-story', secondary: ['p3'], deepReads: ['gone'] });
    assert.equal(front.lead.id, 'p0');
    assert.deepEqual(front.secondary.map(post => post.id), ['p3', 'p1']);
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
    assert.ok(taxonomy.categories.includes('2026'));
});
