const $ = id => document.getElementById(id);
const sections = { executive: 'Κύρια ευρήματα', facts: 'Πραγματολογικοί ισχυρισμοί με πηγές', statistics: 'Αγωνιστικά στατιστικά', technical: 'Τεχνικές εξηγήσεις', alternatives: 'Εναλλακτικές εξηγήσεις', contradictions: 'Αντιφάσεις / αντικρουόμενα στοιχεία', unverified: 'Μη επαληθευμένες υποθέσεις' };
const kinds = { official_record: 'Επίσημη καταγραφή', source_report: 'Αναφορά πηγής', calculated_statistic: 'Υπολογισμένο στατιστικό', technical_interpretation: 'Τεχνική ερμηνεία', prediction: 'Πρόβλεψη', unsupported_hypothesis: 'Μη τεκμηριωμένη υπόθεση' };
const statisticLabels = { value: 'Τιμή', unit: 'Μονάδα', population: 'Πληθυσμός / δείγμα', period: 'Σκέλος / περίοδος', dataSource: 'Πηγή δεδομένων', method: 'Μέθοδος', exclusions: 'Εξαιρέσεις' };
let config, result, controller;
function element(tag, text, className) {
    const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (className) n.className = className; return n;
}
function status(text, state = '') { $('status').textContent = text; $('status').dataset.state = state; }
function link(text, url) {
    const a = element('a', text), u = new URL(url);
    if (u.protocol !== 'https:' || u.username || u.password) return element('span', text);
    a.href = u.href; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a;
}
function detail(label, open = false) {
    const d = element('details', undefined, 'dossier-section'); d.open = open; d.append(element('summary', label)); $('result').append(d); return d;
}
function render(data) {
    const d = data.dossier; $('result').replaceChildren();
    $('result').append(element('p', data.label, 'banner'), element('h3', 'Ερώτημα και πεδίο έρευνας'), element('p', d.scope, 'scope'));
    for (const [key, label] of Object.entries(sections)) {
        const block = detail(`${label} (${d[key].length})`, ['executive', 'facts', 'unverified'].includes(key));
        if (!d[key].length) block.append(element('p', 'Δεν υπάρχουν τεκμηριωμένες εγγραφές.', 'hint'));
        for (const c of d[key]) {
            const finding = element('div', undefined, 'finding');
            finding.append(element('p', `${c.id} · ${kinds[c.kind]} · ${c.verification === 'fixture_inspected' ? 'Επιθεωρημένο DEMO' : 'Μη επαληθευμένο'}`, 'meta'), element('p', c.text), element('p', c.reason, 'hint'));
            if (c.originalSection !== key) finding.append(element('p', `Προέλευση: ${sections[c.originalSection]}`, 'meta'));
            if (c.verification !== 'fixture_inspected' && c.sourceIds.length) finding.append(element('p', c.association === 'provider_citation' ? 'Παραπομπή παρόχου στη συγκεκριμένη πρόταση· η υποστήριξη χρειάζεται έλεγχο.' : 'Σχετική πηγή μόνο· δεν έχει επιβεβαιωθεί παραπομπή στη συγκεκριμένη πρόταση.', 'hint'));
            if (c.statistic) {
                const stats = element('dl');
                for (const [k, v] of Object.entries(c.statistic)) stats.append(element('dt', statisticLabels[k]), element('dd', v));
                finding.append(stats);
            }
            const citations = element('div', undefined, 'citations');
            for (const id of c.sourceIds) {
                const s = d.sources.find(s => s.id === id);
                if (s) citations.append(link(`[${id}] ${s.publisher}`, s.url));
            }
            finding.append(citations); block.append(finding);
        }
    }
    for (const [label, values] of [['Περιορισμοί έρευνας', d.limitations], ['Προτεινόμενη δομή άρθρου · προτάσεις προς έλεγχο', d.outline]]) {
        const block = detail(label), list = element('ul', undefined, 'plain-list');
        values.forEach(v => list.append(element('li', v))); block.append(list);
    }
    const register = detail(`Μητρώο πηγών (${d.sources.length})`, true);
    if (!d.sources.length) register.append(element('p', 'Δεν ανακτήθηκαν πηγές.'));
    for (const s of d.sources) {
        const record = element('div', undefined, 'source');
        record.append(link(`[${s.id}] ${s.title}`, s.url), element('p', s.publisher, 'meta'), element('p', s.url, 'hint'), element('p', `Δημοσίευση: ${s.publicationDate || 'άγνωστη'} · ${s.provenance === 'fixture' ? 'Επιθεώρηση fixture' : 'Ανάκτηση'}: ${s.retrievedAt}`, 'meta'));
        register.append(record);
    }
    const usage = detail('Χρήση και εκτίμηση κόστους', true), u = data.usage;
    usage.append(element('p', `Μοντέλο: ${u.model || 'DEMO'} · Input tokens: ${u.inputTokens ?? 'άγνωστα'} · Output tokens: ${u.outputTokens ?? 'άγνωστα'} · Web search tool calls: ${u.searchToolCalls ?? 'άγνωστες'} · Χρόνος: ${u.elapsedMs} ms`, 'usage'), element('p', `Εκτίμηση: ${u.estimatedUSD === null ? 'μη διαθέσιμη' : '$' + u.estimatedUSD.toFixed(5)} USD · Live αιτήματα: ${data.liveRequests}/${config.maxRequests}`, 'usage'), element('p', u.note, 'hint'), element('p', 'Η εκτίμηση δεν είναι τελική χρέωση. Ο τοπικός μετρητής δεν αποτελεί χρηματικό όριο. Ακύρωση ή timeout ενδέχεται να χρεωθεί.', 'hint'));
    if (u.pricing) usage.append(link('Πηγή τιμών OpenAI', u.pricing.source));
}
function loading(active) {
    $('start').disabled = active || !config; $('cancel').disabled = !active;
    $('copy').disabled = active || !result; $('download').disabled = active || !result;
    $('result').setAttribute('aria-busy', String(active));
}
$('theme').onclick = () => {
    const light = document.documentElement.dataset.theme !== 'light'; document.documentElement.dataset.theme = light ? 'light' : 'dark';
    $('theme').textContent = light ? 'Σκοτεινό θέμα' : 'Φωτεινό θέμα'; $('theme').setAttribute('aria-pressed', String(light));
};
$('example').onchange = () => {
    const ex = config.examples.find(e => e.id === $('example').value); if (!ex) return;
    $('question').value = ex.question; $('category').value = ex.category; $('session').value = ex.session; $('season').value = '2026'; $('grandPrix').value = '';
};
$('mode').onchange = () => { $('activation').hidden = $('mode').value !== 'LIVE'; $('activateLive').checked = false; };
$('research').onsubmit = async event => {
    event.preventDefault(); if (!config || controller) return;
    const mode = $('mode').value;
    if (mode === 'LIVE' && !$('activateLive').checked) { status('Ενεργοποίησε ρητά αυτή την πληρωμένη κλήση.', 'error'); return; }
    const payload = Object.fromEntries(new FormData($('research'))); payload.mode = mode; payload.activateLive = $('activateLive').checked;
    $('activateLive').checked = false; result = null; $('result').replaceChildren();
    controller = new AbortController(); const current = controller; loading(true);
    status(mode === 'DEMO' ? 'Προετοιμασία σταθερού παραδείγματος…' : 'Έρευνα σε επίσημες πηγές… Δεν θα γίνει αυτόματη επανάληψη.', 'loading');
    const timer = setTimeout(() => current.abort('timeout'), config.timeoutMs + 3000);
    try {
        const response = await fetch('/api/research', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-F1S-Research': config.csrf }, body: JSON.stringify(payload), signal: current.signal });
        const data = await response.json();
        if (!response.ok) {
            status(data.error + (data.usage ? ' ' + JSON.stringify(data.usage) : ''), 'error'); return;
        }
        result = data; render(data); status(`${data.label} · ${data.dossier.sources.length} πηγές · ${data.dossier.unverified.length} μη επαληθευμένες εγγραφές.`);
    } catch { status(current.signal.aborted ? current.signal.reason === 'timeout' ? 'Το αίτημα υπερέβη το χρονικό όριο. Έλεγξε τη χρήση στον πάροχο πριν επαναλάβεις.' : 'Η έρευνα ακυρώθηκε. Μια live κλήση ενδέχεται να έχει ήδη χρεωθεί.' : 'Η τοπική υπηρεσία δεν απάντησε. Έλεγξε ότι λειτουργεί και δοκίμασε ξανά.', 'error'); }
    finally { clearTimeout(timer); controller = null; loading(false); }
};
$('cancel').onclick = () => controller?.abort('cancel');
$('copy').onclick = async () => {
    try { await navigator.clipboard.writeText(result.brief); status('Το πλήρες ελληνικό brief αντιγράφηκε.'); }
    catch { status('Η αντιγραφή δεν επιτράπηκε από τον browser. Χρησιμοποίησε «Λήψη brief.txt».', 'error'); }
};
$('download').onclick = () => {
    const url = URL.createObjectURL(new Blob([result.brief], { type: 'text/plain;charset=utf-8' }));
    const a = element('a'); a.href = url; a.download = 'brief.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$('lookup').onsubmit = async event => {
    event.preventDefault(); const target = $('internalResults'); target.textContent = 'Τοπική αναζήτηση…';
    try {
        const response = await fetch('/api/internal?q=' + encodeURIComponent($('lookupQuery').value)); const data = await response.json();
        target.replaceChildren(element('p', data.note || data.error));
        for (const ref of data.references || []) target.append(link(`${ref.title} · ${ref.date}`, ref.url));
        if (data.references?.length === 0) target.append(element('p', 'Δεν βρέθηκαν αναφορές.'));
    } catch { target.textContent = 'Η τοπική αναζήτηση δεν είναι διαθέσιμη.'; }
};
try {
    const response = await fetch('/api/config'); if (!response.ok) throw new Error(); config = await response.json();
    for (const ex of config.examples) { const option = element('option', ex.label); option.value = ex.id; $('example').append(option); }
    $('mode').querySelector('[value=LIVE]').disabled = !config.liveAvailable;
    $('availability').textContent = config.liveAvailable ? `LIVE διαθέσιμο μόνο με ρητή ενεργοποίηση · έως ${config.maxRequests} αιτήματα ανά εκκίνηση server · ${config.timeoutMs / 1000}s timeout · ${config.maxOutputTokens} output tokens.` : config.liveUnavailableReason;
    loading(false);
} catch { status('Δεν φορτώθηκαν οι τοπικές ρυθμίσεις. Άνοιξε τη σελίδα από τον research server.', 'error'); }
