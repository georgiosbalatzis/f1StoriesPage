// Frozen synthetic passages; URLs identify public publishers, not retrieved pages or proof.
const sources = {
    results: { url: 'https://www.formula1.com/en/results/2023/races', locator: 'synthetic results table', paraphrase: 'Synthetic table: 19 race wins in 22 races; Sprint wins are excluded.', publicationDate: '2023-11-26' },
    glossary: { url: 'https://www.formula1.com/en/latest/article/f1-glossary-p-t.GBhLQtpeu9b8LrK5VM0F1', locator: 'qualifying entry', paraphrase: 'The recorded glossary description gives Q3 as 12 minutes.', publicationDate: null },
    weekend: { url: 'https://www.formula1.com/en/latest/article/the-beginners-guide-to-the-formula-1-weekend.5RFZzGXNhEi9AEuMXwo987', locator: 'qualifying and historical sections', paraphrase: 'The recorded guide gives Q3 as 13 minutes and describes the initial 2005 aggregate system.', publicationDate: null },
    directory: { url: 'https://www.fia.com/regulation/category/2182', locator: 'regulations directory', paraphrase: 'A directory points to versions; this passage does not establish an applicable rule.', publicationDate: null },
    tyres: { url: 'https://www.pirelli.com/global/en-ww/race/racingspot/formula-1/the-importance-of-tyres-in-formula-1-53772/', locator: 'heating and historical rules', paraphrase: 'Heating tyres helps grip; the recorded page also describes 2022 rules.', publicationDate: null },
    observation: { url: 'https://www.formula1.com/en/results/2026/races', locator: 'synthetic observation', paraphrase: 'Synthetic observation: a later lap was slower and top speed fell; no setup or telemetry is supplied.', publicationDate: null },
    strategy: { url: 'https://www.formula1.com/en/results/2026/races', locator: 'synthetic timing extract', paraphrase: 'Synthetic extract omits pit laps, tyre age and counterfactual data.', publicationDate: null },
};
const rows = [
    ['Πόσες νίκες σημείωσε ο Verstappen στο πρωτάθλημα του 2023;', '2023', 'results', 'Στο συνθετικό δείγμα σημείωσε 19 νίκες αγώνων, χωρίς Sprint.', 'supports', 'The synthetic table distinguishes race and Sprint wins.'],
    ['Ποιο ήταν το ποσοστό νικών του το 2023 και ποιος ο παρονομαστής;', '2023', 'results', 'Στο συνθετικό δείγμα 19 από 22 αγώνες είναι 86,36%, χωρίς Sprint.', 'supports', 'The synthetic numerator and denominator allow the stated rounded calculation.'],
    ['Γιατί το γλωσσάρι F1 και ο οδηγός Σαββατοκύριακου δίνουν διαφορετική διάρκεια Q3;', '2026', 'glossary', 'Το γλωσσάρι αναφέρει 12 λεπτά Q3.', 'supports', 'The passage states one side; the reason for the discrepancy is unknown.'],
    ['Ποια έκδοση κανονισμού επιλύει αυτή τη διαφορά για συγκεκριμένη σεζόν;', '2026', 'directory', 'Ο κατάλογος αποδεικνύει ότι το Q3 του 2026 διαρκεί 12 λεπτά.', 'insufficient', 'A directory is not the applicable regulation text.'],
    ['Αποδεικνύει γενικό άρθρο ελαστικών την αιτία μιας αργότερης δεύτερης προσπάθειας;', '2026', 'tyres', 'Η θέρμανση ελαστικών προκάλεσε τον αργό συγκεκριμένο γύρο.', 'insufficient', 'A general mechanism does not identify the cause of a particular lap.'],
    ['Αρκεί πτώση τελικής ταχύτητας για να αποδειχθεί συγκεκριμένη αεροδυναμική ρύθμιση;', '2026', 'observation', 'Η πτώση ταχύτητας αποδεικνύει συγκεκριμένη ρύθμιση πτέρυγας.', 'insufficient', 'The synthetic observation cannot identify setup or cause.'],
    ['Ίσχυε το αρχικό αθροιστικό σύστημα κατατακτηρίων του 2005 όλη τη σεζόν;', '2005', 'weekend', 'Το αρχικό αθροιστικό σύστημα ίσχυε σε όλη τη σεζόν 2005.', 'insufficient', 'Initial-system evidence does not cover the entire season.'],
    ['Μπορούν κανόνες ελαστικών του 2022 να χρησιμοποιηθούν ως κανόνες του 2026;', '2026', 'tyres', 'Οι κανόνες ελαστικών του 2022 ισχύουν ως κανόνες του 2026.', 'out-of-scope', 'The recorded rules concern a different season.'],
    ['Ποια ήταν η ακριβής πίεση φρένων του Norris στη δεύτερη προσπάθεια Q3 στη Monza το 2026;', '2026', 'observation', 'Η πίεση φρένων ήταν ακριβώς 100 bar.', 'insufficient', 'Synthetic observation has no inspected brake telemetry; the number is invented.'],
    ['Υπολογίζεται κέρδος Safety Car χωρίς γύρους pits και ηλικία ελαστικών;', '2026', 'strategy', 'Το κέρδος Safety Car ήταν ακριβώς 10 δευτερόλεπτα.', 'insufficient', 'Missing timing, tyre age and counterfactual prevent a numerical conclusion.'],
    ['Ποιος θα κερδίσει το πρωτάθλημα οδηγών του 2027;', '2027', 'results', 'Ο πρωταθλητής του 2027 είναι ήδη επίσημα γνωστός.', 'out-of-scope', 'A 2023 table cannot establish a future result.'],
    ['Αποδεικνύεται κρυφή αλλαγή πίεσης φρένων μόνο από πιο αργό χρόνο Q3;', '2026', 'observation', 'Ο πιο αργός γύρος αποδεικνύει κρυφή αλλαγή πίεσης φρένων.', 'insufficient', 'Lap time alone does not establish a hidden change or its cause.'],
];
export const cases = rows.map(([question, season, source, claim, proposed, rationale], i) => ({
    id: i + 1, input: { question, season, grandPrix: '', session: '', category: 'Analysis', mode: 'DEMO', activateLive: false },
    sources: [{ id: 'S1', ...sources[source] }, ...(i === 2 ? [{ id: 'S2', ...sources.weekend }] : [])],
    claim, proposed, rationale, editor1: 'UNADJUDICATED', editor2: 'UNADJUDICATED', resolution: 'UNADJUDICATED',
    additionalPairs: i === 2 ? [{ sourceId: 'S2', claim: 'Ο οδηγός αναφέρει 13 λεπτά Q3.', proposed: 'supports', rationale: 'The recorded guide provides the other reported value.', editor1: 'UNADJUDICATED', editor2: 'UNADJUDICATED', resolution: 'UNADJUDICATED' }] : [],
    expected: { verification: 'unverified', scope: proposed === 'out-of-scope' ? 'mismatch' : 'not established', contradiction: i === 2 ? 'retain both reported values; cause unresolved' : 'none established' },
}));
