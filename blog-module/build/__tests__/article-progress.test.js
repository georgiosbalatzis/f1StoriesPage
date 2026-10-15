const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../blog/article-script.js'), 'utf8');
const setup = source.slice(source.indexOf('    function setupRaceReport()'), source.indexOf('    function loadScriptOnce'));

test('reading progress batches geometry before writes and follows scroll and resize without caching stale positions', () => {
    const calls = [];
    const listeners = {};
    const attributes = {};
    const navigator = {};
    let shareClick, copied = 0, shared = 0;
    let coverBottom = 200, bodyTop = 300, bodyHeight = 2000, endTop = 2300;
    let headingTop = 400;
    let queued;
    let scheduled = 0;
    const classes = { toggle: () => calls.push('write') };
    const rect = value => { calls.push('read'); return value; };
    const section = { id: 'section', textContent: 'Section title', querySelector: () => null,
        getBoundingClientRect: () => rect({ top: headingTop }) };
    const articleContent = { getBoundingClientRect: () => rect({ top: bodyTop, height: bodyHeight }), querySelectorAll: () => [section] };
    const meter = { setAttribute: (key, value) => { calls.push('write'); attributes[key] = value; } };
    const current = { textContent: 'Article title' };
    const link = { getAttribute: () => '#section', setAttribute: (key, value) => { attributes[key] = value; }, removeAttribute: key => delete attributes[key] };
    const bar = { classList: classes, style: { setProperty: (key, value) => { calls.push('write'); attributes[key] = value; } },
        setAttribute: (key, value) => { calls.push('write'); attributes[key] = value; },
        querySelector: selector => selector === '[role="progressbar"]' ? meter : current, querySelectorAll: () => [] };
    const nodes = { '#rr-sectorbar-share': { addEventListener: (_, fn) => { shareClick = fn; } },
        '#copy-link-btn': { click: () => { copied++; } }, '#web-share-btn': { click: () => { shared++; } }, '#rr-sectorbar': bar, '[data-cover]': { getBoundingClientRect: () => rect({ bottom: coverBottom }) },
        '[data-article-end]': { getBoundingClientRect: () => rect({ top: endTop }) } };
    const window = { innerHeight: 900, addEventListener: (type, handler) => { listeners[type] = handler; } };
    vm.runInNewContext(setup + '\nsetupRaceReport();', { articleContent, window, navigator, document: { body: { classList: classes } },
        $: selector => nodes[selector] || null, $$: selector => selector === '.rr-ro a' ? [link] : [],
        requestAnimationFrame: fn => { scheduled++; queued = fn; return 1; } });
    function assertBatched() {
        const firstWrite = calls.indexOf('write');
        assert.ok(firstWrite > 0);
        assert.ok(!calls.slice(firstWrite).includes('read'), 'no geometry read follows a DOM write');
    }
    assertBatched();
    shareClick(); assert.equal(copied, 1);
    navigator.share = () => {}; shareClick(); assert.equal(shared, 1);
    assert.equal(bar.inert, true);
    assert.equal(attributes['aria-valuenow'], '1');
    calls.length = 0;
    coverBottom = 0; bodyTop = -500; headingTop = 100;
    listeners.scroll(); listeners.scroll(); assert.equal(scheduled, 1);
    queued(); assertBatched();
    assert.equal(bar.inert, false);
    assert.equal(attributes['aria-current'], 'location');
    assert.equal(current.textContent, 'Section title');
    assert.equal(attributes['aria-valuenow'], '41');
    calls.length = 0;
    // Image/iframe growth and viewport changes must be measured on the next frame.
    bodyHeight = 4000; window.innerHeight = 768;
    listeners.resize(); queued(); assertBatched();
    assert.equal(attributes['aria-valuenow'], '19');
    calls.length = 0;
    endTop = 100; listeners.scroll(); queued(); assertBatched();
    assert.equal(bar.inert, true);
});
