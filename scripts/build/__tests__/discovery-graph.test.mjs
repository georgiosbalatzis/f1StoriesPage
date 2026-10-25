import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { collectDiscovery, newDiscovery, validateDiscoveryGraph } from '../validate-public-artifact.mjs';

const SITE = 'https://f1-stories.gr';
const hub = 'blog-module/blog/entities/drivers/x/index.html';
const story = id => `blog-module/blog-entries/${id}/article.html`;
const today = '2026-10-20';

function artifact(t, rows) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'discovery-graph-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    fs.mkdirSync(path.join(dir, 'blog-module'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'blog-module/blog-index-data.json'), JSON.stringify({ v: 2, p: rows.map(([id, date]) => [id, `T ${id}`, 0, date]) }));
    return dir;
}
const nextUp = ids => `<section class="rr-next"><div class="rr-next__grid">${ids.map(id => `<a href="/${story(id)}">${id}</a>`).join('')}</div><div class="article-navigation"></div></section>`;
const kicker = (topics = []) => `<p class="rr-kicker"><a href="/blog-module/blog/section/news/">Ειδήσεις</a>${topics.map(href => `<a href="${href}">Θέμα</a>`).join('')}<span id="reading-time-value">4</span></p>`;
function site(pages) {
    const discovery = newDiscovery();
    for (const [relPath, html] of Object.entries(pages)) collectDiscovery(discovery, html, relPath);
    return discovery;
}
const run = (t, pages, { sitemap = [], approved = [hub], rows = [['a', '2026-01-01'], ['b', '2026-02-01'], ['c', '2026-03-01']] } = {}) => {
    const errors = [];
    validateDiscoveryGraph(errors, site(pages), new Set(sitemap.map(file => `${SITE}/${file.replace(/index\.html$/, '')}`)),
        { distRoot: artifact(t, rows), approvedFiles: new Set(approved), today });
    return errors;
};
const home = links => `<a href="/${links.join('"></a><a href="/')}"></a>`;
const good = () => ({
    'index.html': home([story('a'), story('b'), story('c'), 'blog-module/blog/entities/drivers/x/']),
    [story('a')]: kicker(['/blog-module/blog/entities/drivers/x/']) + nextUp(['b', 'c']),
    [story('b')]: kicker() + nextUp(['a', 'c']),
    [story('c')]: kicker() + nextUp(['a', 'b']),
    [hub]: `<ol><li><a href="/${story('a')}">a</a></li></ol>`
});

test('a sound discovery graph passes', t => {
    assert.deepEqual(run(t, good(), { sitemap: ['index.html', story('a'), story('b'), story('c'), hub] }), []);
});

test('NEXT UP may not repeat a story, link itself, an unpublished, a future or a redirect page', t => {
    const pages = good();
    pages[story('a')] = kicker() + nextUp(['b', 'b', 'a', 'z', 'f', 'r']);
    pages[story('r')] = '<meta http-equiv="refresh" content="0;url=/">';
    const errors = run(t, pages, { rows: [['a', '2026-01-01'], ['b', '2026-02-01'], ['c', '2026-03-01'], ['f', '2026-12-01'], ['r', '2026-01-01']] });
    assert.deepEqual(errors, [
        `${story('a')}: duplicate NEXT UP link /${story('b')}`,
        `${story('a')}: NEXT UP links the story itself`,
        `${story('a')}: NEXT UP links /${story('z')}, which is not a published story`,
        `${story('a')}: NEXT UP links /${story('f')}, dated 2026-12-01`,
        `${story('a')}: NEXT UP links the redirect page /${story('r')}`
    ]);
});

test('a link to a pending or unknown topic hub fails wherever it appears, and an empty hub fails', t => {
    const pages = good();
    pages[story('b')] = kicker(['/blog-module/blog/entities/teams/pending/']) + nextUp(['a', 'c']);
    pages['blog-module/blog/section/news/index.html'] = '<nav class="ed-aside__block" aria-labelledby="ed-topics-title"><a href="/blog-module/blog/entities/teams/pending/">x</a><a href="/blog-module/blog/entities/teams/pending/">x</a></nav>';
    pages[hub] = '<h1>No stories</h1>';
    const errors = run(t, pages);
    assert.ok(errors.includes(`${story('b')}: links /blog-module/blog/entities/teams/pending/, which is not an approved public topic hub`));
    assert.ok(errors.includes('blog-module/blog/section/news/index.html: duplicate topic list link /blog-module/blog/entities/teams/pending/'));
    assert.ok(errors.includes(`${hub}: an approved topic hub must list its stories`));
});

test('a sitemap page unreachable through static links from the homepage fails', t => {
    const pages = good();
    pages['blog-module/blog/section/news/page/9/index.html'] = '<a href="/">home</a>';
    const errors = run(t, pages, { sitemap: [story('a'), 'blog-module/blog/section/news/page/9/index.html'] });
    assert.deepEqual(errors, [`sitemap.xml: ${SITE}/blog-module/blog/section/news/page/9/ is not reachable from the homepage through static links`]);
});
