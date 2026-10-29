# Μητρώο συντακτικών πειραμάτων — I-08A

Εδώ ο υπεύθυνος καταγράφει μία περιορισμένη αλλαγή, την υπόθεσή της, τον τρόπο παρατήρησης και την επαναφορά της.
Το [registry.json](registry.json) ξεκινά κενό. Είναι απλό αρχείο υπό έλεγχο Git, όχι υπηρεσία δοκιμών.
Δεν περιέχει αναλυτικά δεδομένα και δεν συνδέεται με τον πίνακα Intelligence.

Ένα πείραμα μπορεί να αφορά σαφέστερο σύνδεσμο ή καλύτερη δομή άρθρου. Καταγράφουμε συγκεκριμένες URL,
έναν υπεύθυνο, ένα κύριο αποτέλεσμα, όρια προστασίας της ποιότητας και ακριβή βήματα επαναφοράς.
Η έγκριση του μητρώου δεν δημοσιεύει την αλλαγή: ο υπεύθυνος την υλοποιεί και την ελέγχει χωριστά.

## Τι μπορεί να δείξει

Με περίπου 5 επισκέπτες που έχουν συναινέσει ανά ημέρα, τα διαθέσιμα συμβάντα ανά άρθρο είναι ελάχιστα.
Η σύγκριση πριν/μετά είναι **παρατηρησιακή**, όχι απόδειξη ότι η αλλαγή προκάλεσε διαφορά.
Αγωνιστικό Σαββατοκύριακο, μεγάλη είδηση F1, νέα δημοσίευση, ενημέρωση Google ή αλλαγή προγράμματος
μπορούν να εξηγήσουν το αποτέλεσμα. Συνήθως η σωστή απόφαση είναι **INCONCLUSIVE**.

Το προεπιλεγμένο ελάχιστο είναι 30 μετρήσεις του κύριου αποτελέσματος **σε κάθε περίοδο**, όχι αθροιστικά.
Για ποσοστό ή p75 καταγράφουμε ποιο πλήθος υποκείμενων συμβάντων/παρατηρήσεων εφαρμόζει αυτό το όριο.
Ακόμη και πάνω από το όριο δεν τεκμηριώνεται αιτιότητα ή στατιστική ισχύς. Χαμηλότερο δηλωμένο όριο δίνει WARNING,
δεν δικαιολογεί ισχυρισμό επιτυχίας. Το μητρώο δεν περιέχει πλήθη και δεν αξιολογεί αποτελέσματα· ο evaluator είναι επόμενο έργο.

- Τα GA4 συμβάντα με συναίνεση δεν είναι μοναδικοί αναγνώστες ή συνεδρίες.
- Τα Search Console clicks δεν είναι GA4 page_views. Δεν συγκρίνουμε διαφορετικές πηγές ως μία μέτρηση.
- Ένα εσωτερικό κλικ δεν αποδεικνύει φόρτωση προορισμού.
- Εβδομαδιαία ή μεταφερόμενα δεδομένα κρατούν τις δικές τους ημερομηνίες· δεν είναι σημερινά.
- Ανεπαρκή, ανώριμα ή μη συγκρίσιμα δεδομένα οδηγούν σε αποχή από συμπέρασμα.

## Κύκλος ζωής και έγκριση

| Κατάσταση | Σημασία | Επιτρεπόμενη επόμενη κατάσταση |
| --- | --- | --- |
| PROPOSED | Καταγεγραμμένη πρόταση | APPROVED, INCONCLUSIVE |
| APPROVED | Ανθρώπινη έγκριση του σχεδίου | RUNNING, PAUSED, INCONCLUSIVE |
| RUNNING | Ο υπεύθυνος έχει ξεκινήσει την αλλαγή | PAUSED, COMPLETED, INCONCLUSIVE, ROLLED_BACK |
| PAUSED | Προσωρινή παύση | APPROVED, RUNNING, INCONCLUSIVE, ROLLED_BACK |
| COMPLETED | Ολοκληρώθηκε η ανασκόπηση, χωρίς αυτόματο ισχυρισμό επιτυχίας | ROLLED_BACK |
| INCONCLUSIVE | Δεν στηρίζεται ασφαλές συμπέρασμα ή η πρόταση εγκαταλείφθηκε | ROLLED_BACK |
| ROLLED_BACK | Η επαναφορά έγινε από τον υπεύθυνο | Καμία |

Το `history` αρχίζει με PROPOSED. Προσθέτουμε εγγραφή στο τέλος για κάθε αλλαγή κατάστασης και ενημερώνουμε
το `status` ώστε να ισούται με την τελευταία εγγραφή. Δεν σβήνουμε και δεν ξαναγράφουμε παλιές εγγραφές.
Κάθε εγγραφή έχει πραγματική ημερομηνία, υπεύθυνο (`actor`) και σημείωση. Οι APPROVED, RUNNING και ROLLED_BACK
χρειάζονται σύνδεσμο PR ή commit του παρόντος repository. Το RUNNING χρειάζεται προηγούμενο APPROVED.
Η επιστροφή από PAUSED σε RUNNING διατηρεί την προηγούμενη έγκριση· ουσιώδης αλλαγή υπόθεσης/μέτρησης χρειάζεται νέο ID.

Ο έλεγχος αρχείου αποδεικνύει μόνο τη συνέπεια της καταγεγραμμένης ακολουθίας. Η διατήρηση παλιών εγγραφών,
η πραγματική έγκριση, η ύπαρξη/συγχώνευση των συνδέσμων και η εκτέλεση της επαναφοράς ελέγχονται από άνθρωπο
στο diff και στο ιστορικό Git. Παραμένουν **NOT VERIFIED** από το CLI.

## Προσθήκη και έλεγχος

1. Συμπληρώστε το [πρότυπο πρότασης](templates/proposal.md). Επιλέξτε ένα κύριο αποτέλεσμα και γράψτε την επαναφορά πριν από την αλλαγή.
2. Δώστε μόνιμο ID `EG-YYYY-NNN`, π.χ. `EG-2026-001`. Μην επαναχρησιμοποιείτε ID και μην αφαιρείτε παλιά πειράματα.
3. Προσθέστε εγγραφή στο `experiments` με όλα τα υποχρεωτικά πεδία του συμβολαίου παρακάτω.
4. Ελέγξτε χειροκίνητα τις canonical URL και πιθανές παράλληλες παρεμβάσεις. Δύο RUNNING με ίδια URL, ίδιο `primaryOutcome.metric`
   και έστω μία κοινή ημέρα μεταξύ οποιωνδήποτε baseline/comparison περιόδων απορρίπτονται, ακόμη και με διαφορετικό `source`.
5. Εκτελέστε τον τοπικό έλεγχο και τα tests. Η διαδρομή `[path]` είναι προαιρετική· δεν χρειάζεται κλειδί ή σύνδεση.
6. Ζητήστε ανθρώπινη ανασκόπηση του συγκεκριμένου diff. Καταγράψτε την έγκριση και την έναρξη με συνδέσμους τεκμηρίωσης.
7. Χρησιμοποιήστε το [πρότυπο απολογισμού](templates/result-report.md), επιλέξτε κατάσταση και προσθέστε την στο ιστορικό.
   Το COMPLETED απαιτεί ώριμα δεδομένα· INCONCLUSIVE ή ROLLED_BACK μπορούν να καταγραφούν νωρίτερα.

```sh
node scripts/intelligence/experiment-registry.mjs check
node scripts/intelligence/experiment-registry.mjs check experiments/editorial-growth/registry.json
npm run test:intelligence
```

PASS σημαίνει ότι πέρασαν οι έλεγχοι σχήματος και διακυβέρνησης, όχι ότι το πείραμα πέτυχε.
WARNING σημαίνει δηλωμένο περιορισμό. FAIL σημαίνει παράβαση συμβολαίου και έξοδο CLI 1.
Η ακρίβεια παραγωγικών δεδομένων και οι αιτιώδεις ισχυρισμοί παραμένουν NOT VERIFIED.
Το CLI δεν μεταβάλλει αρχεία. Οι προειδοποιήσεις δεν αλλάζουν την έξοδο 0 ενός έγκυρου αρχείου.

## Περίοδοι και ωρίμανση

Οι ημερομηνίες είναι πραγματικές `YYYY-MM-DD`, με συμπεριλαμβανόμενα και τα δύο άκρα, ίδιο αριθμό ημερών
και `baselinePeriod.end < comparisonPeriod.start`. Το «σήμερα» είναι η ημερολογιακή ημέρα στην
`America/Los_Angeles`, όπως στο snapshot. Ο έλεγχος δεν επιλέγει περιόδους ούτε αλλάζει χρονική ζώνη πηγών:
καταγράφουμε στο `population` τα φίλτρα/ζώνη/coverage και χρησιμοποιούμε ακριβώς τα ίδια και στις δύο περιόδους.

Για COMPLETED, το τέλος σύγκρισης πρέπει να απέχει τουλάχιστον 4 ημέρες για GA4, 3 για GSC, 4 για RUM που προέρχεται από
GA4 και 0 για repo. Χρησιμοποιείται η μεγαλύτερη υστέρηση μεταξύ κύριου αποτελέσματος και guardrails.
Τα όρια εξάγονται ως `MATURITY_LAG_DAYS`. Η ωρίμανση ελέγχεται **μόνο για COMPLETED**.
Οι PROPOSED, APPROVED, RUNNING και PAUSED δέχονται μελλοντικές/ανώριμες περιόδους ώστε να καταγράφεται το σχέδιο πριν από την εκτέλεση.
Οι INCONCLUSIVE και ROLLED_BACK επίσης δεν απαιτούν ωρίμανση, επειδή μπορούν να τερματιστούν νωρίς.
Οι έλεγχοι πραγματικών ημερομηνιών, ίσου μήκους και μη επικάλυψης παραμένουν υποχρεωτικοί σε όλες τις καταστάσεις.

## Τι δεν συμβαίνει αυτόματα

Καμία αυτόματη δημοσίευση, εξωτερική ανάρτηση, αλλαγή GA4 ή tracking, cookie, κατανομή επισκεπτών ή πραγματικό A/B test.
Πραγματικό A/B απαιτεί ξεχωριστά εγκεκριμένο σχέδιο. Δεν προστίθεται βάση, cloud service, SQL, προγραμματισμένο query ή workflow.
Η απόφαση διατήρησης, παύσης ή επαναφοράς και κάθε δημόσια αλλαγή γίνονται από τον υπεύθυνο.

Το repository, τα PR, τα CI logs και τα artifacts είναι δημόσια. Μην γράφετε πραγματικά analytics πλήθη,
αναζητήσεις, στοιχεία επισκεπτών, κλειδιά, credentials ή αποκρυπτογραφημένα δεδομένα σε κανένα πεδίο ή αναφορά εδώ.
Κρατήστε τις πραγματικές μετρήσεις στην ιδιωτική διαδικασία του υπευθύνου. Δημόσιες σημειώσεις: μόνο το σχέδιο,
η απόφαση και οι περιορισμοί χωρίς πραγματικά δεδομένα. Τα παραδείγματα παρακάτω είναι αποκλειστικά συνθετικά.

## Schema v1 — technical contract

Plain JSON: `{ "version": 1, "experiments": [] }`. Unknown keys are errors at every object level.
`validateRegistry(doc)` returns `{ ok, errors, warnings }` (string arrays), without modifying `doc`.
Tests may inject `{ today: 'YYYY-MM-DD' }` as the second argument for deterministic checks; the document cannot override today.

| Record field | Type and meaning |
| --- | --- |
| `id` | Required unique string matching `^EG-\d{4}-\d{3}$`; immutable identity, never reused |
| `hypothesis`, `topic`, `owner`, `changeType`, `targetBehaviour`, `mechanism` | Required nonblank strings, without surrounding whitespace; owner copy in Greek; changeType is a descriptive identifier |
| `urls` | Nonempty, duplicate-free array of serialized absolute URLs at exactly `https://f1-stories.gr/`; no credentials, explicit port, query, fragment or URL normalization differences. Old `f1stories.gr` is rejected. Redirects, aliases and HTML canonical tags are NOT VERIFIED offline; owners must choose the actual canonical spelling |
| `primaryOutcome` | Exactly `{ metric, unit, source, population }`; metric is a stable lowercase snake_case identifier (`^[a-z][a-z0-9_]*$`), never a display label; unit and population are nonblank strings; source is `gsc`, `ga4`, `rum` or `repo` |
| `guardrails` | Nonempty array of `{ metric, threshold, source }`; metric and threshold are nonblank strings. Threshold states an actionable limit, unit and review method. Same source enum as primaryOutcome. Threshold text is reviewed by the owner, not numerically evaluated here |
| `baselinePeriod`, `comparisonPeriod` | Exactly `{ start, end }` with real ISO dates, inclusive, ordered, equal duration and non-overlapping for every status. Maturity is required only for COMPLETED, using the strictest primary/guardrail source lag; all other statuses allow future/immature periods |
| `confounders` | Required string array; may be empty only after explicit owner review; list race weekend, news, publication, Google update or schedule effects that apply |
| `evidenceFloor` | Optional positive safe integer; omission means `DEFAULT_EVIDENCE_FLOOR = 30` primary-outcome observations/events **per period**. No count is stored or tested here |
| `decisionPolicy` | Required nonblank string; predeclare keep/pause/rollback criteria and abstention when counts, coverage or guardrails cannot support a decision |
| `failureModes` | Nonempty string array |
| `rollback` | Required nonblank string of exact, ordered human steps identifying what to restore, verification and audit entry |
| `status` | One of exported `EXPERIMENT_STATUSES`; exactly the last history status |
| `history` | Nonempty array of `{ status, date, actor, note, pr?, commit? }`; nonblank actor/note; real ISO date, chronological (same-day entries use array order), never future; first PROPOSED, subsequent transitions from exported `ALLOWED_TRANSITIONS` |
| `pr`, `commit` | Both keys required on the record; nullable. PR: `https://github.com/georgiosbalatzis/f1StoriesPage/pull/<positive integer>`. Commit: same repository `/commit/<40 lowercase hex>`. At least one valid link once any approval exists, or current status is RUNNING/ROLLED_BACK. Each APPROVED/RUNNING/ROLLED_BACK history entry independently requires one link; optional links elsewhere must also have valid format |

Comparisons of URLs and metric identifiers for RUNNING conflicts are exact. All four pairings of the two records'
baseline/comparison periods are checked, including shared boundary days; disjoint gaps are not treated as observed days.
History is structurally validated, but append-only integrity across file versions requires Git diff review.
An entirely new hypothesis after a terminal status uses a new ID. A later evaluator must preserve source, unit,
population, periods and evidenceFloor, report insufficient evidence as INCONCLUSIVE, and never infer a causal lift.

### Πλήρες συνθετικό παράδειγμα

Δεν προστίθεται στο πραγματικό μητρώο. Η URL, ο υπεύθυνος, οι ημερομηνίες και το μηδενικό commit είναι πλασματικά·
ο σύνδεσμος δεν αποτελεί πραγματική έγκριση. Το πλήρες JSON του ίδιου παραδείγματος ελέγχεται στα tests.

```json
{
    "version": 1,
    "experiments": [
        {
            "id": "EG-2000-001",
            "hypothesis": "ΣΥΝΘΕΤΙΚΟ: σαφέστερο κείμενο συνδέσμου ίσως αυξήσει τα συμβάντα εσωτερικών κλικ.",
            "urls": ["https://f1-stories.gr/synthetic-example/"],
            "topic": "ΣΥΝΘΕΤΙΚΟ θέμα, όχι πραγματικό άρθρο",
            "owner": "Συνθετικός υπεύθυνος",
            "changeType": "link_copy",
            "targetBehaviour": "Επιλογή του συνδέσμου προς σχετικό άρθρο",
            "mechanism": "Η περιγραφή κάνει σαφέστερο τον προορισμό.",
            "primaryOutcome": {
                "metric": "internal_page_click",
                "unit": "συμβάντα κλικ, όχι φορτώσεις προορισμού",
                "source": "ga4",
                "population": "Συνθετικά consented συμβάντα της συγκεκριμένης URL στο Main, ίδιο φίλτρο και στις δύο περιόδους"
            },
            "guardrails": [
                { "metric": "LCP p75", "threshold": "<= 2500 ms, χωριστά ανά coverage, με επαρκείς παρατηρήσεις", "source": "rum" },
                { "metric": "Αναγνωσιμότητα και συντακτική ποιότητα", "threshold": "Καμία παραπλανητική υπόσχεση, έλεγχος από τον υπεύθυνο", "source": "repo" }
            ],
            "baselinePeriod": { "start": "2000-01-01", "end": "2000-01-07" },
            "comparisonPeriod": { "start": "2000-01-08", "end": "2000-01-14" },
            "confounders": ["Συνθετικό αγωνιστικό Σαββατοκύριακο", "Συνθετική δημοσίευση την ημέρα αλλαγής"],
            "evidenceFloor": 30,
            "decisionPolicy": "INCONCLUSIVE αν μία περίοδος έχει λιγότερα από 30 συμβάντα ή λείπει έλεγχος guardrail. Διατήρηση μόνο μετά από ανθρώπινο έλεγχο· καμία αιτιώδης δήλωση.",
            "failureModes": ["Παραπλανητικό κείμενο συνδέσμου", "Αλλαγή του προγράμματος δημοσιεύσεων"],
            "rollback": "1. Επαναφορά μόνο του κειμένου συνδέσμου από το προηγούμενο diff. 2. Έλεγχος URL, πληκτρολογίου και αναγνωσιμότητας. 3. Ξεχωριστό PR επαναφοράς από τον υπεύθυνο. 4. Προσθήκη ROLLED_BACK στο history με σύνδεσμο PR/commit.",
            "status": "RUNNING",
            "history": [
                { "status": "PROPOSED", "date": "1999-12-20", "actor": "Συνθετικός υπεύθυνος", "note": "ΣΥΝΘΕΤΙΚΗ πρόταση, χωρίς δεδομένα." },
                { "status": "APPROVED", "date": "1999-12-21", "actor": "Συνθετικός υπεύθυνος", "note": "ΣΥΝΘΕΤΙΚΗ έγκριση. Ο σύνδεσμος commit είναι πλασματικός.", "commit": "https://github.com/georgiosbalatzis/f1StoriesPage/commit/0000000000000000000000000000000000000000" },
                { "status": "RUNNING", "date": "2000-01-08", "actor": "Συνθετικός υπεύθυνος", "note": "ΣΥΝΘΕΤΙΚΗ έναρξη. Ο σύνδεσμος commit είναι πλασματικός.", "commit": "https://github.com/georgiosbalatzis/f1StoriesPage/commit/0000000000000000000000000000000000000000" }
            ],
            "pr": null,
            "commit": "https://github.com/georgiosbalatzis/f1StoriesPage/commit/0000000000000000000000000000000000000000"
        }
    ]
}
```
