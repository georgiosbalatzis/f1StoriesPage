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

function deployedRoots(root) {
    try {
        const config = JSON.parse(fs.readFileSync(path.join(root, 'scripts/deployment/sources.json'), 'utf8'));
        if (config.enabled !== true || config.releaseReady !== true) return new Set();
        require('../../scripts/deployment/release.mjs').checkLock(config);
        return new Set(config.applications.filter(app => app.path !== '/').map(app => app.path));
    } catch (_) {
        return new Set();
    }
}

function classify(sitePath, post, published, root, roots) {
    const article = /^\/blog-module\/blog-entries\/([^/]+)\/article\.html$/.exec(sitePath);
    if (article) {
        if (article[1] === post.id) return 'self';
        const target = published.get(article[1]);
        if (!target) return pageExists(sitePath, root) ? 'unpublished' : 'broken';
        return target.date <= post.date ? 'article' : 'later';
    }
    if (!pageExists(sitePath, root) && !roots.has(sitePath)) return 'broken';
    if (sitePath.startsWith('/blog-module/blog/entities/')) return 'hub';
    if (sitePath.startsWith('/blog-module/blog/section/')) return 'section';
    return 'page';
}

// One article: every internal body link with its kind, and the distinct destinations that count.
function analyzeBody(post, bodyHtml, published, root = ROOT, roots = deployedRoots(root)) {
    const pageUrl = `https://f1-stories.gr/blog-module/blog-entries/${encodeURIComponent(post.id)}/article.html`;
    const links = [];
    for (const match of String(bodyHtml || '').matchAll(/<a\b[^>]*?\shref\s*=\s*(["'])(.*?)\1[^>]*>/gi)) {
        const href = match[2].replace(/&amp;/g, '&');
        const sitePath = internalPath(href, pageUrl);
        if (sitePath) links.push({ href, path: sitePath, kind: classify(sitePath, post, published, root, roots) });
    }
    const contextual = new Set(links.filter(link => COUNTED.has(link.kind)).map(link => link.path)).size;
    return { id: post.id, date: post.date, isNew: post.date >= CONTEXT_LINKS_SINCE, links, contextual };
}

function analyzeArticles(posts, { today = athensDay(), root = ROOT, isPublic } = {}) {
    const visible = posts.filter(post => isPublishedArticle(post, today, isPublic));
    const published = new Map(visible.map(post => [post.id, post]));
    const roots = deployedRoots(root);
    return visible.map(post => {
        const file = path.join(root, 'blog-module/blog-entries', post.id, 'article.html');
        return analyzeBody(post, fs.existsSync(file) ? articleBodyHtml(fs.readFileSync(file, 'utf8')) : '', published, root, roots);
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
    const count = kind => links.filter(link => link.kind === kind).length;
    return {
        inspected: reports.length,
        none: reports.filter(report => report.contextual === 0).length,
        one: reports.filter(report => report.contextual === 1).length,
        twoPlus: reports.filter(report => report.contextual >= 2).length,
        broken: count('broken'),
        articleLinks: count('article'),
        hubLinks: count('hub'),
        sectionLinks: count('section'),
        pageLinks: count('page'),
        laterLinks: count('later'),
        unpublishedLinks: count('unpublished'),
        attention: reports.filter(report => report.isNew && report.contextual < RECOMMENDED).map(report => report.id)
    };
}

// Editorial suggestions, never changes: earlier stories (or a published topic hub) a story could link, with the
// evidence behind each. `subjects`: article id → entity ids a human approved it as a substantive subject of;
// `hubLinks`: published hubs ({ href, label, articleIds }); `entityNames`: entity id → name. Already-linked targets
// are skipped. Shared tags alone never prove a relationship, so those suggestions are capped and always need review.
const TAG_SUGGESTIONS = 10;
function linkOpportunities(reports, posts, { subjects = new Map(), hubLinks = [], entityNames = new Map() } = {}) {
    const { topicTags, tagWeights } = require('./related-score');
    const byId = new Map(posts.map(post => [post.id, post]));
    const linked = new Map(reports.map(report => [report.id, new Set(report.links.map(link => link.path))]));
    const storyPath = id => `/blog-module/blog-entries/${encodeURIComponent(id)}/article.html`;
    const decoded = id => `/blog-module/blog-entries/${id}/article.html`;
    const has = (source, target) => linked.get(source)?.has(target) || false;
    const visible = reports.map(report => byId.get(report.id)).filter(Boolean);
    const order = (a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    const suggestion = (source, target, reason, evidence, review) => ({
        source: source.id, title: source.title, target: target.path, url: `https://f1-stories.gr${target.path}`, targetTitle: target.title,
        reason, evidence, review
    });
    const out = [];
    // 1. Both stories are approved subjects of the same entity: the newer can point to the older.
    for (const source of visible.slice().sort(order)) {
        for (const entity of [...(subjects.get(source.id) || [])].sort()) {
            for (const target of visible.filter(other => other.id !== source.id && other.date <= source.date && subjects.get(other.id)?.has(entity)).sort(order)) {
                if (has(source.id, decoded(target.id))) continue;
                out.push(suggestion(source, { path: storyPath(target.id), title: target.title },
                    `Both stories are approved substantive subjects of ${entityNames.get(entity) || entity}`,
                    `blog-module/build/entities/associations.json: approved ${entity} associations for ${source.id} and ${target.id}`,
                    'yes: choose the sentence and wording'));
            }
        }
    }
    // 2. An approved subject of a published topic hub that does not link the hub.
    for (const hub of hubLinks.slice().sort((a, b) => a.href < b.href ? -1 : 1)) {
        for (const source of (hub.articleIds || []).map(id => byId.get(id)).filter(post => post && linked.has(post.id)).sort(order)) {
            if (has(source.id, hub.href)) continue;
            out.push(suggestion(source, { path: hub.href, title: hub.label }, `An approved subject of the published topic page ${hub.label}`,
                'blog-module/build/entities/registry.json: hub publication and introduction approved; associations.json: approved substantive subject',
                'yes: choose the sentence and wording'));
        }
    }
    // 3. The strongest rare-tag overlaps with an earlier story (a shared tag on at most three stories).
    const weights = tagWeights(visible);
    const rare = Math.log(visible.length / 3);
    const pairs = [];
    for (const source of visible) {
        const mine = new Set(topicTags(source));
        for (const target of visible) {
            if (target.id === source.id || target.date > source.date || has(source.id, decoded(target.id))) continue;
            const theirs = topicTags(target), shared = theirs.filter(tag => mine.has(tag));
            const uncommon = shared.filter(tag => (weights.get(tag) || 0) >= rare);
            if (!uncommon.length) continue;
            const union = [...new Set([...mine, ...theirs])].reduce((sum, tag) => sum + (weights.get(tag) || 0), 0);
            const score = shared.reduce((sum, tag) => sum + (weights.get(tag) || 0), 0) / (union || 1);
            pairs.push({ source, target, uncommon, score });
        }
    }
    pairs.sort((a, b) => b.score - a.score || order(a.source, b.source) || (a.target.id < b.target.id ? -1 : 1));
    const seen = new Set(out.map(item => `${item.source}>${item.target}`));
    let tagged = 0;
    const stories = tag => Math.round(visible.length / Math.exp(weights.get(tag)));
    for (const { source, target, uncommon } of pairs) {
        if (tagged === TAG_SUGGESTIONS) break;
        const key = `${source.id}>${storyPath(target.id)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        tagged++;
        out.push(suggestion(source, { path: storyPath(target.id), title: target.title }, 'The two stories share uncommon tags',
            `shared uncommon tags: ${uncommon.map(tag => `${tag} (on ${stories(tag)} stories)`).join(', ')}`, 'yes: confirm the stories are really related before linking'));
    }
    return out;
}

function renderReport(reports, opportunities = []) {
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
        `- Body links to earlier articles: ${counts.articleLinks}`,
        `- Body links to approved topic hubs: ${counts.hubLinks}`,
        `- Body links to category sections: ${counts.sectionLinks}`,
        `- Body links to other site pages, such as the data tools (not counted): ${counts.pageLinks}`,
        `- Self, later-published or unpublished targets (not counted): ${other.length} (later-published: ${counts.laterLinks}, unpublished: ${counts.unpublishedLinks})`, ...other,
        `- New articles needing editorial attention: ${counts.attention.length}${counts.attention.length ? ` (${counts.attention.join(', ')})` : ''}`,
        ...(opportunities.length ? ['', `Editorial linking opportunities: ${opportunities.length} suggestions; nothing is changed, every one needs a human decision`,
            ...opportunities.map(item => [`- ${item.source} (${item.title}) → ${item.url} (${item.targetTitle})`,
                `  Reason: ${item.reason}.`, `  Evidence: ${item.evidence}.`, `  Human review: ${item.review}.`].join('\n'))] : [])
    ].join('\n') + '\n';
}

if (require.main === module) {
    const { posts } = JSON.parse(fs.readFileSync(path.join(ROOT, 'blog-module/blog-data.json'), 'utf8'));
    const { loadFoundation } = require('./entities/index');
    const { selectHubs, hubPath } = require('./entities/hubs');
    const { registry, manifest, articles } = loadFoundation();
    const hubs = selectHubs(registry, manifest, articles);
    const { approvedSubjects } = require('./related-score');
    const hubLinks = hubs.filter(hub => hub.eligible).map(hub => ({ href: hubPath(hub.entity), label: hub.entity.labelEl, articleIds: hub.posts.map(post => post.id) }));
    const reports = analyzeArticles(posts);
    process.stdout.write(renderReport(reports, linkOpportunities(reports, posts, {
        subjects: approvedSubjects(hubs), hubLinks, entityNames: new Map(registry.entities.map(entity => [entity.id, entity.name]))
    })));
}

module.exports = { CONTEXT_LINKS_SINCE, RECOMMENDED, internalPath, analyzeBody, analyzeArticles, checkBodyLinks, summarize, linkOpportunities, renderReport };
