// The Edition Index: the archive's static discovery pages. The blog index (index.html), one page per public
// category (section/<kind>/ and section/<kind>/page/<n>/), one per month with stories (archive/<yyyy>/<mm>/)
// and an archive hub (archive/). Every page is a deployable file and works without JavaScript.
//
// Additive by design: /blog-module/blog/index.html and its ?category= / ?author= links keep working (blog-index.js
// renders those views in the browser from the same index data); no article URL is touched.
//
// Dates are the folder-name publication days. Nothing here reads the clock except `today` (a future-dated story is
// never NEW and never listed by date), so the output is a pure function of the data.
const fs = require('fs');
const path = require('path');
const T = require('../taxonomy');
const { escapeHtmlAttribute: esc } = require('./shared');

const BLOG = '/blog-module/blog';
const SITE = 'https://f1-stories.gr';
const { page: PAGE_SIZE, front: FRONT_SIZE } = T.EDITION_LAYOUT;
const GENERATED_ROOTS = ['section', 'archive'];

const SECTION_METADATA = {
    News: {
        title: 'Ειδήσεις Formula 1',
        description: 'Ειδήσεις από τη Formula 1 και τον μηχανοκίνητο αθλητισμό: αγώνες, οδηγοί, ομάδες και εξελίξεις από το paddock.'
    },
    Analysis: {
        title: 'Αναλύσεις Formula 1',
        description: 'Αναλύσεις αγώνων Formula 1, στρατηγικής και αγωνιστικού ρυθμού από το F1 Stories.'
    },
    Technical: {
        title: 'Τεχνική Ανάλυση Formula 1',
        description: 'Τεχνική ανάλυση της Formula 1: μονοθέσια, αεροδυναμική, ελαστικά και κανονισμοί μέσα από τα άρθρα του F1 Stories.'
    },
    History: {
        title: 'Ιστορία των Αγώνων',
        description: 'Ιστορίες από τη Formula 1 και τον μηχανοκίνητο αθλητισμό, με ιστορικούς αγώνες, πρόσωπα και στιγμές που άφησαν εποχή.'
    },
    Opinion: {
        title: 'Άρθρα Γνώμης για τη Formula 1',
        description: 'Άρθρα γνώμης και προσωπικές ματιές στη Formula 1 και τον μηχανοκίνητο αθλητισμό από τους συντάκτες του F1 Stories.'
    },
    Betting: {
        title: 'BetCast & Στοίχημα Formula 1',
        description: 'Τα άρθρα BetCast του F1 Stories, με συζητήσεις για τα Grand Prix, αγωνιστικές εκτιμήσεις και στοιχηματικές προσεγγίσεις.'
    },
    Drivers: {
        title: 'Ιστορίες Οδηγών',
        description: 'Πορτρέτα, διαδρομές και ιστορίες οδηγών της Formula 1 και του μηχανοκίνητου αθλητισμού από το F1 Stories.'
    },
    Teams: {
        title: 'Ομάδες Formula 1',
        description: 'Ιστορίες και αναλύσεις για τις ομάδες της Formula 1, τα μονοθέσια και την πορεία τους στους αγώνες.'
    }
};

const route = {
    index: `${BLOG}/index.html`,
    section: (kind, page = 1) => `${T.SECTION_ROOT}${kind}/${page > 1 ? `page/${page}/` : ''}`,
    month: key => `${BLOG}/archive/${key.slice(0, 4)}/${key.slice(5, 7)}/`,
    archive: `${BLOG}/archive/`,
    story: post => post.url || `/blog-module/blog-entries/${post.id}/article.html`
};
const dayOf = post => String(post.date || '').slice(0, 10);
const monthOf = post => dayOf(post).slice(0, 7);
const latestDay = posts => posts.map(dayOf).filter(day => T.isDay(day)).sort().pop() || '';
const num = value => `<span class="ed-num">${value}</span>`;

// ── Model ────────────────────────────────────────────────
// `posts` is newest first. A story is "published" when it has a real date that is not after `today`.
function buildModel(posts, today, selection = {}) {
    const published = posts.filter(post => T.isDay(dayOf(post)) && dayOf(post) <= today);
    const reference = published.reduce((max, post) => (dayOf(post) > max ? dayOf(post) : max), '');
    const sections = T.PUBLIC_CATEGORIES
        .map(name => ({ name, kind: T.categoryKind(name), label: T.categoryLabel(name), posts: posts.filter(post => (post.categories || []).includes(name)) }))
        .filter(section => section.posts.length);
    const months = new Map();
    published.forEach(post => {
        const key = monthOf(post);
        if (!months.has(key)) months.set(key, []);
        months.get(key).push(post);
    });
    const monthKeys = Array.from(months.keys()).sort().reverse();
    const weekFrom = reference ? T.addDays(reference, 1 - T.NEW_DAYS) : '';
    const week = published.filter(post => dayOf(post) >= weekFrom);
    const warnings = [];
    // The editor's lead (editorial-selection.json) leads the week when it is one of the week's stories.
    let lead = week[0] || null;
    if (typeof selection.lead === 'string' && selection.lead.trim()) {
        const pick = posts.find(post => post.id === selection.lead.trim());
        if (!pick) warnings.push(`unknown article id "${selection.lead}"`);
        else if (!week.includes(pick)) warnings.push(`lead "${selection.lead}" is not one of the week's stories`);
        else lead = pick;
    }
    const anniversary = reference ? T.addDays(reference, -365) : '';
    const distance = post => Math.abs((Date.parse(dayOf(post)) - Date.parse(anniversary)) / 864e5);
    const yearAgo = anniversary
        ? published.filter(post => distance(post) <= T.EDITION_LAYOUT.yearAgoDays)
            .sort((a, b) => distance(a) - distance(b) || (dayOf(a) < dayOf(b) ? 1 : -1))
            .slice(0, T.EDITION_LAYOUT.yearAgoMax)
            .sort((a, b) => (dayOf(a) < dayOf(b) ? 1 : dayOf(a) > dayOf(b) ? -1 : 0))
        : [];
    const writers = T.AUTHORS.map(author => ({ author, posts: posts.filter(post => post.author === author.name) })).filter(writer => writer.posts.length);
    return {
        posts, today, reference, published, sections, months, monthKeys, week, lead, yearAgo, anniversary, writers, warnings,
        weekFrom,
        newest: published[0] || null,
        oldestKey: monthKeys[monthKeys.length - 1] || '',
        newestKey: monthKeys[0] || ''
    };
}

// ── Pieces ───────────────────────────────────────────────
function kicker(post, ctx, { mark = true } = {}) {
    const primary = (post.categories && post.categories[0]) || 'News';
    const fresh = mark && T.isNewStory(dayOf(post), ctx.model.reference)
        ? `<span class="ed-new" data-new-until="${T.newUntil(dayOf(post))}">ΝΕΟ</span>` : '';
    return `<span class="ed-kicker">${esc(T.greekUpper(T.categoryLabel(primary)))}${fresh}</span>`;
}
function meta(post, { fullDate = false, author = true } = {}) {
    const parts = [];
    if (author) parts.push(T.authorLabel(post.author || 'F1 Stories'));
    if (fullDate && T.isDay(dayOf(post))) parts.push(T.formatDate(dayOf(post)));
    const minutes = T.formatReadingTime(post.readingTime);
    if (minutes) parts.push(minutes);
    return `<p class="ed-meta">${parts.map(part => `<span>${esc(part)}</span>`).join('')}</p>`;
}
function dateCell(post) {
    const date = T.isDay(dayOf(post)) ? T.ledgerDate(dayOf(post)) : null;
    if (!date) return '<span class="ed-date" aria-hidden="true"></span>';
    return `<time class="ed-date ed-num" datetime="${dayOf(post)}">${date.day} ${date.month}<span class="visually-hidden"> ${date.year}</span></time>`;
}
const kindOf = post => T.categoryKind((post.categories && post.categories[0]) || 'News');
const headline = (post, level, lead = false) => `<h${level} class="ed-headline${lead ? ' ed-headline--lead' : ''}"><span class="ed-title-link">${esc(post.title)}</span></h${level}>`;

function leadHtml(post, ctx, { level = 3, sizes, eager = false, cls = '', cta = false } = {}) {
    const image = ctx.deps.storyImage(post);
    return `<article class="ed-lead${cls ? ` ${cls}` : ''}${image ? '' : ' ed-lead--text'}" data-kind="${kindOf(post)}">`
        + `<a class="ed-lead__link blog-card-link" href="${esc(route.story(post))}">`
        + (image ? `<span class="ed-media ed-lead__media">${ctx.deps.renderStoryImage(post, image, { sizes, full: false, eager })}</span>` : '')
        + `<div class="ed-lead__text">${kicker(post, ctx)}${headline(post, level, true)}`
        + (post.excerpt ? `<p class="ed-excerpt">${esc(post.excerpt)}</p>` : '')
        + `${meta(post, { fullDate: true })}`
        // The homepage's red call to action; the whole card is already the link, so it is not announced twice.
        + (cta ? '<span class="ed-cta" aria-hidden="true">Διάβασε την ιστορία →</span>' : '')
        + '</div></a></article>';
}
// The front page's wire date: a large day numeral over the month, as on the homepage.
function bigDateCell(post) {
    const date = T.isDay(dayOf(post)) ? T.ledgerDate(dayOf(post)) : null;
    if (!date) return '<span class="ed-date" aria-hidden="true"></span>';
    return `<time class="ed-date ed-date--big" datetime="${dayOf(post)}"><span class="ed-date__day ed-num">${dayOf(post).slice(8, 10)}</span> ${date.month}<span class="visually-hidden"> ${date.year}</span></time>`;
}
function rowHtml(post, ctx, { level = 3, thumb = false, date = true, bigDate = false, kickerOn = true, mark = true, excerpt = false, author = true, fullDate = false } = {}) {
    const image = thumb ? ctx.deps.storyImage(post) : '';
    return `<li class="ed-row${image ? ' ed-row--thumb' : ''}" data-kind="${kindOf(post)}">`
        + `<a class="ed-row__link blog-card-link" href="${esc(route.story(post))}">`
        + (date ? (bigDate ? bigDateCell(post) : dateCell(post)) : '')
        + `<div class="ed-row__text">${kickerOn ? kicker(post, ctx, { mark }) : ''}${headline(post, level)}`
        + (excerpt && post.excerpt ? `<p class="ed-excerpt ed-excerpt--row">${esc(post.excerpt)}</p>` : '')
        + `${meta(post, { fullDate, author })}</div>`
        + (image ? `<span class="ed-media ed-row__media">${ctx.deps.renderStoryImage(post, image, { sizes: T.CARD_SIZES.editionThumb })}</span>` : '')
        + '</a></li>';
}
// Rows grouped under month headings; a page opens with its month.
function monthGroups(posts, ctx, rowOptions) {
    const groups = [];
    posts.forEach(post => {
        const key = monthOf(post);
        if (!groups.length || groups[groups.length - 1].key !== key) groups.push({ key, posts: [] });
        groups[groups.length - 1].posts.push(post);
    });
    return groups.map(group => `<section class="ed-month"${T.isDay(`${group.key}-01`) ? '' : ' aria-label="Χωρίς ημερομηνία"'}>`
        + (T.isDay(`${group.key}-01`) ? `<h3 class="ed-month__title">${esc(T.monthName(group.key))}</h3>` : '')
        + `<ol class="ed-rows">${group.posts.map(post => rowHtml(post, ctx, rowOptions)).join('')}</ol></section>`).join('');
}
function pagination(current, total, href, label = 'Σελίδες') {
    if (total <= 1) return '';
    const step = (to, text, rel) => (to < 1 || to > total
        ? `<span class="ed-pages__step is-off">${text}</span>`
        : `<a class="ed-pages__step" rel="${rel}" href="${esc(href(to))}">${text}</a>`);
    const items = T.pageItems(current, total).map(item => {
        if (item === '…') return '<li><span class="ed-pages__gap" aria-hidden="true">…</span></li>';
        return item === current
            ? `<li><span class="ed-pages__num" aria-current="page"><span class="visually-hidden">Σελίδα </span>${item}</span></li>`
            : `<li><a class="ed-pages__num" href="${esc(href(item))}" aria-label="Σελίδα ${item}">${item}</a></li>`;
    });
    return `<nav class="ed-pages" id="blog-pagination" aria-label="${esc(label)}">${step(current - 1, '← Νεότερες', 'prev')}<ol>${items.join('')}</ol>${step(current + 1, 'Παλαιότερες →', 'next')}</nav>`;
}
const sechead = (id, title, note = '', more = '') => `<header class="ed-sechead"><h2 id="${id}" class="ed-label">${esc(title)}</h2>`
    + (note ? `<p class="ed-sechead__note ed-num">${esc(note)}</p>` : '') + more + '</header>';

function rangeText(posts) {
    const keys = posts.map(monthOf).filter(key => T.isDay(`${key}-01`)).sort();
    return keys.length ? `${T.monthName(keys[0])} – ${T.monthName(keys[keys.length - 1])}` : '';
}

// ── Masthead and navigation ──────────────────────────────
function contentsHtml(ctx, current) {
    const { model } = ctx;
    const item = (href, label, count, active, kind) => `<li${kind ? ` data-kind="${kind}"` : ''}><a href="${esc(href)}"${active ? ' aria-current="page"' : ''}>`
        + `<span>${esc(label)}</span>${num(count)}</a></li>`;
    const list = [item(route.index, 'Πρωτοσέλιδο', model.posts.length, current === 'index')]
        .concat(model.sections.map(section => item(route.section(section.kind), section.label, section.posts.length, current === section.kind, section.kind)))
        .concat([
            item(route.archive, 'Αρχείο ανά μήνα', model.monthKeys.length, current === 'archive').replace('<li>', '<li class="ed-contents__aux">'),
            item('/authors/', 'Συντάκτες', T.AUTHORS.length, false).replace('<li>', '<li class="ed-contents__aux">')
        ]);
    const currentLabel = current === 'index' ? 'Όλες οι ενότητες' : current === 'archive' ? 'Αρχείο'
        : (model.sections.find(section => section.kind === current) || {}).label || 'Όλες οι ενότητες';
    return `<details class="ed-contents" open><summary><span>Ενότητες</span><span class="ed-contents__current">${esc(currentLabel)}</span></summary>`
        + `<nav aria-label="Ενότητες του F1 Stories"><ol class="ed-contents__list">${list.join('')}</ol></nav></details>`;
}
function mastheadHtml(ctx, current, isIndex) {
    const { model } = ctx;
    const newest = model.newest;
    const title = `THE INDEX<span class="ed-dot" aria-hidden="true">.</span>`;
    return '<header class="ed-mast">'
        + `<div class="ed-folio"><span>F1 STORIES · ΤΟ ΕΥΡΕΤΗΡΙΟ</span>`
        + (newest ? `<span class="ed-num">Τελευταία έκδοση <time datetime="${dayOf(newest)}">${esc(T.formatDate(dayOf(newest), 'long'))}</time> · ${model.posts.length} ιστορίες</span>` : '')
        + '</div><div class="ed-mast__row">'
        + (isIndex ? `<h1 class="ed-title">${title}<span class="visually-hidden"> — Όλες οι ιστορίες του F1 Stories</span></h1>`
            : `<p class="ed-title"><a href="${route.index}">${title}</a></p>`)
        + `<form class="ed-search" role="search" action="${route.index}" method="get"><label class="visually-hidden" for="blog-search">Αναζήτηση στο F1 Stories</label>`
        + `<input id="blog-search" type="search" name="q" placeholder="Αναζήτηση σε ${model.posts.length} ιστορίες" autocomplete="off">`
        + '<button type="submit">Αναζήτηση</button></form></div>'
        + `${contentsHtml(ctx, current)}</header>`;
}
// Phones: the section pages' categories ride in a sticky, natively scrolling strip under the site nav.
function railHtml(ctx, current) {
    const items = ctx.model.sections.map(section => `<li data-kind="${section.kind}"><a href="${esc(route.section(section.kind))}"${section.kind === current ? ' aria-current="page"' : ''}>`
        + `<span>${esc(section.label)}</span>${num(section.posts.length)}</a></li>`);
    return `<nav class="ed-rail" aria-label="Μετάβαση σε ενότητα"><ol>${items.join('')}</ol></nav>`;
}

function calendarYear(model, year, currentKey) {
    const total = model.monthKeys.filter(key => key.startsWith(year)).reduce((sum, key) => sum + model.months.get(key).length, 0);
    const cells = [];
    for (let month = 1; month <= 12; month += 1) {
        const key = `${year}-${String(month).padStart(2, '0')}`;
        const posts = model.months.get(key);
        cells.push(posts
            ? `<li><a href="${route.month(key)}"${key === currentKey ? ' aria-current="page"' : ''} aria-label="${esc(`${T.monthName(key)}, ${T.plural(posts.length, 'ιστορία', 'ιστορίες')}`)}"><span>${T.monthShort(key)}</span>${num(posts.length)}</a></li>`
            : `<li><span class="is-empty" aria-hidden="true"><span>${T.monthShort(key)}</span><span>—</span></span></li>`);
    }
    return `<div class="ed-cal"><h3 class="ed-cal__year">${year}${num(T.plural(total, 'ιστορία', 'ιστορίες'))}</h3><ol class="ed-cal__months">${cells.join('')}</ol></div>`;
}
const yearsOf = model => Array.from(new Set(model.monthKeys.map(key => key.slice(0, 4)))).sort().reverse();

// ── Page bodies ──────────────────────────────────────────
function topicsHtml(links) {
    const topics = [...new Map(links.map(link => [link.href, link])).values()]
        .sort((a, b) => a.href < b.href ? -1 : a.href > b.href ? 1 : 0);
    if (!topics.length) return '';
    return '<nav class="ed-aside__block" aria-labelledby="ed-topics-title"><h2 class="ed-label" id="ed-topics-title">Θέματα</h2>'
        + `<ul class="ed-aside__list">${topics.map(topic => `<li><a href="${esc(topic.href)}"><span>${esc(topic.label)}</span><span class="ed-num">${esc(T.plural(topic.count, 'άρθρο', 'άρθρα'))}</span></a></li>`).join('')}</ul></nav>`;
}
// Approved weekly briefings (blog-module/build/briefings/), newest first; nothing at all while none is published.
function briefingsAsideHtml(links = []) {
    if (!links.length) return '';
    return '<nav class="ed-aside__block" aria-labelledby="ed-briefings-title"><h2 class="ed-label" id="ed-briefings-title">Εβδομαδιαία ενημέρωση</h2>'
        + `<ul class="ed-aside__list"><li><a href="${BLOG}/briefing/"><span>Όλες οι εκδόσεις</span></a></li>${links.map(link => `<li><a href="${esc(link.href)}"><span>${esc(link.label)}</span></a></li>`).join('')}</ul></nav>`;
}

// Approved curated collections (blog-module/build/collections/); nothing at all while none is published.
function collectionsAsideHtml(links = []) {
    if (!links.length) return '';
    const sorted = links.slice().sort((a, b) => a.href < b.href ? -1 : a.href > b.href ? 1 : 0);
    return '<nav class="ed-aside__block" aria-labelledby="ed-collections-title"><h2 class="ed-label" id="ed-collections-title">Συλλογές</h2>'
        + `<ul class="ed-aside__list"><li><a href="${BLOG}/collections/"><span>Όλες οι συλλογές</span></a></li>${sorted.map(link => `<li><a href="${esc(link.href)}"><span>${esc(link.label)}</span><span class="ed-num">${esc(T.plural(link.count, 'άρθρο', 'άρθρα'))}</span></a></li>`).join('')}</ul></nav>`;
}

// THE EDITION (owner choice, 2026-11-04; prototype experiments/index-redesign/concept-f): the homepage's ink lead and
// LATEST. wire, the month told day by day (THE CHRONICLE.) and the desks, in the Index's own inks and ΝΕΟ marks.
const WIRE_SIZE = 8;
const WEEKDAYS = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'];
const weekday = day => WEEKDAYS[new Date(`${day}T12:00:00Z`).getUTCDay()];
// An English display word with the red full stop (as THE PADDOCK. on the homepage), then a ruled Greek caption.
const display = (id, word, note, more = '') => `<header class="ed-display"><h2 id="${id}" class="ed-display__word">${word}<span class="ed-dot" aria-hidden="true">.</span></h2>`
    + `<div class="ed-display__bar"><p class="ed-label">${esc(note)}</p>${more}</div></header>`;

function chronicleHtml(ctx, lead) {
    const { model } = ctx;
    const key = model.newestKey;
    const posts = model.months.get(key) || [];
    if (!posts.length) return '';
    const days = [];
    posts.forEach(post => {
        if (!days.length || days[days.length - 1].day !== dayOf(post)) days.push({ day: dayOf(post), posts: [] });
        days[days.length - 1].posts.push(post);
    });
    // One photograph per month, never the lead's again; archive material keeps its grayscale print.
    const interlude = posts.find(post => post !== lead && ctx.deps.storyImage(post));
    const interludeHtml = interlude
        ? `<a class="ed-interlude blog-card-link" href="${esc(route.story(interlude))}" data-kind="${kindOf(interlude)}"><span class="ed-media">${ctx.deps.renderStoryImage(interlude, ctx.deps.storyImage(interlude), { sizes: T.CARD_SIZES.editionWeek, full: false })}</span>`
            + `<span class="ed-interlude__caption">${esc(interlude.title)}</span></a>` : '';
    const dayHtml = ({ day, posts: dayPosts }, index) => `<section class="ed-day" aria-labelledby="ed-day-${day}">`
        + `<h4 class="ed-day__head" id="ed-day-${day}"><span class="ed-day__num ed-num">${day.slice(8, 10)}</span><span class="ed-day__name">${weekday(day)}</span></h4>`
        // The chronicle repeats the newest stories: their ΝΕΟ mark stays on the lead and the wire, once per story.
        + `<div class="ed-day__stories"><ol class="ed-rows">${dayPosts.map(post => rowHtml(post, ctx, { level: 5, date: false, mark: false })).join('')}</ol>`
        + (index === 0 ? interludeHtml : '') + '</div></section>';
    const previous = model.monthKeys[1];
    const nav = `<nav class="ed-chronicle__nav" aria-label="Μήνες">`
        + (previous ? `<a href="${route.month(previous)}">← ${esc(T.monthName(previous))}</a>` : '')
        + `<a href="${route.month(key)}">Όλος ο μήνας →</a><a href="${route.archive}">Όλο το αρχείο →</a></nav>`;
    return '<section class="ed-chronicle" aria-labelledby="ed-chronicle-title">'
        + display('ed-chronicle-title', 'THE CHRONICLE', 'Το χρονικό · ανά μήνα')
        + `<div class="ed-chronicle__month"><h3 class="ed-chronicle__title">${esc(T.monthName(key))}</h3>${nav}</div>`
        + days.map(dayHtml).join('')
        + `<div class="ed-calendar ed-chronicle__years"><h3 class="ed-label">Οι μήνες</h3>${yearsOf(model).map(year => calendarYear(model, year, '')).join('')}</div>`
        + '</section>';
}

function indexBody(ctx) {
    const { model } = ctx;
    // The editor's lead (editorial-selection.json) when it is one of the week's stories, otherwise the newest.
    const lead = model.lead || model.newest;
    const wire = model.published.filter(post => post !== lead).slice(0, WIRE_SIZE);
    const voice = model.published.find(post => post !== lead && !wire.includes(post) && (post.categories || []).includes('Opinion'));
    const front = lead ? '<section class="ed-ink" aria-labelledby="ed-ink-title"><h2 class="visually-hidden" id="ed-ink-title">Το πρωτοσέλιδο</h2>'
        + leadHtml(lead, ctx, { level: 3, sizes: T.CARD_SIZES.editionWeek, eager: true, cls: 'ed-lead--ink', cta: true }) + '</section>' : '';
    const latest = wire.length ? '<section class="ed-latest" aria-labelledby="ed-latest-title">'
        + display('ed-latest-title', 'LATEST', 'Οι νεότερες ιστορίες', `<a class="ed-sechead__more" href="${route.month(model.newestKey)}">Όλος ο μήνας →</a>`)
        + `<div class="ed-latest__grid"><div class="ed-latest__wire"><h3 class="ed-label">Wire · Πρόσφατα</h3><ol class="ed-rows ed-rows--wire">${wire.map(post => rowHtml(post, ctx, { level: 4, bigDate: true })).join('')}</ol></div>`
        + (voice ? `<aside class="ed-voices" aria-labelledby="ed-voices-title"><h3 class="ed-label" id="ed-voices-title">Voices · Άποψη</h3>${leadHtml(voice, ctx, { level: 4, sizes: T.CARD_SIZES.editionWeek, cls: 'ed-lead--voice' })}</aside>` : '')
        + '</div></section>' : '';
    const table = '<section class="ed-table" aria-labelledby="ed-table-title">'
        + sechead('ed-table-title', 'Οι ενότητες', 'Η πιο πρόσφατη ιστορία κάθε ενότητας')
        + `<ol class="ed-table__list">${model.sections.map(section => {
            const latest = section.posts.find(post => model.published.includes(post)) || section.posts[0];
            return `<li class="ed-table__item" data-kind="${section.kind}"><h3 class="ed-table__name"><a href="${route.section(section.kind)}">${esc(section.label)}${num(section.posts.length)}</a></h3>`
                + `<a class="ed-table__latest blog-card-link" href="${esc(route.story(latest))}"><span class="ed-title-link">${esc(latest.title)}</span>`
                + (T.isDay(dayOf(latest)) ? `<time class="ed-num" datetime="${dayOf(latest)}">${esc(T.formatDate(dayOf(latest)))}</time>` : '') + '</a></li>';
        }).join('')}</ol></section>`;
    const anniversaryKey = model.anniversary.slice(0, 7);
    const yearAgo = model.yearAgo.length ? '<section class="ed-yearago" aria-labelledby="ed-ya-title">'
        + sechead('ed-ya-title', 'Πριν από ένα χρόνο', '', model.months.has(anniversaryKey)
            ? `<a class="ed-sechead__more" href="${route.month(anniversaryKey)}">${esc(T.monthName(anniversaryKey))} →</a>` : '')
        + `<ol class="ed-rows">${model.yearAgo.map(post => rowHtml(post, ctx, { thumb: true, fullDate: true, date: false })).join('')}</ol></section>` : '';
    const bylines = '<section class="ed-bylines" aria-labelledby="ed-by-title">'
        + sechead('ed-by-title', 'Οι υπογραφές', '', '<a class="ed-sechead__more" href="/authors/">Όλοι οι συντάκτες →</a>')
        + `<ul class="ed-bylines__list">${model.writers.map(({ author, posts }) => {
            const last = posts.find(post => T.isDay(dayOf(post)));
            return `<li data-author-slug="${author.slug}"><a href="${route.index}?author=${author.slug}"><img src="${T.authorThumb(author)}" alt="" width="48" height="48" loading="lazy" decoding="async">`
                + `<span class="ed-bylines__name">${esc(author.label)}</span><span class="ed-bylines__desk">${esc(author.desk)}</span>`
                + `<span class="ed-bylines__count ed-num">${esc(T.plural(posts.length, 'ιστορία', 'ιστορίες'))}${last ? ` · τελευταία ${esc(T.formatDate(dayOf(last)))}` : ''}</span></a></li>`;
        }).join('')}</ul></section>`;
    // THE DESKS keep the former side column whole and in order (table, topics, collections, briefings, a year ago).
    const desks = '<section class="ed-desks" aria-labelledby="ed-desks-title">'
        + display('ed-desks-title', 'THE DESKS', 'Οι ενότητες και οι συντάκτες')
        + `<div class="ed-front__side ed-desks__grid">${table}${topicsHtml(ctx.hubLinks)}${collectionsAsideHtml(ctx.collectionLinks)}${briefingsAsideHtml(ctx.briefingLinks)}${yearAgo}</div>${bylines}</section>`;
    return `<div class="ed-front" id="journal-edition" data-story-ids="${esc([lead, ...wire].filter(Boolean).map(post => post.id).join(' '))}" data-total="${model.posts.length}">`
        + `${front}${latest}${chronicleHtml(ctx, lead)}${desks}</div>`
        + `<section class="ed-view" id="journal-archive" aria-labelledby="journal-archive-title" data-view="all" data-category="" data-author="" data-query="" data-sort="newest" data-page="1" data-total="${model.posts.length}">`
        + '<div id="journal-view"></div></section>';
}

function sectionPageCount(section) {
    return Math.max(1, Math.ceil(Math.max(0, section.posts.length - FRONT_SIZE) / PAGE_SIZE));
}
function sectionBody(ctx, section, page) {
    const { model } = ctx;
    const total = sectionPageCount(section);
    const front = page === 1 ? section.posts.slice(0, FRONT_SIZE) : [];
    const rest = section.posts.slice(FRONT_SIZE);
    const slice = rest.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const writers = model.writers.map(({ author }) => ({ author, count: section.posts.filter(post => post.author === author.name).length }))
        .filter(writer => writer.count).sort((a, b) => b.count - a.count);
    const first = FRONT_SIZE + (page - 1) * PAGE_SIZE;
    // The list's own range: on page 1 the newest stories sit in the front above it, so the list starts after them.
    const shown = `${first + 1}–${first + slice.length}`;
    const head = '<header class="ed-section__head"><p class="ed-label">Ενότητα</p>'
        + `<h1 class="ed-section__title" id="ed-section-title">${esc(section.label)}</h1>`
        + `<p class="ed-section__facts ed-num">${esc(T.plural(section.posts.length, 'ιστορία', 'ιστορίες'))}${rangeText(section.posts) ? ` · ${esc(rangeText(section.posts))}` : ''}${page > 1 ? ` · Σελίδα ${page} από ${total}` : ''}</p>`
        + (page === 1 ? `<p class="ed-section__writers">Υπογράφουν: ${writers.map(({ author, count }) => `<a href="${route.index}?author=${author.slug}&amp;category=${section.name}">${esc(author.label)}</a>${num(` (${count})`)}`).join(', ')}</p>` : '')
        + '</header>';
    const frontHtml = front.length ? '<div class="ed-section__front">'
        + leadHtml(front[0], ctx, { level: 2, sizes: T.CARD_SIZES.editionSection, eager: true, cls: 'ed-lead--section' })
        + `<ol class="ed-rows ed-rows--side">${front.slice(1).map(post => rowHtml(post, ctx, { thumb: true, kickerOn: false, fullDate: true, date: false, level: 2 })).join('')}</ol></div>` : '';
    const list = slice.length ? '<section class="ed-list" aria-labelledby="ed-list-title">'
        + sechead('ed-list-title', `Όλες οι ιστορίες · ${section.label}`, `${shown} από ${section.posts.length}${front.length ? ` · 1–${front.length} παραπάνω` : ''}`)
        + `<div id="articles-grid">${monthGroups(slice, ctx, { kickerOn: false, level: 4 })}</div>`
        + pagination(page, total, to => route.section(section.kind, to)) + '</section>' : '';
    // Approved topics with at least one of their approved stories in this section; never a guess from tags.
    const ids = new Set(section.posts.map(post => post.id));
    const topics = topicsHtml(ctx.hubLinks.filter(link => (link.articleIds || []).some(id => ids.has(id))));
    const aside = '<aside class="ed-aside"><nav class="ed-aside__block" aria-label="Άλλες ενότητες"><h2 class="ed-label">Άλλες ενότητες</h2><ol class="ed-aside__list">'
        + model.sections.filter(other => other !== section).map(other => `<li data-kind="${other.kind}"><a href="${route.section(other.kind)}"><span>${esc(other.label)}</span>${num(other.posts.length)}</a></li>`).join('')
        + `</ol></nav>${topics}<p class="ed-aside__block"><a class="ed-sechead__more" href="${route.archive}">Αρχείο ανά μήνα →</a></p></aside>`;
    return `<section class="ed-section" data-kind="${section.kind}" aria-labelledby="ed-section-title">${head}${frontHtml}<div class="ed-columns">${list}${aside}</div></section>`;
}

function monthBody(ctx, key) {
    const { model } = ctx;
    const posts = model.months.get(key);
    const index = model.monthKeys.indexOf(key);
    const newer = model.monthKeys[index - 1];
    const older = model.monthKeys[index + 1];
    const step = (to, label) => (to ? `<a href="${route.month(to)}"><span>${label}</span>${esc(T.monthName(to))}</a>` : '<span></span>');
    return '<section class="ed-archive">'
        + `<header class="ed-section__head"><p class="ed-label">Αρχείο</p><h1 class="ed-section__title" id="ed-section-title">${esc(T.monthName(key))}</h1>`
        + `<p class="ed-section__facts ed-num">${esc(T.plural(posts.length, 'ιστορία', 'ιστορίες'))} αυτόν τον μήνα · ${model.published.length} συνολικά, ${esc(rangeText(model.published))}</p></header>`
        + '<div class="ed-columns ed-columns--archive"><nav class="ed-archive__index" aria-label="Μήνες του αρχείου">'
        + yearsOf(model).map(year => calendarYear(model, year, key)).join('') + '</nav>'
        + `<div class="ed-list">${sechead('ed-list-title', 'Κατά ημερομηνία')}`
        + `<div id="articles-grid"><ol class="ed-rows ed-rows--archive">${posts.map(post => rowHtml(post, ctx, { excerpt: true })).join('')}</ol></div>`
        + `<nav class="ed-monthnav" aria-label="Γειτονικοί μήνες">${step(newer, 'Νεότερος')}${step(older, 'Παλαιότερος')}</nav></div></div></section>`;
}
function archiveBody(ctx) {
    const { model } = ctx;
    return '<section class="ed-archive ed-archive--hub">'
        + '<header class="ed-section__head"><p class="ed-label">Αρχείο</p><h1 class="ed-section__title" id="ed-section-title">Αρχείο ανά μήνα</h1>'
        + `<p class="ed-section__facts ed-num">${esc(T.plural(model.published.length, 'ιστορία', 'ιστορίες'))} σε ${esc(T.plural(model.monthKeys.length, 'μήνα', 'μήνες'))} · ${esc(rangeText(model.published))}</p></header>`
        + `<div class="ed-calendar">${yearsOf(model).map(year => calendarYear(model, year, '')).join('')}</div></section>`;
}

// ── Pages ────────────────────────────────────────────────
// Each page: head block (title, description, canonical, previews) + main block, inside the markers of index.html.
function headHtml({ title, description, path: pagePath, canonical = SITE + pagePath, prev = '', next = '', preload = '', stylesheet = '' }) {
    return [
        `    <title>${esc(title)}</title>`,
        `    <meta name="description" content="${esc(description)}">`,
        `    <meta property="og:title" content="${esc(title)}">`,
        `    <meta property="og:description" content="${esc(description)}">`,
        `    <meta property="og:image" content="${SITE}/images/icons/icon-512.png">`,
        `    <meta property="og:url" content="${esc(canonical)}">`,
        '    <meta property="og:type" content="website">',
        '    <meta name="twitter:card" content="summary">',
        `    <meta name="twitter:title" content="${esc(title)}">`,
        `    <meta name="twitter:description" content="${esc(description)}">`,
        `    <meta name="twitter:image" content="${SITE}/images/icons/icon-512.png">`,
        `    <link rel="canonical" href="${esc(canonical)}">`,
        prev && `    <link rel="prev" href="${esc(SITE + prev)}">`,
        next && `    <link rel="next" href="${esc(SITE + next)}">`,
        preload && `    ${preload}`,
        stylesheet && `    <link rel="stylesheet" href="${esc(stylesheet)}">`
    ].filter(Boolean).join('\n');
}
const mainHtml = (className, inner, attrs = '') => `<main id="main" class="edition ${className}"${attrs}>\n    <div class="container">\n${inner}\n    </div>\n</main>`;

// The Edition Index's pages as { file, path, head, main }. `deps` supplies story images (build/index.js owns them).
function buildPages(posts, { today, selection = {}, deps, preload = '', hubLinks = [], collectionLinks = [], briefingLinks = [] }) {
    const model = buildModel(posts, today, selection);
    const ctx = { model, deps, hubLinks, collectionLinks, briefingLinks };
    const pages = [];
    const rail = current => railHtml(ctx, current);
    // The front page's lead (indexBody): the editor's or the week's lead, otherwise the newest story.
    const frontLead = model.lead || model.newest;
    const leadImage = frontLead ? deps.storyImage(frontLead) : '';
    const leadSrcset = leadImage ? (deps.cardSrcset || T.cardImageSrcset)(leadImage, false) : '';
    pages.push({
        file: 'index.html', path: route.index, canonical: `${SITE}${route.index}`, lastmod: model.reference,
        head: headHtml({
            title: 'Άρθρα Formula 1, Αναλύσεις & Ιστορίες | F1 Stories', path: BLOG + '/', canonical: `${SITE}${route.index}`,
            description: 'Διαβάστε νέα, τεχνικές αναλύσεις, γνώμες και ιστορικά αφιερώματα. Περιηγηθείτε στα άρθρα του F1 Stories ανά ενότητα, συντάκτη ή μήνα.',
            preload: preload || (leadImage ? `<link rel="preload" as="image" href="${esc(leadImage)}"${leadSrcset ? ` imagesrcset="${esc(leadSrcset)}" imagesizes="${T.CARD_SIZES.editionWeek}"` : ''} fetchpriority="high">` : ''),
            // THE EDITION's front-page styles: this page only, so section and month pages never inline them.
            stylesheet: '/blog-module/blog/archive-front.min.css'
        }),
        // The rail stays hidden here; blog-index.js shows it for a ?category= view (a section on a phone).
        main: mainHtml('ed-index', mastheadHtml(ctx, 'index', true) + '\n' + rail('') + '\n' + indexBody(ctx))
    });
    model.sections.forEach(section => {
        const total = sectionPageCount(section);
        const metadata = SECTION_METADATA[section.name];
        for (let page = 1; page <= total; page += 1) {
            pages.push({
                file: path.posix.join('section', section.kind, page > 1 ? `page/${page}` : '', 'index.html'), path: route.section(section.kind, page), lastmod: latestDay(section.posts), changefreq: 'weekly', priority: page > 1 ? '0.4' : '0.7',
                head: headHtml({
                    title: `${metadata.title}${page > 1 ? ` · Σελίδα ${page}` : ''} | F1 Stories`,
                    description: `${metadata.description}${page > 1 ? ` Σελίδα ${page} από ${total}.` : ''}`,
                    path: route.section(section.kind, page),
                    prev: page > 1 ? route.section(section.kind, page - 1) : '', next: page < total ? route.section(section.kind, page + 1) : ''
                }),
                main: mainHtml('ed-page ed-page--section', mastheadHtml(ctx, section.kind, false) + '\n' + rail(section.kind) + '\n' + sectionBody(ctx, section, page), ` data-kind="${section.kind}"`)
            });
        }
    });
    model.monthKeys.forEach(key => {
        pages.push({
            file: path.posix.join('archive', key.slice(0, 4), key.slice(5, 7), 'index.html'), path: route.month(key), lastmod: latestDay(model.months.get(key)), changefreq: 'monthly', priority: '0.5',
            head: headHtml({
                title: `${T.monthName(key)} — Αρχείο F1 Stories`,
                description: `Αρχείο F1 Stories — ${T.monthName(key)}: ${T.plural(model.months.get(key).length, 'ιστορία', 'ιστορίες')}. Περιηγηθείτε στα άρθρα του μήνα, από τα νεότερα στα παλαιότερα.`,
                path: route.month(key)
            }),
            main: mainHtml('ed-page ed-page--archive', mastheadHtml(ctx, 'archive', false) + '\n' + monthBody(ctx, key))
        });
    });
    if (model.monthKeys.length) {
        pages.push({
            file: path.posix.join('archive', 'index.html'), path: route.archive, lastmod: model.reference, changefreq: 'monthly', priority: '0.5',
            head: headHtml({
                title: 'Αρχείο ανά μήνα — F1 Stories',
                description: `Αναζητήστε παλαιότερα άρθρα στο μηνιαίο αρχείο του F1 Stories: ${T.plural(model.published.length, 'ιστορία', 'ιστορίες')} σε ${T.plural(model.monthKeys.length, 'μήνα', 'μήνες')}, με ειδήσεις, αναλύσεις και αφιερώματα.`,
                path: route.archive
            }),
            main: mainHtml('ed-page ed-page--archive', mastheadHtml(ctx, 'archive', false) + '\n' + archiveBody(ctx))
        });
    }
    return { pages, model };
}

// ── Output ───────────────────────────────────────────────
function replaceBetween(html, begin, end, inner) {
    const start = html.indexOf(begin);
    const finish = html.indexOf(end);
    if (start === -1 || finish === -1 || finish < start) throw new Error(`shell is missing the ${begin} / ${end} markers`);
    return `${html.slice(0, start + begin.length)}\n${inner}\n    ${html.slice(finish)}`;
}
function composePage(shell, page) {
    let html = replaceBetween(shell, '<!-- f1s:discovery-head:begin -->', '<!-- f1s:discovery-head:end -->', page.head);
    html = replaceBetween(html, '<!-- f1s:discovery-main:begin -->', '<!-- f1s:discovery-main:end -->', page.main);
    return html;
}
function walkInto(dir, files) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) walkInto(abs, files);
        else if (entry.name === 'index.html') files.push(abs);
    });
}
// Every generated page (section/** and archive/**) under blogDir.
function listGeneratedFiles(blogDir) {
    const files = [];
    GENERATED_ROOTS.forEach(root => walkInto(path.join(blogDir, root), files));
    return files;
}

// Writes every page into `blogDir` (the shell is blogDir/index.html) and removes generated pages that no longer
// exist (a section or month with no stories left must not stay public). Returns the written route paths.
function writeDiscoveryPages(blogDir, pagesResult) {
    const shellPath = path.join(blogDir, 'index.html');
    const shell = fs.readFileSync(shellPath, 'utf8');
    const keep = new Set();
    pagesResult.pages.forEach(page => {
        const target = path.join(blogDir, page.file);
        keep.add(path.resolve(target));
        const html = composePage(shell, page);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== html) fs.writeFileSync(target, html);
    });
    listGeneratedFiles(blogDir).filter(file => !keep.has(path.resolve(file))).forEach(file => {
        fs.rmSync(file);
        // Drop the folders that this left empty, up to the generated root.
        for (let dir = path.dirname(file); GENERATED_ROOTS.every(root => dir !== path.join(blogDir, root)) && dir.startsWith(blogDir); dir = path.dirname(dir)) {
            if (fs.readdirSync(dir).length) break;
            fs.rmdirSync(dir);
        }
    });
    return pagesResult.pages.filter(page => page.file !== 'index.html').map(page => page.path);
}

module.exports = {
    BLOG, SITE, route, buildModel, buildPages, composePage, writeDiscoveryPages, listGeneratedFiles,
    sectionPageCount, pagination, rowHtml, leadHtml, monthGroups, kicker, headHtml, collectionsAsideHtml, briefingsAsideHtml
};
