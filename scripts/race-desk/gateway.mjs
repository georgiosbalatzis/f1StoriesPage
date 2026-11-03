import { createHash } from 'node:crypto';
import { validateRegistry } from './core/index.mjs';
import { hubPath } from './hub-model.mjs';
import { PUBLIC_RACE_IDS } from './hub-publication.mjs';
import taxonomy from '../../blog-module/taxonomy.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const shape = (value, required, optional = []) => object(value)
  && required.every(key => Object.hasOwn(value, key))
  && Object.keys(value).every(key => required.includes(key) || optional.includes(key));
const string = (value, max = Infinity) => typeof value === 'string' && value.length > 0
  && value.length <= max && value === value.trim() && !/[\u0000-\u001f\u007f-\u009f]/.test(value);
const day = value => typeof value === 'string' && taxonomy.isDay(value);
const fail = message => { throw new Error(`gateways: ${message}`); };
const check = (condition, message) => { if (!condition) fail(message); };
const safeId = value => string(value) && /^[\p{L}\p{N}-]+$/u.test(value);
const kinds = ['before', 'weekend', 'after'];
const allowed = {
  before: ['schedule', 'stories', 'sources'],
  weekend: ['schedule', 'results'],
  after: ['results', 'timeline', 'pace', 'stories', 'sources'],
};
const targets = ['grid', 'telemetry', 'ghostcar', 'tyres'];
const toolKinds = ['exact', 'partial', 'generic'];
const publicIds = new Set(PUBLIC_RACE_IDS);

export function validateGatewayManifest(manifest, { registry, editorialManifest } = {}) {
  check(validateRegistry(registry).valid, 'invalid registry');
  check(shape(editorialManifest, ['schemaVersion', 'associations']) && editorialManifest.schemaVersion === 1 && Array.isArray(editorialManifest.associations), 'invalid editorial manifest');
  check(shape(manifest, ['version', 'gateways']) && manifest.version === 1 && Array.isArray(manifest.gateways), 'invalid manifest');
  const races = new Set(registry.races.map(race => race.raceId));
  const pairs = new Set(editorialManifest.associations.map(row => JSON.stringify([row?.articleId, row?.raceId])));
  const seen = new Set();
  for (const gateway of manifest.gateways) {
    check(shape(gateway, ['raceId', 'status', 'title', 'intro', 'perspectives', 'revised', 'review'], ['retired']), 'invalid gateway keys');
    try { hubPath(gateway.raceId); } catch { fail('invalid race ID'); }
    check(races.has(gateway.raceId), 'unknown race ID');
    check(!seen.has(gateway.raceId), 'duplicate race ID');
    seen.add(gateway.raceId);
    check(['draft', 'published', 'retired'].includes(gateway.status), 'invalid status');
    check(string(gateway.title, 90) && string(gateway.intro, 280), 'invalid title or intro');
    check(day(gateway.revised), 'invalid revised date');
    check(shape(gateway.review, ['status'], ['kind', 'by', 'date', 'contentSha256']), 'invalid review');
    if (gateway.review.status === 'pending') check(shape(gateway.review, ['status']), 'invalid pending review');
    else {
      check(gateway.review.status === 'approved' && shape(gateway.review, ['status', 'kind', 'by', 'date', 'contentSha256'])
        && gateway.review.kind === 'human' && string(gateway.review.by) && day(gateway.review.date)
        && gateway.review.date >= gateway.revised && typeof gateway.review.contentSha256 === 'string'
        && /^[a-f0-9]{64}$/.test(gateway.review.contentSha256), 'invalid approved review');
    }
    check(Object.hasOwn(gateway, 'retired') === (gateway.status === 'retired'), 'invalid retired block');
    if (gateway.status === 'retired') check(shape(gateway.retired, ['date', 'reason']) && day(gateway.retired.date) && string(gateway.retired.reason), 'invalid retirement');
    check(Array.isArray(gateway.perspectives) && gateway.perspectives.length >= 1 && gateway.perspectives.length <= 3, 'invalid perspectives');
    let previous = -1;
    for (const perspective of gateway.perspectives) {
      check(shape(perspective, ['kind', 'text', 'links']) && kinds.includes(perspective.kind) && string(perspective.text, 320), 'invalid perspective');
      const index = kinds.indexOf(perspective.kind);
      check(index > previous, 'perspectives out of order');
      previous = index;
      check(Array.isArray(perspective.links) && perspective.links.length >= 1 && perspective.links.length <= 5, 'invalid links');
      const refs = new Set();
      for (const link of perspective.links) {
        check(object(link), 'invalid link');
        let key;
        if (link.ref === 'article') {
          check(shape(link, ['ref', 'articleId']) && safeId(link.articleId) && perspective.kind !== 'weekend', 'invalid article ref');
          check(gateway.status === 'retired' || pairs.has(JSON.stringify([link.articleId, gateway.raceId])), 'article association missing');
          key = `article:${link.articleId}`;
        } else if (link.ref === 'section') {
          check(shape(link, ['ref', 'section']) && allowed[perspective.kind].includes(link.section), 'invalid section ref');
          key = `section:${link.section}`;
        } else if (link.ref === 'tool') {
          check(shape(link, ['ref', 'target', 'kind']) && targets.includes(link.target) && toolKinds.includes(link.kind)
            && (perspective.kind !== 'before' || link.target === 'tyres'), 'invalid tool ref');
          key = `tool:${link.target}`;
        } else fail('invalid ref');
        check(!refs.has(key), 'duplicate ref');
        refs.add(key);
      }
    }
  }
}

export function gatewayDigest(gateway) {
  const { raceId, title, intro, revised } = gateway;
  const perspectives = gateway.perspectives.map(({ kind, text, links }) => ({ kind, text, links: links.map(link => {
    if (link.ref === 'article') return { ref: link.ref, articleId: link.articleId };
    if (link.ref === 'section') return { ref: link.ref, section: link.section };
    return { ref: link.ref, target: link.target, kind: link.kind };
  }) }));
  return createHash('sha256').update(JSON.stringify({ raceId, title, intro, perspectives, revised }), 'utf8').digest('hex');
}

const safeUrl = value => {
  try { const url = new URL(value); return typeof value === 'string' && url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
};

export function selectGateways({ manifest, registry, editorialManifest, models, today } = {}) {
  validateGatewayManifest(manifest, { registry, editorialManifest });
  check(day(today), 'invalid today');
  check(Array.isArray(models), 'invalid models');
  const byRace = new Map();
  for (const model of models) {
    check(object(model) && !byRace.has(model.raceId), 'invalid or duplicate model');
    if (publicIds.has(model.raceId)) check(Array.isArray(model.stories) && object(model.timeline) && object(model.pace) && Array.isArray(model.sessions) && Array.isArray(model.tools), 'missing public model context');
    byRace.set(model.raceId, model);
  }
  return manifest.gateways.slice().sort((a, b) => a.raceId < b.raceId ? -1 : a.raceId > b.raceId ? 1 : 0).map(gateway => {
    const reasons = [], add = (code, detail) => reasons.push({ code, detail });
    if (gateway.status !== 'published') add('status', `status is ${gateway.status}`);
    if (gateway.review.status !== 'approved') add('approval', 'human approval pending');
    else {
      if (gateway.review.date > today) add('approval-date', `review date ${gateway.review.date} is in the future`);
      if (gateway.review.contentSha256 !== gatewayDigest(gateway)) add('digest', 'content digest mismatch');
    }
    if (gateway.revised > today) add('revised', `revised date ${gateway.revised} is in the future`);
    const model = byRace.get(gateway.raceId);
    if (!publicIds.has(gateway.raceId)) add('hub', 'race has no public hub');
    else if (gateway.status !== 'retired') check(model, `missing public model ${gateway.raceId}`);
    const evidence = [], tools = [], perspectives = [];
    if (gateway.status !== 'retired' && publicIds.has(gateway.raceId)) {
      for (const perspective of gateway.perspectives) {
        const links = [];
        for (const ref of perspective.links) {
          if (ref.ref === 'article') {
            const story = model.stories.find(item => item.articleId === ref.articleId);
            if (!story) evidence.push(`article ${ref.articleId} unavailable`);
            else links.push({ type: 'article', articleId: story.articleId, url: story.url, title: story.title, date: story.date });
          } else if (ref.ref === 'section') {
            const available = ref.section === 'sources' || (ref.section === 'schedule' && model.sessions.length > 0)
              || (ref.section === 'results' && Object.values(model.results?.classifications ?? {}).some(item => item?.status === 'available'))
              || (ref.section === 'timeline' && model.timeline.status === 'available')
              || (ref.section === 'pace' && model.pace.status === 'available')
              || (ref.section === 'stories' && model.stories.length > 0);
            if (!available) evidence.push(`section ${ref.section} unavailable`);
            else links.push({ type: 'section', section: ref.section });
          } else {
            const tool = model.tools.find(item => item.target === ref.target);
            if (!tool || tool.kind !== ref.kind || !safeUrl(tool.url)) tools.push(`tool ${ref.target} unavailable or changed`);
            else links.push({ type: 'tool', target: tool.target, label: tool.label, url: tool.url, kind: tool.kind, notice: tool.notice });
          }
        }
        perspectives.push({ kind: perspective.kind, text: perspective.text, links });
      }
    }
    for (const detail of evidence) add('evidence', detail);
    for (const detail of tools) add('tool', detail);
    const eligible = reasons.length === 0;
    return { raceId: gateway.raceId, status: gateway.status, eligible, reasons, view: eligible ? { raceId: gateway.raceId, title: gateway.title, intro: gateway.intro, perspectives } : null };
  });
}
