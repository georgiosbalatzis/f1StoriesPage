(function () {
    'use strict';

    var PROPERTY_ID = '485678890';
    var CLIENT_ID_KEY = 'f1stories-ga-oauth-client-id';
    var SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
    var GA_ENDPOINT = 'https://analyticsdata.googleapis.com/v1beta/properties/' + PROPERTY_ID + ':runReport';
    var tokenClient = null;
    var accessToken = '';
    var loading = false;

    var els = {
        clientId: document.getElementById('stats-client-id'),
        range: document.getElementById('stats-range'),
        connect: document.getElementById('stats-connect-btn'),
        refresh: document.getElementById('stats-refresh-btn'),
        demo: document.getElementById('stats-demo-btn'),
        status: document.getElementById('stats-status'),
        kpis: document.getElementById('stats-kpis'),
        line: document.getElementById('stats-line-chart'),
        channels: document.getElementById('stats-channel-chart'),
        devices: document.getElementById('stats-device-chart'),
        pages: document.getElementById('stats-pages-table'),
        clicks: document.getElementById('stats-click-list'),
        reading: document.getElementById('stats-reading-list'),
        trendNote: document.getElementById('stats-trend-note')
    };

    var demoData = {
        source: 'Demo data',
        kpis: {
            users: 12840,
            newUsers: 9021,
            views: 42180,
            sessions: 18760,
            avgEngagement: 146,
            engagementRate: 0.64,
            clicks: 5140,
            eventCount: 78220
        },
        timeline: [
            ['Jun 18', 980], ['Jun 19', 1180], ['Jun 20', 1320], ['Jun 21', 1040], ['Jun 22', 1680], ['Jun 23', 1580], ['Jun 24', 1920],
            ['Jun 25', 1760], ['Jun 26', 2140], ['Jun 27', 2280], ['Jun 28', 2040], ['Jun 29', 2480], ['Jun 30', 2360], ['Jul 1', 2660],
            ['Jul 2', 2840], ['Jul 3', 2520], ['Jul 4', 3180], ['Jul 5', 2960], ['Jul 6', 3360], ['Jul 7', 3540], ['Jul 8', 3280],
            ['Jul 9', 3860], ['Jul 10', 3680], ['Jul 11', 4100], ['Jul 12', 3940], ['Jul 13', 4360], ['Jul 14', 4180], ['Jul 15', 4520]
        ],
        channels: [
            ['Organic Search', 17420], ['Direct', 9820], ['Social', 7540], ['Referral', 3180], ['Unassigned', 1420]
        ],
        devices: [
            ['Mobile', 25210], ['Desktop', 13960], ['Tablet', 3010]
        ],
        pages: [
            ['/blog-module/blog-entries/20260715W/article.html', 'Williams FW16 και Benetton B194: Όταν δύο ιδιοφυΐες συγκρούστηκαν', 6840, 4920, 192, 0.71],
            ['/blog-module/blog/index.html', 'Blog archive', 5120, 3820, 98, 0.58],
            ['/', 'Homepage', 4880, 3610, 82, 0.54],
            ['/standings/', 'Standings', 4620, 3010, 214, 0.76],
            ['/blog-module/blog-entries/20260713W/article.html', 'Mercedes W05: Η απόλυτη κυριαρχία στην Αυστραλία του 2014', 3180, 2280, 174, 0.67],
            ['/blog-module/blog-entries/20260713J/article.html', 'Η FIA παραδέχεται το πρόβλημα;', 2760, 1980, 158, 0.63]
        ],
        clicks: [
            ['Homepage → latest article', '/ → 20260715W', 1240],
            ['Blog archive → article', '/blog → article', 1080],
            ['Article → related article', 'related link', 780],
            ['Navigation → standings', 'nav', 560],
            ['Article → YouTube', 'external media', 430]
        ],
        reading: [
            ['Best engaged article', '20260715W', '3m 12s'],
            ['Average article engagement', 'All articles', '2m 18s'],
            ['Strongest section', 'Standings', '3m 34s'],
            ['Returning-reader sessions', 'Returning users', '41%'],
            ['Internal click rate', 'Tracked page clicks / sessions', '27%']
        ]
    };

    function setStatus(message) {
        if (els.status) els.status.textContent = message;
    }

    function clear(node) {
        if (!node) return;
        while (node.firstChild) node.removeChild(node.firstChild);
    }

    function text(value) {
        return document.createTextNode(String(value == null ? '' : value));
    }

    function el(tag, className, content) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (content != null) node.appendChild(text(content));
        return node;
    }

    function svg(tag) {
        return document.createElementNS('http://www.w3.org/2000/svg', tag);
    }

    function formatNumber(value) {
        return Math.round(Number(value || 0)).toLocaleString('el-GR');
    }

    function formatPercent(value) {
        var number = Number(value || 0);
        if (number > 1) number = number / 100;
        return Math.round(number * 100) + '%';
    }

    function formatDuration(seconds) {
        var total = Math.max(0, Math.round(Number(seconds || 0)));
        var min = Math.floor(total / 60);
        var sec = total % 60;
        if (min >= 60) {
            var hours = Math.floor(min / 60);
            return hours + 'h ' + (min % 60) + 'm';
        }
        return min + 'm ' + String(sec).padStart(2, '0') + 's';
    }

    function compactDate(value) {
        var raw = String(value || '');
        if (/^\d{8}$/.test(raw)) return raw.slice(6, 8) + '/' + raw.slice(4, 6);
        return raw;
    }

    function metric(row, index) {
        return Number(row && row.metricValues && row.metricValues[index] && row.metricValues[index].value || 0);
    }

    function dimension(row, index) {
        return String(row && row.dimensionValues && row.dimensionValues[index] && row.dimensionValues[index].value || '');
    }

    function runReport(body) {
        return fetch(GA_ENDPOINT, {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + accessToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        }).then(function (response) {
            if (!response.ok) {
                return response.text().then(function (message) {
                    throw new Error(message || 'GA request failed: ' + response.status);
                });
            }
            return response.json();
        });
    }

    function dateRange() {
        return {
            startDate: els.range ? els.range.value : '28daysAgo',
            endDate: 'today'
        };
    }

    function requestPayload(dimensions, metrics, options) {
        options = options || {};
        return {
            dateRanges: [dateRange()],
            dimensions: dimensions.map(function (name) { return { name: name }; }),
            metrics: metrics.map(function (name) { return { name: name }; }),
            orderBys: options.orderBys || [],
            limit: options.limit || 50,
            keepEmptyRows: false
        };
    }

    function fetchAnalytics() {
        setLoading(true);
        setStatus('Loading Google Analytics...');

        return Promise.all([
            runReport(requestPayload([], ['activeUsers', 'newUsers', 'screenPageViews', 'sessions', 'userEngagementDuration', 'engagementRate', 'eventCount'], { limit: 1 })),
            runReport(requestPayload(['date'], ['screenPageViews'], { orderBys: [{ dimension: { dimensionName: 'date' } }], limit: 400 })),
            runReport(requestPayload(['sessionDefaultChannelGroup'], ['sessions'], { orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 8 })),
            runReport(requestPayload(['deviceCategory'], ['screenPageViews'], { orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 6 })),
            runReport(requestPayload(['pagePath', 'pageTitle'], ['screenPageViews', 'activeUsers', 'userEngagementDuration', 'engagementRate'], { orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 14 })),
            fetchClickReport()
        ]).then(function (reports) {
            var data = normalizeReports(reports);
            render(data);
            setStatus('Connected to GA4 property ' + PROPERTY_ID);
        }).catch(function (error) {
            console.error(error);
            setStatus('GA request failed. Showing demo data.');
            render(demoData);
        }).finally(function () {
            setLoading(false);
        });
    }

    function fetchClickReport() {
        var base = {
            dateRanges: [dateRange()],
            metrics: [{ name: 'eventCount' }],
            dimensionFilter: { filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: 'internal_page_click' } } },
            orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
            limit: 12
        };

        return runReport(Object.assign({}, base, {
            dimensions: [
                { name: 'eventName' },
                { name: 'customEvent:link_text' },
                { name: 'customEvent:link_url' }
            ]
        })).catch(function () {
            return runReport(Object.assign({}, base, {
                dimensions: [{ name: 'eventName' }]
            })).then(function (report) {
                report.fallbackClickDimensions = true;
                return report;
            });
        });
    }

    function normalizeReports(reports) {
        var overview = reports[0].rows && reports[0].rows[0];
        var views = metric(overview, 2);
        var engagementSeconds = metric(overview, 4);
        var sessions = metric(overview, 3);
        var timeline = (reports[1].rows || []).map(function (row) {
            return [compactDate(dimension(row, 0)), metric(row, 0)];
        });
        var channels = (reports[2].rows || []).map(function (row) {
            return [dimension(row, 0) || 'Unassigned', metric(row, 0)];
        });
        var devices = (reports[3].rows || []).map(function (row) {
            return [dimension(row, 0) || 'Unknown', metric(row, 0)];
        });
        var pages = (reports[4].rows || []).map(function (row) {
            var pageViews = metric(row, 0);
            var users = metric(row, 1);
            var pageEngagement = metric(row, 2);
            return [
                dimension(row, 0),
                dimension(row, 1) || dimension(row, 0),
                pageViews,
                users,
                pageViews ? pageEngagement / pageViews : 0,
                metric(row, 3)
            ];
        });
        var clickReport = reports[5] || {};
        var clicks = (clickReport.rows || []).map(function (row) {
            if (clickReport.fallbackClickDimensions) {
                return [
                    'Internal page clicks',
                    'Register link_text and link_url as GA4 custom dimensions for path detail',
                    metric(row, 0)
                ];
            }
            return [
                dimension(row, 1) || 'Internal click',
                dimension(row, 2) || dimension(row, 0),
                metric(row, 0)
            ];
        });
        var clicksTotal = clicks.reduce(function (sum, item) { return sum + Number(item[2] || 0); }, 0);

        return {
            source: 'GA4 property ' + PROPERTY_ID,
            kpis: {
                users: metric(overview, 0),
                newUsers: metric(overview, 1),
                views: views,
                sessions: sessions,
                avgEngagement: views ? engagementSeconds / views : 0,
                engagementRate: metric(overview, 5),
                clicks: clicksTotal,
                eventCount: metric(overview, 6)
            },
            timeline: timeline,
            channels: channels,
            devices: devices,
            pages: pages,
            clicks: clicks,
            reading: buildReadingSignals(pages, sessions, clicksTotal)
        };
    }

    function buildReadingSignals(pages, sessions, clicks) {
        var sorted = pages.slice().sort(function (a, b) { return Number(b[4] || 0) - Number(a[4] || 0); });
        var articleRows = pages.filter(function (row) { return row[0].indexOf('/blog-module/blog-entries/') !== -1; });
        var avgArticle = articleRows.reduce(function (sum, row) { return sum + Number(row[4] || 0); }, 0) / Math.max(1, articleRows.length);
        return [
            ['Best engaged page', sorted[0] ? sorted[0][1] : '-', sorted[0] ? formatDuration(sorted[0][4]) : '-'],
            ['Average article engagement', articleRows.length + ' tracked article rows', formatDuration(avgArticle)],
            ['Internal click rate', 'Tracked clicks / sessions', sessions ? formatPercent(clicks / sessions) : '0%'],
            ['Top article rows', 'Rows under /blog-entries/', formatNumber(articleRows.length)],
            ['Reading proxy', 'userEngagementDuration / views', 'GA engagement time']
        ];
    }

    function setLoading(next) {
        loading = next;
        [els.connect, els.refresh, els.demo].forEach(function (button) {
            if (button) button.disabled = loading;
        });
    }

    function render(data) {
        if (!data) data = demoData;
        renderKpis(data.kpis || {});
        renderLineChart(data.timeline || []);
        renderBars(els.channels, data.channels || [], 'sessions');
        renderBars(els.devices, data.devices || [], 'views');
        renderPages(data.pages || []);
        renderList(els.clicks, data.clicks || [], function (item) {
            return { title: item[0], sub: item[1], value: formatNumber(item[2]) };
        });
        renderList(els.reading, data.reading || [], function (item) {
            return { title: item[0], sub: item[1], value: item[2] };
        });
        if (els.trendNote) els.trendNote.textContent = data.source || '';
    }

    function renderKpis(kpis) {
        clear(els.kpis);
        [
            ['Users', formatNumber(kpis.users), 'Active users'],
            ['Page views', formatNumber(kpis.views), 'screenPageViews'],
            ['Sessions', formatNumber(kpis.sessions), 'GA sessions'],
            ['Avg reading', formatDuration(kpis.avgEngagement), 'Engagement / view'],
            ['Engagement', formatPercent(kpis.engagementRate), 'Engaged sessions'],
            ['Clicks', formatNumber(kpis.clicks), 'internal_page_click']
        ].forEach(function (item) {
            var card = el('article', 'stats-kpi');
            card.appendChild(el('p', 'stats-kpi-label', item[0]));
            card.appendChild(el('p', 'stats-kpi-value', item[1]));
            card.appendChild(el('div', 'stats-kpi-delta', item[2]));
            els.kpis.appendChild(card);
        });
    }

    function renderLineChart(points) {
        clear(els.line);
        if (!points.length) {
            els.line.appendChild(empty('No timeline data'));
            return;
        }
        var width = 900;
        var height = 260;
        var pad = 28;
        var max = Math.max.apply(null, points.map(function (point) { return Number(point[1] || 0); })) || 1;
        var step = points.length > 1 ? (width - pad * 2) / (points.length - 1) : 0;
        var coords = points.map(function (point, index) {
            return [
                pad + step * index,
                height - pad - (Number(point[1] || 0) / max) * (height - pad * 2)
            ];
        });
        var path = coords.map(function (point, index) {
            return (index ? 'L' : 'M') + point[0].toFixed(1) + ' ' + point[1].toFixed(1);
        }).join(' ');
        var area = path + ' L ' + (width - pad) + ' ' + (height - pad) + ' L ' + pad + ' ' + (height - pad) + ' Z';
        var root = svg('svg');
        root.setAttribute('class', 'stats-line-svg');
        root.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
        [0.25, 0.5, 0.75, 1].forEach(function (mark) {
            var line = svg('line');
            var y = height - pad - mark * (height - pad * 2);
            line.setAttribute('x1', pad);
            line.setAttribute('x2', width - pad);
            line.setAttribute('y1', y);
            line.setAttribute('y2', y);
            line.setAttribute('class', 'stats-grid-line');
            root.appendChild(line);
        });
        var areaPath = svg('path');
        areaPath.setAttribute('d', area);
        areaPath.setAttribute('class', 'stats-line-area');
        root.appendChild(areaPath);
        var linePath = svg('path');
        linePath.setAttribute('d', path);
        linePath.setAttribute('class', 'stats-line-path');
        root.appendChild(linePath);
        coords.forEach(function (point, index) {
            if (index % Math.ceil(points.length / 10) !== 0 && index !== points.length - 1) return;
            var dot = svg('circle');
            dot.setAttribute('cx', point[0]);
            dot.setAttribute('cy', point[1]);
            dot.setAttribute('r', 4);
            dot.setAttribute('class', 'stats-point');
            root.appendChild(dot);
        });
        els.line.appendChild(root);
    }

    function renderBars(container, rows, suffix) {
        clear(container);
        if (!rows.length) {
            container.appendChild(empty('No data'));
            return;
        }
        var wrap = el('div', 'stats-bars');
        var max = Math.max.apply(null, rows.map(function (row) { return Number(row[1] || 0); })) || 1;
        rows.forEach(function (row) {
            var line = el('div', 'stats-bar-row');
            line.appendChild(el('div', 'stats-bar-label', row[0]));
            var track = el('div', 'stats-bar-track');
            var fill = el('div', 'stats-bar-fill');
            fill.style.width = Math.max(2, Number(row[1] || 0) / max * 100).toFixed(1) + '%';
            track.appendChild(fill);
            line.appendChild(track);
            line.appendChild(el('div', 'stats-list-value', formatNumber(row[1]) + (suffix ? '' : '')));
            wrap.appendChild(line);
        });
        container.appendChild(wrap);
    }

    function renderPages(rows) {
        clear(els.pages);
        rows.forEach(function (row) {
            var tr = document.createElement('tr');
            var title = el('div', 'stats-page-title', row[1] || row[0]);
            title.appendChild(el('span', 'stats-page-path', row[0]));
            var first = document.createElement('td');
            first.appendChild(title);
            tr.appendChild(first);
            tr.appendChild(el('td', '', formatNumber(row[2])));
            tr.appendChild(el('td', '', formatNumber(row[3])));
            tr.appendChild(el('td', '', formatDuration(row[4])));
            tr.appendChild(el('td', '', formatPercent(row[5])));
            els.pages.appendChild(tr);
        });
        if (!rows.length) {
            var trEmpty = document.createElement('tr');
            var td = document.createElement('td');
            td.colSpan = 5;
            td.appendChild(empty('No page data'));
            trEmpty.appendChild(td);
            els.pages.appendChild(trEmpty);
        }
    }

    function renderList(container, rows, mapRow) {
        clear(container);
        if (!rows.length) {
            container.appendChild(empty('No data'));
            return;
        }
        rows.slice(0, 8).forEach(function (row) {
            var mapped = mapRow(row);
            var item = el('div', 'stats-list-row');
            var copy = el('div');
            copy.appendChild(el('div', 'stats-list-title', mapped.title));
            copy.appendChild(el('div', 'stats-list-sub', mapped.sub));
            item.appendChild(copy);
            item.appendChild(el('div', 'stats-list-value', mapped.value));
            container.appendChild(item);
        });
    }

    function empty(message) {
        return el('div', 'stats-empty', message);
    }

    function connect() {
        var clientId = (els.clientId && els.clientId.value || '').trim();
        if (!clientId) {
            setStatus('Paste a Google OAuth Client ID first.');
            return;
        }
        try {
            localStorage.setItem(CLIENT_ID_KEY, clientId);
        } catch (_) {}
        if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
            setStatus('Google Identity script is still loading. Try again.');
            return;
        }
        tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: SCOPE,
            callback: function (response) {
                if (response && response.access_token) {
                    accessToken = response.access_token;
                    fetchAnalytics();
                } else {
                    setStatus('Google authorization was cancelled.');
                }
            }
        });
        tokenClient.requestAccessToken({ prompt: accessToken ? '' : 'consent' });
    }

    function init() {
        try {
            var storedClientId = localStorage.getItem(CLIENT_ID_KEY);
            if (storedClientId && els.clientId) els.clientId.value = storedClientId;
        } catch (_) {}

        if (els.connect) els.connect.addEventListener('click', connect);
        if (els.refresh) els.refresh.addEventListener('click', function () {
            if (accessToken) fetchAnalytics();
            else render(demoData);
        });
        if (els.demo) els.demo.addEventListener('click', function () {
            accessToken = '';
            setStatus('Demo data loaded');
            render(demoData);
        });
        if (els.range) els.range.addEventListener('change', function () {
            if (accessToken) fetchAnalytics();
            else render(demoData);
        });
        render(demoData);
    }

    init();
})();
