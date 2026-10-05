'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { gzipSync } = require('node:zlib');
const { test } = require('node:test');
const { seriesFor } = require('./widget-entry.cjs');

const rows = [
    { id: 1, betNumber: 1, week: 2, cumulativeBudget: 108, profitLoss: 8, stake: 10, result: 'Win' },
    { id: 2, betNumber: 2, week: 2, cumulativeBudget: 98, profitLoss: -10, stake: 10, result: 'Lose' },
    { id: 3, betNumber: 3, week: 3, cumulativeBudget: 103, profitLoss: 5, stake: 10, result: 'Win' }
];

test('pinned widget chart metrics use the BetCast snapshot arithmetic', () => {
    assert.deepEqual(seriesFor(rows, 'budget'), [
        { label: '1', value: 108 }, { label: '2', value: 98 }, { label: '3', value: 103 }
    ]);
    assert.deepEqual(seriesFor(rows, 'weeklyProfit'), [
        { label: '2', value: -2 }, { label: '3', value: 5 }
    ]);
    assert.deepEqual(seriesFor(rows, 'weeklyRoi'), [
        { label: '2', value: -10 }, { label: '3', value: 50 }
    ]);
    assert.deepEqual(seriesFor(rows, 'winRate'), [
        { label: '2', value: 50 }, { label: '3', value: 100 }
    ]);
});

test('widget rejects unsupported views and malformed row data', () => {
    assert.throws(() => seriesFor(rows, 'table'), /Unsupported BetCast widget config/);
    assert.throws(() => seriesFor([{ week: NaN }], 'budget'), /Invalid BetCast widget row/);
});

function createDom() {
    class Element {
        constructor(tag, ownerDocument) { this.tagName = tag; this.ownerDocument = ownerDocument; this.children = []; this.listeners = new Map(); this.attributes = {}; this.classList = { add: value => { this.className = `${this.className || ''} ${value}`.trim(); } }; }
        append(...nodes) { nodes.forEach(node => { node.parentNode = this; this.children.push(node); }); }
        replaceChildren(...nodes) { this.children.forEach(node => { node.parentNode = null; }); this.children = []; this.append(...nodes); }
        removeChild(node) { this.children = this.children.filter(item => item !== node); node.parentNode = null; }
        setAttribute(key, value) { this.attributes[key] = value; }
        addEventListener(key, fn) { this.listeners.set(key, fn); }
        removeEventListener(key, fn) { if (this.listeners.get(key) === fn) this.listeners.delete(key); }
        get parentNode() { return this._parentNode; }
        set parentNode(value) { this._parentNode = value; }
    }
    const document = {};
    document.createElement = tag => new Element(tag, document);
    document.createElementNS = (_ns, tag) => new Element(tag, document);
    return { Element, document };
}

test('built API is integrity-pinned and separate instances mount and unmount independently', () => {
    const directory = __dirname;
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
    const bundle = fs.readFileSync(path.join(directory, 'widget.js'));
    assert.equal(manifest.bytes, bundle.byteLength);
    assert.equal(manifest.gzipBytes, gzipSync(bundle).byteLength);
    assert.equal(manifest.integrity, `sha384-${createHash('sha384').update(bundle).digest('base64')}`);
    const context = {};
    vm.runInNewContext(bundle.toString('utf8'), context);
    const api = context.F1StoriesBetCastWidget;
    assert.equal(typeof api.mount, 'function');
    const dom = createDom();
    const first = new dom.Element('div', dom.document);
    const second = new dom.Element('div', dom.document);
    const stopFirst = api.mount(first, { rows, view: 'budget' });
    const stopSecond = api.mount(second, { rows: rows.slice(0, 1), view: 'budget' });
    assert.equal(first.children[0].children[1].children[0].attributes.viewBox, '0 0 680 260');
    const firstSelect = first.children[0].children[0].children[0];
    const secondChart = second.children[0].children[1].children[0];
    firstSelect.value = 'weeklyProfit';
    firstSelect.listeners.get('change')();
    assert.equal(first.children[0].children[1].children[0].attributes['aria-label'], 'Κέρδος ανά εβδομάδα');
    assert.equal(secondChart.attributes['aria-label'], 'Budget');
    assert.equal(first.children.length, 1);
    assert.equal(second.children.length, 1);
    stopFirst();
    assert.equal(first.children.length, 0);
    assert.equal(second.children.length, 1);
    stopFirst();
    stopSecond();
    assert.equal(second.children.length, 0);
});
