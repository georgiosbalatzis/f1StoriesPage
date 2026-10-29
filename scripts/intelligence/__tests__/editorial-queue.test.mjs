import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildQueue, applyDecision, renderQueue } from '../editorial-queue.mjs';
import { evaluateEditorialInsights } from '../editorial-insights.mjs';

const fixtures = fileURLToPath(new URL('./fixtures/editorial-queue/', import.meta.url));
const fixture = name => JSON.parse(fs.readFileSync(path.join(fixtures, `synthetic-${name}.json`), 'utf8'));
const cli = fileURLToPath(new URL('../editorial-queue.mjs', import.meta.url));
const tests = fileURLToPath(new URL('./', import.meta.url));
const root = path.resolve(tests, '../../..');
const empty = () => ({ version: 1, signals: {} });
const items = queue => queue.groups.flatMap(group => group.items);
const signalItems = queue => items(queue).filter(item => item.kind === 'signal');
function temporary(t, parent = os.tmpdir()) {
    const directory = fs.mkdtempSync(path.join(parent, 'tmp-editorial-queue-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    return directory;
}
function run(args, env = {}, cwd = root) {
    return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', cwd,
        env: { ...process.env, CI: '', GITHUB_ACTIONS: '', ...env } });
}
function freeze(value) {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
}

test('fixed grouping, Greek labels, pending defaults and abstentions in data_quality', () => {
    const insights = fixture('insights'), queue = buildQueue(insights);
    assert.deepEqual(queue.groups.map(row => [row.group, row.label]), [
        ['content_opportunity', 'Ευκαιρία περιεχομένου'], ['article_improvement', 'Βελτίωση υπάρχοντος άρθρου'],
        ['internal_discovery', 'Εσωτερική ανακάλυψη'], ['technical_seo', 'Τεχνικό SEO'],
        ['data_quality', 'Ποιότητα δεδομένων / Ανεπαρκή στοιχεία']
    ]);
    assert.ok(signalItems(queue).every(item => item.review.decision === 'pending' && item.review.date === null
        && item.review.note === '' && item.review.history.length === 0));
    assert.equal(queue.groups.at(-1).items[0].kind, 'abstention');
    assert.equal(queue.groups.at(-1).items[0].reason, insights.abstentions[0].reason);
    assert.equal(items(queue).length, insights.signals.length + insights.abstentions.length);
    const dataQuality = structuredClone(insights.signals[0]);
    Object.assign(dataQuality, { group: 'data_quality', signal_id: 'SYNTHETIC-quality-signal' });
    insights.signals.push(dataQuality);
    assert.ok(buildQueue(insights).groups.at(-1).items.some(item => item.signal_id === dataQuality.signal_id));
});

test('stale IDs and entire history are retained without mutation or mistaken resolution', () => {
    const insights = freeze(fixture('insights')), state = freeze(fixture('state'));
    const queue = buildQueue(insights, state);
    assert.deepEqual(queue.stale, [{ signal_id: 'SYNTHETIC-stale-id', stale: true, review: state.signals['SYNTHETIC-stale-id'] }]);
    const again = buildQueue({ ...insights, signals: [] }, state);
    assert.equal(again.stale.length, 2);
    assert.deepEqual(buildQueue(insights, state), queue);
    queue.stale[0].review.history[0].note = 'SYNTHETIC changed view';
    assert.notEqual(queue.stale[0].review.history[0].note, state.signals['SYNTHETIC-stale-id'].history[0].note);
    assert.match(renderQueue(buildQueue(insights, state)), /απουσία.*δεν αποδεικνύει επίλυση/);
});

test('deferred expiry is deterministic and view-only; until day is inclusive, absent until stays deferred', () => {
    const insights = fixture('insights'), state = fixture('state'), before = structuredClone(state);
    const id = insights.signals.find(signal => signal.group === 'technical_seo').signal_id;
    const find = queue => signalItems(queue).find(item => item.signal_id === id).review;
    assert.equal(find(buildQueue(insights, state)).decision, 'pending');
    assert.equal(find(buildQueue(insights, state)).expired, true);
    assert.equal(find(buildQueue({ ...insights, review_date: '2026-10-28' }, state)).decision, 'deferred');
    assert.equal(find(buildQueue({ ...insights, review_date: '2026-10-27' }, state)).expired, false);
    delete insights.review_date;
    assert.equal(find(buildQueue(insights, state)).decision, 'pending');
    const indefinite = applyDecision(state, id, 'deferred', { date: '2026-10-29', note: 'SYNTHETIC indefinite' });
    assert.equal(find(buildQueue(insights, indefinite)).decision, 'deferred');
    assert.deepEqual(state, before);
    assert.equal(find(buildQueue({ ...insights, asOf: null }, state)).decision, 'deferred');
});

test('all decisions append independent snapshots and preserve unknown IDs', () => {
    let state = freeze(fixture('state'));
    const id = fixture('insights').signals[0].signal_id;
    for (const decision of ['accepted', 'rejected', 'deferred', 'pending']) {
        const before = structuredClone(state), history = state.signals[id]?.history ?? [];
        const next = applyDecision(state, id, decision, { date: '2026-10-29', note: `SYNTHETIC ${decision}`,
            ...(decision === 'deferred' ? { until: '2026-11-01' } : {}) });
        assert.notEqual(next, state);
        assert.deepEqual(state, before);
        assert.deepEqual(next.signals[id].history.slice(0, -1), history);
        assert.equal(next.signals[id].history.length, history.length + 1);
        assert.deepEqual(next.signals['SYNTHETIC-stale-id'], state.signals['SYNTHETIC-stale-id']);
        state = freeze(next);
    }
    assert.equal(Object.hasOwn(state.signals[id], 'until'), false);
    assert.deepEqual(state.signals[id].history.map(entry => entry.decision), ['accepted', 'rejected', 'deferred', 'pending']);
    assert.equal(signalItems(buildQueue(fixture('insights'), state)).find(item => item.signal_id === id).review.decision, 'pending');
    const cloned = applyDecision(state, id, 'accepted', { date: '2026-10-29' });
    cloned.signals[id].history[0].note = 'SYNTHETIC mutate result';
    assert.notEqual(cloned.signals[id].history[0].note, state.signals[id].history[0].note);
    assert.equal(Object.hasOwn(applyDecision(empty(), '__proto__', 'pending', { date: '2026-10-29' }).signals, '__proto__'), true);
});

test('malformed states, dates, decisions, histories and insights fail closed', () => {
    for (const options of [{ date: '2026-02-30' }, { date: '2026-10-29', note: 'x'.repeat(501) },
        { date: '2026-10-29', note: 'SYNTHETIC\nmultiline' }, { date: '2026-10-29', until: '2026-10-28' },
        { date: '2026-10-29', until: '2026-11-31' }]) {
        assert.throws(() => applyDecision(empty(), 'SYNTHETIC', 'deferred', options));
    }
    assert.throws(() => applyDecision(empty(), 'SYNTHETIC', 'publish', { date: '2026-10-29' }));
    assert.throws(() => applyDecision(empty(), 'SYNTHETIC', 'pending', { date: '2026-10-29', until: '2026-11-01' }));
    assert.throws(() => applyDecision(empty(), '', 'pending', { date: '2026-10-29' }));
    const state = fixture('state');
    assert.throws(() => applyDecision(state, 'SYNTHETIC-stale-id', 'pending', { date: '2026-10-26' }));
    state.signals['SYNTHETIC-stale-id'].history = [];
    assert.throws(() => buildQueue(fixture('insights'), state));
    for (const change of [s => { s.signals['SYNTHETIC-stale-id'].note = 'SYNTHETIC inconsistent'; },
        s => { s.version = 2; }, s => { s.signals = []; }, s => { s.unrecognized = true; }]) {
        const bad = fixture('state'); change(bad);
        assert.throws(() => buildQueue(fixture('insights'), bad));
    }
    for (const change of [d => { d.signals.push(d.signals[0]); }, d => { d.signals[0].group = 'unknown'; },
        d => { d.asOf = 'bad'; }, d => { d.review_date = '2026-02-30'; }, d => { d.synthetic = 'true'; },
        d => { delete d.signals[0].observations; }, d => { d.abstentions[0].status = 'success'; }]) {
        const bad = fixture('insights'); change(bad);
        assert.throws(() => buildQueue(bad));
    }
});

test('deterministic plain Greek Markdown keeps evidence, long titles, raw counts, decisions and synthetic disclaimer', () => {
    const input = fixture('insights'), state = fixture('state');
    const output = renderQueue(buildQueue(input, state));
    assert.equal(renderQueue(buildQueue(input, state)), output);
    input.signals.reverse(); input.abstentions.reverse();
    assert.equal(renderQueue(buildQueue(input, state)), output);
    assert.match(output, /συνθετικά δεδομένα/);
    assert.match(output, /Υποστήριξη αποφάσεων, όχι οδηγίες/);
    assert.match(output, /Τίποτα δεν δημοσιεύεται αυτόματα/);
    assert.match(output, /χωρίς στατιστική κατάταξη ή πρόβλεψη επίδρασης/);
    assert.match(output, /όλες τις λέξεις ορατές χωρίς αποκοπή ή συντόμευση/);
    assert.match(output, /αριθμητές \/ παρονομαστές/);
    assert.match(output, /Αντίθετες ενδείξεις/);
    assert.match(output, /Ακριβείς περίοδοι \(exact_period\)/);
    assert.match(output, /Πηγές \(data_source\)/);
    assert.match(output, /minimum_sample_status/);
    assert.match(output, /confidence/);
    assert.match(output, /\(pending\)/);
    assert.match(output, /Η αναβολή έληξε/);
    assert.match(output, /\[Συμβόλαιο και περιορισμοί\]\(https:\/\/github.com/);
    assert.match(output, /clicks: 7/);
    assert.match(output, /impressions: 2100/);
    assert.doesNotMatch(output, /\|.*\||<table|<script|uplift/i);
    assert.deepEqual([...output.matchAll(/^### (\d+)\./gm)].map(match => Number(match[1])), [1, 2, 3, 4, 5]);
    const nested = fixture('insights');
    nested.signals[0].observations = { later: { clicks: 3, impressions: 100 }, earlier: { clicks: 1, impressions: 200 } };
    const nestedOutput = renderQueue(buildQueue(nested));
    assert.match(nestedOutput, /later\.clicks: 3/);
    assert.match(nestedOutput, /earlier\.impressions: 200/);
});

test('direct I-07B results are accepted without inventing synthetic provenance or abstention evidence', () => {
    const contract = JSON.parse(fs.readFileSync(new URL('./fixtures/editorial-insights/synthetic.json', import.meta.url), 'utf8'));
    const result = evaluateEditorialInsights(contract, { asOf: '2026-10-29' });
    const queue = buildQueue(result);
    assert.equal(signalItems(queue).length, result.signals.length);
    assert.equal(queue.synthetic, null);
    assert.match(renderQueue(queue), /Προέλευση συνθετικών δεδομένων: NOT VERIFIED/);
    const invalid = buildQueue(evaluateEditorialInsights({ version: 1, synthetic: true }));
    assert.equal(signalItems(invalid).length, 0);
    assert.equal(invalid.groups.at(-1).items[0].status, 'FAIL');
    assert.match(renderQueue(invalid), /Ακριβής περίοδος \(exact_period\): NOT VERIFIED/);
    assert.match(renderQueue(invalid), /δεν διαθέτει signal_id/);
    assert.doesNotMatch(renderQueue(buildQueue({ ...result, synthetic: false })), /ΠΡΟΣΟΧΗ: συνθετικά δεδομένα/);
});

test('notes and titles cannot inject Markdown HTML or unsafe evidence links', () => {
    const input = fixture('insights');
    input.signals[0].title = 'SYNTHETIC <script>alert(1)</script>\n# title';
    input.signals[0].evidence_links.push('javascript:alert(1)');
    const state = applyDecision(empty(), input.signals[0].signal_id, 'accepted', {
        date: '2026-10-29', note: 'SYNTHETIC [link](javascript:alert(1)) <img src=x>'
    });
    const report = renderQueue(buildQueue(input, state));
    assert.doesNotMatch(report, /<script|<img|\]\(javascript:|^# title/m);
    assert.match(report, /&lt;script&gt;/);
    assert.match(report, /\(accepted\)/);
});

test('CLI creates private state, appends history, renders without changing state and refuses overwrite', t => {
    const directory = temporary(t), statePath = path.join(directory, 'review.json'), out = path.join(directory, 'queue.md');
    const id = fixture('insights').signals[0].signal_id;
    let result = run(['decide', statePath, id, 'accepted', '--note=SYNTHETIC private owner note']);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /PASS/);
    fs.chmodSync(statePath, 0o644);
    result = run(['decide', statePath, id, 'pending']);
    assert.equal(result.status, 0, result.stderr);
    const before = fs.readFileSync(statePath, 'utf8'), state = JSON.parse(before);
    assert.equal(state.signals[id].history.length, 2);
    assert.equal(state.signals[id].history[0].decision, 'accepted');
    assert.equal(fs.statSync(statePath).mode & 0o777, 0o600);
    result = run(['render', path.join(fixtures, 'synthetic-insights.json'), `--state=${statePath}`, `--out=${out}`], {}, directory);
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout + result.stderr, /2100|1400|SYNTHETIC private owner note|tmp-editorial-queue/);
    const report = fs.readFileSync(out, 'utf8');
    assert.match(report, /συνθετικά δεδομένα/);
    assert.equal(fs.statSync(out).mode & 0o777, 0o600);
    assert.equal(fs.readFileSync(statePath, 'utf8'), before);
    const second = path.join(directory, 'second.md');
    assert.equal(run(['render', path.join(fixtures, 'synthetic-insights.json'), `--state=${statePath}`, `--out=${second}`]).status, 0);
    assert.equal(fs.readFileSync(second, 'utf8'), report);
    assert.equal(run(['render', path.join(fixtures, 'synthetic-insights.json'), `--out=${out}`]).status, 1);
    assert.equal(fs.readFileSync(out, 'utf8'), report);
    assert.equal(run(['decide', statePath, id, 'deferred', '--until=9999-12-31']).status, 0);
    assert.equal(JSON.parse(fs.readFileSync(statePath, 'utf8')).signals[id].until, '9999-12-31');
    assert.deepEqual(fs.readdirSync(directory).sort(), ['queue.md', 'review.json', 'second.md']);
});

test('CLI refuses repo state reads/writes and output, including symlink and traversal bypasses', t => {
    const directory = temporary(t), repoDirectory = temporary(t, tests);
    const repoState = path.join(repoDirectory, 'review.json'), repoOutput = path.join(repoDirectory, 'queue.md');
    fs.writeFileSync(repoState, JSON.stringify(empty()));
    const before = fs.readFileSync(repoState, 'utf8');
    const input = path.join(fixtures, 'synthetic-insights.json'), out = path.join(directory, 'queue.md');
    assert.equal(run(['render', input, `--state=${repoState}`, `--out=${out}`]).status, 1);
    assert.equal(run(['decide', repoState, 'SYNTHETIC', 'pending']).status, 1);
    assert.equal(run(['decide', path.join(repoDirectory, 'new.json'), 'SYNTHETIC', 'pending']).status, 1);
    assert.equal(run(['render', input, `--out=${repoOutput}`]).status, 1);
    fs.symlinkSync(repoDirectory, path.join(directory, 'into-repo'));
    assert.equal(run(['render', input, `--out=${path.join(directory, 'into-repo', 'queue.md')}`]).status, 1);
    assert.equal(run(['decide', path.join(directory, 'into-repo', 'review.json'), 'SYNTHETIC', 'pending']).status, 1);
    fs.symlinkSync(directory, path.join(repoDirectory, 'outside'));
    assert.equal(run(['render', input, `--out=${path.join(repoDirectory, 'outside', 'queue.md')}`]).status, 1);
    assert.equal(run(['render', input, `--out=${repoDirectory}/../${path.basename(repoDirectory)}/queue.md`]).status, 1);
    assert.equal(fs.readFileSync(repoState, 'utf8'), before);
    assert.equal(fs.existsSync(repoOutput), false);
    assert.equal(fs.existsSync(out), false);
});

test('CLI refuses CI before reading files, even synthetic fixtures', t => {
    const directory = temporary(t), state = path.join(directory, 'review.json'), out = path.join(directory, 'queue.md');
    for (const env of [{ CI: 'true' }, { GITHUB_ACTIONS: 'true' }]) {
        for (const args of [['render', path.join(fixtures, 'synthetic-insights.json'), `--out=${out}`],
            ['decide', state, 'SYNTHETIC', 'pending']]) {
            const result = run(args, env);
            assert.equal(result.status, 1);
            assert.match(result.stderr, /CI is refused/);
            assert.equal(result.stdout, '');
            assert.doesNotMatch(result.stderr, /tmp-editorial-queue/);
        }
    }
    assert.deepEqual(fs.readdirSync(directory), []);
});

test('CLI refuses other Git checkouts and worktrees through real and symlinked parents', t => {
    const directory = temporary(t), input = path.join(directory, 'insights.json');
    // All measurements remain invented; only the marker changes to exercise non-synthetic output.
    fs.writeFileSync(input, JSON.stringify({ ...fixture('insights'), synthetic: false }));
    for (const kind of ['file', 'directory']) {
        const checkout = path.join(directory, kind), nested = path.join(checkout, 'private', 'nested');
        fs.mkdirSync(nested, { recursive: true });
        const marker = path.join(checkout, '.git');
        if (kind === 'file') fs.writeFileSync(marker, 'gitdir: SYNTHETIC-worktree');
        else fs.mkdirSync(marker);
        const linked = path.join(directory, `${kind}-linked`);
        fs.symlinkSync(nested, linked);
        for (const parent of [checkout, nested, linked]) {
            for (const args of [['render', input, `--out=${path.join(parent, 'queue.md')}`],
                ['decide', path.join(parent, 'review.json'), 'SYNTHETIC', 'pending']]) {
                const result = run(args);
                assert.equal(result.status, 1, 'Git ancestors must refuse private output');
                assert.match(result.stderr, /FAIL/);
                assert.equal(result.stdout, '');
            }
        }
        assert.deepEqual(fs.readdirSync(checkout).sort(), ['.git', 'private']);
        assert.deepEqual(fs.readdirSync(path.dirname(nested)), ['nested']);
        assert.deepEqual(fs.readdirSync(nested), []);
    }
});

test('CLI failures preserve owner files and never echo paths, notes or parser input', t => {
    const directory = temporary(t), state = path.join(directory, 'private-state.json');
    const good = `${JSON.stringify(fixture('state'))}\n`;
    fs.writeFileSync(state, good);
    for (const args of [['decide', state, 'SYNTHETIC', 'publish'],
        ['decide', state, 'SYNTHETIC', 'deferred', '--until=bad', '--note=SYNTHETIC PRIVATE NOTE'],
        ['decide', state, 'SYNTHETIC', 'accepted', '--until=9999-12-31'],
        ['render', state, `--out=${path.join(directory, 'queue.md')}`]]) {
        const result = run(args);
        assert.equal(result.status, 1);
        assert.doesNotMatch(result.stderr, /SYNTHETIC PRIVATE|private-state|tmp-editorial-queue/);
        assert.equal(fs.readFileSync(state, 'utf8'), good);
    }
    fs.writeFileSync(state, 'SYNTHETIC PRIVATE MALFORMED JSON');
    const failure = run(['decide', state, 'SYNTHETIC', 'pending']);
    assert.equal(failure.status, 1);
    assert.doesNotMatch(failure.stderr, /SYNTHETIC PRIVATE|private-state|tmp-editorial-queue/);
    fs.symlinkSync(state, path.join(directory, 'linked.json'));
    fs.symlinkSync(path.join(directory, 'missing'), path.join(directory, 'dangling.json'));
    for (const file of ['linked.json', 'dangling.json']) {
        assert.equal(run(['decide', path.join(directory, file), 'SYNTHETIC', 'pending']).status, 1);
        assert.equal(run(['render', path.join(fixtures, 'synthetic-insights.json'), `--out=${path.join(directory, file)}`]).status, 1);
    }
    fs.linkSync(state, path.join(directory, 'hardlink.json'));
    assert.equal(run(['decide', path.join(directory, 'hardlink.json'), 'SYNTHETIC', 'pending']).status, 1);
    assert.equal(fs.readFileSync(state, 'utf8'), 'SYNTHETIC PRIVATE MALFORMED JSON');
    assert.equal(fs.existsSync(path.join(directory, 'queue.md')), false);
});
