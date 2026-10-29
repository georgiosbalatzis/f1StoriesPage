#!/usr/bin/env node
// Offline only: contract aggregates in, private review suggestions out.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { canonicalArticleUrl, joinable, validateEditorialInputs } from './editorial-inputs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TESTS = path.join(ROOT, 'scripts/intelligence/__tests__');
const SEARCH_TYPES = ['search_ctr_gap', 'metadata_review', 'evergreen_refresh'];
const MIN_IMPRESSIONS = 100, MIN_EVENTS = 30, OLD_DAYS = 90;
const DAY = 86400000;
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const day = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const shift = (value, days) => new Date(Date.parse(value) + days * DAY).toISOString().slice(0, 10);
const daysIn = period => (Date.parse(period.end) - Date.parse(period.start)) / DAY + 1;
const samePeriod = (a, b) => a.period.start === b.period.start && a.period.end === b.period.end && a.timezone === b.timezone;
const url = value => canonicalArticleUrl(value).url;
const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0);
const TOPICS = new Map([
    ['standings', 'βαθμολογίες'], ['βαθμολογίες', 'βαθμολογίες'],
    ['telemetry', 'τηλεμετρία'], ['τηλεμετρία', 'τηλεμετρία'],
    ['tyres', 'ελαστικά'], ['ελαστικά', 'ελαστικά'], ['ghost-car', 'ghost-car'], ['ghostcar', 'ghost-car']
]);
const SEARCH_LIMITS = [
    'Ανωνυμοποιημένα ερωτήματα και όρια εξαγωγής μπορεί να αποκρύπτουν στοιχεία· δεν υπολογίζεται σύνολο ιδιοκτησίας.',
    'Η μέση θέση, η πρόθεση αναζήτησης και το μείγμα συσκευών επηρεάζουν το CTR.',
    'Το CTR αναφοράς ανά ζώνη θέσης είναι μη βαθμονομημένο φίλτρο συντακτικού ελέγχου, όχι πρόβλεψη ή στατιστικό εύρημα.'
];
const EVENT_LIMITS = [
    'Τα συναινετικά συμβάντα GA4 δεν είναι μοναδικοί αναγνώστες ή συνεδρίες και δεν καλύπτουν όλο το κοινό.',
    'Τα εσωτερικά κλικ δεν αποδεικνύουν φόρτωση προορισμού· απουσία καταγραφής δεν αποδεικνύει απουσία δραστηριότητας.'
];

export function evaluateEditorialInsights(inputs, { asOf } = {}) {
    const validation = validateEditorialInputs(inputs);
    const result = { version: 1, asOf: day(asOf) ? asOf : null,
        synthetic: validation.ok && day(asOf) && inputs.synthetic === true, signals: [], abstentions: [] };
    const abstain = (type, subject, reason, status = 'NOT VERIFIED') => result.abstentions.push({ type, subject, status, reason });
    if (!validation.ok || !day(asOf)) {
        abstain('data_quality', 'input', 'FAIL: μη έγκυρο συμβόλαιο εισόδου ή ημερομηνία αξιολόγησης· δεν εξάγονται συμπεράσματα.', 'FAIL');
        return result;
    }
    const usable = (section, lag = 0) => section?.status === 'present' && section.freshness.dataState === 'final'
        && section.asOf <= asOf && section.period.end <= shift(section.asOf, -lag);
    const sources = entries => Object.fromEntries(entries.map(([name, section]) => [name, {
        source: section.source, population: section.population, unit: section.unit,
        asOf: section.asOf, freshness: { ...section.freshness },
        ...(name === 'gsc' ? { property: section.property, aggregation: section.aggregation, searchType: section.searchType } : {})
    }]));
    const periods = entries => Object.fromEntries(entries.map(([name, section]) => [name, { ...section.period, timezone: section.timezone }]));
    function signal(type, group, subject, entries, observations, metricUnits, why, review, limitations, counterevidence = [], extraScope = {}, exactPeriod = periods(entries)) {
        result.signals.push({
            signal_id: createHash('sha256').update(JSON.stringify([type, subject, exactPeriod])).digest('hex').slice(0, 24),
            type, group, subject, scope: { host: 'f1-stories.gr', grain: 'article', ...extraScope },
            observations, data_source: sources(entries), exact_period: exactPeriod, metric_units: metricUnits,
            minimum_sample_status: 'MET', confidence: 'low',
            limitations: [...limitations, 'Παρατηρησιακή ένδειξη για ανθρώπινο έλεγχο· η παραγωγική ορθότητα παραμένει NOT VERIFIED.'],
            why_it_matters: why, recommended_human_review: review, counterevidence,
            evidence_links: [subject, 'docs/intelligence/editorial-intelligence.md']
        });
    }
    if (inputs.comparisons?.some(row => row.left !== row.right && row.operation !== 'side-by-side')) {
        abstain('data_quality', 'comparisons', 'WARNING: απορρίφθηκε σύγκριση GSC clicks με GA4 page_view events· διαφορετικοί πληθυσμοί και μονάδες.', 'WARNING');
    }
    const { gsc, site, catalogue, linkGraph } = inputs;
    const articles = new Map((usable(catalogue) ? catalogue.rows : []).map(row => [row.url, row]));
    const search = new Map();
    const searchUsable = usable(gsc, 3) && gsc.rows.length > 0;
    const searchGrain = searchUsable && gsc.aggregation === 'page' && gsc.rows.every(row => row.query == null && row.country === null && row.device === null);
    if (searchGrain) for (const row of gsc.rows) {
        if (row.mapping !== 'mapped') continue;
        const key = url(row.page);
        if (!search.has(key)) search.set(key, []);
        search.get(key).push(row);
    }
    if (!search.size) for (const type of SEARCH_TYPES) {
        abstain(type, 'gsc', searchUsable
            ? 'Απαιτούνται αντιστοιχισμένα σύνολα σελίδων χωρίς ανάλυση ερωτήματος, χώρας ή συσκευής· δεν αθροίζονται επικαλυπτόμενες εξαγωγές.'
            : 'Μη επαληθευμένα, απόντα, κενά ή ανώριμα δεδομένα GSC — δεν εξάγεται συμπέρασμα αναζήτησης.');
    }
    for (const [subject, rows] of [...search].sort(([a], [b]) => compare(a, b))) {
        rows.sort((a, b) => compare(a.date, b.date) || compare(a.page, b.page));
        const distinct = new Set(rows.map(row => row.date));
        const complete = distinct.size === rows.length && (rows[0].date === null || rows.length === daysIn(gsc.period));
        const impressions = sum(rows, 'impressions'), clicks = sum(rows, 'clicks');
        if (!complete || !Number.isSafeInteger(impressions) || !Number.isSafeInteger(clicks)) {
            for (const type of SEARCH_TYPES) abstain(type, subject, 'Ελλιπείς ημέρες, επικαλυπτόμενες ταυτότητες ή μη ασφαλές άθροισμα· δεν συμπληρώνονται μηδενικά.');
            continue;
        }
        const baselines = new Set(rows.filter(row => row.impressions > 0).map(row =>
            row.position <= 1 ? 20 : row.position <= 3 ? 10 : row.position <= 10 ? 3 : 1));
        const baseline = baselines.size === 1 ? [...baselines][0] : null;
        if (baseline === null) {
            for (const type of ['search_ctr_gap', 'metadata_review']) abstain(type, subject, baselines.size > 1
                ? 'Οι γραμμές με εμφανίσεις ανήκουν σε διαφορετικές ζώνες θέσης· δεν επιλέγεται όριο CTR από τη μέση θέση.'
                : 'Δεν υπάρχει θέση με εμφανίσεις που να αντιστοιχίζεται μονοσήμαντα σε ζώνη CTR.');
        } else {
            const position = rows.reduce((total, row) => total + (row.position ?? 0) * (row.impressions / impressions), 0);
            const gap = impressions >= MIN_IMPRESSIONS && clicks / impressions < baseline / 100;
            const observations = { clicks, impressions, impression_weighted_position: position,
                baseline_ctr_numerator: baseline, baseline_ctr_denominator: 100, minimum_impressions: MIN_IMPRESSIONS };
            const units = { clicks: 'Google search clicks', impressions: 'Google search impressions',
                impression_weighted_position: 'average position', baseline_ctr: 'ratio of numerator / denominator', minimum_impressions: 'impressions' };
            const counter = clicks > 0 ? ['Υπάρχουν καταγεγραμμένα κλικ αναζήτησης· το άρθρο ήδη προσελκύει κάποια κλικ.'] : [];
            if (gap) signal('search_ctr_gap', 'technical_seo', subject, [['gsc', gsc]], observations, units,
                'Το CTR βρίσκεται κάτω από το δηλωμένο φίλτρο της ζώνης θέσης, με επαρκείς εμφανίσεις για έλεγχο.',
                'Ελέγξτε χειροκίνητα την εμφάνιση στα αποτελέσματα και τη συνάφεια με την πρόθεση αναζήτησης.', SEARCH_LIMITS, counter);
            else abstain('search_ctr_gap', subject, impressions < MIN_IMPRESSIONS
                ? 'Μικρό δείγμα — λιγότερες από 100 εμφανίσεις· δεν προκύπτει ασφαλές συμπέρασμα.'
                : 'Το παρατηρούμενο CTR δεν είναι χαμηλότερο από το δηλωμένο φίλτρο.', 'WARNING');
            if (gap && articles.has(subject)) signal('metadata_review', 'article_improvement', subject,
                [['gsc', gsc], ['catalogue', catalogue]], observations, units,
                'Η ορατή στην αναζήτηση σελίδα προσφέρεται για ανθρώπινο έλεγχο τίτλου και περιγραφής.',
                'Ελέγξτε τον δημόσιο τίτλο και την περιγραφή ως προς σαφήνεια και ακρίβεια· δεν προτείνεται αυτόματη επανεγγραφή.',
                [...SEARCH_LIMITS, 'Το συμβόλαιο δεν περιέχει περιγραφή ή διάγνωση ελαττώματος μεταδεδομένων.'], counter);
            else abstain('metadata_review', subject, 'Δεν συνυπάρχουν επαρκής ένδειξη CTR και επαληθεύσιμο μεταδεδομένο καταλόγου.');
        }

        const article = articles.get(subject), length = daysIn(gsc.period), half = length / 2;
        if (!article || article.published > shift(gsc.period.start, -OLD_DAYS) || rows[0].date === null || length < 14 || length % 2) {
            abstain('evergreen_refresh', subject, 'Απαιτείται άρθρο ηλικίας 90 ημερών πριν την αρχή και δύο πλήρεις, ίσες, μη επικαλυπτόμενες περίοδοι τουλάχιστον 7 ημερών από ημερήσια GSC.');
            continue;
        }
        const split = shift(gsc.period.start, half);
        const earlierRows = rows.filter(row => row.date < split), laterRows = rows.filter(row => row.date >= split);
        const earlier = { clicks: sum(earlierRows, 'clicks'), impressions: sum(earlierRows, 'impressions'), days: half };
        const later = { clicks: sum(laterRows, 'clicks'), impressions: sum(laterRows, 'impressions'), days: half };
        if (Math.min(earlier.impressions, later.impressions) < MIN_IMPRESSIONS || Math.abs(later.impressions - earlier.impressions) < MIN_IMPRESSIONS) {
            abstain('evergreen_refresh', subject, 'Μικρό δείγμα ή μεταβολή κάτω από 100 εμφανίσεις· απαιτούνται τουλάχιστον 100 εμφανίσεις σε κάθε περίοδο.', 'WARNING');
            continue;
        }
        const contradictory = Math.sign(later.clicks - earlier.clicks) !== Math.sign(later.impressions - earlier.impressions);
        signal('evergreen_refresh', 'article_improvement', subject, [['gsc', gsc], ['catalogue', catalogue]],
            { earlier, later, minimum_impressions_per_period: MIN_IMPRESSIONS, minimum_absolute_change: MIN_IMPRESSIONS, published: article.published },
            { clicks: 'Google search clicks', impressions: 'Google search impressions', days: 'calendar days', published: 'calendar date' },
            'Οι εμφανίσεις αναζήτησης παλαιότερου άρθρου διαφέρουν μεταξύ δύο ίσων ώριμων περιόδων.',
            'Ελέγξτε αν χρειάζεται συντακτική ανανέωση, διατηρώντας την αρχική ημερομηνία δημοσίευσης και την υπογραφή.',
            [...SEARCH_LIMITS, 'Η μεταβολή εμφανίσεων δεν αποδεικνύει μεταβολή αναγνωστών· εποχικότητα, θέση και πρόθεση μπορεί να αλλάζουν.'],
            contradictory ? ['Τα κλικ δεν μεταβάλλονται προς την ίδια κατεύθυνση με τις εμφανίσεις.'] : [], {}, {
                gsc: { earlier: { start: gsc.period.start, end: shift(split, -1) }, later: { start: split, end: gsc.period.end }, timezone: gsc.timezone },
                catalogue: { ...catalogue.period, timezone: catalogue.timezone }
            });
    }

    const discovery = site?.discovery;
    const demand = new Map();
    if (usable(discovery, 4)) for (const row of discovery.rows) {
        if (row.mapping !== 'mapped') continue;
        const key = url(row.page);
        demand.set(key, (demand.get(key) ?? 0) + row.click_events);
    }
    const views = new Map((usable(site, 4) ? site.articles : [])
        .filter(row => row.mapping === 'mapped').map(row => [url(row.page), row.page_view_events]));
    for (const [subject, clickEvents] of [...demand].sort(([a], [b]) => compare(a, b))) {
        if (!Number.isSafeInteger(clickEvents) || clickEvents < MIN_EVENTS) {
            abstain('discovery_dropoff', subject, 'Μικρό δείγμα — απαιτούνται 30 συμβάντα εσωτερικού κλικ.', 'WARNING');
            continue;
        }
        const pageViews = views.get(subject);
        if (pageViews !== undefined && joinable({ ...site, page: subject }, { ...discovery, page: subject }) && pageViews < 5) {
            signal('discovery_dropoff', 'internal_discovery', subject, [['discovery', discovery], ['site', site]],
                { internal_click_events: clickEvents, page_view_events: pageViews, minimum_click_events: MIN_EVENTS, weak_view_ceiling_exclusive: 5 },
                { internal_click_events: 'consented internal_page_click events', page_view_events: 'consented page_view events' },
                'Υπόθεση: υπάρχει ζήτηση εσωτερικών κλικ και περιορισμένη καταγραφή page_view στον προορισμό.',
                'Ελέγξτε χειροκίνητα σύνδεσμο, συναίνεση και καταγραφή προορισμού· η υπόθεση δεν αποτελεί διάγνωση αποτυχημένης πλοήγησης.',
                EVENT_LIMITS, pageViews > 0 ? ['Υπάρχουν page_view events προορισμού· η καταγραφή δεν απουσιάζει πλήρως.'] : [], { hypothesis: true });
        } else abstain('discovery_dropoff', subject, 'Απουσιάζει ρητή γραμμή page_view, οι ακριβείς περίοδοι διαφέρουν ή η καταγραφή δεν είναι κάτω από 5 συμβάντα.');
    }
    if (!demand.size) abstain('discovery_dropoff', 'site.discovery', 'Απουσιάζουν ώριμα, αντιστοιχισμένα συγκεντρωτικά δεδομένα εσωτερικής ανακάλυψης.');
    if (!articles.size) abstain('weak_internal_linking', 'catalogue', 'Απουσιάζουν ώριμα, αντιστοιχισμένα άρθρα καταλόγου για έλεγχο συνδέσμων.');

    for (const [subject, article] of [...articles].sort(([a], [b]) => compare(a, b))) {
        if (usable(linkGraph) && samePeriod(catalogue, linkGraph) && catalogue.asOf === linkGraph.asOf) {
            const inbound = new Set(linkGraph.rows.filter(edge => edge.toMapping === 'mapped' && edge.to === subject && edge.from !== subject).map(edge => edge.from)).size;
            const clickEvents = demand.get(subject), hasClickContext = Number.isSafeInteger(clickEvents);
            if (inbound <= 1) signal('weak_internal_linking', 'internal_discovery', subject,
                [['catalogue', catalogue], ['linkGraph', linkGraph], ...(hasClickContext ? [['discovery', discovery]] : [])],
                { inbound_source_pages: inbound, maximum_inbound_source_pages: 1, ...(hasClickContext ? { internal_click_events: clickEvents } : {}) },
                { inbound_source_pages: 'distinct observed linking pages', ...(hasClickContext ? { internal_click_events: 'consented internal_page_click events' } : {}) },
                'Το παρατηρούμενο γράφημα έχει λίγες εισερχόμενες πηγές προς το άρθρο.',
                'Εξετάστε συναφείς εσωτερικούς συνδέσμους στο άρθρο, συμπεριλαμβανομένων σχετικών κόμβων οντοτήτων.',
                [...(hasClickContext ? EVENT_LIMITS : []),
                    'Το γράφημα είναι παρούσα παρατήρηση, μπορεί να είναι ελλιπές και δεν αποδεικνύει ιστορική κάλυψη ή αποτελεσματικότητα.',
                    hasClickContext
                        ? clickEvents < MIN_EVENTS
                            ? 'Το δείγμα ανακάλυψης είναι κάτω από 30 συμβάντα· παρέχεται μόνο ως προαιρετικό πλαίσιο, χωρίς συμπέρασμα ζήτησης.'
                            : 'Τα συμβάντα ανακάλυψης παρέχονται μόνο ως προαιρετικό πλαίσιο· η ένδειξη βασίζεται στο γράφημα συνδέσμων.'
                        : 'Απουσιάζει ώριμη, αντιστοιχισμένη καταγραφή ανακάλυψης με ασφαλές άθροισμα· δεν τεκμαίρονται μηδενικά κλικ ή ζήτηση.'],
                inbound > 0 ? ['Υπάρχει ήδη μία παρατηρούμενη πηγή εισερχόμενου συνδέσμου.'] : []);
            else abstain('weak_internal_linking', subject, 'Οι παρατηρούμενες εισερχόμενες πηγές είναι περισσότερες από μία.', 'WARNING');
        } else abstain('weak_internal_linking', subject, 'Απαιτούνται κατάλογος και γράφημα συνδέσμων με ίδια ημερομηνία παρατήρησης για αντιστοιχισμένο άρθρο.');
        const topic = TOPICS.get(article.category.trim().toLowerCase());
        if (!topic) continue;
        const pageViews = views.get(subject);
        if (pageViews === undefined || pageViews < MIN_EVENTS) {
            abstain('data_explainer_opportunity', subject, 'Ο κατάλογος τεκμηριώνει θέμα, όχι ζήτηση· απαιτούνται τουλάχιστον 30 συναινετικά page_view events του άρθρου.', 'WARNING');
            continue;
        }
        signal('data_explainer_opportunity', 'content_opportunity', subject, [['catalogue', catalogue], ['site', site]],
            { page_view_events: pageViews, minimum_page_view_events: MIN_EVENTS, catalogue_articles: 1 },
            { page_view_events: 'consented page_view events', catalogue_articles: 'articles' },
            `Υπάρχει καταγεγραμμένο ενδιαφέρον συμβάντων σε άρθρο της ρητής κατηγορίας «${topic}».`,
            'Εξετάστε αν ένας επεξηγηματικός οδηγός δεδομένων εξυπηρετεί το συγκεκριμένο θέμα· ελέγξτε πρώτα την υπάρχουσα κάλυψη.',
            [...EVENT_LIMITS, 'Η ρητή κατηγορία καταλόγου συνδέει το θέμα· δεν γίνεται ταξινόμηση τίτλων, ερωτημάτων ή χρήση εργαλείων.'],
            ['Υπάρχει ήδη άρθρο για το θέμα· νέα κάλυψη μπορεί να είναι περιττή.'], { topic });
    }
    if (!result.signals.some(row => row.type === 'data_explainer_opportunity') && !result.abstentions.some(row => row.type === 'data_explainer_opportunity')) {
        abstain('data_explainer_opportunity', 'catalogue', 'Δεν συνυπάρχουν ρητή υποστηριζόμενη θεματική κατηγορία και επαρκής πρωτογενής ζήτηση.');
    }
    result.signals.sort((a, b) => compare(a.type, b.type) || compare(a.subject, b.subject) || compare(a.signal_id, b.signal_id));
    result.abstentions.sort((a, b) => compare(a.type, b.type) || compare(a.subject, b.subject));
    return result;
}

export function renderEditorialReport(result, { synthetic }) {
    const lines = ['# Συντακτικός έλεγχος I-07B', '', synthetic
        ? '**ΠΡΟΣΟΧΗ: συνθετικά δεδομένα — αποκλειστικά για δοκιμή, όχι πραγματικά ευρήματα.**'
        : '**Ιδιωτική αναφορά — μην τη δημοσιεύσετε.**', '',
    `Ημερομηνία αξιολόγησης: ${result.asOf ?? 'NOT VERIFIED'}. Παραγωγική ορθότητα: NOT VERIFIED.`,
    'Όλες οι ενδείξεις είναι χαμηλής εμπιστοσύνης, χωρίς στατιστική κατάταξη ή πρόβλεψη επίδρασης.', ''];
    for (const item of result.signals) lines.push(`## ${item.type} — ${item.subject}`, '', item.why_it_matters, '',
        item.recommended_human_review, '', 'Πηγές, ακριβείς περίοδοι και μονάδες:', '```json',
        JSON.stringify({ data_source: item.data_source, exact_period: item.exact_period, observations: item.observations,
            metric_units: item.metric_units, minimum_sample_status: item.minimum_sample_status, scope: item.scope }, null, 2), '```', '',
        ...item.limitations.map(value => `- Περιορισμός: ${value}`), ...item.counterevidence.map(value => `- Αντίθετη ένδειξη: ${value}`),
        ...item.evidence_links.map(value => `- Τεκμήριο: ${value}`), '');
    lines.push('## Αποχές από συμπέρασμα', '');
    for (const item of result.abstentions) lines.push(`- ${item.status} · ${item.type} · ${item.subject}: ${item.reason}`);
    return `${lines.join('\n')}\n`;
}

const inside = (file, root) => {
    const relative = path.relative(root, file);
    return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
};

export function main(argv) {
    const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: { out: { type: 'string' } } });
    if (positionals.length !== 1) throw new Error('expected one contract input');
    const inputs = JSON.parse(fs.readFileSync(positionals[0], 'utf8'));
    if ((process.env.CI || process.env.GITHUB_ACTIONS) && inputs?.synthetic !== true) throw new Error('real inputs refused in CI');
    const asOf = [inputs?.gsc, inputs?.site, inputs?.site?.discovery, inputs?.site?.rum, inputs?.catalogue, inputs?.linkGraph]
        .map(section => section?.asOf).filter(day).sort().at(-1);
    const result = evaluateEditorialInsights(inputs, { asOf });
    const requested = path.resolve(values.out ?? path.join(os.homedir(), 'f1stories-editorial-insights.json'));
    if (path.extname(requested) !== '.json') throw new Error('output must be JSON');
    const parent = fs.realpathSync(path.dirname(requested));
    const output = path.join(parent, path.basename(requested));
    const report = output.slice(0, -5) + '.md';
    const testRelative = path.relative(fs.realpathSync(TESTS), parent);
    const inTestTmp = inside(parent, fs.realpathSync(TESTS)) && testRelative.split(path.sep).some(part => /^tmp-/.test(part));
    const allowRepoTestTmp = inputs?.synthetic === true && process.env.NODE_TEST_CONTEXT && inTestTmp;
    for (const destination of [requested, output]) {
        if ((inside(destination, ROOT) || inside(destination, fs.realpathSync(ROOT)))
            && !allowRepoTestTmp) throw new Error('repository output refused');
    }
    if (!allowRepoTestTmp) for (let directory = parent; ; directory = path.dirname(directory)) {
        if (fs.lstatSync(path.join(directory, '.git'), { throwIfNoEntry: false })) throw new Error('repository output refused');
        if (directory === path.dirname(directory)) break;
    }
    const opened = [];
    try {
        // Reserve both files before writing: existing files/symlinks are never overwritten.
        for (const destination of [output, report]) opened.push({ destination, fd: fs.openSync(destination, 'wx', 0o600) });
        fs.writeFileSync(opened[0].fd, `${JSON.stringify(result, null, 2)}\n`);
        fs.writeFileSync(opened[1].fd, renderEditorialReport(result, { synthetic: result.synthetic }));
    } catch (error) {
        for (const file of opened) { fs.closeSync(file.fd); fs.unlinkSync(file.destination); }
        throw error;
    }
    for (const file of opened) fs.closeSync(file.fd);
    process.stdout.write('PASS: local JSON and Greek review report written. Production correctness NOT VERIFIED.\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try { main(process.argv.slice(2)); }
    catch {
        // OS/parser errors may contain private paths or input values.
        process.stderr.write('FAIL: local evaluation refused; check input contract and new private .json output path.\n');
        process.exitCode = 1;
    }
}
