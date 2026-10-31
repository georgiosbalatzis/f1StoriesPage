import fs from 'node:fs';
import path from 'node:path';
import { createPublicationModels } from './hub-publication.mjs';

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

// Validate source or packaged HTML; the browser gate independently checks layout and native links.
export function validateHubOutput(root, registry, lock, currentYear, evidence) {
  const errors = [];
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
    for (const tool of model.tools) {
      if (!html.includes(`href="${escape(tool.url)}"`)) errors.push(`${file}: ${tool.target} plan is missing or changed`);
    }
    for (const session of model.sessions) {
      if (session.startUtc && !html.includes(`<time datetime="${session.startUtc}">`)) errors.push(`${file}: missing recorded ${session.kind} start`);
    }
  }
  return errors;
}
