(function (global) {
    'use strict';

    var SECTIONS = { facts: 'Επιβεβαιωμένα γεγονότα', statistics: 'Αγωνιστικά στατιστικά', sources: 'Πρωτογενείς πηγές',
        interpretations: 'Τεχνικές ερμηνείες', alternatives: 'Ανταγωνιστικές εξηγήσεις', unverified: 'Μη επαληθευμένοι ισχυρισμοί', internal: 'Εσωτερικές αναφορές' };
    var TYPES = { fact: 'Αναφερόμενο γεγονός', statistic: 'Υπολογισμένο στατιστικό', interpretation: 'Τεχνική ερμηνεία', prediction: 'Πρόβλεψη', unverified: 'Μη επαληθευμένος ισχυρισμός' };
    var KINDS = { general: 'Γενικό', odds: 'Παρατήρηση απόδοσης', prediction: 'Πρόβλεψη', outcome: 'Επίσημο αγωνιστικό αποτέλεσμα', settlement: 'Διακανονισμός αγοράς' };
    var TOOL_LIMITS = { standings: 'Οι παράγωγες τιμές χρειάζονται ορισμό και συγκεκριμένο σκέλος ή γύρο.',
        telemetry: 'Τα δεδομένα OpenF1 δεν είναι πλήρης μηχανική τηλεμετρία.',
        ghostcar: 'Οι παρεμβολές θέσης δεν τεκμηριώνουν αεροδυναμικές αιτίες.',
        tyres: 'Οι προγνώσεις και οι εκτιμήσεις Pirelli δεν είναι μετρημένα αποτελέσματα αγώνα.' };
    var TOOL_URLS = { standings: 'https://f1-stories.gr/standings/', telemetry: 'https://georgiosbalatzis.github.io/f1-telemetry-dashboard/',
        ghostcar: 'https://georgiosbalatzis.github.io/ghostcar/', tyres: 'https://georgiosbalatzis.github.io/Tyres/' };
    var EMPTY = 'Δεν έχουν καταγραφεί στοιχεία.';
    function normal(value) { return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ς/g, 'σ'); }
    function safeURL(value) {
        if (typeof value !== 'string' || !/^https?:\/\//i.test(value) || /[\s\u0000-\u001f\u007f]/.test(value)) throw new Error('Χρειάζεται έγκυρος σύνδεσμος HTTP ή HTTPS.');
        var url = new URL(value);
        if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error('Ο σύνδεσμος δεν είναι ασφαλής.');
        return url.href;
    }
    function isoDate(value) {
        return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)
            && Number.isFinite(Date.parse(value)) && new Date(value.slice(0, 10)).toISOString().slice(0, 10) === value.slice(0, 10);
    }
    function decodeIndex(data) {
        if (!data || data.v !== 2 || !Array.isArray(data.p) || !Array.isArray(data.a) || !Array.isArray(data.c)
            || !data.a.every(function (value) { return typeof value === 'string'; })
            || !data.c.every(global.F1S_TAXONOMY.isPublicCategory)
            || (data.t !== undefined && (!Array.isArray(data.t) || !data.t.every(function (value) { return typeof value === 'string'; })))
            || data.p.length > 10000 || !data.p.every(function (row) {
                return Array.isArray(row) && /^[\p{L}\p{N}_-]+$/u.test(row[0]) && typeof row[1] === 'string' && isoDate(row[3])
                    && Number.isInteger(row[2]) && typeof data.a[row[2]] === 'string'
                    && Array.isArray(row[8]) && row[8].every(function (i) { return Number.isInteger(i) && global.F1S_TAXONOMY.isPublicCategory(data.c[i]); })
                    && (row[9] === undefined || (Array.isArray(row[9]) && row[9].every(function (tag) { return typeof tag === 'string' || (Number.isInteger(tag) && data.t && typeof data.t[tag] === 'string'); })));
            })) throw new Error('Ο δημόσιος κατάλογος άρθρων δεν έχει έγκυρο σχήμα v2.');
        return global.F1S_AUTHOR_ARTICLE_INDEX.expandCompactPosts(data);
    }
    function search(posts, query) {
        var q = normal(query.trim()), tokens = q.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
        if (!tokens.length) return [];
        return posts.map(function (post) {
            var subjects = [post.id, post.title, post.author].concat(post.tags || [], post.categories || [] ).map(normal);
            var haystack = subjects.join(' '), words = haystack.split(/[^\p{L}\p{N}]+/u);
            var exact = subjects.includes(q), whole = tokens.filter(function (token) { return words.includes(token); }).length;
            var partial = tokens.filter(function (token) { return haystack.includes(token); }).length;
            return { post: post, exact: exact, score: exact ? 10000 : whole * 100 + partial,
                reason: exact ? 'Ακριβής αντιστοίχιση πεδίου' : whole + '/' + tokens.length + ' πλήρεις λέξεις · ' + partial + '/' + tokens.length + ' μερικές αντιστοιχίσεις' };
        }).filter(function (hit) { return hit.score > 0; }).sort(function (a, b) {
            return Number(b.exact) - Number(a.exact) || b.score - a.score || String(b.post.date).localeCompare(String(a.post.date)) || String(a.post.id).localeCompare(String(b.post.id));
        }).slice(0, 8);
    }
    function validateCatalog(data) {
        if (!data || data.version !== 1 || !Array.isArray(data.rounds) || data.rounds.length > 2000 || !data.rounds.every(function (pair) {
            return Array.isArray(pair) && pair.length === 2 && Number.isInteger(pair[0]) && pair[0] >= 1950 && pair[0] <= 2100
                && Number.isInteger(pair[1]) && pair[1] >= 1 && pair[1] <= 30;
        }) || !Array.isArray(data.tools) || data.tools.length !== 4 || new Set(data.tools.map(function (tool) { return tool.id; })).size !== 4
            || !data.tools.every(function (tool) { return TOOL_URLS[tool.id] === tool.href && typeof tool.label === 'string'; })) {
            throw new Error('Ο κατάλογος διαθέσιμων δεδομένων δεν είναι έγκυρος. Δοκίμασε ξανά.');
        }
        return data;
    }
    function snapshot(data, season, round) {
        if (!/^\d{4}$/.test(String(season)) || !/^[1-9]\d?$/.test(String(round)) || +round > 30) throw new Error('Επίλεξε διαθέσιμη σεζόν και γύρο.');
        if (!data || !isoDate(data.generatedAt) || !data.generatedAt.includes('T') || typeof data.raceName !== 'string' || !data.raceName.trim()) {
            throw new Error('Μη έγκυρο στιγμιότυπο: λείπει αγώνας ή χρόνος δημιουργίας.');
        }
        if (Date.parse(data.generatedAt) > Date.now() + 300000) throw new Error('Μη έγκυρος μελλοντικός χρόνος στιγμιοτύπου.');
        var rows = [];
        ['driver', 'constructor'].forEach(function (kind) {
            var payload = data[kind + 'Standings'], table = payload && payload.MRData && payload.MRData.StandingsTable;
            var lists = table && table.StandingsLists, list = lists && lists[0];
            if (!table || String(table.season) !== String(season) || String(table.round) !== String(round) || !Array.isArray(lists) || lists.length !== 1
                || String(list.season) !== String(season) || String(list.round) !== String(round)) throw new Error('Το στιγμιότυπο δεν αντιστοιχεί στην επιλεγμένη σεζόν / γύρο.');
            var source = data.source && data.source[kind + 'StandingsUrl'];
            try { source = safeURL(source); } catch (_) { throw new Error('Η προέλευση του στιγμιοτύπου δεν είναι διαθέσιμη.'); }
            var sourceURL = new URL(source);
            if (sourceURL.origin !== 'https://api.jolpi.ca' || !new RegExp('^/ergast/f1/' + season + '/' + round + '/' + kind + 'standings\\.json$').test(sourceURL.pathname)) {
                throw new Error('Η προέλευση δεν αντιστοιχεί στην επιλεγμένη σεζόν / γύρο.');
            }
            var entries = list[kind === 'driver' ? 'DriverStandings' : 'ConstructorStandings'];
            if (!Array.isArray(entries) || !entries.length || entries.length > 100) throw new Error('Λείπουν έγκυρες εγγραφές βαθμολογίας.');
            entries.forEach(function (row) {
                var person = kind === 'driver' ? row.Driver : row.Constructor;
                var name = person && (kind === 'driver' ? [person.givenName, person.familyName].filter(Boolean).join(' ') : person.name);
                if (typeof name !== 'string' || !name.trim() || !/^\d+$/.test(String(row.position)) || +row.position < 1
                    || !/^\d+(?:\.\d+)?$/.test(String(row.points))) throw new Error('Μη έγκυρη θέση ή βαθμοί στη βαθμολογία.');
                rows.push({ name: name, kind: kind, position: String(row.position), points: String(row.points), source: source,
                    season: String(season), round: String(round), raceName: data.raceName, generatedAt: data.generatedAt });
            });
        });
        return rows;
    }
    function standingText(row) {
        return [row.kind === 'driver' ? 'Οδηγός: ' + row.name : 'Κατασκευαστής: ' + row.name,
            'Σεζόν: ' + row.season + ' · Γύρος: ' + row.round + ' · ' + row.raceName,
            'Θέση: ' + row.position + ' · Βαθμοί: ' + row.points,
            'Πηγή: Jolpica (ανεπίσημη) — ' + row.source, 'Δημιουργία στιγμιοτύπου: ' + row.generatedAt,
            'Καταγεγραμμένη τιμή · δεν έχει επαληθευτεί ανεξάρτητα από τον συντάκτη. Ελέγξτε τυχόν τροποποιημένες κατατάξεις / αποφάσεις FIA.'].join('\n');
    }
    function articleText(post) {
        return ['Εσωτερική αναφορά: ' + post.title, post.categories.join(', ') + ' · ' + post.date + ' · ' + post.author,
            'https://f1-stories.gr' + post.url, 'Εσωτερικό δημοσίευμα, όχι ανεξάρτητη επαλήθευση ή πρωτογενής πηγή.'].join('\n');
    }
    function validateNote(note) {
        if (!note.text.trim() || !Object.hasOwn(TYPES, note.type) || !Object.hasOwn(SECTIONS, note.section) || !Object.hasOwn(KINDS, note.kind)
            || !['pending', 'checked'].includes(note.verification)) throw new Error('Συμπλήρωσε εύρημα και έγκυρη ταξινόμηση.');
        if (note.url) note.url = safeURL(note.url);
        if (note.sourceDate && !isoDate(note.sourceDate)) throw new Error('Η ημερομηνία πηγής χρειάζεται ISO 8601, με ζώνη ώρας όταν περιλαμβάνει ώρα.');
        if ((note.type === 'unverified' || note.section === 'unverified') && note.verification === 'checked') throw new Error('Ένας μη επαληθευμένος ισχυρισμός παραμένει μη επαληθευμένος. Επίλεξε κατάλληλη ενότητα και τύπο πριν τον επιβεβαιώσεις.');
        if (note.section === 'facts' && (note.type !== 'fact' || note.verification !== 'checked')) throw new Error('Τα επιβεβαιωμένα γεγονότα απαιτούν αναφερόμενο γεγονός και ρητή επαλήθευση.');
        if (note.verification === 'checked' && (!note.url || !note.sourceTitle.trim() || !note.limitations.trim())) throw new Error('Η επαλήθευση απαιτεί τίτλο πηγής, σύνδεσμο και σημείωση τεκμηρίωσης.');
        if (note.type === 'statistic' && (!note.units.trim() || !note.period.trim() || !note.calculation.trim() || !note.url)) throw new Error('Το υπολογισμένο στατιστικό απαιτεί μονάδα, περίοδο / δείγμα, πηγή, τύπο και αρχικές τιμές.');
        if (note.kind === 'prediction' && note.type !== 'prediction') throw new Error('Η πρόβλεψη χρειάζεται τον τύπο «Πρόβλεψη».');
        if (note.kind === 'odds' && note.verification === 'checked' && (!note.market.trim() || !note.sourceDate.includes('T'))) throw new Error('Η ιστορική απόδοση απαιτεί αγορά, πηγή και χρονοσφραγίδα με ζώνη ώρας.');
        return note;
    }
    function noteText(note) {
        return [note.text, 'Τύπος: ' + TYPES[note.type] + ' · ' + KINDS[note.kind],
            'Έλεγχος συντάκτη: ' + (note.verification === 'checked' ? 'Ρητά επαληθευμένο από τον συντάκτη' : 'Εκκρεμεί'),
            note.sourceTitle && 'Πηγή: ' + note.sourceTitle, note.url, note.sourceDate && 'Ημερομηνία πηγής: ' + note.sourceDate,
            note.event && 'Γεγονός / σκέλος: ' + note.event, note.market && 'Αγορά / επιλογή / εταιρεία: ' + note.market,
            note.units && 'Μονάδες: ' + note.units, note.period && 'Περίοδος / δείγμα: ' + note.period,
            note.calculation && 'Τύπος / αρχικές τιμές: ' + note.calculation, note.limitations && 'Τεκμηρίωση / περιορισμοί: ' + note.limitations,
            note.kind === 'odds' && (!note.url || !note.market || !note.sourceDate.includes('T')) && 'Ελλιπής πηγή αγοράς ή χρονοσφραγίδα: δεν τεκμηριώνει ιστορική τιμή.'].filter(Boolean).join('\n');
    }
    function brief(question, scope, notes) {
        return ['F1 Stories — Ερευνητικό σημειωματάριο', 'Σημειώσεις συνεδρίας · η αξιολόγηση ανήκει στον συντάκτη.',
            '\nΕκδοτικό ερώτημα\n' + (question.trim() || EMPTY), scope && 'Επιλεγμένο πλαίσιο: ' + scope].filter(Boolean)
            .concat(Object.keys(SECTIONS).map(function (key) {
                return '\n' + SECTIONS[key] + '\n' + (notes.filter(function (note) { return note.section === key; }).map(noteText).join('\n\n') || EMPTY);
            })).join('\n') + '\n';
    }

    // Only notebook-owned elements and approved public reads. No editor state or mutation interface.
    function attach(panel, toggle) {
        var notes = [], cache = new Map(), catalog, searchRevision = 0, standingRevision = 0, initialized = false;
        function el(tag, text, className) {
            var node = document.createElement(tag);
            if (text != null) node.textContent = text;
            if (className) node.className = className;
            return node;
        }
        function button(text, action) { var node = el('button', text, 'gb-btn gb-btn-sm'); node.type = 'button'; node.addEventListener('click', action); return node; }
        function field(parent, id, label, tag, options) {
            var wrap = el('div', null, 'gb-field'), caption = el('label', label, 'gb-label');
            var node = el(tag || 'input', null, 'gb-input'); node.id = 'research-' + id; caption.htmlFor = node.id;
            if (options) Object.keys(options).forEach(function (key) { var option = el('option', options[key]); option.value = key; node.appendChild(option); });
            if (node.tagName === 'INPUT') node.maxLength = 2000;
            if (node.tagName === 'TEXTAREA') { node.rows = 3; node.maxLength = 12000; }
            wrap.append(caption, node); parent.appendChild(wrap); return node;
        }
        function detail(title, open) { var node = el('details'); node.open = !!open; node.appendChild(el('summary', title)); panel.appendChild(node); return node; }
        function link(label, href) { var node = el('a', label); node.href = href; node.target = '_blank'; node.rel = 'noopener noreferrer'; return node; }
        async function load(path) {
            var approved = ['/scripts/author/research-catalog.json', '/blog-module/blog-index-data.json', '/standings/standings-cache.json'];
            if (catalog) approved = approved.concat(catalog.rounds.map(function (pair) { return '/standings/rounds/' + pair.join('-') + '.json'; }));
            if (!approved.includes(path)) throw new Error('Μη εγκεκριμένη διαδρομή δεδομένων.');
            if (cache.has(path)) return cache.get(path);
            var controller = new AbortController(), timer = setTimeout(function () { controller.abort(); }, 8000);
            var request = fetch(path, { credentials: 'omit', redirect: 'error', signal: controller.signal, cache: 'no-cache' }).then(async function (response) {
                if (!response.ok) throw new Error('Τα δεδομένα δεν είναι διαθέσιμα (HTTP ' + response.status + '). Δοκίμασε ξανά.');
                var text = await response.text();
                if (text.length > 2000000) throw new Error('Το αρχείο δεδομένων είναι υπερβολικά μεγάλο.');
                return JSON.parse(text);
            }).catch(function (error) { cache.delete(path); throw error; }).finally(function () { clearTimeout(timer); });
            cache.set(path, request); return request;
        }
        var status, question, season, round, articles, standings, tools, noteList, fallback, form, fields = {};
        function message(text) { status.textContent = text; }
        async function copy(text) {
            try { await navigator.clipboard.writeText(text); fallback.hidden = true; message('Αντιγράφηκε μαζί με τις πηγές. Επικόλλησε χειροκίνητα στο άρθρο.'); }
            catch (_) { fallback.hidden = false; fallback.value = text; fallback.focus(); fallback.select(); message('Δεν επιτράπηκε το πρόχειρο. Επίλεξε και αντέγραψε το κείμενο παρακάτω.'); }
        }
        function completeBrief() { return brief(question.value, season.value && round.value ? season.value + ' / γύρος ' + round.value : '', notes); }
        function renderNotes() {
            noteList.replaceChildren();
            Object.keys(SECTIONS).forEach(function (key) {
                var group = el('details'); group.appendChild(el('summary', SECTIONS[key]));
                var found = notes.filter(function (note) { return note.section === key; });
                group.open = found.length > 0;
                if (!found.length) group.appendChild(el('p', EMPTY, 'gb-hint'));
                found.forEach(function (note) {
                    var row = el('div', null, 'gb-research-result'); row.appendChild(el('p', noteText(note), 'gb-research-text'));
                    if (note.url) row.appendChild(link('Άνοιγμα πηγής', note.url));
                    row.append(button('Αντιγραφή ευρήματος', function () { copy(noteText(note)); }), button('Αφαίρεση', function () {
                        notes = notes.filter(function (value) { return value !== note; }); renderNotes(); message('Το εύρημα αφαιρέθηκε.');
                    })); group.appendChild(row);
                }); noteList.appendChild(group);
            });
        }
        async function findArticles() {
            var revision = ++searchRevision, query = question.value.trim(); articles.replaceChildren();
            if (!query) { message('Γράψε θέμα ή λέξεις αναζήτησης.'); question.focus(); return; }
            message('Αναζήτηση στον δημόσιο κατάλογο…');
            try {
                var posts = decodeIndex(await load('/blog-module/blog-index-data.json'));
                if (revision !== searchRevision) return;
                var found = search(posts, query);
                found.forEach(function (hit) {
                    var post = hit.post, row = el('li', null, 'gb-research-result');
                    row.append(el('h3', post.title), el('p', post.categories.map(global.F1S_TAXONOMY.categoryLabel).join(', ') + ' · ' + post.date + ' · ' + post.author, 'gb-hint'),
                        el('p', hit.reason, 'gb-hint'), link('Άνοιγμα άρθρου', post.url), el('p', 'https://f1-stories.gr' + post.url, 'gb-hint'));
                    row.append(button('Αντιγραφή αναφοράς', function () { copy(articleText(post)); })); articles.appendChild(row);
                });
                message(found.length ? found.length + ' εσωτερικές αναφορές. Δεν αποτελούν ανεξάρτητη επαλήθευση.' : 'Δεν βρέθηκαν άρθρα. Δοκίμασε όνομα ή λιγότερες λέξεις.');
            } catch (error) { cache.delete('/blog-module/blog-index-data.json'); if (revision === searchRevision) message('Ο κατάλογος άρθρων δεν φορτώθηκε. ' + error.message); }
        }
        function resetStanding() { ++standingRevision; standings.replaceChildren(); }
        function setRounds() {
            resetStanding(); round.replaceChildren(el('option', 'Επίλεξε γύρο')); round.firstChild.value = '';
            (catalog ? catalog.rounds : []).filter(function (pair) { return String(pair[0]) === season.value; }).forEach(function (pair) {
                var option = el('option', String(pair[1])); option.value = String(pair[1]); round.appendChild(option);
            }); round.disabled = !season.value;
        }
        async function loadStandings() {
            resetStanding();
            if (!catalog || !catalog.rounds.some(function (pair) { return String(pair[0]) === season.value && String(pair[1]) === round.value; })) return;
            var revision = standingRevision, selectedSeason = season.value, selectedRound = round.value;
            var path = '/standings/rounds/' + selectedSeason + '-' + selectedRound + '.json';
            standings.appendChild(el('p', 'Φόρτωση συγκεκριμένου στιγμιοτύπου…', 'gb-hint'));
            try {
                var data = await load(path), rows = snapshot(data, selectedSeason, selectedRound);
                if (revision !== standingRevision) return;
                standings.replaceChildren(el('p', data.raceName + ' · ' + selectedSeason + ' / γύρος ' + selectedRound),
                    el('p', 'Δημιουργία: ' + data.generatedAt, 'gb-hint'), el('p', 'Ανεπίσημη πηγή Jolpica. Ελέγξτε αποφάσεις FIA και τροποποιημένες κατατάξεις.', 'gb-hint is-warn'));
                if (Date.now() - Date.parse(data.generatedAt) > 86400000) standings.appendChild(el('p', 'Παλαιότερο στιγμιότυπο: οι τιμές μπορεί να έχουν τροποποιηθεί. Δεν είναι ζωντανή βαθμολογία.', 'gb-hint is-warn'));
                var picker = field(standings, 'standing-entry', 'Εγγραφή βαθμολογίας', 'select', Object.fromEntries(rows.map(function (row, i) {
                    return [String(i), (row.kind === 'driver' ? 'Οδηγός: ' : 'Κατασκευαστής: ') + row.name];
                })));
                var record = el('p', null, 'gb-research-text'), source = link('Άνοιγμα αρχικής πηγής', rows[0].source);
                function paint() { record.textContent = standingText(rows[+picker.value]); source.href = rows[+picker.value].source; }
                picker.addEventListener('change', paint); paint(); standings.append(record, source, button('Αντιγραφή ευρήματος', function () { copy(standingText(rows[+picker.value])); }));
            } catch (error) {
                cache.delete(path);
                if (revision === standingRevision) standings.replaceChildren(el('p', 'Το επιλεγμένο στιγμιότυπο δεν μπορεί να χρησιμοποιηθεί. ' + error.message + ' Δεν έγινε αντικατάσταση γύρου.', 'gb-hint is-warn'), button('Επανάληψη στιγμιοτύπου', loadStandings));
            }
        }
        async function loadCatalog() {
            try {
                catalog = validateCatalog(await load('/scripts/author/research-catalog.json'));
                season.replaceChildren(el('option', 'Επίλεξε σεζόν')); season.firstChild.value = '';
                Array.from(new Set(catalog.rounds.map(function (pair) { return pair[0]; }))).forEach(function (year) {
                    var option = el('option', String(year)); option.value = String(year); season.appendChild(option);
                });
                setRounds();
                tools.replaceChildren(); catalog.tools.forEach(function (tool) { var row = el('p'); row.append(link(tool.label, safeURL(tool.href)), el('span', ' — ' + TOOL_LIMITS[tool.id])); tools.appendChild(row); });
                message('Διαθέσιμοι γύροι και εργαλεία φορτώθηκαν. Δεν έχει επιλεγεί αυτόματα στιγμιότυπο.');
            } catch (error) { cache.delete('/scripts/author/research-catalog.json'); message('Δεν φορτώθηκαν οι διαθέσιμοι γύροι / εργαλεία. ' + error.message); }
        }
        function initialize() {
            initialized = true;
            var head = el('div', null, 'gb-research-actions'), heading = el('h2', 'Ερευνητικό σημειωματάριο'); heading.id = 'research-heading';
            head.append(heading, button('Κλείσιμο έρευνας', hide)); panel.append(head,
                el('p', 'Μόνο για αυτή τη συνεδρία. Το κλείσιμο διατηρεί τις σημειώσεις· η ανανέωση τις χάνει. Κατέβασέ τες πριν φύγεις. Δεν αποθηκεύονται στα πρόχειρα άρθρων.', 'gb-hint'),
                el('p', 'Αναζήτηση τίτλου, ετικετών, κατηγορίας, συντάκτη και ID. Δεν γίνεται αναζήτηση στο σώμα άρθρων ή απάντηση με AI.', 'gb-hint'));
            status = el('p', '', 'gb-hint'); status.id = 'research-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); panel.appendChild(status);
            question = field(panel, 'question', 'Εκδοτικό ερώτημα / λέξεις αναζήτησης');
            question.addEventListener('input', function () { ++searchRevision; articles.replaceChildren(); });
            panel.appendChild(button('Εύρεση αναφορών', findArticles));
            var searchDetails = detail('Εσωτερικά άρθρα', true); articles = el('ol', null, 'gb-research-results'); searchDetails.appendChild(articles);
            searchDetails.firstChild.after(el('p', 'Οι αντιστοιχίσεις είναι εσωτερικές αναφορές, όχι ανεξάρτητη επαλήθευση ή πρωτογενείς πηγές.', 'gb-hint'));
            var dataDetails = detail('Βαθμολογία συγκεκριμένου γύρου');
            dataDetails.appendChild(el('p', 'Επίλεξε ρητά σεζόν και διαθέσιμο γύρο. Φορτώνεται μόνο το συγκεκριμένο αρχείο, χωρίς αντικατάσταση από το τελευταίο.', 'gb-hint'));
            var scope = el('div', null, 'gb-research-scope'); dataDetails.appendChild(scope);
            season = field(scope, 'season', 'Σεζόν', 'select', { '': 'Επίλεξε σεζόν' }); round = field(scope, 'round', 'Γύρος', 'select', { '': 'Επίλεξε γύρο' }); round.disabled = true;
            season.addEventListener('change', setRounds); round.addEventListener('change', loadStandings);
            dataDetails.appendChild(button('Επανάληψη καταλόγου', loadCatalog)); standings = el('div'); dataDetails.appendChild(standings);
            var toolDetails = detail('Εργαλεία F1 Stories'); tools = el('div', null, 'gb-hint'); toolDetails.appendChild(tools);
            var addDetails = detail('Προσθήκη ευρήματος / πηγής');
            addDetails.appendChild(el('p', 'BetCast, GridCast και AnalystCast είναι σειρές άρθρων. Απόδοση, πρόβλεψη, επίσημο αποτέλεσμα και διακανονισμός καταγράφονται χωριστά. Η πραγματική κατηγορία του άρθρου διατηρείται.', 'gb-hint'));
            form = el('form'); addDetails.appendChild(form);
            fields.text = field(form, 'note-text', 'Κείμενο ευρήματος', 'textarea'); fields.text.required = true;
            fields.section = field(form, 'note-section', 'Ενότητα brief', 'select', SECTIONS); fields.section.value = 'unverified';
            fields.type = field(form, 'note-type', 'Τύπος ευρήματος', 'select', TYPES); fields.type.value = 'unverified';
            fields.kind = field(form, 'note-kind', 'Είδος παρατήρησης', 'select', KINDS);
            fields.verification = field(form, 'note-verification', 'Έλεγχος συντάκτη', 'select', { pending: 'Εκκρεμεί επαλήθευση', checked: 'Το επαλήθευσα με την παρακάτω τεκμηρίωση' });
            [['sourceTitle', 'Τίτλος πηγής'], ['url', 'Σύνδεσμος πηγής (HTTP / HTTPS)'], ['sourceDate', 'Ημερομηνία / ώρα πηγής (ISO 8601)'],
                ['event', 'Γεγονός / σκέλος'], ['market', 'Αγορά / επιλογή / εταιρεία (για αποδόσεις)'], ['units', 'Μονάδες (για στατιστικό)'],
                ['period', 'Περίοδος / δείγμα (για στατιστικό)'], ['calculation', 'Τύπος και αρχικές τιμές (για στατιστικό)']].forEach(function (pair) { fields[pair[0]] = field(form, 'note-' + pair[0], pair[1]); });
            fields.sourceDate.placeholder = '2026-10-22 ή 2026-10-22T14:00:00+03:00';
            fields.limitations = field(form, 'note-limitations', 'Τεκμηρίωση ελέγχου / σημειώσεις / περιορισμοί', 'textarea');
            var submit = el('button', 'Προσθήκη σημείωσης', 'gb-btn gb-btn-sm'); submit.type = 'submit'; form.appendChild(submit);
            var formStatus = el('p', '', 'gb-hint is-warn'); formStatus.setAttribute('role', 'status'); form.appendChild(formStatus);
            form.addEventListener('submit', function (event) {
                event.preventDefault();
                try {
                    var note = {}; Object.keys(fields).forEach(function (key) { note[key] = fields[key].value.trim(); });
                    notes.push(validateNote(note)); renderNotes(); form.reset(); fields.type.value = 'unverified'; fields.section.value = 'unverified';
                    formStatus.textContent = 'Η σημείωση προστέθηκε μόνο στο σημειωματάριο.';
                } catch (error) { formStatus.textContent = error.message; }
            });
            noteList = el('div'); panel.appendChild(noteList); renderNotes();
            var actions = el('div', null, 'gb-research-actions'); actions.append(button('Αντιγραφή brief', function () { copy(completeBrief()); }),
                button('Λήψη σημειώσεων', function () {
                    var url = URL.createObjectURL(new Blob([completeBrief()], { type: 'text/plain;charset=utf-8' })), download = el('a');
                    download.href = url; download.download = 'brief.txt'; panel.appendChild(download); download.click(); download.remove();
                    setTimeout(function () { URL.revokeObjectURL(url); }, 1000); message('Έγινε λήψη του brief.txt σε UTF-8.');
                }), button('Καθαρισμός σημειωματαρίου', async function () {
                    var hasNotes = notes.length || question.value.trim() || Object.keys(fields).some(function (key) { return ['INPUT', 'TEXTAREA'].includes(fields[key].tagName) && fields[key].value.trim(); });
                    if (hasNotes && !(await global.F1S_AUTHOR_DIALOGS.confirm('Να διαγραφούν οι σημειώσεις αυτής της συνεδρίας;', { title: 'Καθαρισμός έρευνας', okLabel: 'Καθαρισμός' }))) return;
                    ++searchRevision; resetStanding(); notes = []; question.value = ''; season.value = ''; setRounds(); form.reset(); fields.type.value = 'unverified'; fields.section.value = 'unverified';
                    articles.replaceChildren(); fallback.value = ''; fallback.hidden = true; formStatus.textContent = ''; renderNotes(); message('Το σημειωματάριο καθαρίστηκε.'); question.focus();
                })); panel.appendChild(actions);
            var fallbackLabel = el('label', 'Κείμενο για χειροκίνητη αντιγραφή', 'gb-sr'); fallbackLabel.htmlFor = 'research-copy-fallback';
            fallback = el('textarea', null, 'gb-input'); fallback.id = 'research-copy-fallback'; fallback.readOnly = true; fallback.hidden = true; fallback.rows = 8; panel.append(fallbackLabel, fallback);
            panel.addEventListener('keydown', function (event) { if (event.key === 'Escape') { event.preventDefault(); hide(); } });
        }
        function hide() { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); }
        toggle.addEventListener('click', function () {
            if (!panel.hidden) { hide(); return; }
            if (!initialized) initialize();
            panel.hidden = false; toggle.setAttribute('aria-expanded', 'true'); question.focus();
            if (!catalog) loadCatalog();
        });
    }
    global.F1S_RESEARCH = { safeURL: safeURL, decodeIndex: decodeIndex, search: search, validateCatalog: validateCatalog,
        snapshot: snapshot, standingText: standingText, validateNote: validateNote, noteText: noteText, brief: brief };
    var panel = typeof document !== 'undefined' && document.getElementById('research-notebook');
    if (panel) attach(panel, document.getElementById('research-toggle'));
})(window);
