import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
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
test('ranking prefers exact subject fields, then whole words, then partial words, with stable ties and eight results', () => {
    const base = { categories: ['Analysis'], author: 'Author', date: '2026-10-01', tags: [] };
    const posts = [{ ...base, id: 'partial', title: 'Hamiltonian' }, { ...base, id: 'word', title: 'Hamilton wins' },
        { ...base, id: 'exact', title: 'Other', tags: ['Hamilton'] }];
    assert.equal(Array.from(api.search(posts, 'Hamilton'), hit => hit.post.id).join(','), 'exact,word,partial');
    assert.equal(api.search([{ ...base, id: 'greek', title: 'Οδηγός' }], 'οδηγος')[0].post.id, 'greek');
    assert.equal(api.search([{ ...base, id: 'body', title: 'Other', excerpt: 'Hamilton', body: 'Hamilton' }], 'Hamilton').length, 0);
    assert.equal(api.search(Array.from({ length: 20 }, (_, i) => ({ ...base, id: String(i), title: 'Hamilton' })), 'Hamilton').length, 8);
    assert.equal(api.search(posts, '!!!').length, 0);
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
test('module has no editor, persistence, publishing, arbitrary fetch or executable HTML access', () => {
    const source = fs.readFileSync(path.join(root, 'scripts/author/research-assistant.js'), 'utf8');
    assert.doesNotMatch(source, /gen-content|gen-title|gen-category|gen-tag|gen-author|gen-publish|F1S_LOCAL_DRAFTS|F1S_DRAFT_MANAGER|GITHUB|SESSION_TOKEN|api\.github|indexedDB|localStorage|sessionStorage|innerHTML|insertAdjacentHTML|eval\(/);
    assert.match(source, /credentials: 'omit'/); assert.match(source, /redirect: 'error'/);
});
