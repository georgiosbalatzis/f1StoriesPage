const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const taxonomy = require('../../taxonomy');
const { PUBLIC_CATEGORIES, LEGACY_CATEGORY_OVERRIDES, normalizeTags, normalizeCategories, isPublicCategory, getPostTaxonomy } = taxonomy;

test('public vocabulary is fixed, ordered and immutable; legacy aliases never become public labels', () => {
    assert.deepEqual(PUBLIC_CATEGORIES, ['News', 'Analysis', 'Technical', 'History', 'Opinion', 'Betting', 'Drivers', 'Teams', '2026']);
    assert.ok(Object.isFrozen(PUBLIC_CATEGORIES));
    assert.deepEqual(normalizeCategories(['2026', 'Driver', 'Tech', 'Race-Analysis', 'bet', 'Historical', 'unknown', 'technical']), ['Analysis', 'Technical', 'History', 'Betting', 'Drivers', '2026']);
    assert.deepEqual(normalizeCategories('Racing,F1,Grand-Prix,random,2025,Ferrari'), []);
    assert.equal(isPublicCategory('History'), true);
    assert.equal(isPublicCategory('Historical'), false);
    assert.equal(isPublicCategory('history'), false);
});

test('tag normalization splits damaged delimiters, preserves names, deduplicates Unicode and casing', () => {
    assert.deepEqual(normalizeTags(['Racing,-2026,-Lewis-Hamilton,-Ferrari-F1', ['lewis hamilton; Ferrari_F1|#Αλέξης', 'ΑΛΈΞΗΣ', 'Cafe\u0301', 'Café'], null, {}]), ['Racing', '2026', 'Lewis Hamilton', 'Ferrari F1', 'Αλέξης', 'Café']);
    assert.deepEqual(normalizeTags(' , - ; | -- # | , '), []);
    const values = ['Red-Bull', 'red bull', 'Μίκα-Χάκινεν', '2026-season'];
    assert.deepEqual(normalizeTags(normalizeTags(values)), normalizeTags(values));
});

test('both malformed public examples migrate into one clean category and retained detail tags', () => {
    assert.deepEqual(getPostTaxonomy({ tag: 'F1', category: 'Racing,-2026,-Lewis-Hamilton,-Ferrari-F1' }), {
        category: '2026', categories: ['2026'], tags: ['F1', 'Racing', 'Lewis Hamilton', 'Ferrari F1']
    });
    assert.deepEqual(getPostTaxonomy({ tag: 'F1', category: 'Racing,-70ς,-History,-F1-Legends' }), {
        category: 'History', categories: ['History'], tags: ['F1', 'Racing', '70ς', 'F1 Legends']
    });
});

test('legacy specific categories beat generic F1/Racing and aliases keep useful detail', () => {
    assert.deepEqual(getPostTaxonomy({ tag: 'Historical', category: 'Racing' }), {
        category: 'History', categories: ['History'], tags: ['Historical', 'Racing']
    });
    assert.deepEqual(getPostTaxonomy({ tag: 'F1', category: 'BetCast' }), {
        category: 'Betting', categories: ['Betting'], tags: ['F1', 'BetCast']
    });
    assert.deepEqual(getPostTaxonomy({ tag: 'Drivers', category: 'Head2Head' }).categories, ['Analysis', 'Drivers']);
    assert.deepEqual(getPostTaxonomy({ tag: 'F1', category: 'Audi,-Cadillac' }).categories, ['Teams']);
    assert.deepEqual(getPostTaxonomy({ tag: 'F1', category: 'Racing,-Ferrari,-Lewis-Hamilton' }).categories, ['News']);
    assert.deepEqual(getPostTaxonomy({ tag: 'F1', category: 'Racing,-2026-season' }).categories, ['2026']);
});

test('modern categories are authoritative and explicit internal tags stay internal', () => {
    const modern = { id: '20260606J', category: 'Opinion', categories: ['Opinion'], tag: 'Technical', tags: ['2026', 'History', 'Lewis-Hamilton'] };
    assert.deepEqual(getPostTaxonomy(modern), { category: 'Opinion', categories: ['Opinion'], tags: ['2026', 'History', 'Lewis Hamilton'] });
    assert.deepEqual(getPostTaxonomy({ category: 'Teams', categories: ['Teams', 'Analysis', 'Analysis'], tags: [] }), { category: 'Teams', categories: ['Analysis', 'Teams'], tags: [] });
});

test('unknown labels are retained without date or title inference, and metadata objects are safe', () => {
    assert.deepEqual(getPostTaxonomy({ date: '2026-09-09', title: 'Technical history of 2026', tag: 'F1', category: 'Odd-Label' }), { category: 'News', categories: ['News'], tags: ['F1', 'Odd Label'] });
    assert.deepEqual(getPostTaxonomy(null), { category: 'News', categories: ['News'], tags: [] });
    assert.deepEqual(getPostTaxonomy({ id: 'toString', category: 'constructor' }), { category: 'News', categories: ['News'], tags: ['constructor'] });
});

test('reviewed legacy series overrides apply only to nonspecific legacy metadata', () => {
    for (const [id, category] of Object.entries(LEGACY_CATEGORY_OVERRIDES)) {
        assert.equal(getPostTaxonomy({ id, tag: 'F1', category: 'Racing' }).category, category);
        assert.equal(getPostTaxonomy({ id, tag: 'F1', category: 'Technical' }).category, 'Technical');
        assert.equal(getPostTaxonomy({ id, category: 'News', categories: ['News'] }).category, 'News');
    }
});

test('migration remains idempotent across the source cache and preserves normalized legacy detail', () => {
    const { posts } = require('../../blog-source-cache.json');
    for (const post of posts) {
        const result = getPostTaxonomy(post);
        assert.ok(result.categories.length > 0 && result.categories.every(isPublicCategory), post.id);
        assert.ok(result.categories.includes(result.category), post.id);
        assert.deepEqual(getPostTaxonomy({ ...post, ...result }), result, post.id);
        assert.deepEqual(getPostTaxonomy(result), result, post.id);
        for (const tag of normalizeTags([post.tag, post.tags, post.category])) {
            if (!isPublicCategory(tag)) assert.ok(result.tags.includes(tag), `${post.id}: ${tag}`);
        }
    }
});

test('browser and CommonJS share exactly the same taxonomy behavior', () => {
    const context = vm.createContext({});
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../../taxonomy.js'), 'utf8'), context);
    const post = { tag: 'F1', category: 'Racing,-70ς,-History,-F1-Legends' };
    assert.equal(JSON.stringify(context.F1S_TAXONOMY.getPostTaxonomy(post)), JSON.stringify(getPostTaxonomy(post)));
    assert.equal(JSON.stringify(context.F1S_TAXONOMY.PUBLIC_CATEGORIES), JSON.stringify(PUBLIC_CATEGORIES));
});
