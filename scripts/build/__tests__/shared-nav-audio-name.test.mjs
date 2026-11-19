import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { DOMParser } from '@xmldom/xmldom';

const audioUrl = 'https://anchor.fm/s/101588098/podcast/play/123/audio.mp3';
const directUrl = 'https://d3ctxlq1ktw2nl.cloudfront.net/staging/2026-9-7/audio.mp3';
const feedUrl = 'https://anchor.fm/s/101588098/podcast/rss';
const flush = () => new Promise(resolve => setImmediate(resolve));

function mountPlayer(snapshot, readyState = 'loading', liveAudio = audioUrl) {
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
    const document = { readyState, querySelector: () => nav, createElement: () => new Element(), createTextNode: text => ({ textContent: text }) };
    const window = { location: { search: '' }, addEventListener(name, fn) { this[name] = fn; } }; window.self = window.top = window;
    let audio;
    class Audio extends Element { constructor() { super(); audio = this; } play() { return Promise.resolve(); } pause() { this.events.pause?.(); } }
    const source = readFileSync(new URL('../../shared-nav.js', import.meta.url), 'utf8');
    const start = source.indexOf('    var BETCAST_FEED');
    const end = source.indexOf('\n    initAudioPlayer();', start);
    const requests = [];
    const context = {
        window, document, Audio, URL, DOMParser, sessionStorage: { getItem: () => null, setItem() {} },
        loadNavSnapshot: async () => snapshot,
        fetch: async url => {
            requests.push(url);
            return { ok: true, text: async () => `<rss><channel><item><enclosure type="audio/mpeg" url="${liveAudio}"/></item></channel></rss>` };
        },
        setTimeout: () => 1, clearTimeout() {}, isFinite, Date
    };
    vm.runInNewContext(source.slice(start, end) + '\ninitAudioPlayer();', context);
    return { root: nav.children[0], window, requests, getAudio: () => audio };
}

test('audio name contains the visible label through idle, buffering, playing and error', async () => {
    const { root, requests, getAudio } = mountPlayer({ audioUrl });
    const button = root.children[0];
    const text = node => (node.textContent || '') + (node.children || []).map(text).join('');
    const visible = text(button.children[0].children[1]);
    const check = (action, busy) => { assert.equal(visible, 'ON AIR.'); assert.ok(button.attrs['aria-label'].includes(visible)); assert.match(button.attrs['aria-label'], action); assert.equal(button.attrs['aria-busy'], String(busy)); };
    assert.equal(button.children[1].attrs['aria-hidden'], 'true');
    assert.equal(text(button), 'ON AIR.');
    assert.equal(button.children[1].children[1].attrs['data-label'], visible);
    check(/^Αναπαραγωγή/, false);
    await flush();
    assert.deepEqual(requests, []);
    button.events.click(); check(/^Παύση/, false);
    const audio = getAudio();
    assert.equal(audio.src, audioUrl);
    audio.events.waiting(); check(/^Παύση/, true);
    audio.events.playing(); check(/^Παύση/, false);
    audio.events.error(); check(/^Αναπαραγωγή/, false);
    assert.ok(root.children[1].textContent);
});

test('both audio paths reject unapproved origins and path prefixes', async () => {
    for (const invalid of ['https://example.com/audio.mp3', 'https://youtube.com./audio.mp3',
        audioUrl.replace('anchor.fm', 'anchor.fm.'), audioUrl.replace('101588098', '101588099')]) {
        const rejected = mountPlayer({ audioUrl: invalid }, 'complete', invalid);
        await flush();
        assert.deepEqual(rejected.requests, [feedUrl]);
        rejected.root.children[0].events.click();
        assert.equal(rejected.getAudio(), undefined);

        const accepted = mountPlayer({ audioUrl: invalid }, 'complete', directUrl);
        await flush();
        assert.deepEqual(accepted.requests, [feedUrl]);
        accepted.root.children[0].events.click();
        assert.equal(accepted.getAudio().src, directUrl);
    }
});

test('missing snapshot audio waits for window load before fetching the live feed', async () => {
    for (const snapshot of [{}, { races: [] }]) {
        const { window, requests } = mountPlayer(snapshot);
        await flush();
        assert.deepEqual(requests, []);
        window.load();
        await flush();
        assert.deepEqual(requests, [feedUrl]);
    }
    const { requests } = mountPlayer({}, 'complete');
    await flush();
    assert.deepEqual(requests, [feedUrl]);
});
