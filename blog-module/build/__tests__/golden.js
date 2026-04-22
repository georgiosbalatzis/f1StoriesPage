const fs = require('fs');
const path = require('path');
const { processBlogEntry } = require('../worker');
const { classifyEntry } = require('../index');
const { createResponsiveTableFromCSV } = require('../csv-to-table');
const { injectRelatedArticles } = require('../related');
const { injectPrevNextLinks } = require('../nav');

const TEST_ROOT = __dirname;
const REPO_ROOT = path.resolve(TEST_ROOT, '..', '..', '..');
const BLOG_ENTRIES_DIR = path.join(REPO_ROOT, 'blog-module', 'blog-entries');
const GOLDEN_EXPECTED_DIR = path.join(TEST_ROOT, 'golden-expected');
const CSV_FIXTURE_PATH = path.join(TEST_ROOT, 'fixtures', 'csv', 'team-sample.csv');
const BLOG_DATA_PATH = path.join(REPO_ROOT, 'blog-module', 'blog-data.json');

const GOLDEN_ENTRIES = [
    '20260403W',
    '20260405G',
    '20260408J',
    '20260415',
    '20260416G'
];

function ensureGoldenDir() {
    fs.mkdirSync(GOLDEN_EXPECTED_DIR, { recursive: true });
}

function entryPath(slug) {
    return path.join(BLOG_ENTRIES_DIR, slug);
}

function articlePath(slug) {
    return path.join(entryPath(slug), 'article.html');
}

function goldenPath(name) {
    return path.join(GOLDEN_EXPECTED_DIR, `${name}.html`);
}

function readArticle(slug) {
    return fs.readFileSync(articlePath(slug));
}

function readFixtureCsv() {
    return fs.readFileSync(CSV_FIXTURE_PATH, 'utf8');
}

function writeGoldenSnapshot(name, content) {
    ensureGoldenDir();
    fs.writeFileSync(goldenPath(name), content);
}

function verifyClassificationGuards() {
    const blogData = JSON.parse(fs.readFileSync(BLOG_DATA_PATH, 'utf8'));
    const cachedPostsById = new Map((blogData.posts || []).map(post => [post.id, post]));
    const cases = [
        { slug: '20260324W', expectedKind: 'cached-only', expectedAction: 'reuse-cached' },
        { slug: '20260319W', expectedKind: 'cached-only', expectedAction: 'reuse-cached' },
        { slug: '20260415', expectedKind: 'source-backed' },
        { slug: '20260415G', expectedKind: 'ignored', expectedAction: 'ignore' }
    ];

    const failures = [];

    cases.forEach(testCase => {
        const classification = classifyEntry(entryPath(testCase.slug), { cachedPostsById, forceRebuild: true });
        if (classification.kind !== testCase.expectedKind) {
            failures.push(
                `${testCase.slug}: expected kind ${testCase.expectedKind}, got ${classification.kind}`
            );
        }
        if (testCase.expectedAction && classification.action !== testCase.expectedAction) {
            failures.push(
                `${testCase.slug}: expected action ${testCase.expectedAction}, got ${classification.action}`
            );
        }
    });

    return failures;
}

async function updateGoldenSnapshots() {
    const classificationFailures = verifyClassificationGuards();
    if (classificationFailures.length) {
        throw new Error(`Classification guard failed:\n${classificationFailures.join('\n')}`);
    }

    for (const slug of GOLDEN_ENTRIES) {
        await processBlogEntry(entryPath(slug));
    }

    const blogData = JSON.parse(fs.readFileSync(BLOG_DATA_PATH, 'utf8'));
    injectRelatedArticles(blogData.posts || []);
    injectPrevNextLinks(blogData.posts || []);

    GOLDEN_ENTRIES.forEach(slug => {
        writeGoldenSnapshot(slug, readArticle(slug));
    });

    const csvHtml = createResponsiveTableFromCSV(readFixtureCsv(), 'team-sample.csv');
    writeGoldenSnapshot('csv-team-sample', Buffer.from(csvHtml, 'utf8'));
}

async function verifyGoldenSnapshots() {
    ensureGoldenDir();
    const failures = verifyClassificationGuards().map(message => ({
        name: `classification: ${message}`,
        expectedPath: BLOG_DATA_PATH,
        actualPath: BLOG_ENTRIES_DIR
    }));

    for (const slug of GOLDEN_ENTRIES) {
        await processBlogEntry(entryPath(slug));
    }

    const blogData = JSON.parse(fs.readFileSync(BLOG_DATA_PATH, 'utf8'));
    injectRelatedArticles(blogData.posts || []);
    injectPrevNextLinks(blogData.posts || []);

    GOLDEN_ENTRIES.forEach(slug => {
        const actual = readArticle(slug);
        const expected = fs.readFileSync(goldenPath(slug));
        if (!actual.equals(expected)) {
            failures.push({
                name: slug,
                expectedPath: goldenPath(slug),
                actualPath: articlePath(slug)
            });
        }
    });

    const csvActual = Buffer.from(createResponsiveTableFromCSV(readFixtureCsv(), 'team-sample.csv'), 'utf8');
    const csvExpected = fs.readFileSync(goldenPath('csv-team-sample'));
    if (!csvActual.equals(csvExpected)) {
        failures.push({
            name: 'csv-team-sample',
            expectedPath: goldenPath('csv-team-sample'),
            actualPath: CSV_FIXTURE_PATH
        });
    }

    return failures;
}

module.exports = {
    GOLDEN_ENTRIES,
    BLOG_ENTRIES_DIR,
    GOLDEN_EXPECTED_DIR,
    CSV_FIXTURE_PATH,
    entryPath,
    articlePath,
    goldenPath,
    verifyClassificationGuards,
    updateGoldenSnapshots,
    verifyGoldenSnapshots
};
