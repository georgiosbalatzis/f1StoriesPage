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
    var decimal = new Intl.NumberFormat('el-GR', { maximumFractionDigits: 1 });
    var envelope = null;
    // Charts drawn at their real pixel width (so labels keep their size); redrawn on resize, dropped on lock.
    var sized = [];

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

    function label(svg, x, y, text, className, anchor) {
        svg.appendChild(shape('text', { x: x.toFixed(1), y: y.toFixed(1), 'text-anchor': anchor || 'start', class: className || 'dash-tick' })).textContent = text;
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

    function sum(rows, key) {
        return rows.reduce(function (total, row) { return total + row[key]; }, 0);
    }

    function plural(count, one, many) {
        return integer.format(count) + ' ' + (count === 1 ? one : many);
    }

    function lede(name, text) {
        slot('lede', name).textContent = text;
    }

    function pending(name, text) {
        slot('viz', name).appendChild(node('p', text, 'dash-copy'));
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

    // A horizontal bar on a scale that always reaches the sample threshold, with the threshold drawn as a tick:
    // a hollow bar that stops short of the tick is a small sample. Stretched by CSS, so only rectangles and lines.
    function scaleBar(value, max, threshold, className) {
        var bar = shape('svg', { viewBox: '0 0 100 10', preserveAspectRatio: 'none', 'aria-hidden': 'true', class: className });
        bar.appendChild(shape('line', { x1: 0, x2: 100, y1: 9.5, y2: 9.5, class: 'dash-scale-base' }));
        if (value > 0) bar.appendChild(shape('rect', { x: 0, y: 2, width: Math.max(0.8, value / max * 100).toFixed(2), height: 6, class: value < threshold ? 'dash-mark is-small' : 'dash-mark' }));
        var t = (threshold / max * 100).toFixed(2);
        bar.appendChild(shape('line', { x1: t, x2: t, y1: 0, y2: 10, class: 'dash-scale-threshold' }));
        return bar;
    }

    // An editorial classification: position, name (with one meta line), count, and its bar against the threshold.
    // rows: [{ name, meta, value, extra }]; adequacy is the count against the threshold, as in the models.
    function classification(target, rows, options) {
        if (!rows.length) return target.appendChild(node('p', options.empty, 'dash-copy'));
        var threshold = options.threshold;
        var max = Math.max.apply(null, rows.map(function (row) { return row.value; }).concat(threshold));
        var element = target.appendChild(node('table', undefined, 'dash-class-table'));
        element.appendChild(node('caption', options.caption, 'dash-sr'));
        var head = element.appendChild(node('thead')).appendChild(node('tr'));
        [['Θ.', 'dash-class-pos'], [options.nameLabel, 'dash-class-label'], ['', 'dash-class-bar'], [options.valueLabel, 'dash-class-value']]
            .concat(options.extraLabel ? [[options.extraLabel, 'dash-class-extra']] : [])
            .forEach(function (column) { head.appendChild(node('th', column[0], column[1])).setAttribute('scope', 'col'); });
        head.querySelector('.dash-class-bar').appendChild(node('span', 'Κλίμακα έως το όριο δείγματος', 'dash-sr'));
        var body = element.appendChild(node('tbody'));
        rows.forEach(function (row, i) {
            var small = row.value < threshold;
            var tr = body.appendChild(node('tr', undefined, small ? 'is-small' : ''));
            tr.appendChild(node('td', String(i + 1), 'dash-class-pos'));
            var name = tr.appendChild(node('td', undefined, 'dash-class-label'));
            name.appendChild(node('span', row.name, 'dash-class-name'));
            if (row.meta) name.appendChild(node('span', row.meta, 'dash-class-meta'));
            if (options.extraLabel) name.appendChild(node('span', options.extraLabel + ': ' + row.extra, 'dash-class-meta dash-class-extra-inline'));
            name.appendChild(scaleBar(row.value, max, threshold, 'dash-scale dash-scale-inline'));
            tr.appendChild(node('td', undefined, 'dash-class-bar')).appendChild(scaleBar(row.value, max, threshold, 'dash-scale'));
            var value = tr.appendChild(node('td', integer.format(row.value), 'dash-class-value'));
            if (small) value.appendChild(node('span', ' (μικρό δείγμα)', 'dash-sr'));
            if (options.extraLabel) tr.appendChild(node('td', row.extra, 'dash-class-extra'));
        });
        return element;
    }

    // One dot per event in rows of `threshold`, over an empty first row: a count that leaves the first row
    // unfilled is still a small sample. Drawn at a fixed pitch, so a dot always means one event.
    function dotStrip(value, threshold) {
        var pitch = 8, rows = Math.max(1, Math.ceil(value / threshold));
        var strip = shape('svg', { viewBox: '0 0 ' + threshold * pitch + ' ' + rows * pitch, width: threshold * pitch, height: rows * pitch, 'aria-hidden': 'true', class: 'dash-units' });
        for (var i = 0; i < Math.max(value, threshold); i++) {
            strip.appendChild(shape('circle', { cx: (i % threshold + 0.5) * pitch, cy: (Math.floor(i / threshold) + 0.5) * pitch, r: 2.75,
                class: i < value ? 'dash-unit' : 'dash-unit is-empty' }));
        }
        return strip;
    }

    // A ledger of counts for short lists where every count is small: each event is a dot (up to three rows),
    // larger counts fall back to the threshold scale. Counts at or over the threshold are set bold.
    function ledger(target, rows, options) {
        if (!rows.length) return target.appendChild(node('p', options.empty, 'dash-copy'));
        var threshold = options.threshold;
        var max = Math.max.apply(null, rows.map(function (row) { return row.value; }).concat(threshold));
        var dots = max <= threshold * 3;
        var element = target.appendChild(node('table', undefined, 'dash-ledger-table'));
        element.appendChild(node('caption', options.caption, 'dash-sr'));
        var head = element.appendChild(node('thead')).appendChild(node('tr'));
        [[options.nameLabel, ''], [options.valueLabel, 'dash-ledger-value']].concat(options.extraLabel ? [[options.extraLabel, 'dash-ledger-value']] : [])
            .forEach(function (column) { head.appendChild(node('th', column[0], column[1])).setAttribute('scope', 'col'); });
        var body = element.appendChild(node('tbody'));
        rows.forEach(function (row) {
            var small = row.value < threshold;
            var tr = body.appendChild(node('tr', undefined, small ? 'is-small' : 'is-adequate'));
            var name = tr.appendChild(node('td'));
            name.appendChild(node('span', row.name, 'dash-class-name'));
            if (row.meta) name.appendChild(node('span', row.meta, 'dash-class-meta'));
            name.appendChild(dots ? dotStrip(row.value, threshold) : scaleBar(row.value, max, threshold, 'dash-scale dash-ledger-scale'));
            var value = tr.appendChild(node('td', integer.format(row.value), 'dash-ledger-value'));
            if (small) value.appendChild(node('span', ' (μικρό δείγμα)', 'dash-sr'));
            if (options.extraLabel) tr.appendChild(node('td', row.extra, 'dash-ledger-value dash-ledger-extra'));
        });
        var adequate = rows.filter(function (row) { return row.value >= threshold; }).length;
        target.appendChild(node('p', (dots ? 'Κάθε κουκκίδα: ' + options.unit + '· η πρώτη σειρά γεμίζει στις ' + threshold + '. ' : '')
            + (adequate ? 'Με έντονα: τουλάχιστον ' + threshold + '. Οι υπόλοιπες τιμές είναι μικρό δείγμα.'
                : 'Όλες οι τιμές είναι κάτω από ' + threshold + ': μικρό δείγμα, ενδεικτικές μόνο.'), 'dash-aside'));
        return element;
    }

    function drawSized(target, draw) {
        var entry = { target: target, draw: draw };
        sized.push(entry);
        redraw(entry);
    }

    // Height-only resizes (a phone's address bar) keep the drawing, so the chart's reveal does not replay.
    function redraw(entry) {
        var width = Math.max(280, Math.round(entry.target.getBoundingClientRect().width) || 640);
        if (width === entry.width && entry.target.firstChild) return;
        entry.width = width;
        entry.target.replaceChildren();
        entry.draw(entry.target, width);
    }

    // One column per export day on a scale that reaches the sample threshold; a day without page views is an open
    // circle, not a missing bar. Weekends (race weekends) are banded. The only line is the 7-day mean, drawn as a
    // step per day from the seventh day on: nothing is interpolated between raw daily values.
    function activityChart(target, rows, threshold, width) {
        var narrow = width < 520;
        var top = 40, plot = narrow ? 120 : 170, height = top + plot + 30;
        var max = Math.max.apply(null, rows.map(function (row) { return row.page_view_events; }).concat(threshold));
        var peak = rows.reduce(function (best, row) { return row.page_view_events > best.page_view_events ? row : best; }, rows[0]);
        var slotWidth = width / rows.length, barWidth = Math.max(2, Math.min(slotWidth * 0.56, 16));
        var base = top + plot;
        var y = function (value) { return base - value / max * plot; };
        var mean = function (i) { return i < 6 ? null : sum(rows.slice(i - 6, i + 1), 'page_view_events') / 7; };
        var weekend = function (row) { return [0, 6].indexOf(new Date(row.event_day + 'T00:00:00Z').getUTCDay()) >= 0; };
        var chart = target.appendChild(shape('svg', { viewBox: '0 0 ' + width + ' ' + height, width: width, height: height, role: 'img',
            'aria-label': 'Ημερήσιες προβολές σελίδας, ' + day(rows[0].event_day) + ' έως ' + day(rows[rows.length - 1].event_day)
                + ', μέγιστο ' + integer.format(peak.page_view_events) + '. Όριο δείγματος ' + threshold + '.' }));
        rows.forEach(function (row, i) {
            if (weekend(row)) chart.appendChild(shape('rect', { x: (i * slotWidth).toFixed(1), y: top - 6, width: slotWidth.toFixed(1), height: plot + 6, class: 'dash-weekend' }));
        });
        var key = 0;
        if (rows.some(weekend)) {
            chart.appendChild(shape('rect', { x: 0, y: 2, width: 12, height: 12, class: 'dash-weekend' }));
            label(chart, 18, 12, 'Σαββατοκύριακο', 'dash-tick');
            key = 128;
        }
        var thresholdLine = shape('line', { x1: 0, x2: width, y1: y(threshold), y2: y(threshold), class: 'dash-chart-threshold' });
        label(chart, width, y(threshold) - 6, threshold + ' · όριο δείγματος', 'dash-tick', 'end');
        var marks = chart.appendChild(shape('g', { class: 'dash-chart-marks' }));
        var bars = rows.map(function (row, i) {
            var center = (i + 0.5) * slotWidth, barHeight = row.page_view_events / max * plot;
            if (!row.page_view_events) marks.appendChild(shape('circle', { cx: center.toFixed(1), cy: base - 4, r: 3, class: 'dash-zero' }));
            return marks.appendChild(shape('rect', { x: (center - barWidth / 2).toFixed(1), y: (base - barHeight).toFixed(1), width: barWidth.toFixed(1), height: barHeight.toFixed(1),
                rx: Math.min(2, barWidth / 4).toFixed(1), class: row.meets_min_events ? 'dash-bar' : 'dash-bar is-small' }));
        });
        if (rows.length >= 7) {
            var d = '';
            rows.forEach(function (row, i) {
                if (i < 6) return;
                d += (d ? 'V' : 'M' + (i * slotWidth).toFixed(1) + ' ') + y(mean(i)).toFixed(1) + 'H' + ((i + 1) * slotWidth).toFixed(1);
            });
            marks.appendChild(shape('path', { d: d, class: 'dash-trend' }));
            chart.appendChild(shape('line', { x1: key, x2: key + 16, y1: 8, y2: 8, class: 'dash-trend' }));
            label(chart, key + 22, 12, 'Μέσος όρος 7 ημερών', 'dash-tick');
        }
        chart.appendChild(shape('line', { x1: 0, x2: width, y1: base + 0.5, y2: base + 0.5, class: 'dash-axis' }));
        var peakIndex = rows.indexOf(peak);
        if (peak.page_view_events) {
            label(chart, Math.min(Math.max((peakIndex + 0.5) * slotWidth, 12), width - 12), y(peak.page_view_events) - 6,
                integer.format(peak.page_view_events), 'dash-tick dash-tick-strong', 'middle');
        }
        var step = rows.length <= 8 ? 1 : narrow ? 14 : 7;
        rows.forEach(function (row, i) {
            var last = i === rows.length - 1;
            if (i % step && !last) return;
            if (!last && i && rows.length - 1 - i < step / 2) return; // keep the last label clear of the one before
            var anchor = rows.length === 1 ? 'middle' : i === 0 ? 'start' : last ? 'end' : 'middle';
            var x = anchor === 'start' ? 0 : anchor === 'end' ? width : (i + 0.5) * slotWidth;
            label(chart, x, base + 20, day(row.event_day), 'dash-tick', anchor);
        });
        chart.appendChild(thresholdLine); // over the columns, so it reads through the tall ones

        // Pointer readout (the exact table below stays the accessible route to every value).
        var focus = chart.appendChild(shape('g', { class: 'dash-focus', visibility: 'hidden', 'aria-hidden': 'true' }));
        var cross = focus.appendChild(shape('line', { y1: top - 6, y2: base, class: 'dash-cross' }));
        var tip = focus.appendChild(shape('g', {}));
        var tipBox = tip.appendChild(shape('rect', { x: 0, y: 0, height: 42, rx: 2, class: 'dash-tip' }));
        var tipDay = tip.appendChild(shape('text', { x: 8, y: 17, class: 'dash-tick dash-tick-strong' }));
        var tipValue = tip.appendChild(shape('text', { x: 8, y: 34, class: 'dash-tick' }));
        var active = null;
        function point(i) {
            if (active) active.classList.remove('is-active');
            active = i < 0 ? null : bars[i];
            focus.setAttribute('visibility', active ? 'visible' : 'hidden');
            if (!active) return;
            active.classList.add('is-active');
            var center = (i + 0.5) * slotWidth;
            cross.setAttribute('x1', center.toFixed(1));
            cross.setAttribute('x2', center.toFixed(1));
            tipDay.textContent = day(rows[i].event_day, true);
            tipValue.textContent = plural(rows[i].page_view_events, 'προβολή', 'προβολές') + (i >= 6 ? ' · μ.ό. 7 ημ. ' + decimal.format(mean(i)) : '');
            var tipWidth = Math.max(tipDay.getComputedTextLength(), tipValue.getComputedTextLength()) + 16;
            tipBox.setAttribute('width', tipWidth.toFixed(1));
            var x = center + 10 + tipWidth > width ? center - 10 - tipWidth : center + 10;
            tip.setAttribute('transform', 'translate(' + Math.max(0, x).toFixed(1) + ' ' + top + ')');
        }
        function track(event) {
            var box = chart.getBoundingClientRect();
            point(Math.min(rows.length - 1, Math.max(0, Math.floor((event.clientX - box.left) / box.width * rows.length))));
        }
        chart.addEventListener('pointermove', track);
        chart.addEventListener('pointerdown', track);
        chart.addEventListener('pointerleave', function (event) { if (event.pointerType === 'mouse') point(-1); });
    }

    var CWV = {
        LCP: { max: 6000, good: 2500, poor: 4000, text: function (v) { return (v / 1000).toFixed(2).replace('.', ',') + ' s'; }, limits: ['2,5 s', '4 s'] },
        INP: { max: 800, good: 200, poor: 500, text: function (v) { return integer.format(Math.round(v)) + ' ms'; }, limits: ['200 ms', '500 ms'] },
        CLS: { max: 0.5, good: 0.1, poor: 0.25, text: function (v) { return v.toFixed(3).replace('.', ','); }, limits: ['0,1', '0,25'] }
    };

    // Bullet rows: each coverage class on its own row (never pooled), p75 against the good / needs-improvement /
    // poor thresholds. A filled marker has at least `minimum` observations; a hollow one is a small sample.
    // Zones in timing-screen sector colours, always named in the key, so colour is never the only cue.
    function vitalBullets(target, rows, minimum, width) {
        var narrow = width < 520, labelWidth = narrow ? 0 : 150, valueWidth = narrow ? 64 : 150, rowHeight = narrow ? 52 : 32;
        var scaleWidth = width - labelWidth - valueWidth - 12;
        var key = target.appendChild(node('p', undefined, 'dash-zone-key'));
        [['good', 'Καλό'], ['mid', 'Θέλει βελτίωση'], ['poor', 'Κακό']].forEach(function (zone) {
            key.appendChild(node('span', zone[1], 'dash-zone-key-' + zone[0]));
        });
        key.appendChild(node('span', 'Κούφιο σημάδι: μικρό δείγμα', 'dash-zone-key-small'));
        ['LCP', 'INP', 'CLS'].forEach(function (metric) {
            var spec = CWV[metric];
            var cohort = rows.filter(function (row) { return row.metric === metric && row.core_web_vital; });
            if (!cohort.length) return;
            var height = 26 + cohort.length * rowHeight;
            var svg = target.appendChild(shape('svg', { viewBox: '0 0 ' + width + ' ' + height, width: width, height: height, role: 'img',
                'aria-label': metric + ' p75 ανά κλάση κάλυψης· καλό έως ' + spec.limits[0] + ', κακό από ' + spec.limits[1] }));
            var x = function (value) { return labelWidth + Math.min(value, spec.max) / spec.max * scaleWidth; };
            label(svg, 0, 13, metric, 'dash-tick dash-tick-strong');
            label(svg, x(spec.good), 13, spec.limits[0], 'dash-tick', 'middle');
            label(svg, x(spec.poor), 13, spec.limits[1], 'dash-tick', 'middle');
            cohort.forEach(function (row, i) {
                var rowTop = 22 + i * rowHeight;
                var barTop = narrow ? rowTop + 26 : rowTop + 9;
                label(svg, 0, narrow ? rowTop + 13 : barTop + 10, row.coverage, 'dash-tick');
                [[0, spec.good, 'dash-zone-good'], [spec.good, spec.poor, 'dash-zone-mid'], [spec.poor, spec.max, 'dash-zone-poor']].forEach(function (zone) {
                    svg.appendChild(shape('rect', { x: x(zone[0]).toFixed(1), y: barTop, width: (x(zone[1]) - x(zone[0])).toFixed(1), height: 12, class: zone[2] }));
                });
                var detail = row.observations ? plural(row.observations, 'παρατήρηση', 'παρατηρήσεις') : 'καμία παρατήρηση';
                if (row.p75 !== null && row.observations) {
                    var small = row.observations < minimum, at = x(row.p75);
                    svg.appendChild(shape('path', { d: 'M' + (at - 5).toFixed(1) + ' ' + (barTop - 10) + 'H' + (at + 5).toFixed(1) + 'L' + at.toFixed(1) + ' ' + (barTop - 4) + 'Z',
                        class: 'dash-marker-tip', 'aria-hidden': 'true' }));
                    svg.appendChild(shape('rect',{ x: (x(row.p75) - 3).toFixed(1), y: barTop - 4, width: 6, height: 20, class: small ? 'dash-marker is-small' : 'dash-marker' },
                        metric + ' ' + row.coverage + ': p75 ' + spec.text(row.p75) + ', ' + detail + (small ? ', μικρό δείγμα' : '')));
                    label(svg, narrow ? width : labelWidth + scaleWidth + 12, barTop + 10, spec.text(row.p75), 'dash-tick dash-tick-strong', narrow ? 'end' : 'start');
                }
                label(svg, width, narrow ? rowTop + 13 : barTop + 10, detail, 'dash-tick', 'end');
            });
        });
    }

    function p75(row) {
        if (row.p75 === null) return '—';
        return row.metric === 'CLS' ? row.p75.toFixed(3).replace('.', ',') : integer.format(Math.round(row.p75)) + ' ms';
    }

    function percent(share) {
        return share === null ? '—' : Math.round(share * 100) + '%';
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
    // Short matrix headings; the full class stays in the table and in each heading's accessible name.
    var SHORT_NAMES = { home: 'Αρχική', article: 'Άρθρο', edition: 'Έκδοση', entity_hub: 'Οντότητα', authors: 'Συντάκτες',
        standings: 'Βαθμολ.', legal: 'Νομικά', author_tool: 'Εργαλείο', missing: 'Χωρίς', other: 'Άλλο' };
    var CHANNEL_NAMES = { organic_search_reported: 'Οργανική αναζήτηση', direct_or_unknown: 'Απευθείας ή άγνωστη', unassigned: 'Χωρίς ανάθεση (GA4)',
        unattributed: 'Χωρίς απόδοση', social: 'Κοινωνικά δίκτυα', organic_video_reported: 'Βίντεο', organic_shopping_reported: 'Αγορές',
        referral: 'Παραπομπή', email: 'Email', paid: 'Πληρωμένη προβολή', other_reported: 'Άλλο κανάλι', other: 'Άλλο',
        organic_search: 'Οργανική αναζήτηση', direct: 'Απευθείας', organic_social: 'Κοινωνικά δίκτυα' };

    function className(value) {
        var text = value === null || value === undefined ? '(none)' : String(value);
        return Object.prototype.hasOwnProperty.call(CLASS_NAMES, text) ? CLASS_NAMES[text] + ' · ' + text : text;
    }

    function plainName(map, value) {
        var text = value === null || value === undefined ? '(none)' : String(value);
        return Object.prototype.hasOwnProperty.call(map, text) ? map[text] : text;
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

    // Source section × destination section, click counts in the cells. Shade steps only help find the larger
    // cells; the number is always printed, and an empty pair is a dot, never a claim about use.
    function navigationMatrix(target, groups) {
        var keyed = function (key) { return groups.map(function (g) { return { key: g.row[key], click_events: g.clicks }; }); };
        var sources = clickTotals(keyed('source_section'), function (r) { return r.key; });
        var destinations = clickTotals(keyed('destination_section'), function (r) { return r.key; });
        var max = Math.max.apply(null, groups.map(function (g) { return g.clicks; }).concat(1));
        var cells = {};
        groups.forEach(function (g) { cells[g.row.source_section + '\u0000' + g.row.destination_section] = g.clicks; });
        var element = target.appendChild(node('table', undefined, 'dash-matrix'));
        element.appendChild(node('caption', 'Κλικ ανά ενότητα προέλευσης (γραμμές) και ενότητα προορισμού (στήλες)', 'dash-sr'));
        var head = element.appendChild(node('thead')).appendChild(node('tr'));
        head.appendChild(node('th', 'Από \\ Προς', 'dash-matrix-corner')).setAttribute('scope', 'col');
        destinations.forEach(function (d) {
            var th = head.appendChild(node('th', plainName(SHORT_NAMES, d.row.key)));
            th.setAttribute('scope', 'col');
            th.setAttribute('aria-label', className(d.row.key));
        });
        head.appendChild(node('th', 'Σύνολο', 'dash-matrix-total')).setAttribute('scope', 'col');
        var body = element.appendChild(node('tbody'));
        sources.forEach(function (s) {
            var tr = body.appendChild(node('tr'));
            var th = tr.appendChild(node('th', plainName(SHORT_NAMES, s.row.key)));
            th.setAttribute('scope', 'row');
            th.setAttribute('aria-label', className(s.row.key));
            destinations.forEach(function (d) {
                var value = cells[s.row.key + '\u0000' + d.row.key];
                tr.appendChild(node('td', value ? integer.format(value) : '·', value ? 'dash-q' + Math.ceil(value / max * 4) : 'dash-q0'));
            });
            tr.appendChild(node('td', integer.format(s.clicks), 'dash-matrix-total'));
        });
    }

    function checkItem(target, ok, text) {
        var item = target.appendChild(node('li', undefined, ok ? '' : 'is-warning'));
        item.appendChild(node('span', ok ? 'OK' : 'Προσοχή', 'dash-ledger-mark'));
        item.appendChild(node('span', text));
    }

    // Data-quality findings from 33-rum-coverage, worded as warnings only when something needs attention.
    function rumChecks(target, rows, minimum) {
        function count(stage, test) {
            return rows.filter(function (row) { return row.stage === stage && test(row.category); })
                .reduce(function (total, row) { return total + row.count; }, 0);
        }
        var resolved = count('observations', function (c) { return c === 'resolved'; });
        var conflicts = count('observations', function (c) { return c === 'final_snapshot_conflicting'; });
        var excluded = count('scan_consent', function (c) { return c !== 'Yes'; });
        var invalid = count('observation_validity', function (c) { return c !== 'valid'; });
        var disagreements = count('library_rating', function (c) { return c !== 'agrees'; });
        var checks = [
            [resolved >= minimum, plural(resolved, 'παρατήρηση', 'παρατηρήσεις') + ' μετά την επίλυση αναθεωρήσεων' + (resolved >= minimum ? '.' : ': μικρό δείγμα.')],
            [true, plural(excluded, 'γεγονός web_vital χωρίς συναίνεση εξαιρέθηκε.', 'γεγονότα web_vital χωρίς συναίνεση εξαιρέθηκαν.')],
            [conflicts === 0, plural(conflicts, 'παρατήρηση με αντικρουόμενα αντίγραφα.', 'παρατηρήσεις με αντικρουόμενα αντίγραφα.')],
            [invalid === 0, plural(invalid, 'άκυρη παρατήρηση.', 'άκυρες παρατηρήσεις.')],
            [disagreements === 0, plural(disagreements, 'διαφωνία', 'διαφωνίες') + ' με τη βαθμολογία της βιβλιοθήκης web-vitals.']
        ];
        checks.forEach(function (check) { checkItem(target, check[0], check[1]); });
        return checks.filter(function (check) { return !check[0]; }).length;
    }

    // I-06C3: 13-article-discovery and 28-internal-navigation run weekly and are carried in between, so their own as_of
    // day is shown. Snapshots from before I-06C3 have neither and show a pending state. Returns the overview facts.
    function renderDiscovery(header, payload) {
        var models = payload.models, minimum = payload.minEvents;
        var discovery = models['13-article-discovery'], navigation = models['28-internal-navigation'];
        var none = 'Δεν καταγράφηκαν κλικ στην περίοδο. Αυτό δεν αποδεικνύει ότι δεν έγιναν (συναίνεση, καταγραφή).';
        var names = ['discovery-surfaces', 'discovery-sections', 'discovery-articles', 'discovery-transitions'];
        if (!Array.isArray(discovery) || !Array.isArray(navigation)) {
            field('discovery-window').textContent = 'σε αναμονή';
            field('discovery-freshness').textContent = '';
            names.forEach(function (name) {
                slot('table', name).appendChild(node('p', 'Η ενότητα ανανεώνεται μία φορά την εβδομάδα και θα εμφανιστεί μετά την επόμενη εβδομαδιαία ενημέρωση.', 'dash-copy'));
                pending(name, 'Δεν υπάρχουν ακόμη δημοσιευμένα στοιχεία εβδομαδιαίας ανακάλυψης.');
            });
            lede('navigation', 'Σε αναμονή της πρώτης εβδομαδιαίας ενημέρωσης.');
            return { pending: true };
        }
        var scope = payload.modelWindows && payload.modelWindows['13-article-discovery'];
        var asOf = scope && scope.asOf ? scope.asOf : header.asOf;
        var start = scope ? scope.start : header.start, end = scope ? scope.end : header.end;
        var age = Math.round((Date.parse(header.asOf) - Date.parse(asOf)) / 86400000);
        field('discovery-window').textContent = day(start, true) + ' – ' + day(end, true);
        field('discovery-freshness').textContent = 'Εβδομαδιαία ενότητα: ' + (age === 0
            ? 'ανανεώθηκε σε αυτό το στιγμιότυπο.'
            : 'στοιχεία της ενημέρωσης πριν από ' + age + (age === 1 ? ' ημέρα' : ' ημέρες') + '. Ανανεώνεται κάθε 7 ημέρες.');

        var surfaces = clickTotals(discovery, function (r) { return r.source_surface; });
        var sections = clickTotals(navigation, function (r) { return r.link_section; });
        var destinations = clickTotals(discovery.filter(function (r) { return r.destination_article_id !== '(unmapped)'; }), function (r) { return r.destination_article_id; });
        var pairs = clickTotals(navigation, function (r) { return r.source_section + '\u0000' + r.destination_section; });
        var unmapped = discovery.filter(function (r) { return r.destination_article_id === '(unmapped)'; })
            .reduce(function (total, r) { return total + r.click_events; }, 0);
        var options = { threshold: minimum, valueLabel: 'Κλικ', unit: 'ένα κλικ', empty: none };

        ledger(slot('viz', 'discovery-surfaces'), surfaces.map(function (g) {
            return { name: plainName(CLASS_NAMES, g.row.source_surface), meta: String(g.row.source_surface), value: g.clicks };
        }), Object.assign({ nameLabel: 'Επιφάνεια', caption: 'Κλικ προς άρθρα ανά επιφάνεια προέλευσης' }, options));
        clickTable(slot('table', 'discovery-surfaces'), surfaces, [['Επιφάνεια προέλευσης', function (g) { return className(g.row.source_surface); }]], minimum, none);
        if (unmapped) {
            slot('table', 'discovery-surfaces').appendChild(node('p', integer.format(unmapped) + ' από αυτά τα κλικ οδηγούν σε μη αντιστοιχισμένα άρθρα (εκτός καταλόγου) και δεν μπαίνουν στην κατάταξη άρθρων.', 'dash-copy'));
            slot('viz', 'discovery-surfaces').appendChild(node('p', plural(unmapped, 'κλικ', 'κλικ') + ' προς μη αντιστοιχισμένα άρθρα μετρούν εδώ, όχι στην κατάταξη άρθρων.', 'dash-aside'));
        }
        ledger(slot('viz', 'discovery-sections'), sections.map(function (g) {
            return { name: plainName(CLASS_NAMES, g.row.link_section), meta: String(g.row.link_section), value: g.clicks };
        }), Object.assign({ nameLabel: 'Στοιχείο', caption: 'Εσωτερικά κλικ ανά link_section' }, options));
        clickTable(slot('table', 'discovery-sections'), sections, [['Στοιχείο (link_section)', function (g) { return className(g.row.link_section); }]], minimum, none);
        classification(slot('viz', 'discovery-articles'), destinations.slice(0, 10).map(function (g) {
            return { name: g.row.title || 'Άρθρο χωρίς τίτλο', meta: g.row.primary_category || '', value: g.clicks };
        }), Object.assign({ nameLabel: 'Άρθρο', caption: 'Άρθρα προορισμού ανά εσωτερικά κλικ' }, options));
        clickTable(slot('table', 'discovery-articles'), destinations.slice(0, 15), [
            ['Άρθρο', function (g) { return g.row.title || 'Άρθρο χωρίς τίτλο'; }],
            ['Κατηγορία', function (g) { return g.row.primary_category || '—'; }]
        ], minimum, none);
        if (pairs.length) navigationMatrix(slot('viz', 'discovery-transitions'), pairs);
        else pending('discovery-transitions', none);
        clickTable(slot('table', 'discovery-transitions'), pairs, [
            ['Από', function (g) { return className(g.row.source_section); }],
            ['Προς', function (g) { return className(g.row.destination_section); }]
        ], minimum, none);

        var clicks = sum(discovery, 'click_events'), internal = sum(navigation, 'click_events');
        var pair = pairs.length ? plainName(SHORT_NAMES, pairs[0].row.source_section) + ' → ' + plainName(SHORT_NAMES, pairs[0].row.destination_section) : '';
        lede('navigation', pairs.length ? 'Συχνότερο ζεύγος: ' + pair + ', ' + plural(pairs[0].clicks, 'κλικ', 'κλικ') + ' από ' + integer.format(internal) + '. '
            + (pairs[0].clicks >= minimum ? 'Μόνο τα ζεύγη με τουλάχιστον ' + minimum + ' κλικ συγκρίνονται.' : 'Κανένα ζεύγος δεν φτάνει τα ' + minimum + ' κλικ: δείχνει πού γίνονται κλικ, όχι διαδρομές.') : none);
        return {
            age: age,
            discovery: surfaces.length ? plural(clicks, 'κλικ', 'κλικ') + ' προς άρθρα, τα περισσότερα από ' + plainName(CLASS_NAMES, surfaces[0].row.source_surface) + '.' : 'Κανένα κλικ προς άρθρα.',
            navigation: pairs.length ? plural(internal, 'εσωτερικό κλικ', 'εσωτερικά κλικ') + '. Συχνότερο: ' + pair + '.' : 'Κανένα εσωτερικό κλικ.'
        };
    }

    // On a discovery day the RUM pair is carried from the previous snapshot; its own as_of day and window are shown.
    function carriedNote(name, scope) {
        var target = field(name);
        target.hidden = !(scope && scope.asOf);
        target.textContent = target.hidden ? '' : 'Στοιχεία της προηγούμενης ημερήσιας ενημέρωσης (' + day(scope.start, true) + ' – '
            + day(scope.end, true) + '): σήμερα έτρεξε στη θέση τους η εβδομαδιαία ενότητα ανακάλυψης.';
        return !target.hidden;
    }

    // The running order: one factual line per section, with its period and anything that needs attention.
    function overview(items) {
        var list = slot('list', 'overview');
        items.forEach(function (item, i) {
            var link = list.appendChild(node('li', undefined, item.alert ? 'is-alert' : '')).appendChild(node('a'));
            link.setAttribute('href', '#' + item.id);
            link.appendChild(node('span', String(i + 1).padStart(2, '0'), 'dash-order-no'));
            link.appendChild(node('span', item.name, 'dash-order-name'));
            link.appendChild(node('span', item.fact, 'dash-order-fact'));
            link.appendChild(node('span', item.status || item.period, 'dash-order-period'));
            var status = slot('status', item.id);
            status.textContent = item.status || '';
            status.classList.toggle('is-alert', Boolean(item.alert));
        });
    }

    function render(snapshot) {
        var header = snapshot.header, payload = snapshot.payload, models = payload.models, minimum = payload.minEvents;
        var generated = new Date(header.generatedAt);
        var items = [];
        field('end').textContent = day(header.end, true);
        // 1–28 days: fewer while the export (from 19 Oct 2026) is younger than 28 mature days.
        var days = Math.round((Date.parse(header.end) - Date.parse(header.start)) / 86400000) + 1;
        field('window').textContent = (days === 28 ? 'Τελευταίες 28 πλήρεις ημέρες' : days + (days === 1 ? ' πλήρης ημέρα' : ' πλήρεις ημέρες')
            + ', όσες υπάρχουν από την έναρξη της εξαγωγής') + ' · ' + day(header.start, true) + ' – ' + day(header.end, true);
        field('updated').textContent = 'Τελευταία επιτυχής ενημέρωση: ' + generated.toLocaleString('el-GR',
            { timeZone: 'Europe/Athens', dateStyle: 'long', timeStyle: 'short' }) + ' (ώρα Αθήνας).';
        field('timezone').textContent = payload.window.timezone;
        field('min').textContent = String(minimum);
        var stale = document.querySelector('[data-stale]');
        stale.hidden = Date.now() - generated.getTime() <= STALE_MS;
        stale.textContent = 'Παλιό στιγμιότυπο: η ημερήσια ενημέρωση δεν έχει πετύχει για πάνω από 48 ώρες.';
        var period = days + (days === 1 ? ' ημέρα' : ' ημέρες');

        var activity = models['20-daily-activity'];
        var total = sum(activity, 'page_view_events');
        var peak = activity.reduce(function (best, row) { return row.page_view_events > best.page_view_events ? row : best; }, activity[0]);
        var zeros = activity.filter(function (row) { return !row.page_view_events; }).length;
        var activityFact = plural(total, 'προβολή', 'προβολές') + ' σε ' + period + (activity.length === 1 ? ' (' + day(peak.event_day) + ').'
            : '. Περισσότερες: ' + integer.format(peak.page_view_events) + ' στις ' + day(peak.event_day) + '.')
            + (zeros ? ' ' + plural(zeros, 'ημέρα', 'ημέρες') + ' χωρίς καμία προβολή.' : '');
        var fullDays = activity.filter(function (row) { return row.page_view_events >= minimum; }).length;
        lede('activity', activityFact + (fullDays ? ' ' + integer.format(fullDays) + ' από ' + integer.format(activity.length) + ' ημέρες φτάνουν τις ' + minimum + '.'
            : ' Καμία ημέρα δεν φτάνει τις ' + minimum + ' προβολές: η σειρά δείχνει ρυθμό, όχι τάση.'));
        var activityBrief = plural(total, 'προβολή', 'προβολές') + (activity.length > 1 ? ' · μέγιστο ' + integer.format(peak.page_view_events) + ' (' + day(peak.event_day) + ')' : '')
            + (zeros ? ' · ' + plural(zeros, 'ημέρα', 'ημέρες') + ' χωρίς προβολή' : '');
        drawSized(slot('chart', 'activity'), function (target, width) { activityChart(target, activity, minimum, width); });
        table(slot('table', 'activity'), [
            ['Ημέρα', function (r) { return day(r.event_day, true); }],
            ['page_view', function (r) { return integer.format(r.page_view_events); }],
            ['session_start', function (r) { return integer.format(r.session_start_events); }],
            ['first_visit', function (r) { return integer.format(r.first_visit_events); }],
            ['Δείγμα', function (r) { return sample(r.meets_min_events); }]
        ], activity);
        items.push({ id: 'activity', name: 'Κίνηση', fact: activityBrief, period: period });

        // I-06C1: existing encrypted snapshots (I-06B) may not yet include article rankings.
        var articleTarget = slot('table', 'articles');
        var articles = models['10-article-pageviews'];
        if (!Array.isArray(articles)) {
            var waiting = 'Η κατάταξη άρθρων θα εμφανιστεί με το επόμενο ημερήσιο στιγμιότυπο.';
            articleTarget.appendChild(node('p', waiting, 'dash-copy'));
            pending('articles', waiting);
            lede('articles', '');
            items.push({ id: 'articles', name: 'Άρθρα', fact: 'Σε αναμονή του επόμενου στιγμιότυπου.', period: period, status: 'Σε αναμονή' });
        } else {
            var unmapped = articles.filter(function (r) { return r.article_id === '(unmapped)'; });
            var ranked = articles.filter(function (r) { return r.article_id !== '(unmapped)'; })
                .sort(function (a, b) { return b.page_view_events - a.page_view_events || String(a.title || '').localeCompare(String(b.title || ''), 'el'); });
            var top = ranked.slice(0, 15);
            if (!top.length) {
                var noViews = 'Δεν υπάρχουν ακόμη προβολές σε αναγνωρισμένα άρθρα για την περίοδο.';
                articleTarget.appendChild(node('p', noViews, 'dash-copy'));
                pending('articles', noViews);
                items.push({ id: 'articles', name: 'Άρθρα', fact: 'Καμία προβολή σε αναγνωρισμένο άρθρο.', period: period });
            } else {
                classification(slot('viz', 'articles'), top.slice(0, 10).map(function (r) {
                    return { name: r.title || 'Άρθρο χωρίς τίτλο', value: r.page_view_events,
                        meta: [r.primary_category, plural(r.days_with_events, 'ημέρα', 'ημέρες')].filter(Boolean).join(' · ') };
                }), { threshold: minimum, nameLabel: 'Άρθρο', valueLabel: 'Προβολές', caption: 'Άρθρα ανά προβολές σελίδας', empty: '' });
                table(articleTarget, [
                    ['Άρθρο', function (r) { return r.title || 'Άρθρο χωρίς τίτλο'; }],
                    ['Κατηγορία', function (r) { return r.primary_category || '—'; }],
                    ['page_view', function (r) { return integer.format(r.page_view_events); }],
                    ['Ημέρες', function (r) { return integer.format(r.days_with_events); }],
                    ['Δείγμα', function (r) { return sample(r.meets_min_events); }]
                ], top);
                var lead = '«' + (top[0].title || 'Άρθρο χωρίς τίτλο') + '», ' + plural(top[0].page_view_events, 'προβολή', 'προβολές');
                var fullArticles = ranked.filter(function (r) { return r.page_view_events >= minimum; }).length;
                lede('articles', plural(ranked.length, 'άρθρο', 'άρθρα') + ' με προβολές. Πρώτο: ' + lead + '. '
                    + (fullArticles ? (fullArticles === 1 ? 'Μόνο αυτό φτάνει' : 'Μόνο ' + fullArticles + ' φτάνουν') + ' τις ' + minimum + '· η σειρά των υπολοίπων δεν είναι σταθερή.'
                        : 'Κανένα δεν φτάνει τις ' + minimum + ': η σειρά δεν είναι σταθερή.'));
                items.push({ id: 'articles', name: 'Άρθρα', fact: '«' + (top[0].title || 'Άρθρο χωρίς τίτλο') + '» · ' + integer.format(top[0].page_view_events), period: period });
            }
            var unmappedViews = sum(unmapped, 'page_view_events');
            if (unmappedViews) {
                articleTarget.appendChild(node('p', integer.format(unmappedViews)
                    + ' προβολές σε μη αντιστοιχισμένα άρθρα δεν περιλαμβάνονται στην κατάταξη.', 'dash-copy'));
                slot('viz', 'articles').appendChild(node('p', plural(unmappedViews, 'προβολή', 'προβολές') + ' σε μη αντιστοιχισμένα άρθρα μένουν εκτός κατάταξης.', 'dash-aside'));
            }
        }

        var categories = models['11-category-pageviews'];
        var categoryTotal = sum(categories, 'page_view_events');
        var rankedCategories = categories.slice().sort(function (a, b) { return b.page_view_events - a.page_view_events; });
        ledger(slot('viz', 'categories'), rankedCategories.map(function (r) {
            var unmappedCategory = r.category === '(unmapped)';
            return { name: unmappedCategory ? 'Μη αντιστοιχισμένα' : r.category, meta: unmappedCategory ? '(unmapped): εκτός καταλόγου' : '',
                value: r.page_view_events, extra: unmappedCategory ? '—' : integer.format(r.articles_with_events) + ' / ' + integer.format(r.catalog_articles) };
        }), { threshold: minimum, nameLabel: 'Κατηγορία', valueLabel: 'Προβολές', unit: 'μία προβολή', extraLabel: 'Άρθρα', caption: 'Προβολές άρθρων ανά κατηγορία', empty: 'Καμία προβολή άρθρου στην περίοδο.' });
        table(slot('table', 'categories'), [
            ['Κατηγορία', function (r) { return r.category; }],
            ['page_view', function (r) { return integer.format(r.page_view_events); }],
            ['Άρθρα με προβολές', function (r) { return integer.format(r.articles_with_events); }],
            ['Άρθρα καταλόγου', function (r) { return integer.format(r.catalog_articles); }],
            ['Δείγμα', function (r) { return sample(r.meets_min_events); }]
        ], categories);
        var mapped = categories.filter(function (r) { return r.category !== '(unmapped)'; });
        var read = sum(mapped, 'articles_with_events'), catalogue = sum(mapped, 'catalog_articles');
        var categoryFact = rankedCategories.length ? rankedCategories[0].category + ' πρώτη: ' + integer.format(rankedCategories[0].page_view_events) + ' από '
            + plural(categoryTotal, 'προβολή', 'προβολές') + ' άρθρων.' : 'Καμία προβολή άρθρου.';
        lede('categories', plural(read, 'άρθρο', 'άρθρα') + ' από τα ' + integer.format(catalogue) + ' του καταλόγου είχαν τουλάχιστον μία προβολή. ' + categoryFact);
        items.push({ id: 'categories', name: 'Κατηγορίες', fact: categoryFact + ' ' + integer.format(read) + '/' + integer.format(catalogue) + ' άρθρα με προβολές.', period: period });

        // I-06C2: rolling 7-day session-last-click attribution, paired with 29-audience-coverage.
        var acquisitionTarget = slot('table', 'acquisition');
        var acquisitionQuality = slot('list', 'acquisition-quality');
        var acquisition = models['26-acquisition-session'];
        var coverage = models['29-audience-coverage'];
        if (!Array.isArray(acquisition) || !Array.isArray(coverage) || !payload.modelWindows) {
            var later = 'Τα στοιχεία προέλευσης θα εμφανιστούν με την επόμενη επιτυχημένη ημερήσια ανανέωση.';
            field('acquisition-window').textContent = 'στο επόμενο στιγμιότυπο';
            acquisitionTarget.appendChild(node('p', later, 'dash-copy'));
            pending('acquisition', later);
            lede('acquisition', '');
            items.push({ id: 'acquisition', name: 'Πηγές', fact: 'Σε αναμονή του επόμενου στιγμιότυπου.', period: '7 ημέρες', status: 'Σε αναμονή' });
        } else {
            var scope = payload.modelWindows['26-acquisition-session'];
            // When fewer than seven mature days exist, this pair shares the primary window.
            var start = scope ? scope.start : header.start;
            var end = scope ? scope.end : header.end;
            var acquisitionDays = Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
            field('acquisition-window').textContent = day(start, true) + ' – ' + day(end, true);
            var rankedChannels = acquisition.slice().sort(function (a, b) {
                return b.session_start_events - a.session_start_events || String(a.channel_class).localeCompare(String(b.channel_class), 'el');
            });
            if (!rankedChannels.length) {
                acquisitionTarget.appendChild(node('p', 'Δεν υπάρχουν καταγεγραμμένα γεγονότα απόκτησης για την περίοδο.', 'dash-copy'));
                pending('acquisition', 'Δεν υπάρχουν καταγεγραμμένα γεγονότα απόκτησης για την περίοδο.');
            } else {
                classification(slot('viz', 'acquisition'), rankedChannels.map(function (r) {
                    return { name: plainName(CHANNEL_NAMES, r.channel_class), meta: r.channel_class + ' · ' + r.source_family,
                        value: r.session_start_events, extra: integer.format(r.page_view_events) };
                }), { threshold: minimum, nameLabel: 'Κανάλι GA4', valueLabel: 'session_start', extraLabel: 'page_view', caption: 'Κανάλια GA4 ανά session_start', empty: '' });
                table(acquisitionTarget, [
                    ['Κανάλι GA4', function (r) { return r.channel_class; }],
                    ['Πηγή', function (r) { return r.source_family; }],
                    ['session_start', function (r) { return integer.format(r.session_start_events); }],
                    ['page_view', function (r) { return integer.format(r.page_view_events); }],
                    ['Δείγμα', function (r) { return sample(r.meets_min_events); }]
                ], rankedChannels);
            }
            var starts = coverage.filter(function (r) { return r.event_name === 'session_start'; });
            var kept = sum(starts, 'site_events');
            var notAttributed = sum(starts, 'session_channel_unattributed_or_other');
            if (!starts.length) {
                checkItem(acquisitionQuality, false, 'λείπει το ποιοτικό δείγμα session_start από το μοντέλο κάλυψης.');
            } else {
                checkItem(acquisitionQuality, kept >= minimum, plural(kept, 'γεγονός', 'γεγονότα') + ' session_start με συναίνεση στον βασικό ιστότοπο' + (kept < minimum ? ': μικρό δείγμα.' : '.'));
                checkItem(acquisitionQuality, notAttributed === 0, plural(notAttributed, 'γεγονός', 'γεγονότα') + ' session_start με μη αποδοθέν ή άλλο κανάλι GA4.');
            }
            var sessions = sum(acquisition, 'session_start_events');
            var acquisitionFact = rankedChannels.length ? plainName(CHANNEL_NAMES, rankedChannels[0].channel_class) + ': ' + integer.format(rankedChannels[0].session_start_events)
                + ' από ' + plural(sessions, 'έναρξη', 'ενάρξεις') + ' επίσκεψης (session_start).' : 'Καμία έναρξη επίσκεψης (session_start).';
            lede('acquisition', acquisitionFact + (notAttributed ? ' ' + integer.format(notAttributed) + ' χωρίς έγκυρη απόδοση καναλιού.' : ''));
            items.push({ id: 'acquisition', name: 'Πηγές', fact: acquisitionFact, period: acquisitionDays + (acquisitionDays === 1 ? ' ημέρα' : ' ημέρες') });
        }

        var discovery = renderDiscovery(header, payload);
        if (discovery.pending) {
            ['discovery', 'navigation'].forEach(function (id) {
                items.push({ id: id, name: id === 'discovery' ? 'Ανακάλυψη' : 'Πλοήγηση', fact: 'Σε αναμονή της πρώτης εβδομαδιαίας ενημέρωσης.', period: 'Εβδομαδιαία', status: 'Σε αναμονή' });
            });
        } else {
            // Weekly by design: up to 7 days old is expected; older means a weekly refresh was missed.
            var aged = discovery.age ? 'Πριν από ' + discovery.age + (discovery.age === 1 ? ' ημέρα' : ' ημέρες') : 'Ανανεώθηκε σήμερα';
            var overdue = discovery.age > 7;
            items.push({ id: 'discovery', name: 'Ανακάλυψη', fact: discovery.discovery, period: 'Εβδομαδιαία', status: aged, alert: overdue });
            items.push({ id: 'navigation', name: 'Πλοήγηση', fact: discovery.navigation, period: 'Εβδομαδιαία', status: aged, alert: overdue });
        }

        var vitals = models['30-cwv-summary'];
        drawSized(slot('viz', 'vitals'), function (target, width) { vitalBullets(target, vitals, payload.minObservations, width); });
        table(slot('table', 'cwv'), [
            ['Κάλυψη', function (r) { return r.coverage; }],
            ['Μετρική', function (r) { return r.metric; }],
            ['Παρατηρήσεις', function (r) { return integer.format(r.observations); }],
            ['p75', p75],
            ['Καλές', function (r) { return percent(r.good_share); }],
            ['Δείγμα', function (r) { return sample(r.meets_min_observations); }]
        ], vitals.filter(function (row) { return row.core_web_vital; }));
        var primary = vitals.filter(function (r) { return r.coverage === 'delayed_existing' && r.core_web_vital && r.p75 !== null && r.observations; });
        var vitalsFact = primary.length ? primary.map(function (r) { return r.metric + ' ' + CWV[r.metric].text(r.p75); }).join(' · ') + ' (p75, delayed_existing).'
            : 'Καμία παρατήρηση delayed_existing.';
        var thin = primary.some(function (r) { return r.observations < payload.minObservations; });
        lede('vitals', vitalsFact + (thin ? ' Μικρό δείγμα σε τουλάχιστον μία μετρική.' : ''));
        var cwvCarried = carriedNote('cwv-carried', payload.modelWindows && payload.modelWindows['30-cwv-summary']);
        items.push({ id: 'vitals', name: 'Core Web Vitals', fact: vitalsFact, period: period, status: cwvCarried ? 'Από χθες' : thin ? 'Μικρό δείγμα' : '' });

        var warnings = rumChecks(slot('list', 'rum'), models['33-rum-coverage'], payload.minObservations);
        table(slot('table', 'rum'), [
            ['Στάδιο', function (r) { return r.stage; }],
            ['Κατηγορία', function (r) { return r.category; }],
            ['Πλήθος', function (r) { return integer.format(r.count); }]
        ], models['33-rum-coverage']);
        var rumCarried = carriedNote('rum-carried', payload.modelWindows && payload.modelWindows['33-rum-coverage']);
        items.push({ id: 'quality', name: 'Ποιότητα', period: period, alert: warnings > 0,
            fact: warnings ? plural(warnings, 'έλεγχος θέλει', 'έλεγχοι θέλουν') + ' προσοχή.' : 'Όλοι οι έλεγχοι είναι εντάξει.',
            status: warnings ? plural(warnings, 'προειδοποίηση', 'προειδοποιήσεις') : rumCarried ? 'Από χθες' : '' });

        overview(items);
        show('report');
        sized.forEach(redraw); // the report was hidden while drawing; widths are real only now
    }

    // Removes every decrypted value from the page; only the encrypted file stays in memory.
    function clear() {
        sized = [];
        document.querySelectorAll('[data-chart], [data-table], [data-list], [data-viz], [data-metrics]').forEach(function (target) {
            target.replaceChildren();
        });
        document.querySelectorAll('[data-lede], [data-status]').forEach(function (target) {
            target.textContent = '';
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

    var rail = document.querySelector('.dash-rail');
    if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
            rail.classList.toggle('is-waiting', entries[0].isIntersecting);
        }).observe(document.querySelector('.dash-overview'));
    }

    var resizing = 0;
    window.addEventListener('resize', function () {
        clearTimeout(resizing);
        resizing = setTimeout(function () { sized.forEach(redraw); }, 150);
    });

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
