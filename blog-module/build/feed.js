const { fs, path, escapeXml } = require('./shared');
const { isDay, athensDay, findAuthor, categoryLabel } = require('../taxonomy');

const FEED_URL = 'https://f1-stories.gr/feed.xml';
const FEED_LIMIT = 30;
const athensOffset = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Athens', timeZoneName: 'longOffset' });

// The publishing contract supplies a calendar day, not a clock time. Use Athens midnight,
// including on DST transition days, rather than inventing a publication timestamp from Git.
function publicationDate(day) {
    if (!isDay(day)) return null;
    const offset = athensOffset.formatToParts(new Date(`${day}T00:00:00Z`))
        .find(part => part.type === 'timeZoneName').value.replace('GMT', '');
    return new Date(`${day}T00:00:00${offset}`);
}

function xmlText(value) {
    return escapeXml(String(value ?? '').replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, ''));
}

function renderFeed(posts, { now = new Date() } = {}) {
    const today = athensDay(now);
    const items = posts.filter(post => isDay(post.date) && post.date <= today
        && ![true, 'true'].includes(post.draft)
        && ![false, 'false'].includes(post.published)
        && (!post.status || post.status === 'published'))
        .map(post => ({ post, date: publicationDate(post.date) }))
        .sort((a, b) => b.date - a.date)
        .slice(0, FEED_LIMIT);
    const seen = new Set();
    const entries = items.map(({ post, date }) => {
        // Matches the article renderer's canonical URL; a GUID never depends on title or build time.
        const url = `https://f1-stories.gr/blog-module/blog-entries/${encodeURIComponent(post.id)}/article.html`;
        if (!post.id || !post.title || seen.has(url)) throw new Error(`Invalid or duplicate feed item: ${post.id}`);
        seen.add(url);
        const author = findAuthor(post.author);
        const categories = post.categories || (post.category ? [post.category] : []);
        return '    <item>\n'
            + `      <title>${xmlText(post.title)}</title>\n`
            + `      <link>${xmlText(url)}</link>\n`
            + `      <guid isPermaLink="true">${xmlText(url)}</guid>\n`
            + `      <pubDate>${date.toUTCString()}</pubDate>\n`
            + `      <description>${xmlText(post.excerpt)}</description>\n`
            + categories.map(category => `      <category>${xmlText(categoryLabel(category))}</category>\n`).join('')
            + (author ? `      <dc:creator>${xmlText(author.label)}</dc:creator>\n` : '')
            + '    </item>\n';
    });
    return '<?xml version="1.0" encoding="UTF-8"?>\n'
        + '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">\n'
        + '  <channel>\n'
        + '    <title>F1 Stories</title>\n'
        + '    <link>https://f1-stories.gr/</link>\n'
        + '    <description>Άρθρα Formula 1, αναλύσεις και ιστορίες από το F1 Stories.</description>\n'
        + '    <language>el</language>\n'
        + `    <atom:link href="${FEED_URL}" rel="self" type="application/rss+xml"/>\n`
        + (items.length ? `    <lastBuildDate>${items[0].date.toUTCString()}</lastBuildDate>\n` : '')
        + entries.join('')
        + '  </channel>\n</rss>\n';
}

function generateFeed(posts) {
    fs.writeFileSync(path.resolve(__dirname, '../../feed.xml'), renderFeed(posts), 'utf8');
    console.log(`RSS feed generated (latest ${FEED_LIMIT} published articles)`);
}

module.exports = { FEED_URL, FEED_LIMIT, publicationDate, renderFeed, generateFeed };
