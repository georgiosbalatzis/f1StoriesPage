import assert from 'node:assert/strict';

const reasons = {
  'unmapped-race': 'Δεν υπάρχει διαθέσιμη αντιστοίχιση αποτελεσμάτων για αυτό το Grand Prix.',
  'uncaptured-session': 'Δεν υπάρχει καταγεγραμμένη απόκριση για αυτή την περίοδο.',
  'provider-empty': 'Δεν υπάρχουν διαθέσιμα αποτελέσματα στην καταγεγραμμένη απόκριση της πηγής.',
  'missing-baseline': 'Δεν υπάρχει διαθέσιμο προηγούμενο στιγμιότυπο πρωταθλήματος.',
  'missing-snapshot': 'Δεν υπάρχουν διαθέσιμα και τα δύο στιγμιότυπα πρωταθλήματος.',
};
const names = { race: 'Αγώνας', qualifying: 'Κατατακτήριες', sprint: 'Sprint' };
const cell = value => value == null ? '—' : String(value);

async function rows(table) {
  return table.locator('tbody tr').evaluateAll(trs => trs.map(tr => [...tr.children].map(td => td.textContent.trim())));
}

async function checkTable(section, id, caption, expectedRows) {
  const region = section.locator(`.gp-results-table-wrap[aria-describedby="${id}-hint"]`);
  assert.equal(await region.count(), 1, `${id}: region`);
  assert.equal(await region.getAttribute('role'), 'region');
  assert.equal(await region.getAttribute('tabindex'), '0');
  assert.equal(await section.locator(`#${id}-hint`).count(), 1);
  const table = region.locator('table');
  assert.equal(await table.count(), 1);
  assert.equal(await table.locator('caption').innerText(), caption);
  assert.deepEqual(await rows(table), expectedRows.map(row => row.map(cell)), `${id}: all rows in source order`);
  return region;
}

/** Assert a rendered page against its validated, locally captured results context. */
export async function assertResultsPage(page, context) {
  assert.ok(context?.classifications && context?.comparison, 'results context is required');
  const root = page.locator('.gp-results');
  assert.equal(await root.count(), 1);
  assert.equal(await root.locator('#gp-results-title').innerText(), 'Αποτελέσματα');
  assert.ok((await root.innerText()).includes('δεν τεκμηριώνεται εδώ επίσημη ή οριστική κατάσταση ούτε ιστορικό τροποποιήσεων'));
  assert.ok((await root.innerText()).includes('Η ανάκτηση δεν είναι χρόνος ισχύος αποτελέσματος.'));
  const regions = [];
  let expectedTables = 0;
  for (const kind of ['race', 'qualifying', 'sprint']) {
    const result = context.classifications[kind];
    const section = root.locator(`section[aria-labelledby="gp-results-${kind}"]`);
    assert.equal(await section.count(), 1);
    assert.equal(await section.locator('h3').innerText(), names[kind]);
    if (result.status === 'unavailable') {
      assert.ok(reasons[result.reason], `unknown unavailable reason ${result.reason}`);
      assert.ok((await section.innerText()).includes(reasons[result.reason]));
      assert.equal(await section.locator('table').count(), 0);
    } else {
      assert.equal(result.status, 'available');
      assert.ok((await section.innerText()).includes('Κατάταξη από καταγεγραμμένη απόκριση Jolpica.'));
      const expected = result.entries.map(entry => kind === 'qualifying'
        ? [entry.positionText, entry.driverName, entry.constructorName, entry.q1, entry.q2, entry.q3]
        : [entry.positionText, entry.driverName, entry.constructorName, entry.points, entry.grid, entry.laps, entry.status, entry.time]);
      regions.push(await checkTable(section, `gp-results-${kind}-table`, `Καταγεγραμμένη κατάταξη: ${names[kind]}`, expected));
      expectedTables++;
    }
    const source = section.locator('.gp-results-source');
    assert.equal(await source.count(), result.source ? 1 : 0);
    if (result.source) {
      assert.equal(await source.locator('a').getAttribute('href'), result.source.requestUrl);
      assert.equal(await source.locator('time').getAttribute('datetime'), result.source.observedAt);
      assert.equal(await source.locator('time').innerText(), `${result.source.observedAt} UTC`);
    }
  }
  const comparison = context.comparison;
  const section = root.locator('section[aria-labelledby="gp-results-championship"]');
  assert.equal(await section.count(), 1);
  if (comparison.status === 'unavailable') {
    assert.ok(reasons[comparison.reason]);
    assert.ok((await section.innerText()).includes(reasons[comparison.reason]));
    assert.equal(await section.locator('table').count(), 0);
  } else {
    assert.equal(comparison.status, 'available');
    assert.ok((await section.innerText()).includes('Η διαφορά μπορεί να περιλαμβάνει Sprint ή μεταβολές παλαιότερων στοιχείων· δεν αποδίδεται μόνο στον αγώνα.'));
    assert.match(await section.innerText(), /οι βαθμοί είναι σωρευτικοί και η διαφορά τους δεν αποτελεί κατάταξη αγώνα/i);
    const snapshots = section.locator('.gp-results-snapshots > div');
    assert.equal(await snapshots.count(), 2);
    for (const [index, side] of ['before', 'after'].entries()) {
      const source = comparison.sources[side], snapshot = snapshots.nth(index);
      assert.equal(await snapshot.locator('time').getAttribute('datetime'), source.generatedAt);
      assert.equal(await snapshot.locator('time').textContent(), `${source.generatedAt} UTC`);
      assert.equal(await snapshot.locator('a').first().getAttribute('href'), `https://github.com/georgiosbalatzis/f1StoriesPage/blob/${source.revision}/${source.path}`);
      assert.deepEqual(await snapshot.locator('details a').evaluateAll(links => links.map(link => link.getAttribute('href'))), [source.wrapperUrls.drivers, source.embeddedUrls.drivers, source.wrapperUrls.constructors, source.embeddedUrls.constructors]);
    }
    for (const [kind, label] of [['drivers', 'Οδηγοί'], ['constructors', 'Κατασκευαστές']]) {
      const expected = comparison[kind].map(row => [kind === 'drivers' ? (row.after ?? row.before)?.driverName : (row.after ?? row.before)?.constructorName, row.before?.positionText, row.after?.positionText, row.before?.points, row.after?.points, row.pointsChange, row.rankChange]);
      regions.push(await checkTable(section, `gp-results-${kind}-table`, `Μεταβολή πρωταθλήματος: ${label}`, expected));
      expectedTables++;
    }
  }
  assert.equal(await root.locator('table').count(), expectedTables);
  if (page.viewportSize()?.width === 390) {
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'page must not overflow horizontally');
    for (const region of regions) {
      const dimensions = await region.evaluate(el => ({ width: el.clientWidth, scrollWidth: el.scrollWidth }));
      assert.ok(dimensions.scrollWidth > dimensions.width, '390px must expose a scrollable results region');
      await region.focus();
      assert.ok(await region.evaluate(el => document.activeElement === el), 'results region must receive keyboard focus');
      await region.evaluate(el => { el.scrollLeft = 0; });
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(250);
      assert.ok(await region.evaluate(el => el.scrollLeft > 0), 'keyboard must scroll the results region');
    }
  }
}
