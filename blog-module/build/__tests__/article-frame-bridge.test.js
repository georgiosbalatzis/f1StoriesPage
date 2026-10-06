const assert = require('node:assert/strict');
const { test } = require('node:test');
const { setupBetCastFrameBridge, setupStandingsFrameBridge } = require('../../blog/article-script');

function fixture(src = 'https://georgiosbalatzis.github.io/BetCastVisualisation/?embed=1&presentation=article&theme=host') {
    const listeners = new Map();
    const observers = [];
    const fallbackLinks = [];
    const parent = { querySelector: () => fallbackLinks[0] || null };
    const frame = {
        src,
        dataset: {},
        style: { height: '', removed: [], removeProperty(name) { this.removed.push(name); } },
        contentWindow: { messages: [], postMessage(data, origin) { this.messages.push({ data, origin }); } },
        parentElement: parent,
        getAttribute(name) { return name === 'src' ? this.src : null; },
        addEventListener(type, listener) { listeners.set(type, listener); },
        insertAdjacentElement(_, link) { fallbackLinks.push(link); },
    };
    class MutationObserver {
        constructor(callback) { this.callback = callback; observers.push(this); }
        observe() {}
        disconnect() { this.disconnected = true; }
    }
    const documentElement = { theme: 'dark', getAttribute() { return this.theme; } };
    const doc = { documentElement, querySelectorAll: () => [frame], createElement: () => ({}) };
    const win = {
        location: { href: 'https://f1stories.gr/blog-module/blog-entries/example/article.html' },
        MutationObserver,
        addEventListener(type, listener) { listeners.set(type, listener); },
        removeEventListener(type) { listeners.delete(type); },
        setTimeout(callback, _delay, ...args) { return setTimeout(() => callback(...args), 100000); },
        clearTimeout(timer) { clearTimeout(timer); },
    };
    const cleanup = setupBetCastFrameBridge({ querySelectorAll: () => [frame] }, doc, win);
    return { cleanup, doc, fallbackLinks, frame, listeners, observers };
}

test('managed BetCast frames request measurement and keep fallback analysis links', () => {
    const { cleanup, frame, fallbackLinks } = fixture();
    assert.equal(frame.dataset.f1sBetcastManaged, 'true');
    assert.equal(frame.contentWindow.messages[0].data.type, 'betcast:measure');
    assert.equal(frame.contentWindow.messages[0].origin, 'https://georgiosbalatzis.github.io');
    assert.equal(fallbackLinks[0].href, 'https://georgiosbalatzis.github.io/BetCastVisualisation/');
    assert.equal(fallbackLinks[0].textContent, 'Άνοιγμα BetCast ↗');
    cleanup();
});

test('host accepts only a matching frame, origin, message shape, and sane integer height', () => {
    const { cleanup, doc, frame, listeners, observers } = fixture();
    const onMessage = listeners.get('message');
    const message = (data, source = frame.contentWindow, origin = 'https://georgiosbalatzis.github.io') => onMessage({ data, source, origin });
    for (const height of [99, 12001, Infinity, 120.5]) message({ type: 'betcast:resize', height });
    message({ type: 'betcast:resize', height: 500, extra: true });
    message({ type: 'betcast:resize', height: 500 }, {}, 'https://georgiosbalatzis.github.io');
    message({ type: 'betcast:resize', height: 500 }, frame.contentWindow, 'https://evil.example');
    assert.equal(frame.style.height, '');
    assert.deepEqual(frame.style.removed, []);

    message({ type: 'betcast:resize', height: 612 });
    assert.equal(frame.style.height, '612px');
    assert.deepEqual(frame.style.removed, ['min-height']);
    assert.equal(frame.dataset.f1sBetcastReady, 'true');
    assert.deepEqual(frame.contentWindow.messages.at(-1), {
        data: { type: 'betcast:theme', theme: 'dark' },
        origin: 'https://georgiosbalatzis.github.io',
    });
    doc.documentElement.theme = 'light';
    observers[1].callback();
    assert.deepEqual(frame.contentWindow.messages.at(-1), {
        data: { type: 'betcast:theme', theme: 'light' },
        origin: 'https://georgiosbalatzis.github.io',
    });
    cleanup();
});

test('unapproved iframe URLs are left outside the managed adapter', () => {
    const { cleanup, frame } = fixture('https://f1stories.gr/standings/?embed=1');
    assert.equal(frame.dataset.f1sBetcastManaged, undefined);
    assert.equal(frame.contentWindow.messages.length, 0);
    cleanup();
});

function standingsFixture(src = 'https://f1stories.gr/standings/?tab=drivers&focus=drivers-chart&embed=1') {
    const listeners = new Map();
    const attrs = {};
    const frame = {
        src,
        dataset: {},
        style: { height: '', removed: [], removeProperty(name) { this.removed.push(name); } },
        contentWindow: { messages: [], postMessage(data, origin) { this.messages.push({ data, origin }); } },
        getAttribute(name) { return name === 'src' ? this.src : attrs[name] ?? null; },
        setAttribute(name, value) { attrs[name] = value; },
        addEventListener(type, listener) { listeners.set(type, listener); },
    };
    class MutationObserver {
        observe() {}
        disconnect() {}
    }
    const win = {
        location: { href: 'https://f1stories.gr/blog-module/blog-entries/example/article.html', origin: 'https://f1stories.gr' },
        MutationObserver,
        addEventListener(type, listener) { listeners.set(type, listener); },
        removeEventListener(type) { listeners.delete(type); },
        setTimeout(callback, _delay, ...args) { return setTimeout(() => callback(...args), 100000); },
        clearTimeout(timer) { clearTimeout(timer); },
    };
    const cleanup = setupStandingsFrameBridge({ querySelectorAll: () => [frame] }, {}, win);
    return { cleanup, frame, listeners, attrs };
}

test('standings frames request measurement from their own origin', () => {
    const { cleanup, frame } = standingsFixture();
    assert.equal(frame.dataset.f1sStandingsManaged, 'true');
    assert.deepEqual(frame.contentWindow.messages[0], { data: { type: 'f1s-standings:measure' }, origin: 'https://f1stories.gr' });
    cleanup();
});

test('standings host accepts only a matching frame, origin, message shape, and sane integer height', () => {
    const { cleanup, frame, listeners, attrs } = standingsFixture();
    const onMessage = listeners.get('message');
    const message = (data, source = frame.contentWindow, origin = 'https://f1stories.gr') => onMessage({ data, source, origin });
    for (const height of [99, 12001, Infinity, 120.5, '500']) message({ type: 'f1s-standings:resize', height });
    message({ type: 'f1s-standings:resize', height: 500, extra: true });
    message({ type: 'f1s-standings:resize', height: 500 }, {});
    message({ type: 'f1s-standings:resize', height: 500 }, frame.contentWindow, 'https://evil.example');
    message({ type: 'betcast:resize', height: 500 });
    assert.equal(frame.style.height, '');
    assert.deepEqual(frame.style.removed, []);

    message({ type: 'f1s-standings:resize', height: 777 });
    assert.equal(frame.style.height, '777px');
    assert.deepEqual(frame.style.removed, ['min-height']);
    assert.equal(frame.dataset.f1sStandingsReady, 'true');
    assert.equal(attrs.scrolling, 'no');
    cleanup();
});

test('standings bridge ignores non-standings, non-embed and foreign-origin frames', () => {
    for (const src of [
        'https://f1stories.gr/standings/?tab=drivers',
        'https://f1stories.gr/other/?embed=1',
        'https://evil.example/standings/?embed=1',
        'https://georgiosbalatzis.github.io/BetCastVisualisation/?embed=1',
    ]) {
        const { cleanup, frame } = standingsFixture(src);
        assert.equal(frame.dataset.f1sStandingsManaged, undefined, src);
        assert.equal(frame.contentWindow.messages.length, 0, src);
        cleanup();
    }
});
