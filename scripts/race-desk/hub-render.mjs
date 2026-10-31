const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const safeUrl = value => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? value : null;
  } catch { return null; }
};
const kinds = { fp1: 'Ελεύθερες δοκιμές 1', fp2: 'Ελεύθερες δοκιμές 2', fp3: 'Ελεύθερες δοκιμές 3', qualifying: 'Κατατακτήριες', 'sprint-qualifying': 'Κατατακτήριες Sprint', sprint: 'Sprint', race: 'Αγώνας' };
const clock = value => value ? `${escape(value.date)} · ${escape(value.time)}<small>${escape(value.zone)} · ${escape(value.offset)}</small>` : 'Μη διαθέσιμο';
const sessionRow = session => `<tr><th scope="row">${escape(kinds[session.kind] ?? session.kind)}<small>Δεδομένα περιόδου: μη συνδεδεμένα σε αυτή τη σελίδα.</small></th><td>${session.startUtc && session.utcTime ? `<time datetime="${escape(session.startUtc)}">${clock(session.utcTime)}</time>` : 'Μη διαθέσιμο'}</td><td>${clock(session.venueTime)}</td><td>${clock(session.athensTime)}</td></tr>`;
const toolNote = tool => {
  const selection = tool.kind === 'generic' ? 'Γενική προβολή · επίλεξε αγώνα μέσα στο εργαλείο.' : tool.kind === 'partial' ? 'Μέρος της επιλογής μεταφέρεται · έλεγξε την επιλογή στο εργαλείο.' : tool.target === 'grid' ? 'Συμπαγής προβολή THE GRID για τον συγκεκριμένο αγώνα.' : 'Σύνδεσμος για τον συγκεκριμένο αγώνα.';
  return tool.target === 'tyres' ? `${selection} Προεπισκόπηση TYRES, όχι μετρημένα αποτελέσματα αγώνα.` : selection;
};
const toolRow = tool => {
  const url = safeUrl(tool.url);
  return `<li><div><h3>${url ? `<a href="${escape(url)}">${escape(tool.label)} <span aria-hidden="true">↗</span></a>` : escape(tool.label)}</h3><p>${url ? escape(toolNote(tool)) : 'Σύνδεσμος μη διαθέσιμος.'}</p></div></li>`;
};
const sourceRow = source => {
  const url = safeUrl(source.url);
  const label = source.path.startsWith('data/weekends/') ? 'Πρόγραμμα στο TYRES' : source.repository === 'georgiosbalatzis/Tyres' ? 'Εγγραφή αγώνα στο TYRES' : source.repository === 'georgiosbalatzis/f1StoriesPage' ? 'Στιγμιότυπο THE GRID' : 'Εγγραφή πηγής';
  return `<li><div>${url ? `<a href="${escape(url)}">${label}</a>` : '<span>Σύνδεσμος πηγής μη διαθέσιμος.</span>'}<span>Έλεγχος πηγής: <time datetime="${escape(source.reviewedAt)}">${escape(source.reviewedAt.slice(0, 10))}</time></span><details><summary>Στοιχεία τεκμηρίου</summary><span>${escape(source.id)}</span><span>Αναθεώρηση: ${escape(source.revision)}</span><span>${escape(source.path)}</span></details></div></li>`;
};

/** Render a static editorial GP page; includes are expanded by the build. */
export function renderHub(model, { origin = 'https://f1-stories.gr' } = {}) {
  const base = safeUrl(origin);
  if (!base || !/^\/[a-z0-9/-]+\/$/.test(model.path)) throw new TypeError('Invalid hub origin or path');
  const canonical = new URL(model.path, base).href;
  const name = model.displayName ?? model.eventName;
  const title = `${name} ${model.season} | F1 Stories`;
  const description = `Πρόγραμμα, ζώνες ώρας και σύνδεσμοι εργαλείων για το ${name} ${model.season}.`;
  const sessions = model.sessions.length ? model.sessions.map(sessionRow).join('\n') : '<tr><td colspan="4">Δεν υπάρχουν καταγεγραμμένες περίοδοι διαθέσιμες σε αυτή τη σελίδα.</td></tr>';
  return `<!doctype html>
<html lang="el">
<head>
  <!-- @include partials/head-meta.html -->
  <title>${escape(title)}</title>
  <meta name="description" content="${escape(description)}">
  <link rel="canonical" href="${escape(canonical)}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escape(title)}">
  <meta property="og:description" content="${escape(description)}">
  <meta property="og:url" content="${escape(canonical)}">
  <meta property="og:image" content="${escape(new URL('/images/icons/icon-512.png', base).href)}">
  <meta name="twitter:card" content="summary">
  <link rel="stylesheet" href="/styles/home-fonts.css">
  <link rel="stylesheet" href="/styles/vendor/bootstrap.slim.css">
  <link rel="stylesheet" href="/styles/shared-nav.css">
  <link rel="stylesheet" href="/styles/editorial.css">
  <link rel="stylesheet" href="/styles/race-desk.css">
  <script src="/scripts/theme-init.js"></script>
</head>
<body class="editorial-page race-desk-page">
  <a class="race-desk-skip" href="#main">Μετάβαση στο περιεχόμενο</a>
  <!-- @include partials/nav.html -->
  <main id="main" class="race-desk-main">
    <div class="race-desk-wrap">
      <header class="race-desk-hero">
        <div class="race-desk-edition"><span>F1 STORIES / RACE DESK</span><span>SEASON ${escape(model.season)}</span></div>
        <p class="race-desk-kicker">Ο ΦΑΚΕΛΟΣ ΤΟΥ GRAND PRIX</p>
        <h1>${escape(name)} <span>${escape(model.season)}</span><b aria-hidden="true">.</b></h1>
        <div class="race-desk-hero-foot"><p>${escape(model.venue.name)}</p><p>Τοπική ζώνη ώρας <strong>${escape(model.venue.timeZone)}</strong></p></div>
      </header>
      <section class="race-desk-section" aria-labelledby="schedule-title">
        <div class="race-desk-section-head"><div><p class="race-desk-kicker">01 / ΠΡΟΓΡΑΜΜΑ</p><h2 id="schedule-title">Οι περίοδοι</h2></div><p>Προγραμματισμένες ώρες έναρξης από τα διαθέσιμα καταγεγραμμένα στοιχεία. Η λίστα μπορεί να είναι ελλιπής. Η ώρα Ελλάδας εμφανίζεται στη ζώνη Europe/Athens.</p></div>
        <p id="schedule-scroll-hint" class="race-desk-scroll-hint">Κύλησε οριζόντια για όλες τις ώρες · με πληκτρολόγιο, χρησιμοποίησε τα βέλη.</p>
        <div class="race-desk-table-wrap" role="region" tabindex="0" aria-label="Πίνακας προγράμματος" aria-describedby="schedule-scroll-hint"><table><caption>Καταγεγραμμένες προγραμματισμένες ενάρξεις σε UTC, τοπική ώρα και ώρα Ελλάδας</caption><thead><tr><th scope="col">Περίοδος</th><th scope="col">UTC</th><th scope="col">Τοπική ώρα</th><th scope="col">Ώρα Ελλάδας</th></tr></thead><tbody>${sessions}</tbody></table></div>
      </section>
      <section class="race-desk-section" aria-labelledby="tools-title">
        <div class="race-desk-section-head"><div><p class="race-desk-kicker">02 / ΕΡΓΑΛΕΙΑ</p><h2 id="tools-title">Συνέχισε την εξερεύνηση</h2></div><p>Οι σύνδεσμοι ανοίγουν τα εργαλεία. Η επιλογή αγώνα και η διαθεσιμότητα δεδομένων εξαρτώνται από το καθένα.</p></div>
        <ul class="race-desk-tools">${model.tools.map(toolRow).join('\n')}</ul>
      </section>
      <section class="race-desk-section race-desk-related" aria-labelledby="related-title"><div><p class="race-desk-kicker">03 / ΙΣΤΟΡΙΕΣ</p><h2 id="related-title">Σχετικά άρθρα</h2></div><p>Δεν υπάρχουν διαθέσιμες επιμελημένες συνδέσεις άρθρων για αυτό το Grand Prix.</p></section>
      <section class="race-desk-section" aria-labelledby="sources-title"><div class="race-desk-section-head"><div><p class="race-desk-kicker">04 / ΤΕΚΜΗΡΙΩΣΗ</p><h2 id="sources-title">Πηγές</h2></div><p>Οι ημερομηνίες αφορούν τον έλεγχο των πηγών, όχι την τελευταία ενημέρωση των δεδομένων τους.</p></div><ul class="race-desk-sources">${model.sources.length ? model.sources.map(sourceRow).join('\n') : '<li>Δεν υπάρχουν διαθέσιμες πηγές.</li>'}</ul></section>
    </div>
  </main>
  <!-- @include partials/cookie-banner.html -->
  <!-- @include partials/footer.html -->
  <script src="/scripts/analytics.js" defer></script>
  <script src="/scripts/cookie-consent.js" defer></script>
  <script src="/scripts/shared-nav.js" defer></script>
  <script src="/scripts/sw-cleanup.js" defer></script>
</body>
</html>`;
}
