import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHubModels } from '../race-desk/hub-model.mjs';
import { readHubRegistry } from '../race-desk/hub-files.mjs';
import { renderHub } from '../race-desk/hub-render.mjs';
import { expandPageIncludes } from './include.mjs';

function safeDestination(root, relativePath) {
  let current = root;
  for (const part of relativePath.split('/')) {
    current = path.join(current, part);
    let entry;
    try { entry = fs.lstatSync(current); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (entry?.isSymbolicLink()) throw new Error(`Refusing symlink: ${relativePath}`);
  }
  return current;
}

export async function writeRaceDeskHubs(root, currentYear = new Date().getUTCFullYear()) {
  root = path.resolve(root);
  if (fs.lstatSync(root).isSymbolicLink()) throw new Error('Refusing symlinked repository root');
  const registry = readHubRegistry(root);
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'scripts/deployment/sources.json'), 'utf8'));
  const models = createHubModels(registry, lock, { currentYear });
  const homePath = safeDestination(root, 'index.html');
  const home = fs.readFileSync(homePath, 'utf8');
  const marker = /<!-- f1s:gp-discovery:begin -->[\s\S]*?<!-- f1s:gp-discovery:end -->/;
  if (!marker.test(home)) throw new Error('Missing homepage GP discovery marker');
  if ((home.match(/<!-- f1s:gp-discovery:begin -->/g) || []).length !== 1 || (home.match(/<!-- f1s:gp-discovery:end -->/g) || []).length !== 1) throw new Error('Duplicate homepage GP discovery marker');
  const prepared = [];
  for (const model of models) {
    const file = model.path.slice(1) + 'index.html';
    const destination = safeDestination(root, file);
    const html = await expandPageIncludes(renderHub(model, { origin: lock.origin }), { root, relativePath: file });
    prepared.push({ destination, html, page: { file, path: model.path, changefreq: 'monthly', priority: '0.5' } });
  }
  // Only this marked region is generated; the four-product index stays separate.
  const links = models.map(model => `<li><a href="${model.path}"><span class="desk-index__name">${escapeHtml(model.displayName)}</span><span class="desk-index__what">${model.season}</span></a></li>`).join('\n');
  const block = `<!-- f1s:gp-discovery:begin -->\n<section class="desk-index gp-discovery" aria-labelledby="gp-discovery-title"><h3 class="desk-index__title" id="gp-discovery-title">Επιλεγμένα Grand Prix</h3><p class="desk-index__lede">Πρόγραμμα και σύνδεσμοι εργαλείων για επιλεγμένους αγώνες. Δεν αποτελεί πλήρες ημερολόγιο.</p><ol class="desk-index__list">${links}</ol></section>\n<!-- f1s:gp-discovery:end -->`;
  const updated = home.replace(marker, () => block);
  for (const { destination, html } of prepared) {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    if (!fs.existsSync(destination) || fs.readFileSync(destination, 'utf8') !== html) fs.writeFileSync(destination, html);
  }
  if (updated !== home) fs.writeFileSync(homePath, updated);
  return prepared.map(item => item.page);
}

const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const pages = await writeRaceDeskHubs(root);
  console.log(`Race Desk: ${pages.length} selected GP pages generated.`);
}
