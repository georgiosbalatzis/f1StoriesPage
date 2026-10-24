// Contextual internal links in an article's authored body: the rendered body only, never navigation, breadcrumbs,
// related cards, bylines, share or previous/next links. New articles should link 2–3 earlier stories, approved topic
// hubs or sections where it helps the reader; that is advice, never a quota. What blocks a new article is a body link
// to an F1 Stories page that does not exist or is not published. Older stories are reported, never changed or failed.
const { fs, path } = require('./shared');
const { articleBodyHtml } = require('./reading-time');
const { isPublishedArticle } = require('./entities/hubs');
const { athensDay } = require('../taxonomy');

const ROOT = path.resolve(__dirname, '../..');
const SITE_HOSTS = new Set(['f1-stories.gr', 'www.f1-stories.gr']);
// Stories published from this day on are "new": the rule applies to them. Earlier ones are only reported.
const CONTEXT_LINKS_SINCE = '2026-10-25';
const RECOMMENDED = 2;
const COUNTED = new Set(['article', 'hub', 'section']);

// The site path an anchor leads to ('' for another site, mail, a fragment-only or unparsable href), resolved
// against the article's own URL so relative links count too. Query and fragment are not part of the destination.
function internalPath(href, pageUrl) {
    const raw = String(href || '').trim();
    if (!raw || raw.startsWith('#')) return '';
    let url;
    try {
        url = new URL(raw, pageUrl);
    } catch (_) {
        return '';
    }
    if (!['http:', 'https:'].includes(url.protocol) || !SITE_HOSTS.has(url.hostname.toLowerCase())) return '';
    let pathname = url.pathname;
    try {
        pathname = decodeURIComponent(pathname);
    } catch (_) { /* keep the encoded form; it will not resolve to a file */ }
    return pathname.replace(/\/index\.html$/, '/');
}

function pageExists(sitePath, root) {
    const rel = sitePath.slice(1);
    const file = path.resolve(root, !rel || rel.endsWith('/') ? `${rel}index.html` : rel);
    return file.startsWith(root + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile();
}

function classify(sitePath, post, published, root) {
    const article = /^\/blog-module\/blog-entries\/([^/]+)\/article\.html$/.exec(sitePath);
    if (article) {
        if (article[1] === post.id) return 'self';
        const target = published.get(article[1]);
        if (!target) return pageExists(sitePath, root) ? 'unpublished' : 'broken';
        return target.date <= post.date ? 'article' : 'later';
    }
    if (!pageExists(sitePath, root)) return 'broken';
    if (sitePath.startsWith('/blog-module/blog/entities/')) return 'hub';
    if (sitePath.startsWith('/blog-module/blog/section/')) return 'section';
    return 'page';
}

// One article: every internal body link with its kind, and the distinct destinations that count.
function analyzeBody(post, bodyHtml, published, root = ROOT) {
    const pageUrl = `https://f1-stories.gr/blog-module/blog-entries/${encodeURIComponent(post.id)}/article.html`;
    const links = [];
    for (const match of String(bodyHtml || '').matchAll(/<a\b[^>]*?\shref\s*=\s*(["'])(.*?)\1[^>]*>/gi)) {
        const href = match[2].replace(/&amp;/g, '&');
        const sitePath = internalPath(href, pageUrl);
        if (sitePath) links.push({ href, path: sitePath, kind: classify(sitePath, post, published, root) });
    }
    const contextual = new Set(links.filter(link => COUNTED.has(link.kind)).map(link => link.path)).size;
    return { id: post.id, date: post.date, isNew: post.date >= CONTEXT_LINKS_SINCE, links, contextual };
}

function analyzeArticles(posts, { today = athensDay(), root = ROOT, isPublic } = {}) {
    const visible = posts.filter(post => isPublishedArticle(post, today, isPublic));
    const published = new Map(visible.map(post => [post.id, post]));
    return visible.map(post => {
        const file = path.join(root, 'blog-module/blog-entries', post.id, 'article.html');
        return analyzeBody(post, fs.existsSync(file) ? articleBodyHtml(fs.readFileSync(file, 'utf8')) : '', published, root);
    });
}

// Build step: a new article's dead or unpublished body link fails the build with what to fix; a new article below the
// recommendation gets an editorial note. Returns the reports.
function checkBodyLinks(posts, options = {}) {
    const reports = analyzeArticles(posts, options);
    const fresh = reports.filter(report => report.isNew);
    const dead = fresh.flatMap(report => report.links.filter(link => ['broken', 'unpublished'].includes(link.kind))
        .map(link => `${report.id}: the body link ${link.href} does not lead to a published F1 Stories page; correct or remove it`));
    if (dead.length) throw new Error(`Article body links:\n  ${dead.join('\n  ')}`);
    fresh.filter(report => report.contextual < RECOMMENDED).forEach(report => console.warn(
        `⚠️  ${report.id}: ${report.contextual} contextual internal link${report.contextual === 1 ? '' : 's'} in the body; new articles should link 2–3 earlier stories, topic hubs or sections where they genuinely help the reader`));
    const counts = summarize(reports);
    console.log(`Body links: ${counts.inspected} published articles, ${counts.none} without contextual internal links, ${counts.one} with one, ${counts.twoPlus} with two or more (npm run links:report)`);
    return reports;
}

function summarize(reports) {
    const links = reports.flatMap(report => report.links);
    return {
        inspected: reports.length,
        none: reports.filter(report => report.contextual === 0).length,
        one: reports.filter(report => report.contextual === 1).length,
        twoPlus: reports.filter(report => report.contextual >= 2).length,
        broken: links.filter(link => link.kind === 'broken').length,
        hubLinks: links.filter(link => link.kind === 'hub').length,
        pageLinks: links.filter(link => link.kind === 'page').length,
        attention: reports.filter(report => report.isNew && report.contextual < RECOMMENDED).map(report => report.id)
    };
}

function renderReport(reports) {
    const counts = summarize(reports);
    const broken = reports.flatMap(report => report.links.filter(link => link.kind === 'broken').map(link => `  - ${report.id}: ${link.href}`));
    const other = reports.flatMap(report => report.links.filter(link => ['self', 'later', 'unpublished'].includes(link.kind)).map(link => `  - ${report.id}: ${link.href} (${link.kind})`));
    return [
        `Contextual body links (new articles: published on or after ${CONTEXT_LINKS_SINCE}; recommended: 2–3)`,
        `- Published articles inspected: ${counts.inspected}`,
        `- With no contextual internal link: ${counts.none}`,
        `- With one: ${counts.one}`,
        `- With two or more: ${counts.twoPlus}`,
        `- Broken internal body links: ${counts.broken}`, ...broken,
        `- Body links to approved topic hubs: ${counts.hubLinks}`,
        `- Body links to other site pages, such as the data tools (not counted): ${counts.pageLinks}`,
        `- Self, later-published or unpublished targets (not counted): ${other.length}`, ...other,
        `- New articles needing editorial attention: ${counts.attention.length}${counts.attention.length ? ` (${counts.attention.join(', ')})` : ''}`
    ].join('\n') + '\n';
}

if (require.main === module) {
    const { posts } = JSON.parse(fs.readFileSync(path.join(ROOT, 'blog-module/blog-data.json'), 'utf8'));
    process.stdout.write(renderReport(analyzeArticles(posts)));
}

module.exports = { CONTEXT_LINKS_SINCE, RECOMMENDED, internalPath, analyzeBody, analyzeArticles, checkBodyLinks, summarize, renderReport };
