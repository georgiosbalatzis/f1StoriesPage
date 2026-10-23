import { sections, kinds } from './schema.mjs';
export function briefText(result) {
    const d = result.dossier;
    const lines = ['AI Research — F1 Stories', result.label, '', 'Ερώτημα και πεδίο έρευνας', d.scope];
    for (const [key, label] of Object.entries(sections)) {
        lines.push('', label);
        if (!d[key].length) lines.push('Δεν υπάρχουν τεκμηριωμένες εγγραφές.');
        for (const c of d[key]) {
            lines.push(`[${c.id}] ${c.text}`, `${kinds[c.kind]} · ${c.verification === 'fixture_inspected' ? 'Επιθεωρημένο DEMO' : 'Μη επαληθευμένο'} · Πηγές: ${c.sourceIds.join(', ') || 'καμία'}`, c.reason);
            lines.push(`Αρχική ενότητα: ${sections[c.originalSection]} · Συσχέτιση: ${c.association}`);
            if (c.statistic) for (const [k, v] of Object.entries(c.statistic)) lines.push(`${k}: ${v}`);
        }
    }
    lines.push('', 'Περιορισμοί έρευνας', ...d.limitations.map(s => `• ${s}`), '', 'Προτεινόμενη δομή άρθρου (προτάσεις προς έλεγχο)', ...d.outline.map(s => `• ${s}`), '', 'Μητρώο πηγών');
    for (const s of d.sources) lines.push(`[${s.id}] ${s.publisher} — ${s.title}`, s.url,
        `Δημοσίευση: ${s.publicationDate || 'άγνωστη'} · ${s.provenance === 'fixture' ? 'Επιθεώρηση fixture' : 'Ανάκτηση'}: ${s.retrievedAt}`);
    if (!d.sources.length) lines.push('Δεν ανακτήθηκαν πηγές.');
    lines.push('', 'Χρήση και εκτίμηση κόστους', JSON.stringify(result.usage, null, 2), 'Η εκτίμηση δεν είναι τελική χρέωση. Ο τοπικός μετρητής δεν είναι χρηματικό όριο.');
    return lines.join('\n') + '\n';
}
