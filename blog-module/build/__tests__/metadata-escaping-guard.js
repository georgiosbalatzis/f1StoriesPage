const fs = require('fs');
const os = require('os');
const path = require('path');
const { processBlogEntry } = require('../worker');
const { CONFIG } = require('../shared');

function escapeText(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(value) {
    return escapeText(value).replace(/"/g, '&quot;');
}

async function verifyArticleMetadataEscapingGuard() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-metadata-escaping-'));
    const originalBlogDir = CONFIG.BLOG_DIR;
    const slug = '20260611';
    const entryDir = path.join(tempDir, slug);
    const title = 'Η "βρωμιά" & <Telemetry> \'δοκιμή\'';
    const author = 'Author "A" & <Team>';
    const tag = 'Tag & <Fast>';
    const category = 'Cat "Air" & <Race>';
    const excerpt = 'Περιγραφή "quote" & <angle> \'δοκιμή\'';
    const articleUrl = `https://f1stories.gr/blog-module/blog-entries/${slug}/article.html`;
    const encodedTitle = encodeURIComponent(title);
    const encodedUrl = encodeURIComponent(articleUrl);
    const failures = [];

    try {
        CONFIG.BLOG_DIR = tempDir;
        fs.mkdirSync(entryDir, { recursive: true });
        fs.writeFileSync(path.join(entryDir, 'source.txt'), [
            '---',
            `title: ${title}`,
            `author: ${author}`,
            `tag: ${tag}`,
            `category: ${category}`,
            `excerpt: ${excerpt}`,
            '---',
            '',
            'Body paragraph for metadata escaping regression.'
        ].join('\n'), 'utf8');

        await processBlogEntry(entryDir);
        const html = fs.readFileSync(path.join(entryDir, 'article.html'), 'utf8');
        if (!html.includes(`<title>${escapeText(title)} | F1 Stories Blog</title>`)) failures.push('title text was not escaped for a text node');
        if (!html.includes(`content="${escapeAttr(title)} | F1 Stories Blog"`)) failures.push('title was not escaped for meta attribute context');
        if (!html.includes(`alt="${escapeAttr(title)}"`)) failures.push('title was not escaped for image alt attribute context');
        if (!html.includes(`${escapeText(tag)}</span>`) || !html.includes(`${escapeText(category)}</span>`)) failures.push('tag/category text nodes were not escaped');
        if (!html.includes(`linkname=${encodedTitle}`) || !html.includes(`text=${encodedTitle}%20${encodedUrl}`)) failures.push('share URLs did not URL-encode title and page URL parameters');
        if (html.includes('<Telemetry>') || html.includes('<Team>') || html.includes('<Fast>')) failures.push('raw metadata angle-bracket content leaked into generated HTML');

        const ldJsonScripts = [...html.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g)];
        if (ldJsonScripts.length < 2) {
            failures.push('expected article and breadcrumb JSON-LD scripts');
        } else {
            try {
                const articleData = JSON.parse(ldJsonScripts[0][1]);
                const breadcrumbData = JSON.parse(ldJsonScripts[1][1]);
                if (articleData.headline !== title || articleData.description !== excerpt || articleData.author.name !== author) failures.push('article JSON-LD did not preserve raw metadata values after parsing');
                if (breadcrumbData.itemListElement?.[2]?.name !== title) failures.push('breadcrumb JSON-LD did not preserve raw title after parsing');
                if (ldJsonScripts.some(match => match[1].includes('<') || match[1].includes('&'))) failures.push('JSON-LD still contains raw script-sensitive metadata characters');
            } catch (error) {
                failures.push(`JSON-LD was not valid JSON: ${error.message}`);
            }
        }
        return failures;
    } finally {
        CONFIG.BLOG_DIR = originalBlogDir;
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
}

module.exports = verifyArticleMetadataEscapingGuard;
