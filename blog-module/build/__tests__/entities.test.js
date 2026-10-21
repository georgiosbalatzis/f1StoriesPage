const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const path = require('node:path');
const test = require('node:test');
const {
    loadFoundation, normalizeAlias, validateRegistry, resolveAlias, findCandidates,
    validateAssociations, coverageReport, renderCoverage
} = require('../entities');

const seed = loadFoundation();
const clone = value => structuredClone(value);
function fixture() {
    const data = clone(seed);
    data.manifest.associations = [data.manifest.associations.find(item => item.articleId === '20260608W' && item.entityId === 'driver:lewis-hamilton')];
    data.manifest.associations[0].role = 'unresolved';
    data.manifest.associations[0].review = { status: 'pending' };
    delete data.manifest.associations[0].substantive;
    return data;
}
const validate = data => validateAssociations(data.registry, data.manifest, data.articles);
function approve(item, role) {
    item.role = role;
    delete item.proposedRole;
    item.review = { status: 'approved', kind: 'human', by: 'fixture-editor', date: '2026-10-21' };
    if (['primary', 'secondary'].includes(role)) item.substantive = true;
}

test('the six permanent identity keys, slugs and observed provider IDs stay stable', () => {
    assert.deepEqual(seed.registry.entities.map(({ id, type, slug, providerIds }) => [id, type, slug, providerIds?.jolpica || null]), [
        ['driver:lewis-hamilton', 'driver', 'lewis-hamilton', 'hamilton'],
        ['driver:lando-norris', 'driver', 'lando-norris', 'norris'],
        ['team:ferrari', 'team', 'ferrari', 'ferrari'],
        ['team:mclaren', 'team', 'mclaren', 'mclaren'],
        ['grand-prix:singapore', 'grand-prix', 'singapore', null],
        ['circuit:sepang', 'circuit', 'sepang', null]
    ]);
    // Identity provenance must survive later roster changes and driver retirement.
    const snapshot = require('../../../standings/rounds/2026-17.json');
    const drivers = snapshot.driverStandings.MRData.StandingsTable.StandingsLists[0].DriverStandings;
    const teams = snapshot.constructorStandings.MRData.StandingsTable.StandingsLists[0].ConstructorStandings;
    for (const entity of seed.registry.entities.filter(entity => entity.providerIds)) {
        const ids = entity.type === 'driver' ? drivers.map(row => row.Driver.driverId) : teams.map(row => row.Constructor.constructorId);
        assert.ok(ids.includes(entity.providerIds.jolpica), entity.id);
    }
});

test('normalization handles Unicode, Greek accents/final sigma and only supported punctuation', () => {
    assert.equal(normalizeAlias('  LEWIS\t—\tHamilton '), normalizeAlias('Lewis_Hamilton'));
    assert.equal(resolveAlias(seed.registry, 'ΛΙΟΥΙΣ ΧΑΜΙΛΤΟΝ'), 'driver:lewis-hamilton');
    assert.equal(resolveAlias(seed.registry, 'Λιούις Χάμιλτον'.normalize('NFD')), 'driver:lewis-hamilton');
    assert.equal(resolveAlias(seed.registry, 'Leweis Hamilton'), 'driver:lewis-hamilton');
    assert.equal(resolveAlias(seed.registry, 'Mclaren', 'f1-tag'), 'team:mclaren');
    for (const value of ['Hamilton', 'Ferrari', 'McLaren']) assert.equal(resolveAlias(seed.registry, value), null, 'scoped alias must be requested');
    for (const value of ['Lewis Hamilton biography', 'Lewis.Hamilton', 'Lewis/Hamilton', 'Hamilton, Lewis', 'Lewis Hamiltno']) {
        assert.equal(resolveAlias(seed.registry, value), null, value);
    }
});

test('scoped aliases reject collisions after normalization but allow distinct scopes', () => {
    const registry = clone(seed.registry);
    registry.entities[0].aliases.push({ value: 'Shared name', scope: 'f1-tag' });
    registry.entities[1].aliases.push({ value: 'SHARED_name', scope: 'wec-tag' });
    validateRegistry(registry);
    assert.equal(resolveAlias(registry, 'shared-name', 'f1-tag'), 'driver:lewis-hamilton');
    assert.equal(resolveAlias(registry, 'shared-name', 'wec-tag'), 'driver:lando-norris');
    registry.entities[1].aliases.at(-1).scope = 'f1-tag';
    assert.throws(() => validateRegistry(registry), /scoped alias collision/);
});

test('duplicate canonical IDs and duplicate type/slug pairs fail separately', () => {
    const registry = clone(seed.registry);
    registry.entities.push(clone(registry.entities[0]));
    assert.throws(() => validateRegistry(registry), /duplicate canonical ID/);
    registry.entities.at(-1).id = 'driver:another-person';
    assert.throws(() => validateRegistry(registry), /duplicate type\/slug/);
});

test('invalid entity types and missing registry fields are rejected', () => {
    for (const field of ['id', 'type', 'slug', 'name', 'labelEl', 'aliases', 'hub']) {
        const registry = clone(seed.registry);
        delete registry.entities[0][field];
        assert.throws(() => validateRegistry(registry), Error, field);
    }
    const registry = clone(seed.registry);
    registry.entities[0].type = 'manufacturer';
    assert.throws(() => validateRegistry(registry), /invalid entity type/);
});

test('unknown entity and article references fail', () => {
    const data = fixture();
    data.manifest.associations[0].entityId = 'team:toyota';
    assert.throws(() => validate(data), /unknown entity reference/);
    data.manifest.associations[0].entityId = 'driver:lewis-hamilton';
    data.manifest.associations[0].articleId = '20990101';
    assert.throws(() => validate(data), /unknown article reference/);
});

test('ambiguous names never silently map to one of the pilot drivers', () => {
    for (const value of ['Kimi', 'George', 'Senna', 'Prost', 'Pierre. Renault', 'Franco']) {
        assert.equal(resolveAlias(seed.registry, value), null);
        assert.equal(resolveAlias(seed.registry, value, 'f1-tag'), null);
    }
});

test('Toyota/Honda across disciplines cannot create F1 team identity', () => {
    const articles = seed.articles.filter(article => ['20261019W', '20261015W', '20261016W', '20261013W'].includes(article.id));
    assert.equal(articles.length, 4);
    assert.deepEqual(findCandidates(seed.registry, articles), [
        { articleId: '20261016W', entityId: 'team:ferrari', tags: ['Ferrari'] }
    ], 'Salo biography retains its explicit Ferrari candidate; Toyota/Honda do not create identities');
    for (const value of ['Toyota', 'Honda', 'Toyota WEC', 'Honda MotoGP']) {
        assert.equal(resolveAlias(seed.registry, value, 'f1-tag'), null);
    }
    const data = fixture();
    approve(data.manifest.associations[0], 'primary');
    data.manifest.associations[0].discipline = 'wec';
    validate(data);
    const entity = coverageReport(data.registry, data.manifest, data.articles).entities.find(item => item.id === 'driver:lewis-hamilton');
    assert.equal(entity.substantiveSubjects, 0, 'non-F1 confirmed subjects cannot satisfy F1 hub eligibility');
});

test('historical Sauber/Audi and current grid membership are not identity inference', () => {
    for (const value of ['Sauber', 'BMW Sauber', 'Audi', 'Stake', 'RB', 'Red Bull']) {
        assert.equal(resolveAlias(seed.registry, value, 'f1-tag'), null);
    }
    const historical = seed.articles.find(article => article.id === '20260710W');
    assert.match(historical.title, /BMW Sauber/);
    assert.deepEqual(findCandidates(seed.registry, [historical]).map(item => item.entityId), ['driver:lewis-hamilton', 'team:mclaren']);
    assert.equal(resolveAlias(seed.registry, 'Ferrari driver Lewis Hamilton', 'f1-tag'), null);
});

test('Singapore event aliases never resolve a circuit or geographic substring', () => {
    for (const value of ['Singapore GP', 'Singapore Grand Prix', 'Grand prix Singapore']) {
        assert.equal(resolveAlias(seed.registry, value), 'grand-prix:singapore');
    }
    for (const value of ['Singapore', 'Marina Bay', 'Thomson Road', 'Malaysian Grand Prix']) {
        assert.equal(resolveAlias(seed.registry, value), null);
    }
    const history = seed.manifest.associations.find(item => item.articleId === '20261009W' && item.entityId === 'grand-prix:singapore');
    assert.equal(history.discipline, 'mixed');
    assert.ok(history.flags.length > 0);
    assert.equal(history.role, 'unresolved');
});

test('Bahrain/Sepang source inconsistency stays explicitly unresolved', () => {
    const sepang = seed.manifest.associations.filter(item => item.entityId === 'circuit:sepang');
    assert.equal(sepang.length, 5);
    for (const item of sepang) {
        assert.equal(item.role, 'unresolved');
        assert.equal(item.proposedRole, 'unresolved');
        assert.equal(item.review.status, 'pending');
        assert.ok(item.flags.includes('bahrain-sepang-source-conflict'));
    }
    assert.equal(resolveAlias(seed.registry, 'Bahrain GP'), null);
    assert.equal(resolveAlias(seed.registry, 'Bahrain Grand Prix at Sepang'), null);
});

test('contradictory duplicate pairs fail; multiple subjects in one article are legitimate', () => {
    const data = fixture();
    const item = data.manifest.associations[0];
    approve(item, 'primary');
    const second = clone(item);
    second.entityId = 'team:ferrari';
    data.manifest.associations.push(second);
    validate(data);
    const conflicting = clone(item);
    approve(conflicting, 'excluded');
    data.manifest.associations.push(conflicting);
    assert.throws(() => validate(data), /contradictory association/);
});

test('agent proposals cannot claim confirmed membership or approval', () => {
    const data = fixture();
    data.manifest.associations[0].role = 'primary';
    assert.throws(() => validate(data), /pending review cannot confirm/);
    data.manifest.associations[0].review = { status: 'approved', kind: 'agent', by: 'automation', date: '2026-10-21' };
    assert.throws(() => validate(data), /human reviewer/);
});

test('only the six authorized subject classifications have human approval', () => {
    const approved = seed.manifest.associations.filter(item => item.review.status === 'approved');
    assert.deepEqual(approved.map(item => [item.entityId, item.articleId, item.role]), [
        ['driver:lando-norris', '20260725W', 'primary'],
        ['driver:lando-norris', '20260822W', 'primary'],
        ['driver:lando-norris', '20260824W', 'primary'],
        ['driver:lando-norris', '20260927G', 'secondary'],
        ['driver:lewis-hamilton', '20260608W', 'primary'],
        ['driver:lewis-hamilton', '20260929-2G', 'secondary']
    ]);
    for (const item of approved) {
        assert.equal(item.substantive, true);
        assert.deepEqual(item.review, { status: 'approved', kind: 'human', by: 'georgiosbalatzis', date: '2026-10-21' });
    }
    const pending = seed.manifest.associations.filter(item => item.review.status === 'pending');
    assert.equal(pending.length, 91);
    assert.ok(pending.every(item => item.role === 'unresolved' && item.substantive === undefined));
});

test('explicit human exclusions override tag candidates and do not count toward hubs', () => {
    const data = fixture();
    const item = data.manifest.associations[0];
    approve(item, 'excluded');
    validate(data);
    const report = coverageReport(data.registry, data.manifest, data.articles).entities.find(entity => entity.id === item.entityId);
    assert.equal(report.counts.excluded, 1);
    assert.equal(report.associations.find(row => row.articleId === item.articleId).role, 'excluded');
    assert.equal(report.substantiveSubjects, 0);
});

test('new unmatched-to-manifest candidates remain unresolved without blocking publishing', () => {
    const data = fixture();
    data.articles.push({ id: '20990101', title: 'New story', date: '2099-01-01', tags: ['Lewis Hamilton'] });
    validate(data);
    const report = coverageReport(data.registry, data.manifest, data.articles);
    const row = report.entities.find(entity => entity.id === 'driver:lewis-hamilton').associations.find(item => item.articleId === '20990101');
    assert.equal(row.role, 'unresolved');
    assert.deepEqual(row.flags, ['not-yet-reviewed']);
    assert.equal(row.evidence, undefined);
});

test('report serialization and ordering do not depend on article, entity or association order', () => {
    const reversed = clone(seed);
    reversed.registry.entities.reverse();
    reversed.manifest.associations.reverse();
    reversed.articles.reverse();
    reversed.manifest.associations = reversed.manifest.associations.map(item => Object.fromEntries(Object.entries(item).reverse()));
    reversed.manifest.associations.forEach(item => { item.tags.reverse(); item.flags.reverse(); });
    const report = coverageReport(seed.registry, seed.manifest, seed.articles);
    const other = coverageReport(reversed.registry, reversed.manifest, reversed.articles);
    assert.equal(JSON.stringify(other), JSON.stringify(report));
    assert.equal(renderCoverage(other), renderCoverage(report));
});

test('source evidence is real, belongs to the article and becomes invalid when stale', () => {
    validateAssociations(seed.registry, seed.manifest, seed.articles);
    const data = fixture();
    data.manifest.associations[0].evidence.quote = 'A quote that is not in the source';
    assert.throws(() => validate(data), /quote no longer matches/);
    data.manifest.associations[0].evidence.path = '../another-file';
    assert.throws(() => validate(data), /evidence must belong/);
});

test('required association fields, source tags and discipline are validated', () => {
    for (const field of ['role', 'discipline', 'review', 'proposedRole', 'evidence', 'flags', 'tags']) {
        const data = fixture();
        delete data.manifest.associations[0][field];
        assert.throws(() => validate(data), Error, field);
    }
    const data = fixture();
    data.manifest.associations[0].tags = ['not an actual source tag'];
    assert.throws(() => validate(data), /source tag missing/);
});

test('a taxonomy tag alone cannot serve as article-context evidence, even with human approval', () => {
    for (const [source, line, quote] of [
        ['F1 Lewis Hamilton\n\nAn article paragraph', 1, 'F1 Lewis Hamilton'],
        ['---\ntags: Lewis Hamilton\n---\n\nAn article paragraph', 2, 'tags: Lewis Hamilton']
    ]) {
        const data = fixture();
        const item = data.manifest.associations[0];
        approve(item, 'primary');
        item.evidence.line = line;
        item.evidence.quote = quote;
        assert.throws(() => validateAssociations(data.registry, data.manifest, data.articles, () => source), /article context beyond/);
    }
});

test('eligibility needs three substantive human-reviewed subjects, dates, introduction and approval', () => {
    const data = clone(seed);
    const entity = data.registry.entities.find(item => item.id === 'driver:lewis-hamilton');
    for (const item of data.manifest.associations.filter(item => item.entityId === entity.id)) {
        item.role = 'unresolved';
        item.review = { status: 'pending' };
        delete item.substantive;
    }
    const items = data.manifest.associations.filter(item => item.entityId === entity.id && item.proposedRole === 'primary');
    assert.equal(items.length, 3);
    items.forEach(item => approve(item, 'primary'));
    const eligibility = () => coverageReport(data.registry, data.manifest, data.articles).entities.find(item => item.id === entity.id);
    assert.equal(eligibility().provisionalHubEligibility, false);
    const human = { status: 'approved', kind: 'human', by: 'fixture-editor', date: '2026-10-21' };
    entity.hub.review = human;
    entity.hub.introduction = { text: 'A useful introduction reviewed by a fixture editor.', review: human };
    validate(data);
    assert.equal(eligibility().provisionalHubEligibility, true);
    items[0].substantive = false;
    assert.equal(eligibility().provisionalHubEligibility, false);
    items[0].substantive = true;
    const ids = new Set(items.map(item => item.articleId));
    data.articles.filter(article => ids.has(article.id)).forEach(article => { article.date = '2026-10-21'; });
    assert.equal(eligibility().provisionalHubEligibility, false);
});

test('all seeded hubs remain disabled despite the six approved subjects', () => {
    const report = coverageReport(seed.registry, seed.manifest, seed.articles);
    assert.ok(report.entities.every(entity => !entity.provisionalHubEligibility));
    assert.deepEqual(report.entities.filter(entity => entity.substantiveSubjects > 0).map(entity => [entity.id, entity.substantiveSubjects]), [
        ['driver:lando-norris', 4], ['driver:lewis-hamilton', 2]
    ]);
    assert.ok(seed.registry.entities.every(entity => entity.hub.review.status === 'pending'));
    const before = clone(seed);
    renderCoverage(report);
    assert.deepEqual(seed, before, 'reporting cannot mutate editorial decisions');
});

test('the exact approved Norris heading and introduction do not authorize hub publication', () => {
    const data = clone(seed);
    const entity = data.registry.entities.find(item => item.id === 'driver:lando-norris');
    assert.equal(entity.hub.introduction.heading, 'Λάντο Νόρις — Formula 1, αναλύσεις και ιστορίες');
    assert.equal(createHash('sha256').update(entity.hub.introduction.text).digest('hex'), 'c22b63f39a6e9bd3eead29609d352bd1e3cc0a98623060634394dc5640e0c2d4');
    assert.deepEqual(entity.hub.introduction.review, { status: 'approved', kind: 'human', by: 'georgiosbalatzis', date: '2026-10-21' });
    assert.deepEqual(entity.hub.review, { status: 'pending' });
    const eligibility = () => coverageReport(data.registry, data.manifest, data.articles).entities.find(item => item.id === entity.id);
    assert.equal(eligibility().provisionalHubEligibility, false);
    assert.deepEqual(eligibility().reasons, ['Public hub approval pending']);
    const human = { status: 'approved', kind: 'human', by: 'fixture-editor', date: '2026-10-21' };
    entity.hub.introduction.review = { status: 'pending' };
    entity.hub.review = human;
    validate(data);
    assert.equal(eligibility().provisionalHubEligibility, false, 'hub approval alone cannot approve the introduction');
    entity.hub.review = { status: 'pending' };
    entity.hub.introduction.review = human;
    validate(data);
    assert.equal(eligibility().provisionalHubEligibility, false, 'introduction approval alone cannot authorize publication');
    entity.hub.review = human;
    validate(data);
    assert.equal(eligibility().provisionalHubEligibility, true, 'both approvals are required in addition to the existing subjects');
});

test('an introduction heading is optional but must contain text when supplied', () => {
    const registry = clone(seed.registry);
    const introduction = registry.entities.find(item => item.id === 'driver:lando-norris').hub.introduction;
    for (const heading of ['', '  ', 42, null]) {
        introduction.heading = heading;
        assert.throws(() => validateRegistry(registry), /heading must be nonempty text/);
    }
    delete introduction.heading;
    validateRegistry(registry);
});

test('the standalone JSON CLI produces the same deterministic report as the module', () => {
    const cli = path.resolve(__dirname, '../entities/index.js');
    const run = () => execFileSync(process.execPath, [cli, '--json'], { cwd: __dirname, encoding: 'utf8' });
    const output = run();
    assert.equal(output, run());
    assert.deepEqual(JSON.parse(output), JSON.parse(JSON.stringify(coverageReport(seed.registry, seed.manifest, seed.articles))));
});
