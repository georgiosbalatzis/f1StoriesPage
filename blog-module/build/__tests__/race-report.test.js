const test = require('node:test');
const assert = require('node:assert/strict');
const { transformBody, renderRunningOrder, coverVariant, topLevelBlocks, toolOpenUrl } = require('../race-report');
const { wordsInHtml } = require('../reading-time');

const long = 'Λέξη '.repeat(30).trim() + '.';
const tool = src => `<div class="embed-container embed-iframe">\n<iframe\n                src="${src}"\n                title="Debrief Παρασκευής — F1 Stories"\n                loading="lazy">\n            </iframe>\n</div>`;
const debrief = 'https://f1-stories.gr/standings/?tab=debrief&amp;focus=panel-debrief&amp;embed=1&amp;debriefRound=16';
const ghost = 'https://georgiosbalatzis.github.io/ghostcar/?y=2026&amp;mk=1308&amp;embed=1';

test('F1 Stories tools become numbered data bands; the iframe and its URL are untouched', () => {
    const body = `<p>${long}</p>\n${tool(debrief)}\n<p>${long}</p>\n${tool(ghost)}\n<div class="embed-container embed-iframe"><iframe src="https://sketchfab.com/models/x/embed" title="Model"></iframe></div>`;
    const out = transformBody(body);
    assert.equal(out.dataCount, 2);
    assert.match(out.html, /<section class="rr-data" id="data-1" aria-labelledby="data-1-title">[\s\S]*DATA 01<span>\/02<\/span>[\s\S]*DEBRIEF/);
    assert.match(out.html, /id="data-2"[\s\S]*GHOST CAR/);
    assert.ok(out.html.includes(`src="${debrief}"`), 'the embed URL, season and round parameters are kept verbatim');
    assert.match(out.html, /href="https:\/\/f1-stories\.gr\/standings\/\?tab=debrief&amp;focus=panel-debrief&amp;debriefRound=16"[^>]*target="_blank" rel="noopener">Άνοιγμα εργαλείου/);
    assert.match(out.html, /<a href="#after-data-1">Συνέχεια κειμένου[\s\S]*<span class="rr-anchor" id="after-data-1"><\/span>/);
    assert.match(out.html, /sketchfab[\s\S]*<\/div>$/, 'third-party embeds stay in the column');
    assert.doesNotMatch(out.html.split('sketchfab')[0].slice(-200), /rr-data__screen/);
    assert.deepEqual(out.entries.map(e => e.type), ['data', 'data']);
});

test('the transform is idempotent, so published bodies can be re-rendered every build', () => {
    const body = `<p>${long}</p>\n<p>Η εξέλιξη του δεύτερου stint</p>\n<p>${long}</p>\n${tool(debrief)}\n<p>Τίτλος γραφήματος</p>\n<p>Μια σύντομη περιγραφή.\n<figure class="article-figure"><img src="3.webp" class="article-content-img"><figcaption>Image 3</figcaption></figure></p>\n<p>${long}</p>`;
    const once = transformBody(body);
    const twice = transformBody(once.html);
    assert.equal(twice.html, once.html);
    assert.deepEqual(twice.entries, once.entries);
});

test('a chart keeps its own title and description in one panel; the import label is Greek', () => {
    const out = transformBody(`<p>${long}</p>\n<p>Εξέλιξη της διαφοράς</p>\n<p>Η διαφορά ανά γύρο.\n<figure class="article-figure"><img src="3.webp"><figcaption>Image 3</figcaption></figure></p>\n<p>${long}</p>`);
    assert.match(out.html, /<div class="rr-chart">\n<p class="rr-chart__title">Εξέλιξη της διαφοράς<\/p>\n<p class="rr-chart__desc">Η διαφορά ανά γύρο\.<\/p>\n<figure class="article-figure">[\s\S]*<figcaption>Εικ\. 1<\/figcaption><\/figure>\n<\/div>/);
    assert.equal(out.sections, 0, 'a chart title is not a section');
});

test('paragraph subheads become headings only when the body has no authored ones', () => {
    const plain = transformBody(`<p>${long}</p>\n<p>Οι κυρίαρχοι της νύχτας</p>\n<p>${long}</p>\n<p>FP3 1ος Leclerc | 2ος Verstappen</p>\n<p>${long}</p>\n<p>Μια πρόταση με τελεία.</p>\n<p>${long}</p>\n<p>Το ραντεβού με τη νύχτα</p>\n<p>${long}</p>`);
    assert.match(plain.html, /<h2 id="section-1" class="rr-subhead">Οι κυρίαρχοι της νύχτας<\/h2>/);
    assert.match(plain.html, /<h2 id="section-2" class="rr-subhead">Το ραντεβού με τη νύχτα<\/h2>/);
    assert.equal(plain.sections, 2, 'results lines and sentences stay paragraphs');
    const authored = transformBody(`<h2>Πραγματικός τίτλος</h2>\n<p>${long}</p>\n<p>Σύντομη γραμμή</p>\n<p>${long}</p>`);
    assert.doesNotMatch(authored.html, /rr-subhead/);
    assert.match(authored.html, /<h2 id="section-1">Πραγματικός τίτλος<\/h2>/);
    const kept = transformBody(`<h3 id="mine">Δικό μου id</h3>\n<p>${long}</p>`);
    assert.equal(kept.entries[0].id, 'mine', 'an authored id is kept');
});

test('the running order lists only what the body contains', () => {
    assert.equal(renderRunningOrder(transformBody(`<p>${long}</p>\n<p>${long}</p>`).entries), '');
    const html = renderRunningOrder(transformBody(`<h2>Α &amp; Β</h2>\n<p>${long}</p>\n${tool(debrief)}`).entries);
    assert.ok(html.includes('href="#section-1"><span class="rr-ro__no">01</span><span class="rr-ro__label">Α &amp; Β</span>'), 'heading text is carried once-escaped');
    assert.ok(!transformBody('<h2>Α <em>&lt;b&gt;</em></h2>').entries[0].label.includes('<'), 'no markup reaches the label');
    assert.match(html, /<li class="is-data"><a href="#data-1"><span class="rr-ro__no">DATA<\/span><span class="rr-ro__label">DEBRIEF<\/span>/);
});

test('top-level blocks keep inline runs and whitespace byte for byte', () => {
    const body = 'Κείμενο <strong>έντονο</strong>, συνέχεια.\n<p>Παράγραφος</p>\n<!-- σχόλιο -->\n<script>if (a < b) {}</script>';
    assert.equal(transformBody(body).html, body);
    assert.deepEqual(topLevelBlocks(body).map(b => b.tag), ['#text', 'strong', '#text', 'p', '#comment', 'script']);
});

test('cover composition never stretches a small or portrait photograph', () => {
    assert.equal(coverVariant(1600, 1067), 'bleed');
    assert.equal(coverVariant(1200, 675), 'split');
    assert.equal(coverVariant(1024, 576), 'inset', 'shorter than the split cover');
    assert.equal(coverVariant(474, 266), 'inset');
    assert.equal(coverVariant(1600, 2133), 'inset', 'portrait');
    assert.equal(coverVariant(0, 0), 'inset');
});

test('data band furniture is not counted as reading', () => {
    const body = `<p>ένα δύο τρία</p>\n${tool(debrief)}`;
    assert.equal(wordsInHtml(transformBody(body).html), wordsInHtml(body));
    assert.equal(toolOpenUrl('https://georgiosbalatzis.github.io/Tyres/embed/el/2026/sepang/3d/'), 'https://georgiosbalatzis.github.io/Tyres/embed/el/2026/sepang/3d/');
});
