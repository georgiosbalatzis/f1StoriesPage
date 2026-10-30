// Synthetic inputs for the coordinator's offline benchmark; no timings are recorded here.
const record = { type: 'factual-correction', date: '2026-10-29', section: 'Αρχή', reason: 'Διόρθωση συνθετικού στοιχείου', decision: 'approved', approvedBy: 'Synthetic Editor', approvedOn: '2026-10-29' };
module.exports = {
    missing: null,
    factual: JSON.stringify([record]),
    substantial: JSON.stringify([{ ...record, type: 'substantial-update' }]),
    multiple: JSON.stringify([record, { ...record, type: 'substantial-update' }]),
    malformed: '[',
    unapproved: JSON.stringify([{ ...record, decision: 'pending' }]),
    hostile: JSON.stringify([{ ...record, reason: '<script> & "κείμενο"' }]),
    copyEdit: null
};
