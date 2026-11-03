import fs from 'node:fs';
import path from 'node:path';
import { createPublicationModels } from './hub-publication.mjs';
import { renderTimelineSection } from './timeline-render.mjs';
import { renderPaceSection } from './pace-render.mjs';
import { renderGatewaySection } from './gateway-render.mjs';
import { GATEWAY_SECTIONS, gatewayTargetId } from './hub-presentation.mjs';
import htmlAttributes from '../../blog-module/build/html-attributes.js';

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

// Validate source or packaged HTML; the browser gate independently checks layout and native links.
export function validateHubOutput(root, registry, lock, currentYear, evidence, stories, timelines, paces, gateways = new Map()) {
  const errors = [];
  const manifest = JSON.parse(fs.readFileSync(new URL('../../data/race-desk/editorial.v1.json', import.meta.url), 'utf8'));
  const inventory = JSON.parse(fs.readFileSync(new URL('../../data/race-desk/timeline.v1.json', import.meta.url), 'utf8'));
  const paceInventory = JSON.parse(fs.readFileSync(new URL('../../data/race-desk/pace.v1.json', import.meta.url), 'utf8'));
  // Capture digests/ids and the JSON keys of receipts and events are never visitor text.
  const timelinePrivate = ['timeline.v1.json', 'race-desk/captures', 'publication-rights.v1.json', '"sourceRefs"', '"recordIndex"', '"captureId"', '"codeRevision"', '"returnedIdentity"', ...inventory.captures.flatMap(item => [item.sha256, item.captureId])];
  // Pace receipts, bindings and model internals are never visitor text either.
  const pacePrivate = ['pace.v1.json', '"timelineBindings"', '"diagnostics"', '"reasonCodes"', ...paceInventory.captures.flatMap(item => [item.sha256, item.captureId, item.requestUrl])];
  // Quotes are excerpts of public articles (one equals a hub title), so only private markers are checked.
  const privateValues = ['editorial.v1.json', 'source.txt', ...manifest.associations.flatMap(({ evidence: item }) => [item.sha256, item.reviewedRevision])];
  const localManifest = path.join(root, 'data/audience/race-gateways.v1.json');
  const gatewayManifest = JSON.parse(fs.readFileSync(fs.existsSync(localManifest) ? localManifest : new URL('../../data/audience/race-gateways.v1.json', import.meta.url), 'utf8'));
  const gatewayPrivate = ['race-gateways.v1.json', 'data/audience/', ...['contentSha256', 'perspectives', 'review'].flatMap(key => [`"${key}":`, `&quot;${key}&quot;:`]), ...gatewayManifest.gateways.map(item => item.review?.contentSha256).filter(Boolean)];
  const models = createPublicationModels(registry, lock, evidence, { currentYear });
  const read = file => {
    try { return fs.readFileSync(path.join(root, file), 'utf8'); }
    catch { errors.push(`missing GP output: ${file}`); return ''; }
  };
  const home = read('index.html');
  const sitemap = read('sitemap.xml');
  for (const model of models) {
    const file = model.path.slice(1) + 'index.html';
    const html = read(file);
    const view = gateways.get(model.raceId);
    const tags = htmlAttributes.tags(html).filter(tag => !tag.close);
    const gatewayTags = tags.filter(tag => tag.name === 'section' && tag.attrs.class?.split(/\s+/).includes('race-desk-gateway'));
    const targets = tags.filter(tag => tag.attrs.id?.startsWith('gateway-target-'));
    const titles = tags.filter(tag => tag.attrs.id === 'gateway-title');
    const referenced = new Set(view ? view.perspectives.flatMap(p => p.links.filter(link => link.type === 'section').map(link => link.section)) : []);
    if (view) {
      const rendered = renderGatewaySection(view), tag = gatewayTags[0];
      const schedule = tags.find(item => item.name === 'section' && item.attrs['aria-labelledby'] === GATEWAY_SECTIONS.schedule.headingId);
      // The gateway sits exactly where the hero header closes (not after the site nav's <header>).
      const hero = tags.filter(item => item.name === 'header' && item.attrs.class?.split(/\s+/).includes('race-desk-hero'));
      const heroEnd = hero.length === 1 ? html.indexOf('</header>', hero[0].start) : -1;
      if (gatewayTags.length !== 1 || titles.length !== 1 || !tag || html.slice(tag.start, tag.start + rendered.length) !== rendered || heroEnd < 0 || tag.start !== heroEnd + '</header>'.length || !schedule || tag.start >= schedule.start) errors.push(`${file}: gateway missing, misplaced or changed`);
      if (targets.length !== referenced.size || targets.some(target => {
        const section = [...referenced].find(key => gatewayTargetId(key) === target.attrs.id);
        return !section || target.name !== 'section' || !target.attrs.class?.split(/\s+/).includes('race-desk-section') || target.attrs['aria-labelledby'] !== GATEWAY_SECTIONS[section].headingId;
      }) || [...referenced].some(section => targets.filter(target => target.attrs.id === gatewayTargetId(section)).length !== 1)) errors.push(`${file}: gateway targets mismatch`);
    } else if (gatewayTags.length || targets.length || titles.length) errors.push(`${file}: unexpected gateway`);
    if (gatewayPrivate.some(value => value && (html.includes(value) || html.includes(escape(value))))) errors.push(`${file}: gateway evidence exposed`);
    const stripTarget = (section, key) => referenced.has(key) ? section.replace(` id="${gatewayTargetId(key)}"`, '') : section;
    const sections = [...html.matchAll(/<section class="race-desk-section race-desk-related"[^>]*>[\s\S]*?<\/section>/g)];
    const expected = stories.get(model.raceId);
    if (sections.length !== 1 || (html.match(/<section class="race-desk-section race-desk-related"/g) || []).length !== 1 || !Array.isArray(expected)) errors.push(`${file}: related section missing or duplicated`);
    else {
      const section = sections[0][0];
      const anchors = [...section.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)].map(([anchor]) => anchor);
      const times = [...section.matchAll(/<time\b[^>]*>/g)].map(([time]) => time);
      if ((section.match(/<a\b/g) || []).length !== expected.length || anchors.length !== expected.length || anchors.some((anchor, i) => anchor !== `<a href="${escape(expected[i].url)}">${escape(expected[i].title)}</a>`)) errors.push(`${file}: related links mismatch`);
      if ((section.match(/<time\b/g) || []).length !== expected.length || times.length !== expected.length || times.some((time, i) => time !== `<time datetime="${escape(expected[i].date)}">`)) errors.push(`${file}: related dates mismatch`);
      if (!expected.length && /<ol class="race-desk-stories"/.test(section)) errors.push(`${file}: empty related list`);
    }
    if (privateValues.some(value => value && (html.includes(value) || html.includes(escape(value))))) errors.push(`${file}: editorial evidence exposed`);
    // The published timeline must be exactly the rendering of the validated captures (section number aside).
    const timeline = timelines?.get(model.raceId), timelineSections = [...html.matchAll(/<section class="race-desk-section gp-timeline"[\s\S]*?<\/section>/g)];
    if (!timeline || timelineSections.length !== 1) errors.push(`${file}: timeline section missing or duplicated`);
    else if (stripTarget(timelineSections[0][0], 'timeline').replace(/(<p class="race-desk-kicker">)\d\d( \/ ΧΡΟΝΟΛΟΓΙΟ ΑΓΩΝΑ)/, '$100$2') !== renderTimelineSection(timeline, { number: '00' })) errors.push(`${file}: timeline section differs from the validated captures`);
    if (timelinePrivate.some(value => html.includes(value) || html.includes(escape(value)))) errors.push(`${file}: timeline provenance exposed`);
    // The published pace section must be exactly the rendering of the validated captures (section number aside).
    const pace = paces?.get(model.raceId), paceSections = [...html.matchAll(/<section class="race-desk-section gp-pace"[\s\S]*?<\/section>/g)];
    if (!pace || paceSections.length !== 1 || (html.match(/<section class="race-desk-section gp-pace"/g) || []).length !== 1) errors.push(`${file}: pace section missing or duplicated`);
    else if (stripTarget(paceSections[0][0], 'pace').replace(/(<p class="race-desk-kicker">)\d\d( \/ ΡΥΘΜΟΣ ΑΓΩΝΑ &amp; STINTS)/, '$100$2') !== renderPaceSection(pace, { number: '00' })) errors.push(`${file}: pace section differs from the validated captures`);
    if (pacePrivate.some(value => html.includes(value) || html.includes(escape(value)))) errors.push(`${file}: pace provenance exposed`);
    const canonical = lock.origin + model.path;
    const canonicals = [...html.matchAll(/<link\b[^>]*\brel="canonical"[^>]*\bhref="([^"]+)"[^>]*>/g)];
    const ogUrls = [...html.matchAll(/<meta\b[^>]*\bproperty="og:url"[^>]*\bcontent="([^"]+)"[^>]*>/g)];
    if (canonicals.length !== 1 || canonicals[0][1] !== canonical) errors.push(`${file}: GP canonical mismatch`);
    if (ogUrls.length !== 1 || ogUrls[0][1] !== canonical) errors.push(`${file}: GP OG URL mismatch`);
    if (!home.includes(`href="${model.path}"`)) errors.push(`${file}: missing static homepage discovery`);
    const entries = [...sitemap.matchAll(/<url>[\s\S]*?<\/url>/g)].filter(([entry]) => entry.includes(`<loc>${canonical}</loc>`));
    if (entries.length !== 1) errors.push(`${file}: GP sitemap entry missing or duplicated`);
    if (entries.some(([entry]) => entry.includes('<lastmod>'))) errors.push(`${file}: GP has no evidenced lastmod`);
    if (!html.includes('class="race-desk-page') && !html.includes('race-desk-page"')) errors.push(`${file}: missing GP shell`);
    if (!html.includes(`href="${model.scheduleEvidence.url}"`)) errors.push(`${file}: missing official schedule citation`);
    const toolTag = tags.find(tag => tag.name === 'section' && tag.attrs['aria-labelledby'] === 'tools-title');
    const toolEnd = toolTag ? html.indexOf('</section>', toolTag.start) : -1;
    const toolLinks = tags.filter(tag => tag.name === 'a' && tag.start > toolTag?.start && tag.start < toolEnd);
    for (const tool of model.tools) {
      if (!toolLinks.some(link => link.attrs.href === tool.url)) errors.push(`${file}: ${tool.target} plan is missing or changed`);
    }
    for (const session of model.sessions) {
      if (session.startUtc && !html.includes(`<time datetime="${session.startUtc}">`)) errors.push(`${file}: missing recorded ${session.kind} start`);
    }
  }
  return errors;
}
