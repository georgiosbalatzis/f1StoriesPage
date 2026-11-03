import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeRaceDeskHubs, prepareHubModels } from '../../build/race-desk-hubs.mjs';
import { readHubRegistry, readHubEvidence } from '../hub-files.mjs';
import { readGatewaySelection } from '../gateway-files.mjs';
import { gatewayDigest } from '../gateway.mjs';
import { renderGatewaySection, applyGatewayTargets } from '../gateway-render.mjs';
import { validateHubOutput } from '../hub-validation.mjs';

const source = fileURLToPath(new URL('../../..', import.meta.url));
const day = '2026-11-03';
const read = (root, file) => fs.readFileSync(path.join(root, file), 'utf8');
const put = (root, file, value) => fs.writeFileSync(path.join(root, file), value);
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gateway-publication-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const rel of ['data/race-desk', 'data/audience/race-gateways.v1.json', 'blog-module/blog-source-cache.json', ...['20261012W', '20261008J', '20261031J'].flatMap(id => [`blog-module/blog-entries/${id}/source.txt`, `blog-module/blog-entries/${id}/article.html`]), ...[2, 3, 14, 15, 16, 17].map(round => `standings/rounds/2026-${round}.json`), 'scripts/deployment/sources.json', 'partials']) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.cpSync(path.join(source, rel), path.join(root, rel), { recursive: true });
  }
  put(root, 'index.html', '<!-- f1s:gp-discovery:begin -->old<!-- f1s:gp-discovery:end -->');
  return root;
}
function approval(raceId) {
  const item = { raceId, status: 'published', title: 'Συνθετικός οδηγός', intro: 'Συνθετικό περιεχόμενο.', perspectives: [{ kind: 'before', text: 'Συνθετική οπτική.', links: [{ ref: 'section', section: 'schedule' }] }, { kind: 'weekend', text: 'Συνθετικό εργαλείο.', links: [{ ref: 'tool', target: 'grid', kind: raceId === '2026-singapore-gp' ? 'exact' : 'generic' }] }], revised: day };
  item.review = { status: 'approved', kind: 'human', by: 'SYNTHETIC TEST', date: day, contentSha256: gatewayDigest(item) };
  return item;
}
const save = (root, gateways) => put(root, 'data/audience/race-gateways.v1.json', JSON.stringify({ version: 1, gateways }));
const snapshot = (root, pages) => new Map(['index.html', ...pages.map(page => page.file)].map(file => [file, read(root, file)]));

test('gateway publication is atomic, reversible, deterministic and validated', async t => {
  const root = fixture(t), pages = await writeRaceDeskHubs(root, 2026, { today: day });
  const baseline = snapshot(root, pages), registry = readHubRegistry(root);
  const one = approval('2026-singapore-gp'), two = approval('2026-mexican-gp');
  save(root, [one]);
  await writeRaceDeskHubs(root, 2026, { today: day });
  const first = snapshot(root, pages), { lock, models } = prepareHubModels(root, { today: day });
  const views = readGatewaySelection(root, registry, models, { today: day });
  assert.equal(views.size, 1);
  const file = pages.find(page => page.path.includes(one.raceId)).file, view = views.get(one.raceId);
  for (const [name, value] of baseline) {
    const expected = name === file ? applyGatewayTargets(value.replace(/(<header class="race-desk-hero">[\s\S]*?<\/header>)/, (_, hero) => `${hero}${renderGatewaySection(view)}`), view) : value;
    assert.equal(first.get(name), expected, name);
  }
  await writeRaceDeskHubs(root, 2026, { today: day });
  assert.deepEqual(snapshot(root, pages), first);
  save(root, [one, two]);
  await writeRaceDeskHubs(root, 2026, { today: day });
  assert.equal([...snapshot(root, pages)].filter(([name, value]) => value !== baseline.get(name)).length, 2);
  save(root, [{ ...one, status: 'draft' }, { ...two, status: 'draft' }]);
  await writeRaceDeskHubs(root, 2026, { today: day });
  assert.deepEqual(snapshot(root, pages), baseline);
  save(root, [one, one]);
  await assert.rejects(writeRaceDeskHubs(root, 2026, { today: day }));
  assert.deepEqual(snapshot(root, pages), baseline);
  save(root, [one]);
  await writeRaceDeskHubs(root, 2026, { today: day });
  put(root, 'sitemap.xml', `<urlset>${models.map(model => `<url><loc>${lock.origin}${model.path}</loc></url>`).join('')}</urlset>`);
  const maps = key => new Map(models.map(model => [model.raceId, model[key]]));
  const validate = () => validateHubOutput(root, registry, lock, 2026, readHubEvidence(root), maps('stories'), maps('timeline'), maps('pace'), views);
  assert.deepEqual(validate(), []);
  const html = read(root, file), section = renderGatewaySection(view);
  const tool = view.perspectives.flatMap(p => p.links).find(link => link.type === 'tool');
  const encodedUrl = tool.url.replaceAll('&', '&amp;');
  const toolStart = html.indexOf('aria-labelledby="tools-title"');
  const toolEnd = html.indexOf('</section>', toolStart);
  const missingTool = html.slice(0, toolStart) + html.slice(toolStart, toolEnd).replace(`href="${encodedUrl}"`, 'href="/missing"') + html.slice(toolEnd);
  assert.ok(missingTool.includes(`href="${encodedUrl}"`));
  for (const mutated of [missingTool, html.replace(section, ''), html.replace(section, section + section), html.replace(section, '').replace('</section>', `</section>${section}`), html.replace(section, '').replace('</header>', `</header>${section}`),html.replace('Συνθετικός οδηγός', 'Αλλαγή'), html.replace('<main', '<main id="gateway-target-extra"'), html.replace(section, `<!--${section}-->`), html.replace('</body>', `${one.review.contentSha256}</body>`), html.replace('</body>', '"contentSha256"</body>')]) {
    put(root, file, mutated);
    assert.ok(validate().length);
  }
});
