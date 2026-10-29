import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const context = vm.createContext({ window: {}, URL, Date, console });
for (const file of ['blog-module/taxonomy.js', 'scripts/author/article-index.js', 'scripts/author/research-assistant.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
    if (file.includes('taxonomy')) context.window.F1S_TAXONOMY = context.F1S_TAXONOMY;
}
const api = context.window.F1S_RESEARCH;
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const fixture = () => read('standings/rounds/2026-17.json');
const note = overrides => ({ text: 'Δοκιμαστικό εύρημα', type: 'unverified', section: 'unverified', kind: 'general', verification: 'pending',
    sourceTitle: '', url: '', sourceDate: '', event: '', market: '', units: '', period: '', calculation: '', limitations: '', ...overrides });

test('research reuses compact v2 decoding and actual taxonomy/date/author metadata', () => {
    const posts = api.decodeIndex(read('blog-module/blog-index-data.json'));
    assert.ok(posts.length > 400);
    const cast = posts.find(post => post.id === '20261010J');
    assert.equal(cast.category, 'Betting'); assert.equal(cast.date, '2026-10-10'); assert.equal(cast.author, 'Giannis Poulikidis');
    assert.equal(cast.url, '/blog-module/blog-entries/20261010J/article.html');
    assert.throws(() => api.decodeIndex({ v: 1, p: [] }), /v2/);
});
const base = { categories: ['Analysis'], author: 'Author', date: '2026-10-01', tags: [], excerpt: '' };
const ids = hits => Array.from(hits, hit => hit.post.id).join(',');
test('ranking: more query words first, then headline > specific tag > excerpt > author, newer then ID on ties', () => {
    const posts = [{ ...base, id: 'author', title: 'Other', author: 'Hamilton' }, { ...base, id: 'excerpt', title: 'Other', excerpt: 'Hamilton wins' },
        { ...base, id: 'tag', title: 'Other', tags: ['Hamilton'] }, { ...base, id: 'title', title: 'Hamilton wins' },
        { ...base, id: 'stem', title: 'Hamiltons' }];
    // A headline word's beginning (6 × ½) equals an exact specific tag (3): the ID breaks the tie.
    assert.equal(ids(api.search(posts, 'Hamilton')), 'title,stem,tag,excerpt,author');
    assert.equal(api.search([{ ...base, id: 'year', title: '2026 review' }], '20261').length, 0, 'numbers match exactly');
    // Both words in the excerpt beat one word in the headline; the whole phrase in the headline beats scattered words.
    const coverage = [{ ...base, id: 'one', title: 'Pole lap' }, { ...base, id: 'both', title: 'Other', excerpt: 'pole at the Hungaroring' },
        { ...base, id: 'phrase', title: 'Hungaroring pole' }, { ...base, id: 'scattered', title: 'Pole, then Hungaroring' }];
    assert.equal(ids(api.search(coverage, 'Hungaroring pole')), 'phrase,scattered,both,one');
    const ties = [{ ...base, id: 'b', title: 'Brno' }, { ...base, id: 'a', title: 'Brno' }, { ...base, id: 'new', title: 'Brno', date: '2026-10-05' }];
    assert.equal(ids(api.search(ties, 'Brno')), 'new,a,b');
    assert.equal(ids(api.search(ties.slice().reverse(), 'Brno')), ids(api.search(ties, 'Brno')), 'input order does not matter');
    assert.deepEqual(api.search(ties, 'Brno'), api.search(ties, 'Brno'), 'repeatable');
    assert.equal(api.search(Array.from({ length: 40 }, (_, i) => ({ ...base, id: String(i), title: 'Hamilton' })), 'Hamilton').length, 24);
    assert.equal(api.search([{ ...base, id: 'exact', title: 'Ο τίτλος' }, { ...base, id: 'x', title: 'Ο τίτλος, και άλλο' }], 'ο ΤΙΤΛΟΣ')[0].reason, 'Ακριβής τίτλος');
});
test('Greek and Latin input ignore accents, case and final sigma; endings match by their beginning only', () => {
    const posts = [{ ...base, id: 'gr', title: 'Grand Prix Ουγγαρίας: η ΝΊΚΗ' }, { ...base, id: 'lat', title: 'McLaren in BAKU' }];
    for (const query of ['ουγγαρια', 'ΟΥΓΓΑΡΊΑ', 'Ουγγαρίας', 'νικη', 'Νίκη']) assert.equal(ids(api.search(posts, query)), 'gr', query);
    for (const query of ['baku', 'Baku', 'mclaren']) assert.equal(ids(api.search(posts, query)), 'lat', query);
    // No equivalences between scripts or invented synonyms.
    assert.equal(api.search(posts, 'Hungary').length, 0);
    assert.equal(api.search(posts, 'Μπακού').length, 0);
    // Short tokens match whole words only.
    assert.equal(api.search([{ ...base, id: 'x', title: 'Ferrari' }], 'fer').length, 0);
});
test('generic tags, stop words, categories and article bodies never make a match; empty input finds nothing', () => {
    const posts = [{ ...base, id: 'generic', title: 'Other', tags: ['F1', 'Racing', 'News', '2026', '2026 season', 'GP'], categories: ['News'] },
        { ...base, id: 'body', title: 'Other', body: 'Hamilton' }];
    for (const query of ['F1', 'Racing', 'News', '2026', 'GP', 'του', 'και', 'the']) assert.equal(api.search(posts, query).length, 0, query);
    assert.equal(api.search(posts, 'Hamilton').length, 0);
    for (const query of ['', '   ', '!!!', '—']) assert.deepEqual(Array.from(api.search(posts, query)), []);
    // A specific tag still counts next to generic ones, and the reason names what matched.
    const hit = api.search([{ ...base, id: 'specific', title: 'Other', tags: ['F1', 'Benetton'] }], 'Benetton')[0];
    assert.equal(hit.reason, 'Ετικέτες: Benetton');
    assert.equal(api.search([{ ...base, id: 'none', title: 'Other' }], 'Benetton').length, 0);
});
test('only published stories on the permanent article route are candidates; Greek IDs stay percent-encoded', () => {
    const decode = rows => api.eligible(api.decodeIndex({ v: 2, a: ['Author'], c: ['News'], t: [], p: rows.map(([id, date]) => [id, 'Τίτλος ' + id, 0, date, 400, 188, '', '1 min', [0], []]) }), '2026-10-26');
    const posts = decode([['20261026G', '2026-10-26'], ['20261025W', '2026-10-25'], ['20261027G', '2026-10-27'], ['20261001Λ', '2026-10-01']]);
    assert.deepEqual(posts.map(post => post.id), ['20261026G', '20261025W', '20261001Λ'], 'same day kept, future excluded');
    assert.equal(posts[2].url, '/blog-module/blog-entries/20261001%CE%9B/article.html');
    const forged = { ...posts[0], url: '/generate.html' }, foreign = { ...posts[0], url: 'https://example.com/blog-module/blog-entries/x/article.html' };
    assert.deepEqual(api.eligible([forged, foreign, { ...posts[0], date: 'soon' }, { ...posts[0], url: '/blog-module/blog-entries/OTHER/article.html' }], '2026-10-26'), []);
});
test('the real published index holds no retired, future or missing destinations', () => {
    const posts = api.decodeIndex(read('blog-module/blog-index-data.json'));
    const today = context.F1S_TAXONOMY.athensDay();
    const live = api.eligible(posts, today);
    assert.equal(live.length, posts.filter(post => post.date <= today).length);
    const retired = read('blog-module/retired-articles.json').retired.map(entry => entry.id);
    assert.deepEqual(retired.slice().sort(), ['20260227Τ', '20260822G']);
    for (const id of retired) {
        assert.equal(live.some(post => post.id === id), false, id);
        assert.equal(api.search(live, id).length, 0, id);
    }
    for (const post of live) assert.ok(fs.existsSync(path.join(root, 'blog-module/blog-entries', post.id, 'article.html')), post.id);
});
test('Markdown links use the author-supplied phrase and the exact canonical path, never the old headline', () => {
    const post = api.eligible(api.decodeIndex({ v: 2, a: ['A'], c: ['News'], t: [], p: [['20261001Λ', 'Παλιός τίτλος', 0, '2026-10-01', 400, 188, '', '1 min', [0], []]] }), '2026-10-26')[0];
    assert.equal(api.markdownLink('  η νίκη στην Ουγγαρία ', post), '[η νίκη στην Ουγγαρία](/blog-module/blog-entries/20261001%CE%9B/article.html)');
    for (const anchor of ['', '   ', null]) assert.throws(() => api.markdownLink(anchor, post), /Φράση συνδέσμου/);
    for (const anchor of ['με [αγκύλη]', 'δύο\nγραμμές', 'x'.repeat(201)]) assert.throws(() => api.markdownLink(anchor, post), /μία γραμμή/);
    assert.throws(() => api.markdownLink('φράση', { ...post, url: 'javascript:alert(1)' }), /έγκυρη διεύθυνση/);
});
test('PR 8 decisions: accepted targets are found by natural searches; rejected pairs are only text matches', () => {
    const live = api.eligible(api.decodeIndex(read('blog-module/blog-index-data.json')), '2026-10-26');
    const rank = (query, id) => api.search(live, query).findIndex(hit => hit.post.id === id) + 1;
    // Hungary pole, the Norris Hungary win, McLaren's Baku package, the Brno Sprint, the earlier GridCast, Spa 1995.
    for (const [query, id] of [['Hungary pole', '20260725W'], ['νίκη Norris', '20260727G'], ['McLaren Baku upgrade', '20260928G'],
        ['Brno Sprint', '20260620W'], ['Gridcast Singapore', '20261008J'], ['Spa 1995 Schumacher', '20260418W']]) assert.equal(rank(query, id), 1, query);
    assert.ok(rank('GridCast', '20261008J') <= 8);
    // Metadata cannot see the race inside the article: the Hungary win names neither Hungary nor Ουγγαρία.
    assert.ok(rank('Norris Ουγγαρία', '20260727G') > 1);
    // Rejected in PR 8 after reading. They may surface as text matches, labelled only with the fields that matched.
    for (const [query, id] of [['Safety Car Sepang', '20261006G'], ['Le Mans', '20260601W'], ['Hamilton Ferrari', '20260608W']]) {
        const hit = api.search(live, query).find(value => value.post.id === id);
        assert.ok(hit, query);
        assert.match(hit.reason, /^(?:(?:Τίτλος|Ετικέτες|Περίληψη|Συντάκτης): [^·]+)(?: · (?:Τίτλος|Ετικέτες|Περίληψη|Συντάκτης): [^·]+)*$/);
        assert.deepEqual(Object.keys(hit).sort(), ['matched', 'post', 'reason', 'score', 'terms']);
    }
});
test('catalogue inventories only existing round files and confirmed tool destinations', () => {
    const data = api.validateCatalog(read('scripts/author/research-catalog.json'));
    const actual = fs.readdirSync(path.join(root, 'standings/rounds')).filter(file => /^\d{4}-[1-9]\d?\.json$/.test(file));
    assert.equal(data.rounds.length, actual.length);
    for (const pair of data.rounds) assert.ok(actual.includes(pair.join('-') + '.json'));
    const bad = structuredClone(data); bad.tools[0].href = 'https://evil.example/'; assert.throws(() => api.validateCatalog(bad));
    assert.throws(() => api.validateCatalog({ ...data, rounds: [[2026, '../main']] }));
});
test('real pinned standings retain directly recorded values, source and generation time', () => {
    const data = fixture(), rows = api.snapshot(data, '2026', '17');
    const source = data.driverStandings.MRData.StandingsTable.StandingsLists[0].DriverStandings[0];
    assert.equal(rows[0].position, source.position); assert.equal(rows[0].points, source.points);
    const text = api.standingText(rows[0]);
    for (const part of ['2026', '17', data.raceName, data.generatedAt, data.source.driverStandingsUrl, 'ανεπίσημη', 'δεν έχει επαληθευτεί']) assert.ok(text.includes(part));
});
test('wrong rounds, inconsistent nested payloads, missing provenance and malformed records are rejected', () => {
    assert.throws(() => api.snapshot(fixture(), 2026, 16), /αντιστοιχεί/);
    for (const mutate of [data => { data.source = {}; }, data => { data.generatedAt = '2026-02-30'; },
        data => { data.constructorStandings.MRData.StandingsTable.StandingsLists[0].round = '16'; },
        data => { data.driverStandings.MRData.StandingsTable.StandingsLists[0].DriverStandings[0].points = '<script>'; }]) {
        const data = fixture(); mutate(data); assert.throws(() => api.snapshot(data, 2026, 17));
    }
    assert.throws(() => api.snapshot(null, '../../main', '17'));
});
test('safe source URLs reject scripts, credentials, whitespace and malformed links', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,<script>', '//example.com', 'https://user:secret@example.com', 'https://', 'https://example.com/ bad', 'file:///tmp/a']) assert.throws(() => api.safeURL(url));
    assert.equal(api.safeURL('https://example.com/source?date=2026'), 'https://example.com/source?date=2026');
    assert.equal(api.safeURL('http://example.com/source'), 'http://example.com/source');
});
test('manual findings stay unverified unless explicitly supported, and types remain distinct', () => {
    assert.equal(api.validateNote(note()).verification, 'pending');
    assert.throws(() => api.validateNote(note({ verification: 'checked' })), /παραμένει/);
    assert.throws(() => api.validateNote(note({ section: 'facts' })), /ρητή/);
    assert.throws(() => api.validateNote(note({ type: 'fact', section: 'facts', verification: 'checked' })), /τεκμηρίωσης/);
    const confirmed = api.validateNote(note({ type: 'fact', section: 'facts', verification: 'checked', sourceTitle: 'Πηγή', url: 'https://example.com', limitations: 'Ελέγχθηκε η συγκεκριμένη δήλωση.' }));
    assert.equal(confirmed.verification, 'checked');
    assert.throws(() => api.validateNote(note({ type: 'interpretation', section: 'facts', verification: 'checked' })));
    assert.throws(() => api.validateNote(note({ type: 'fact', verification: 'checked' })), /κατάλληλη ενότητα/);
});
test('statistics require units, sample period, source and formula with operands', () => {
    assert.throws(() => api.validateNote(note({ type: 'statistic' })), /αρχικές τιμές/);
    const value = api.validateNote(note({ type: 'statistic', section: 'statistics', units: 'βαθμοί', period: 'Δοκιμαστικό δείγμα 2', calculation: '2 + 3 = 5', url: 'https://example.com/data' }));
    const text = api.noteText(value); for (const part of ['βαθμοί', 'Δοκιμαστικό δείγμα 2', '2 + 3 = 5', 'https://example.com/data']) assert.ok(text.includes(part));
});
test('BetCast odds cannot claim verified historical prices without market and zoned timestamp', () => {
    assert.match(api.noteText(note({ kind: 'odds' })), /δεν τεκμηριώνει ιστορική τιμή/);
    const checked = note({ kind: 'odds', type: 'fact', section: 'facts', verification: 'checked', sourceTitle: 'Αγορά', url: 'https://example.com/market', limitations: 'Δοκιμή τεκμηρίωσης' });
    assert.throws(() => api.validateNote(checked), /χρονοσφραγίδα/);
    assert.throws(() => api.validateNote({ ...checked, sourceDate: '2026-10-22T10:00:00' }), /ζώνη ώρας/);
    assert.equal(api.validateNote({ ...checked, sourceDate: '2026-10-22T10:00:00+03:00', market: 'Δοκιμαστική αγορά' }).kind, 'odds');
    assert.throws(() => api.validateNote(note({ kind: 'prediction' })), /Πρόβλεψη/);
});
test('brief contains eight sections, exact Greek notes, uncertainty and citations without filler', () => {
    const text = api.brief('Ερώτημα α\u0301', '2026 / γύρος 17', [note({ text: 'Ακριβές α\u0301', sourceTitle: 'Πηγή', url: 'https://example.com' })]);
    for (const label of ['Εκδοτικό ερώτημα', 'Επιβεβαιωμένα γεγονότα', 'Αγωνιστικά στατιστικά', 'Πρωτογενείς πηγές', 'Τεχνικές ερμηνείες', 'Ανταγωνιστικές εξηγήσεις', 'Μη επαληθευμένοι ισχυρισμοί', 'Εσωτερικές αναφορές', 'Εκκρεμεί', 'Ακριβές α\u0301', 'https://example.com']) assert.ok(text.includes(label));
    assert.match(text, /Δεν έχουν καταγραφεί στοιχεία/);
});
test('module has no editor writes, persistence, publishing, arbitrary fetch or executable HTML access', () => {
    const source = fs.readFileSync(path.join(root, 'scripts/author/research-assistant.js'), 'utf8');
    // The one editor reference reads the selected phrase of the article body; nothing writes to it.
    assert.equal(source.match(/gen-content/g).length, 1);
    assert.match(source, /var body = document\.getElementById\('gen-content'\);\n\s+return body \? body\.value\.slice\(body\.selectionStart, body\.selectionEnd\)\.trim\(\) : '';/);
    assert.doesNotMatch(source, /body\.value\s*=|setRangeText|execCommand|dispatchEvent|setSelectionRange|\.select\(\)(?!;\s*message\('Δεν επιτράπηκε)/);
    assert.doesNotMatch(source, /gen-title|gen-category|gen-tag|gen-author|gen-publish|F1S_LOCAL_DRAFTS|F1S_DRAFT_MANAGER|GITHUB|SESSION_TOKEN|api\.github|indexedDB|localStorage|sessionStorage|innerHTML|insertAdjacentHTML|eval\(/);
    assert.match(source, /credentials: 'omit'/); assert.match(source, /redirect: 'error'/);
});

test('workspace validation preserves Unicode and unfinished inputs, rejects malformed or oversized data', () => {
    const form = note({ text: '', url: 'https://unfinished', sourceDate: '2026-', type: 'statistic' });
    const workspace = { version: 1, question: 'Ερώτηση α\u0301', anchor: 'φράση', season: '2026', round: '17',
        notes: [note({ text: 'Συνθετικό canary α\u0301', url: 'https://example.com/evidence' })], form };
    const result = api.validateWorkspace(workspace);
    assert.equal(result.question, workspace.question); assert.equal(result.form.sourceDate, '2026-');
    assert.equal(result.notes[0].url, workspace.notes[0].url); assert.notEqual(result.notes, workspace.notes);
    for (const bad of [{ ...workspace, version: 2 }, { ...workspace, extra: 'secret' }, { ...workspace, round: '01' },
        { ...workspace, season: '', round: '1' }, { ...workspace, notes: Array(501).fill(workspace.notes[0]) },
        { ...workspace, form: { ...form, url: 'x'.repeat(2001) } }, { ...workspace, notes: [note({ url: 'javascript:bad' })] },
        { ...workspace, notes: Array(200).fill(note({ text: 'α'.repeat(6000) })) }, { ...workspace, notes: Array(1) }]) assert.throws(() => api.validateWorkspace(bad));
    const empty = { version: 1, question: '', anchor: '', season: '', round: '', notes: [], form: note({ text: '' }) };
    assert.equal(api.validateWorkspace(empty), null);
    assert.ok(api.validateWorkspace({ ...empty, question: ' ' }));
    assert.ok(api.validateWorkspace({ ...empty, form: { ...empty.form, verification: 'checked' } }));
});

test('brief output remains byte-identical for a validated workspace', () => {
    const item = note({ text: 'Ακριβές α\u0301', sourceTitle: 'Πηγή', url: 'https://example.com' });
    const workspace = { version: 1, question: 'Ερώτημα α\u0301', anchor: '', season: '2026', round: '17', notes: [item], form: note({ text: '' }) };
    const validated = api.validateWorkspace(workspace);
    assert.equal(createHash('sha256').update(api.brief(validated.question, '2026 / γύρος 17', validated.notes)).digest('hex'),
        '41ff11644c8d62cb32dd9655ee20c7138992993828dd8deec8e6899e4f6eb029');
});


test('full text ranks the 25 reviewed archive passages within the first eight', () => {
    const manifest = api.validateContentManifest(read('scripts/author/research-content/manifest.json'));
    const content = new Map();
    for (const descriptor of manifest.shards) {
        const shard = api.validateContentShard(read('scripts/author/research-content/' + descriptor.file), descriptor);
        for (const article of shard.articles) content.set(article.id, article);
    }
    const posts = api.eligible(api.decodeIndex(read('blog-module/blog-index-data.json')), '2026-10-29');
    const cases = [
        [
                "minisectors ακορντεόν",
                "20261007F",
                "Καθώς το πεδίο κινούνταν αργά πίσω από το Saf"
        ],
        [
                "Paul Ricard 120",
                "20261007F",
                "Ούτε μπορούμε να πούμε ότι η βροχή ήταν εντελ"
        ],
        [
                "FW48 brake ducts",
                "20260930G",
                "Με αυτό το μάτι, η Williams ήταν από τις πιο "
        ],
        [
                "30 55 drag",
                "20260930G",
                "Οι νέοι κανονισμοί στήθηκαν πάνω σε αυτή τη λ"
        ],
        [
                "Maracana Ιντερλαγκος",
                "20260401W",
                "Στην πίστα του Ιντερλάγκος, η ατμόσφαιρα ήταν"
        ],
        [
                "454 575 1.029",
                "20261028W",
                "Το 2022 ο Verstappen κατέκτησε το δεύτερο παγ"
        ],
        [
                "Russell 9ος Hamilton 5ος",
                "20261022J",
                "Antonelli: να κερδίσει τον αγώνα. George Russ"
        ],
        [
                "TR010 HYBRID Hirakawa",
                "20261019W",
                "Η Toyota TR010 HYBRID των Sébastien Buemi, Br"
        ],
        [
                "μηχανικη προσφυση στροφη 11",
                "20261022J",
                "2) Μηχανική πρόσφυση: Σημαντική στις αργές στ"
        ],
        [
                "158 Alfetta",
                "20260403W",
                "Πρωτάθλημα του 1950 το πρώτο στην ιστορία και"
        ],
        [
                "12 χιλιοστα ΟΥΓΓΑΡΙΑ",
                "20261015G",
                "Στην Ουγγαρία, ο Norris πήρε την pole με την "
        ],
        [
                "1:31.276 573",
                "20261013G",
                "Η κατάσταση έγινε χειρότερη το βράδυ της Παρα"
        ],
        [
                "758 24 ωρες",
                "20261013G",
                "Από τα 573 χιλιοστά πίσω την Παρασκευή, ο Ant"
        ],
        [
                "usable downforce",
                "20261006F",
                "Γι' αυτό έχει σημασία να ξεχωρίζουμε το downf"
        ],
        [
                "120 προσπερασεις Αυστραλια",
                "20260408J",
                "Και για να μιλάμε και με στοιχεία, στο πρώτο "
        ],
        [
                "Jordan 1999",
                "20261027W",
                "Αργότερα, στη Jordan, ήρθε η πιο όμορφη περίο"
        ],
        [
                "Williams 1997",
                "20261027W",
                "Ο Frentzen δεν χρειάστηκε ποτέ να αποδείξει ό"
        ],
        [
                "Tamiya 1987 13",
                "20261026W",
                "Το 1987, σε ηλικία μόλις 13 ετών, πήρε μέρος "
        ],
        [
                "Phil Mills Impreza",
                "20261026W",
                "Το 2003 όμως ήταν η χρονιά που όλα άλλαξαν. Μ"
        ],
        [
                "JS43 Mugen 14ος",
                "20261021W",
                "Μονακό, 1996. Σε έναν από τους πιο χαοτικούς "
        ],
        [
                "Hamilton setup",
                "20261024J",
                "Τα πρώτα δύο ελεύθερα δοκιμαστικά έφεραν τη F"
        ],
        [
                "Pole Man balance",
                "20261024J",
                "Το Circuit είναι ενδιαφέρον, καθώς η ιστορία "
        ],
        [
                "ασφαλτοτάπητας Sprint",
                "20261010J",
                "Με το δεξί έγινε η αρχή για το GP της Σιγκαπο"
        ],
        [
                "0,250 FP2",
                "20261002J",
                "Αν και θα τολμήσω να πω ότι το φαβορί είναι η"
        ],
        [
                "0,0 0,1 2,8 Antonelli",
                "20260327J",
                "Pole Position : Andrea Kimi Antonelli -3.8 Δι"
        ]
];
    for (const [query, id, citation] of cases) {
        const hits = api.search(posts, query, content), rank = hits.findIndex(hit => hit.post.id === id);
        assert.ok(rank >= 0 && rank < 8, query + ' rank: ' + (rank + 1));
        assert.ok(hits[rank].passage.text.includes(citation), query + ': selected passage');
        assert.ok(Array.from(hits[rank].snippet).length <= 240, query + ': snippet length');
    }
});

test('body matching guards prefixes, numbers and passage coherence', () => {
    const post = { ...base, id: 'article', title: 'Other' };
    const body = text => new Map([['article', { headings: [], passages: [{ kind: 'paragraph', ordinal: 0, heading: -1, text }] }]]);
    assert.equal(api.search([post], '388', body('388mm')).length, 0);
    assert.equal(api.search([post], 'μετα', body('μεταφορά')).length, 0);
    assert.equal(api.search([post], 'Hungary', body('Ουγγαρία')).length, 0);
    assert.equal(api.search([post], 'ασφαλτοτάπητας', body('ασφαλτοτάπητα')).length, 0);
    assert.ok(api.search([post], 'ασφαλτοτάπητας Sprint', body('ασφαλτοτάπητα Sprint'))[0].reason.includes('πρόθεμα'));
    assert.equal(api.search([post], '0,250', body('10,250')).length, 0);
    assert.equal(api.search([post], '1.029', body('1 and 029')).length, 0);
    assert.equal(api.search([post], '0,250', body('0.250')).length, 0);
    assert.ok(api.search([post], '0,250', body('χρόνος 0,250 δευτερόλεπτα')).length);
    const foreign = new Map([['other', { headings: [], passages: [{ kind: 'paragraph', ordinal: 0, heading: -1, text: 'secret tool chrome' }] }]]);
    assert.equal(api.search([post], 'secret', foreign).length, 0);
    assert.equal(api.eligible([{ ...post, date: '2099-01-01', url: '/blog-module/blog-entries/article/article.html' }, { ...post, url: '/generate.html' }], '2026-10-29').length, 0);
});

test('content manifests and shards reject unsafe paths and malformed records', () => {
    const manifest = read('scripts/author/research-content/manifest.json');
    assert.throws(() => api.validateContentManifest({ ...manifest, shards: [{ ...manifest.shards[0], file: '../manifest.json' }] }));
    const descriptor = manifest.shards[0], shard = read('scripts/author/research-content/' + descriptor.file);
    assert.throws(() => api.validateContentShard({ ...shard, articles: [{ ...shard.articles[0], id: '../bad' }] }, { ...descriptor, articles: 1 }));
});

test('body scoring counts distinct words, caps repetition and selects the coherent earliest passage', () => {
    const posts = [{ ...base, id: 'x', title: 'Gamma' }, { ...base, id: 'y', title: 'Other' }];
    const paragraph = (ordinal, text) => ({ kind: 'paragraph', ordinal, heading: -1, text });
    const content = new Map([
        ['x', { headings: [], passages: [paragraph(2, 'alpha beta gamma delta epsilon'), paragraph(3, 'alpha beta gamma delta epsilon')] }],
        ['y', { headings: [], passages: [paragraph(0, 'alpha alpha alpha'), paragraph(1, 'beta gamma')] }]
    ]);
    const hits = api.search(posts, 'alpha beta gamma delta epsilon', content);
    assert.equal(hits[0].post.id, 'x'); assert.equal(hits[0].passage.ordinal, 2);
    assert.equal(hits[0].matched, 5); assert.equal(hits[0].score, 10);
    assert.equal(hits[1].matched, 2);
    const widget = read('scripts/author/research-content/2026-05.json').articles.find(article => article.id === '20260502J');
    assert.deepEqual(widget.passages, []);
});
