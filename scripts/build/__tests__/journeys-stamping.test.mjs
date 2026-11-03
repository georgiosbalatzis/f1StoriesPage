import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';
import { validateJourneys } from '../validate-public-artifact.mjs';
import { stamperWorkspace } from './stamper-workspace.mjs';

const require = createRequire(import.meta.url);
const { injectJourneys } = require('../../../blog-module/build/journeys/pages.js');
const { BEGIN, END, journeyHtml, journeyRegions } = require('../../../blog-module/build/journeys/render.js');

const origin = 'https://f1-stories.gr';
const posts = [{ id: 'one', title: 'Πρώτο', date: '2026-01-01' }, { id: 'two', title: 'Δεύτερο', date: '2026-01-02' }];
const journey = { slug: 'synthetic', title: 'Σειρά', description: 'Περιγραφή', steps: [
    { position: 1, articleId: 'one', transition: 'Μετά το πρώτο.' }, { position: 2, articleId: 'two' }] };
const selected = [{ journey, eligible: true,
    steps: posts.map((post, i) => ({ ...post, position: i + 1, ...(i === 0 ? { transition: 'Μετά το πρώτο.' } : {}) })) }];
const page = post => `<!doctype html>\n<html><head><meta charset="utf-8"><title>${post.title}</title>`
    + `<link rel="canonical" href="${origin}/blog-module/blog-entries/${post.id}/article.html"></head><body>\n`
    + '<article class="rr">\n<div class="rr-body"><p>Κείμενο</p></div>\n  <section class="rr-pitwall" data-article-end>pit</section>\n</article>\n'
    + '<section class="rr-next">NEXT UP</section>\n<script defer src="/blog-module/blog/article-script.min.js"></script>\n</body></html>\n';

test('a journey region survives the real stamper, validates, and withdrawal returns the stamped baseline', t => {
    const { root, stamp } = stamperWorkspace(t, 'f1s-journey-stamp-');
    const blog = path.join(root, 'blog-module/blog-entries');
    const file = id => path.join(blog, id, 'article.html');
    const read = () => posts.map(post => fs.readFileSync(file(post.id), 'utf8'));
    for (const post of posts) {
        fs.mkdirSync(path.dirname(file(post.id)), { recursive: true });
        fs.writeFileSync(file(post.id), page(post));
    }
    fs.writeFileSync(path.join(root, 'blog-module/blog-index-data.json'), JSON.stringify({ p: posts.map(p => [p.id, '', '', p.date]) }));
    stamp();
    const baseline = read();
    assert.notEqual(baseline[0], page(posts[0]), 'the stamper rewrote the synthetic page');

    injectJourneys(blog, selected);
    stamp();
    const stamped = read();
    stamped.forEach((html, i) => {
        const regions = journeyRegions(html);
        assert.equal(regions.length, 1);
        assert.equal(html.slice(...regions[0]), `${BEGIN}\n${journeyHtml(selected[0], posts[i].id)}\n  ${END}`, 'stamping left the region untouched');
        assert.equal(html.slice(0, regions[0][0]) + html.slice(regions[0][1]), baseline[i], 'stamped bytes outside the region unchanged');
    });
    const errors = [];
    validateJourneys(errors, { distRoot: root, selected, today: '2026-11-03' });
    assert.deepEqual(errors, []);
    stamp();
    assert.deepEqual(read(), stamped, 'restamping is byte-stable');

    injectJourneys(blog, []);
    stamp();
    assert.deepEqual(read(), baseline);
});
