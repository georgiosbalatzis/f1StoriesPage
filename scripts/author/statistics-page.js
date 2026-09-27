(function () {
    'use strict';

    var OWNER = 'georgiosbalatzis';
    var REPO = 'f1StoriesPage';
    var PROPERTY_ID = (window.F1S_GA_CONFIG || {}).propertyId || '485678890';
    var TOKEN_KEY = 'f1stories-gh-token';
    var CLIENT_ID_KEY = 'f1stories-ga-oauth-client-id';
    var GA_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
    var GA_ENDPOINT = 'https://analyticsdata.googleapis.com/v1beta/properties/' + PROPERTY_ID + ':runReport';
    var ACTIONS = ['internal_page_click', 'outbound_click', 'article_share', 'article_engaged', 'journal_search', 'journal_filter', 'journal_sort', 'journal_page'];
    var tokenStore = window.F1S_AUTHOR_SESSION_TOKEN.createSessionTokenStore(TOKEN_KEY);
    tokenStore.adoptStoredToken();
    var accessToken = '';
    var tokenClient = null;
    var articles = [];
    var current = null;
    var authorSelect = document.getElementById('stats-author');
    var els = {
        status: document.getElementById('stats-status'),
        gate: document.getElementById('stats-gate'),
        gateHelp: document.getElementById('stats-gate-help'),
        gateError: document.getElementById('stats-gate-error'),
        tokenForm: document.getElementById('stats-token-form'),
        tokenInput: document.getElementById('stats-token'),
        tokenButton: document.getElementById('stats-token-btn'),
        gaConnect: document.getElementById('stats-ga-connect'),
        clientIdWrap: document.getElementById('stats-client-id-wrap'),
        clientId: document.getElementById('stats-client-id'),
        connect: document.getElementById('stats-connect-btn'),
        refresh: document.getElementById('stats-refresh-btn'),
        range: document.getElementById('stats-range'),
        private: document.getElementById('stats-private'),
        kpis: document.getElementById('stats-kpis'),
        trend: document.getElementById('stats-line-chart'),
        channels: document.getElementById('stats-channel-chart'),
        actions: document.getElementById('stats-action-list'),
        pages: document.getElementById('stats-pages-table'),
        note: document.getElementById('stats-trend-note')
    };

    function setStatus(value) { els.status.textContent = value; }
    function setError(value) {
        els.gateError.textContent = value || '';
        els.gateError.hidden = !value;
    }
    function setUnlocked(value) {
        document.body.classList.toggle('stats-unlocked', value);
        els.private.inert = !value;
        els.private.setAttribute('aria-hidden', value ? 'false' : 'true');
    }
    function clientId() {
        var configured = String((window.F1S_GA_CONFIG || {}).clientId || '').trim();
        if (configured) return configured;
        try { return localStorage.getItem(CLIENT_ID_KEY) || ''; } catch (_) { return ''; }
    }
    function apiHeaders(token) {
        return {
            Authorization: 'Bearer ' + token,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
        };
    }

    async function verifyGithubToken(token) {
        var response;
        try {
            response = await fetch('https://api.github.com/repos/' + OWNER + '/' + REPO, { headers: apiHeaders(token) });
        } catch (_) {
            throw new Error('Δεν ήταν δυνατή η σύνδεση με το GitHub. Έλεγξε τη σύνδεσή σου και ξαναδοκίμασε.');
        }
        if (response.status === 401) throw new Error('Το GitHub token δεν είναι έγκυρο.');
        if (!response.ok) throw new Error('Το token δεν μπορεί να διαβάσει το repository. Έλεγξε τα δικαιώματά του.');
        var repo = await response.json();
        if (!repo.permissions || !(repo.permissions.push || repo.permissions.admin)) {
            throw new Error('Χρειάζεται token με πρόσβαση εγγραφής στο georgiosbalatzis/f1StoriesPage, όπως στα εργαλεία συντακτών.');
        }
    }

    function showGoogleStep() {
        els.tokenForm.hidden = true;
        els.gaConnect.hidden = false;
        els.clientIdWrap.hidden = !!clientId();
        els.range.disabled = false;
        authorSelect.disabled = false;
        els.refresh.disabled = false;
        setStatus('GitHub token OK · αναμονή Google Analytics');
        els.gateHelp.textContent = 'Το GitHub token επιβεβαιώθηκε. Η Google σύνδεση επιτρέπει μόνο ανάγνωση των αναφορών GA4.';
    }

    els.tokenForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        var token = els.tokenInput.value.trim();
        setError('');
        if (window.F1S_AUTHOR_SESSION_TOKEN.isFramed()) {
            els.tokenInput.value = '';
            setError('Άνοιξε το dashboard απευθείας σε νέα καρτέλα πριν βάλεις token.');
            return;
        }
        if (!token || !window.F1S_AUTHOR_SESSION_TOKEN.isAsciiToken(token)) {
            setError('Επικόλλησε ένα έγκυρο GitHub token. Το token δεν αποθηκεύεται.');
            return;
        }
        els.tokenButton.disabled = true;
        els.tokenButton.textContent = 'Έλεγχος…';
        try {
            await verifyGithubToken(token);
            tokenStore.set(token);
            els.tokenInput.value = '';
            showGoogleStep();
        } catch (error) {
            tokenStore.clear();
            els.tokenInput.value = '';
            setError(error.message);
        } finally {
            els.tokenButton.disabled = false;
            els.tokenButton.textContent = 'Έλεγχος token';
        }
    });

    function dateRange(previous) {
        var days = Number((els.range.value.match(/^([0-9]+)daysAgo$/) || [0, 28])[1]);
        return previous
            ? { startDate: (days * 2) + 'daysAgo', endDate: (days + 1) + 'daysAgo' }
            : { startDate: days + 'daysAgo', endDate: 'yesterday' };
    }
    function payload(dimensions, metrics, options) {
        options = options || {};
        return {
            dateRanges: [dateRange(options.previous)],
            dimensions: (dimensions || []).map(function (name) { return { name: name }; }),
            metrics: metrics.map(function (name) { return { name: name }; }),
            limit: options.limit || 100,
            orderBys: options.orderBys || [],
            dimensionFilter: options.dimensionFilter,
            keepEmptyRows: false
        };
    }
    async function runReport(body) {
        var response = await fetch(GA_ENDPOINT, {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!response.ok) throw new Error('GA4 report request failed (' + response.status + ').');
        return response.json();
    }
    function number(row, index) {
        return Number(row && row.metricValues && row.metricValues[index] && row.metricValues[index].value || 0);
    }
    function dim(row, index) {
        return String(row && row.dimensionValues && row.dimensionValues[index] && row.dimensionValues[index].value || '');
    }
    function articleFilter() {
        return { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'BEGINS_WITH', value: '/blog-module/blog-entries/' } } };
    }
    function loadArticleNames() {
        return fetch('/blog-module/blog-index-data.json').then(function (response) {
            if (!response.ok) throw new Error('Article index unavailable.');
            return response.json();
        }).then(function (data) {
            var authors = data.a || [];
            var taxonomy = window.F1S_TAXONOMY;
            return (data.p || []).map(function (row) {
                var author = String(authors[row[2]] || 'F1 Stories');
                return { id: String(row[0] || ''), title: String(row[1] || ''), author: taxonomy ? taxonomy.authorLabel(author) : author };
            });
        }).catch(function () { return []; });
    }
    function rangesForRows(report) {
        return report.rows || [];
    }
    async function fetchAnalytics() {
        setStatus('Φόρτωση GA4…');
        els.refresh.disabled = true;
        setUnlocked(false);
        try {
            var eventFilter = { fieldName: 'eventName', inListFilter: { values: ACTIONS } };
            var results = await Promise.all([
                runReport(payload([], ['activeUsers', 'sessions', 'screenPageViews', 'engagementRate'])),
                runReport(payload([], ['activeUsers', 'sessions', 'screenPageViews', 'engagementRate'], { previous: true })),
                runReport(payload(['date'], ['screenPageViews'], { limit: 400, orderBys: [{ dimension: { dimensionName: 'date' } }], dimensionFilter: articleFilter() })),
                runReport(payload(['sessionDefaultChannelGroup'], ['sessions'], { limit: 8, orderBys: [{ metric: { metricName: 'sessions' }, desc: true }] })),
                runReport(payload(['pagePath', 'pageTitle'], ['screenPageViews', 'activeUsers', 'userEngagementDuration', 'engagementRate', 'eventCount'], { limit: 500, orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], dimensionFilter: articleFilter() })),
                runReport(payload(['pagePath'], ['screenPageViews', 'userEngagementDuration'], { previous: true, limit: 500, dimensionFilter: articleFilter() })),
                runReport(payload(['eventName', 'pagePath'], ['eventCount'], { limit: 1000, orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }], dimensionFilter: { filter: eventFilter } })),
                loadArticleNames()
            ]);
            current = normalize(results);
            render(current);
            setUnlocked(true);
            setStatus('GA4 property ' + PROPERTY_ID + ' · ' + current.rangeLabel);
            els.gate.hidden = true;
        } catch (error) {
            setUnlocked(false);
            els.gate.hidden = false;
            els.tokenForm.hidden = true;
            els.gaConnect.hidden = false;
            els.clientIdWrap.hidden = !!clientId();
            setStatus('Δεν φορτώθηκαν τα GA4 δεδομένα');
            setError(error.message + ' Έλεγξε το Google account και το property 485678890.');
        } finally {
            els.refresh.disabled = false;
        }
    }
    function normalize(results) {
        var overview = results[0].rows && results[0].rows[0];
        var articleNames = new Map((results[7] || []).map(function (item) { return [item.id, item]; }));
        var eventTotals = Object.create(null);
        var eventByPath = Object.create(null);
        rangesForRows(results[6]).forEach(function (row) {
            var name = dim(row, 0);
            var path = dim(row, 1);
            eventTotals[name] = (eventTotals[name] || 0) + number(row, 0);
            eventByPath[path] = eventByPath[path] || Object.create(null);
            eventByPath[path][name] = (eventByPath[path][name] || 0) + number(row, 0);
        });
        var previousPages = Object.create(null);
        rangesForRows(results[5]).forEach(function (row) { previousPages[dim(row, 0)] = row; });
        var pageRows = rangesForRows(results[4]).map(function (row) {
            var path = dim(row, 0);
            var idMatch = path.match(/\/blog-entries\/([^/]+)\/article\.html/);
            var meta = idMatch && articleNames.get(idMatch[1]);
            var byPath = eventByPath[path] || {};
            var previous = previousPages[path];
            return {
                path: path,
                title: (meta && meta.title) || dim(row, 1) || path,
                author: (meta && meta.author) || 'F1 Stories',
                views: number(row, 0),
                prevViews: number(previous, 0),
                readers: number(row, 1),
                engagedSeconds: number(row, 2),
                prevEngagedSeconds: number(previous, 1),
                engagement: number(row, 3),
                engagedReads: byPath.article_engaged || 0,
                shares: byPath.article_share || 0
            };
        });
        var timeline = rangesForRows(results[2]).map(function (row) {
            var date = dim(row, 0);
            return [date.slice(4, 6) + '/' + date.slice(6, 8), number(row, 0)];
        });
        var channels = rangesForRows(results[3]).map(function (row) { return [dim(row, 0) || 'Unassigned', number(row, 0)]; });
        var previousOverview = results[1].rows && results[1].rows[0];
        var activeUsers = number(overview, 0);
        var sessions = number(overview, 1);
        var siteEngagement = number(overview, 3);
        var articleViews = pageRows.reduce(function (sum, row) { return sum + row.views; }, 0);
        var previousArticleViews = pageRows.reduce(function (sum, row) { return sum + row.prevViews; }, 0);
        var engagedSeconds = pageRows.reduce(function (sum, row) { return sum + row.engagedSeconds; }, 0);
        var previousEngagedSeconds = pageRows.reduce(function (sum, row) { return sum + row.prevEngagedSeconds; }, 0);
        return {
            rangeLabel: els.range.options[els.range.selectedIndex].textContent,
            activeUsers: activeUsers,
            previousUsers: number(previousOverview, 0),
            sessions: sessions,
            previousSessions: number(previousOverview, 1),
            siteEngagement: siteEngagement,
            articleViews: articleViews,
            previousArticleViews: previousArticleViews,
            avgEngaged: articleViews ? engagedSeconds / articleViews : 0,
            previousAvgEngaged: previousArticleViews ? previousEngagedSeconds / previousArticleViews : 0,
            engagedReads: eventTotals.article_engaged || 0,
            shares: eventTotals.article_share || 0,
            timeline: timeline,
            channels: channels,
            pages: pageRows.sort(function (a, b) { return b.views - a.views; }),
            events: eventTotals
        };
    }
    function fmt(value) { return Math.round(Number(value || 0)).toLocaleString('el-GR'); }
    function percent(value) { return Math.round(Number(value || 0) * 100) + '%'; }
    function duration(value) {
        var seconds = Math.round(Number(value || 0));
        return Math.floor(seconds / 60) + '′ ' + String(seconds % 60).padStart(2, '0') + '″';
    }
    function node(tag, className, text) {
        var element = document.createElement(tag);
        if (className) element.className = className;
        if (text != null) element.textContent = text;
        return element;
    }
    function delta(now, before) {
        if (!before) return 'Νέα περίοδος';
        var change = Math.round((now - before) / before * 100);
        return (change > 0 ? '+' : '') + change + '% από πριν';
    }
    function renderKpis(data) {
        var metrics = [
            ['Ενεργοί αναγνώστες', data.activeUsers, delta(data.activeUsers, data.previousUsers)],
            ['Προβολές άρθρων', data.articleViews, delta(data.articleViews, data.previousArticleViews)],
            ['Engaged reads', data.engagedReads, '30″ ορατά + 50% κύλιση'],
            ['Κοινοποιήσεις', data.shares, 'Άρθρα που κοινοποιήθηκαν'],
            ['Μέσος engaged χρόνος', duration(data.avgEngaged), delta(data.avgEngaged, data.previousAvgEngaged) + ' / προβολή'],
            ['Engaged sessions', percent(data.siteEngagement), fmt(data.sessions) + ' sessions']
        ];
        els.kpis.replaceChildren();
        metrics.forEach(function (item) {
            var card = node('article', 'stats-kpi');
            card.appendChild(node('p', 'stats-kpi-label', item[0]));
            card.appendChild(node('p', 'stats-kpi-value', typeof item[1] === 'number' ? fmt(item[1]) : item[1]));
            card.appendChild(node('div', 'stats-kpi-delta', item[2]));
            els.kpis.appendChild(card);
        });
    }
    function renderTrend(points) {
        els.trend.replaceChildren();
        if (!points.length) { els.trend.appendChild(node('p', 'stats-empty', 'Δεν υπάρχουν ημερήσια δεδομένα σε αυτή την περίοδο.')); return; }
        var width = 900, height = 260, pad = 28;
        var max = Math.max.apply(null, points.map(function (point) { return point[1]; })) || 1;
        var step = points.length > 1 ? (width - 2 * pad) / (points.length - 1) : 0;
        var coords = points.map(function (point, i) { return [pad + step * i, height - pad - point[1] / max * (height - 2 * pad)]; });
        var path = coords.map(function (point, i) { return (i ? 'L' : 'M') + point[0].toFixed(1) + ' ' + point[1].toFixed(1); }).join(' ');
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'stats-line-svg');
        svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
        var line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        line.setAttribute('d', path);
        line.setAttribute('class', 'stats-line-path');
        svg.appendChild(line);
        coords.forEach(function (point, i) {
            if (i % Math.ceil(points.length / 10) && i !== points.length - 1) return;
            var dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            dot.setAttribute('cx', point[0]); dot.setAttribute('cy', point[1]); dot.setAttribute('r', 4); dot.setAttribute('class', 'stats-point');
            svg.appendChild(dot);
        });
        els.trend.appendChild(svg);
    }
    function renderBars(container, rows) {
        container.replaceChildren();
        if (!rows.length) { container.appendChild(node('p', 'stats-empty', 'Δεν υπάρχουν δεδομένα.')); return; }
        var wrap = node('div', 'stats-bars');
        var max = Math.max.apply(null, rows.map(function (row) { return row[1]; })) || 1;
        rows.forEach(function (row) {
            var item = node('div', 'stats-bar-row');
            item.appendChild(node('div', 'stats-bar-label', row[0]));
            var track = node('div', 'stats-bar-track');
            var fill = node('div', 'stats-bar-fill');
            fill.style.width = Math.max(2, row[1] / max * 100) + '%';
            track.appendChild(fill); item.appendChild(track); item.appendChild(node('div', 'stats-list-value', fmt(row[1]))); wrap.appendChild(item);
        });
        container.appendChild(wrap);
    }
    function renderActions(data) {
        var labels = [
            ['internal_page_click', 'Εσωτερικά clicks'],
            ['outbound_click', 'Outbound clicks'],
            ['article_share', 'Κοινοποιήσεις άρθρων'],
            ['article_engaged', 'Engaged reads'],
            ['journal_search', 'Αναζητήσεις περιοδικού'],
            ['journal_filter', 'Φίλτρα περιοδικού'],
            ['journal_sort', 'Αλλαγές ταξινόμησης'],
            ['journal_page', 'Σελίδες αποτελεσμάτων']
        ];
        els.actions.replaceChildren();
        labels.forEach(function (item) {
            var row = node('div', 'stats-list-row');
            row.appendChild(node('div', 'stats-list-title', item[1]));
            row.appendChild(node('div', 'stats-list-value', fmt(data.events[item[0]] || 0)));
            els.actions.appendChild(row);
        });
    }
    function renderPages(rows) {
        var selected = authorSelect.value;
        var shown = rows.filter(function (row) { return selected === 'all' || row.author === selected; }).slice(0, 100);
        els.pages.replaceChildren();
        shown.forEach(function (row) {
            var tr = document.createElement('tr');
            var titleCell = document.createElement('td');
            var link = node('a', 'stats-page-title', row.title);
            link.href = row.path;
            titleCell.appendChild(link);
            titleCell.appendChild(node('span', 'stats-page-path', row.author));
            tr.appendChild(titleCell);
            tr.appendChild(node('td', '', fmt(row.views)));
            tr.appendChild(node('td', '', fmt(row.readers)));
            tr.appendChild(node('td', '', fmt(row.engagedReads)));
            tr.appendChild(node('td', '', fmt(row.shares)));
            tr.appendChild(node('td', '', percent(row.engagement)));
            els.pages.appendChild(tr);
        });
        if (!shown.length) {
            var emptyRow = document.createElement('tr');
            var cell = node('td', 'stats-empty', 'Δεν βρέθηκαν άρθρα για αυτή την περίοδο.');
            cell.colSpan = 6; emptyRow.appendChild(cell); els.pages.appendChild(emptyRow);
        }
    }
    function render(data) {
        renderKpis(data);
        renderTrend(data.timeline);
        renderBars(els.channels, data.channels);
        renderActions(data);
        renderPages(data.pages);
        els.note.textContent = 'GA4 · ' + data.rangeLabel + ' · engagement time ανά προβολή άρθρου';
    }
    function populateAuthors(rows) {
        var names = Array.from(new Set(rows.map(function (row) { return row.author; }))).sort();
        authorSelect.replaceChildren(new Option('Όλοι οι συντάκτες', 'all'));
        names.forEach(function (name) { authorSelect.add(new Option(name, name)); });
    }
    function connectGoogle() {
        var id = clientId();
        if (!id) id = els.clientId.value.trim();
        if (!id) {
            setError('Χρειάζεται Google OAuth client ID για να ζητηθεί η read-only πρόσβαση στο GA4.');
            els.clientIdWrap.hidden = false;
            els.clientId.focus();
            return;
        }
        try { localStorage.setItem(CLIENT_ID_KEY, id); } catch (_) {}
        if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
            setError('Η υπηρεσία σύνδεσης Google δεν φορτώθηκε. Ανανέωσε τη σελίδα και ξαναδοκίμασε.');
            return;
        }
        setError('');
        tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: id,
            scope: GA_SCOPE,
            callback: function (response) {
                if (!response || !response.access_token) {
                    setError('Δεν εγκρίθηκε η σύνδεση Google Analytics.');
                    return;
                }
                accessToken = response.access_token;
                fetchAnalytics();
            }
        });
        tokenClient.requestAccessToken({ prompt: 'consent' });
    }
    els.connect.addEventListener('click', connectGoogle);
    els.refresh.addEventListener('click', function () { if (accessToken) fetchAnalytics(); });
    els.range.addEventListener('change', function () { if (accessToken) fetchAnalytics(); });
    authorSelect.addEventListener('change', function () { if (current) renderPages(current.pages); });
    els.clientId.addEventListener('input', function () { setError(''); });
    els.clientIdWrap.hidden = !!clientId();
    setUnlocked(false);
})();
