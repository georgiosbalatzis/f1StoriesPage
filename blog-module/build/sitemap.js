const { fs, CONFIG, escapeXml } = require('./shared');

function formatSitemapDate(value) {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

function sitemapUrl(loc, changefreq, priority, lastmod) {
    let entry = '  <url>\n';
    entry += `    <loc>${escapeXml(loc)}</loc>\n`;
    if (lastmod) entry += `    <lastmod>${escapeXml(lastmod)}</lastmod>\n`;
    entry += `    <changefreq>${escapeXml(changefreq)}</changefreq>\n`;
    entry += `    <priority>${escapeXml(priority)}</priority>\n`;
    entry += '  </url>\n';
    return entry;
}

function generateSitemap(articles) {
    const entries = [
        sitemapUrl('https://f1stories.gr/', 'daily', '1.0'),
        sitemapUrl('https://f1stories.gr/blog-module/blog/index.html', 'daily', '0.9'),
        sitemapUrl('https://f1stories.gr/standings/', 'weekly', '0.8'),
        sitemapUrl('https://f1stories.gr/privacy/privacy.html', 'yearly', '0.2'),
        sitemapUrl('https://f1stories.gr/privacy/terms.html', 'yearly', '0.2')
    ];

    (articles || []).forEach(article => {
        entries.push(sitemapUrl(
            `https://f1stories.gr/blog-module/blog-entries/${article.id}/article.html`,
            'monthly',
            '0.6',
            formatSitemapDate(article.date || article.dateISO)
        ));
    });

    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
        + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + entries.join('')
        + '</urlset>\n';

    fs.writeFileSync(CONFIG.SITEMAP_PATH, xml, 'utf8');
    console.log(`Sitemap generated with ${entries.length} URLs`);
}

module.exports = {
    formatSitemapDate,
    sitemapUrl,
    generateSitemap
};
