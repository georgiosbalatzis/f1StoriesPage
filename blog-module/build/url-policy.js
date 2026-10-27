// Article URL policy checks (docs/search/article-url-policy.md). Pure and NOT used by the build:
// no article has a slug and nothing is published under /stories/ until the owner approves a migration.
const SITE = 'https://f1-stories.gr';
const STORY_ROOT = '/stories/';
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// First path segments the site, its tools and its generators already own, plus names a future route may need.
const RESERVED = new Set([
    '404', 'archive', 'assets', 'authors', 'betcast', 'blog', 'blog-module', 'cname', 'dashboard', 'entities', 'f1telemetry',
    'feed', 'generate', 'ghostcar', 'housekeeping', 'images', 'index', 'node_modules', 'page', 'privacy',
    'robots', 'scripts', 'search', 'section', 'sitemap', 'standings', 'stories', 'styles', 'sw', 'telemetry', 'tyres'
]);

// The historical URL: the folder id, percent-encoded (Greek ids such as 20260227Τ stay readable on disk).
const legacyPath = id => `/blog-module/blog-entries/${encodeURIComponent(id)}/article.html`;
const storyPath = slug => `${STORY_ROOT}${slug}/`;
// An article's one public address. Identity is the folder id plus its stored slug, never the title.
const canonicalUrl = ({ id, slug }) => SITE + (slug ? storyPath(slug) : legacyPath(id));

// ASCII only: a slug is the same string in a URL, on disk, in the sitemap and on any file system.
function slugIssues(slug) {
    const value = typeof slug === 'string' ? slug : '';
    const issues = [];
    if (!SLUG.test(value)) issues.push('format');
    if (value.length < 3 || value.length > 80) issues.push('length');
    if (!/[a-z]/.test(value)) issues.push('no-letter');
    if (/^\d{8}/.test(value)) issues.push('legacy-shape');
    if (RESERVED.has(value)) issues.push('reserved');
    return issues;
}

// records: [{ id, slug }] as stored in source front matter. history: every { id, slug } ever published,
// including deleted articles: a published slug keeps its article and is never reassigned.
function registryIssues(records, history = []) {
    const issues = [];
    const owners = new Map(), slugs = new Map(), earlier = new Map();
    history.forEach(({ id, slug }) => {
        if (!owners.has(slug)) owners.set(slug, id);
        if (!earlier.has(id)) earlier.set(id, slug);
    });
    for (const { id, slug } of records) {
        if (!slug) continue;
        slugIssues(slug).forEach(code => issues.push(`${id}: slug "${slug}" ${code}`));
        if (slugs.has(id) && slugs.get(id) !== slug) issues.push(`${id}: more than one slug`);
        slugs.set(id, slug);
        if (earlier.has(id) && earlier.get(id) !== slug) issues.push(`${id}: published slug "${earlier.get(id)}" changed`);
        const owner = owners.get(slug);
        if (owner !== undefined && owner !== id) issues.push(`${id}: slug "${slug}" belongs to ${owner}`);
        else owners.set(slug, id);
    }
    return issues;
}

// Historical migration only: every legacy page that gains a slug needs a redirect; new articles never had one.
function redirectPlan(records) {
    return new Map(records.filter(record => record.legacy && record.slug)
        .map(record => [legacyPath(record.id), storyPath(record.slug)]));
}

// A redirect lands on a served canonical in one hop and never on itself, another redirect or a missing page.
function redirectIssues(redirects, canonicalPaths) {
    const issues = [];
    for (const [from, to] of redirects) {
        if (from === to) issues.push(`${from}: redirects to itself`);
        else if (redirects.has(to)) {
            const seen = new Set([from]);
            let next = to;
            while (redirects.has(next) && !seen.has(next)) { seen.add(next); next = redirects.get(next); }
            issues.push(seen.has(next) ? `${from}: redirect loop` : `${from}: redirect chain`);
        } else if (!canonicalPaths.has(to)) issues.push(`${from}: target ${to} is not a published page`);
        if (canonicalPaths.has(from)) issues.push(`${from}: served and redirected (double indexing)`);
    }
    return issues;
}

// Every surface names the same address; the sitemap lists it exactly once and never a redirected URL.
// The RSS GUID is whatever the item was first published with, so a migration never re-announces a story.
function surfaceIssues(record, surfaces, { guid = canonicalUrl(record), redirected = new Set() } = {}) {
    const url = canonicalUrl(record);
    const issues = [];
    for (const key of ['canonical', 'ogUrl', 'jsonLdUrl', 'breadcrumb', 'feedLink']) {
        if (surfaces[key] !== undefined && surfaces[key] !== url) issues.push(`${record.id}: ${key} ${surfaces[key]} ≠ ${url}`);
    }
    if (surfaces.feedGuid !== undefined && surfaces.feedGuid !== guid) issues.push(`${record.id}: GUID changed`);
    const sitemap = surfaces.sitemap || [];
    const listed = sitemap.filter(loc => loc === url).length;
    if (listed !== 1) issues.push(`${record.id}: sitemap lists ${url} ${listed} times`);
    sitemap.filter(loc => redirected.has(new URL(loc).pathname)).forEach(loc => issues.push(`${record.id}: sitemap lists redirected ${loc}`));
    (surfaces.internal || []).filter(href => new URL(href, SITE).href !== url)
        .forEach(href => issues.push(`${record.id}: internal link ${href} is not the canonical`));
    return issues;
}

module.exports = {
    SITE, STORY_ROOT, RESERVED, legacyPath, storyPath, canonicalUrl,
    slugIssues, registryIssues, redirectPlan, redirectIssues, surfaceIssues
};
