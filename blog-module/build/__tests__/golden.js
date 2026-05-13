const fs = require('fs');
const os = require('os');
const path = require('path');
const { processBlogEntry } = require('../worker');
const { classifyEntry } = require('../index');
const { convertTxtToHtml } = require('../parse-txt');
const { createResponsiveTableFromCSV, enhancedExtractCSVTags } = require('../csv-to-table');
const { buildEmbedHtml } = require('../embed-render');
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

function verifyEmbedHardeningGuards() {
    const failures = [];
    const blockedWidget = buildEmbedHtml({
        type: 'raw-widget',
        value: '<div style="color:red" onclick="alert(1)">x</div>'
    });
    if (!blockedWidget.includes('Raw widget blocked') || blockedWidget.includes('onclick')) {
        failures.push('raw widget without allowlist marker did not fail closed');
    }

    const allowedWidget = buildEmbedHtml({
        type: 'raw-widget',
        value: '<div data-f1s-raw-widget style="color:red">x</div>'
    });
    if (!allowedWidget.includes('data-f1s-raw-widget') || allowedWidget.includes('Raw widget blocked')) {
        failures.push('allowlisted raw widget was not preserved');
    }

    const rawIframe = buildEmbedHtml({
        type: 'raw-iframe',
        src: 'https://www.youtube.com/embed/abcdefghijk',
        value: '<iframe src="https://www.youtube.com/embed/abcdefghijk" onload="alert(1)" srcdoc="<script>alert(1)</script>" width="560"></iframe>'
    });
    if (!rawIframe.includes('https://www.youtube.com/embed/abcdefghijk')) {
        failures.push('whitelisted raw iframe src was not preserved');
    }
    if (rawIframe.includes('onload') || rawIframe.includes('srcdoc') || rawIframe.includes('<script')) {
        failures.push('raw iframe unsafe attributes were not stripped');
    }

    const blockedFile = buildEmbedHtml({
        type: 'embed',
        value: '../../index.html',
        entryPath: BLOG_ENTRIES_DIR
    });
    if (!blockedFile.includes('Embed blocked') || blockedFile.includes('../../index.html')) {
        failures.push('unsafe embed file path did not fail closed');
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

    const embedGuardFailures = verifyEmbedHardeningGuards();
    if (embedGuardFailures.length) {
        throw new Error(`Embed hardening guard failed:\n${embedGuardFailures.join('\n')}`);
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

    verifyEmbedHardeningGuards().forEach(message => {
        failures.push({
            name: `embed-hardening: ${message}`,
            expectedPath: fixtureLabel('embed-hardening'),
            actualPath: fixtureLabel('embed-hardening')
        });
    });

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

function fixtureLabel(name) {
    return path.join(TEST_ROOT, 'fixtures', name);
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
    verifyCsvEscapingGuards,
    verifyEmbedHardeningGuards,
    updateGoldenSnapshots,
    verifyGoldenSnapshots
};
