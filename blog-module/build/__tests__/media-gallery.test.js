const assert = require('node:assert/strict');
const test = require('node:test');
const { buildImageCarousel } = require('../media');

test('one photograph remains viewable without carousel navigation', async () => {
    const html = await buildImageCarousel('20261007W', [3]);
    assert.match(html, /gallery-slide active/);
    assert.match(html, /3\.webp/);
    assert.doesNotMatch(html, /gallery-carousel-prev|gallery-carousel-next|gallery-carousel-counter|gallery-carousel-thumbs|aria-roledescription/);
});

test('multiple photographs retain arrows, counter and thumbnail navigation', async () => {
    const html = await buildImageCarousel('20261007W', [2, 3]);
    assert.match(html, /aria-label="Προηγούμενη φωτογραφία" disabled/);
    assert.match(html, /aria-label="Επόμενη φωτογραφία"/);
    assert.match(html, /gallery-carousel-counter">1 \/ 2/);
    assert.equal((html.match(/class="gallery-thumb[ "]/g) || []).length, 2);
});
