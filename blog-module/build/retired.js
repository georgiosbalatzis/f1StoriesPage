// Articles retired as duplicates (blog-module/retired-articles.json; see the article URL policy in docs/search/). The folder is
// gone, so no listing, sitemap, feed or index names the article; its URL stays as a page that hands readers and
// crawlers to the surviving article. GitHub Pages cannot answer with a 301, so the page carries a canonical and an
// immediate meta refresh (no script: public pages forbid inline scripts).
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../retired-articles.json');
const articlePath = id => `blog-module/blog-entries/${id}/article.html`;
const articleUrl = id => `https://f1-stories.gr/blog-module/blog-entries/${encodeURIComponent(id)}/article.html`;

function loadRetired(file = FILE) {
    const { retired } = JSON.parse(fs.readFileSync(file, 'utf8'));
    const ids = new Set(retired.map(entry => entry.id));
    for (const entry of retired) {
        const valid = [entry.id, entry.target].every(id => typeof id === 'string' && /^[\p{L}\p{N}_-]+$/u.test(id));
        if (!valid || entry.id === entry.target || ids.has(entry.target)) {
            throw new Error(`retired-articles.json: invalid entry ${JSON.stringify(entry)}`);
        }
    }
    if (ids.size !== retired.length) throw new Error('retired-articles.json: duplicate id');
    return retired;
}

function stubHtml(entry) {
    const target = articleUrl(entry.target);
    return `<!DOCTYPE html>
<html lang="el">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>F1 Stories</title>
    <link rel="canonical" href="${target}">
    <meta http-equiv="refresh" content="0;url=${target}">
</head>
<body>
    <p><a href="${target}">Το άρθρο βρίσκεται εδώ.</a></p>
</body>
</html>
`;
}

module.exports = { FILE, articlePath, articleUrl, loadRetired, stubHtml };
