import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createPublicationModels } from '../hub-publication.mjs';
import { readEditorialSelection } from '../editorial-files.mjs';
import { validateHubOutput } from '../hub-validation.mjs';
import { readTimelineContexts } from '../timeline-files.mjs';
import { renderTimelineSection } from '../timeline-render.mjs';

const registry = JSON.parse(fs.readFileSync(new URL('../../../data/race-desk/registry.v1.json', import.meta.url)));
const lock = JSON.parse(fs.readFileSync(new URL('../../deployment/sources.json', import.meta.url)));
const evidence = JSON.parse(fs.readFileSync(new URL('../../../data/race-desk/hub-evidence.v1.json', import.meta.url)));
const sourceRoot = new URL('../../..', import.meta.url).pathname;
const stories = readEditorialSelection(sourceRoot, registry, { today: '2026-11-02' });
const timelines = readTimelineContexts(sourceRoot, registry);
const manifest = JSON.parse(fs.readFileSync(new URL('../../../data/race-desk/editorial.v1.json', import.meta.url)));
const models = createPublicationModels(registry, lock, evidence, { currentYear: 2026 });
const esc = value => value.replaceAll('&', '&amp;');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gp-validation-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (file, value) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), value); };
  write('index.html', models.map(model => `<a href="${model.path}">GP</a>`).join(''));
  write('sitemap.xml', `<urlset>${models.map(model => `<url><loc>${lock.origin}${model.path}</loc></url>`).join('')}</urlset>`);
  for (const model of models) write(model.path.slice(1) + 'index.html', `<head><link rel="canonical" href="${lock.origin}${model.path}"><meta property="og:url" content="${lock.origin}${model.path}"></head><body class="race-desk-page"><a href="${model.scheduleEvidence.url}">Official</a>${model.tools.map(tool => `<a href="${esc(tool.url)}">Tool</a>`).join('')}${model.sessions.filter(session => session.startUtc).map(session => `<time datetime="${session.startUtc}">Start</time>`).join('')}${renderTimelineSection(timelines.get(model.raceId), { number: '03' })}<section class="race-desk-section race-desk-related">${stories.get(model.raceId).length ? `<ol class="race-desk-stories">${stories.get(model.raceId).map(story => `<li><a href="${esc(story.url)}">${esc(story.title)}</a><time datetime="${story.date}">Date</time></li>`).join('')}</ol>` : ''}</section></body>`);
  const change = (file, replace) => write(file, replace(fs.readFileSync(path.join(root, file), 'utf8')));
  return { root, change, validate: () => validateHubOutput(root, registry, lock, 2026, evidence, stories, timelines) };
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

test('related section enforces selected links, dates and private evidence', t => {
  const target = models.find(model => model.raceId === '2026-singapore-gp').path.slice(1) + 'index.html';
  const mutations = [
    html => html.replace(/<section class="race-desk-section race-desk-related"[\s\S]*?<\/section>/, ''),
    html => html.replace(/(<section class="race-desk-section race-desk-related"[\s\S]*?<\/section>)/, '$1$1'),
    html => html.replace(/(<ol class="race-desk-stories">)(<li>.*?<\/li>)(<li>.*?<\/li>)/, '$1$3$2'),
    html => html.replace('</ol></section>', '</ol><a href="/extra">Extra</a></section>'),
    html => html.replace(esc(stories.get('2026-singapore-gp')[0].title), 'Changed title'),
    html => html.replace(`datetime="${stories.get('2026-singapore-gp')[0].date}"`, 'datetime="2020-01-01"'),
    html => html.replace('</body>', `${manifest.associations[0].evidence.sha256}</body>`),
    html => html.replace('</body>', `${manifest.associations[0].evidence.reviewedRevision}</body>`),
    html => html.replace('</body>', 'blog-module/blog-entries/20261008J/source.txt</body>')
  ];
  const { change: titled, validate: titledValidate } = fixture(t);
  titled(target, html => html.replace('<head>', `<head><title>${manifest.associations[0].evidence.references[2].quote} | F1 Stories</title>`));
  assert.deepEqual(titledValidate(), [], 'a public quote in the hub title is not evidence leakage');
  for (const mutate of mutations) {
    const { change, validate } = fixture(t);
    change(target, mutate);
    assert.notDeepEqual(validate(), []);
  }
});

const inventory = JSON.parse(fs.readFileSync(new URL('../../../data/race-desk/timeline.v1.json', import.meta.url)));
test('rejects a tampered timeline row and exposed capture paths', t => {
  const target = models.find(model => model.raceId === '2026-singapore-gp').path.slice(1) + 'index.html';
  for (const [mutate, error] of [
    [html => html.replace('class="gp-timeline-label">', 'class="gp-timeline-label">Tampered '), /timeline section differs/],
    [html => html.replace('</body>', 'data/race-desk/captures</body>'), /timeline provenance exposed/],
    [html => html.replace('</body>', `${inventory.captures[0].sha256}</body>`), /timeline provenance exposed/],
    [html => html.replace('</body>', '<script type="application/json">{"sourceRefs":[{"recordIndex":0}]}</script></body>'), /timeline provenance exposed/],
    [html => html.replace('</body>', `<pre>${JSON.stringify({ ...inventory.captures[0], path: undefined })}</pre></body>`), /timeline provenance exposed/]
  ]) {
    const { change, validate } = fixture(t);
    change(target, mutate);
    assert.match(validate().join('\n'), error);
  }
});
