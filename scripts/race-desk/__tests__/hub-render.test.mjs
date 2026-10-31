import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHubModels } from '../hub-model.mjs';
import { renderHub } from '../hub-render.mjs';

const registry = JSON.parse(readFileSync(new URL('../../../data/race-desk/registry.v1.json', import.meta.url)));
const lock = JSON.parse(readFileSync(new URL('../../deployment/sources.json', import.meta.url)));
const models = createHubModels(registry, lock, { currentYear: 2026 });
const model = () => structuredClone(models.find(item => item.raceId === '2026-singapore-gp'));

test('renders static schedule, canonical metadata, includes and tool destinations', () => {
  const race = model(), html = renderHub(race);
  for (const partial of ['head-meta', 'nav', 'cookie-banner', 'footer']) assert.ok(html.includes(`<!-- @include partials/${partial}.html -->`));
  assert.equal((html.match(/rel="canonical"/g) ?? []).length, 1);
  assert.equal((html.match(/property="og:url"/g) ?? []).length, 1);
  assert.match(html, /<a class="race-desk-skip" href="#main"/);
  assert.match(html, /<caption>Καταγεγραμμένες προγραμματισμένες ενάρξεις/);
  assert.match(html, /class="race-desk-table-wrap" role="region" tabindex="0" aria-label="Πίνακας προγράμματος" aria-describedby="schedule-scroll-hint"/);
  assert.match(html, /id="schedule-scroll-hint"[^>]*>Κύλησε οριζόντια/);
  for (const session of race.sessions) {
    if (session.startUtc) {
      assert.ok(html.includes(`<time datetime="${session.startUtc}">${session.utcTime.date} · ${session.utcTime.time}`));
      assert.ok(!html.includes(`>${session.startUtc}</time>`));
    }
    if (session.athensTime) assert.ok(html.includes(session.athensTime.offset));
  }
  for (const tool of race.tools) assert.ok(html.includes(tool.url.replaceAll('&', '&amp;')));
  assert.match(html, /Έλεγχος πηγής/);
  assert.match(html, /<details><summary>Στοιχεία τεκμηρίου<\/summary>/);
  assert.match(html, /Δεδομένα περιόδου: μη συνδεδεμένα σε αυτή τη σελίδα/);
  assert.match(html, /Η λίστα μπορεί να είναι ελλιπής/);
  assert.match(html, /images\/icons\/icon-512\.png/);
  assert.match(html, /href="\/styles\/home-fonts\.css"/);
  assert.doesNotMatch(html, /href="\/styles\/fonts\.css"/);
  assert.match(html, /Ελεύθερες δοκιμές 1/);
  assert.match(html, /Κατατακτήριες Sprint/);
  assert.match(html, /Προεπισκόπηση TYRES/);
  assert.doesNotMatch(html, /dateModified|lastmod|<iframe|<noscript|schema\.org/i);
});

test('escapes supplied data and suppresses unsafe links', () => {
  const race = model();
  race.displayName = '<img src=x onerror="bad">';
  race.venue.name = '<Relocated & circuit>';
  race.sources[0].id = '<source>';
  race.sources[0].url = 'javascript:alert(1)';
  race.tools[0].url = 'javascript:alert(2)';
  const html = renderHub(race);
  assert.match(html, /&lt;img src=x onerror=&quot;bad&quot;&gt;/);
  assert.match(html, /&lt;Relocated &amp; circuit&gt;/);
  assert.match(html, /&lt;source&gt;/);
  assert.doesNotMatch(html, /href="javascript:/);
  assert.match(html, /Σύνδεσμος πηγής μη διαθέσιμος/);
});

test('preserves recorded sprint order, null times and unavailable selections', () => {
  const race = model();
  race.displayName = 'Bahrain GP in Malaysia';
  race.sessions = [{ kind: 'qualifying', startUtc: null, venueTime: null, athensTime: null }, { kind: 'sprint', startUtc: null, venueTime: null, athensTime: null }];
  race.tools = race.tools.map(tool => ({ ...tool, kind: 'generic' }));
  const html = renderHub(race);
  assert.match(html, /Bahrain GP in Malaysia/);
  assert.ok(html.indexOf('Κατατακτήριες<small>') < html.indexOf('Sprint<small>'));
  assert.equal((html.match(/Μη διαθέσιμο/g) ?? []).length, 6);
  assert.match(html, /Γενική προβολή · επίλεξε αγώνα/);
  race.sessions = []; race.sources = [];
  const empty = renderHub(race);
  assert.match(empty, /Δεν υπάρχουν καταγεγραμμένες περίοδοι διαθέσιμες/);
  assert.match(empty, /Δεν υπάρχουν διαθέσιμες πηγές/);
});
