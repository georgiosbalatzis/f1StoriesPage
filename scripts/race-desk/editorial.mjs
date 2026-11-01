import { createHash } from 'node:crypto';
import { validateRegistry, normalizeSessionKind } from './core/index.mjs';
import hubs from '../../blog-module/build/entities/hubs.js';
import dates from '../../blog-module/build/article-dates.js';
import research from '../../blog-module/build/research-content.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const shape = (value, required, optional = []) => object(value)
  && required.every(key => Object.hasOwn(value, key))
  && Object.keys(value).every(key => required.includes(key) || optional.includes(key));
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const compare = (a, b) => {
  const left = Array.from(a, c => c.codePointAt(0)), right = Array.from(b, c => c.codePointAt(0));
  for (let i = 0; i < Math.min(left.length, right.length); i++) if (left[i] !== right[i]) return left[i] - right[i];
  return left.length - right.length;
};
const hash = value => createHash('sha256').update(value).digest('hex');
const safeId = value => typeof value === 'string' && /^[\p{L}\p{N}-]+$/u.test(value);
const lookup = (collection, key) => collection instanceof Map ? collection.get(key)
  : object(collection) && Object.hasOwn(collection, key) ? collection[key] : undefined;

/** Select reviewed, currently public article links. All evidence and publication checks are inputs. */
export function selectEditorialAssociations({ manifest, registry, articles, evidenceByPath, publicArticleIds, today } = {}) {
  const errors = [];
  const err = (code, articleId = null, raceId = null, path = null) => errors.push({ code, articleId, raceId, path });
  const validation = validateRegistry(registry);
  if (!validation.valid) err('invalid-registry');
  if (!dates.isCalendarDay(today) || typeof today !== 'string') err('invalid-today');
  if (!shape(manifest, ['schemaVersion', 'associations']) || manifest.schemaVersion !== 1 || !Array.isArray(manifest.associations)) err('invalid-manifest');
  const posts = Array.isArray(articles) ? articles : object(articles) && Array.isArray(articles.posts) ? articles.posts : null;
  if (!posts) err('invalid-articles');
  const publicIds = publicArticleIds instanceof Set ? publicArticleIds : Array.isArray(publicArticleIds) ? new Set(publicArticleIds) : null;
  if (!publicIds) err('invalid-public-article-ids');
  if (!(evidenceByPath instanceof Map) && !object(evidenceByPath)) err('invalid-evidence-input');
  const byId = new Map();
  for (const post of posts || []) {
    if (!object(post) || !nonempty(post.id)) { err('invalid-article'); continue; }
    if (byId.has(post.id)) err('duplicate-article', post.id);
    else byId.set(post.id, post);
  }
  if (errors.length) return { status: 'invalid', errors };

  const races = new Map(registry.races.map(race => [race.raceId, race]));
  const selected = new Map(registry.races.map(race => [race.raceId, []]));
  const pairs = new Set();
  for (const row of manifest.associations) {
    const articleId = object(row) && typeof row.articleId === 'string' ? row.articleId : null;
    const raceId = object(row) && typeof row.raceId === 'string' ? row.raceId : null;
    const fail = (code, path = null) => err(code, articleId, raceId, path);
    const before = errors.length;
    if (!shape(row, ['articleId', 'raceId', 'publishedDay', 'sessions', 'evidence'])) { fail('invalid-association'); continue; }
    if (!safeId(articleId)) { fail('invalid-article-id'); continue; }
    const pair = JSON.stringify([articleId, raceId]);
    if (pairs.has(pair)) fail('duplicate-association');
    pairs.add(pair);
    const post = byId.get(articleId), race = races.get(raceId);
    if (!post) fail('unknown-article');
    if (!race) fail('unknown-race');
    if (!dates.isCalendarDay(row.publishedDay) || typeof row.publishedDay !== 'string') fail('invalid-published-day');
    let url;
    if (post) {
      try {
        if (!nonempty(post.title) || post.date !== (post.dateISO ?? post.date)) throw new Error('invalid article metadata');
        for (const key of ['publishedAtISO', 'updatedDateISO']) if (Object.hasOwn(post, key) && (typeof post[key] !== 'string' || !post[key])) throw new Error('invalid timestamp');
        const result = dates.articleDates({ id: articleId, dateISO: post.dateISO ?? post.date, publishedAtISO: post.publishedAtISO, updatedDateISO: post.updatedDateISO });
        if (result.published.day !== row.publishedDay) fail('publication-day-drift');
        url = hubs.articleUrl(post);
        if (!hubs.isPublishedArticle(post, today, article => publicIds.has(article.id))) fail('article-not-public');
      } catch { fail('invalid-article-metadata'); }
    }
    const evidence = row.evidence;
    let checkReferences = () => false;
    if (!shape(evidence, ['path', 'basis', 'sha256', 'reviewedRevision', 'references'], ['note'])
      || !['source-bytes', 'published-passages-v1'].includes(evidence.basis)
      || typeof evidence.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(evidence.sha256)
      || typeof evidence.reviewedRevision !== 'string' || !/^[a-f0-9]{40}$/.test(evidence.reviewedRevision)
      || (Object.hasOwn(evidence, 'note') && !nonempty(evidence.note))) {
      fail('invalid-evidence');
    } else {
      const expected = `blog-module/blog-entries/${articleId}/${evidence.basis === 'source-bytes' ? 'source.txt' : 'article.html'}`;
      if (evidence.path !== expected) fail('invalid-evidence-path', evidence.path);
      else {
        const content = lookup(evidenceByPath, expected);
        if (typeof content !== 'string' && !Buffer.isBuffer(content) && !(content instanceof Uint8Array)) fail('missing-evidence', expected);
        else if (evidence.basis === 'source-bytes') {
          const lines = Buffer.from(content).toString('utf8').replace(/\r\n/g, '\n').split('\n');
          const end = lines[0] === '---' ? lines.findIndex((line, index) => index > 0 && line === '---') : -1;
          if (hash(content) !== evidence.sha256) fail('evidence-drift', expected);
          if (end < 1) fail('invalid-evidence-body', expected);
          checkReferences = refs => Array.isArray(refs) && refs.length > 0 && refs.every(ref => shape(ref, ['line', 'quote']) && Number.isSafeInteger(ref.line) && ref.line > end + 1 && nonempty(ref.quote) && !!lines[ref.line - 1]?.includes(ref.quote));
        } else {
          const html = Buffer.from(content).toString('utf8');
          const bodyMarkers = [...html.matchAll(/<div\b[^>]*>/gi)].filter(([tag]) => /\bclass\s*=\s*(["'])[^"']*\brr-body\b[^"']*\1/i.test(tag) && /\bclass\s*=\s*(["'])[^"']*\barticle-content\b[^"']*\1/i.test(tag) && /\bdata-body(?:\s|=|\/?>)/i.test(tag));
          const extracted = research.extract(html);
          if (bodyMarkers.length !== 1 || extracted.error || !extracted.passages.length) fail('invalid-evidence-body', expected);
          else if (hash(JSON.stringify({ headings: extracted.headings, passages: extracted.passages })) !== evidence.sha256) fail('evidence-drift', expected);
          checkReferences = refs => Array.isArray(refs) && refs.length > 0 && refs.every(ref => shape(ref, ['passageOrdinal', 'quote']) && Number.isSafeInteger(ref.passageOrdinal) && ref.passageOrdinal >= 0 && nonempty(ref.quote) && extracted.passages.some(p => p.ordinal === ref.passageOrdinal && p.text.includes(ref.quote)));
        }
      }
      if (!checkReferences(evidence.references)) fail('invalid-references', evidence.path);
    }
    let sessions = null;
    if (row.sessions !== null) {
      sessions = [];
      if (!Array.isArray(row.sessions) || !row.sessions.length) fail('invalid-sessions');
      else {
        const seen = new Set();
        for (const session of row.sessions) {
          if (!shape(session, ['kind', 'references'], ['openf1SessionKey']) || typeof session.kind !== 'string') { fail('invalid-session'); continue; }
          const kind = normalizeSessionKind(session.kind);
          const found = race?.sessions.find(item => item.kind === kind);
          if (!kind || !found) { fail('unknown-session'); continue; }
          if (seen.has(kind)) fail('duplicate-session');
          seen.add(kind);
          const key = Object.hasOwn(session, 'openf1SessionKey') ? session.openf1SessionKey : null;
          if (key !== null && (!Number.isSafeInteger(key) || key <= 0 || key !== found.openf1SessionKey)) fail('invalid-session-key');
          if (!checkReferences(session.references)) fail('invalid-session-references', evidence?.path ?? null);
          sessions.push({ kind, openf1SessionKey: key });
        }
        if (race) sessions.sort((a, b) => race.sessions.findIndex(s => s.kind === a.kind) - race.sessions.findIndex(s => s.kind === b.kind));
      }
    }
    if (errors.length === before) selected.get(raceId).push({ articleId, url, title: post.title, date: post.date, sessions });
  }
  if (errors.length) return { status: 'invalid', errors };
  return { status: 'valid', races: [...selected].sort(([a], [b]) => compare(a, b)).map(([raceId, links]) => ({ raceId, articles: links.sort((a, b) => compare(b.date, a.date) || compare(a.articleId, b.articleId)) })) };
}
