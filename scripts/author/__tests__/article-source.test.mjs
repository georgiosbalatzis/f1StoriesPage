#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..', '..');
const SOURCE_PATH = path.join(REPO_ROOT, 'scripts', 'author', 'article-source.js');

function loadArticleSource() {
    const context = { console };
    context.window = context;
    vm.runInNewContext(fs.readFileSync(path.join(REPO_ROOT, 'blog-module', 'taxonomy.js'), 'utf8'), context);
    vm.runInNewContext(fs.readFileSync(SOURCE_PATH, 'utf8'), context, {
        filename: SOURCE_PATH
    });
    return context.window.F1S_AUTHOR_ARTICLE_SOURCE;
}

const articleSource = loadArticleSource();

assert.equal(articleSource.normalizeZipPath('\\folder\\source.txt'), 'folder/source.txt');
assert.equal(articleSource.normalizeZipPath('./folder/source.txt'), 'folder/source.txt');
assert.equal(articleSource.normalizeZipPath('/folder/source.txt'), 'folder/source.txt');

const parsed = articleSource.parseSourceText('F1 Race-Analysis\r\n\r\nTitle\r\n\r\nBody line 1\r\nBody line 2\r\n');
assert.ok(parsed.tags.includes('F1'));
assert.equal(parsed.category, 'Analysis');
assert.equal(parsed.title, 'Title');
assert.equal(parsed.body, 'Body line 1\nBody line 2');

const decoded = articleSource.parseSourceText('Long-Tag Race-Analysis\n\nTitle\n\nBody\n', {
    decodeHeaderTokens: true
});
assert.ok(decoded.tags.includes('Long Tag'));
assert.equal(decoded.category, 'Analysis');

const fallback = articleSource.parseSourceText('');
assert.equal(fallback.tag, '');
assert.equal(fallback.category, 'News');
assert.equal(fallback.title, '');
assert.equal(fallback.body, '');

assert.equal(
    articleSource.buildSourceText('Lewis Hamilton, Ferrari F1', 'Analysis', 'A: title', 'Body\r\nnext'),
    '---\ncategory: Analysis\ntags: Lewis Hamilton, Ferrari F1\ntitle: A: title\n---\n\nBody\nnext\n'
);
assert.throws(() => articleSource.buildSourceText('', 'Racing,-Ferrari-F1', 'Title', 'Body'), /public category/);

const legacy = articleSource.parseSourceText('  \nF1 Racing,-2026,-Lewis-Hamilton,-Ferrari-F1\n\nA: legacy title\n\nFirst paragraph.\n\n[img-instert-tag]\n\nLast paragraph.\n');
assert.ok(legacy.tags.includes('Lewis Hamilton'));
assert.ok(legacy.tags.includes('Ferrari F1'));
const migrated = articleSource.parseSourceText(articleSource.buildSourceText(legacy.tags, legacy.category, legacy.title, legacy.body));
assert.equal(migrated.title, legacy.title);
assert.equal(migrated.body, legacy.body);
assert.deepEqual(Array.from(migrated.tags), Array.from(legacy.tags));

const frontmatter = articleSource.parseSourceText('\uFEFF\r\n---\r\ncategory: Opinion\r\ntags: Lewis Hamilton, Technical\r\ntitle: Tomorrow: a different grid\r\nauthor: F1 Stories Team\r\nexcerpt: One: two\r\n---\r\n\r\nAn article with\r\n\r\nmultiple paragraphs.\r\n');
assert.equal(frontmatter.category, 'Opinion');
assert.equal(frontmatter.categories.join(','), 'Opinion', 'Internal tag aliases must not add public categories to explicit frontmatter');
assert.equal(frontmatter.title, 'Tomorrow: a different grid');
assert.equal(frontmatter.body, 'An article with\n\nmultiple paragraphs.');
const rebuilt = articleSource.parseSourceText(articleSource.buildSourceText(frontmatter.tags, frontmatter.category, frontmatter.title, frontmatter.body, frontmatter.metadata));
assert.equal(rebuilt.metadata.author, 'F1 Stories Team');
assert.equal(rebuilt.metadata.excerpt, 'One: two');
assert.equal(rebuilt.body, frontmatter.body);
assert.equal(rebuilt.tags.join(','), frontmatter.tags.join(','));

const blankTags = articleSource.parseSourceText(articleSource.buildSourceText('', 'News', 'No tags', 'Body'));
assert.equal(blankTags.tags.length, 0);
assert.equal(blankTags.category, 'News');

const migratedSeries = articleSource.parseSourceText('F1 Racing\n\nBetcast #264\n\nBody', { id: '20260523J' });
assert.equal(migratedSeries.category, 'Betting', 'Editing a legacy series must retain its reviewed category');

const legacyFrontmatter = articleSource.parseSourceText('---\ncategory: Racing,-History,-Lewis-Hamilton\ntitle: A legacy frontmatter article\n---\n\nBody');
assert.equal(legacyFrontmatter.category, 'History');
assert.ok(legacyFrontmatter.tags.includes('Lewis Hamilton'));
assert.ok(legacyFrontmatter.tags.includes('Racing'));

console.log('author article source tests passed.');

{
    const { titleWarnings } = loadArticleSource();
    assert.equal(titleWarnings('Michael Schumacher Schumacher', '').length, 1, 'repeated adjacent word');
    assert.equal(titleWarnings('Ο Massa και ο Schumacher', '').length, 0, 'clean title');
    assert.equal(titleWarnings('CHARLES LECLERC Ο ΑΙΩΝΙΟΣ ΔΙΑΔΟΧΟΣ', '').length, 1, 'mostly capitals');
    assert.equal(titleWarnings('GP Καναδά 2025 🏁', '').length, 1, 'emoji in title');
    assert.equal(titleWarnings('Καθαρός τίτλος', '## Ενότητα 🔥\nκείμενο').length, 1, 'emoji in heading');
    assert.equal(titleWarnings('F1 και F1 Academy', '').length, 0, 'non-adjacent repeat is fine');
    const { titleIssues, stripEmoji } = loadArticleSource();
    assert.deepEqual(Array.from(titleIssues('ΤΟ ΜΕΓΑΛΟ ΣΑΒΒΑΤΟΚΥΡΙΑΚΟ 🏁', ''), issue => issue.code), ['caps', 'emoji']);
    assert.equal(titleIssues('Michael Schumacher Schumacher', '')[0].word, 'Schumacher');
    assert.equal(stripEmoji('🏁 GP Μαϊάμι 2025 – Ανάλυση 🧠📊'), 'GP Μαϊάμι 2025 – Ανάλυση');
    assert.equal(stripEmoji('Ο Piastri στο Zandvoort 🇳🇱🏆'), 'Ο Piastri στο Zandvoort');
    assert.equal(stripEmoji('Φύγαμε 🚀!'), 'Φύγαμε!');
    assert.equal(stripEmoji('Καθαρός τίτλος'), 'Καθαρός τίτλος');
    console.log('titleWarnings: ok');
}

{
    const { internalLinkCount, linkWarnings } = articleSource;
    const body = [
        'Όπως γράψαμε στην [προηγούμενη ανάλυση](/blog-module/blog-entries/20261001G/article.html),',
        'και ξανά [εδώ](https://www.f1-stories.gr/blog-module/blog-entries/20261001G/article.html#section-2),',
        'δείτε τα [Τεχνικά](https://f1-stories.gr/blog-module/blog/section/technical/index.html) και τον [Lando Norris](/blog-module/blog/entities/drivers/lando-norris/).',
        'Εξωτερικά: [F1](https://www.formula1.com/), [ενότητα](#section-1), ![εικόνα](/images/x.webp), [χωρίς πρωτόκολλο](//evil.example/).'
    ].join('\n');
    assert.equal(internalLinkCount(body), 3, 'the same story twice counts once; other sites, fragments and images do not count');
    assert.deepEqual(Array.from(linkWarnings(body)), []);
    assert.match(linkWarnings('Κείμενο με [έναν](/standings/) σύνδεσμο.')[0], /^Ένας μόνο εσωτερικός σύνδεσμος/);
    assert.match(linkWarnings('Κείμενο χωρίς συνδέσμους.')[0], /^Κανένας εσωτερικός σύνδεσμος.*2–3/);
    assert.deepEqual(Array.from(linkWarnings('')), [], 'an empty body is reported by its own blocking issue');
    console.log('linkWarnings: ok');
}

// The author tools and the build apply one description contract: same normalisation, count, codes and messages.
const description = createRequire(import.meta.url)('../../../blog-module/build/description.js');
const plain = value => JSON.parse(JSON.stringify(value));
assert.equal(articleSource.DESCRIPTION_MAX, description.DESCRIPTION_MAX);
[
    undefined, '', '   ', 'Ferrari', 'Ferrari Mercedes', 'Η Ferrari κερδίζει', '  Η   Ferrari\nκερδίζει στη Μόντσα  ',
    'Η <b>Ferrari</b> κερδίζει', 'McLaren &amp; Mercedes στη μάχη', 'Ο &#8217;Lewis στη Ferrari', 'R&D, AT&T και 3 < 4 στη μάχη',
    `${'α'.repeat(151)} β γ`, `${'α'.repeat(152)} β γ`, `${'🏎️'.repeat(150)} β γ δ`, `${'🇬🇷'.repeat(160)} α β`,
    `${'έ'.repeat(150)} α β γ`, 'Τι έγινε; Η Ferrari· «ναι»', 'κρυφό­κείμενο​ εδώ τώρα'
].forEach(value => {
    assert.equal(articleSource.normalizeExcerpt(value), description.normalizeText(value), String(value));
    assert.equal(articleSource.descriptionLength(value), description.graphemes(description.normalizeText(value)).length, String(value));
    const issues = articleSource.excerptIssues(value);
    assert.deepEqual(plain(issues), description.excerptIssues(value), String(value));
    issues.forEach(issue => assert.equal(articleSource.excerptMessage(issue), description.excerptMessage(issue)));
});
assert.equal(articleSource.descriptionLength('🏎️🇬🇷έ'), 3);

// The description is one front-matter line, written exactly once and read back unchanged with the other fields.
const withExcerpt = articleSource.buildSourceText('Ferrari', 'Technical', 'Τίτλος', 'Σώμα', { excerpt: 'Πώς η «Ferrari» & η McLaren κερδίζουν: ανάλυση.', sources: 'Πηγή | https://example.com/a' });
assert.deepEqual(withExcerpt.match(/^excerpt: .*$/gm), ['excerpt: Πώς η «Ferrari» & η McLaren κερδίζουν: ανάλυση.']);
const reread = articleSource.parseSourceText(withExcerpt);
assert.equal(reread.metadata.excerpt, 'Πώς η «Ferrari» & η McLaren κερδίζουν: ανάλυση.');
assert.equal(reread.metadata.sources, 'Πηγή | https://example.com/a');
assert.equal(reread.body, 'Σώμα');
