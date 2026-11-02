import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { selectEditorialAssociations } from '../editorial.mjs';

const require = createRequire(import.meta.url);
const { extract } = require('../../../blog-module/build/research-content.js');
const { articleIsPublic, articleUrl } = require('../../../blog-module/build/entities/hubs.js');
const read = path => readFileSync(new URL(`../../../${path}`, import.meta.url));
const json = path => JSON.parse(read(path));
const registry = json('data/race-desk/registry.v1.json');
const manifest = json('data/race-desk/editorial.v1.json');
const articles = json('blog-module/blog-source-cache.json');
const evidenceByPath = Object.fromEntries(manifest.associations.map(({ evidence }) => [evidence.path, read(evidence.path)]));
const publicArticleIds = new Set(articles.posts.filter(a => articleIsPublic(a)).map(a => a.id));
const options = () => ({ manifest: structuredClone(manifest), registry: structuredClone(registry), articles: structuredClone(articles), evidenceByPath: structuredClone(evidenceByPath), publicArticleIds: new Set(publicArticleIds), today: '2026-11-01' });
const select = opts => selectEditorialAssociations(opts);
const invalid = opts => { const result = select(opts); assert.equal(result.status, 'invalid', JSON.stringify(result)); assert.ok(result.errors.length); };
const valid = opts => { const result = select(opts); assert.equal(result.status, 'valid', JSON.stringify(result)); return result; };
const race = (result, id) => result.races.find(r => r.raceId === id);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

test('actual reviewed pilot uses real public pages, source bytes and stable public fields', () => {
  const opts = options(), before = JSON.stringify(opts);
  const result = valid(opts);
  assert.equal(JSON.stringify(opts), before);
  assert.equal(result.races.length, 6);
  assert.deepEqual(race(result, '2026-singapore-gp').articles.map(a => a.articleId), ['20261012W', '20261008J']);
  assert.deepEqual(race(result, '2026-mexican-gp').articles.map(a => a.articleId), ['20261031J']);
  assert.ok(result.races.filter(r => !['2026-singapore-gp', '2026-mexican-gp'].includes(r.raceId)).every(r => r.articles.length === 0));
  for (const entry of result.races.flatMap(r => r.articles)) {
    const original = articles.posts.find(a => a.id === entry.articleId);
    assert.deepEqual(Object.keys(entry).sort(), ['articleId', 'date', 'sessions', 'title', 'url']);
    assert.equal(entry.url, articleUrl(original)); assert.equal(entry.title, original.title); assert.equal(entry.date, original.date); assert.equal(entry.sessions, null);
  }
  opts.manifest.associations.reverse(); opts.articles.posts.reverse(); opts.registry.races.reverse();
  assert.deepEqual(valid(opts), result);
});

test('absence is valid, no automatic associations and malformed explicit manifests fail', () => {
  const opts = options(); opts.manifest = { schemaVersion: 1, associations: [] };
  opts.articles.posts.push({ id: 'draft', title: 'Singapore Mexico 2026', date: '2099-01-01', tags: ['Singapore'], draft: true });
  assert.ok(valid(opts).races.every(r => r.articles.length === 0));
  for (const value of [null, {}, { schemaVersion: 2, associations: [] }, { schemaVersion: 1, associations: [], extra: true }]) { opts.manifest = value; invalid(opts); }
});

test('unknown identities, duplicates and invalid session declarations fail', () => {
  for (const mutate of [
    o => { o.manifest.associations[0].raceId = '2026-unknown-gp'; },
    o => { o.manifest.associations[0].articleId = 'missing'; },
    o => { o.manifest.associations.push(structuredClone(o.manifest.associations[0])); },
    o => { o.articles.posts.push(structuredClone(o.articles.posts[0])); },
    o => { o.manifest.associations[0].sessions = []; },
    o => { o.manifest.associations[0].sessions = [{ kind: 'unknown', references: [{ line: 7, quote: 'πρωτάθλημα' }] }]; },
    o => { o.manifest.associations[0].sessions = [{ kind: 'race', openf1SessionKey: 1, references: [{ line: 7, quote: 'πρωτάθλημα' }] }]; },
    o => { o.manifest.associations[0].sessions = [{ openf1SessionKey: 1, references: [{ line: 7, quote: 'πρωτάθλημα' }] }]; },
  ]) { const opts = options(); mutate(opts); invalid(opts); }
});

test('a single article can be explicitly associated with two races and distinct ordered sessions', () => {
  const opts = options(), first = opts.manifest.associations[0];
  const ref = first.evidence.references;
  first.sessions = [{ kind: 'race', references: ref }, { kind: 'sprint', openf1SessionKey: null, references: ref }];
  const second = structuredClone(first); second.raceId = '2026-mexican-gp';
  second.sessions = [{ kind: 'race', references: ref }, { kind: 'fp1', references: ref }];
  opts.manifest.associations.push(second);
  const result = valid(opts);
  assert.deepEqual(race(result, first.raceId).articles.find(a => a.articleId === first.articleId).sessions.map(s => s.kind), ['sprint', 'race']);
  assert.deepEqual(race(result, second.raceId).articles.find(a => a.articleId === first.articleId).sessions.map(s => s.kind), ['fp1', 'race']);
  assert.ok(race(result, second.raceId).articles.find(a => a.articleId === first.articleId).sessions.every(s => s.openf1SessionKey === null));
  first.sessions.push(structuredClone(first.sessions[0])); invalid(opts);
});

test('evidence pins complete bytes, body line, quote and owned article path', () => {
  for (const mutate of [
    o => { o.evidenceByPath[o.manifest.associations[0].evidence.path] = Buffer.concat([o.evidenceByPath[o.manifest.associations[0].evidence.path], Buffer.from('\nchanged')]); },
    o => { o.manifest.associations[0].evidence.references[0].line = 1; },
    o => { o.manifest.associations[0].evidence.references[0].quote = 'not present'; },
    o => { delete o.evidenceByPath[o.manifest.associations[0].evidence.path]; },
    o => { o.manifest.associations[0].evidence.path = '../source.txt'; },
    o => { o.manifest.associations[0].evidence.path = o.manifest.associations[1].evidence.path; },
  ]) { const opts = options(); mutate(opts); invalid(opts); }
});

test('unchanged quoted lines do not conceal source drift', () => {
  const opts = options(), row = opts.manifest.associations[0], path = row.evidence.path;
  const source = Buffer.from(opts.evidenceByPath[path]).toString('utf8');
  const changed = source.replace('category: Analysis', 'category: Changed');
  assert.notEqual(changed, source);
  for (const ref of row.evidence.references) assert.ok(changed.split('\n')[ref.line - 1].includes(ref.quote));
  opts.evidenceByPath[path] = Buffer.from(changed);
  assert.ok(select(opts).errors.some(error => error.code === 'evidence-drift'));
});

test('removed articles, malformed evidence and publication day drift fail closed', () => {
  for (const mutate of [
    o => { o.articles.posts = o.articles.posts.filter(p => p.id !== o.manifest.associations[0].articleId); },
    o => { o.manifest.associations[0].extra = true; },
    o => { o.manifest.associations[0].evidence.sha256 = 'A'.repeat(64); },
    o => { o.manifest.associations[0].evidence.sha256 = 'a'.repeat(63); },
    o => { o.manifest.associations[0].evidence.reviewedRevision = 'g'.repeat(40); },
    o => { o.manifest.associations[0].evidence.reviewedRevision = 'a'.repeat(39); },
    o => { o.manifest.associations[0].publishedDay = '2026-10-09'; },
    o => { o.today = '2026-10-07'; },
  ]) { const opts = options(); mutate(opts); invalid(opts); }
});

test('titles are preserved verbatim and a non-canonical post URL rejects the whole selection', () => {
  const opts = options(), row = opts.manifest.associations[0];
  const post = opts.articles.posts.find(p => p.id === row.articleId);
  post.title = '<script>alert("title")</script>';
  assert.equal(race(valid(opts), row.raceId).articles.find(a => a.articleId === row.articleId).title, post.title);
  for (const url of ['javascript:alert(1)', 'https://evil.example/article.html', '/other/article.html']) {
    post.url = url;
    const result = select(opts);
    assert.equal(result.status, 'invalid');
    assert.deepEqual(result.errors.map(e => [e.code, e.articleId]), [['invalid-article-metadata', row.articleId]]);
  }
});

test('explicit records must be published, public, date-pinned and have valid Athens instants', () => {
  for (const mutate of [
    (o, a) => { a.draft = true; }, (o, a) => { a.published = false; }, (o, a) => { a.status = 'scheduled'; },
    (o, a) => { a.date = '2026-11-02'; a.dateISO = a.date; },
    (o, a) => { a.date = '2026-02-30'; a.dateISO = a.date; },
    (o, a) => { a.date = '2026-10-09'; a.dateISO = a.date; },
    (o, a) => { a.publishedAtISO = '2026-10-07T20:00:00Z'; },
    (o, a) => { a.updatedDateISO = '2026-10-07'; },
    (o, a) => { delete a.title; },
    (o, a) => { o.publicArticleIds.delete(a.id); },
  ]) { const opts = options(), a = opts.articles.posts.find(p => p.id === opts.manifest.associations[0].articleId); mutate(opts, a); invalid(opts); }
});

test('source-less public article uses extractor digest and ignores page shell changes', () => {
  const opts = options(), row = opts.manifest.associations[0];
  const html = '<html><nav>shell</nav><div class="rr-body article-content" data-body><h2>Weekend</h2><p>Singapore 2026 race context.</p></div></html>';
  const parsed = extract(html); assert.equal(parsed.error, undefined);
  row.evidence = { path: `blog-module/blog-entries/${row.articleId}/article.html`, basis: 'published-passages-v1', sha256: sha(JSON.stringify({ headings: parsed.headings, passages: parsed.passages })), reviewedRevision: 'bceff750ed0431cc151d3677d77b3fd5519bada3', references: [{ passageOrdinal: parsed.passages[1].ordinal, quote: 'Singapore 2026' }], note: 'Reviewed synthetic passage.' };
  opts.evidenceByPath[row.evidence.path] = html;
  valid(opts);
  opts.evidenceByPath[row.evidence.path] = html.replace('shell', 'changed shell'); valid(opts);
  opts.evidenceByPath[row.evidence.path] = html.replace('race context', 'changed context'); invalid(opts);
  opts.evidenceByPath[row.evidence.path] = '<html>no body</html>'; invalid(opts);
});

test('normalized aliases cannot duplicate a session', () => {
  const opts = options(), row = opts.manifest.associations[0];
  row.sessions = [{ kind: 'Race', references: row.evidence.references }, { kind: 'race', references: row.evidence.references }];
  invalid(opts);
});

test('Greek and Latin IDs remain distinct, encoded and sorted deterministically', () => {
  const opts = options(), original = opts.manifest.associations[0];
  const post = opts.articles.posts.find(a => a.id === original.articleId);
  for (const id of ['20261008T', '20261008Τ']) {
    const article = { ...post, id, url: `/blog-module/blog-entries/${encodeURIComponent(id)}/article.html` };
    const row = structuredClone(original), oldPath = row.evidence.path;
    row.articleId = id; row.evidence.path = `blog-module/blog-entries/${id}/source.txt`;
    opts.evidenceByPath[row.evidence.path] = opts.evidenceByPath[oldPath];
    opts.articles.posts.push(article); opts.publicArticleIds.add(id); opts.manifest.associations.push(row);
  }
  const entries = race(valid(opts), original.raceId).articles;
  assert.deepEqual(entries.map(a => a.articleId), ['20261012W', '20261008J', '20261008T', '20261008Τ']);
  assert.equal(entries.at(-1).url, 'https://f1-stories.gr/blog-module/blog-entries/20261008%CE%A4/article.html');
});

test('coverage report includes empty races and rejects an invalid day', async () => {
  const { spawnSync } = await import('node:child_process');
  const report = new URL('../editorial-report.mjs', import.meta.url);
  const run = day => spawnSync(process.execPath, [report.pathname, day], { encoding: 'utf8' });
  const ok = run('2026-11-01');
  assert.equal(ok.status, 0, ok.stderr);
  const output = JSON.parse(ok.stdout);
  assert.equal(output.races.find(r => r.raceId === '2026-mexican-gp').articleCount, 1);
  assert.equal(output.races.find(r => r.raceId === '2025-singapore-gp').articleCount, 0);
  assert.notEqual(run('not-a-day').status, 0);
});
