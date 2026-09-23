const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { processBlogEntry } = require('../worker');
const { classifyEntry } = require('../index');
const { CONFIG } = require('../shared');
const { convertTxtToHtml } = require('../parse-txt');
const { createResponsiveTableFromCSV, enhancedExtractCSVTags } = require('../csv-to-table');
const { injectRelatedArticles } = require('../related');
const { injectPrevNextLinks } = require('../nav');
const metaGuard = require('./metadata-escaping-guard');
const embedGuard = require('./embed-hardening-guard');

const TEST_ROOT = __dirname;
const REPO_ROOT = path.resolve(TEST_ROOT, '..', '..', '..');
const BLOG_ENTRIES_DIR = path.join(REPO_ROOT, 'blog-module', 'blog-entries');
const GOLDEN_EXPECTED_DIR = path.join(TEST_ROOT, 'golden-expected');
const CSV_FIXTURE_PATH = path.join(TEST_ROOT, 'fixtures', 'csv', 'team-sample.csv');
const CLASSIFICATION_CACHE_PATH = path.join(TEST_ROOT, 'fixtures', 'classification-cache.json');

const GOLDEN_ENTRIES = [
    '20260415',
    '20260416G',
    '20260422G',
    '20260610-2J',
    '20260610W'
];

function ensureGoldenDir() {
    fs.mkdirSync(GOLDEN_EXPECTED_DIR, { recursive: true });
}

function entryPath(slug) {
    return path.join(BLOG_ENTRIES_DIR, slug);
}

function articlePathIn(entriesDir, slug) {
    return path.join(entriesDir, slug, 'article.html');
}

function goldenPath(name) {
    return path.join(GOLDEN_EXPECTED_DIR, `${name}.html`);
}

function readFixtureCsv() {
    return fs.readFileSync(CSV_FIXTURE_PATH, 'utf8');
}

function writeGoldenSnapshot(name, content) {
    ensureGoldenDir();
    fs.writeFileSync(goldenPath(name), content);
}

function listTrackedEntryFiles(slug) {
    const relRoot = `blog-module/blog-entries/${slug}`;
    const output = execFileSync('git', ['ls-files', '-z', '--', relRoot], {
        cwd: REPO_ROOT
    });

    return output
        .toString('utf8')
        .split('\0')
        .filter(Boolean)
        .map(relPath => ({
            relPath,
            entryRelPath: relPath.slice(relRoot.length + 1)
        }))
        .filter(item => item.entryRelPath);
}

function copyTrackedEntry(slug, entriesDir) {
    const trackedFiles = listTrackedEntryFiles(slug);
    if (!trackedFiles.length) {
        throw new Error(`Golden fixture ${slug} has no tracked files.`);
    }

    const targetDir = path.join(entriesDir, slug);
    fs.mkdirSync(targetDir, { recursive: true });

    trackedFiles.forEach(({ relPath, entryRelPath }) => {
        const sourcePath = path.join(REPO_ROOT, ...relPath.split('/'));
        const targetPath = path.join(targetDir, ...entryRelPath.split('/'));
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.copyFileSync(sourcePath, targetPath);
    });
}

async function withGoldenWorkspace(callback) {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-golden-'));
    const entriesDir = path.join(tempRoot, 'blog-entries');
    const originalBlogDir = CONFIG.BLOG_DIR;

    try {
        fs.mkdirSync(entriesDir, { recursive: true });
        GOLDEN_ENTRIES.forEach(slug => {
            copyTrackedEntry(slug, entriesDir);
        });
        CONFIG.BLOG_DIR = entriesDir;
        return await callback(entriesDir);
    } finally {
        CONFIG.BLOG_DIR = originalBlogDir;
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
}

function sortGoldenPosts(posts) {
    return posts.slice().sort((a, b) => {
        const dateDiff = new Date(b.date) - new Date(a.date);
        if (dateDiff !== 0) return dateDiff;
        return String(b.id).localeCompare(String(a.id));
    });
}

async function buildGoldenPostGraph(entriesDir) {
    const posts = [];

    for (const slug of GOLDEN_ENTRIES) {
        const post = await processBlogEntry(path.join(entriesDir, slug));
        if (!post) throw new Error(`Golden fixture ${slug} did not produce post metadata.`);
        posts.push(post);
    }

    return sortGoldenPosts(posts);
}

function verifyClassificationGuards() {
    const blogData = JSON.parse(fs.readFileSync(CLASSIFICATION_CACHE_PATH, 'utf8'));
    const cachedPostsById = new Map((blogData.posts || []).map(post => [post.id, post]));
    const cases = [
        { slug: '20260324W', entryFiles: [], expectedKind: 'cached-only', expectedAction: 'reuse-cached' },
        { slug: '20260319W', entryFiles: [], expectedKind: 'cached-only', expectedAction: 'reuse-cached' },
        { slug: '20260415', entryFiles: ['source.txt'], expectedKind: 'source-backed' },
        { slug: '20260415G', entryFiles: [], expectedKind: 'ignored', expectedAction: 'ignore' }
    ];

    const failures = [];

    cases.forEach(testCase => {
        const classification = classifyEntry(entryPath(testCase.slug), {
            cachedPostsById,
            entryFiles: testCase.entryFiles,
            forceRebuild: true
        });
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

async function verifyPipeTableConversion() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-pipe-table-'));
    const fixturePath = path.join(tempDir, 'source.txt');
    const fixture = [
        'Technical Ferrari',
        '',
        'SF25 vs SF26',
        '',
        '| Τομέας | SF25 (2025) | SF26 (2026) |',
        '|--------|-------------|-------------|',
        '| **Μονοκόκ** | Παραδοσιακό ανθρακονημάτινο | Ελαφρύτερο monocoque |',
        '| **Αεροδυναμική** | Πολύπλοκα τούνελ | Απλοποιημένο δάπεδο |',
        ''
    ].join('\n');

    try {
        fs.writeFileSync(fixturePath, fixture, 'utf8');
        const html = await convertTxtToHtml(fixturePath);
        const failures = [];

        if (!html.includes('<table class="responsive-table docx-table">')) {
            failures.push('pipe table did not render as responsive table');
        }
        if (!html.includes('<th>Τομέας</th>')) {
            failures.push('pipe table header missing');
        }
        if (!html.includes('<strong>Μονοκόκ</strong>')) {
            failures.push('inline markdown inside table cells was not formatted');
        }
        if (html.includes('|--------|')) {
            failures.push('pipe table divider leaked into output');
        }

        return failures;
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
}

function verifyCsvEscapingGuards() {
    const failures = [];
    const escapedHtml = createResponsiveTableFromCSV([
        'Name & Team,<img src=x onerror=alert(1)>',
        '<script>alert(1)</script>,Fish & Chips'
    ].join('\n'), 'unsafe.csv');

    if (escapedHtml.includes('<script>alert') || escapedHtml.includes('<img')) {
        failures.push('CSV HTML-like values were emitted as raw markup');
    }
    if (!escapedHtml.includes('&lt;script&gt;alert(1)&lt;/script&gt;')) {
        failures.push('CSV script-like cell text was not escaped visibly');
    }
    if (!escapedHtml.includes('Name &amp; Team') || !escapedHtml.includes('Fish &amp; Chips')) {
        failures.push('CSV ampersands were not escaped in text nodes');
    }

    const richHtml = createResponsiveTableFromCSV(
        'Name\n<strong>Ok</strong>',
        'rich.csv',
        { allowHtml: true }
    );
    if (!richHtml.includes('<strong>Ok</strong>')) {
        failures.push('CSV rich HTML opt-in did not preserve explicit cell markup');
    }

    const richTags = enhancedExtractCSVTags('<p>CSV_TABLE_HTML:rich.csv</p>');
    if (!richTags.length || !richTags[0].allowHtml || richTags[0].fileName !== 'rich.csv') {
        failures.push('CSV_TABLE_HTML marker was not parsed as an explicit rich HTML opt-in');
    }

    return failures;
}

async function updateGoldenSnapshots() {
    const classificationFailures = verifyClassificationGuards();
    if (classificationFailures.length) {
        throw new Error(`Classification guard failed:\n${classificationFailures.join('\n')}`);
    }

    const pipeTableFailures = await verifyPipeTableConversion();
    if (pipeTableFailures.length) {
        throw new Error(`Pipe table guard failed:\n${pipeTableFailures.join('\n')}`);
    }

    const csvGuardFailures = verifyCsvEscapingGuards();
    if (csvGuardFailures.length) {
        throw new Error(`CSV escaping guard failed:\n${csvGuardFailures.join('\n')}`);
    }

    const embedGuardFailures = embedGuard();
    if (embedGuardFailures.length) {
        throw new Error(`Embed hardening guard failed:\n${embedGuardFailures.join('\n')}`);
    }

    await withGoldenWorkspace(async entriesDir => {
        const goldenPosts = await buildGoldenPostGraph(entriesDir);
        await injectRelatedArticles(goldenPosts);
        injectPrevNextLinks(goldenPosts);

        GOLDEN_ENTRIES.forEach(slug => {
            writeGoldenSnapshot(slug, fs.readFileSync(articlePathIn(entriesDir, slug)));
        });
    });

    const csvHtml = createResponsiveTableFromCSV(readFixtureCsv(), 'team-sample.csv');
    writeGoldenSnapshot('csv-team-sample', Buffer.from(csvHtml, 'utf8'));
}

async function verifyGoldenSnapshots() {
    ensureGoldenDir();
    const failures = verifyClassificationGuards().map(message => ({
        name: `classification: ${message}`,
        expectedPath: CLASSIFICATION_CACHE_PATH,
        actualPath: BLOG_ENTRIES_DIR
    }));

    const pipeTableFailures = await verifyPipeTableConversion();
    pipeTableFailures.forEach(message => {
        failures.push({
            name: `pipe-table: ${message}`,
            expectedPath: fixtureLabel('pipe-table'),
            actualPath: fixtureLabel('pipe-table')
        });
    });

    verifyCsvEscapingGuards().forEach(message => {
        failures.push({
            name: `csv-escaping: ${message}`,
            expectedPath: fixtureLabel('csv-escaping'),
            actualPath: CSV_FIXTURE_PATH
        });
    });

    embedGuard().forEach(message => {
        failures.push({
            name: `embed-hardening: ${message}`,
            expectedPath: fixtureLabel('embed-hardening'),
            actualPath: fixtureLabel('embed-hardening')
        });
    });

    for (const message of await metaGuard()) failures.push({ name: `article-meta: ${message}`, expectedPath: TEST_ROOT, actualPath: TEST_ROOT });

    await withGoldenWorkspace(async entriesDir => {
        const goldenPosts = await buildGoldenPostGraph(entriesDir);
        await injectRelatedArticles(goldenPosts);
        injectPrevNextLinks(goldenPosts);

        GOLDEN_ENTRIES.forEach(slug => {
            const actual = fs.readFileSync(articlePathIn(entriesDir, slug));
            const expected = fs.readFileSync(goldenPath(slug));
            if (!actual.equals(expected)) {
                failures.push({
                    name: slug,
                    expectedPath: goldenPath(slug),
                    actualPath: articlePathIn(entriesDir, slug)
                });
            }
        });
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

function fixtureLabel(name) {
    return path.join(TEST_ROOT, 'fixtures', name);
}

module.exports = {
    updateGoldenSnapshots,
    verifyGoldenSnapshots
};
