const fs = require('fs');
const os = require('os');
const path = require('path');
const AdmZip = require('adm-zip');
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('./fixtures/telemetry-publication-v1.json');
const { renderTelemetryFigure, validateBundle, validateSvg } = require('../telemetry-figure');
const { extractEmbedPlaceholders } = require('../embeds');
const { resolveEmbedPlaceholders } = require('../embed-render');
const { convertTxtToHtml } = require('../parse-txt');
const { convertDocxToHtml } = require('../parse-docx');

let root;
let entry;
const marker = 'baku-test.f1embed.json';

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'telemetry-article-'));
    entry = path.join(root, '20261005G');
    fs.mkdirSync(entry);
    fs.writeFileSync(path.join(entry, marker), JSON.stringify(fixture));
});

afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

test('validates and emits stable local SVG variants and escaped editorial HTML', () => {
    validateBundle(fixture, marker);
    const first = renderTelemetryFigure(marker, entry);
    const second = renderTelemetryFigure(marker, entry);
    assert.equal(first, second);
    assert.match(first, /<figure class="f1-telemetry-figure"/);
    assert.match(first, /data-telemetry-data="\/blog-module\/blog-entries\/20261005G\/embeds\/telemetry-[a-f\d]{20}-data\.json"/);
    assert.match(first, /data-runtime-manifest="https:\/\/f1stories\.gr\/telemetry\/interactive\/manifest\.json"/);
    assert.doesNotMatch(first, /<button\b/);
    assert.equal((first.match(/class="f1-telemetry-picture f1-telemetry-picture--/g) || []).length, 2);
    assert.match(first, /class="f1-telemetry-picture f1-telemetry-picture--light"/);
    assert.match(first, /class="f1-telemetry-picture f1-telemetry-picture--dark"/);
    assert.match(first, /<source media="\(min-width: 700px\)" srcset="[^"]+wideLight\.svg"/);
    assert.match(first, /<source media="\(min-width: 700px\)" srcset="[^"]+wideDark\.svg"/);
    assert.equal((first.match(/class="f1-telemetry-image"/g) || []).length, 2);
    assert.match(first, /&lt;|&amp;|<h3>/);
    assert.match(first, /href="https:\/\/f1stories\.gr\/telemetry\/?\?year=2025&amp;circuit=Monza/);
    const assets = fs.readdirSync(path.join(entry, 'embeds')).sort();
    assert.equal(assets.length, 5);
    assert.ok(assets.filter(name => name.endsWith('.svg')).every(name => /^telemetry-[a-f\d]{20}-(?:narrowLight|wideLight|narrowDark|wideDark)\.svg$/.test(name)));
    const data = assets.find(name => name.endsWith('-data.json'));
    const { images: _images, ...expectedData } = fixture;
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(entry, 'embeds', data), 'utf8')), expectedData);
});

test('reads a marker beside TXT and DOCX source and renders the same article figure', async () => {
    const txt = path.join(entry, 'source.txt');
    fs.writeFileSync(txt, `Title\n\nA short article.\n\nTELEMETRY:${marker}\n`);
    const txtHtml = await convertTxtToHtml(txt);

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Title</w:t></w:r></w:p><w:p><w:r><w:t>A short article.</w:t></w:r></w:p><w:p><w:r><w:t>TELEMETRY:${marker}</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`;
    const zip = new AdmZip();
    zip.addFile('[Content_Types].xml', Buffer.from('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'));
    zip.addFile('_rels/.rels', Buffer.from('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'));
    zip.addFile('word/document.xml', Buffer.from(documentXml));
    const docx = path.join(entry, 'source.docx');
    zip.writeZip(docx);
    const docxHtml = await convertDocxToHtml(docx);
    assert.match(txtHtml, /class="f1-telemetry-figure"/);
    assert.match(docxHtml, /class="f1-telemetry-figure"/);
    assert.equal((txtHtml.match(/class="f1-telemetry-figure"/g) || []).length, 1);
    assert.equal((docxHtml.match(/class="f1-telemetry-figure"/g) || []).length, 1);
    assert.equal(txtHtml.match(/data-digest="([a-f\d]+)"/)?.[1], docxHtml.match(/data-digest="([a-f\d]+)"/)?.[1]);
    assert.equal(txtHtml.match(/<img class="f1-telemetry-image" src="([^"]+)/)?.[1], docxHtml.match(/<img class="f1-telemetry-image" src="([^"]+)/)?.[1]);
});

test('supports a source-local embeds folder and rejects unsafe marker basenames', () => {
    fs.unlinkSync(path.join(entry, marker));
    fs.mkdirSync(path.join(entry, 'embeds'));
    fs.writeFileSync(path.join(entry, 'embeds', marker), JSON.stringify(fixture));
    assert.match(renderTelemetryFigure(marker, entry), /f1-telemetry-figure/);
    for (const bad of ['../secret.f1embed.json', 'https://example.com/x.f1embed.json', 'x.json']) assert.throws(() => renderTelemetryFigure(bad, entry), /Invalid telemetry publication/);
});

test('rejects invalid scope, unsupported versions and hostile or inconsistent SVG markup', () => {
    const changed = structuredClone(fixture);
    changed.scope.sessionKey = 0;
    assert.throws(() => validateBundle(changed, marker), /scope.sessionKey/);
    changed.scope.sessionKey = fixture.scope.sessionKey;
    changed.schemaVersion = 9;
    assert.throws(() => validateBundle(changed, marker), /unsupported schema/);
    const svg = fixture.images.wideLight;
    for (const hostile of [
        svg.svg.replace('<path ', '<script '),
        svg.svg.replace('<path ', '<foreignObject '),
        svg.svg.replace('stroke="#3671c6"', 'stroke="url(https://bad.test/x)"'),
        svg.svg.replace('<svg ', '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg '),
        svg.svg.replace('width="320"', 'width="319"'),
    ]) assert.throws(() => validateSvg(hostile, svg.width, svg.height, marker, 'wideLight'), /Invalid telemetry publication/);
});

test('the TXT placeholder uses the dedicated renderer and remains separate from generic widget markup', () => {
    const extracted = extractEmbedPlaceholders(`TELEMETRY:${marker}`, entry, true);
    const output = resolveEmbedPlaceholders(extracted.cleanedText, extracted.placeholders);
    assert.match(output, /class="f1-telemetry-figure"/);
});
