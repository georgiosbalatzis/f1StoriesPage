import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = fs.readFileSync(new URL('../../shared-nav.js', import.meta.url), 'utf8');
const helper = source.slice(source.indexOf('    function afterFirstPaintWork'), source.indexOf('    var THEME_KEY'));
function setup({ hidden = false, complete = false, unsupported = false, throws = false } = {}) {
    let id = 0, calls = 0, observer;
    const timers = new Map(), frames = new Map(), documentEvents = new Map(), windowEvents = new Map();
    const document = { visibilityState: hidden ? 'hidden' : 'visible', readyState: complete ? 'complete' : 'loading',
        addEventListener: (type, fn) => documentEvents.set(type, fn), removeEventListener: type => documentEvents.delete(type) };
    const window = { addEventListener: (type, fn) => windowEvents.set(type, fn), removeEventListener: type => windowEvents.delete(type),
        setTimeout(fn, delay) { const key = ++id; timers.set(key, { fn, delay }); return key; }, clearTimeout: key => timers.delete(key),
        requestAnimationFrame(fn) { const key = ++id; frames.set(key, fn); return key; }, cancelAnimationFrame: key => frames.delete(key) };
    class PerformanceObserver {
        static supportedEntryTypes = unsupported ? [] : ['largest-contentful-paint'];
        constructor(cb) { if (throws) throw Error(); this.cb = cb; observer = this; }
        observe(options) { assert.equal(options.type, 'largest-contentful-paint'); assert.equal(options.buffered, true); }
        disconnect() { this.disconnected = true; }
    }
    vm.runInNewContext(helper + '\nafterFirstPaintWork(work);', { document, window, PerformanceObserver, work: () => calls++ });
    const runFrame = () => { const [key, fn] = frames.entries().next().value; frames.delete(key); fn(); };
    const runTimer = delay => { const [key, item] = [...timers].find(([, value]) => value.delay === delay); timers.delete(key); item.fn(); };
    const clean = () => { assert.equal(timers.size, 0); assert.equal(frames.size, 0); assert.equal(documentEvents.size, 0); assert.equal(windowEvents.size, 0); if (observer) assert.equal(observer.disconnected, true); };
    return { document, documentEvents, windowEvents, timers, runFrame, runTimer, clean, calls: () => calls,
        entry: url => observer.cb({ getEntries: () => [{ url }] }) };
}
test('image before load fires at load', () => { const s = setup(); s.entry('hero'); assert.equal(s.calls(), 0); s.windowEvents.get('load')(); assert.equal(s.calls(), 1); s.clean(); });
test('image after load fires at entry', () => { const s = setup(); s.windowEvents.get('load')(); assert.equal(s.calls(), 0); s.entry('hero'); assert.equal(s.calls(), 1); s.clean(); });
test('text only waits 250 ms after load', () => { const s = setup({ complete: true }); s.entry(''); assert.equal(s.calls(), 0); s.runTimer(250); assert.equal(s.calls(), 1); s.clean(); });
test('unsupported or throwing observer uses load, two frames and task', () => { for (const options of [{ unsupported: true }, { throws: true }]) { const s = setup(options); s.windowEvents.get('load')(); s.runFrame(); s.runFrame(); assert.equal(s.calls(), 0); s.runTimer(0); assert.equal(s.calls(), 1); s.clean(); } });
test('hidden at call or visibility change runs immediately', () => { const s = setup({ hidden: true }); assert.equal(s.calls(), 1); s.clean(); const t = setup(); t.document.visibilityState = 'hidden'; t.documentEvents.get('visibilitychange')(); assert.equal(t.calls(), 1); t.clean(); });
test('hard fallback fires if load never arrives', () => { const s = setup(); s.runTimer(8000); assert.equal(s.calls(), 1); s.clean(); });
test('stale triggers cannot run work twice', () => { const s = setup(); const load = s.windowEvents.get('load'), visibility = s.documentEvents.get('visibilitychange'), fallback = [...s.timers.values()][0].fn; load(); s.entry('hero'); s.entry('hero'); fallback(); visibility(); assert.equal(s.calls(), 1); s.clean(); });
