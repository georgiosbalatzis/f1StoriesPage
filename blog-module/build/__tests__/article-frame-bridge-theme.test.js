const assert = require('node:assert/strict');
const { test } = require('node:test');
const { setupStandingsFrameBridge, setupTelemetryFrameBridge } = require('../../blog/article-script');

// Real documents always have documentElement; `theme` mirrors the host's data-theme attribute
// (the main site stores dark as "no attribute", light as data-theme="light").
function themeFixture(bridge, theme = null, src = 'https://f1-stories.gr/telemetry/?embed=1', initialHref = null) {
    const observers = [];
    const mkFrame = () => ({
        src,
        dataset: {},
        style: { removeProperty() {} },
        contentWindow: { messages: [], location: initialHref ? { href: initialHref } : undefined, postMessage(data, origin) { this.messages.push({ data, origin }); } },
        getAttribute(name) { return name === 'src' ? this.src : null; },
        setAttribute() {},
        addEventListener(type, listener) { if (type === 'load') this.loadListener = listener; },
    });
    const frames = [mkFrame(), mkFrame()];
    class MutationObserver {
        constructor(callback) { this.callback = callback; observers.push(this); }
        observe(target, options) { this.options = options; }
        disconnect() {}
    }
    const documentElement = { theme, getAttribute(name) { return name === 'data-theme' ? this.theme : null; } };
    const listeners = new Map();
    const timers = { set: 0, cleared: 0 };
    const win = {
        location: { href: 'https://f1-stories.gr/blog-module/blog-entries/example/article.html', origin: 'https://f1-stories.gr' },
        MutationObserver,
        addEventListener(type, listener) { listeners.set(type, listener); },
        removeEventListener() {},
        setTimeout() { return ++timers.set; },
        clearTimeout() { timers.cleared++; },
    };
    const cleanup = bridge({ querySelectorAll: () => frames }, { documentElement }, win);
    const themes = frame => frame.contentWindow.messages.filter(m => m.data.type === 'f1s-telemetry:theme').map(m => m.data.theme);
    const resizeType = bridge === setupStandingsFrameBridge ? 'f1s-standings:resize' : 'f1s-telemetry:resize';
    const resize = (frame, height = 600) => listeners.get('message')({ data: { type: resizeType, height }, source: frame.contentWindow, origin: new URL(src).origin });
    return { cleanup, frames, documentElement, observers, themes, resize, timers };
}

test('telemetry bridge sends light only for an explicit light host and dark otherwise', () => {
    for (const [attr, expected] of [['light', 'light'], [null, 'dark'], ['dark', 'dark'], ['bogus', 'dark']]) {
        const { cleanup, frames, themes } = themeFixture(setupTelemetryFrameBridge, attr);
        assert.deepEqual(themes(frames[0]), [expected], String(attr));
        cleanup();
    }
});

test('every telemetry frame receives the theme on setup, and again whenever the host theme flips', () => {
    const { cleanup, frames, documentElement, observers, themes } = themeFixture(setupTelemetryFrameBridge, 'light');
    const themeObserver = observers.find(o => o.options && o.options.attributeFilter);
    assert.ok(themeObserver, 'a data-theme attribute observer is registered on documentElement');
    assert.deepEqual(themeObserver.options.attributeFilter, ['data-theme']);
    for (const frame of frames) assert.deepEqual(themes(frame), ['light']);

    documentElement.theme = null;
    themeObserver.callback();
    for (const frame of frames) assert.deepEqual(themes(frame), ['light', 'dark']);
    cleanup();
});

test('a frame load event re-sends measure and the current theme, so a late-loading embed is never left on its own theme', () => {
    const { cleanup, frames, documentElement, themes } = themeFixture(setupTelemetryFrameBridge, 'light');
    documentElement.theme = null; // host flipped to dark while the second frame was still loading
    const types = () => frames[1].contentWindow.messages.map(m => m.data.type);
    const before = types().length;
    frames[1].loadListener();
    assert.deepEqual(types().slice(before), ['f1s-telemetry:measure', 'f1s-telemetry:theme']);
    assert.deepEqual(themes(frames[1]), ['light', 'dark']);
    assert.deepEqual(themes(frames[0]), ['light']); // frame 0 has not loaded again, only the flip observer reaches it
    cleanup();
});

test('a telemetry frame whose listener missed the early theme gets it again on its first resize, and retries keep running', () => {
    // Regression for the intermittent light embed in a dark article: the embed's first (unsolicited) resize used to cancel
    // the retry schedule although the theme sent while it was still loading had been dropped.
    const { cleanup, frames, themes, resize, timers } = themeFixture(setupTelemetryFrameBridge, null);
    const cancelledBefore = timers.cleared;
    assert.deepEqual(themes(frames[0]), ['dark']);
    resize(frames[0]);
    assert.deepEqual(themes(frames[0]), ['dark', 'dark'], 'theme re-sent when the embed first reports');
    assert.equal(timers.cleared, cancelledBefore, 'scheduled retries are not cancelled by the first resize');
    resize(frames[0], 640);
    resize(frames[0], 660);
    assert.deepEqual(themes(frames[0]), ['dark', 'dark'], 'later resizes do not re-send (no resize/theme ping-pong)');
    assert.deepEqual(themes(frames[1]), ['dark'], 'other frames are unaffected');
    cleanup();
});

test('a lazy frame that has not navigated yet gets no messages (no console noise); its load event delivers measure and theme', () => {
    const { cleanup, frames, themes } = themeFixture(setupTelemetryFrameBridge, 'light', 'https://f1-stories.gr/telemetry/?embed=1', 'about:blank');
    for (const frame of frames) assert.equal(frame.contentWindow.messages.length, 0, 'nothing is posted to an about:blank frame');
    for (const frame of frames) { frame.contentWindow.location = undefined; frame.loadListener(); } // navigated: a loaded cross-origin frame's location is unreadable
    for (const frame of frames) assert.deepEqual(themes(frame), ['light'], 'the load event delivers the theme');
    cleanup();
});

test('standings embeds still stop their retries on the first resize and never receive a theme', () => {
    const { cleanup, frames, resize, timers } = themeFixture(setupStandingsFrameBridge, 'light', 'https://f1-stories.gr/standings/?embed=1');
    const before = timers.cleared;
    resize(frames[0]);
    assert.ok(timers.cleared > before, 'retries cancelled once the standings frame reports');
    assert.equal(frames[0].contentWindow.messages.some(m => /theme/.test(m.data.type)), false);
    cleanup();
});

test('standings embeds are never sent a theme message', () => {
    const { cleanup, frames } = themeFixture(setupStandingsFrameBridge, 'light', 'https://f1-stories.gr/standings/?embed=1');
    assert.equal(frames[0].dataset.f1sStandingsManaged, 'true');
    assert.ok(frames[0].contentWindow.messages.length > 0);
    assert.equal(frames[0].contentWindow.messages.some(m => /theme/.test(m.data.type)), false);
    cleanup();
});
