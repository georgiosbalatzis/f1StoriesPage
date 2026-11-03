const T = require('../../taxonomy');
const { escapeHtmlAttribute: esc } = require('../shared');
const { SITE, route, headHtml, rowHtml, collectionsAsideHtml } = require('../discovery');
const { articleUrl, jsonLd } = require('../entities/hubs');
const { COLLECTIONS_PATH: INDEX, collectionPath } = require('./model');

const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

function page({ path, file, title, description, lastmod, entries, origin, preview, body, detail }) {
    const canonical = origin + path;
    const crumbs = [{ name: 'Αρχική', item: SITE + '/' }, { name: 'Άρθρα', item: SITE + route.index },
        { name: 'Συλλογές', item: origin + INDEX }];
    if (detail) crumbs.push({ name: detail, item: canonical });
    const breadcrumb = { '@type': 'BreadcrumbList', '@id': canonical + '#breadcrumbs',
        itemListElement: crumbs.map((crumb, i) => ({ '@type': 'ListItem', position: i + 1, ...crumb })) };
    const list = { '@type': 'ItemList', '@id': canonical + (detail ? '#articles' : '#collections'), numberOfItems: entries.length,
        itemListElement: entries.map((entry, i) => ({ '@type': 'ListItem', position: i + 1, url: entry.url, name: entry.name })) };
    const schema = { '@context': 'https://schema.org', '@graph': [breadcrumb, list,
        { '@type': 'CollectionPage', '@id': canonical, url: canonical, name: title, description, inLanguage: 'el', dateModified: lastmod,
            breadcrumb: { '@id': breadcrumb['@id'] }, mainEntity: { '@id': list['@id'] } }] };
    let head = headHtml({ title, description, path, canonical });
    if (origin !== SITE) head = head.replaceAll(SITE + INDEX, origin + INDEX);
    head += `\n${preview ? '<meta name="robots" content="noindex, nofollow">\n' : ''}<script type="application/ld+json">${jsonLd(schema)}</script>`;
    const breadcrumbs = `<nav class="ed-mast" aria-label="Διαδρομή"><ol class="ed-meta breadcrumb">${crumbs.map((crumb, i) => `<li class="breadcrumb-item"${i === crumbs.length - 1 ? ' aria-current="page"' : ''}>${i ? '<span aria-hidden="true"> / </span>' : ''}${i === crumbs.length - 1 ? esc(crumb.name) : `<a href="${esc(crumb.item)}">${esc(crumb.name)}</a>`}</li>`).join('')}</ol></nav>`;
    return { file, path, head, main: `<main id="main" class="edition ed-page ed-page--section"><div class="container">${breadcrumbs}${body}</div></main>`,
        lastmod, changefreq: 'monthly', priority: '0.6' };
}

function renderCollection(selected, { deps, indexPosts = [], origin = SITE, preview = false } = {}) {
    const { collection, posts, lastmod } = selected;
    const images = new Map(indexPosts.map(post => [post.id, post]));
    let firstImage = true;
    const ctx = { model: { reference: '' }, deps: { ...deps, renderStoryImage(post, image, options) {
        const eager = firstImage;
        firstImage = false;
        return deps.renderStoryImage(post, image, { ...options, eager });
    } } };
    const rows = posts.map(post => {
        const image = images.get(post.id);
        const display = { ...post, url: articleUrl(post), thumbnail: image?.thumbnail,
            thumbnailWidth: image?.thumbnailWidth, thumbnailHeight: image?.thumbnailHeight };
        return rowHtml(display, ctx, { thumb: true, level: 2, fullDate: true }).replace('</li>',
            `${post.reason ? `<p class="ed-section__facts">${esc(post.reason)}</p>` : ''}</li>`);
    }).join('');
    const intro = collection.introduction.map(text => `<p class="ed-section__facts">${esc(text)}</p>`).join('');
    const body = '<section class="ed-section" aria-labelledby="collection-title"><header class="ed-section__head">'
        + `<h1 class="ed-section__title" id="collection-title">${esc(collection.title)}</h1>`
        + `<p class="ed-section__facts ed-num">${esc(T.plural(posts.length, 'άρθρο', 'άρθρα'))}</p>`
        + `<div class="ed-columns"><div>${intro}</div></div></header><ol class="ed-rows">${rows}</ol></section>`;
    return page({ path: collectionPath(collection.slug), file: `collections/${collection.slug}/index.html`,
        title: `${collection.title} | F1 Stories`, description: collection.description, lastmod,
        entries: posts.map(post => ({ url: articleUrl(post), name: post.title })), origin, preview, body, detail: collection.title });
}

function renderCollectionsIndex(eligibleSelections, { origin = SITE, preview = false } = {}) {
    const selections = eligibleSelections.slice().sort((a, b) => compare(a.collection.slug, b.collection.slug));
    const lastmod = selections.map(item => item.lastmod).sort().pop() || '';
    const body = '<section class="ed-section" aria-labelledby="collections-title"><header class="ed-section__head">'
        + '<h1 class="ed-section__title" id="collections-title">Συλλογές</h1></header>'
        + `<ol class="ed-rows">${selections.map(({ collection, posts }) => `<li class="ed-row"><a class="ed-row__link" href="${esc(collectionPath(collection.slug))}"><div class="ed-row__text"><h2 class="ed-headline">${esc(collection.title)}</h2><p class="ed-section__facts">${esc(collection.description)}</p><p class="ed-section__facts ed-num">${esc(T.plural(posts.length, 'άρθρο', 'άρθρα'))}</p></div></a></li>`).join('')}</ol></section>`;
    return page({ path: INDEX, file: 'collections/index.html', title: 'Συλλογές | F1 Stories',
        description: 'Επιλεγμένες συλλογές άρθρων από το F1 Stories.', lastmod,
        entries: selections.map(({ collection }) => ({ url: origin + collectionPath(collection.slug), name: collection.title })),
        origin, preview, body });
}

module.exports = { renderCollection, renderCollectionsIndex, collectionsAsideHtml };
