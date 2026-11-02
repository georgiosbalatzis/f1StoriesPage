const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const reasons = {
  unmapped: 'Δεν υπάρχει εγκεκριμένη αντιστοίχιση πηγής για αυτόν τον αγώνα.',
  uncaptured: 'Δεν υπάρχει καταγεγραμμένη απόκριση πηγής για αυτόν τον αγώνα.',
  'rights-unresolved': 'Η δημοσίευση δεδομένων της πηγής δεν έχει εγκριθεί.',
};
const clock = new Intl.DateTimeFormat('el-GR', { timeZone: 'Europe/Athens', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const utc = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 19) === value.slice(0, 19);
const url = (value, host) => {
  try {
    const parsed = new URL(value);
    return typeof value === 'string' && parsed.protocol === 'https:' && parsed.hostname === host && !parsed.port && !parsed.username && !parsed.password;
  } catch { return false; }
};
const nonnegative = value => Number.isSafeInteger(value) && value >= 0;
const eventValid = event => event && event.schemaVersion === 1 && /^tl-[a-f0-9]{64}$/.test(event.eventId) && typeof event.raceId === 'string' && !!event.raceId.trim()
  && event.sessionKind === 'race' && ['race-control-observation', 'pit-lane-visit'].includes(event.eventType) && event.provider === 'openf1'
  && utc(event.timestampUtc) && /\.\d{6}Z$/.test(event.timestampUtc)
  && (event.lapNumber === null || nonnegative(event.lapNumber)) && (event.driverNumber === null || (Number.isInteger(event.driverNumber) && event.driverNumber >= 1 && event.driverNumber <= 99))
  && (event.category === null || typeof event.category === 'string') && typeof event.label === 'string' && !!event.label.trim()
  && (event.detail === null || typeof event.detail === 'string') && ['full', 'partial'].includes(event.coverage)
  && Array.isArray(event.sourceRefs) && event.sourceRefs.length > 0 && event.sourceRefs.every(ref => ref && typeof ref.captureId === 'string' && !!ref.captureId.trim() && nonnegative(ref.recordIndex));
const row = event => {
  const millis = event.timestampUtc.replace(/(\.\d{3})\d{3}Z$/, '$1Z');
  const meta = [`<time datetime="${escape(event.timestampUtc)}">${escape(clock.format(new Date(millis)))}</time> ώρα Ελλάδας`];
  if (event.lapNumber !== null) meta.push(`Γύρος ${event.lapNumber}`);
  if (event.driverNumber !== null) meta.push(`#${event.driverNumber}`);
  return `<li><p class="gp-timeline-meta">${meta.join(' · ')}</p><p class="gp-timeline-label">${escape(event.label)}</p>${event.detail === null ? '' : `<p class="gp-timeline-detail">${escape(event.detail)}</p>`}</li>`;
};

export function renderTimelineSection(context, { number } = {}) {
  if (!/^\d{2}$/.test(number ?? '') || typeof number !== 'string' || !context || !['available', 'unavailable'].includes(context.status)) throw new TypeError('Invalid timeline state or number');
  let lede, body = '';
  if (context.status === 'unavailable') {
    if (!Object.hasOwn(reasons, context.reason)) throw new TypeError('Invalid timeline reason');
    lede = reasons[context.reason];
  } else {
    const { coverage, provider, sources, counts, attribution, events } = context;
    if (!['full', 'partial', 'empty'].includes(coverage) || provider !== 'openf1' || !Array.isArray(events) || !events.every(eventValid)
      || !counts || !['raceControl', 'pit', 'outOfWindow', 'duplicates'].every(key => nonnegative(counts[key]))
      || !Array.isArray(sources) || !sources.length || !sources.every(source => source && ['sessions', 'race_control', 'pit'].includes(source.endpoint) && utc(source.observedAt))
      || !attribution || attribution.name !== 'OpenF1' || attribution.license !== 'CC BY-NC-SA 4.0'
      || !url(attribution.url, 'openf1.org') || !url(attribution.licenseUrl, 'creativecommons.org')) throw new TypeError('Invalid timeline context');
    lede = 'Καταγεγραμμένες παρατηρήσεις από τις αποκρίσεις της πηγής για τη συνεδρία αγώνα.';
    const countLine = `${counts.raceControl} ${counts.raceControl === 1 ? 'μήνυμα αγωνοδιεύθυνσης' : 'μηνύματα αγωνοδιεύθυνσης'}, ${counts.pit} ${counts.pit === 1 ? 'διέλευση' : 'διελεύσεις'} από το pit lane${counts.outOfWindow ? `, ${counts.outOfWindow} εκτός παραθύρου συνεδρίας` : ''}`;
    const observed = [...new Set(sources.map(source => source.observedAt.slice(0, 10)))].sort().map(day => `<time datetime="${escape(day)}">${escape(day)} UTC</time>`).join(', ');
    body = `<p class="gp-timeline-counts">${countLine}</p>${coverage === 'partial' ? '<p>Η κάλυψη των καταγεγραμμένων αποκρίσεων είναι μερική.</p>' : ''}${coverage === 'empty' ? '<p>Οι καταγεγραμμένες αποκρίσεις δεν περιέχουν παρατηρήσεις.</p>' : ''}<details class="gp-timeline-details"><summary>Εμφάνιση ${events.length === 1 ? 'της 1 καταγραφής' : `όλων των ${events.length} καταγραφών`}</summary><ol class="gp-timeline-list" role="list">${events.map(row).join('')}</ol></details><p class="gp-timeline-source">Πηγή: <a href="${escape(attribution.url)}">OpenF1</a> (ανεπίσημη πηγή, χωρίς σχέση με τη Formula 1) · ανάκτηση: ${observed} · Άδεια παράγωγων δεδομένων: <a href="${escape(attribution.licenseUrl)}">CC BY-NC-SA 4.0</a>. Καταγεγραμμένες παρατηρήσεις OpenF1· δεν πιστοποιούν επίσημες αποφάσεις FIA.</p>`;
  }
  return `<section class="race-desk-section gp-timeline" aria-labelledby="gp-timeline-title"><div class="race-desk-section-head"><div><p class="race-desk-kicker">${number} / ΧΡΟΝΟΛΟΓΙΟ ΑΓΩΝΑ</p><h2 id="gp-timeline-title">Χρονολόγιο αγώνα</h2></div><p>${escape(lede)}</p></div>${body}</section>`;
}
