const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const corrections = require('../../../scripts/author/article-corrections');
const { extractMetadata } = require('../metadata');
const { renderArticleHtml } = require('../article-render');
const sample = { type: 'factual-correction', date: '2026-01-16', section: 'Αρχή', reason: 'Διόρθωση <script> & "λόγος"', decision: 'approved', approvedBy: 'Synthetic Editor', approvedOn: '2026-01-16' };
const source = fields => `---\ncategory: News\ntitle: Δοκιμή\n${fields}\n---\n\nΚείμενο\n`;
const post = { id: '20260115G', title: 'Δοκιμή', author: 'F1 Stories', date: '2026-01-15', dateISO: '2026-01-15', category: 'News', categories: ['News'], excerpt: 'Περίληψη', image: '/blog-module/images/default-blog.jpg', backgroundImage: '/blog-module/images/default-blog.jpg', content: '<p>Κείμενο.</p>' };

test('browser and Node parse the same records and reject invalid data', () => {
    const context = {}; vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../../scripts/author/article-corrections.js'), 'utf8'), context);
    const json = corrections.serialize([sample, { ...sample, type: 'substantial-update' }]);
    assert.equal(context.F1S_ARTICLE_CORRECTIONS.serialize(context.F1S_ARTICLE_CORRECTIONS.parse(json)), json);
    assert.deepEqual(extractMetadata('source.txt', source(`corrections: ${json}`)).corrections, corrections.parse(json));
    for (const input of ['oops', JSON.stringify([{ ...sample, decision: 'pending' }]), JSON.stringify([{ ...sample, type: 'non-material-copy-edit' }]), JSON.stringify([{ ...sample, date: '2026-02-30' }]), JSON.stringify([sample, sample]), JSON.stringify([{ ...sample, extra: 1 }])]) {
        assert.throws(() => corrections.parse(input));
        assert.throws(() => context.F1S_ARTICLE_CORRECTIONS.parse(input));
    }
});

test('source controls correction rendering on fresh and cached paths and preserves identity', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'f1-corrections-'));
    const file = path.join(dir, 'source.txt');
    try {
        fs.writeFileSync(file, source(''));
        const baseline = await renderArticleHtml(post, dir);
        fs.writeFileSync(file, source(`updatedDateISO: 2026-01-16\ncorrections: ${corrections.serialize([sample])}`));
        const fresh = await renderArticleHtml(post, dir);
        const cached = await renderArticleHtml({ ...post, corrections: [sample], updatedDateISO: '2026-01-16' }, dir);
        assert.equal(fresh, cached);
        assert.match(fresh, /<details class="article-trust" open/);
        assert.match(fresh, /Διόρθωση &lt;script&gt; &amp; "λόγος"/);
        for (const pattern of [/<link rel="canonical"[^>]+>/, /<meta property="og:url"[^>]+>/, /"datePublished":\s*"[^"]+"/]) assert.equal(fresh.match(pattern)?.[0], baseline.match(pattern)?.[0]);
        assert.match(fresh, /"dateModified":\s*"2026-01-16"/);
        fs.writeFileSync(file, source(''));
        assert.equal(await renderArticleHtml({ ...post, corrections: [sample] }, dir), baseline);
        fs.writeFileSync(file, source(`corrections: ${corrections.serialize([sample])}`));
        await assert.rejects(renderArticleHtml(post, dir), /correction dates/);
        fs.writeFileSync(file, source(`updatedDateISO: 2026-01-17\ncorrections: ${corrections.serialize([sample])}`));
        await assert.rejects(renderArticleHtml(post, dir), /correction dates/);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('source parser preserves correction JSON exactly through a source round trip', () => {
    const context = { console }; context.window = context;
    for (const name of ['blog-module/taxonomy.js', 'scripts/author/article-corrections.js', 'scripts/author/article-source.js']) {
        vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../..', name), 'utf8'), context);
    }
    const json = JSON.stringify([sample], null, 0).replace(':', ': ');
    const parsed = context.F1S_AUTHOR_ARTICLE_SOURCE.parseSourceText(source(`corrections: ${json}`));
    const rebuilt = context.F1S_AUTHOR_ARTICLE_SOURCE.buildSourceText(parsed.tags, parsed.category, parsed.title, parsed.body, parsed.metadata);
    assert.equal(context.F1S_AUTHOR_ARTICLE_SOURCE.parseSourceText(rebuilt).metadata.corrections, json);
    assert.throws(() => context.F1S_AUTHOR_ARTICLE_SOURCE.parseSourceText(source('corrections: [] broken')));
});

test('both source parsers reject repeated correction fields before any record can be discarded', () => {
    const context = { console }; context.window = context;
    for (const name of ['blog-module/taxonomy.js', 'scripts/author/article-corrections.js', 'scripts/author/article-source.js']) {
        vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../..', name), 'utf8'), context);
    }
    for (const first of ['', '[]', JSON.stringify([{ ...sample, decision: 'pending' }]), corrections.serialize([sample])]) {
        const text = source(`corrections: ${first}\n corrections : []`);
        assert.throws(() => context.F1S_AUTHOR_ARTICLE_SOURCE.parseSourceText(text), /Duplicate corrections field/);
        assert.throws(() => extractMetadata('source.txt', text), /Duplicate corrections field/);
    }
});
