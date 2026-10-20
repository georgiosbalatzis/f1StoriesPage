import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { build } from 'esbuild';

const root = new URL('../../../', import.meta.url).pathname;
const { outputFiles } = await build({
    absWorkingDir: root,
    stdin: { contents: `
        export {start} from './scripts/perf/web-vitals-collector.js';
        import {onCLS, onINP, onLCP, onFCP, onTTFB} from 'web-vitals';
        export function reference(cb) { [onLCP,onINP,onCLS,onFCP,onTTFB].forEach(fn => fn(cb)); }
    `, resolveDir: root },
    bundle: true, format: 'iife', globalName: 'RUM', write: false
});
const key = 'f1stories-cookie-consent-v1';

function fixture({ consent = true, path = '/', width = 390, supported = true } = {}) {
    const listeners = new Map(), observers = [], timers = [], events = [], reference = [];
    const stored = new Map([[key, JSON.stringify({ analytics: consent })]]);
    const nav = { entryType: 'navigation', responseStart: 50, activationStart: 0, type: 'navigate' };
    const paints = [{ entryType: 'paint', name: 'first-contentful-paint', startTime: 100 }];
    const context = {
        console, URL, Map, Set, WeakMap, Date, Math,
        queueMicrotask: cb => timers.push(cb),
        Promise: { resolve: () => ({ then: cb => timers.push(cb) }) },
        location: { pathname: path, protocol: 'https:' },
        document: { readyState: 'complete', visibilityState: 'visible', prerendering: false, addEventListener: add, removeEventListener: remove },
        performance: { timeOrigin: 1700000000000, now: () => 1000, interactionCount: 0, getEntriesByType: type => type === 'navigation' ? [nav] : type === 'paint' ? paints : [] },
        localStorage: { getItem: name => stored.get(name) ?? null },
        innerWidth: width,
        addEventListener: add, removeEventListener: remove,
        setTimeout: cb => { timers.push(cb); return cb; }, clearTimeout: removeTimer,
        requestIdleCallback: cb => { timers.push(cb); return cb; }, cancelIdleCallback: removeTimer,
        requestAnimationFrame: cb => { timers.push(cb); return cb; },
        f1storiesAnalytics: { trackEvent: (name, params) => events.push({ name, ...params }) },
        PerformanceEventTiming: class {},
        PerformanceObserver: class {
            static supportedEntryTypes = supported ? ['paint', 'largest-contentful-paint', 'layout-shift', 'event', 'first-input'] : [];
            constructor(cb) { this.cb = cb; observers.push(this); }
            observe(options) {
                (this.types ||= new Set()).add(options.type); this.active = true;
                if (options.type === 'paint' && options.buffered) timers.push(() => this.cb({ getEntries: () => paints }));
            }
            takeRecords() { return []; }
            disconnect() { this.active = false; }
        }
    };
    context.PerformanceEventTiming.prototype.interactionId = 0;
    context.window = context;
    context.self = context;
    function add(name, cb, opts) { const list = listeners.get(name) || []; list.push({ cb, once: opts?.once }); listeners.set(name, list); }
    function remove(name, cb) { listeners.set(name, (listeners.get(name) || []).filter(x => x.cb !== cb)); }
    function removeTimer(cb) { const i = timers.indexOf(cb); if (i >= 0) timers.splice(i, 1); }
    function flush() { let limit = 1000; while (timers.length && limit--) timers.shift()(); assert.ok(limit > 0); }
    function dispatch(name, details = {}) {
        const event = { type: name, timeStamp: 1000, isTrusted: true, ...details };
        for (const item of [...(listeners.get(name) || [])]) { if (item.once) remove(name, item.cb); item.cb(event); }
        flush();
    }
    function entries(type, values) {
        for (const o of observers) if (o.active && o.types.has(type)) o.cb({ getEntries: () => values.map(v => ({ entryType: type, ...v })) });
        flush();
    }
    vm.createContext(context);
    vm.runInContext(outputFiles[0].text, context);
    context.RUM.start(consent);
    context.RUM.reference(m => reference.push({ name: m.name, value: m.value, rating: m.rating, nav: m.navigationType, id: m.id }));
    flush();
    return {
        context, events, reference, observers, flush, dispatch, entries,
        consent(value, viaStorage = false) {
            stored.set(key, JSON.stringify({ analytics: value }));
            dispatch(viaStorage ? 'storage' : 'f1stories:cookie-consent-changed', { key });
        },
        hidden() { context.document.visibilityState = 'hidden'; dispatch('visibilitychange'); dispatch('pagehide'); },
        visible() { context.document.visibilityState = 'visible'; dispatch('visibilitychange'); }
    };
}
function latest(page, name) { return page.events.filter(e => e.metric_name === name).at(-1); }
function matchesReference(page, name) {
    const actual = latest(page, name), expected = page.reference.filter(e => e.name === name).at(-1);
    assert.ok(actual, name); assert.ok(expected, name);
    assert.equal(actual.metric_value, expected.value * (name === 'CLS' ? 1000 : 1));
    assert.equal(actual.metric_rating, expected.rating);
    assert.equal(actual.nav_type, expected.nav);
}

test('zero CLS is an observation; no interactions produce no INP; pagehide does not duplicate', () => {
    const page = fixture();
    page.entries('largest-contentful-paint', [{ startTime: 500 }]);
    page.hidden();
    for (const name of ['CLS', 'LCP', 'FCP', 'TTFB']) matchesReference(page, name);
    assert.equal(latest(page, 'CLS').metric_value, 0);
    assert.equal(latest(page, 'INP'), undefined);
    const count = page.events.length;
    page.hidden();
    assert.equal(page.events.length, count);
    assert.equal(new Set(page.events.map(e => e.metric_id)).size, count);
});

test('CLS uses maximum session window, excludes recent input, continues after backgrounding', () => {
    const page = fixture();
    page.entries('layout-shift', [{ startTime: 100, value: .04 }, { startTime: 500, value: .05 }]);
    page.entries('layout-shift', [{ startTime: 2000, value: .06 }, { startTime: 2100, value: .8, hadRecentInput: true }]);
    page.hidden();
    assert.equal(latest(page, 'CLS').metric_value, 90);
    const id = latest(page, 'CLS').metric_id;
    page.visible();
    page.entries('layout-shift', [{ startTime: 4000, value: .15 }]);
    page.hidden();
    assert.equal(latest(page, 'CLS').metric_value, 150);
    assert.equal(latest(page, 'CLS').metric_id, id);
    assert.equal(latest(page, 'CLS').metric_revision, 2);
    matchesReference(page, 'CLS');
});

test('CLS session windows end after five seconds even with shifts less than a second apart', () => {
    const page = fixture();
    for (let i = 0; i < 6; i++) page.entries('layout-shift', [{ startTime: 100 + i * 900, value: .01 }]);
    page.entries('layout-shift', [{ startTime: 5500, value: .02 }]);
    page.hidden();
    assert.ok(Math.abs(latest(page, 'CLS').metric_value - 60) < 1e-9);
    matchesReference(page, 'CLS');
});

test('official INP selects p98 interaction, can decrease, and uses latest revision instead of maximum', () => {
    const page = fixture();
    page.context.performance.interactionCount = 1;
    page.entries('event', [{ interactionId: 7, duration: 400, startTime: 200 }]);
    page.hidden();
    assert.equal(latest(page, 'INP').metric_value, 400);
    page.visible();
    page.context.performance.interactionCount = 50;
    page.entries('event', Array.from({ length: 49 }, (_, i) => ({ interactionId: 14 + i * 7, duration: i === 0 ? 200 : 48, startTime: 300 + i * 50 })));
    page.hidden();
    assert.equal(latest(page, 'INP').metric_value, 200);
    assert.equal(latest(page, 'INP').metric_revision, 2);
    matchesReference(page, 'INP');
});

test('declined, withdrawn and cross-tab withdrawn consent suppress telemetry, including reaccept', () => {
    const declined = fixture({ consent: false });
    declined.hidden();
    assert.equal(declined.events.length, 0);
    for (const crossTab of [false, true]) {
        const page = fixture();
        page.consent(false, crossTab);
        const count = page.events.length;
        page.entries('layout-shift', [{ startTime: 500, value: .3 }]);
        page.hidden(); page.consent(true); page.visible(); page.hidden();
        assert.equal(page.events.length, count);
    }
});

test('BFCache uses fresh library IDs and official navigation type without restarting observers', () => {
    const page = fixture();
    page.hidden();
    const id = latest(page, 'CLS').metric_id, observers = page.observers.length;
    page.visible();
    page.dispatch('pageshow', { persisted: true, timeStamp: 1000 });
    page.hidden();
    assert.notEqual(latest(page, 'CLS').metric_id, id);
    assert.equal(latest(page, 'CLS').metric_revision, 1);
    assert.equal(latest(page, 'CLS').nav_type, 'back-forward-cache');
    assert.equal(latest(page, 'CLS').measurement_coverage, 'bfcache_observed');
    assert.equal(latest(page, 'CLS').nav_start_ms, 1700000001000);
    assert.equal(page.observers.length, observers);
    assert.equal(latest(page, 'INP'), undefined);
    matchesReference(page, 'CLS');
});

test('stable groups, coarse viewport, coverage, pinned version and allowlisted payload', () => {
    const version = JSON.parse(fs.readFileSync(new URL('../../../package.json', import.meta.url))).devDependencies['web-vitals'];
    for (const [path, group] of [['/', 'home'], ['/blog-module/blog/archive/2026/', 'edition'], ['/blog-module/blog-entries/old/article.html', 'article'], ['/standings/', 'standings'], ['/privacy/privacy.html', 'other']]) {
        const page = fixture({ path, width: 768 });
        page.hidden();
        const metric = latest(page, 'CLS');
        assert.equal(metric.page_group, group);
        assert.equal(metric.viewport_category, 'desktop_like');
        assert.equal(metric.measurement_coverage, 'delayed_existing');
        assert.equal(metric.observation_start_ms, 1000);
        assert.equal(metric.measurement_version, `wv${version}-rum1`);
        assert.deepEqual(Object.keys(metric).sort(), ['name', 'metric_name', 'metric_value', 'metric_id', 'metric_rating', 'nav_type', 'page_group', 'viewport_category', 'measurement_version', 'metric_revision', 'nav_start_ms', 'measurement_coverage', 'observation_start_ms'].sort());
    }
    const page = fixture({ supported: false });
    page.hidden();
    assert.equal(latest(page, 'CLS'), undefined);
    assert.equal(latest(page, 'INP'), undefined);
});

test('loader waits for consent, load and idle; repeated signals load exactly one local bundle', async () => {
    const source = fs.readFileSync(new URL('../web-vitals-beacon.js', import.meta.url), 'utf8').replace('import(RUM_COLLECTOR_URL)', 'loadCollector()');
    for (const initial of [false, true]) {
        const handlers = {}, idle = [], calls = [];
        let consent = initial;
        const context = {
            location: { protocol: 'https:' }, document: { readyState: 'interactive' },
            localStorage: { getItem: () => JSON.stringify({ analytics: consent }) },
            addEventListener: (name, cb) => (handlers[name] ||= []).push(cb),
            requestIdleCallback: cb => idle.push(cb),
            loadCollector: () => { calls.push('import'); return Promise.resolve({ start: existing => calls.push(existing) }); }
        };
        context.window = context;
    context.self = context;
        vm.runInNewContext(source, context);
        assert.equal(calls.length, 0);
        context.document.readyState = 'complete';
        (handlers.load || []).forEach(cb => cb());
        idle.splice(0).forEach(cb => cb());
        await Promise.resolve();
        if (!initial) {
            assert.equal(calls.length, 0);
            consent = true;
            handlers['f1stories:cookie-consent-changed'].forEach(cb => cb());
            idle.splice(0).forEach(cb => cb());
            await Promise.resolve();
        }
        handlers['f1stories:cookie-consent-changed'].forEach(cb => cb());
        assert.deepEqual(calls, ['import', initial]);
    }
});
