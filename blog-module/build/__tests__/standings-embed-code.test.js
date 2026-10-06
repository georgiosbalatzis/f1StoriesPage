const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { test } = require('node:test');
const { buildEmbedHtml } = require('../embed-render');

// The pasted embed code must survive the article build with its accessible name and fallback height.
test('standings embed code keeps title, height and lazy loading through the article sanitizer', async () => {
    const { embedIframeHTML } = await import(pathToFileURL(path.join(__dirname, '..', '..', '..', 'standings', 'core', 'embed.js')).href);
    const src = 'https://f1stories.gr/standings/?tab=drivers&focus=drivers-chart&embed=1&season=2026&round=16';
    const title = 'Γράφημα βαθμών οδηγών — F1 Stories';
    const code = embedIframeHTML(src, title, 490);

    assert.match(code, /^<iframe src="https:\/\/f1stories\.gr\/standings\/\?tab=drivers&amp;focus=drivers-chart&amp;embed=1&amp;season=2026&amp;round=16"/);
    assert.ok(!code.includes('decoding'), 'decoding is not a valid iframe attribute');
    assert.ok(!code.includes('min-height'), 'a min-height would fight the resize bridge');

    const html = buildEmbedHtml({ type: 'raw-iframe', src, value: code });
    assert.ok(html.includes(`title="${title}"`), 'title survives');
    assert.match(html, /style="[^"]*display:block;[^"]*width:100%;[^"]*height:490px;[^"]*border:0;?"/);
    assert.ok(html.includes('loading="lazy"'));
    assert.ok(html.includes('referrerpolicy="strict-origin-when-cross-origin"'));
    assert.ok(html.includes('embed=1') && html.includes('round=16'));
    assert.ok(!html.includes('Iframe blocked'), 'f1stories.gr is whitelisted');
});

test('standings embed code escapes hostile titles and sources', async () => {
    const { embedIframeHTML } = await import(pathToFileURL(path.join(__dirname, '..', '..', '..', 'standings', 'core', 'embed.js')).href);
    const code = embedIframeHTML('https://f1stories.gr/standings/?a="><script>', 'x" onload="alert(1)', 5);
    assert.ok(!code.includes('"><script>') && !code.includes('" onload="'));
    assert.match(code, /height:100px/, 'height has a sane floor');
});
