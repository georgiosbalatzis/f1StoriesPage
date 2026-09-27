const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { markArticleLead } = require('../article-render');
const { convertTxtToHtml } = require('../parse-txt');

test('the [lead] descriptor marks its paragraph and replaces the inferred lead', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-lead-'));
    const sourcePath = path.join(directory, 'source.txt');
    try {
        fs.writeFileSync(sourcePath, 'category\nTitle\n\nOpening paragraph.\n\n[lead]\nExplicit lead paragraph.\n');
        const converted = await convertTxtToHtml(sourcePath);
        assert.match(converted, /<p data-article-lead="true">Explicit lead paragraph\.<\/p>/);

        const html = markArticleLead('<div class="article-content"><p class="article-lead">Opening paragraph.</p><p class="emphasis" data-article-lead="true">Explicit lead paragraph.</p></div>');
        assert.match(html, /<p>Opening paragraph\.<\/p>/);
        assert.match(html, /<p class="emphasis article-lead" data-article-lead="true">Explicit lead paragraph\.<\/p>/);
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});
