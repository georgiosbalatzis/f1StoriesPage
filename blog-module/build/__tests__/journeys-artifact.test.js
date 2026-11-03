const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const posts = [{ id: 'one', title: 'First', date: '2026-01-01' }, { id: 'two', title: 'Second', date: '2026-01-02' }, { id: 'three', title: 'Third', date: '2026-01-03' }];
const journey = { slug: 'test', title: 'Σειρά', description: 'Περιγραφή', steps: [
    { position: 1, articleId: 'one', transition: 'Μετά το πρώτο.' },
    { position: 2, articleId: 'two', transition: 'Μετά το δεύτερο.' },
    { position: 3, articleId: 'three' }
] };
// The model's selection shape: steps are the article records with their position and transition.
const steps = posts.map((post, i) => ({ ...post, position: i + 1, ...(journey.steps[i].transition ? { transition: journey.steps[i].transition } : {}) }));
const selected = [{ journey, steps, eligible: true }];
const origin = 'https://f1-stories.gr';
const base = post => `<html><head><link rel="canonical" href="${origin}/blog-module/blog-entries/${post.id}/article.html"></head><body><article>body\n<section class="rr-pitwall"></section></article></body></html>`;
function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'journeys-artifact-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const blog = path.join(root, 'blog-module/blog-entries');
    for (const post of [...posts, { id: 'other' }]) {
        const dir = path.join(blog, post.id);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'article.html'), base(post));
    }
    fs.writeFileSync(path.join(root, 'blog-module/blog-index-data.json'), JSON.stringify({ p: posts.map(p => [p.id, '', '', p.date]) }));
    return { root, blog, file: id => path.join(blog, id, 'article.html') };
}

test('journey injection is idempotent and withdrawal restores all original bytes', t => {
    const { injectJourneys } = require('../journeys/pages');
    const f = fixture(t);
    const originals = new Map([...posts, { id: 'other' }].map(p => [p.id, fs.readFileSync(f.file(p.id), 'utf8')]));
    assert.deepEqual(injectJourneys(f.blog, selected).sort(), posts.map(p => p.id).sort());
    const before = posts.map(p => [fs.readFileSync(f.file(p.id), 'utf8'), fs.statSync(f.file(p.id)).mtimeMs]);
    injectJourneys(f.blog, selected);
    assert.deepEqual(posts.map(p => [fs.readFileSync(f.file(p.id), 'utf8'), fs.statSync(f.file(p.id)).mtimeMs]), before);
    injectJourneys(f.blog, []);
    for (const [id, original] of originals) assert.equal(fs.readFileSync(f.file(id), 'utf8'), original);
});

test('artifact validator checks membership, sequence and published direct targets', async t => {
    const { injectJourneys } = require('../journeys/pages');
    const { validateJourneys } = await import(pathToFileURL(path.resolve(__dirname, '../../../scripts/build/validate-public-artifact.mjs')).href);
    const f = fixture(t);
    injectJourneys(f.blog, selected);
    const validate = (selection = selected) => { const errors = []; validateJourneys(errors, { distRoot: f.root, selected: selection, today: '2026-11-03' }); return errors; };
    assert.deepEqual(validate(), []);
    const one = f.file('one'), two = f.file('two'), other = f.file('other');
    const original = fs.readFileSync(one, 'utf8'), target = fs.readFileSync(two, 'utf8');
    const writeAndReject = (file, value) => { const previous = fs.readFileSync(file, 'utf8'); fs.writeFileSync(file, value); assert.notDeepEqual(validate(), []); fs.writeFileSync(file, previous); };
    const region = original.match(/<!-- f1s:journey:begin -->[\s\S]*?<!-- f1s:journey:end -->/)[0];
    writeAndReject(other, fs.readFileSync(other, 'utf8').replace('<section', `${region}<section`));
    writeAndReject(one, original.replace(region, ''));
    writeAndReject(one, original.replace(region, region + region));
    const links = [...region.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
    assert.equal(links.length, 2);
    writeAndReject(one, original.replace(links[0], 'TEMP').replace(links[1], links[0]).replace('TEMP', links[1]));
    writeAndReject(one, original.replace('</ol>', '<li><a href="/extra">Extra</a></li></ol>'));
    writeAndReject(one, original.replace(/<a\b[^>]*>[\s\S]*?<\/a>/, 'missing'));
    writeAndReject(two, target.replace('</head>', '<meta name="robots" content="noindex"></head>'));
    writeAndReject(two, target.replace('</head>', '<meta http-equiv="refresh" content="0;url=/"></head>'));
    // Any drift from the approved wording or the nav/sector-stop attributes, outside the list too.
    writeAndReject(one, original.replace('>Σειρά</h2>', '>Άλλη σειρά</h2>'));
    writeAndReject(one, original.replace('<p>Περιγραφή</p>', '<p>Άλλη περιγραφή</p>'));
    writeAndReject(one, original.replace('>Second</a>', '>Άλλος τίτλος</a>'));
    writeAndReject(one, original.replace(' aria-labelledby="rr-journey-title"', ''));
    writeAndReject(one, original.replace('<div class="rr-layout" data-article-end>', '<div class="rr-layout">'));
    const index = path.join(f.root, 'blog-module/blog-index-data.json');
    writeAndReject(index, JSON.stringify({ p: posts.map(p => [p.id, '', '', p.id === 'two' ? '2027-01-01' : p.date]) }));
    assert.notDeepEqual(validate([{ ...selected[0], eligible: false }]), []);
});

test('artifact validator accepts approved text with internal runs of whitespace', async t => {
    const { injectJourneys } = require('../journeys/pages');
    const { validateJourneys } = await import(pathToFileURL(path.resolve(__dirname, '../../../scripts/build/validate-public-artifact.mjs')).href);
    const f = fixture(t);
    const spaced = [{ journey: { ...journey, title: 'Σειρά  δύο', steps: [{ ...journey.steps[0], transition: 'Μετά  το πρώτο.' }, ...journey.steps.slice(1)] },
        steps: [{ ...steps[0], title: 'First  part', transition: 'Μετά  το πρώτο.' }, ...steps.slice(1)], eligible: true }];
    injectJourneys(f.blog, spaced);
    const errors = [];
    validateJourneys(errors, { distRoot: f.root, selected: spaced, today: '2026-11-03' });
    assert.deepEqual(errors, []);
});
