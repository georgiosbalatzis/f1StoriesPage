const { escapeHtmlAttribute } = require('../shared');
const esc = value => escapeHtmlAttribute(value).replace(/'/g, '&#39;');
const { SITE, route, headHtml, rowHtml, briefingsAsideHtml } = require('../discovery');
const { articleUrl, jsonLd } = require('../entities/hubs');
const { periodLabel } = require('./export');

const { BRIEFINGS_PATH: INDEX, editionPath } = require('./model');
const BANNER = 'ΠΡΟΣΧΕΔΙΟ — δεν έχει εγκριθεί για δημοσίευση';

function page({ path, file, title, description, lastmod, entries, origin, preview, body, detail }) {
    const canonical = origin + path;
    const crumbs = [{ name: 'Αρχική', item: SITE + '/' }, { name: 'Άρθρα', item: SITE + route.index },
        { name: 'Εβδομαδιαία ενημέρωση', item: origin + INDEX }];
    if (detail) crumbs.push({ name: detail, item: canonical });
    const breadcrumb = { '@type': 'BreadcrumbList', '@id': canonical + '#breadcrumbs',
        itemListElement: crumbs.map((crumb, i) => ({ '@type': 'ListItem', position: i + 1, ...crumb })) };
    const list = { '@type': 'ItemList', '@id': canonical + (detail ? '#articles' : '#briefings'), numberOfItems: entries.length,
        itemListElement: entries.map((entry, i) => ({ '@type': 'ListItem', position: i + 1, ...entry })) };
    const schema = { '@context': 'https://schema.org', '@graph': [breadcrumb, list,
        { '@type': 'CollectionPage', '@id': canonical, url: canonical, name: title, description, inLanguage: 'el', dateModified: lastmod,
            breadcrumb: { '@id': breadcrumb['@id'] }, mainEntity: { '@id': list['@id'] } }] };
    let head = headHtml({ title, description, path, canonical });
    if (origin !== SITE) head = head.replaceAll(SITE + INDEX, origin + INDEX);
    head += `\n${preview ? '<meta name="robots" content="noindex, nofollow">\n' : ''}<script type="application/ld+json">${jsonLd(schema)}</script>`;
    const breadcrumbs = `<nav class="ed-mast" aria-label="Διαδρομή"><ol class="ed-meta breadcrumb">${crumbs.map((crumb, i) => `<li class="breadcrumb-item"${i === crumbs.length - 1 ? ' aria-current="page"' : ''}>${i ? '<span aria-hidden="true"> / </span>' : ''}${i === crumbs.length - 1 ? esc(crumb.name) : `<a href="${esc(crumb.item)}">${esc(crumb.name)}</a>`}</li>`).join('')}</ol></nav>`;
    return { file, path, head, main: `<main id="main" class="edition ed-page ed-page--section"><div class="container">${preview ? `<p class="ed-section__facts"><strong>${BANNER}</strong></p>` : ''}${breadcrumbs}${body}</div></main>`,
        lastmod, changefreq: 'monthly', priority: '0.6' };
}

function renderBriefing(selected, { deps, indexPosts = [], origin = SITE, preview = false } = {}) {
    const { edition, period, sections, posts, lastmod } = selected;
    const images = new Map(indexPosts.map(post => [post.id, post]));
    let firstImage = true;
    const ctx = { model: { reference: '' }, deps: { ...deps, renderStoryImage(post, image, options) {
        const eager = firstImage;
        firstImage = false;
        return deps.renderStoryImage(post, image, { ...options, eager });
    } } };
    const paragraphs = items => items.map(text => `<p class="ed-section__facts">${esc(text)}</p>`).join('');
    const body = '<section class="ed-section" aria-labelledby="briefing-title"><header class="ed-section__head">'
        + '<p class="ed-label" lang="en">F1 STORIES — WEEKLY BRIEFING</p>'
        + `<h1 class="ed-section__title" id="briefing-title">${esc(edition.title)}</h1><p class="ed-section__facts ed-num">${esc(periodLabel(period))}</p>`
        + `${paragraphs(edition.opening)}</header><div class="ed-front__side">${sections.map((section, i) => `<section aria-labelledby="briefing-s${i + 1}"><header class="ed-sechead"><h2 class="ed-label" id="briefing-s${i + 1}">${esc(section.heading)}</h2></header>`
            + `${section.intro ? paragraphs([section.intro]) : ''}<ol class="ed-rows">${section.items.map(post => {
                const image = images.get(post.id);
                const display = { ...post, url: articleUrl(post), thumbnail: image?.thumbnail,
                    thumbnailWidth: image?.thumbnailWidth, thumbnailHeight: image?.thumbnailHeight };
                return rowHtml(display, ctx, { level: 3, thumb: true, fullDate: true })
                    .replace('<p class="ed-meta">', meta => `${post.context ? '<p class="ed-section__facts">Για αναδρομή</p>' : ''}<p class="ed-section__facts">${esc(post.rationale)}</p>${meta}`);
            }).join('')}</ol></section>`).join('')}${edition.closing ? `<section>${paragraphs(edition.closing)}</section>` : ''}</div></section>`;
    return page({ path: editionPath(edition.id), file: `briefing/${edition.id}/index.html`, title: `${edition.title} | F1 Stories`,
        description: edition.description, lastmod, entries: posts.map(post => ({ url: articleUrl(post), name: post.title })), origin, preview, body, detail: edition.title });
}

function renderBriefingsIndex(eligible, { origin = SITE, preview = false } = {}) {
    const selections = eligible.slice().sort((a, b) => a.edition.id < b.edition.id ? 1 : a.edition.id > b.edition.id ? -1 : 0);
    const lastmod = selections.map(item => item.lastmod).sort().pop() || '';
    const body = '<section class="ed-section" aria-labelledby="briefings-title"><header class="ed-section__head">'
        + '<h1 class="ed-section__title" id="briefings-title">Εβδομαδιαία ενημέρωση</h1></header><ol class="ed-rows">'
        + selections.map(({ edition, period }) => `<li class="ed-row"><a class="ed-row__link" href="${esc(editionPath(edition.id))}"><span class="ed-date ed-num" aria-hidden="true">${String(period.week).padStart(2, '0')}</span><div class="ed-row__text"><h2 class="ed-headline">${esc(edition.title)}</h2><p class="ed-section__facts ed-num">${esc(periodLabel(period))}</p><p class="ed-section__facts">${esc(edition.description)}</p></div></a></li>`).join('') + '</ol></section>';
    return page({ path: INDEX, file: 'briefing/index.html', title: 'Εβδομαδιαία ενημέρωση | F1 Stories',
        description: 'Εβδομαδιαίες εκδόσεις από το F1 Stories.', lastmod,
        entries: selections.map(({ edition }) => ({ url: origin + editionPath(edition.id), name: edition.title })), origin, preview, body });
}

module.exports = { renderBriefing, renderBriefingsIndex, briefingsAsideHtml };
