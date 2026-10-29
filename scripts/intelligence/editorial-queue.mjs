#!/usr/bin/env node
// Owner-local only: no network, dashboard transport or automatic editorial action.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const GROUPS = [
    ['content_opportunity', 'Ευκαιρία περιεχομένου'],
    ['article_improvement', 'Βελτίωση υπάρχοντος άρθρου'],
    ['internal_discovery', 'Εσωτερική ανακάλυψη'],
    ['technical_seo', 'Τεχνικό SEO'],
    ['data_quality', 'Ποιότητα δεδομένων / Ανεπαρκή στοιχεία']
];
const DECISIONS = { pending: 'Σε αναμονή', accepted: 'Αποδεκτό για ανθρώπινο έλεγχο',
    rejected: 'Απορρίφθηκε', deferred: 'Αναβλήθηκε' };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const day = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const emptyState = () => ({ version: 1, signals: {} });

function validateDecision(entry) {
    if (!object(entry) || !Object.hasOwn(DECISIONS, entry.decision) || !day(entry.date)
        || typeof entry.note !== 'string' || entry.note.length > 500
        || /[\u0000-\u001f\u007f]/.test(entry.note)
        || (entry.until !== undefined && (entry.decision !== 'deferred' || !day(entry.until) || entry.until < entry.date))) {
        throw new Error('invalid review decision');
    }
}

function validateState(state) {
    if (!object(state) || state.version !== 1 || !object(state.signals)
        || Object.keys(state).some(key => !['version', 'signals'].includes(key))) throw new Error('invalid review state');
    for (const [id, entry] of Object.entries(state.signals)) {
        if (!text(id) || /[\u0000-\u001f\u007f]/.test(id) || !object(entry)
            || Object.keys(entry).some(key => !['decision', 'date', 'note', 'until', 'history'].includes(key))
            || !Array.isArray(entry.history) || !entry.history.length) throw new Error('invalid review history');
        validateDecision(entry);
        for (const [index, previous] of entry.history.entries()) {
            validateDecision(previous);
            if (Object.keys(previous).some(key => !['decision', 'date', 'note', 'until'].includes(key))
                || (index > 0 && previous.date < entry.history[index - 1].date)) throw new Error('invalid review history');
        }
        const latest = entry.history.at(-1);
        if (['decision', 'date', 'note', 'until'].some(key => entry[key] !== latest[key])) throw new Error('inconsistent latest decision');
    }
}

export function applyDecision(reviewState, signalId, decision, { date, note = '', until } = {}) {
    validateState(reviewState);
    if (!text(signalId) || /[\u0000-\u001f\u007f]/.test(signalId)) throw new Error('invalid signal ID');
    const entry = { decision, date, note, ...(until === undefined ? {} : { until }) };
    validateDecision(entry);
    const previous = Object.hasOwn(reviewState.signals, signalId) ? reviewState.signals[signalId] : undefined;
    if (previous && date < previous.date) throw new Error('decision predates history');
    const state = structuredClone(reviewState);
    Object.defineProperty(state.signals, signalId, { enumerable: true, configurable: true, writable: true,
        value: { ...entry, history: [...(state.signals[signalId]?.history ?? []), { ...entry }] } });
    return state;
}

export function buildQueue(insightsResult, reviewState = emptyState()) {
    validateState(reviewState);
    if (!object(insightsResult) || insightsResult.version !== 1 || !Array.isArray(insightsResult.signals)
        || !Array.isArray(insightsResult.abstentions) || !(insightsResult.asOf === null || day(insightsResult.asOf))
        || (insightsResult.synthetic !== undefined && typeof insightsResult.synthetic !== 'boolean')
        || (insightsResult.review_date !== undefined && !day(insightsResult.review_date))) throw new Error('invalid insights result');
    const reviewDate = insightsResult.review_date ?? insightsResult.asOf;
    const groups = GROUPS.map(([group, label]) => ({ group, label, items: [] }));
    const ids = new Set();
    for (const signal of insightsResult.signals) {
        const group = groups.find(row => row.group === signal.group);
        if (!group || !text(signal.signal_id) || ids.has(signal.signal_id) || !text(signal.subject)
            || !text(signal.type) || !object(signal.exact_period) || !object(signal.data_source)
            || !object(signal.observations) || !object(signal.metric_units)
            || !text(signal.minimum_sample_status) || !text(signal.confidence) || !text(signal.why_it_matters)
            || !text(signal.recommended_human_review)
            || !['limitations', 'counterevidence', 'evidence_links'].every(key => Array.isArray(signal[key]) && signal[key].every(text))) {
            throw new Error('invalid queue signal');
        }
        ids.add(signal.signal_id);
        const stored = Object.hasOwn(reviewState.signals, signal.signal_id) ? reviewState.signals[signal.signal_id] : null;
        const expired = !!(stored?.decision === 'deferred' && stored.until && reviewDate && stored.until < reviewDate);
        group.items.push({ ...structuredClone(signal), kind: 'signal',
            review: { ...(stored ? structuredClone(stored) : { decision: 'pending', date: null, note: '', history: [] }),
                decision: expired ? 'pending' : stored?.decision ?? 'pending', expired } });
    }
    for (const abstention of insightsResult.abstentions) {
        if (!object(abstention) || !text(abstention.type) || !text(abstention.subject) || !text(abstention.reason)
            || !['PASS', 'WARNING', 'FAIL', 'NOT VERIFIED'].includes(abstention.status)) throw new Error('invalid abstention');
        groups.at(-1).items.push({ ...structuredClone(abstention), kind: 'abstention', group: 'data_quality' });
    }
    for (const group of groups) group.items.sort((a, b) => compare(a.type, b.type) || compare(a.subject, b.subject)
        || compare(a.signal_id ?? '', b.signal_id ?? '') || compare(a.reason ?? '', b.reason ?? '') || compare(a.status ?? '', b.status ?? ''));
    const stale = Object.entries(reviewState.signals).filter(([id]) => !ids.has(id))
        .sort(([a], [b]) => compare(a, b)).map(([signal_id, review]) => ({ signal_id, stale: true, review: structuredClone(review) }));
    return { version: 1, asOf: insightsResult.asOf, review_date: reviewDate, synthetic: insightsResult.synthetic ?? null, groups, stale };
}

// Escape owner text so titles/notes remain plain text, rather than executable Markdown/HTML.
const markdown = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/[\\`*_{}\[\]()#+!|~]/g, '\\$&').replace(/[\r\n]+/g, ' ');
const raw = value => value === null || value === undefined ? 'NOT VERIFIED' : String(value);

function fields(value, prefix = '') {
    if (!object(value) && !Array.isArray(value)) return [`- ${markdown(prefix)}: ${markdown(raw(value))}`];
    const entries = Object.entries(value).sort(([a], [b]) => compare(a, b));
    return entries.length ? entries.flatMap(([key, item]) => fields(item, prefix ? `${prefix}.${key}` : key))
        : [`- ${markdown(prefix || 'Στοιχεία')}: NOT VERIFIED`];
}

function decisionLines(review) {
    return [`- Απόφαση: ${DECISIONS[review.decision]} (${review.decision})`,
        `- Ημερομηνία απόφασης: ${review.date ?? 'Δεν έχει καταγραφεί'}`,
        `- Σημείωση ιδιοκτήτη: ${markdown(review.note || 'Χωρίς σημείωση')}`,
        ...(review.until ? [`- Αναβολή έως: ${review.until}`] : []),
        ...(review.expired ? ['- Η αναβολή έληξε· σε αναμονή μόνο στην προβολή. Το αρχείο κατάστασης διατηρείται ως έχει.'] : [])];
}

function evidenceLink(value) {
    try {
        const url = new URL(value);
        if (url.origin === 'https://f1-stories.gr' && !url.username && !url.password) {
            return `[${markdown(value)}](<${url.href.replace(/[<>]/g, char => encodeURIComponent(char))}>)`;
        }
    } catch { /* Repository evidence paths remain readable text in an external worklist. */ }
    if (value === 'docs/intelligence/editorial-intelligence.md') {
        return '[Συμβόλαιο και περιορισμοί](https://github.com/georgiosbalatzis/f1StoriesPage/blob/main/docs/intelligence/editorial-intelligence.md)';
    }
    return markdown(value);
}

export function renderQueue(queue) {
    const lines = ['# Συντακτική σειρά ελέγχου I-07C', '',
        'Υποστήριξη αποφάσεων, όχι οδηγίες. Τίποτα δεν δημοσιεύεται αυτόματα. Ιδιωτικό αρχείο — μην το κοινοποιήσετε.', '',
        ...(queue.synthetic === true ? ['**ΠΡΟΣΟΧΗ: συνθετικά δεδομένα — αποκλειστικά για δοκιμή.**', ''] : []),
        ...(queue.synthetic === null ? ['Προέλευση συνθετικών δεδομένων: NOT VERIFIED — το αρχείο ενδείξεων δεν περιέχει σχετική σήμανση.', ''] : []),
        `Ημερομηνία αξιολόγησης ενδείξεων: ${queue.asOf ?? 'NOT VERIFIED'}.`,
        `Ημερομηνία προβολής αναβολών (UTC): ${queue.review_date ?? 'NOT VERIFIED'}.`,
        'Παραγωγική ορθότητα: NOT VERIFIED. Η αριθμημένη σειρά είναι οργανωτική, χωρίς στατιστική κατάταξη ή πρόβλεψη επίδρασης.',
        'Τα συναινετικά συμβάντα GA4 δεν είναι αναγνώστες ή συνεδρίες. Τα GSC clicks δεν είναι GA4 page_view events.',
        'Τα εσωτερικά κλικ δεν αποδεικνύουν φόρτωση προορισμού. Εβδομαδιαία ή μεταφερόμενα στοιχεία κρατούν τις δικές τους ημερομηνίες.',
        'Οι συγκρίσεις πριν/μετά είναι παρατηρησιακές. Μικρό δείγμα — δεν προκύπτει ασφαλές συμπέρασμα.', ''];
    let number = 0;
    for (const group of queue.groups) {
        lines.push(`## ${group.label}`, '');
        if (!group.items.length) lines.push('Δεν υπάρχουν στοιχεία σε αυτή την ομάδα.', '');
        for (const item of group.items) {
            lines.push(`### ${++number}. ${markdown(item.title ?? item.subject)}`, '',
                `- Θέμα: ${markdown(item.subject)}`, `- Τύπος: ${markdown(item.type)}`);
            if (item.kind === 'abstention') {
                lines.push(`- Κατάσταση: ${item.status}`, `- Αιτία αποχής: ${markdown(item.reason)}`,
                    '- Ακριβής περίοδος (exact_period): NOT VERIFIED', '- Πηγή (data_source): NOT VERIFIED',
                    '- Ελάχιστο δείγμα (minimum_sample_status): NOT VERIFIED', '- Εμπιστοσύνη (confidence): NOT VERIFIED',
                    '- Περιορισμοί: Δεν παρέχονται αναλυτικά τεκμήρια από την αποχή I-07B.',
                    '- Αντίθετες ενδείξεις: NOT VERIFIED', '- Ακατέργαστες παρατηρήσεις / αριθμητές / παρονομαστές: NOT VERIFIED',
                    '- Ανθρώπινος έλεγχος: Ελέγξτε την αιτία αποχής και την επάρκεια των πηγών πριν από απόφαση.',
                    '- Σύνδεσμοι τεκμηρίων: NOT VERIFIED', '- Απόφαση: Δεν εφαρμόζεται· η αποχή δεν διαθέτει signal_id.', '');
                continue;
            }
            lines.push(`- Αναγνωριστικό: ${markdown(item.signal_id)}`, ...decisionLines(item.review), '',
                markdown(item.why_it_matters), '', '**Ακριβείς περίοδοι (exact_period)**', '', ...fields(item.exact_period), '',
                '**Πηγές (data_source)**', '', ...fields(item.data_source), '',
                `- Ελάχιστο δείγμα (minimum_sample_status): ${markdown(item.minimum_sample_status)}`,
                `- Εμπιστοσύνη (confidence): ${markdown(item.confidence)}`, '',
                '**Ακατέργαστες παρατηρήσεις / αριθμητές / παρονομαστές**', '', ...fields(item.observations), '',
                '**Μονάδες**', '', ...fields(item.metric_units), '', '**Περιορισμοί**', '',
                ...(item.limitations.length ? item.limitations.map(value => `- ${markdown(value)}`) : ['- NOT VERIFIED']), '',
                '**Αντίθετες ενδείξεις**', '',
                ...(item.counterevidence.length ? item.counterevidence.map(value => `- ${markdown(value)}`) : ['- Δεν παρέχονται· αυτό δεν αποδεικνύει απουσία τους.']), '',
                '**Προτεινόμενος ανθρώπινος έλεγχος**', '', markdown(item.recommended_human_review), '', '**Τεκμήρια**', '',
                ...(item.evidence_links.length ? item.evidence_links.map(value => `- ${evidenceLink(value)}`) : ['- NOT VERIFIED']), '');
        }
    }
    lines.push('## Παλαιότερα αναγνωριστικά (stale)', '',
        'Διατηρούνται στο αρχείο με όλο το ιστορικό. Η απουσία από αυτή την εξαγωγή δεν αποδεικνύει επίλυση.', '');
    if (!queue.stale.length) lines.push('Δεν υπάρχουν παλαιότερα αναγνωριστικά.', '');
    for (const item of queue.stale) lines.push(`### ${markdown(item.signal_id)}`, '', '- Κατάσταση: stale', ...decisionLines(item.review), '');
    return `${lines.join('\n')}\n`;
}

function inside(file, root) {
    const relative = path.relative(root, file);
    return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function privatePath(value) {
    const requested = path.resolve(value);
    const destination = path.join(fs.realpathSync(path.dirname(requested)), path.basename(requested));
    if ([ROOT, fs.realpathSync(ROOT)].some(root => inside(requested, root) || inside(destination, root))) {
        throw new Error('repository path refused');
    }
    for (let directory = path.dirname(destination); ; directory = path.dirname(directory)) {
        if (fs.lstatSync(path.join(directory, '.git'), { throwIfNoEntry: false })) throw new Error('Git repository path refused');
        if (path.dirname(directory) === directory) break;
    }
    if (fs.existsSync(destination) || fs.lstatSync(destination, { throwIfNoEntry: false })) {
        const stat = fs.lstatSync(destination);
        if (!stat.isFile() || stat.nlink !== 1) throw new Error('linked or non-file destination refused');
    }
    return destination;
}

export function main(argv) {
    // Refuse even synthetic CLI invocations in CI; pure functions remain testable there.
    if (process.env.CI || process.env.GITHUB_ACTIONS) throw new Error('owner-local queue refuses CI');
    const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: {
        state: { type: 'string' }, out: { type: 'string' }, until: { type: 'string' }, note: { type: 'string' }
    } });
    const today = new Date().toISOString().slice(0, 10);
    if (positionals[0] === 'render' && positionals.length === 2 && values.until === undefined && values.note === undefined) {
        const output = privatePath(values.out ?? path.join(os.homedir(), 'f1stories-editorial-queue.md'));
        const state = values.state ? JSON.parse(fs.readFileSync(privatePath(values.state), 'utf8')) : emptyState();
        const insights = JSON.parse(fs.readFileSync(positionals[1], 'utf8'));
        const report = renderQueue(buildQueue({ ...insights, review_date: today }, state));
        fs.writeFileSync(output, report, { flag: 'wx', mode: 0o600 });
        process.stdout.write('PASS: private Greek worklist written. Production correctness NOT VERIFIED.\n');
        return;
    }
    if (positionals[0] === 'decide' && positionals.length === 4 && values.state === undefined && values.out === undefined) {
        const destination = privatePath(positionals[1]);
        const state = fs.existsSync(destination) ? JSON.parse(fs.readFileSync(destination, 'utf8')) : emptyState();
        const updated = applyDecision(state, positionals[2], positionals[3], { date: today, note: values.note ?? '', until: values.until });
        // Replace atomically so an interrupted write cannot truncate the owner's history.
        const temporary = fs.mkdtempSync(path.join(path.dirname(destination), '.editorial-queue-'));
        try {
            const file = path.join(temporary, 'state.json');
            fs.writeFileSync(file, `${JSON.stringify(updated, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
            fs.renameSync(file, destination);
        } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
        process.stdout.write('PASS: private review decision recorded; nothing published.\n');
        return;
    }
    throw new Error('expected render or decide');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try { main(process.argv.slice(2)); }
    catch {
        // OS/parser exceptions can contain private paths, analytics or owner notes.
        process.stderr.write('FAIL: local queue refused; check command, input, decision and private paths outside the repository. CI is refused.\n');
        process.exitCode = 1;
    }
}
