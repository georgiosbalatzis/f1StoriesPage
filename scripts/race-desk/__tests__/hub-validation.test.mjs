import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createPublicationModels } from '../hub-publication.mjs';
import { validateHubOutput } from '../hub-validation.mjs';

const registry = JSON.parse(fs.readFileSync(new URL('../../../data/race-desk/registry.v1.json', import.meta.url)));
const lock = JSON.parse(fs.readFileSync(new URL('../../deployment/sources.json', import.meta.url)));
const evidence = JSON.parse(fs.readFileSync(new URL('../../../data/race-desk/hub-evidence.v1.json', import.meta.url)));
const models = createPublicationModels(registry, lock, evidence, { currentYear: 2026 });
const esc = value => value.replaceAll('&', '&amp;');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gp-validation-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (file, value) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), value); };
  write('index.html', models.map(model => `<a href="${model.path}">GP</a>`).join(''));
  write('sitemap.xml', `<urlset>${models.map(model => `<url><loc>${lock.origin}${model.path}</loc></url>`).join('')}</urlset>`);
  for (const model of models) write(model.path.slice(1) + 'index.html', `<head><link rel="canonical" href="${lock.origin}${model.path}"><meta property="og:url" content="${lock.origin}${model.path}"></head><body class="race-desk-page"><a href="${model.scheduleEvidence.url}">Official</a>${model.tools.map(tool => `<a href="${esc(tool.url)}">Tool</a>`).join('')}${model.sessions.filter(session => session.startUtc).map(session => `<time datetime="${session.startUtc}">Start</time>`).join('')}</body>`);
  const change = (file, replace) => write(file, replace(fs.readFileSync(path.join(root, file), 'utf8')));
  return { root, change, validate: () => validateHubOutput(root, registry, lock, 2026, evidence) };
}

test('all selected GP pages require static discovery, exact canonical links and recorded starts', t => {
  const { root, change, validate } = fixture(t);
  assert.deepEqual(validate(), []);
  change('index.html', html => html.replace(`href="${models[0].path}"`, 'href="/"'));
  assert.match(validate().join('\n'), /missing static homepage discovery/);
  fs.unlinkSync(path.join(root, models[1].path, 'index.html'));
  assert.match(validate().join('\n'), /missing GP output/);
});

test('duplicate metadata and fabricated sitemap lastmod fail validation', t => {
  const { change, validate } = fixture(t);
  change(models[0].path.slice(1) + 'index.html', html => html.replace('</head>', `<link rel="canonical" href="${lock.origin}${models[0].path}"></head>`));
  change('sitemap.xml', html => html.replace('</url>', '<lastmod>2026-01-01</lastmod></url>'));
  assert.match(validate().join('\n'), /GP canonical mismatch/);
  assert.match(validate().join('\n'), /no evidenced lastmod/);
});

test('wrong tool scope and missing recorded session start fail closed', t => {
  const { change, validate } = fixture(t);
  const first = models[0];
  change(first.path.slice(1) + 'index.html', html => html.replace(`href="${esc(first.tools.find(tool => tool.target === 'tyres').url)}"`, 'href="https://f1-stories.gr/tyres/"').replace(`<time datetime="${first.sessions[0].startUtc}">`, '<time>'));
  assert.match(validate().join('\n'), /tyres plan is missing or changed/);
  assert.match(validate().join('\n'), /missing recorded/);
});


test('missing official schedule citation is rejected', t => {
  const { change, validate } = fixture(t);
  const model = models[0];
  change(model.path.slice(1) + 'index.html', html => html.replace(model.scheduleEvidence.url, 'https://example.com/'));
  assert.match(validate().join('\n'), /missing official schedule citation/);
});
