const assert = require('node:assert/strict');
const { test } = require('node:test');
const { setupTelemetryFigures } = require('../../blog/article-script');

class Element {
    constructor(tag = 'div') { this.nodeType = 1; this.tagName = tag; this.attributes = new Map(); this.children = []; this.listeners = new Map(); this.hidden = false; this.textContent = ''; this.classList = { add() {}, remove() {} }; }
    setAttribute(name, value) { this.attributes.set(name, value); }
    getAttribute(name) { return this.attributes.get(name) || null; }
    insertBefore(child) { this.children.unshift(child); child.parentElement = this; return child; }
    insertAdjacentElement(_where, child) { this.children.push(child); child.parentElement = this; return child; }
    matches(selector) { return selector === '.f1-telemetry-figure[data-telemetry-data][data-runtime-manifest]'; }
    querySelectorAll() { return []; }
    querySelector(selector) { return selector === 'button' ? this.children.find(child => child.tagName === 'button') || null : selector === '.f1-telemetry-source' ? this.source : selector === '.f1-telemetry-interactive-host' ? this.host : null; }
    addEventListener(type, callback) { this.listeners.set(type, callback); }
    async click() { return this.listeners.get('click')?.(); }
    remove() { this.removed = true; }
    focus() { this.focused = true; }
}

function fixture() {
    const figure = new Element('figure');
    figure.attributes.set('data-panel', 'telemetry-speed-trace');
    figure.attributes.set('data-telemetry-data', '/blog-module/blog-entries/demo/embeds/telemetry-aaaaaaaaaaaaaaaaaaaa-data.json');
    figure.attributes.set('data-runtime-manifest', '/telemetry/interactive/manifest.json');
    figure.source = new Element('p'); figure.host = new Element('div'); figure.host.hidden = true;
    const article = { querySelectorAll: () => [figure] };
    const doc = { baseURI: 'https://f1stories.gr/article/', documentElement: { getAttribute: () => 'dark' }, createElement: tag => new Element(tag) };
    const observers = [];
    class MutationObserver { constructor(callback) { this.callback = callback; observers.push(this); } observe() {} disconnect() {} }
    let calls = 0;
    const win = { MutationObserver, fetch: async () => { calls++; throw new Error('offline'); } };
    return { article, doc, figure, win, calls: () => calls, observers };
}

test('telemetry controls enhance only on click and a failed local load remains retryable', async () => {
    const { article, doc, figure, win, calls, observers } = fixture();
    const cleanup = setupTelemetryFigures(article, doc, win);
    const button = figure.querySelector('button');
    assert.ok(button, 'button is progressively added by article JavaScript');
    assert.equal(calls(), 0, 'no manifest or data request before explicit click');
    observers[0].callback([{ removedNodes: [], addedNodes: [] }]);
    const originalButton = button;
    await Promise.all([button.click(), button.click()]);
    assert.equal(calls(), 2, 'simultaneous clicks share one local manifest/data attempt');
    const status = button.children[0];
    assert.match(status.textContent, /στατική εικόνα/);
    assert.equal(figure.host.hidden, true);
    await button.click();
    assert.equal(calls(), 4, 'a failed runtime load can be retried');
    observers[0].callback([{ removedNodes: [figure], addedNodes: [] }]);
    assert.equal(originalButton.removed, true, 'removing the figure releases its progressive controls');
    observers[0].callback([{ removedNodes: [], addedNodes: [figure] }]);
    assert.notEqual(figure.querySelector('button'), originalButton, 'reinsertion receives fresh controls');
    cleanup();
});
