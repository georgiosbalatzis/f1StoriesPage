import { sections, scopeText } from './schema.mjs';
import { validateEvidence } from './evidence.mjs';

export const DEMO_LABEL = 'DEMO — Δεν πραγματοποιήθηκε ζωντανή έρευνα';
export const examples = [
    { id: 'technical', label: 'Τεχνικό · δεύτερη προσπάθεια', category: 'Technical', session: 'Qualifying', question: 'Γιατί μπορεί η δεύτερη προσπάθεια στις κατατακτήριες με τα μονοθέσια του 2026 να είναι πιο αργή; Ελαστικά, θερμική κατάσταση, ενέργεια και ισορροπία οδηγού.' },
    { id: 'strategy', label: 'Ανάλυση · Safety Car', category: 'Analysis', session: 'Race', question: 'Ποια στοιχεία χρειάζονται για να κρίνουμε αν το Safety Car ευνόησε ή ζημίωσε μια συγκεκριμένη στρατηγική;' },
    { id: 'history', label: 'Ιστορία · κατατακτήριες 2005', category: 'History', session: 'Qualifying', question: 'Πώς διέφερε το αρχικό σύστημα αθροιστικών κατατακτηρίων του 2005 από το σημερινό Q1–Q2–Q3;' },
    { id: 'unsupported', label: 'Έλεγχος · ανεπαρκή στοιχεία', category: 'Technical', session: 'Qualifying', question: 'Ποια ήταν η ακριβής πίεση φρένων και το φορτίο καυσίμου του Norris στη δεύτερη προσπάθεια Q3 στη Monza το 2026;' },
];
const source = (id, publisher, title, url, publicationDate = null) => ({ id, publisher, title, url, publicationDate,
    retrievedAt: '2026-10-23', provenance: 'fixture', via: ['manually_inspected_fixture'], inspectedClaims: [] });
export const fixtureSources = [
    source('S1', 'Pirelli', 'The importance of tyres in Formula 1', 'https://www.pirelli.com/global/en-ww/race/racingspot/formula-1/the-importance-of-tyres-in-formula-1-53772/'),
    source('S2', 'Formula 1', 'F1 2026 Regulations – Terminology Update', 'https://corp.formula1.com/f1-2026-regulations-terminology-update/', '2025-12-17'),
    source('S3', 'Formula 1', 'F1 Glossary (P-T) — Safety Car', 'https://www.formula1.com/en/latest/article/f1-glossary-p-t.GBhLQtpeu9b8LrK5VM0F1'),
    source('S4', 'Formula 1', 'The beginner’s guide to the F1 weekend', 'https://www.formula1.com/en/latest/article/the-beginners-guide-to-the-formula-1-weekend.5RFZzGXNhEi9AEuMXwo987'),
];
const item = (id, text, sourceIds = [], kind = 'source_report') => ({ id, text, sourceIds, kind, statistic: null });

export function demoDossier(input) {
    // Exact questions only: an arbitrary question must never receive an unrelated canned answer.
    const example = examples.find(e => e.question === input.question && input.season === '2026' && !input.grandPrix && input.session === e.session && input.category === e.category);
    const raw = { scope: scopeText(input),
        ...Object.fromEntries(Object.keys(sections).map(k => [k, []])), sources: [],
        limitations: ['Σταθερό εκπαιδευτικό dossier. Οι πηγές επιθεωρήθηκαν στις 23/10/2026· δεν ανακτήθηκαν κατά την εκτέλεση. Δεν πρόκειται για αυτόματη επαλήθευση ή άρθρο.', 'Δεν κατασκευάστηκαν αριθμητικά ευρήματα. Τα αγωνιστικά στατιστικά απαιτούν συγκεκριμένο δείγμα, περίοδο, μονάδα, πηγή, μέθοδο και εξαιρέσεις.'],
        outline: ['Ορισμός ερωτήματος και χρονικού πλαισίου', 'Επίσημα στοιχεία και τι ακριβώς τεκμηριώνουν', 'Εναλλακτικές εξηγήσεις και ελλείψεις', 'Συμπέρασμα με ρητό βαθμό αβεβαιότητας'] };
    if (example?.id === 'technical') {
        raw.executive.push(item('T1', 'Η Pirelli εξηγεί ότι η προθέρμανση των ελαστικών βοηθά στην επίτευξη κατάλληλης πρόσφυσης.', ['S1']));
        raw.facts.push(item('T2', 'Η ανακοίνωση της Formula 1 του Δεκεμβρίου 2025 περιγράφει ενεργή αεροδυναμική και διαχείριση ανάκτησης και διάθεσης ενέργειας για τη νέα γενιά.', ['S2']));
        raw.technical.push(item('T3', 'Υπόθεση προς έλεγχο: διαφορετική θερμική προετοιμασία ή διαθέσιμη ηλεκτρική ενέργεια ενδέχεται να επηρεάσει τη δεύτερη προσπάθεια. Δεν τεκμηριώνεται αιτία για συγκεκριμένο γύρο.', ['S1', 'S2'], 'technical_interpretation'));
        raw.technical.push(item('T5', 'Υπόθεση προς έλεγχο: αλλαγή της ισορροπίας που αισθάνεται ο οδηγός μπορεί να συνδέεται με τη θερμική κατάσταση εμπρός / πίσω. Απαιτείται σχετική δήλωση οδηγού και αντιστοίχιση στον γύρο· δεν εξάγεται setup ή αεροδυναμικό φορτίο.', [], 'technical_interpretation'));
        raw.alternatives.push(item('T4', 'Εναλλακτικές προς έλεγχο: κυκλοφορία, εξέλιξη πίστας, άνεμος ή λάθος οδηγού. Χρειάζονται επίσημα χρονόμετρα, onboard και δηλώσεις με χρονικό πλαίσιο.', [], 'unsupported_hypothesis'));
        raw.limitations.push('Το γενικό άρθρο της Pirelli περιέχει παλαιότερους κανόνες. Χρησιμοποιείται μόνο για την αρχή της προθέρμανσης, όχι ως κανονισμός ελαστικών του 2026. Δεν συνάγονται setup, ακριβείς αεροδυναμικές δυνάμεις, πίεση φρένων, καύσιμο ή αιτία βλάβης.');
    } else if (example?.id === 'strategy') {
        raw.facts.push(item('A1', 'Το επίσημο γλωσσάρι της Formula 1 περιγράφει το Safety Car ως όχημα που οδηγεί το πεδίο με χαμηλότερη ταχύτητα για λόγους ασφαλείας.', ['S3']));
        raw.technical.push(item('A2', 'Σχέδιο ελέγχου: καταγραφή γύρου εισόδου στα pits, απώλειας χρόνου, σειράς στην επανεκκίνηση, ηλικίας ελαστικών και επιλογών αντιπάλων· κατόπιν σύγκριση με δηλωμένο εναλλακτικό σενάριο.', [], 'technical_interpretation'));
        raw.alternatives.push(item('A3', 'Η τελική θέση μόνη της δεν αρκεί ως σχέδιο αιτιώδους τεκμηρίωσης. Χρειάζεται εκτίμηση του τι θα συνέβαινε χωρίς την ουδετεροποίηση, με ρητές παραδοχές.', [], 'technical_interpretation'));
        raw.limitations.push('Δεν έχει επιλεγεί οδηγός ή αγώνας. Δεν υπολογίζεται κέρδος σε δευτερόλεπτα ούτε δηλώνεται ωφελημένος. Καμία παρατηρημένη διαφωνία πηγών στο σταθερό παράδειγμα.');
    } else if (example?.id === 'history') {
        raw.facts.push(item('H1', 'Ο επίσημος οδηγός της Formula 1 περιγράφει το αρχικό σύστημα του 2005 ως άθροισμα δύο προσπαθειών, το Σάββατο και την Κυριακή.', ['S4']));
        raw.facts.push(item('H2', 'Ο ίδιος οδηγός περιγράφει το σημερινό σύστημα ως διαδοχικά σκέλη Q1, Q2 και Q3 με αποκλεισμούς.', ['S4']));
        raw.contradictions.push(item('H3', 'Οι δύο σελίδες της Formula 1 διαφωνούν στη διάρκεια του Q3: το γλωσσάρι αναφέρει 12 λεπτά, ενώ ο οδηγός Σαββατοκύριακου 13 λεπτά. Η διαφορά διατηρείται· δεν επιλέγεται κανόνας χωρίς έλεγχο της ισχύουσας έκδοσης FIA.', ['S3', 'S4']));
        raw.limitations.push('Η σύγκριση αφορά τον αρχικό αθροιστικό κανόνα του 2005, όχι ολόκληρη τη σεζόν. Ο οδηγός είναι επίσημη δευτερογενής περιγραφή· απαιτείται η αντίστοιχη έκδοση του κανονισμού FIA πριν από νομικά ακριβή παράθεση άρθρου.');
    } else {
        raw.unverified.push(item('U1', 'Ανεπαρκή στοιχεία: το DEMO δεν διαθέτει επιθεωρημένο υλικό που να απαντά στο συγκεκριμένο ερώτημα. Δεν εκτιμώνται μη δημοσιευμένα δεδομένα οχήματος.', [], 'unsupported_hypothesis'));
        raw.limitations.push('Δεν επινοούνται πηγές, αριθμοί ή αιτιώδεις εξηγήσεις για να συμπληρωθεί το dossier.');
    }
    const used = new Set(Object.keys(sections).flatMap(k => raw[k].flatMap(c => c.sourceIds)));
    const records = structuredClone(fixtureSources.filter(s => used.has(s.id)));
    for (const s of records) s.inspectedClaims = [...raw.executive, ...raw.facts, ...raw.contradictions].filter(c => c.sourceIds.includes(s.id)).map(c => c.text);
    raw.sources = records.map(({ id, url, title, publicationDate }) => ({ id, url, title, publicationDate }));
    const dossier = validateEvidence(raw, { records, annotations: [] }, { demo: true });
    dossier.sources = dossier.sources.map(({ inspectedClaims, ...s }) => s);
    return { mode: 'DEMO', label: DEMO_LABEL, dossier, usage: { model: null, inputTokens: 0, outputTokens: 0, searchToolCalls: 0, estimatedUSD: 0, elapsedMs: 0, note: 'Σταθερό παράδειγμα· καμία κλήση παρόχου.' } };
}
