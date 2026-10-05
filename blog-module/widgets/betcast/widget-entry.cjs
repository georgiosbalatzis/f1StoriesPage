'use strict';

const SVG_NS = 'http://www.w3.org/2000/svg';
const VIEWS = Object.freeze({
    budget: { label: 'Budget', value: row => row.cumulativeBudget, unit: '€' },
    weeklyProfit: { label: 'Κέρδος ανά εβδομάδα', unit: '€' },
    weeklyRoi: { label: 'ROI ανά εβδομάδα', unit: '%' },
    winRate: { label: 'Ποσοστό νικών', unit: '%' }
});

function seriesFor(rows, view) {
    if (!Array.isArray(rows) || !Object.hasOwn(VIEWS, view)) throw new TypeError('Unsupported BetCast widget config');
    for (const row of rows) {
        if (!row || !Number.isFinite(row.id) || !Number.isFinite(row.betNumber) || !Number.isFinite(row.week)
            || !Number.isFinite(row.cumulativeBudget) || !Number.isFinite(row.profitLoss)
            || !Number.isFinite(row.stake) || typeof row.result !== 'string') {
            throw new TypeError('Invalid BetCast widget row');
        }
    }
    if (view === 'budget') return rows.map(row => ({ label: String(row.id), value: row.cumulativeBudget }));
    const weeks = new Map();
    for (const row of rows) {
        if (!weeks.has(row.week)) weeks.set(row.week, { profit: 0, stake: 0, wins: 0, settled: 0 });
        const week = weeks.get(row.week);
        week.profit += row.profitLoss;
        week.stake += row.stake;
        if (row.result === 'Win' || row.result === 'Lose') {
            week.settled += 1;
            if (row.result === 'Win') week.wins += 1;
        }
    }
    return [...weeks.entries()].sort((a, b) => a[0] - b[0]).map(([weekNumber, summary]) => ({
        label: String(weekNumber),
        value: view === 'weeklyProfit' ? Number(summary.profit.toFixed(2))
            : view === 'weeklyRoi' ? Number((summary.stake ? summary.profit / summary.stake * 100 : 0).toFixed(2))
                : Number((summary.settled ? summary.wins / summary.settled * 100 : 0).toFixed(1))
    }));
}

function validateConfig(config) {
    if (!config || typeof config !== 'object' || !Array.isArray(config.rows)
        || config.rows.length > 10000 || !Object.hasOwn(VIEWS, config.view)) throw new TypeError('Unsupported BetCast widget config');
    for (const row of config.rows) {
        if (!row || !Number.isFinite(row.id) || !Number.isFinite(row.betNumber) || !Number.isFinite(row.week)
            || !Number.isFinite(row.cumulativeBudget) || !Number.isFinite(row.profitLoss)
            || !Number.isFinite(row.stake) || typeof row.result !== 'string') {
            throw new TypeError('Invalid BetCast widget row');
        }
    }
}

function svgElement(doc, name, attrs = {}) {
    const node = doc.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    return node;
}

function drawChart(target, rows, view) {
    const doc = target.ownerDocument;
    const series = seriesFor(rows, view);
    const width = 680;
    const height = 260;
    const margin = { top: 20, right: 20, bottom: 42, left: 58 };
    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;
    const values = series.map(point => point.value);
    const minimum = Math.min(0, ...values);
    const maximum = Math.max(0, ...values);
    const span = maximum - minimum || 1;
    const zeroY = margin.top + maximum / span * plotH;
    const svg = svgElement(doc, 'svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': VIEWS[view].label });
    svg.classList.add('f1s-betcast-widget__chart');
    svg.append(svgElement(doc, 'line', { x1: margin.left, y1: zeroY, x2: width - margin.right, y2: zeroY, class: 'axis' }));
    if (!series.length) {
        const empty = svgElement(doc, 'text', { x: width / 2, y: height / 2, 'text-anchor': 'middle', class: 'label' });
        empty.textContent = 'Δεν υπάρχουν δεδομένα για το γράφημα.';
        svg.append(empty);
    }
    const slot = plotW / Math.max(1, series.length);
    const barWidth = Math.max(2, Math.min(28, slot * 0.68));
    series.forEach((point, index) => {
        const x = margin.left + index * slot + (slot - barWidth) / 2;
        const valueY = margin.top + (maximum - point.value) / span * plotH;
        const bar = svgElement(doc, 'rect', {
            x, y: Math.min(valueY, zeroY), width: barWidth, height: Math.max(1, Math.abs(zeroY - valueY)),
            rx: 2, class: point.value < 0 ? 'bar bar--negative' : 'bar'
        });
        const title = svgElement(doc, 'title');
        title.textContent = `${view === 'budget' ? `Στοίχημα ${point.label}` : `Εβδομάδα ${point.label}`}: ${point.value.toLocaleString('el-GR', { maximumFractionDigits: 2 })} ${VIEWS[view].unit}`;
        bar.append(title);
        svg.append(bar);
        const label = svgElement(doc, 'text', { x: x + barWidth / 2, y: height - 16, 'text-anchor': 'middle', class: 'label' });
        label.textContent = point.label;
        svg.append(label);
    });
    target.replaceChildren(svg);
}

function mount(element, config) {
    if (!element || typeof element.replaceChildren !== 'function' || !element.ownerDocument) throw new TypeError('A DOM element is required');
    validateConfig(config);
    const doc = element.ownerDocument;
    const root = doc.createElement('div');
    root.className = 'f1s-betcast-widget';
    const label = doc.createElement('label');
    label.className = 'f1s-betcast-widget__label';
    label.textContent = 'Γράφημα BetCast ';
    const select = doc.createElement('select');
    select.className = 'f1s-betcast-widget__select';
    select.setAttribute('aria-label', 'Επιλογή γραφήματος BetCast');
    Object.entries(VIEWS).forEach(([value, optionLabel]) => {
        const option = doc.createElement('option');
        option.value = value;
        option.textContent = optionLabel.label;
        select.append(option);
    });
    select.value = config.view;
    label.append(select);
    const chart = doc.createElement('div');
    chart.className = 'f1s-betcast-widget__plot';
    root.append(label, chart);
    element.replaceChildren(root);
    const render = () => drawChart(chart, config.rows, select.value);
    select.addEventListener('change', render);
    render();
    let mounted = true;
    return function unmount() {
        if (!mounted) return;
        mounted = false;
        select.removeEventListener('change', render);
        if (root.parentNode === element) element.removeChild(root);
    };
}

module.exports = { mount, seriesFor, supportedViews: Object.keys(VIEWS) };
