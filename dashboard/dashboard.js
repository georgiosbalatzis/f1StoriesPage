// dashboard.js — /dashboard/ reads one encrypted file from this site and decrypts it locally
// (snapshot-crypto.js). It makes no other request, stores nothing, and builds every node with
// textContent or attributes: snapshot values never pass through an HTML parser.
(function () {
    'use strict';

    var SNAPSHOT_URL = '/dashboard/data/snapshot.json';
    var STALE_MS = 48 * 60 * 60 * 1000; // a daily refresh that missed more than one run
    var SVG = 'http://www.w3.org/2000/svg';
    var panels = document.querySelectorAll('[data-state]');
    var form = document.querySelector('.dash-form');
    var input = document.getElementById('dash-key');
    var keyError = document.querySelector('[data-key-error]');
    var reason = document.querySelector('[data-unavailable-reason]');
    var integer = new Intl.NumberFormat('el-GR');
    var envelope = null;

    function show(state) {
        panels.forEach(function (panel) {
            panel.hidden = panel.getAttribute('data-state') !== state;
        });
    }

    function unavailable(message) {
        reason.textContent = message;
        show('unavailable');
    }

    function node(tag, text, className) {
        var element = document.createElement(tag);
        if (text !== undefined) element.textContent = text;
        if (className) element.className = className;
        return element;
    }

    function shape(tag, attributes, title) {
        var element = document.createElementNS(SVG, tag);
        Object.keys(attributes).forEach(function (name) {
            element.setAttribute(name, attributes[name]);
        });
        if (title) element.appendChild(document.createElementNS(SVG, 'title')).textContent = title;
        return element;
    }

    function field(name) {
        return document.querySelector('[data-field="' + name + '"]');
    }

    function slot(kind, name) {
        return document.querySelector('[data-' + kind + '="' + name + '"]');
    }

    function day(iso, withYear) {
        return new Date(iso + 'T00:00:00Z').toLocaleDateString('el-GR', { timeZone: 'UTC', day: 'numeric', month: 'short', year: withYear ? 'numeric' : undefined });
    }

    function sample(ok) {
        return ok ? 'επαρκές' : 'μικρό δείγμα';
    }

    // columns: [[heading, row => text], …]
    function table(target, columns, rows) {
        var element = node('table');
        var head = element.appendChild(node('thead')).appendChild(node('tr'));
        columns.forEach(function (column) {
            head.appendChild(node('th', column[0])).setAttribute('scope', 'col');
        });
        var body = element.appendChild(node('tbody'));
        rows.forEach(function (row) {
            var tr = body.appendChild(node('tr'));
            columns.forEach(function (column) {
                tr.appendChild(node('td', column[1](row)));
            });
        });
        target.appendChild(element);
    }

    function activityChart(target, rows) {
        var width = 560, height = 180, slotWidth = width / rows.length, barWidth = Math.min(slotWidth - 2, 28);
        var max = Math.max.apply(null, rows.map(function (row) { return row.page_view_events; }).concat(1));
        var chart = shape('svg', { viewBox: '0 0 ' + width + ' ' + (height + 24), role: 'img',
            'aria-label': 'Ημερήσιες προβολές σελίδας, ' + day(rows[0].event_day) + ' έως ' + day(rows[rows.length - 1].event_day) + ', μέγιστο ' + integer.format(max) });
        rows.forEach(function (row, i) {
            var barHeight = Math.max(row.page_view_events ? 2 : 0, Math.round(row.page_view_events / max * height));
            chart.appendChild(shape('rect', { x: (i * slotWidth + (slotWidth - barWidth) / 2).toFixed(1), y: height - barHeight, width: barWidth.toFixed(1), height: barHeight, rx: 2,
                class: row.meets_min_events ? 'dash-bar' : 'dash-bar is-small' },
                day(row.event_day) + ': ' + integer.format(row.page_view_events) + ' προβολές' + (row.meets_min_events ? '' : ' (μικρό δείγμα)')));
        });
        chart.appendChild(shape('line', { x1: 0, x2: width, y1: height + 0.5, y2: height + 0.5, class: 'dash-axis' }));
        [[0, 'start'], [rows.length - 1, 'end']].forEach(function (end) {
            chart.appendChild(shape('text', { x: end[1] === 'start' ? 0 : width, y: height + 18, 'text-anchor': end[1], class: 'dash-tick' })).textContent = day(rows[end[0]].event_day);
        });
        chart.appendChild(shape('text', { x: 0, y: 12, class: 'dash-tick' })).textContent = 'μέγ. ' + integer.format(max);
        target.appendChild(chart);
    }

    function categoryBars(target, rows) {
        var max = Math.max.apply(null, rows.map(function (row) { return row.page_view_events; }).concat(1));
        var list = node('ul', undefined, 'dash-bars');
        rows.forEach(function (row) {
            var item = list.appendChild(node('li', undefined, row.meets_min_events ? '' : 'is-small'));
            item.appendChild(node('span', row.category, 'dash-bars-label'));
            var bar = item.appendChild(shape('svg', { viewBox: '0 0 100 8', preserveAspectRatio: 'none', 'aria-hidden': 'true' }));
            bar.appendChild(shape('rect', { x: 0, y: 0, width: Math.max(row.page_view_events ? 0.5 : 0, row.page_view_events / max * 100).toFixed(2), height: 8, class: 'dash-bar' }));
            item.appendChild(node('span', integer.format(row.page_view_events) + (row.meets_min_events ? '' : ' · μικρό δείγμα'), 'dash-bars-value'));
        });
        target.appendChild(list);
    }

    function p75(row) {
        if (row.p75 === null) return '—';
        return row.metric === 'CLS' ? row.p75.toFixed(3).replace('.', ',') : integer.format(Math.round(row.p75)) + ' ms';
    }

    function percent(share) {
        return share === null ? '—' : Math.round(share * 100) + '%';
    }

    // Data-quality findings from 33-rum-coverage, worded as warnings only when something needs attention.
    function rumChecks(target, rows, minimum) {
        function count(stage, test) {
            return rows.filter(function (row) { return row.stage === stage && test(row.category); })
                .reduce(function (sum, row) { return sum + row.count; }, 0);
        }
        var resolved = count('observations', function (c) { return c === 'resolved'; });
        var conflicts = count('observations', function (c) { return c === 'final_snapshot_conflicting'; });
        var checks = [
            [resolved >= minimum, integer.format(resolved) + ' παρατηρήσεις μετά την επίλυση αναθεωρήσεων' + (resolved >= minimum ? '.' : ': μικρό δείγμα.')],
            [true, integer.format(count('scan_consent', function (c) { return c !== 'Yes'; })) + ' γεγονότα web_vital χωρίς συναίνεση εξαιρέθηκαν.'],
            [conflicts === 0, integer.format(conflicts) + ' παρατηρήσεις με αντικρουόμενα αντίγραφα.'],
            [count('observation_validity', function (c) { return c !== 'valid'; }) === 0,
                integer.format(count('observation_validity', function (c) { return c !== 'valid'; })) + ' άκυρες παρατηρήσεις.'],
            [count('library_rating', function (c) { return c !== 'agrees'; }) === 0,
                integer.format(count('library_rating', function (c) { return c !== 'agrees'; })) + ' διαφωνίες με τη βαθμολογία της βιβλιοθήκης web-vitals.']
        ];
        checks.forEach(function (check) {
            target.appendChild(node('li', (check[0] ? 'OK: ' : 'Προσοχή: ') + check[1], check[0] ? '' : 'is-warning'));
        });
    }

    function render(snapshot) {
        var header = snapshot.header, payload = snapshot.payload, models = payload.models;
        var generated = new Date(header.generatedAt);
        field('end').textContent = day(header.end, true);
        // 1–28 days: fewer while the export (from 19 Oct 2026) is younger than 28 mature days.
        var days = Math.round((Date.parse(header.end) - Date.parse(header.start)) / 86400000) + 1;
        field('window').textContent = (days === 28 ? 'Τελευταίες 28 πλήρεις ημέρες' : days + (days === 1 ? ' πλήρης ημέρα' : ' πλήρεις ημέρες')
            + ', όσες υπάρχουν από την έναρξη της εξαγωγής') + ' · ' + day(header.start, true) + ' – ' + day(header.end, true);
        field('updated').textContent = 'Τελευταία επιτυχής ενημέρωση: ' + generated.toLocaleString('el-GR',
            { timeZone: 'Europe/Athens', dateStyle: 'long', timeStyle: 'short' }) + ' (ώρα Αθήνας).';
        field('timezone').textContent = payload.window.timezone;
        field('min').textContent = String(payload.minEvents);
        var stale = document.querySelector('[data-stale]');
        stale.hidden = Date.now() - generated.getTime() <= STALE_MS;
        stale.textContent = 'Παλιό στιγμιότυπο: η ημερήσια ενημέρωση δεν έχει πετύχει για πάνω από 48 ώρες.';

        var activity = models['20-daily-activity'];
        activityChart(slot('chart', 'activity'), activity);
        table(slot('table', 'activity'), [
            ['Ημέρα', function (r) { return day(r.event_day, true); }],
            ['page_view', function (r) { return integer.format(r.page_view_events); }],
            ['session_start', function (r) { return integer.format(r.session_start_events); }],
            ['first_visit', function (r) { return integer.format(r.first_visit_events); }],
            ['Δείγμα', function (r) { return sample(r.meets_min_events); }]
        ], activity);

        // I-06C1: existing encrypted snapshots (I-06B) may not yet include article rankings.
        // The old four-model payload remains readable while the next daily snapshot is produced.
        var articleTarget = slot('table', 'articles');
        var articles = models['10-article-pageviews'];
        if (!Array.isArray(articles)) {
            articleTarget.appendChild(node('p', 'Η κατάταξη άρθρων θα εμφανιστεί με το επόμενο ημερήσιο στιγμιότυπο.', 'dash-copy'));
        } else {
            var unmapped = articles.filter(function (r) { return r.article_id === '(unmapped)'; });
            var ranked = articles.filter(function (r) { return r.article_id !== '(unmapped)'; })
                .sort(function (a, b) { return b.page_view_events - a.page_view_events || String(a.title || '').localeCompare(String(b.title || ''), 'el'); })
                .slice(0, 15);
            if (!ranked.length) {
                articleTarget.appendChild(node('p', 'Δεν υπάρχουν ακόμη προβολές σε αναγνωρισμένα άρθρα για την περίοδο.', 'dash-copy'));
            } else {
                table(articleTarget, [
                    ['Άρθρο', function (r) { return r.title || 'Άρθρο χωρίς τίτλο'; }],
                    ['Κατηγορία', function (r) { return r.primary_category || '—'; }],
                    ['page_view', function (r) { return integer.format(r.page_view_events); }],
                    ['Ημέρες', function (r) { return integer.format(r.days_with_events); }],
                    ['Δείγμα', function (r) { return sample(r.meets_min_events); }]
                ], ranked);
            }
            var unmappedViews = unmapped.reduce(function (sum, r) { return sum + r.page_view_events; }, 0);
            if (unmappedViews) {
                articleTarget.appendChild(node('p', integer.format(unmappedViews)
                    + ' προβολές σε μη αντιστοιχισμένα άρθρα δεν περιλαμβάνονται στην κατάταξη.', 'dash-copy'));
            }
        }

        var categories = models['11-category-pageviews'];
        categoryBars(slot('chart', 'categories'), categories);
        table(slot('table', 'categories'), [
            ['Κατηγορία', function (r) { return r.category; }],
            ['page_view', function (r) { return integer.format(r.page_view_events); }],
            ['Άρθρα με προβολές', function (r) { return integer.format(r.articles_with_events); }],
            ['Άρθρα καταλόγου', function (r) { return integer.format(r.catalog_articles); }],
            ['Δείγμα', function (r) { return sample(r.meets_min_events); }]
        ], categories);

        table(slot('table', 'cwv'), [
            ['Κάλυψη', function (r) { return r.coverage; }],
            ['Μετρική', function (r) { return r.metric; }],
            ['Παρατηρήσεις', function (r) { return integer.format(r.observations); }],
            ['p75', p75],
            ['Καλές', function (r) { return percent(r.good_share); }],
            ['Δείγμα', function (r) { return sample(r.meets_min_observations); }]
        ], models['30-cwv-summary'].filter(function (row) { return row.core_web_vital; }));

        rumChecks(slot('list', 'rum'), models['33-rum-coverage'], payload.minObservations);
        table(slot('table', 'rum'), [
            ['Στάδιο', function (r) { return r.stage; }],
            ['Κατηγορία', function (r) { return r.category; }],
            ['Πλήθος', function (r) { return integer.format(r.count); }]
        ], models['33-rum-coverage']);
        show('report');
    }

    // Removes every decrypted value from the page; only the encrypted file stays in memory.
    function clear() {
        document.querySelectorAll('[data-chart], [data-table], [data-list]').forEach(function (target) {
            target.replaceChildren();
        });
    }

    function lock() {
        clear();
        show('locked');
        input.focus();
    }

    function keyMessage(message) {
        keyError.textContent = message;
        keyError.hidden = false;
        input.focus();
    }

    // A framed copy could be overlaid to capture the key (meta CSP cannot set frame-ancestors).
    if (window.top !== window.self) return unavailable('Ο πίνακας δεν ανοίγει μέσα σε άλλη σελίδα.');
    if (!window.crypto || !crypto.subtle || !window.F1SSnapshot) return unavailable('Αυτός ο browser δεν υποστηρίζει ασφαλή αποκρυπτογράφηση (Web Crypto).');

    show('loading');
    fetch(SNAPSHOT_URL, { cache: 'no-store', credentials: 'omit' }).then(function (response) {
        if (response.status === 404) return show('empty');
        if (!response.ok) throw new Error('status');
        return response.text().then(function (text) {
            envelope = F1SSnapshot.parseEnvelope(text);
            show('locked');
        });
    }).catch(function () {
        unavailable('Το στιγμιότυπο δεν φορτώθηκε ή δεν είναι έγκυρο. Δοκίμασε ξανά αργότερα.');
    });

    form.addEventListener('submit', function (event) {
        event.preventDefault();
        var key = input.value.trim();
        input.value = '';
        keyError.hidden = true;
        if (!key) return keyMessage('Γράψε το κλειδί αποκρυπτογράφησης.');
        var button = form.querySelector('button');
        button.disabled = true;
        F1SSnapshot.open(envelope, key).then(render).catch(function (error) {
            if (error.code === 'key-format') return keyMessage('Το κλειδί έχει λάθος μορφή: 44 χαρακτήρες base64.');
            if (error.code === 'wrong-key') return keyMessage('Λάθος κλειδί για αυτό το στιγμιότυπο.');
            clear();
            show(error.code === 'tampered' ? 'damaged' : 'unavailable');
        }).then(function () {
            button.disabled = false;
        });
    });

    document.querySelector('[data-lock]').addEventListener('click', lock);
})();
