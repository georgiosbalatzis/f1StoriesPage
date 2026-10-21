// Static collections use editorial approvals only; tag candidates never establish membership.
const fs = require('node:fs');
const path = require('node:path');
const { validateAssociations, loadFoundation } = require('./index');
const T = require('../../taxonomy');
const { escapeHtmlAttribute: esc } = require('../shared');
const { SITE, BLOG, route, headHtml, leadHtml, rowHtml, pagination, composePage } = require('../discovery');
const { sitemapUrl } = require('../sitemap');

const ROOT = path.resolve(__dirname, '../../..');
const TYPES = { driver: 'drivers', team: 'teams', circuit: 'circuits', 'grand-prix': 'grands-prix' };
const PAGE_SIZE = T.EDITION_LAYOUT.page;
const GENERATED = /^entities\/(?:drivers|teams|circuits|grands-prix)\/[a-z0-9]+(?:-[a-z0-9]+)*\/(?:page\/(?:[2-9]|[1-9]\d+)\/)?index\.html$/;
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const hubPath = (entity, page = 1) => `${BLOG}/entities/${TYPES[entity.type]}/${entity.slug}/${page > 1 ? `page/${page}/` : ''}`;
const humanApproved = (review, today) => review?.status === 'approved' && review.kind === 'human'
    && typeof review.by === 'string' && review.by.trim() && T.isDay(review.date) && review.date <= today;

function articleUrl(article) {
    const url = new URL(route.story(article), SITE);
    if (url.origin !== SITE || url.search || url.hash
        || url.pathname !== `/blog-module/blog-entries/${article.id}/article.html`) throw new Error(`Invalid original article URL: ${article.id}`);
    return url.href;
}

function articleIsPublic(article, root = ROOT) {
    const file = path.join(root, new URL(articleUrl(article)).pathname);
    if (!fs.existsSync(file)) return false;
    const html = fs.readFileSync(file, 'utf8');
    const attributes = tag => Object.fromEntries([...tag.matchAll(/([a-z][a-z0-9-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)]
        .map(([, key, double, single, bare]) => [key.toLowerCase(), double ?? single ?? bare]));
    const canonicals = (html.match(/<link\b[^>]*>/gi) || []).map(attributes)
        .filter(tag => tag.rel?.toLowerCase().split(/\s+/).includes('canonical'));
    const blocked = (html.match(/<meta\b[^>]*>/gi) || []).map(attributes).some(tag =>
        ['robots', 'googlebot'].includes(tag.name?.toLowerCase()) && /(?:^|[,\s])(?:noindex|none)(?:$|[,\s])/i.test(tag.content || ''));
    return canonicals.length === 1 && canonicals[0].href === articleUrl(article) && !blocked;
}

function selectHubs(registry, manifest, articles, { today = T.athensDay(), readSource, isPublic = articleIsPublic } = {}) {
    if (!T.isDay(today)) throw new Error('Entity generation requires a valid publication day');
    validateAssociations(registry, manifest, articles, readSource);
    const byId = new Map(articles.map(article => [article.id, article]));
    return registry.entities.slice().sort((a, b) => compare(a.id, b.id)).map(entity => {
        const reviewed = manifest.associations.filter(item => item.entityId === entity.id && humanApproved(item.review, today));
        const subjects = reviewed.filter(item => ['primary', 'secondary'].includes(item.role)
            && item.substantive === true && ['f1', 'mixed'].includes(item.discipline));
        const members = subjects.filter(item => {
            const article = byId.get(item.articleId);
            return T.isDay(article.date) && article.date <= today
                && ![true, 'true'].includes(article.draft) && ![false, 'false'].includes(article.published)
                && (!article.status || article.status === 'published') && isPublic(article);
        });
        const posts = members.map(item => byId.get(item.articleId))
            .sort((a, b) => compare(b.date, a.date) || compare(a.id, b.id));
        const reasons = [];
        if (!humanApproved(entity.hub.review, today)) reasons.push('publication approval pending');
        if (!humanApproved(entity.hub.introduction?.review, today) || !entity.hub.introduction?.heading?.trim()) reasons.push('approved heading/introduction required');
        if (posts.length < 3) reasons.push('three published substantive subjects required');
        if (new Set(posts.map(post => post.date)).size < 2) reasons.push('two publication dates required');
        const lastmod = [...posts.map(post => post.date), ...reviewed.map(item => item.review.date),
            entity.hub.introduction?.review.date, entity.hub.review.date].filter(date => T.isDay(date) && date <= today).sort().pop() || '';
        return { entity, posts, lastmod, reasons, eligible: reasons.length === 0 };
    });
}

const jsonLd = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
function renderHub(hub, { deps, indexPosts = [], origin = SITE, preview = false } = {}) {
    const { entity, posts, lastmod } = hub;
    const images = new Map(indexPosts.map(post => [post.id, post]));
    // Index records contribute images only; original editorial metadata remains authoritative.
    const display = posts.map(post => ({ ...post, url: articleUrl(post), thumbnail: images.get(post.id)?.thumbnail,
        thumbnailWidth: images.get(post.id)?.thumbnailWidth, thumbnailHeight: images.get(post.id)?.thumbnailHeight }));
    const ctx = { model: { reference: '' }, deps };
    const total = Math.ceil(posts.length / PAGE_SIZE);
    const pages = [];
    for (let number = 1; number <= total; number++) {
        const pagePath = hubPath(entity, number), canonical = origin + pagePath;
        const suffix = number > 1 ? ` · Σελίδα ${number}` : '';
        const title = `${entity.hub.introduction.heading}${suffix} | F1 Stories`;
        const description = `${entity.labelEl}: ${T.plural(posts.length, 'άρθρο', 'άρθρα')} στο F1 Stories. Αναλύσεις και ιστορίες από το αρχείο.${suffix}`;
        const slice = display.slice((number - 1) * PAGE_SIZE, number * PAGE_SIZE);
        const crumbs = [{ name: 'Αρχική', item: SITE + '/' }, { name: 'Άρθρα', item: SITE + route.index },
            { name: entity.labelEl, item: origin + hubPath(entity) }];
        if (number > 1) crumbs.push({ name: `Σελίδα ${number}`, item: canonical });
        const breadcrumb = { '@type': 'BreadcrumbList', '@id': canonical + '#breadcrumbs', itemListElement: crumbs.map((crumb, i) => ({ '@type': 'ListItem', position: i + 1, ...crumb })) };
        const list = { '@type': 'ItemList', '@id': canonical + '#articles', numberOfItems: posts.length,
            itemListElement: slice.map((post, i) => ({ '@type': 'ListItem', position: (number - 1) * PAGE_SIZE + i + 1, url: articleUrl(post), name: post.title })) };
        const schema = { '@context': 'https://schema.org', '@graph': [breadcrumb, list,
            { '@type': 'CollectionPage', '@id': canonical, url: canonical, name: title, description, inLanguage: 'el', dateModified: lastmod,
                breadcrumb: { '@id': breadcrumb['@id'] }, mainEntity: { '@id': list['@id'] } }] };
        let head = headHtml({ title, description, path: pagePath, canonical,
            prev: number > 1 ? hubPath(entity, number - 1) : '', next: number < total ? hubPath(entity, number + 1) : '' });
        if (origin !== SITE) head = head.replaceAll(SITE + hubPath(entity), origin + hubPath(entity));
        head += `\n${preview ? '<meta name="robots" content="noindex, nofollow">\n' : ''}<script type="application/ld+json">${jsonLd(schema)}</script>`;
        const breadcrumbs = `<nav class="ed-mast" aria-label="Διαδρομή"><ol class="ed-meta breadcrumb">${crumbs.map((crumb, i) => `<li class="breadcrumb-item"${i === crumbs.length - 1 ? ' aria-current="page"' : ''}>${i ? '<span aria-hidden="true"> / </span>' : ''}${i === crumbs.length - 1 ? esc(crumb.name) : `<a href="${esc(crumb.item)}">${esc(crumb.name)}</a>`}</li>`).join('')}</ol></nav>`;
        const intro = number === 1 ? entity.hub.introduction.text.split(/\n\n/).map(text => `<p class="ed-section__facts">${esc(text)}</p>`).join('') : '';
        const front = number === 1 ? slice.slice(0, T.EDITION_LAYOUT.front) : [];
        const cards = front.length ? front.reduce((html, post, i) => html + (i % 2 === 0 ? '<div class="ed-section__front">' : '')
            + leadHtml(post, ctx, { level: 2, sizes: T.CARD_SIZES.editionSection, eager: i === 0, cls: 'ed-lead--section' })
            + (i % 2 === 1 || i === front.length - 1 ? '</div>' : ''), '') : '';
        const rows = slice.slice(front.length);
        const main = `<main id="main" class="edition ed-page ed-page--section"><div class="container">${breadcrumbs}`
            + '<section class="ed-section" aria-labelledby="entity-title"><header class="ed-section__head">'
            + `<h1 class="ed-section__title" id="entity-title">${esc(entity.hub.introduction.heading)}</h1>`
            + `<p class="ed-section__facts ed-num">${esc(entity.name)} · ${esc(T.plural(posts.length, 'εγκεκριμένο άρθρο', 'εγκεκριμένα άρθρα'))}${suffix}</p>${intro ? `<div class="ed-columns"><div>${intro}</div></div>` : ''}</header>`
            + `${cards}${rows.length ? `<ol class="ed-rows">${rows.map(post => rowHtml(post, ctx, { thumb: true, level: 2, fullDate: true })).join('')}</ol>` : ''}`
            + pagination(number, total, to => hubPath(entity, to)) + '</section></div></main>';
        pages.push({ file: pagePath.slice(BLOG.length + 1) + 'index.html', path: pagePath, head, main, lastmod, changefreq: 'weekly', priority: number === 1 ? '0.6' : '0.4' });
    }
    return pages;
}

function buildHubPages(registry, manifest, articles, options = {}) {
    const hubs = selectHubs(registry, manifest, articles, options);
    return { hubs, pages: hubs.filter(hub => hub.eligible).flatMap(hub => renderHub(hub, options)) };
}

function composeHubPage(shell, page) {
    // The archive filtering runtime has no work on a static collection; retain shared navigation/consent runtimes.
    return composePage(shell, page).replace(/<script\b[^>]*src="\/blog-module\/(?:taxonomy|blog-index)(?:\.min)?\.js[^"']*"[^>]*><\/script>\s*/g, '');
}

function writeHubPages(blogDir, pages, shell = fs.readFileSync(path.join(blogDir, 'index.html'), 'utf8')) {
    function hasSymlink(file) {
        const parts = path.relative(blogDir, file).split(path.sep);
        let current = blogDir;
        for (const part of ['', ...parts]) {
            current = path.join(current, part);
            try {
                if (fs.lstatSync(current).isSymbolicLink()) return true;
            } catch (error) {
                if (error.code !== 'ENOENT') throw error;
            }
        }
        return false;
    }
    // Check every destination before any mutation; output must stay inside the owned tree.
    for (const page of pages) {
        if (!GENERATED.test(page.file)) throw new Error(`Invalid generated entity path: ${page.file}`);
        if (hasSymlink(path.join(blogDir, page.file))) throw new Error(`Refusing symlink entity output: ${page.file}`);
    }
    const keep = new Set(pages.map(page => page.file));
    for (const page of pages) {
        const target = path.join(blogDir, page.file), html = composeHubPage(shell, page);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== html) fs.writeFileSync(target, html);
    }
    function clean(dir) {
        if (hasSymlink(dir) || !fs.existsSync(dir) || !fs.lstatSync(dir).isDirectory()) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const file = path.join(dir, entry.name);
            if (entry.isDirectory()) clean(file);
            else if (entry.isFile()) {
                const rel = path.relative(blogDir, file).split(path.sep).join('/');
                if (!GENERATED.test(rel) || keep.has(rel)) continue;
                fs.rmSync(file);
                for (let parent = path.dirname(file); parent !== blogDir && parent !== path.join(blogDir, 'entities'); parent = path.dirname(parent)) {
                    if (fs.readdirSync(parent).length) break;
                    fs.rmdirSync(parent);
                }
            }
        }
    }
    // Only the four owned type roots; symlinks and unrelated files are never followed or removed.
    Object.values(TYPES).forEach(type => clean(path.join(blogDir, 'entities', type)));
}

function publicHubFiles(foundation = loadFoundation(), options = {}) {
    const { registry, manifest, articles } = foundation;
    return new Set(selectHubs(registry, manifest, articles, options).filter(hub => hub.eligible).flatMap(hub =>
        Array.from({ length: Math.ceil(hub.posts.length / PAGE_SIZE) }, (_, i) => hubPath(hub.entity, i + 1).slice(1) + 'index.html')));
}
const hubSitemap = pages => pages.map(page => sitemapUrl(SITE + page.path, page.changefreq, page.priority, page.lastmod)).join('');
module.exports = { TYPES, PAGE_SIZE, GENERATED, hubPath, articleUrl, articleIsPublic, selectHubs, renderHub, buildHubPages, composeHubPage, writeHubPages, publicHubFiles, hubSitemap };
