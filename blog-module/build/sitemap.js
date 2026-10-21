const { fs, path, CONFIG, escapeXml } = require('./shared');
const { isDay, athensDay } = require('../taxonomy');

function formatSitemapDate(value) {
    if (isDay(value)) return String(value);
    if (typeof value !== 'string' || !isDay(value.slice(0, 10))
        || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return '';
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

function legalLastmod(filePath) {
    if (!fs.existsSync(filePath)) return '';
    const html = fs.readFileSync(filePath, 'utf8');
    const meta = html.match(/<p class="legal-meta">([\s\S]*?)<\/p>/);
    return formatSitemapDate(meta && meta[1].match(/<time datetime="([^"]+)">/)?.[1]);
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

function renderSitemap(articles = [], edition = [], { today = athensDay(), legalDates = {} } = {}) {
    // Publication changes the listing itself; build/cache refresh times do not.
    const latest = articles.filter(article => isDay(article.date) && article.date <= today
        && ![true, 'true'].includes(article.draft)
        && ![false, 'false'].includes(article.published)
        && (!article.status || article.status === 'published'))
        .map(article => article.date).sort().pop() || '';
    const entries = [
        sitemapUrl('https://f1-stories.gr/', 'daily', '1.0', latest),
        sitemapUrl('https://f1-stories.gr/blog-module/blog/index.html', 'daily', '0.9', latest),
        ...edition.map(page => sitemapUrl(`https://f1-stories.gr${page.path}`, page.changefreq, page.priority, page.lastmod)),
        sitemapUrl('https://f1-stories.gr/standings/', 'weekly', '0.8'),
        sitemapUrl('https://f1-stories.gr/authors/', 'monthly', '0.5'),
        sitemapUrl('https://f1-stories.gr/privacy/privacy.html', 'yearly', '0.2', formatSitemapDate(legalDates['privacy.html'])),
        sitemapUrl('https://f1-stories.gr/privacy/terms.html', 'yearly', '0.2', formatSitemapDate(legalDates['terms.html']))
    ];

    (articles || []).forEach(article => {
        entries.push(sitemapUrl(
            `https://f1-stories.gr/blog-module/blog-entries/${article.id}/article.html`,
            'monthly',
            '0.6',
            formatSitemapDate(article.date || article.dateISO)
        ));
    });

    return '<?xml version="1.0" encoding="UTF-8"?>\n'
        + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + entries.join('')
        + '</urlset>\n';
}

function generateSitemap(articles, edition = []) {
    const legalDates = Object.fromEntries(['privacy.html', 'terms.html'].map(file => [
        file, legalLastmod(path.join(__dirname, '../../privacy', file))
    ]));
    const xml = renderSitemap(articles, edition, { legalDates });
    fs.writeFileSync(CONFIG.SITEMAP_PATH, xml, 'utf8');
    console.log(`Sitemap generated with ${(xml.match(/<url>/g) || []).length} URLs`);
}

module.exports = {
    formatSitemapDate,
    sitemapUrl,
    legalLastmod,
    renderSitemap,
    generateSitemap
};
