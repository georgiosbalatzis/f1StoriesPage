const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const value = input => input == null ? '—' : escape(input);
const safeUrl = input => {
  try {
    const url = new URL(input);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
};
const link = (url, label) => {
  const href = safeUrl(url);
  return href ? `<a href="${escape(href)}">${escape(label)}</a>` : escape(label);
};
const time = date => date ? `<time datetime="${escape(date)}">${escape(date)} UTC</time>` : 'Μη διαθέσιμη';
const names = { race: 'Αγώνας', qualifying: 'Κατατακτήριες', sprint: 'Sprint' };
const reasons = {
  'unmapped-race': 'Δεν υπάρχει διαθέσιμη αντιστοίχιση αποτελεσμάτων για αυτό το Grand Prix.',
  'uncaptured-session': 'Δεν υπάρχει καταγεγραμμένη απόκριση για αυτή την περίοδο.',
  'provider-empty': 'Δεν υπάρχουν διαθέσιμα αποτελέσματα στην καταγεγραμμένη απόκριση της πηγής.',
  'missing-baseline': 'Δεν υπάρχει διαθέσιμο προηγούμενο στιγμιότυπο πρωταθλήματος.',
  'missing-snapshot': 'Δεν υπάρχουν διαθέσιμα και τα δύο στιγμιότυπα πρωταθλήματος.',
};
const unavailable = result => escape(reasons[result.reason] ?? 'Τα δεδομένα δεν είναι διαθέσιμα.');
const captureSource = source => `<p class="gp-results-source">Πηγή: ${link(source?.requestUrl, 'Jolpica')} · ανάκτηση απόκρισης: ${time(source?.observedAt)}</p>`;
const snapshotSource = (source, label) => {
  const revision = source?.revision, path = source?.path;
  const url = /^[a-f0-9]{40}$/.test(revision ?? '') && /^standings\/rounds\/\d+-\d+\.json$/.test(path ?? '') ? `https://github.com/georgiosbalatzis/f1StoriesPage/blob/${revision}/${path}` : null;
  const urls = [['Οδηγοί', 'drivers'], ['Κατασκευαστές', 'constructors']].map(([name, key]) => `<li>${escape(name)}: ${link(source?.wrapperUrls?.[key], 'URL περιβλήματος')} · ${link(source?.embeddedUrls?.[key], 'URL μέσα στα δεδομένα')}</li>`).join('');
  return `<div><p>${link(url, label)} · δημιουργία στιγμιοτύπου: ${time(source?.generatedAt)}</p><details><summary>Σύνδεσμοι πηγής του στιγμιοτύπου</summary><ul>${urls}</ul></details></div>`;
};
const table = (id, label, caption, columns, rows) => `<p id="${id}-hint" class="gp-results-hint">Κύλησε οριζόντια για όλες τις στήλες · με πληκτρολόγιο, χρησιμοποίησε τα βέλη.</p><div class="gp-results-table-wrap" role="region" tabindex="0" aria-label="${escape(label)}" aria-describedby="${id}-hint"><table><caption>${escape(caption)}</caption><thead><tr>${columns.map(c => `<th scope="col">${escape(c)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
function classification(kind, result) {
  const label = names[kind];
  if (result.status === 'unavailable') return `<section class="gp-results-group" aria-labelledby="gp-results-${kind}"><h3 id="gp-results-${kind}">${label}</h3><p>${unavailable(result)}</p>${result.source ? captureSource(result.source) : ''}</section>`;
  const qualifying = kind === 'qualifying';
  const columns = qualifying ? ['Θέση', 'Οδηγός', 'Κατασκευαστής', 'Q1', 'Q2', 'Q3'] : ['Θέση', 'Οδηγός', 'Κατασκευαστής', 'Βαθμοί', 'Εκκίνηση', 'Γύροι', 'Κατάσταση', 'Χρόνος'];
  const rows = result.entries.map(entry => {
    const cells = qualifying ? [entry.constructorName, entry.q1, entry.q2, entry.q3] : [entry.constructorName, entry.points, entry.grid, entry.laps, entry.status, entry.time];
    return `<tr><td>${value(entry.positionText)}</td><th scope="row">${value(entry.driverName)}</th>${cells.map(cell => `<td>${value(cell)}</td>`).join('')}</tr>`;
  }).join('');
  return `<section class="gp-results-group" aria-labelledby="gp-results-${kind}"><h3 id="gp-results-${kind}">${label}</h3><p>Κατάταξη από καταγεγραμμένη απόκριση Jolpica.</p>${captureSource(result.source)}${table(`gp-results-${kind}-table`, `Πίνακας: ${label}`, `Καταγεγραμμένη κατάταξη: ${label}`, columns, rows)}</section>`;
}
function championshipTable(kind, rows, beforeRound, afterRound) {
  const driver = kind === 'drivers', name = driver ? 'Οδηγοί' : 'Κατασκευαστές';
  const columns = [name, `Θέση πριν (γύρος ${beforeRound})`, `Θέση μετά (γύρος ${afterRound})`, 'Βαθμοί πριν', 'Βαθμοί μετά', 'Διαφορά βαθμών', 'Αλλαγή θέσης'];
  const html = rows.map(row => {
    const identity = row.after ?? row.before;
    const cells = [row.before?.positionText, row.after?.positionText, row.before?.points, row.after?.points, row.pointsChange, row.rankChange];
    return `<tr><th scope="row">${value(driver ? identity?.driverName : identity?.constructorName)}</th>${cells.map(cell => `<td>${value(cell)}</td>`).join('')}</tr>`;
  }).join('');
  return `<h4>${name}</h4>${table(`gp-results-${kind}-table`, `Πίνακας πρωταθλήματος: ${name}`, `Μεταβολή πρωταθλήματος: ${name}`, columns, html)}`;
}
function championship(result) {
  if (result.status === 'unavailable') return `<section class="gp-results-group" aria-labelledby="gp-results-championship"><h3 id="gp-results-championship">Πρωτάθλημα</h3><p>${unavailable(result)}</p></section>`;
  return `<section class="gp-results-group" aria-labelledby="gp-results-championship"><h3 id="gp-results-championship">Πρωτάθλημα</h3><p>Μεταβολή ανάμεσα σε καταγεγραμμένους πίνακες πρωταθλήματος. Οι βαθμοί είναι σωρευτικοί και η διαφορά τους δεν αποτελεί κατάταξη αγώνα. Η διαφορά μπορεί να περιλαμβάνει Sprint ή μεταβολές παλαιότερων στοιχείων· δεν αποδίδεται μόνο στον αγώνα. Θετική αλλαγή θέσης σημαίνει άνοδο.</p><div class="gp-results-snapshots">${snapshotSource(result.sources.before, `Στιγμιότυπο πριν · γύρος ${result.beforeRound}`)}${snapshotSource(result.sources.after, `Στιγμιότυπο μετά · γύρος ${result.afterRound}`)}</div>${championshipTable('drivers', result.drivers, result.beforeRound, result.afterRound)}${championshipTable('constructors', result.constructors, result.beforeRound, result.afterRound)}</section>`;
}

/** Render validated captured results; the build rejects invalid adapter outputs. */
export function renderResultsSection({ classifications, comparison } = {}) {
  const results = [classifications?.race, classifications?.qualifying, classifications?.sprint, comparison];
  if (results.some(result => !result || !['available', 'unavailable'].includes(result.status))) throw new TypeError('Invalid results state');
  return `<section class="race-desk-section gp-results" aria-labelledby="gp-results-title"><div class="race-desk-section-head"><div><h2 id="gp-results-title">Αποτελέσματα</h2></div><p>Καταγεγραμμένα αποτελέσματα από τη Jolpica και στιγμιότυπα πρωταθλήματος. Το πρόγραμμα και οι ώρες περιόδων τεκμηριώνονται χωριστά παραπάνω.</p></div><p>Καταγεγραμμένη απόκριση πηγής· δεν τεκμηριώνεται εδώ επίσημη ή οριστική κατάσταση ούτε ιστορικό τροποποιήσεων. Η ανάκτηση δεν είναι χρόνος ισχύος αποτελέσματος.</p>${['race', 'qualifying', 'sprint'].map(kind => classification(kind, classifications[kind])).join('')}${championship(comparison)}</section>`;
}
