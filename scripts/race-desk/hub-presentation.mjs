export const toolNote = tool => {
  const selection = tool.kind === 'generic' ? 'Γενική προβολή · επίλεξε αγώνα μέσα στο εργαλείο.' : tool.kind === 'partial' ? 'Μέρος της επιλογής μεταφέρεται · έλεγξε την επιλογή στο εργαλείο.' : tool.target === 'grid' ? 'Συμπαγής προβολή THE GRID για τον συγκεκριμένο αγώνα.' : 'Σύνδεσμος για τον συγκεκριμένο αγώνα.';
  return tool.target === 'tyres' ? `${selection} Προεπισκόπηση TYRES, όχι μετρημένα αποτελέσματα αγώνα.` : selection;
};

export const GATEWAY_SECTIONS = Object.freeze({
  schedule: Object.freeze({ headingId: 'schedule-title', label: 'Οι περίοδοι' }),
  results: Object.freeze({ headingId: 'gp-results-title', label: 'Αποτελέσματα' }),
  timeline: Object.freeze({ headingId: 'gp-timeline-title', label: 'Χρονολόγιο αγώνα' }),
  pace: Object.freeze({ headingId: 'gp-pace-title', label: 'Ρυθμός αγώνα & stints' }),
  stories: Object.freeze({ headingId: 'related-title', label: 'Σχετικά άρθρα' }),
  sources: Object.freeze({ headingId: 'sources-title', label: 'Πηγές' }),
});

export const gatewayTargetId = section => `gateway-target-${section}`;
export const PERSPECTIVE_HEADINGS = Object.freeze({ before: 'Πριν από τον αγώνα', weekend: 'Το αγωνιστικό τριήμερο', after: 'Μετά τον αγώνα' });
