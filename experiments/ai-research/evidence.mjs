import { sections, validateSchema } from './schema.mjs';

export const APPROVED_DOMAINS = Object.freeze(['fia.com', 'formula1.com', 'pirelli.com']);
export function approvedURL(value) {
    try {
        if (typeof value !== 'string' || value.length > 2000 || /[\s\\\u0000-\u001f\u007f]/.test(value)) return null;
        const u = new URL(value);
        if (u.protocol !== 'https:' || u.username || u.password || u.port || !APPROVED_DOMAINS.some(d => u.hostname === d || u.hostname.endsWith('.' + d))) return null;
        return value;
    } catch { return null; }
}
const publisher = url => new URL(url).hostname.replace(/^(www|corp|api|press)\./, '');

export function retrievedEvidence(response, retrievedAt) {
    const records = new Map(), annotations = [];
    const add = (s, via) => {
        const url = approvedURL(s.url);
        if (!url) return;
        const old = records.get(url);
        records.set(url, { id: old?.id || `S${records.size + 1}`, publisher: publisher(url),
            title: typeof s.title === 'string' ? s.title.slice(0, 400) : old?.title || 'Τίτλος μη διαθέσιμος από τον πάροχο',
            url, publicationDate: null, retrievedAt, provenance: 'provider', via: [...new Set([...(old?.via || []), via])] });
    };
    for (const item of response.output || []) {
        if (item.type === 'web_search_call' && item.status === 'completed') {
            for (const s of item.action?.sources || []) add(s, 'retrieved');
            if (['open_page', 'find_in_page'].includes(item.action?.type)) add(item.action, item.action.type);
        }
        if (item.type === 'message') for (const content of item.content || []) {
            if (content.type !== 'output_text') continue;
            for (const a of content.annotations || []) if (a.type === 'url_citation' && approvedURL(a.url)) {
                add(a, 'citation'); annotations.push({ ...a, text: content.text });
            }
        }
    }
    return { records: [...records.values()], annotations };
}

function citedFor(text, url, annotations) {
    // JSON offsets belong to this exact output_text block; never associate nearby citations.
    const encoded = JSON.stringify(text);
    return annotations.some(a => {
        const start = a.text.indexOf(encoded), end = start + encoded.length;
        return approvedURL(a.url) === url && start >= 0 && a.text.lastIndexOf(encoded) === start
            && Number.isInteger(a.start_index) && Number.isInteger(a.end_index)
            && a.start_index >= start && a.end_index <= end && a.end_index > a.start_index;
    });
}

export function validateEvidence(raw, evidence, { demo = false } = {}) {
    validateSchema(raw);
    const ids = new Set(), modelSources = new Map();
    for (const s of raw.sources) {
        if (modelSources.has(s.id)) throw new Error('Duplicate source ID');
        const url = approvedURL(s.url), actual = evidence.records.find(r => r.url === url);
        modelSources.set(s.id, actual || null);
    }
    const result = { scope: raw.scope, ...Object.fromEntries(Object.keys(sections).map(k => [k, []])),
        limitations: [...raw.limitations], outline: raw.outline, sources: evidence.records, validation: { rejectedSources: [...modelSources.values()].filter(s => !s).length, demotedClaims: 0 } };
    for (const section of Object.keys(sections)) for (const c of raw[section]) {
        if (ids.has(c.id)) throw new Error('Duplicate claim ID');
        ids.add(c.id);
        const linked = c.sourceIds.map(id => modelSources.get(id));
        const valid = linked.length > 0 && linked.every(Boolean);
        const associated = valid && linked.every(s => citedFor(c.text, s.url, evidence.annotations));
        // Only static, reviewed DEMO claim/source pairs can have established support.
        // Hosted web search exposes citations, not inspected page bodies or entailment proof.
        const inspected = demo && valid && linked.every(s => s.provenance === 'fixture' && s.inspectedClaims?.includes(c.text));
        const speculative = ['technical_interpretation', 'prediction', 'unsupported_hypothesis'].includes(c.kind);
        const statisticOK = c.kind !== 'calculated_statistic' || (c.statistic && inspected);
        const supported = inspected && statisticOK && !speculative;
        const finding = { ...c, originalSection: section, sourceIds: [...new Set(linked.filter(Boolean).map(s => s.id))],
            verification: supported ? 'fixture_inspected' : 'unverified',
            association: inspected ? 'inspected_fixture' : associated ? 'provider_citation' : valid ? 'model_reference_only' : 'rejected_reference',
            reason: supported ? 'Επιθεωρημένο σταθερό παράδειγμα — όχι νέα έρευνα.'
                : !valid ? 'Λείπει πραγματική εγγραφή πηγής για έναν ή περισσότερους ισχυρισμούς.'
                : 'Η υποστήριξη του ισχυρισμού από τη σελίδα δεν έχει επαληθευτεί. Απαιτείται έλεγχος συντάκτη.' };
        // Preserve disagreements as disagreements, even when their support is unverified.
        const target = supported || section === 'contradictions' ? section : 'unverified';
        if (target !== section) result.validation.demotedClaims++;
        result[target].push(finding);
    }
    if (!demo) result.limitations.unshift('Οι ανακτημένοι σύνδεσμοι και οι παραπομπές του παρόχου δεν αποδεικνύουν σημασιολογική υποστήριξη. Δεν επιθεωρήθηκαν σώματα σελίδων από τον τοπικό validator· οι πραγματολογικές προτάσεις παραμένουν μη επαληθευμένες. Η ημερομηνία δημοσίευσης δεν τεκμηριώνεται από τα διαθέσιμα metadata και παραμένει άγνωστη.');
    return result;
}
