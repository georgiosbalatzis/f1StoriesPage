// Future article URL policy (not activated): docs/search/article-url-policy.md.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const P = require('../url-policy');

const SITE = 'https://f1-stories.gr';
const GREEK_ID = '20260227Τ'; // Greek capital Tau, a real historical folder

// The contract's worked examples: headline → the slug an editor approves once, at first publication.
const CASES = [
    ['Formula 1', 'formula-1'],
    ['Ferrari SF-26', 'ferrari-sf-26'],
    ['Λιούις Χάμιλτον', 'liouis-chamilton'],
    ['Lewis Hamilton', 'lewis-hamilton'],
    ['Grand Prix Σιγκαπούρης', 'grand-prix-sigkapouris'],
    ['2026 Power Unit', '2026-power-unit'],
    ['Ο Βερστάπεν «κλέβει» τη νίκη!', 'o-verstapen-klevei-ti-niki'],
    ["Hamilton's last lap", 'hamiltons-last-lap']
];

test('approved slugs are lowercase ASCII words joined by single hyphens', () => {
    for (const [headline, slug] of CASES) assert.deepEqual(P.slugIssues(slug), [], headline);
    for (const slug of ['Formula-1', 'formula_1', 'formula--1', '-formula-1', 'formula-1-', 'formula 1',
        'ferrari-sf-26/', 'ferrari.sf26', 'αρθρο', 'λιούις-χάμιλτον', 'lioúis', 'grand-prix-%CF%83']) {
        assert.ok(P.slugIssues(slug).includes('format'), slug);
    }
    assert.ok(P.slugIssues('f1').includes('length'));
    assert.ok(P.slugIssues('a'.repeat(81)).includes('length'));
    assert.ok(P.slugIssues('2026').includes('no-letter'));
    assert.ok(P.slugIssues('20260222t').includes('legacy-shape'), 'a slug never looks like a folder id');
    for (const value of [undefined, null, 42, '']) assert.ok(P.slugIssues(value).includes('format'));
});

test('a slug is identical in a URL, on disk and in the sitemap', () => {
    for (const [, slug] of CASES) {
        assert.equal(encodeURIComponent(slug), slug);
        assert.equal(slug.normalize('NFC'), slug);
        assert.equal(slug.normalize('NFD'), slug);
        assert.equal(slug.toLowerCase(), slug, 'case-insensitive file systems cannot fold two slugs together');
        assert.equal(new URL(P.storyPath(slug), SITE).pathname, `/stories/${slug}/`);
    }
});

test('reserved first path segments cannot become slugs', () => {
    for (const name of ['telemetry', 'f1telemetry', 'ghostcar', 'tyres', 'betcast', 'authors', 'standings',
        'privacy', 'blog-module', 'stories', 'sitemap', 'feed']) {
        assert.ok(P.slugIssues(name).includes('reserved'), name);
    }
});

test('every top-level route of the built site is reserved', t => {
    const dist = path.resolve(__dirname, '../../../dist');
    if (!fs.existsSync(dist)) return t.skip('no dist/ (run npm run build:public)');
    const names = fs.readdirSync(dist).filter(name => !name.startsWith('.') && !name.startsWith('_'))
        .map(name => name.replace(/\.(?:min\.)?(?:html|xml|txt|js|css)$/, '').toLowerCase());
    for (const name of names) {
        if (/^(?:home|styles|theme-overrides)$/.test(name) || P.slugIssues(name).includes('format')) continue;
        assert.ok(P.RESERVED.has(name), `${name} is a live route but not reserved`);
    }
});

test('identity is the stored id and slug, never the headline', () => {
    const record = { id: '20261101G', slug: 'formula-1' };
    assert.equal(P.canonicalUrl({ ...record, title: 'Formula 1' }), P.canonicalUrl({ ...record, title: 'F1: corrected' }));
    assert.equal(P.canonicalUrl(record), `${SITE}/stories/formula-1/`);
    assert.equal(P.canonicalUrl({ id: record.id }), `${SITE}/blog-module/blog-entries/20261101G/article.html`);
    // Greek and Latin spellings of one name are different slugs, and so different identities.
    assert.notEqual(P.canonicalUrl({ id: 'a', slug: 'liouis-chamilton' }), P.canonicalUrl({ id: 'a', slug: 'lewis-hamilton' }));
});

test('the Greek historical folder id keeps its percent-encoded legacy URL and is never a slug', () => {
    assert.equal(P.legacyPath(GREEK_ID), '/blog-module/blog-entries/20260227%CE%A4/article.html');
    assert.equal(P.canonicalUrl({ id: GREEK_ID }), `${SITE}/blog-module/blog-entries/20260227%CE%A4/article.html`);
    assert.notEqual(P.legacyPath(GREEK_ID), P.legacyPath('20260227T'), 'Tau and Latin T are different folders');
    assert.ok(P.slugIssues(GREEK_ID).length > 0);
});

test('duplicate and reassigned slugs are refused; the same headline on two dates needs its own slug', () => {
    const twoDates = [{ id: '20261024G', slug: 'mesa-apo-to-f1ltro-mou' }, { id: '20261031G', slug: 'mesa-apo-to-f1ltro-mou' }];
    assert.deepEqual(P.registryIssues(twoDates), ['20261031G: slug "mesa-apo-to-f1ltro-mou" belongs to 20261024G']);
    assert.deepEqual(P.registryIssues([twoDates[0], { ...twoDates[1], slug: 'mesa-apo-to-f1ltro-mou-2' }]), []);
    // A deleted article's slug stays with it.
    assert.deepEqual(P.registryIssues([{ id: '20261105J', slug: 'ferrari-sf-26' }], [{ id: '20260301G', slug: 'ferrari-sf-26' }]),
        ['20261105J: slug "ferrari-sf-26" belongs to 20260301G']);
    // A published slug is not edited away, even when the headline changes.
    assert.deepEqual(P.registryIssues([{ id: '20260301G', slug: 'ferrari-sf-26-launch' }], [{ id: '20260301G', slug: 'ferrari-sf-26' }]),
        ['20260301G: published slug "ferrari-sf-26" changed']);
    assert.deepEqual(P.registryIssues([{ id: 'x', slug: 'formula-1' }, { id: 'x', slug: 'formula-one' }]), ['x: more than one slug']);
    assert.deepEqual(P.registryIssues([{ id: 'x', slug: 'tyres' }]), ['x: slug "tyres" reserved']);
    assert.deepEqual(P.registryIssues([{ id: '20220101G' }, { id: '20220102G' }]), [], 'legacy articles have no slug');
});

test('legacy-to-future mapping covers migrated history only, with encoded legacy paths', () => {
    const plan = P.redirectPlan([
        { id: GREEK_ID, slug: 'palia-koimomastan', legacy: true },
        { id: '20260222T', legacy: true },
        { id: '20261101G', slug: 'formula-1' }
    ]);
    assert.deepEqual([...plan], [['/blog-module/blog-entries/20260227%CE%A4/article.html', '/stories/palia-koimomastan/']]);
});

test('redirects take one hop to a served page and never loop', () => {
    const served = new Set(['/stories/a/', '/stories/b/']);
    assert.deepEqual(P.redirectIssues(new Map([['/old/a', '/stories/a/']]), served), []);
    assert.deepEqual(P.redirectIssues(new Map([['/old/a', '/old/a']]), served), ['/old/a: redirects to itself']);
    assert.deepEqual(P.redirectIssues(new Map([['/x', '/y'], ['/y', '/x']]), served), ['/x: redirect loop', '/y: redirect loop']);
    assert.deepEqual(P.redirectIssues(new Map([['/x', '/y'], ['/y', '/stories/a/']]), served), ['/x: redirect chain']);
    assert.deepEqual(P.redirectIssues(new Map([['/x', '/stories/gone/']]), served), ['/x: target /stories/gone/ is not a published page']);
    assert.deepEqual(P.redirectIssues(new Map([['/stories/b/', '/stories/a/']]), served), ['/stories/b/: served and redirected (double indexing)']);
});

test('canonical, Open Graph, JSON-LD, breadcrumb, sitemap, feed and links agree on one address', () => {
    const record = { id: '20261101G', slug: 'formula-1' };
    const url = `${SITE}/stories/formula-1/`;
    const good = { canonical: url, ogUrl: url, jsonLdUrl: url, breadcrumb: url, feedLink: url, feedGuid: url,
        sitemap: [`${SITE}/`, url], internal: ['/stories/formula-1/', url] };
    assert.deepEqual(P.surfaceIssues(record, good), []);
    assert.deepEqual(P.surfaceIssues(record, { ...good, ogUrl: `${SITE}/stories/formula-1` }),
        [`20261101G: ogUrl ${SITE}/stories/formula-1 ≠ ${url}`]);
    assert.deepEqual(P.surfaceIssues(record, { ...good, sitemap: [url, url] }), [`20261101G: sitemap lists ${url} 2 times`]);
    assert.deepEqual(P.surfaceIssues(record, { ...good, internal: ['/blog-module/blog-entries/20261101G/article.html'] }),
        ['20261101G: internal link /blog-module/blog-entries/20261101G/article.html is not the canonical']);

    // A migrated story keeps its original GUID, and its old URL leaves the sitemap.
    const legacy = `${SITE}/blog-module/blog-entries/20260227%CE%A4/article.html`;
    const migrated = { id: GREEK_ID, slug: 'palia-koimomastan' };
    const newUrl = `${SITE}/stories/palia-koimomastan/`;
    const surfaces = { canonical: newUrl, feedLink: newUrl, feedGuid: legacy, sitemap: [newUrl] };
    const redirected = new Set(P.redirectPlan([{ ...migrated, legacy: true }]).keys());
    assert.deepEqual(P.surfaceIssues(migrated, surfaces, { guid: legacy, redirected }), []);
    assert.deepEqual(P.surfaceIssues(migrated, { ...surfaces, feedGuid: newUrl }, { guid: legacy, redirected }), [`${GREEK_ID}: GUID changed`]);
    assert.deepEqual(P.surfaceIssues(migrated, { ...surfaces, sitemap: [newUrl, legacy] }, { guid: legacy, redirected }),
        [`${GREEK_ID}: sitemap lists redirected ${legacy}`]);
    // The sitemap carries the encoded form: a raw-Unicode loc is a different string.
    assert.deepEqual(P.surfaceIssues({ id: GREEK_ID }, { sitemap: [`${SITE}/blog-module/blog-entries/${GREEK_ID}/article.html`] }),
        [`${GREEK_ID}: sitemap lists ${legacy} 0 times`]);
});

test('the policy helper is not wired into the build', () => {
    const build = path.resolve(__dirname, '..');
    for (const file of fs.readdirSync(build, { recursive: true })) {
        if (!/\.js$/.test(file) || /__tests__/.test(file) || file === 'url-policy.js') continue;
        assert.ok(!/url-policy/.test(fs.readFileSync(path.join(build, file), 'utf8')), `${file} uses url-policy.js`);
    }
});
