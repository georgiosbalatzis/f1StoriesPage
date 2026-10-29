#!/usr/bin/env node
// I-08B: offline aggregates only; no publication, registry writes or analytics access.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_EVIDENCE_FLOOR, MATURITY_LAG_DAYS, validateRegistry } from './experiment-registry.mjs';

const DAY = 86400000;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const day = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const days = value => Date.parse(value) / DAY;
const period = value => object(value) && Object.keys(value).length === 2 && day(value.start) && day(value.end) && value.start <= value.end;
const samePeriod = (a, b) => a.start === b.start && a.end === b.end;
const count = value => Number.isSafeInteger(value) && value >= 0;
const escape = value => String(value ?? 'NOT VERIFIED').replace(/[\r\n|]/g, ' ').replace(/[\\`*_<>\[\]]/g, '\\$&');

function resultReport(experiment, result) {
    const e = escape;
    return `# Απολογισμός συντακτικού πειράματος

Η σύγκριση πριν/μετά είναι **παρατηρησιακή**. Η αναφορά δεν περιλαμβάνει πραγματικά πλήθη· το JSON προορίζεται για ιδιωτική τοπική χρήση.

- **ID και υπεύθυνος:** ${e(experiment?.id)} / ${e(experiment?.owner)}
- **Ημερομηνία ανασκόπησης και actor:** ${e(result.asOf)} / NOT VERIFIED — απαιτείται υπεύθυνος ανασκόπησης.
- **PR/commit της αλλαγής:** ${e(experiment?.pr || experiment?.commit)}
- **Αρχική υπόθεση και τι άλλαξε:** ${e(experiment?.hypothesis)} / ${e(experiment?.changeType)}
- **Τρέχον status / προτεινόμενο επόμενο status:** ${e(experiment?.status)} / NOT VERIFIED — ανθρώπινη απόφαση.

## Συγκρισιμότητα και επάρκεια

- **baselinePeriod:** ${e(experiment?.baselinePeriod?.start)} / ${e(experiment?.baselinePeriod?.end)}
- **comparisonPeriod:** ${e(experiment?.comparisonPeriod?.start)} / ${e(experiment?.comparisonPeriod?.end)}
- **Ημέρα αναφοράς και χρονική ζώνη πηγών:** ${e(result.asOf)} / όπως δηλώνεται στο population, NOT VERIFIED εξωτερικά.
- **Ίσο μήκος και χωρίς επικάλυψη:** ${result.checks.periods}
- **Ώριμο τέλος:** ${result.checks.maturity} — ελέγχεται και η ημέρα εξαγωγής κάθε παρατήρησης.
- **primaryOutcome metric / unit / source / population:** ${e(experiment?.primaryOutcome?.metric)} / ${e(experiment?.primaryOutcome?.unit)} / ${e(experiment?.primaryOutcome?.source)} / ${e(experiment?.primaryOutcome?.population)}
- **Ίδια φίλτρα και κάλυψη στις δύο περιόδους:** ${result.checks.identity} — έλεγχος δηλώσεων, όχι εξωτερική επιβεβαίωση.
- **evidenceFloor ανά περίοδο:** ${e(result.evidenceFloor)}
- **Επάρκεια σε καθεμία περίοδο:** ${result.checks.evidence} — τα πλήθη διατηρούνται μόνο στο ιδιωτικό JSON.
- **Εβδομαδιαία ή μεταφερόμενα δεδομένα:** ${result.checks.freshness} — διατηρούνται οι πραγματικές περίοδοι και asOf στο JSON.
- **Παραγωγική συμφωνία δεδομένων:** NOT VERIFIED.

Το PASS αφορά τον συγκεκριμένο έλεγχο, όχι επιτυχία πειράματος. WARNING: περιορισμός. FAIL: παράβαση. NOT VERIFIED: έλλειψη τεκμηρίωσης.

## Προστασία ποιότητας και εναλλακτικές εξηγήσεις

| Guardrail / δηλωμένο threshold / source | Έλεγχος | Ερμηνεία χωρίς πραγματικά δεδομένα |
| --- | --- | --- |
${result.guardrails.map(g => `| ${e(g.metric)} / ${e(g.threshold)} / ${e(g.source)} | ${g.status} | ${e(g.note)} |`).join('\n') || '| NOT VERIFIED | NOT VERIFIED | Δεν ολοκληρώθηκε έλεγχος. |'}

- **confounders που παρατηρήθηκαν:** ${result.confounders.map(c => `${e(c.description)} (${c.overlaps === false ? 'εκτός περιόδων' : 'επικάλυψη ή άγνωστος χρόνος'})`).join('; ') || 'Δεν δηλώθηκαν· η πληρότητα παραμένει NOT VERIFIED.'}
- **failureModes που εμφανίστηκαν και ενέργειες:** NOT VERIFIED — απαιτείται ανθρώπινος έλεγχος.
- **Άλλες παρεμβάσεις στις ίδιες URL/μετρική:** NOT VERIFIED εκτός των δηλωμένων confounders.
- **Αποκλίσεις από το αρχικό σχέδιο / λόγοι:**
${result.reasons.map(r => `  - ${r.code}: ${e(r.message)}${r.metric ? ` (${e(r.metric)})` : ''}`).join('\n')}

## Ανθρώπινη απόφαση

- **Εφαρμογή της αρχικής decisionPolicy:** ${e(experiment?.decisionPolicy)} — το ελεύθερο κείμενο απαιτεί ανθρώπινη ανασκόπηση.
- **Απόφαση evaluator:** ${result.decision} — σύσταση, χωρίς αυτόματη ενέργεια.
- **Νέο status:** NOT VERIFIED — επιλέγεται από τον υπεύθυνο σύμφωνα με το history.
- **Περιγραφική διαφορά και διάστημα:** διαφορά στο ιδιωτικό JSON· διάστημα NOT VERIFIED, χωρίς δηλωμένο μοντέλο δειγματοληψίας.
- **Περιορισμοί:** ${result.limitations.map(e).join(' ')}
- **Επαναφορά, αν έγινε:** NOT VERIFIED. Δηλωμένο σχέδιο: ${e(experiment?.rollback)}
- **Νέα εγγραφή history:** NOT VERIFIED — ο υπεύθυνος προσθέτει status/date/actor/note και απαιτούμενο PR/commit· δεν μεταβάλλεται το μητρώο.

Τα GA4 συμβάντα με συναίνεση δεν είναι μοναδικοί αναγνώστες ή συνεδρίες. Τα GSC clicks δεν είναι GA4 page_views. Τα εσωτερικά κλικ δεν αποδεικνύουν φόρτωση προορισμού.
`;
}

export function evaluateExperiment(experiment, observations, { asOf } = {}) {
    const result = {
        experimentId: text(experiment?.id) ? experiment.id : null, asOf: day(asOf) ? asOf : null,
        decision: 'INCONCLUSIVE', evidenceFloor: experiment?.evidenceFloor ?? DEFAULT_EVIDENCE_FLOOR,
        reasons: [], checks: { periods: 'NOT VERIFIED', maturity: 'NOT VERIFIED', identity: 'NOT VERIFIED', evidence: 'NOT VERIFIED', freshness: 'NOT VERIFIED', production: 'NOT VERIFIED' },
        observations: [], primary: null, guardrails: [], secondary: [], confounders: [],
        limitations: [
            'Η σύγκριση πριν/μετά είναι παρατηρησιακή, με περιορισμένη κάλυψη και χαμηλό δείγμα.',
            'Παραγωγική συμφωνία, πληρότητα εξαγωγής και πραγματική κάλυψη: NOT VERIFIED.',
            'Δεν υπολογίζεται διάστημα: το schema v1 δεν δηλώνει ανεξάρτητες δοκιμές ή μοντέλο καταμέτρησης. Τα επαναλαμβανόμενα συμβάντα δεν τεκμηριώνουν τέτοιο μοντέλο.',
            'Το decisionPolicy και οι ποιοτικοί έλεγχοι απαιτούν ανθρώπινη ανασκόπηση. Καμία κατάσταση μητρώου δεν αλλάζει.'
        ]
    };
    let failed = false, inconclusive = false, rollback = false;
    const reason = (code, message, metric, failure = false) => {
        result.reasons.push({ code, message, ...(metric ? { metric } : {}) });
        if (failure) failed = true;
        else inconclusive = true;
    };
    const finish = () => {
        result.decision = failed ? 'STOP_MEASUREMENT_FAILED' : rollback ? 'ROLLBACK_RECOMMENDED' : inconclusive ? 'INCONCLUSIVE' : result.decision;
        result.markdown = resultReport(experiment, result);
        return result;
    };
    if (!day(asOf)) {
        reason('INVALID_AS_OF', 'Απαιτείται έγκυρη, ρητή ημέρα αναφοράς YYYY-MM-DD.', null, true);
        return finish();
    }
    const validation = validateRegistry({ version: 1, experiments: [experiment] }, { today: asOf });
    for (const error of validation.errors) {
        const windowError = /periods must have equal|baseline must end before|comparisonPeriod: not mature/.test(error);
        reason(windowError ? 'INVALID_WINDOW' : 'INVALID_REGISTRY', `Έλεγχος μητρώου: ${error}`, null, !windowError);
    }
    if (failed) return finish();
    result.checks.periods = validation.errors.some(e => /equal|non-overlapping/.test(e)) ? 'FAIL' : 'PASS';
    const envelope = Array.isArray(observations) ? { observations, confounders: [] } : observations;
    if (!object(envelope) || !Array.isArray(envelope.observations)
        || Object.keys(envelope).some(key => !['observations', 'confounders', 'asOf'].includes(key))
        || (envelope.confounders !== undefined && !Array.isArray(envelope.confounders))) {
        reason('INVALID_OBSERVATIONS', 'Απαιτείται λίστα συγκεντρωτικών παρατηρήσεων και, προαιρετικά, λίστα confounders.', null, true);
        return finish();
    }
    for (const item of [...experiment.confounders.map(description => ({ description, origin: 'registry' })),
        ...(envelope.confounders || []).map(value => typeof value === 'string' ? { description: value, origin: 'observations' } : { ...value, origin: 'observations' })]) {
        if (Object.keys(item).some(key => !['description', 'period', 'major', 'origin'].includes(key))
            || !text(item.description) || (item.period !== undefined && !period(item.period))
            || (item.major !== undefined && typeof item.major !== 'boolean')) {
            reason('INVALID_CONFOUNDER', 'Μη έγκυρη περιγραφή, περίοδος ή βαρύτητα confounder.', null, true);
            continue;
        }
        const overlaps = item.period ? [experiment.baselinePeriod, experiment.comparisonPeriod].some(p => item.period.start <= p.end && p.start <= item.period.end) : null;
        result.confounders.push({ description: item.description, origin: item.origin, period: item.period ? { ...item.period } : null, major: item.major ?? null, overlaps });
        if (overlaps !== false && item.major !== false) reason('CONFOUNDED_WINDOW', 'Δηλωμένος σημαντικός παράγοντας ή άγνωστη βαρύτητα/χρονοθέτηση μέσα στις περιόδους· αποχή από συμπέρασμα.');
    }
    if (!envelope.observations.length && asOf < experiment.baselinePeriod.start && ['PROPOSED', 'APPROVED'].includes(experiment.status)) {
        result.decision = 'CONTINUE_OBSERVING';
        result.reasons.push({ code: 'NOT_STARTED', message: 'Το προγραμματισμένο παράθυρο δεν έχει αρχίσει και δεν υποβλήθηκαν μετρήσεις.' });
        return finish();
    }
    result.checks.maturity = envelope.observations.length ? 'PASS' : 'NOT VERIFIED';
    result.checks.identity = envelope.observations.length ? 'PASS' : 'NOT VERIFIED';
    result.checks.freshness = envelope.observations.length ? 'PASS' : 'NOT VERIFIED';
    for (const source of new Set([experiment.primaryOutcome.source, ...experiment.guardrails.map(g => g.source)])) {
        if ([experiment.baselinePeriod, experiment.comparisonPeriod].some(p => days(p.end) > days(asOf) - MATURITY_LAG_DAYS[source])) {
            result.checks.maturity = 'WARNING';
            reason('IMMATURE_WINDOW', 'Οι δηλωμένες περίοδοι δεν είναι ακόμη ώριμες για όλες τις πηγές.');
        }
    }
    const metrics = [experiment.primaryOutcome.metric, ...experiment.guardrails.map(g => g.metric)];
    const allowed = ['metric', 'unit', 'source', 'population', 'period', 'numerator', 'denominator', 'asOf', 'carried', 'cadence', 'url', 'urls', 'role'];
    for (const row of envelope.observations) {
        if (!object(row) || Object.keys(row).some(key => !allowed.includes(key)) || !['metric', 'unit', 'source', 'population'].every(key => text(row[key]))
            || !Object.hasOwn(MATURITY_LAG_DAYS, row.source) || !period(row.period) || !day(row.asOf)
            || !Number.isFinite(row.numerator) || row.numerator < 0
            || (row.denominator !== undefined && (!count(row.denominator) || row.denominator === 0))
            || (row.carried !== undefined && typeof row.carried !== 'boolean')
            || (row.cadence !== undefined && !['daily', 'weekly'].includes(row.cadence))
            || (row.role !== undefined && row.role !== 'secondary')
            || (row.url !== undefined && !text(row.url))
            || (row.urls !== undefined && (!Array.isArray(row.urls) || !row.urls.every(text)))) {
            reason('INVALID_OBSERVATION', 'Μη έγκυρη συγκεντρωτική παρατήρηση· δεν χρησιμοποιείται.', null, true);
            result.checks.identity = 'FAIL';
            continue;
        }
        const urls = row.urls ?? (row.url === undefined ? null : [row.url]);
        const raw = { metric: row.metric, unit: row.unit, source: row.source, population: row.population,
            period: { ...row.period }, numerator: row.numerator, ...(row.denominator === undefined ? {} : { denominator: row.denominator }),
            asOf: row.asOf, carried: row.carried ?? false, cadence: row.cadence ?? 'daily', urls: urls === null ? null : structuredClone(urls),
            ...(row.role ? { role: row.role } : {}) };
        result.observations.push(raw);
        if ((!metrics.includes(row.metric) && row.role !== 'secondary') || (metrics.includes(row.metric) && row.role === 'secondary')) {
            reason('METRIC_MISMATCH', 'Το metric διαφέρει από το μητρώο και δεν δηλώθηκε χωριστή δευτερεύουσα παρατήρηση.', row.metric, true);
            result.checks.identity = 'FAIL';
        }
        if (urls === null) {
            result.checks.identity = result.checks.identity === 'FAIL' ? 'FAIL' : 'NOT VERIFIED';
            reason('URL_NOT_VERIFIED', 'Δεν δηλώθηκε ακριβής κάλυψη URL για την παρατήρηση.', row.metric);
        } else if (!Array.isArray(urls) || urls.length !== experiment.urls.length || new Set(urls).size !== urls.length
            || !urls.every(url => experiment.urls.includes(url)) || (row.url !== undefined && (urls.length !== 1 || urls[0] !== row.url))) {
            result.checks.identity = 'FAIL';
            reason('URL_MISMATCH', 'Η κάλυψη URL διαφέρει από το πείραμα.', row.metric, true);
        }
        if (row.asOf > asOf) reason('FUTURE_EXTRACTION', 'Η ημέρα εξαγωγής ακολουθεί την ημέρα αναφοράς.', row.metric, true);
        if (days(row.period.end) > Math.min(days(asOf), days(row.asOf)) - MATURITY_LAG_DAYS[row.source]) {
            result.checks.maturity = 'WARNING';
            reason('IMMATURE_WINDOW', 'Το παράθυρο δεν ήταν ώριμο κατά την εξαγωγή και την αξιολόγηση.', row.metric);
        }
        if (raw.carried || raw.cadence === 'weekly') {
            result.checks.freshness = 'WARNING';
            reason('CARRIED_OR_WEEKLY', 'Μεταφερόμενη ή εβδομαδιαία παρατήρηση δεν τεκμηριώνει την ημερήσια μέτρηση.', row.metric);
        }
        if (![experiment.baselinePeriod, experiment.comparisonPeriod].some(p => samePeriod(p, row.period))) {
            reason('PERIOD_MISMATCH', 'Η πραγματική περίοδος δεν ισούται με καμία δηλωμένη περίοδο· διατηρείται χωρίς αναγωγή.', row.metric);
        }
    }
    if (new Set(metrics).size !== metrics.length) reason('AMBIGUOUS_METRIC', 'Επαναλαμβανόμενο metric μεταξύ κύριου αποτελέσματος/guardrails.', null, true);

    function compare(spec, guardrail = false) {
        const rows = result.observations.filter(row => row.metric === spec.metric);
        const pair = {};
        let comparable = true;
        for (const [name, window] of [['baseline', experiment.baselinePeriod], ['comparison', experiment.comparisonPeriod]]) {
            const matches = rows.filter(row => samePeriod(row.period, window));
            pair[name] = matches.length === 1 ? matches[0] : null;
            if (matches.length > 1) reason('DUPLICATE_PERIOD', 'Περισσότερα από ένα aggregates για το ίδιο metric και περίοδο.', spec.metric, true);
            else if (!matches.length) {
                reason('MISSING_PERIOD', 'Λείπει παρατήρηση baseline ή comparison· η απουσία δεν είναι μηδέν.', spec.metric);
                if (result.checks.identity !== 'FAIL') result.checks.identity = 'NOT VERIFIED';
            }
        }
        for (const row of rows) {
            if ((spec.source !== undefined && row.source !== spec.source) || (spec.unit !== undefined && row.unit !== spec.unit)
                || (spec.population !== undefined && row.population !== spec.population)) {
                result.checks.identity = 'FAIL';
                reason('REGISTRY_IDENTITY_MISMATCH', 'Metric/source/unit/population δεν συμφωνεί με το μητρώο.', spec.metric, true);
                comparable = false;
            }
            if (!guardrail && (!count(row.numerator) || (row.denominator !== undefined && row.numerator > row.denominator))) {
                reason('INVALID_COUNTS', 'Το numerator πρέπει να είναι πλήθος και, με denominator, υποσύνολό του.', spec.metric, true);
                comparable = false;
            }
        }
        const { baseline, comparison } = pair;
        if (baseline && comparison) {
            if (['source', 'unit', 'population'].some(key => baseline[key] !== comparison[key])
                || ((baseline.denominator === undefined) !== (comparison.denominator === undefined))) {
                result.checks.identity = 'FAIL';
                reason('PERIOD_IDENTITY_MISMATCH', 'Διαφέρουν source/unit/population ή η βάση denominator μεταξύ περιόδων.', spec.metric, true);
                comparable = false;
            }
        } else comparable = false;
        let difference = null;
        if (comparable && result.checks.periods === 'PASS') {
            const countsOnly = !guardrail && baseline.numerator === 0;
            const ratio = !guardrail && baseline.denominator !== undefined && !countsOnly;
            difference = { kind: ratio ? 'proportion' : guardrail ? 'scalar' : 'count',
                absolute: ratio ? comparison.numerator / comparison.denominator - baseline.numerator / baseline.denominator : comparison.numerator - baseline.numerator };
            if (countsOnly) result.reasons.push({ code: 'ZERO_BASELINE', message: 'Μηδενικό baseline: μόνο περιγραφικά πλήθη, χωρίς λόγο ή ποσοστό.', metric: spec.metric });
        }
        return { metric: spec.metric, ...pair, difference, interval: null };
    }
    result.primary = compare(experiment.primaryOutcome);
    const primaryCounts = [result.primary.baseline, result.primary.comparison].map(row => row ? row.denominator ?? row.numerator : null);
    result.checks.evidence = primaryCounts.every(n => n !== null && n >= result.evidenceFloor) ? 'PASS' : 'WARNING';
    if (result.checks.evidence !== 'PASS') reason('BELOW_EVIDENCE_FLOOR', 'Κάθε περίοδος χρειάζεται χωριστά το δηλωμένο ελάχιστο πλήθος· δεν αθροίζονται οι περίοδοι.', experiment.primaryOutcome.metric);

    for (const spec of experiment.guardrails) {
        const comparison = compare(spec, true);
        const guard = { ...comparison, source: spec.source, threshold: spec.threshold, status: 'NOT VERIFIED', note: 'Απαιτείται ανθρώπινος έλεγχος threshold, μονάδας και κάλυψης.' };
        // Only an entire numeric threshold is executable; prose must never silently become a rule.
        const match = /^(<=|>=|<|>)\s*(\d+(?:\.\d+)?)\s+([^\s,;]+)$/.exec(spec.threshold);
        if (match && comparison.comparison) {
            const limit = Number(match[2]), unit = match[3];
            if ([comparison.baseline, comparison.comparison].filter(Boolean).some(row => row.unit !== unit)) {
                reason('GUARDRAIL_UNIT_MISMATCH', 'Η μονάδα του threshold διαφέρει από τις παρατηρήσεις.', spec.metric, true);
                result.checks.identity = 'FAIL';
            } else if (Number.isFinite(limit)) {
                const value = comparison.comparison.numerator;
                const within = { '<=': value <= limit, '>=': value >= limit, '<': value < limit, '>': value > limit }[match[1]];
                const current = comparison.comparison;
                const usable = current.source === spec.source && current.urls !== null && !current.carried && current.cadence === 'daily'
                    && days(current.period.end) <= Math.min(days(asOf), days(current.asOf)) - MATURITY_LAG_DAYS[current.source];
                if (usable && !within) {
                    guard.status = 'FAIL';
                    guard.note = 'Το comparison υπερβαίνει το δηλωμένο όριο· σύσταση ανθρώπινης επαναφοράς.';
                    rollback = true;
                    result.reasons.push({ code: 'GUARDRAIL_BREACH', message: guard.note, metric: spec.metric });
                } else if (usable && comparison.difference && [comparison.baseline, current].every(row => row.denominator >= result.evidenceFloor)) {
                    guard.status = 'PASS';
                    guard.note = 'Το comparison βρίσκεται εντός του αριθμητικού ορίου για τη δηλωμένη κάλυψη.';
                }
            }
        }
        if (guard.status === 'NOT VERIFIED') reason('GUARDRAIL_NOT_VERIFIED', 'Δεν τεκμηριώνεται ο πλήρης έλεγχος guardrail· ποιοτικά/σύνθετα thresholds δεν εκτελούνται.', spec.metric);
        result.guardrails.push(guard);
    }
    for (const metric of [...new Set(result.observations.map(row => row.metric))].filter(metric => !metrics.includes(metric)).sort()) {
        const secondary = compare({ metric });
        result.secondary.push(secondary);
        reason('UNREGISTERED_SECONDARY', 'Η πρόσθετη μέτρηση δεν έχει προδηλωμένο ρόλο/κατεύθυνση στο schema v1.', metric);
        if (secondary.difference && result.primary.difference
            && Math.sign(secondary.difference.absolute) * Math.sign(result.primary.difference.absolute) < 0) {
            result.reasons.push({ code: 'CONTRADICTORY_DIRECTIONS', message: `Αντίθετες περιγραφικές κατευθύνσεις: ${result.primary.metric} και ${metric}. Δεν τεκμηριώνεται επιτυχία.`, metric });
        }
    }
    if (!inconclusive && !failed && !rollback && result.primary.difference) {
        result.decision = result.primary.difference.absolute === 0 ? 'NO_DETECTABLE_CHANGE' : 'DESCRIPTIVE_CHANGE_OBSERVED';
        result.reasons.push({ code: result.primary.difference.absolute === 0 ? 'EQUAL_AGGREGATES' : 'DESCRIPTIVE_DIFFERENCE',
            message: result.primary.difference.absolute === 0 ? 'Ίδιες περιγραφικές τιμές στα υποβληθέντα aggregates· δεν τεκμηριώνεται ισοδυναμία.' : 'Καταγράφεται περιγραφική διαφορά στα υποβληθέντα aggregates, χωρίς ισχυρισμό επιτυχίας.', metric: result.primary.metric });
    }
    return finish();
}

function outsideRepository(filename) {
    const parent = fs.realpathSync(path.dirname(path.resolve(filename)));
    for (let dir = parent; ; dir = path.dirname(dir)) {
        if (fs.existsSync(path.join(dir, '.git'))) throw new Error('repository output');
        if (dir === path.dirname(dir)) break;
    }
    return path.join(parent, path.basename(filename));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const [registryFile, id, observationsFile, output, ...extra] = process.argv.slice(2);
        if (!registryFile || !id || !observationsFile || extra.length || (output !== undefined && (!output.startsWith('--out=') || output.length === 6))) throw new Error('usage');
        const registry = JSON.parse(fs.readFileSync(registryFile, 'utf8'));
        const observations = JSON.parse(fs.readFileSync(observationsFile, 'utf8'));
        const rows = Array.isArray(observations) ? observations : observations?.observations;
        const asOf = observations?.asOf ?? (Array.isArray(rows) ? rows.map(row => row?.asOf).filter(day).sort().at(-1) : undefined);
        if (!day(asOf)) throw new Error('asOf');
        const validation = validateRegistry(registry, { today: asOf });
        if (validation.errors.some(error => !/periods must have equal|baseline must end before|comparisonPeriod: not mature/.test(error))
            || registry.experiments.filter(exp => exp.id === id).length !== 1) throw new Error('registry');
        const result = evaluateExperiment(registry.experiments.find(exp => exp.id === id), observations, { asOf });
        const { markdown, ...json } = result;
        const serialized = `${JSON.stringify(json, null, 2)}\n`;
        if (output) {
            const filename = outsideRepository(output.slice(6));
            const markdownFile = outsideRepository(filename.endsWith('.json') ? `${filename.slice(0, -5)}.md` : `${filename}.md`);
            fs.writeFileSync(filename, serialized, { flag: 'wx', mode: 0o600 });
            try { fs.writeFileSync(markdownFile, markdown, { flag: 'wx', mode: 0o600 }); }
            catch (error) { fs.unlinkSync(filename); throw error; }
        } else {
            process.stdout.write(serialized);
            process.stderr.write(markdown);
        }
        process.exitCode = result.decision === 'STOP_MEASUREMENT_FAILED' ? 1 : 0;
    } catch {
        // Never echo parser input, paths or provider errors into a public log.
        console.error('FAIL: invalid evaluation input or output. Usage: node scripts/intelligence/experiment-evaluate.mjs <registry.json> <experiment-id> <observations.json> [--out=<path outside repo>]');
        process.exitCode = 1;
    }
}
