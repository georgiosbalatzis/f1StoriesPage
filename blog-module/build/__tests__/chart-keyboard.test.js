const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('chart arrows scroll the focused region without intercepting child controls or page navigation', () => {
    const listeners = {};
    const scroller = { scrollWidth: 680, clientWidth: 358, scrollLeft: 0,
        addEventListener(type, handler) { listeners[type] = handler; } };
    let ready;
    const document = {
        querySelector: () => null,
        querySelectorAll: selector => selector === '.rr-chart__scroll' ? [scroller] : [],
        addEventListener(type, handler) { if (type === 'DOMContentLoaded') ready = handler; }
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../blog/article-script.js'), 'utf8'), { document, window: { location: { href: 'https://f1-stories.gr/article.html' } }, console });
    ready();
    function key(name, target = scroller) {
        let prevented = false;
        listeners.keydown({ key: name, target, preventDefault() { prevented = true; } });
        return prevented;
    }
    assert.equal(key('ArrowRight'), true);
    assert.equal(scroller.scrollLeft, 64);
    assert.equal(key('ArrowLeft'), true);
    assert.equal(scroller.scrollLeft, 0);
    assert.equal(key('ArrowRight', {}), false);
    assert.equal(key('PageDown'), false);
    assert.equal(scroller.scrollLeft, 0);
    scroller.clientWidth = scroller.scrollWidth;
    assert.equal(key('ArrowRight'), false);
});
