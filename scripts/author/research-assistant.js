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
    // Archive lookup for editors: candidates to read, never a judgement that two stories are related.
    // Stories matching more of the query words come first. Within that, a word scores in the most telling field it
    // appears in: headline 6, specific tag 3, excerpt 2, author 1; half that when only the beginning matches (Greek
    // endings: Ουγγαρία / Ουγγαρίας). Labels nearly every story shares (F1, Racing, News, a season) and
    // articles/prepositions never count. The whole phrase in the headline or excerpt adds a bonus. Ties: newer first, then ID.
    var FIELDS = [['title', 'Τίτλος', 6], ['tags', 'Ετικέτες', 3], ['excerpt', 'Περίληψη', 2], ['author', 'Συντάκτης', 1]];
    var GENERIC_TAGS = new Set(['f1', 'formula 1', 'formula1', 'racing', 'news', 'misc', 'random', 'gp', 'grand prix', 'historical', 'history', 'analysis', 'αναλυση']);
    var STOP_WORDS = new Set('ο η το οι τα του τησ των τον την τη στο στη στην στον στα στισ στουσ και σε με για απο να θα δεν που ωσ ενα ενασ μια μιασ the a an of in on at and for to vs'.split(' '));
    var ARTICLE_PATH = /^\/blog-module\/blog-entries\/[^/?#]+\/article\.html$/;
    var fieldCache = new WeakMap();
    function words(text) { return normal(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean); }
    function generic(tag) { var value = normal(tag).trim(); return GENERIC_TAGS.has(value) || /^(?:19|20)\d\d(?: season)?$/.test(value); }
    function postFields(post) {
        if (!fieldCache.has(post)) {
            fieldCache.set(post, { title: words(post.title), excerpt: words(post.excerpt), author: words(post.author),
                tags: [].concat.apply([], (post.tags || []).filter(function (tag) { return !generic(tag); }).map(words)),
                titleText: words(post.title).join(' '), excerptText: words(post.excerpt).join(' ') });
        }
        return fieldCache.get(post);
    }
    // Numbers (years, IDs) and short words match exactly; longer words also by a shared beginning.
    function stemmable(word) { return word.length >= 4 && !/\d/.test(word); }
    function wordMatch(list, token) {
        if (list.includes(token)) return 1;
        return stemmable(token) && list.some(function (word) { return stemmable(word) && (word.startsWith(token) || token.startsWith(word)); }) ? 0.5 : 0;
    }
    // Published stories only: a real day not after today (Athens), on the permanent article route.
    function eligible(posts, today) {
        return posts.filter(function (post) {
            return global.F1S_TAXONOMY.isDay(post.date) && post.date <= today && ARTICLE_PATH.test(post.url)
                && post.url === '/blog-module/blog-entries/' + encodeURIComponent(post.id) + '/article.html';
        });
    }
    var passageCache = new WeakMap();
    function passageWords(passage) {
        if (!passageCache.has(passage)) passageCache.set(passage, words(passage.text));
        return passageCache.get(passage);
    }
    function bodyMatch(list, token, exactOther) {
        if (list.includes(token)) return 1;
        return exactOther && token.length >= 6 && !/\d/.test(token) && list.some(function (word) {
            return word.length >= 6 && !/\d/.test(word) && Math.abs(word.length - token.length) <= 2
                && (word.startsWith(token) || token.startsWith(word));
        }) ? 0.5 : 0;
    }
    function hasLiteral(text, literal) {
        var escaped = literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp('(?<![\\p{L}\\p{N}])(?<!\\d[.,:])' + escaped + '(?![\\p{L}\\p{N}]|[.,:]\\d)', 'u').test(text);
    }
    function passageSnippet(text, tokens) {
        var position = 0, match, re = /[\p{L}\p{N}]+/gu;
        while ((match = re.exec(text))) {
            if (tokens.some(function (token) { return normal(match[0]) === token; })) { position = Array.from(text.slice(0, match.index)).length; break; }
        }
        var chars = Array.from(text), start = Math.max(0, position - 100), end = Math.min(chars.length, start + 238);
        if (end === chars.length) start = Math.max(0, end - 238);
        return (start ? '…' : '') + chars.slice(start, end).join('') + (end < chars.length ? '…' : '');
    }
    function* searchSteps(posts, query, content) {
        var raw = String(query || '').trim(), original = raw.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
        var tokens = [], shown = {};
        original.forEach(function (word) {
            var token = normal(word);
            if (!STOP_WORDS.has(token) && !tokens.includes(token)) { tokens.push(token); shown[token] = word; }
        });
        if (!tokens.length) return [];
        var phrase = tokens.length > 1 ? tokens.join(' ') : '';
        var results = [];
        for (var post of posts) {
            var f = postFields(post), terms = {}, score = 0;
            var exactReason = normal(raw) === normal(post.id) ? 'Ακριβές ID' : words(raw).join(' ') === f.titleText ? 'Ακριβής τίτλος' : '';
            if (exactReason && !content) { results.push({ post: post, matched: tokens.length + 1, score: 1000, terms: {}, reason: exactReason }); yield; continue; }
            var matched = 0, metadataTokens = new Set();
            tokens.forEach(function (token) {
                var best = 0, where = '';
                FIELDS.forEach(function (field) {
                    var value = wordMatch(f[field[0]], token) * field[2];
                    if (value > best) { best = value; where = field[1]; }
                });
                if (best) { matched++; metadataTokens.add(token); score += best; (terms[where] = terms[where] || []).push(shown[token]); }
            });
            if (phrase && (' ' + f.titleText + ' ').includes(' ' + phrase + ' ')) score += 10;
            else if (phrase && (' ' + f.excerptText + ' ').includes(' ' + phrase + ' ')) score += 4;
            var selected = null, article = content && content.get(post.id);
            var literals = raw.match(/\d+(?:[.,:]\d+)+/g) || [];
            if (article) for (var passage of article.passages) {
                var list = passageWords(passage), bodyTerms = [], bodyScore = 0, covered = new Set(metadataTokens);
                var guardedTokens = new Set();
                literals.forEach(function (literal) { if (!hasLiteral(passage.text, literal)) words(literal).forEach(function (token) { guardedTokens.add(token); }); });
                var exactTokens = new Set(tokens.filter(function (token) { return list.includes(token) && !guardedTokens.has(token); }));
                tokens.forEach(function (token) {
                    var guarded = guardedTokens.has(token);
                    var exactOther = exactTokens.size > (exactTokens.has(token) ? 1 : 0);
                    var value = guarded ? 0 : bodyMatch(list, token, exactOther);
                    if (value) { covered.add(token); if (!metadataTokens.has(token)) bodyScore += value; bodyTerms.push(shown[token] + (value === 0.5 ? ' (πρόθεμα)' : '')); }
                });
                if (!bodyTerms.length) { yield; continue; }
                if (phrase && (' ' + list.join(' ') + ' ').includes(' ' + phrase + ' ') && literals.every(function (literal) { return hasLiteral(passage.text, literal); })) bodyScore++;
                bodyScore = Math.min(4, bodyScore);
                var candidate = { passage: passage, matched: covered.size, score: bodyScore, terms: bodyTerms };
                if (!selected || candidate.matched > selected.matched || (candidate.matched === selected.matched && (candidate.score > selected.score
                    || (candidate.score === selected.score && passage.ordinal < selected.passage.ordinal)))) selected = candidate;
                yield;
            }
            if (selected) { matched = selected.matched; score += selected.score; terms['Σώμα'] = selected.terms; }
            if (exactReason) { matched = tokens.length + 1; score = 1000; }
            var reason = FIELDS.map(function (field) { return field[1]; }).concat('Σώμα')
                .filter(function (label) { return terms[label]; }).map(function (label) { return label + ': ' + terms[label].join(', '); }).join(' · ');
            var hit = { post: post, matched: matched, score: score, terms: terms, reason: exactReason ? exactReason + (selected ? ' · Σώμα: ' + selected.terms.join(', ') : '') : reason };
            if (selected) { hit.passage = selected.passage; hit.heading = article.headings[selected.passage.heading]; hit.snippet = passageSnippet(selected.passage.text, tokens); }
            results.push(hit);
            yield;
        }
        return results.filter(function (hit) { return hit.score > 0; }).sort(function (a, b) {
            return b.matched - a.matched || b.score - a.score || String(b.post.date).localeCompare(String(a.post.date)) || String(a.post.id).localeCompare(String(b.post.id));
        }).slice(0, 24);
    }
    function search(posts, query, content) {
        var steps = searchSteps(posts, query, content), step;
        do { step = steps.next(); } while (!step.done);
        return step.value;
    }
    async function searchSliced(posts, query, content, current) {
        var steps = searchSteps(posts, query, content), step;
        while (current()) {
            var deadline = performance.now() + 8;
            do { step = steps.next(); if (step.done) return step.value; } while (performance.now() < deadline);
            await new Promise(function (resolve) { setTimeout(resolve, 0); });
        }
        return null;
    }
    var CONTENT_ROOT = '/scripts/author/research-content/';
    function validateContentManifest(data) {
        if (!data || data.version !== 1 || !/^[a-f0-9]{64}$/.test(data.metadataSha256) || !Array.isArray(data.shards)
            || data.shards.length > 1200 || !data.coverage || !Number.isInteger(data.coverage.eligible) || data.coverage.eligible < 0
            || !Number.isInteger(data.coverage.searchableProse) || data.coverage.searchableProse < 0 || data.coverage.searchableProse > data.coverage.eligible
            || data.coverage.minimumProseCharacters !== 40 || !Array.isArray(data.coverage.excluded)
            || data.coverage.excluded.length !== data.coverage.eligible - data.coverage.searchableProse
            || !data.coverage.excluded.every(function (entry) { return entry && typeof entry.id === 'string' && /^[\p{L}\p{N}_-]+$/u.test(entry.id) && typeof entry.reason === 'string'; })
            || !data.shards.every(function (shard) { return shard && /^\d{4}-(?:0[1-9]|1[0-2])\.json$/.test(shard.file)
                && /^[a-f0-9]{64}$/.test(shard.sha256) && Number.isInteger(shard.articles) && shard.articles >= 0
                && Number.isInteger(shard.passages) && shard.passages >= 0; })
            || new Set(data.shards.map(function (shard) { return shard.file; })).size !== data.shards.length
            || data.shards.reduce(function (sum, shard) { return sum + shard.articles; }, 0) !== data.coverage.eligible) throw new Error('Μη έγκυρος κατάλογος πλήρους κειμένου.');
        return data;
    }
    function validateContentShard(data, descriptor) {
        if (!data || data.version !== 1 || !Array.isArray(data.articles) || data.articles.length !== descriptor.articles
            || new Set(data.articles.map(function (article) { return article && article.id; })).size !== data.articles.length
            || !data.articles.every(function (article) {
                return article && typeof article.id === 'string' && /^[\p{L}\p{N}_-]+$/u.test(article.id)
                    && /^[a-f0-9]{64}$/.test(article.digest) && Array.isArray(article.headings) && Array.isArray(article.passages)
                    && article.headings.every(function (heading) { return heading && typeof heading.text === 'string' && typeof heading.id === 'string'; })
                    && article.passages.every(function (passage) { return passage && ['heading', 'paragraph', 'list-item'].includes(passage.kind)
                        && Number.isInteger(passage.ordinal) && passage.ordinal >= 0 && Number.isInteger(passage.heading)
                        && passage.heading >= -1 && passage.heading < article.headings.length && typeof passage.text === 'string'; });
            }) || data.articles.reduce(function (sum, article) { return sum + article.passages.length; }, 0) !== descriptor.passages) throw new Error('Μη έγκυρο αρχείο πλήρους κειμένου.');
        return data;
    }
    // The author's own phrase as anchor text; the old headline is never substituted for it.
    function markdownLink(anchor, post) {
        var text = String(anchor || '').trim();
        if (!text) throw new Error('Επίλεξε μια φράση στο κείμενό σου ή γράψε τη στο πεδίο «Φράση συνδέσμου».');
        if (/[\[\]\n\r]/.test(text) || text.length > 200) throw new Error('Η φράση συνδέσμου πρέπει να είναι μία γραμμή, έως 200 χαρακτήρες, χωρίς αγκύλες [ ].');
        if (!ARTICLE_PATH.test(post.url)) throw new Error('Το άρθρο δεν έχει έγκυρη διεύθυνση.');
        return '[' + text + '](' + post.url + ')';
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
    var NOTE_FIELDS = ['text', 'section', 'type', 'kind', 'verification', 'sourceTitle', 'url', 'sourceDate', 'event', 'market', 'units', 'period', 'calculation', 'limitations'];
    function blankForm() {
        return { text: '', section: 'unverified', type: 'unverified', kind: 'general', verification: 'pending', sourceTitle: '', url: '', sourceDate: '', event: '', market: '', units: '', period: '', calculation: '', limitations: '' };
    }
    function blankWorkspace() { return { version: 1, question: '', anchor: '', season: '', round: '', notes: [], form: blankForm() }; }
    function plain(value, keys) {
        return value && Object.prototype.toString.call(value) === '[object Object]'
            && (Object.getPrototypeOf(value) === null || Object.getPrototypeOf(Object.getPrototypeOf(value)) === null)
            && Object.keys(value).length === keys.length && keys.every(function (key) { return Object.hasOwn(value, key); });
    }
    function utf8Size(value) {
        var size = 0;
        for (var char of value) { var code = char.codePointAt(0); size += code < 128 ? 1 : code < 2048 ? 2 : code < 65536 ? 3 : 4; }
        return size;
    }
    function validateWorkspace(value) {
        if (value === null) return null;
        function invalid() { throw new Error('Μη έγκυρα δεδομένα σημειωματαρίου.'); }
        if (!plain(value, ['version', 'question', 'anchor', 'season', 'round', 'notes', 'form']) || value.version !== 1
            || typeof value.question !== 'string' || value.question.length > 2000 || typeof value.anchor !== 'string' || value.anchor.length > 200
            || typeof value.season !== 'string' || (value.season && (!/^\d{4}$/.test(value.season) || +value.season < 1950 || +value.season > 2100))
            || typeof value.round !== 'string' || (value.round && (!value.season || !/^(?:[1-9]|[12]\d|30)$/.test(value.round)))
            || !Array.isArray(value.notes) || value.notes.length > 500 || utf8Size(JSON.stringify({ format: 'f1stories-research', version: 1, research: value })) > 2 * 1024 * 1024) invalid();
        function fields(input, completed) {
            if (!plain(input, NOTE_FIELDS)) invalid();
            var output = {};
            NOTE_FIELDS.forEach(function (key) {
                var limit = key === 'text' || key === 'limitations' ? 12000 : 2000;
                if (typeof input[key] !== 'string' || input[key].length > limit) invalid();
                output[key] = input[key];
            });
            if (!Object.hasOwn(SECTIONS, output.section) || !Object.hasOwn(TYPES, output.type) || !Object.hasOwn(KINDS, output.kind)
                || !['pending', 'checked'].includes(output.verification)) invalid();
            if (completed) { try { validateNote(Object.assign({}, output)); } catch (_) { invalid(); } }
            return output;
        }
        var result = { version: 1, question: value.question, anchor: value.anchor, season: value.season, round: value.round,
            // Array.from, not map: a hole in a damaged stored array becomes undefined and fails, instead of being skipped.
            notes: Array.from(value.notes, function (note) { return fields(note, true); }), form: fields(value.form, false) };
        return JSON.stringify(result) === JSON.stringify(blankWorkspace()) ? null : result;
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
    function attach(panel, toggle, archive) {
        // decoded: the eligible posts of each loaded index, so repeated searches rank without decoding again.
        var notes = [], cache = new Map(), decoded = new WeakMap(), hashes = new WeakMap(), catalog, contentManifest, searchRevision = 0, standingRevision = 0, initialized = false;
        var state = blankWorkspace(), epoch = 0, listeners = [], exportButton;
        function snapshotWorkspace() {
            if (initialized) {
                state.question = question.value; state.anchor = anchor.value; state.season = season.value; state.round = round.value;
                state.notes = notes; Object.keys(fields).forEach(function (key) { state.form[key] = fields[key].value; });
            }
            var copy = JSON.parse(JSON.stringify(state));
            return JSON.stringify(copy) === JSON.stringify(blankWorkspace()) ? null : copy;
        }
        function changed() {
            try { if (exportButton) exportButton.disabled = !snapshotWorkspace(); listeners.slice().forEach(function (fn) { fn(); }); }
            catch (_) { if (exportButton) exportButton.disabled = true; message('Το σημειωματάριο είναι υπερβολικά μεγάλο ή μη έγκυρο.'); }
        }
        function selectValue(node, value) {
            if (value && !Array.from(node.options).some(function (option) { return option.value === value; })) {
                var option = el('option', value + ' (μη διαθέσιμο)'); option.value = value; node.appendChild(option);
            }
            node.value = value;
        }
        function paintState() {
            question.value = state.question; anchor.value = state.anchor;
            selectValue(season, state.season); setRounds(state.round);
            notes = state.notes; Object.keys(fields).forEach(function (key) { fields[key].value = state.form[key]; });
            hits = []; articles.replaceChildren(); more.hidden = true; standings.replaceChildren();
            fallback.value = ''; fallback.hidden = true; status.textContent = ''; formStatus.textContent = ''; renderNotes();
            if (exportButton) exportButton.disabled = !snapshotWorkspace();
        }
        function hydrate(value) {
            var validated = validateWorkspace(value);
            ++epoch; ++searchRevision; ++standingRevision; state = validated || blankWorkspace(); notes = state.notes;
            if (initialized) paintState();
        }
        global.F1S_RESEARCH_NOTEBOOK = { snapshot: snapshotWorkspace, hydrate: hydrate, clear: function () {
            var had = snapshotWorkspace(); hydrate(null); if (had) changed();
        }, onChange: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (item) { return item !== fn; }); }; } };
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
            var approved = ['/scripts/author/research-catalog.json', CONTENT_ROOT + 'manifest.json', '/blog-module/blog-index-data.json', '/standings/standings-cache.json'];
            if (contentManifest) approved = approved.concat(contentManifest.shards.map(function (shard) { return CONTENT_ROOT + shard.file; }));
            if (catalog) approved = approved.concat(catalog.rounds.map(function (pair) { return '/standings/rounds/' + pair.join('-') + '.json'; }));
            if (!approved.includes(path)) throw new Error('Μη εγκεκριμένη διαδρομή δεδομένων.');
            if (cache.has(path)) return cache.get(path);
            var controller = new AbortController(), timer = setTimeout(function () { controller.abort(); }, 8000);
            var request = fetch(path, { credentials: 'omit', redirect: 'error', signal: controller.signal, cache: 'no-cache' }).then(async function (response) {
                if (!response.ok) throw new Error('Τα δεδομένα δεν είναι διαθέσιμα (HTTP ' + response.status + '). Δοκίμασε ξανά.');
                var text = await response.text();
                if (text.length > 2000000) throw new Error('Το αρχείο δεδομένων είναι υπερβολικά μεγάλο.');
                var data = JSON.parse(text);
                if (path === '/blog-module/blog-index-data.json' || path.startsWith(CONTENT_ROOT) && path !== CONTENT_ROOT + 'manifest.json') hashes.set(data, global.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (bytes) { return Array.from(new Uint8Array(bytes), function (b) { return b.toString(16).padStart(2, '0'); }).join(''); }));
                return data;
            }).catch(function (error) { cache.delete(path); throw error; }).finally(function () { clearTimeout(timer); });
            cache.set(path, request); return request;
        }
        var catalogNote = '', status, question, anchor, season, round, articles, more, standings, tools, noteList, fallback, form, formStatus, fields = {}, hits = [], opener = toggle;
        function message(text) { status.textContent = text; }
        // note: an optional line beside the button, so the outcome is visible where the author clicked.
        async function copy(text, done, note) {
            var copyEpoch = epoch;
            done = done || 'Αντιγράφηκε μαζί με τις πηγές. Επικόλλησε χειροκίνητα στο άρθρο.';
            try { await navigator.clipboard.writeText(text); if (copyEpoch !== epoch) return; fallback.hidden = true; message(done); if (note) note.textContent = done; }
            catch (_) {
                if (copyEpoch !== epoch) return;
                fallback.hidden = false; fallback.value = text; fallback.focus(); fallback.select(); message('Δεν επιτράπηκε το πρόχειρο. Επίλεξε και αντέγραψε το κείμενο παρακάτω.');
                if (note) note.textContent = 'Δεν επιτράπηκε το πρόχειρο: το κείμενο είναι επιλεγμένο στο πεδίο χειροκίνητης αντιγραφής.';
            }
        }
        // Read-only: the phrase selected in the article body, offered as anchor text. The body is never written here.
        function selectedPhrase() {
            var body = document.getElementById('gen-content');
            return body ? body.value.slice(body.selectionStart, body.selectionEnd).trim() : '';
        }
        function copyMarkdown(post, note) {
            var phrase = anchor.value.trim() || selectedPhrase();
            try {
                var text = markdownLink(phrase, post);
                copy(text, 'Αντιγράφηκε: ' + text + ' — επικόλλησε τον σύνδεσμο στη θέση της φράσης. Το κείμενο του άρθρου δεν άλλαξε.', note);
            } catch (error) { message(error.message); note.textContent = error.message; anchor.focus(); }
        }
        function renderHits() {
            var start = articles.children.length;
            hits.slice(start, start + 8).forEach(function (hit) {
                var post = hit.post, row = el('li', null, 'gb-research-result'), note = el('p', '', 'gb-hint');
                row.append(el('h3', post.title), el('p', post.categories.map(global.F1S_TAXONOMY.categoryLabel).join(', ') + ' · ' + post.date + ' · ' + post.author, 'gb-hint'),
                    el('p', post.excerpt), el('p', 'Ταιριάζει σε: ' + hit.reason, 'gb-hint'),
                    link('Άνοιγμα άρθρου', post.url), el('p', post.url, 'gb-hint'),
                    button('Αντιγραφή URL', function () { copy(post.url, 'Αντιγράφηκε η διεύθυνση ' + post.url + '. Επικόλλησε τη μέσα σε [φράση](…).', note); }),
                    button('Αντιγραφή συνδέσμου Markdown', function () { copyMarkdown(post, note); }),
                    button('Αντιγραφή αναφοράς', function () { copy(articleText(post), null, note); }), note);
                if (hit.passage) {
                    var locator = hit.heading ? hit.heading.text : 'Παράγραφος ' + (hit.passage.ordinal + 1);
                    var label = el('p', 'Απόσπασμα · ', 'gb-hint');
                    if (hit.heading && hit.heading.id) label.appendChild(link(locator, post.url + '#' + encodeURIComponent(hit.heading.id)));
                    else label.appendChild(document.createTextNode(locator));
                    var before = row.querySelector('a'); row.insertBefore(label, before); row.insertBefore(el('p', hit.snippet, 'gb-research-passage'), before);
                }
                articles.appendChild(row);
            });
            var left = hits.length - articles.children.length;
            more.hidden = left <= 0; more.textContent = 'Περισσότερα αποτελέσματα (' + left + ')';
            if (start && articles.children[start]) articles.children[start].querySelector('a[href$="/article.html"]').focus();
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
                        notes = notes.filter(function (value) { return value !== note; }); renderNotes(); changed(); message('Το εύρημα αφαιρέθηκε.');
                    })); group.appendChild(row);
                }); noteList.appendChild(group);
            });
        }
        async function findArticles() {
            var revision = ++searchRevision, query = question.value.trim(); hits = []; articles.replaceChildren(); more.hidden = true;
            if (!query) { message('Γράψε θέμα ή λέξεις αναζήτησης.'); question.focus(); return; }
            message('Αναζήτηση στον δημόσιο κατάλογο…');
            try {
                var index = await load('/blog-module/blog-index-data.json');
                if (!decoded.has(index)) decoded.set(index, eligible(decodeIndex(index), global.F1S_TAXONOMY.athensDay()));
                var posts = decoded.get(index), allowed = new Set(posts.map(function (post) { return post.id; }));
                if (revision !== searchRevision) return;
                var content = new Map(), failed = 0, completed = 0, manifest;
                try {
                    manifest = validateContentManifest(await load(CONTENT_ROOT + 'manifest.json'));
                    if (await hashes.get(index) !== manifest.metadataSha256) { cache.delete('/blog-module/blog-index-data.json'); throw new Error('Οι εκδόσεις καταλόγου και κειμένου διαφέρουν.'); }
                    contentManifest = manifest;
                    var cursor = 0;
                    async function worker() {
                        while (cursor < manifest.shards.length && revision === searchRevision) {
                            var descriptor = manifest.shards[cursor++], path = CONTENT_ROOT + descriptor.file;
                            try {
                                var shard = await load(path);
                                if (await hashes.get(shard) !== descriptor.sha256) { cache.delete(CONTENT_ROOT + 'manifest.json'); throw new Error('Το αρχείο δεν συμφωνεί με τον κατάλογο.'); }
                                validateContentShard(shard, descriptor);
                                shard.articles.forEach(function (article) { if (allowed.has(article.id)) content.set(article.id, article); });
                                completed++;
                            } catch (_) { cache.delete(path); failed++; }
                            if (revision === searchRevision) message('Φόρτωση κειμένου: ' + completed + '/' + manifest.shards.length + ' αρχεία.');
                        }
                    }
                    await Promise.all(Array.from({ length: Math.min(4, manifest.shards.length) }, worker));
                } catch (_) { cache.delete(CONTENT_ROOT + 'manifest.json'); contentManifest = null; failed++; }
                if (revision !== searchRevision) return;
                var found = await searchSliced(posts, query, content, function () { return revision === searchRevision; });
                if (revision !== searchRevision) return;
                hits = found; renderHits();
                var coverage = manifest ? ' Κάλυψη κειμένου: ' + completed + '/' + manifest.shards.length + ' αρχεία. Στον κατάλογο: ' + manifest.coverage.searchableProse + '/' + manifest.coverage.eligible + ' άρθρα με πρόζα τουλάχιστον 40 χαρακτήρων.' : ' Το πλήρες κείμενο δεν φορτώθηκε.';
                if (failed) coverage += ' Μερική κάλυψη: πάτησε ξανά «Εύρεση αναφορών» για επανάληψη.';
                message((hits.length ? hits.length + ' άρθρα προς έλεγχο: διάβασέ τα πριν τα συνδέσεις. Δεν αποτελούν ανεξάρτητη επαλήθευση.' : 'Δεν βρέθηκαν άρθρα. Δοκίμασε όνομα ή λιγότερες λέξεις.') + coverage);
            } catch (error) { cache.delete('/blog-module/blog-index-data.json'); if (revision === searchRevision) message('Ο κατάλογος άρθρων δεν φορτώθηκε. ' + error.message); }
        }
        function resetStanding() { ++standingRevision; standings.replaceChildren(); }
        function setRounds(selected) {
            resetStanding(); round.replaceChildren(el('option', 'Επίλεξε γύρο')); round.firstChild.value = '';
            (catalog ? catalog.rounds : []).filter(function (pair) { return String(pair[0]) === season.value; }).forEach(function (pair) {
                var option = el('option', String(pair[1])); option.value = String(pair[1]); round.appendChild(option);
            }); selectValue(round, selected || ''); round.disabled = !season.value;
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
        async function loadCatalog(event) {
            var catalogEpoch = epoch;
            try {
                var loaded = validateCatalog(await load('/scripts/author/research-catalog.json'));
                if (catalogEpoch !== epoch) return;
                catalog = loaded; var selectedSeason = season.value, selectedRound = round.value;
                season.replaceChildren(el('option', 'Επίλεξε σεζόν')); season.firstChild.value = '';
                Array.from(new Set(catalog.rounds.map(function (pair) { return pair[0]; }))).forEach(function (year) {
                    var option = el('option', String(year)); option.value = String(year); season.appendChild(option);
                });
                selectValue(season, selectedSeason); setRounds(selectedRound);
                tools.replaceChildren(); catalog.tools.forEach(function (tool) { var row = el('p'); row.append(link(tool.label, safeURL(tool.href)), el('span', ' — ' + TOOL_LIMITS[tool.id])); tools.appendChild(row); });
                // The background load on opening never replaces a search message that arrived first; a retry always reports.
                if (event || !status.textContent || status.textContent === catalogNote) catalogMessage('Διαθέσιμοι γύροι και εργαλεία φορτώθηκαν. Δεν έχει επιλεγεί αυτόματα στιγμιότυπο.');
            } catch (error) { cache.delete('/scripts/author/research-catalog.json'); if (catalogEpoch !== epoch) return; catalogMessage('Δεν φορτώθηκαν οι διαθέσιμοι γύροι / εργαλεία. ' + error.message); }
        }
        function catalogMessage(text) { catalogNote = text; message(text); }
        function initialize() {
            initialized = true;
            var head = el('div', null, 'gb-research-actions'), heading = el('h2', 'Ερευνητικό σημειωματάριο'); heading.id = 'research-heading';
            head.append(heading, button('Κλείσιμο έρευνας', hide)); panel.append(head,
                el('p', 'Το σημειωματάριο αποθηκεύεται μαζί με το άρθρο μόνο με “Αποθήκευση ως πρόχειρο”. Δεν γίνεται αυτόματη αποθήκευση. Τα δεδομένα μένουν σε αυτόν τον browser, στην ίδια διεύθυνση ιστοτόπου (origin: πρωτόκολλο, όνομα και θύρα). localhost, 127.0.0.1 και διαφορετικές θύρες έχουν ξεχωριστά πρόχειρα. Δεν συγχρονίζονται μεταξύ συσκευών.', 'gb-hint'),
                el('p', 'Αναζήτηση σε τίτλο, περίληψη, ετικέτες, συντάκτη, ID και κείμενο δημοσιευμένων άρθρων. Γενικές ετικέτες (F1, Racing, News, χρονιά) δεν μετρούν. Πίνακες, εικόνες και ενσωματωμένα εργαλεία δεν αναζητούνται. Δεν δίνεται απάντηση με AI.', 'gb-hint'));
            status = el('p', '', 'gb-hint'); status.id = 'research-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); panel.appendChild(status);
            question = field(panel, 'question', 'Εκδοτικό ερώτημα / λέξεις αναζήτησης');
            question.addEventListener('input', function () { ++searchRevision; hits = []; articles.replaceChildren(); more.hidden = true; });
            question.addEventListener('keydown', function (event) { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); findArticles(); } });
            panel.appendChild(button('Εύρεση αναφορών', findArticles));
            var searchDetails = detail('Εσωτερικά άρθρα', true); articles = el('ol', null, 'gb-research-results');
            searchDetails.append(el('p', 'Σύνδεσε προηγούμενα άρθρα μόνο όταν προσφέρουν ουσιαστικό πλαίσιο. Προτίμησε φυσικές φράσεις μέσα στο κείμενο.', 'gb-hint'));
            anchor = field(searchDetails, 'anchor', 'Φράση συνδέσμου (προαιρετικά)'); anchor.maxLength = 200;
            searchDetails.append(el('p', 'Για σύνδεσμο Markdown χρησιμοποιείται αυτή η φράση ή, αν είναι κενή, ό,τι έχεις επιλέξει στο κείμενο του άρθρου. Ο τίτλος του παλιού άρθρου δεν μπαίνει ποτέ αυτόματα.', 'gb-hint'), articles);
            more = button('Περισσότερα αποτελέσματα', renderHits); more.hidden = true; searchDetails.appendChild(more);
            searchDetails.firstChild.after(el('p', 'Οι αντιστοιχίσεις είναι υποψήφια άρθρα για ανάγνωση, όχι επιβεβαιωμένη σχέση, ανεξάρτητη επαλήθευση ή πρωτογενείς πηγές.', 'gb-hint'));
            var dataDetails = detail('Βαθμολογία συγκεκριμένου γύρου');
            dataDetails.appendChild(el('p', 'Επίλεξε ρητά σεζόν και διαθέσιμο γύρο. Φορτώνεται μόνο το συγκεκριμένο αρχείο, χωρίς αντικατάσταση από το τελευταίο.', 'gb-hint'));
            var scope = el('div', null, 'gb-research-scope'); dataDetails.appendChild(scope);
            season = field(scope, 'season', 'Σεζόν', 'select', { '': 'Επίλεξε σεζόν' }); round = field(scope, 'round', 'Γύρος', 'select', { '': 'Επίλεξε γύρο' }); round.disabled = true;
            season.addEventListener('change', function () { setRounds(''); }); round.addEventListener('change', loadStandings);
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
            formStatus = el('p', '', 'gb-hint is-warn'); formStatus.setAttribute('role', 'status'); form.appendChild(formStatus);
            form.addEventListener('submit', function (event) {
                event.preventDefault();
                try {
                    var note = {}; Object.keys(fields).forEach(function (key) { note[key] = fields[key].value.trim(); });
                    if (notes.length >= 500) throw new Error('Το σημειωματάριο δέχεται έως 500 σημειώσεις.');
                    notes.push(validateNote(note)); renderNotes(); form.reset(); fields.type.value = 'unverified'; fields.section.value = 'unverified'; changed();
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
                    var clearEpoch = epoch;
                    if (snapshotWorkspace() && !(await global.F1S_AUTHOR_DIALOGS.confirm('Να διαγραφούν οι σημειώσεις;', { title: 'Καθαρισμός έρευνας', okLabel: 'Καθαρισμός' }))) return;
                    if (clearEpoch !== epoch) return;
                    global.F1S_RESEARCH_NOTEBOOK.clear(); message('Το σημειωματάριο καθαρίστηκε.'); question.focus();
                })); panel.appendChild(actions);
            var fallbackLabel = el('label', 'Κείμενο για χειροκίνητη αντιγραφή', 'gb-sr'); fallbackLabel.htmlFor = 'research-copy-fallback';
            fallback = el('textarea', null, 'gb-input'); fallback.id = 'research-copy-fallback'; fallback.readOnly = true; fallback.hidden = true; fallback.rows = 8; panel.append(fallbackLabel, fallback);
            exportButton = button('Εξαγωγή έρευνας JSON', function () {
                var data; try { data = validateWorkspace(snapshotWorkspace()); } catch (_) { message('Το σημειωματάριο είναι υπερβολικά μεγάλο ή μη έγκυρο.'); return; } if (!data) return;
                var url = URL.createObjectURL(new Blob([JSON.stringify({ format: 'f1stories-research', version: 1, research: data })], { type: 'application/json' }));
                var download = el('a'); download.href = url; download.download = 'research.json'; panel.appendChild(download); download.click(); download.remove();
                setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
            });
            var input = el('input'); input.type = 'file'; input.accept = '.json,application/json'; input.id = 'research-import'; input.hidden = true;
            var importButton = button('Εισαγωγή έρευνας JSON', function () { input.click(); });
            input.addEventListener('change', async function () {
                var file = input.files && input.files[0], importEpoch = epoch; input.value = ''; if (!file) return;
                try {
                    if (file.size > 2 * 1024 * 1024) throw new Error();
                    var envelope = JSON.parse(await file.text());
                    if (importEpoch !== epoch) return;
                    if (!plain(envelope, ['format', 'version', 'research']) || envelope.format !== 'f1stories-research' || envelope.version !== 1 || envelope.research === null) throw new Error();
                    var value = validateWorkspace(envelope.research);
                    if (snapshotWorkspace() && !(await global.F1S_AUTHOR_DIALOGS.confirm('Να αντικατασταθεί το σημειωματάριο;', { title: 'Εισαγωγή έρευνας', okLabel: 'Αντικατάσταση' }))) return;
                    if (importEpoch !== epoch) return;
                    hydrate(value); changed(); message('Η έρευνα εισήχθη. Αποθήκευσε το πρόχειρο για να διατηρηθεί.');
                } catch (_) { if (importEpoch === epoch) message('Το αρχείο έρευνας δεν είναι έγκυρο ή είναι υπερβολικά μεγάλο.'); }
            });
            actions.append(exportButton, importButton, input);
            [question, anchor, season, round].concat(Object.values(fields)).forEach(function (node) {
                node.addEventListener(node.tagName === 'SELECT' ? 'change' : 'input', changed);
            });
            paintState();
            panel.addEventListener('keydown', function (event) { if (event.key === 'Escape') { event.preventDefault(); hide(); } });
        }
        // Both buttons open the same notebook; focus returns to the one that opened it.
        var openers = [toggle, archive].filter(Boolean);
        function expanded(value) { openers.forEach(function (node) { node.setAttribute('aria-expanded', String(value)); }); }
        function hide() { panel.hidden = true; expanded(false); opener.focus(); }
        openers.forEach(function (node) {
            node.addEventListener('click', function () {
                if (!panel.hidden) { hide(); return; }
                if (!initialized) initialize();
                opener = node; panel.hidden = false; expanded(true); question.focus();
                if (!catalog) loadCatalog();
            });
        });
    }
    global.F1S_RESEARCH = { safeURL: safeURL, decodeIndex: decodeIndex, eligible: eligible, search: search, validateContentManifest: validateContentManifest, validateContentShard: validateContentShard, markdownLink: markdownLink, validateCatalog: validateCatalog,
        validateWorkspace: validateWorkspace, snapshot: snapshot, standingText: standingText, validateNote: validateNote, noteText: noteText, brief: brief };
    var panel = typeof document !== 'undefined' && document.getElementById('research-notebook');
    if (panel) attach(panel, document.getElementById('research-toggle'), document.getElementById('archive-toggle'));
})(window);
