const test = require('node:test');
const assert = require('node:assert/strict');
const { journeyHtml, withJourney } = require('../journeys/render');
const { tags } = require('../html-attributes');

const selected = {
    journey: { slug: 'synthetic', title: 'Σειρά & <τίτλος>', description: 'Περιγραφή "δοκιμή" & <κείμενο>' },
    steps: [
        { id: 'first', title: 'Πρώτο <άρθρο>', position: 1, transition: 'Μετά & <επόμενο>' },
        { id: 'δεύτερο', title: 'Δεύτερο & "άρθρο"', position: 2, transition: 'Συνέχεια "τώρα"' },
        { id: 'last', title: 'Τελευταίο', position: 3 }
    ],
    eligible: true
};

for (let i = 0; i < selected.steps.length; i++) {
    test(`renders step ${i + 1} with authored order and current state`, () => {
        const html = journeyHtml(selected, selected.steps[i].id);
        const parsed = tags(html).filter(tag => !tag.close);
        const items = parsed.filter(tag => tag.name === 'li');
        const links = parsed.filter(tag => tag.name === 'a').map(tag => tag.attrs.href);
        const paths = ['/blog-module/blog-entries/first/article.html',
            '/blog-module/blog-entries/%CE%B4%CE%B5%CF%8D%CF%84%CE%B5%CF%81%CE%BF/article.html',
            '/blog-module/blog-entries/last/article.html'];
        assert.deepEqual(links, paths.filter((_, index) => index !== i));
        assert.equal(items.length, 3);
        assert.deepEqual(items.map(item => item.attrs['aria-current'] || ''), items.map((_, index) => index === i ? 'step' : ''));
        assert.match(html, new RegExp(`Μέρος ${i + 1} από 3`));
        assert.ok(html.includes(`<strong>${['Πρώτο &lt;άρθρο&gt;', 'Δεύτερο &amp; &quot;άρθρο&quot;', 'Τελευταίο'][i]}</strong> <span>(αυτό το άρθρο)</span>`));
        assert.equal(parsed.filter(tag => tag.name === 'h2').length, 1);
        assert.equal(parsed.filter(tag => tag.name === 'h1').length, 0);
        assert.equal(parsed.filter(tag => tag.name === 'ol').length, 1);
        assert.deepEqual(parsed.filter(tag => 'id' in tag.attrs).map(tag => tag.attrs.id), ['rr-journey-title']);
        assert.match(html, /^<div class="rr-layout" data-article-end><nav class="rr-body"/);
        assert.match(html, /Σειρά &amp; &lt;τίτλος&gt;/);
        assert.match(html, /Περιγραφή &quot;δοκιμή&quot; &amp; &lt;κείμενο&gt;/);
        if (i === 0) assert.match(html, /<strong>Επόμενο:<\/strong> Μετά &amp; &lt;επόμενο&gt;/);
        if (i === 1) assert.match(html, /<strong>Επόμενο:<\/strong> Συνέχεια &quot;τώρα&quot;/);
        if (i === 2) assert.match(html, /<p>Τέλος της σειράς\.<\/p>/);
        assert.equal(html.includes('Επόμενο:'), i < 2);
        assert.equal(html.includes('Τέλος της σειράς.'), i === 2);
    });
}

test('rejects a non-member', () => {
    assert.throws(() => journeyHtml(selected, 'unknown'), /not a journey member/);
});

const original = '<article>\n  <div>body</div>\n\n  <section class="rr-pitwall">pit</section>\n</article>\n<section class="rr-next"><p>NEXT UP</p></section>\n';
const next = '<section class="rr-next"><p>NEXT UP</p></section>';

test('inserts, replaces, strips and repeats without changing surrounding bytes', () => {
    const component = journeyHtml(selected, 'first');
    const inserted = withJourney(original, component);
    assert.ok(inserted.includes(`  <!-- f1s:journey:begin -->\n${component}\n  <!-- f1s:journey:end --><section class="rr-pitwall"`));
    // Every separator is inside the markers: cutting exactly the marker pair restores the page.
    assert.equal(inserted.replace(/<!-- f1s:journey:begin -->[\s\S]*<!-- f1s:journey:end -->/, ''), original);
    assert.equal(inserted.slice(inserted.indexOf(next)), original.slice(original.indexOf(next)));
    assert.equal(withJourney(inserted, component), inserted);
    const replacement = journeyHtml(selected, 'last');
    const replaced = withJourney(inserted, replacement);
    assert.equal(replaced, withJourney(original, replacement));
    assert.equal(withJourney(replaced, ''), original);
    assert.equal(withJourney(original, ''), original);
    const inline = '<article><section class="rr-pitwall"></section></article>';
    assert.equal(withJourney(withJourney(inline, component), ''), inline);
});

test('requires the pit wall for insertion and rejects incomplete markers', () => {
    assert.throws(() => withJourney('<article></article>', '<div>journey</div>'), /rr-pitwall/);
    assert.throws(() => withJourney('<section class="rr-pitwall"></section><section class="rr-pitwall"></section>', '<div>j</div>'), /rr-pitwall/);
    assert.throws(() => withJourney('<article><!-- f1s:journey:end --><section class="rr-pitwall"></section></article>', ''), /Malformed journey region/);
});

test('marker and anchor strings in comments or raw text stay body text', () => {
    const page = '<article><textarea><!-- f1s:journey:begin -->kept<!-- f1s:journey:end --></textarea>\n'
        + '<script>"<section class=\\"rr-pitwall\\">"</script><!-- <section class="rr-pitwall"> -->\n'
        + '  <section class="rr-pitwall">pit</section></article>';
    const component = journeyHtml(selected, 'first');
    const inserted = withJourney(page, component);
    assert.equal(inserted, page.replace('  <section class="rr-pitwall">pit',
        `  <!-- f1s:journey:begin -->\n${component}\n  <!-- f1s:journey:end --><section class="rr-pitwall">pit`));
    assert.equal(withJourney(inserted, component), inserted);
    assert.equal(withJourney(inserted, ''), page);
    assert.equal(withJourney(page, ''), page);
    // No pit wall: nothing to strip, body text with marker strings untouched.
    assert.equal(withJourney('<p><textarea><!-- f1s:journey:begin --></textarea></p>', ''), '<p><textarea><!-- f1s:journey:begin --></textarea></p>');
});
