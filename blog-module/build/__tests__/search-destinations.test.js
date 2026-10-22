const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadFoundation } = require('../entities');
const { buildHubPages } = require('../entities/hubs');
const { buildSearchDestinations, writeSearchDestinations } = require('../search-destinations');
const { validateIndex, matches, destination } = require('../../search-destinations');
const tools = require('../search-tools.json');
const options = { today: '2026-10-22', deps: { storyImage: () => '', renderStoryImage: () => '' } };
const build = f => buildHubPages(f.registry, f.manifest, f.articles, options);
const real = () => buildSearchDestinations(build(loadFoundation()));

test('only the human-approved generated Norris hub and five exact curated tools are indexed', () => {
    const data = real();
    assert.deepEqual(data.records.filter(r => r.type === 'entity').map(r => r.id), ['driver:lando-norris']);
    assert.equal(data.records.length, 6);
    assert.equal(data.records.find(r => r.id === 'standings').label, 'THE GRID — Βαθμολογίες F1');
    assert.deepEqual(data.records.filter(r => r.type === 'tool').map(r => r.href).sort(), [
        'https://f1-stories.gr/standings/',
        'https://georgiosbalatzis.github.io/f1-telemetry-dashboard/',
        'https://georgiosbalatzis.github.io/ghostcar/',
        'https://georgiosbalatzis.github.io/Tyres/',
        'https://georgiosbalatzis.github.io/BetCastVisualisation/'
    ].sort());
    for (const url of ['/f1telemetry/', '/ghostcar/', '/tyres/']) assert.ok(!data.records.some(r => r.href === url));
    for (const q of ['Λάντο', 'Λαντο', 'Νόρις', 'Νορισ', 'Norris', 'Lando Norris', 'LANDON NORRIS']) {
        assert.deepEqual(matches(data, q).filter(r => r.type === 'entity').map(r => r.id), ['driver:lando-norris'], q);
    }
    for (const q of ['τηλεμετρια', 'GHOST CAR', 'ελαστικα', 'στοιχημα', 'STANDINGS']) assert.ok(matches(data, q).some(r => r.type === 'tool'), q);
    assert.deepEqual(matches(data, 'Norris Lando'), [], 'aliases never concatenate into artificial matches');
    assert.deepEqual(matches(data, '  '), []);
});

test('generated first-page membership is mandatory; synthetic approval and withdrawal propagate', () => {
    const f = loadFoundation(), before = JSON.stringify(f);
    const norris = f.registry.entities.find(e => e.id === 'driver:lando-norris');
    const entity = structuredClone(norris);
    Object.assign(entity, { id: 'team:fixture', type: 'team', slug: 'fixture', name: 'Fixture', labelEl: 'Ελληνικό θέμα', aliases: [{ value: 'Fixture', scope: 'article-tag' }] });
    f.registry.entities.push(entity);
    f.manifest.associations.push(...f.manifest.associations.filter(a => a.entityId === norris.id).map(a => ({ ...a, entityId: entity.id })));
    const generated = build(f);
    assert.equal(buildSearchDestinations(generated).records.filter(r => r.type === 'entity').length, 2);
    assert.deepEqual(buildSearchDestinations({ ...generated, pages: [] }).records.filter(r => r.type === 'entity'), []);
    entity.hub.review = { status: 'pending' };
    assert.deepEqual(buildSearchDestinations(build(f)).records.filter(r => r.type === 'entity').map(r => r.id), [norris.id]);
    norris.hub.introduction.review = { status: 'pending' };
    assert.deepEqual(buildSearchDestinations(build(f)).records.filter(r => r.type === 'entity'), []);
    assert.equal(JSON.stringify(loadFoundation()), before, 'real editorial sources remain untouched');
});

test('generation is deterministic, deduplicates normalized aliases, replaces stale output and excludes editorial text', t => {
    const result = build(loadFoundation()), before = JSON.stringify(result);
    const manifest = structuredClone(tools);
    manifest[0].aliases.push('ΒΑΘΜΟΛΟΓΙΑ', '  βαθμολογία  ');
    const first = buildSearchDestinations(result, manifest);
    const second = buildSearchDestinations({ hubs: [...result.hubs].reverse(), pages: [...result.pages].reverse() }, manifest.reverse().map(r => ({ ...r, aliases: [...r.aliases].reverse() })));
    assert.equal(JSON.stringify(first), JSON.stringify(second));
    assert.equal(JSON.stringify(result), before);
    assert.ok(!JSON.stringify(first).includes('introduction'));
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'search-destinations-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const file = path.join(dir, 'index.json');
    writeSearchDestinations(result, file);
    const bytes = fs.readFileSync(file);
    writeSearchDestinations(result, file);
    assert.deepEqual(fs.readFileSync(file), bytes);
    writeSearchDestinations({ hubs: [], pages: [] }, file);
    assert.equal(JSON.parse(fs.readFileSync(file)).records.filter(r => r.type === 'entity').length, 0);
});

test('validation fails closed for unsupported, malformed, duplicate and unsafe destinations', () => {
    const sample = real().records[0];
    const check = record => validateIndex({ v: 1, records: [record] });
    for (const href of ['javascript:alert(1)', '//evil.test/a', 'https://u:p@f1-stories.gr/standings/', '/ghostcar/',
        sample.href + '?q=x', sample.href + '#x', 'https://evil.test/', '/blog-module/blog/entities/drivers/../foo/',
        'https://georgiosbalatzis.github.io/tyres/']) assert.throws(() => check({ ...sample, href }), href);
    for (const patch of [{ type: 'article' }, { label: '' }, { label: 'x'.repeat(161) }, { aliases: Array(21).fill('x') },
        { aliases: ['x'.repeat(101)] }, { aliases: ['Νόρις', 'Νορισ'] }, { id: '../bad' }, { introduction: 'private' }]) assert.throws(() => check({ ...sample, ...patch }));
    assert.throws(() => validateIndex({ v: 2, records: [] }));
    assert.throws(() => validateIndex({ v: 1, records: [sample, sample] }), /Duplicate/);
    assert.equal(destination({ type: 'tool', id: 'standings', href: 'https://f1-stories.gr/standings/' }), 'https://f1-stories.gr/standings/');
});
