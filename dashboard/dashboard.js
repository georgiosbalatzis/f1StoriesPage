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

    // Hybrid area + column chart. The area is context, not a second metric; exact counts stay in the data table.
    // One bar per actual GA4 export day, so even a 1-day window renders without invented history.
    function activityChart(target, rows) {
        var width = 560, height = 180, slotWidth = width / rows.length, barWidth = Math.min(slotWidth - 3, 24);
        var max = Math.max.apply(null, rows.map(function (row) { return row.page_view_events; }).concat(1));
        var chart = shape('svg', { viewBox: '0 0 ' + width + ' ' + (height + 30), role: 'img',
            'aria-label': 'Ημερήσιες προβολές σελίδας, ' + day(rows[0].event_day) + ' έως ' + day(rows[rows.length - 1].event_day) + ', μέγιστο ' + integer.format(max) });
        for (var k = 1; k <= 4; k++) {
            var y = (height * k / 4).toFixed(1);
            chart.appendChild(shape('line', { x1: 0, x2: width, y1: y, y2: y, class: 'dash-chart-grid' }));
        }
        var points = rows.map(function (row, i) {
            return [((i + 0.5) * slotWidth).toFixed(2), (height - row.page_view_events / max * (height - 9)).toFixed(2)];
        });
        var line = points.map(function (point, i) { return (i ? 'L' : 'M') + point.join(' '); }).join(' ');
        chart.appendChild(shape('path', { d: 'M ' + points[0][0] + ' ' + height + ' L ' + points.map(function (p) { return p.join(' '); }).join(' L ') + ' L ' + points[points.length - 1][0] + ' ' + height + ' Z', class: 'dash-chart-area', 'aria-hidden': 'true' }));
        rows.forEach(function (row, i) {
            var barHeight = Math.max(row.page_view_events ? 2 : 0, Math.round(row.page_view_events / max * (height - 9)));
            chart.appendChild(shape('rect', { x: (i * slotWidth + (slotWidth - barWidth) / 2).toFixed(1), y: height - barHeight,
                width: Math.max(1, barWidth).toFixed(1), height: barHeight, rx: 2,
                class: row.meets_min_events ? 'dash-bar' : 'dash-bar is-small' },
                day(row.event_day) + ': ' + integer.format(row.page_view_events) + ' προβολές' + (row.meets_min_events ? '' : ' (μικρό δείγμα)')));
        });
        chart.appendChild(shape('path', { d: line, class: 'dash-chart-line', 'aria-hidden': 'true' }));
        chart.appendChild(shape('line', { x1: 0, x2: width, y1: height + 0.5, y2: height + 0.5, class: 'dash-axis' }));
        [[0, 'start'], [rows.length - 1, 'end']].forEach(function (end) {
            chart.appendChild(shape('text', { x: end[1] === 'start' ? 0 : width, y: height + 20, 'text-anchor': end[1], class: 'dash-tick' })).textContent = day(rows[end[0]].event_day);
        });
        chart.appendChild(shape('text', { x: 0, y: 13, class: 'dash-tick dash-chart-top' })).textContent = 'Μέγ. ' + integer.format(max) + ' page_view';
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

    // Data-derived executive overview: events, never users or inferred sessions.
    function overview(target, rows, min) {
        var total = rows.reduce(function (sum, row) { return sum + row.page_view_events; }, 0);
        var week = rows.slice(-7).reduce(function (sum, row) { return sum + row.page_view_events; }, 0);
        var sessionEvents = rows.reduce(function (sum, row) { return sum + row.session_start_events; }, 0);
        var activeDays = rows.filter(function (row) { return row.page_view_events > 0; }).length;
        [
            ['PAGE VIEWS', total, 'Γεγονότα προβολής στο πλήρες παράθυρο', total >= min],
            ['LAST ' + Math.min(rows.length, 7) + ' DAYS', week, 'Page views στο πρόσφατο διάστημα', week >= min],
            ['SESSION STARTS', sessionEvents, 'Γεγονότα session_start, όχι συνεδρίες', sessionEvents >= min],
            ['ACTIVE DAYS', activeDays + ' / ' + rows.length, 'Ημέρες με τουλάχιστον ένα page_view', null]
        ].forEach(function (metric, index) {
            var card = target.appendChild(node('article', undefined, 'dash-metric dash-metric-' + index));
            card.appendChild(node('p', metric[0], 'dash-metric-label'));
            card.appendChild(node('p', typeof metric[1] === 'number' ? integer.format(metric[1]) : metric[1], 'dash-metric-value'));
            card.appendChild(node('p', metric[2], 'dash-metric-detail'));
            if (metric[3] === false) card.appendChild(node('span', 'Μικρό δείγμα', 'dash-metric-sample'));
        });
    }

    // Ranked horizontal tracks use SVG widths, never inline style attributes (CSP style-src-attr 'none').
    // Absolute event counts remain first-class; normalized bars do not imply a conversion or audience share.
    function rankings(target, rows, count, label, value, adequate, empty) {
        if (!Array.isArray(rows) || !rows.length) {
            target.appendChild(node('p', empty || 'Δεν υπάρχουν ακόμη μετρήσεις.', 'dash-copy'));
            return;
        }
        var ranked = rows.slice().sort(function (a, b) { return value(b) - value(a) || label(a).localeCompare(label(b), 'el'); }).slice(0, count);
        var max = Math.max.apply(null, ranked.map(value).concat(1));
        var list = target.appendChild(node('ol', undefined, 'dash-ranking-list'));
        ranked.forEach(function (row, i) {
            var item = list.appendChild(node('li', undefined, 'dash-ranking-item' + (adequate(row) ? '' : ' is-small')));
            item.appendChild(node('span', String(i + 1).padStart(2, '0'), 'dash-ranking-index'));
            var content = item.appendChild(node('div', undefined, 'dash-ranking-content'));
            var meta = content.appendChild(node('div', undefined, 'dash-ranking-meta'));
            meta.appendChild(node('span', label(row), 'dash-ranking-name'));
            meta.appendChild(node('strong', integer.format(value(row)), 'dash-ranking-count'));
            var track = content.appendChild(shape('svg', { viewBox: '0 0 100 6', preserveAspectRatio: 'none',
                'aria-hidden': 'true', class: 'dash-ranking-track' }));
            track.appendChild(shape('rect', { x: 0, y: 0, width: 100, height: 6, rx: 3, class: 'dash-ranking-rail' }));
            track.appendChild(shape('rect', { x: 0, y: 0, width: Math.max(value(row) ? 1 : 0, value(row) / max * 100).toFixed(2),
                height: 6, rx: 3, class: 'dash-ranking-fill' }));
            if (!adequate(row)) content.appendChild(node('span', 'μικρό δείγμα', 'dash-ranking-note'));
        });
    }

    // One consistent, explicitly named RUM cohort; other cohorts remain in the exact data table.
    // No performance grade is claimed below the original observation threshold.
    function vitalCards(target, rows) {
        var cohort = rows.filter(function (r) { return r.core_web_vital && r.coverage === 'delayed_existing'; });
        if (!cohort.length) {
            target.appendChild(node('p', 'Δεν υπάρχουν ακόμη μετρήσεις για την κλάση delayed_existing.', 'dash-copy'));
            return;
        }
        var limits = { LCP: '≤ 2.500 ms', INP: '≤ 200 ms', CLS: '≤ 0,1' };
        ['LCP', 'INP', 'CLS'].forEach(function (name) {
            var row = cohort.find(function (item) { return item.metric === name; });
            if (!row) return;
            var card = target.appendChild(node('article', undefined, 'dash-vital'));
            card.appendChild(node('span', name, 'dash-vital-name'));
            card.appendChild(node('p', p75(row), 'dash-vital-value'));
            card.appendChild(node('p', 'p75 · ' + integer.format(row.observations) + ' παρατηρήσεις', 'dash-vital-meta'));
            card.appendChild(node('p', 'Όριο καλής απόδοσης: ' + limits[name], 'dash-vital-limit'));
            card.appendChild(node('span', sample(row.meets_min_observations), row.meets_min_observations ? 'dash-vital-sample' : 'dash-vital-sample is-low'));
        });
        target.appendChild(node('p', 'Μόνο η κλάση delayed_existing · οι υπόλοιπες κλάσεις βρίσκονται στον αναλυτικό πίνακα.', 'dash-vital-footnote'));
    }

    // Greek names for the models' own classes (13 source_surface, 28 classify_path, link_section_class). The raw
    // class always stays visible, and an unlisted value is shown as is, never renamed or dropped.
    var CLASS_NAMES = {
        home: 'Αρχική', article: 'Άρθρο', edition: 'Έκδοση / αρχείο', entity_hub: 'Σελίδα οντότητας', authors: 'Συντάκτες',
        standings: 'Βαθμολογίες', legal: 'Νομικά', author_tool: 'Εργαλείο συντακτών', missing: 'Χωρίς διαδρομή',
        other: 'Άλλο / μη αναγνωρισμένο', article_link: 'Κάρτες και σύνδεσμοι άρθρων', navigation: 'Μενού πλοήγησης',
        footer: 'Υποσέλιδο', page: 'Άλλος σύνδεσμος σελίδας', cta: 'Κουμπί δράσης', article_share: 'Κοινοποίηση',
        sponsor: 'Χορηγός', social: 'Κοινωνικά δίκτυα', '(none)': 'Χωρίς τιμή'
    };

    function className(value) {
        var text = value === null || value === undefined ? '(none)' : String(value);
        return Object.prototype.hasOwnProperty.call(CLASS_NAMES, text) ? CLASS_NAMES[text] + ' · ' + text : text;
    }

    // Sums click_events per key. Every input row is one disjoint group of events, so sums never double count.
    function clickTotals(rows, keyOf) {
        var groups = new Map();
        rows.forEach(function (row) {
            var key = keyOf(row);
            if (!groups.has(key)) groups.set(key, { row: row, clicks: 0 });
            groups.get(key).clicks += row.click_events;
        });
        return Array.from(groups.values()).sort(function (a, b) {
            return b.clicks - a.clicks || String(keyOf(a.row)).localeCompare(String(keyOf(b.row)), 'el');
        });
    }

    function clickTable(target, rows, columns, minimum, empty) {
        if (!rows.length) return target.appendChild(node('p', empty, 'dash-copy'));
        table(target, columns.concat([
            ['Κλικ', function (g) { return integer.format(g.clicks); }],
            ['Δείγμα', function (g) { return sample(g.clicks >= minimum); }]
        ]), rows);
    }

    // I-06C3: 13-article-discovery and 28-internal-navigation run weekly and are carried in between, so their own as_of
    // day is shown. Snapshots from before I-06C3 have neither and show a pending state.
    function renderDiscovery(header, payload) {
        var models = payload.models, minimum = payload.minEvents;
        var discovery = models['13-article-discovery'], navigation = models['28-internal-navigation'];
        var none = 'Δεν καταγράφηκαν κλικ στην περίοδο. Αυτό δεν αποδεικνύει ότι δεν έγιναν (συναίνεση, καταγραφή).';
        var targets = ['discovery-surfaces', 'discovery-sections', 'discovery-articles', 'discovery-transitions'].map(function (name) {
            return slot('table', name);
        });
        if (!Array.isArray(discovery) || !Array.isArray(navigation)) {
            field('discovery-window').textContent = 'σε αναμονή';
            field('discovery-freshness').textContent = '';
            targets.forEach(function (target) {
                target.appendChild(node('p', 'Η ενότητα ανανεώνεται μία φορά την εβδομάδα και θα εμφανιστεί μετά την επόμενη εβδομαδιαία ενημέρωση.', 'dash-copy'));
            });
            ['discovery-surfaces', 'discovery-sections', 'discovery-articles', 'discovery-transitions'].forEach(function (name) {
                slot('viz', name).appendChild(node('p', 'Δεν υπάρχουν ακόμη δημοσιευμένα στοιχεία εβδομαδιαίας ανακάλυψης.', 'dash-copy'));
            });
            return;
        }
        var scope = payload.modelWindows && payload.modelWindows['13-article-discovery'];
        var asOf = scope && scope.asOf ? scope.asOf : header.asOf;
        var start = scope ? scope.start : header.start, end = scope ? scope.end : header.end;
        var age = Math.round((Date.parse(header.asOf) - Date.parse(asOf)) / 86400000);
        field('discovery-window').textContent = day(start, true) + ' – ' + day(end, true);
        field('discovery-freshness').textContent = 'Εβδομαδιαία ενότητα: ' + (age === 0
            ? 'ανανεώθηκε σε αυτό το στιγμιότυπο.'
            : 'στοιχεία της ενημέρωσης πριν από ' + age + (age === 1 ? ' ημέρα' : ' ημέρες') + '. Ανανεώνεται κάθε 7 ημέρες.');

        var unmapped = discovery.filter(function (r) { return r.destination_article_id === '(unmapped)'; })
            .reduce(function (sum, r) { return sum + r.click_events; }, 0);
        rankings(slot('viz', 'discovery-surfaces'), clickTotals(discovery, function (r) { return r.source_surface; }), 7,
            function (g) { return className(g.row.source_surface); }, function (g) { return g.clicks; },
            function (g) { return g.clicks >= minimum; }, none);
        clickTable(targets[0], clickTotals(discovery, function (r) { return r.source_surface; }),
            [['Επιφάνεια προέλευσης', function (g) { return className(g.row.source_surface); }]], minimum, none);
        if (unmapped) {
            targets[0].appendChild(node('p', integer.format(unmapped) + ' από αυτά τα κλικ οδηγούν σε μη αντιστοιχισμένα άρθρα (εκτός καταλόγου) και δεν μπαίνουν στην κατάταξη άρθρων.', 'dash-copy'));
        }
        rankings(slot('viz', 'discovery-sections'), clickTotals(navigation, function (r) { return r.link_section; }), 7,
            function (g) { return className(g.row.link_section); }, function (g) { return g.clicks; },
            function (g) { return g.clicks >= minimum; }, none);
        clickTable(targets[1], clickTotals(navigation, function (r) { return r.link_section; }),
            [['Στοιχείο (link_section)', function (g) { return className(g.row.link_section); }]], minimum, none);
        rankings(slot('viz', 'discovery-articles'), clickTotals(discovery.filter(function (r) { return r.destination_article_id !== '(unmapped)'; }),
            function (r) { return r.destination_article_id; }), 7, function (g) { return g.row.title || 'Άρθρο χωρίς τίτλο'; },
            function (g) { return g.clicks; }, function (g) { return g.clicks >= minimum; }, none);
        clickTable(targets[2], clickTotals(discovery.filter(function (r) { return r.destination_article_id !== '(unmapped)'; }),
            function (r) { return r.destination_article_id; }).slice(0, 15), [
            ['Άρθρο', function (g) { return g.row.title || 'Άρθρο χωρίς τίτλο'; }],
            ['Κατηγορία', function (g) { return g.row.primary_category || '—'; }]
        ], minimum, none);
        rankings(slot('viz', 'discovery-transitions'), clickTotals(navigation, function (r) { return r.source_section + '\u0000' + r.destination_section; }),
            7, function (g) { return className(g.row.source_section) + ' → ' + className(g.row.destination_section); },
            function (g) { return g.clicks; }, function (g) { return g.clicks >= minimum; }, none);
        clickTable(targets[3], clickTotals(navigation, function (r) { return r.source_section + '\u0000' + r.destination_section; }), [
            ['Από', function (g) { return className(g.row.source_section); }],
            ['Προς', function (g) { return className(g.row.destination_section); }]
        ], minimum, none);
    }

    // On a discovery day the RUM pair is carried from the previous snapshot; its own as_of day and window are shown.
    function carriedNote(name, scope) {
        var target = field(name);
        target.hidden = !(scope && scope.asOf);
        target.textContent = target.hidden ? '' : 'Στοιχεία της προηγούμενης ημερήσιας ενημέρωσης (' + day(scope.start, true) + ' – '
            + day(scope.end, true) + '): σήμερα έτρεξε στη θέση τους η εβδομαδιαία ενότητα ανακάλυψης.';
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
        overview(document.querySelector('[data-metrics]'), activity, payload.minEvents);
        activityChart(slot('chart', 'activity'), activity);
        table(slot('table', 'activity'), [
            ['Ημέρα', function (r) { return day(r.event_day, true); }],
            ['page_view', function (r) { return integer.format(r.page_view_events); }],
            ['session_start', function (r) { return integer.format(r.session_start_events); }],
            ['first_visit', function (r) { return integer.format(r.first_visit_events); }],
            ['Δείγμα', function (r) { return sample(r.meets_min_events); }]
        ], activity);

        // I-06C2: rolling 7-day session-last-click attribution, paired with 29-audience-coverage.
        // Older encrypted snapshots (four or five models) remain valid and show a pending state.
        var acquisitionTarget = slot('table', 'acquisition');
        var acquisitionQuality = slot('list', 'acquisition-quality');
        var acquisition = models['26-acquisition-session'];
        var coverage = models['29-audience-coverage'];
        if (!Array.isArray(acquisition) || !Array.isArray(coverage) || !payload.modelWindows) {
            field('acquisition-window').textContent = 'διαθέσιμο στο επόμενο snapshot';
            acquisitionTarget.appendChild(node('p', 'Τα στοιχεία προέλευσης θα εμφανιστούν με την επόμενη επιτυχημένη ημερήσια ανανέωση.', 'dash-copy'));
            slot('viz', 'acquisition').appendChild(node('p', 'Τα στοιχεία προέλευσης θα εμφανιστούν με την επόμενη επιτυχημένη ημερήσια ανανέωση.', 'dash-copy'));
        } else {
            var scope = payload.modelWindows['26-acquisition-session'];
            // When fewer than seven mature days exist, this pair shares the primary window.
            var start = scope ? scope.start : header.start;
            var end = scope ? scope.end : header.end;
            field('acquisition-window').textContent = day(start, true) + ' – ' + day(end, true);
            var rankedChannels = acquisition.slice().sort(function (a, b) {
                return b.session_start_events - a.session_start_events || String(a.channel_class).localeCompare(String(b.channel_class), 'el');
            });
            if (!rankedChannels.length) {
                acquisitionTarget.appendChild(node('p', 'Δεν υπάρχουν καταγεγραμμένα γεγονότα απόκτησης για την περίοδο.', 'dash-copy'));
                slot('viz', 'acquisition').appendChild(node('p', 'Δεν υπάρχουν καταγεγραμμένα γεγονότα απόκτησης για την περίοδο.', 'dash-copy'));
            } else {
                rankings(slot('viz', 'acquisition'), rankedChannels, 6, function (r) { return r.channel_class + ' · ' + r.source_family; },
                    function (r) { return r.session_start_events; }, function (r) { return r.meets_min_events; });
                table(acquisitionTarget, [
                    ['Κανάλι GA4', function (r) { return r.channel_class; }],
                    ['Πηγή', function (r) { return r.source_family; }],
                    ['session_start', function (r) { return integer.format(r.session_start_events); }],
                    ['page_view', function (r) { return integer.format(r.page_view_events); }],
                    ['Δείγμα', function (r) { return sample(r.meets_min_events); }]
                ], rankedChannels);
            }
            var starts = coverage.filter(function (r) { return r.event_name === 'session_start'; });
            var kept = starts.reduce(function (sum, r) { return sum + r.site_events; }, 0);
            var notAttributed = starts.reduce(function (sum, r) { return sum + r.session_channel_unattributed_or_other; }, 0);
            var quality = [
                [kept >= payload.minEvents, integer.format(kept) + ' consented session_start events στον βασικό ιστότοπο' + (kept < payload.minEvents ? ' — μικρό δείγμα.' : '.')],
                [notAttributed === 0, integer.format(notAttributed) + ' session_start events με μη αποδοθέν ή άλλο κανάλι GA4.']
            ];
            if (!starts.length) {
                acquisitionQuality.appendChild(node('li', 'Προσοχή: λείπει το ποιοτικό δείγμα session_start από το μοντέλο κάλυψης.', 'is-warning'));
            } else {
                quality.forEach(function (item) {
                    acquisitionQuality.appendChild(node('li', (item[0] ? 'OK: ' : 'Προσοχή: ') + item[1], item[0] ? '' : 'is-warning'));
                });
            }
        }

        // I-06C1: existing encrypted snapshots (I-06B) may not yet include article rankings.
        // The old four-model payload remains readable while the next daily snapshot is produced.
        var articleTarget = slot('table', 'articles');
        var articles = models['10-article-pageviews'];
        if (!Array.isArray(articles)) {
            articleTarget.appendChild(node('p', 'Η κατάταξη άρθρων θα εμφανιστεί με το επόμενο ημερήσιο στιγμιότυπο.', 'dash-copy'));
            slot('viz', 'articles').appendChild(node('p', 'Η κατάταξη άρθρων θα εμφανιστεί με το επόμενο ημερήσιο στιγμιότυπο.', 'dash-copy'));
        } else {
            var unmapped = articles.filter(function (r) { return r.article_id === '(unmapped)'; });
            var ranked = articles.filter(function (r) { return r.article_id !== '(unmapped)'; })
                .sort(function (a, b) { return b.page_view_events - a.page_view_events || String(a.title || '').localeCompare(String(b.title || ''), 'el'); })
                .slice(0, 15);
            if (!ranked.length) {
                articleTarget.appendChild(node('p', 'Δεν υπάρχουν ακόμη προβολές σε αναγνωρισμένα άρθρα για την περίοδο.', 'dash-copy'));
                slot('viz', 'articles').appendChild(node('p', 'Δεν υπάρχουν ακόμη προβολές σε αναγνωρισμένα άρθρα για την περίοδο.', 'dash-copy'));
            } else {
                rankings(slot('viz', 'articles'), ranked, 6, function (r) { return r.title || 'Άρθρο χωρίς τίτλο'; },
                    function (r) { return r.page_view_events; }, function (r) { return r.meets_min_events; });
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

        renderDiscovery(header, payload);
        carriedNote('cwv-carried', payload.modelWindows && payload.modelWindows['30-cwv-summary']);
        carriedNote('rum-carried', payload.modelWindows && payload.modelWindows['33-rum-coverage']);

        var categories = models['11-category-pageviews'];
        categoryBars(slot('chart', 'categories'), categories);
        table(slot('table', 'categories'), [
            ['Κατηγορία', function (r) { return r.category; }],
            ['page_view', function (r) { return integer.format(r.page_view_events); }],
            ['Άρθρα με προβολές', function (r) { return integer.format(r.articles_with_events); }],
            ['Άρθρα καταλόγου', function (r) { return integer.format(r.catalog_articles); }],
            ['Δείγμα', function (r) { return sample(r.meets_min_events); }]
        ], categories);

        vitalCards(slot('viz', 'vitals'), models['30-cwv-summary']);
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
        document.querySelectorAll('[data-chart], [data-table], [data-list], [data-viz], [data-metrics]').forEach(function (target) {
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
