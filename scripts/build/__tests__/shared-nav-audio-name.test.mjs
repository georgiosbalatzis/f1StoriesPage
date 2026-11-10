import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('audio name contains the visible label through idle, buffering, playing and error', async () => {
    class Element {
        constructor() { this.children = []; this.attrs = {}; this.events = {}; this.style = { setProperty() {} }; this.classList = { toggle() {}, add() {}, remove() {} }; this.textContent = ''; }
        appendChild(child) { this.children.push(child); return child; }
        insertBefore(child) { return this.appendChild(child); }
        setAttribute(key, value) { this.attrs[key] = value; }
        getAttribute(key) { return this.attrs[key]; }
        querySelector() { return null; }
        addEventListener(name, fn) { this.events[name] = fn; }
        removeEventListener() {}
    }
    const nav = new Element();
    const document = { readyState: 'loading', querySelector: () => nav, createElement: () => new Element(), createTextNode: text => ({ textContent: text }) };
    const window = { location: { search: '' }, addEventListener(name, fn) { this[name] = fn; } }; window.self = window.top = window;
    let audio;
    class Audio extends Element { constructor() { super(); audio = this; } play() { return Promise.resolve(); } pause() { this.events.pause?.(); } }
    const source = readFileSync(new URL('../../shared-nav.js', import.meta.url), 'utf8');
    const start = source.indexOf('    function initAudioPlayer()');
    const end = source.indexOf('\n    initAudioPlayer();', start);
    const context = { window, document, Audio, sessionStorage: { getItem: () => null, setItem() {} }, fetch: () => Promise.resolve({ ok: true, text: () => Promise.resolve('feed') }), newestEnclosure: () => 'https://example.com/audio.mp3', BETCAST_FEED: 'feed', setTimeout: () => 1, clearTimeout() {}, isFinite, Date };
    vm.runInNewContext(source.slice(start, end) + '\ninitAudioPlayer();', context);
    const root = nav.children[0], button = root.children[0];
    const text = node => (node.textContent || '') + (node.children || []).map(text).join('');
    const visible = text(button.children[0].children[1]);
    const check = (action, busy) => { assert.equal(visible, 'ON AIR.'); assert.ok(button.attrs['aria-label'].includes(visible)); assert.match(button.attrs['aria-label'], action); assert.equal(button.attrs['aria-busy'], String(busy)); };
    assert.equal(button.children[1].attrs['aria-hidden'], 'true');
    assert.equal(text(button), 'ON AIR.');
    assert.equal(button.children[1].children[1].attrs['data-label'], visible);
    check(/^Αναπαραγωγή/, false);
    window.load(); await new Promise(resolve => setImmediate(resolve));
    button.events.click(); check(/^Παύση/, false);
    audio.events.waiting(); check(/^Παύση/, true);
    audio.events.playing(); check(/^Παύση/, false);
    audio.events.error(); check(/^Αναπαραγωγή/, false);
    assert.ok(root.children[1].textContent);
});
