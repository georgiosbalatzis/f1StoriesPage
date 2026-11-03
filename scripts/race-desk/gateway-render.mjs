import taxonomy from '../../blog-module/taxonomy.js';
import dates from '../../blog-module/build/article-dates.js';
import { GATEWAY_SECTIONS, PERSPECTIVE_HEADINGS, gatewayTargetId, toolNote } from './hub-presentation.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const text = value => typeof value === 'string' && value.trim() === value && !!value && !/[\u0000-\u001f\u007f-\u009f]/.test(value);
const keys = (value, expected) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
const allowed = { before: { article: true, section: ['schedule', 'stories', 'sources'], tool: ['tyres'] }, weekend: { section: ['schedule', 'results'], tool: ['grid', 'telemetry', 'ghostcar', 'tyres'] }, after: { article: true, section: ['results', 'timeline', 'pace', 'stories', 'sources'], tool: ['grid', 'telemetry', 'ghostcar', 'tyres'] } };
const https = value => {
  try {
    const url = new URL(value);
    return text(value) && url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
};

function validateView(view) {
  if (!keys(view, ['raceId', 'title', 'intro', 'perspectives']) || !text(view.raceId) || !text(view.title) || !text(view.intro)
    || !Array.isArray(view.perspectives) || !view.perspectives.length || view.perspectives.length > 3) throw new TypeError('Invalid gateway view');
  let last = -1;
  for (const perspective of view.perspectives) {
    const index = Object.keys(PERSPECTIVE_HEADINGS).indexOf(perspective?.kind);
    if (!keys(perspective, ['kind', 'text', 'links']) || index <= last || !text(perspective.text)
      || !Array.isArray(perspective.links) || !perspective.links.length || perspective.links.length > 5) throw new TypeError('Invalid gateway perspective');
    last = index;
    const seen = new Set();
    for (const link of perspective.links) {
      let identity;
      if (link?.type === 'section' && keys(link, ['type', 'section']) && Object.hasOwn(GATEWAY_SECTIONS, link.section)) identity = `section:${link.section}`;
      else if (link?.type === 'article' && keys(link, ['type', 'articleId', 'url', 'title', 'date']) && text(link.articleId) && https(link.url) && text(link.title) && typeof link.date === 'string' && dates.isCalendarDay(link.date)) identity = `article:${link.articleId}`;
      else if (link?.type === 'tool' && keys(link, ['type', 'target', 'label', 'url', 'kind', 'notice']) && ['grid', 'telemetry', 'ghostcar', 'tyres'].includes(link.target) && ['exact', 'partial', 'generic'].includes(link.kind) && text(link.label) && https(link.url) && (link.notice === null || text(link.notice))) identity = `tool:${link.target}`;
      else throw new TypeError('Invalid gateway link');
      const permitted = allowed[perspective.kind][link.type];
      if (!(permitted === true || (Array.isArray(permitted) && permitted.includes(link.section ?? link.target)))) throw new TypeError('Invalid gateway perspective link');
      if (seen.has(identity)) throw new TypeError('Duplicate gateway link');
      seen.add(identity);
    }
  }
}

export function renderGatewaySection(view) {
  validateView(view);
  const row = link => {
    if (link.type === 'section') return `<li><div><a href="#${gatewayTargetId(link.section)}">${escape(GATEWAY_SECTIONS[link.section].label)}</a><span>Ενότητα αυτής της σελίδας</span></div></li>`;
    if (link.type === 'article') return `<li><div><a href="${escape(link.url)}">${escape(link.title)}</a><span>Άρθρο · <time datetime="${escape(link.date)}">${escape(taxonomy.formatDate(link.date, 'long'))}</time></span></div></li>`;
    return `<li><div><a href="${escape(link.url)}" lang="en">${escape(link.label)}</a><span>${escape(toolNote(link))}</span></div></li>`;
  };
  const perspectives = view.perspectives.map(p => `<div class="race-desk-source-group"><h3>${PERSPECTIVE_HEADINGS[p.kind]}</h3><p>${escape(p.text)}</p><ul class="race-desk-sources">${p.links.map(row).join('')}</ul></div>`).join('');
  return `<section class="race-desk-section race-desk-gateway" aria-labelledby="gateway-title"><div class="race-desk-section-head"><div><p class="race-desk-kicker">ΟΔΗΓΟΣ ΑΝΑΓΝΩΣΗΣ</p><h2 id="gateway-title">${escape(view.title)}</h2></div><p>${escape(view.intro)}</p></div>${perspectives}<div class="race-desk-source-group"><p>Επιμελημένος οδηγός ανάγνωσης από τη σύνταξη. Δεν δηλώνει την τρέχουσα κατάσταση του αγώνα· τα στοιχεία και οι πηγές κάθε ενότητας τεκμηριώνονται παρακάτω.</p>${view.perspectives.length < 3 ? '<p>Ο οδηγός περιλαμβάνει μόνο τις οπτικές για τις οποίες υπάρχει εγκεκριμένο περιεχόμενο.</p>' : ''}</div></section>`;
}

export function applyGatewayTargets(html, view) {
  if (typeof html !== 'string') throw new TypeError('Invalid hub HTML');
  validateView(view);
  const sections = new Set(view.perspectives.flatMap(p => p.links.filter(link => link.type === 'section').map(link => link.section)));
  for (const section of sections) {
    const id = gatewayTargetId(section), headingId = GATEWAY_SECTIONS[section].headingId;
    if (new RegExp(`\\bid\\s*=\\s*['"]${id}['"]`).test(html)) throw new TypeError('Duplicate gateway target');
    const tags = [...html.matchAll(/<section\s+class="race-desk-section(?:\s[^"]*)?"[^>]*>/g)].filter(match => match[0].includes(`aria-labelledby="${headingId}">`));
    if (tags.length !== 1) throw new TypeError('Missing or duplicate gateway target section');
    const tag = tags[0][0];
    html = html.slice(0, tags[0].index) + tag.replace(`aria-labelledby="${headingId}">`, `aria-labelledby="${headingId}" id="${id}">`) + html.slice(tags[0].index + tag.length);
  }
  return html;
}
