// The static author pages (authors/<slug>/): one standalone, indexable page per taxonomy.js AUTHORS record, built from
// the /authors/ directory shell (authors-page.js), with the writer's published stories.
const { fs, path, CONFIG, escapeHtmlAttribute } = require('./shared');
const { AUTHORS, findAuthor, authorPath, greekUpper, formatDate, athensDay } = require('../taxonomy');
const { SITE } = require('./discovery');
const { isPublishedArticle, jsonLd } = require('./entities/hubs');
const { renderAuthorProfile, AUTHORS_HTML_PATH } = require('./authors-page');

const FOOTER_PATH = path.join(CONFIG.BLOG_DIR, '..', '..', 'partials', 'footer.html');
// authors/<slug>/ folders the build owns (one per AUTHORS record).
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Accounts the publication owns (the footer's profiles) never stand for one writer, whichever card links them.
let brandProfiles = null;
function isBrandProfile(url) {
    if (!brandProfiles) brandProfiles = new Set([...fs.readFileSync(FOOTER_PATH, 'utf8').matchAll(/<a href="([^"]+)"[^>]*aria-label="F1 Stories στο /g)].map(match => match[1]));
    return brandProfiles.has(url);
}

function swap(html, pattern, replacement, what) {
    if (!pattern.test(html)) throw new Error(`authors/index.html: ${what} not found; author pages not rendered`);
    return html.replace(pattern, replacement);
}

// One writer's page: the directory shell in the focused state authors.js gives ?author= views, rendered statically,
// with the writer's published stories. The house byline is presented as the editorial team, never as a person.
function renderAuthorPage(shell, author, index, stories) {
    const esc = escapeHtmlAttribute;
    const canonical = SITE + authorPath(author);
    const house = author.house === true;
    const heading = house ? 'Η ομάδα του F1 Stories' : author.label;
    const title = house ? `${heading} | F1 Stories` : `${author.label} · Συντάκτης | F1 Stories`;
    const description = house
        ? `Η κοινή υπογραφή της συντακτικής ομάδας του F1 Stories. ${author.specialty}.`
        : `${author.label}: ${author.specialty}. ${author.bio}`;
    const sameAs = author.instagram && !isBrandProfile(author.instagram) ? [author.instagram] : [];
    const entity = house
        ? { '@type': 'Organization', '@id': `${SITE}/#organization`, name: 'F1 Stories', url: `${SITE}/` }
        : { '@type': 'Person', '@id': `${canonical}#person`, name: author.label, url: canonical, image: SITE + author.portrait, description: author.specialty, ...(sameAs.length ? { sameAs } : {}) };
    const schema = { '@context': 'https://schema.org', '@type': 'ProfilePage', '@id': canonical, url: canonical, name: heading, description, inLanguage: 'el', isPartOf: { '@id': `${SITE}/#website` }, mainEntity: entity };
    const head = [
        `<link rel="canonical" href="${canonical}">`,
        `  <meta property="og:title" content="${esc(title)}">`,
        `  <meta property="og:description" content="${esc(description)}">`,
        `  <meta property="og:url" content="${canonical}">`,
        `  <meta property="og:type" content="${house ? 'website' : 'profile'}">`,
        `  <meta property="og:image" content="${SITE}${esc(author.portrait)}">`,
        '  <meta name="twitter:card" content="summary">',
        `  <script type="application/ld+json">${jsonLd(schema)}</script>`
    ].join('\n');
    const profile = renderAuthorProfile(author, index, new Map(stories.map(post => [post.id, post])))
        .replace('class="author-profile"', 'class="author-profile is-selected"')
        .replace('loading="lazy"', 'loading="eager"')
        .replaceAll(`href="${authorPath(author)}"`, `href="${authorPath(author)}" aria-current="page"`);
    const rows = stories.map(post => `<li><time datetime="${esc(post.date)}">${esc(formatDate(post.date))}</time>`
        + `<a href="/blog-module/blog-entries/${esc(post.id)}/article.html">${esc(post.title)}</a></li>`).join('');
    const archive = '<section class="author-archive" aria-labelledby="author-archive-title">'
        + `<h2 class="author-archive__title" id="author-archive-title">${house ? 'Τα άρθρα της ομάδας' : 'Όλα τα άρθρα'} <span>${stories.length}</span></h2>`
        + (house ? '<p class="author-archive__note">Η υπογραφή F1 Stories ανήκει στη συντακτική ομάδα του F1 Stories, όχι σε έναν συντάκτη.</p>' : '')
        + (rows ? `<ol class="author-archive__list">${rows}</ol>` : '<p class="author-archive__note">Δεν υπάρχουν ακόμη δημοσιευμένα άρθρα.</p>')
        + '</section>';
    let html = swap(shell, /<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`, 'title');
    html = swap(html, /<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(description)}">`, 'description');
    html = swap(html, /<link rel="canonical" href="[^"]*">/, () => head, 'canonical');
    html = swap(html, /(<div class="authors-edition"><span>[^<]*<\/span><span>)[^<]*(<\/span><\/div>)/, `$1${esc(greekUpper(author.desk))}$2`, 'edition folio');
    html = swap(html, /<h1>[\s\S]*?<\/h1>/, `<h1>${esc(heading)}<span class="editorial-accent">.</span></h1>`, 'h1');
    html = swap(html, /\s*<div class="authors-intro__copy">[\s\S]*?<\/div>/, '', 'intro copy');
    html = swap(html, / href="\/authors\/" hidden>/, ' href="/authors/">', 'directory link');
    return swap(html, /<div class="author-directory" data-author-directory aria-live="polite">\s*<!-- f1s:authors-directory:begin -->[\s\S]*?<!-- f1s:authors-directory:end -->/,
        () => `<div class="author-directory is-focused" data-author-directory>\n        ${profile}\n\n        ${archive}`, 'directory');
}

// Writes authors/<slug>/index.html for every record from the current /authors/ shell (run it after the article pages
// exist: a story is listed only when its page is public) and removes pages of records that no longer exist.
function writeAuthorPages(posts, { today = athensDay(), htmlPath = AUTHORS_HTML_PATH, isPublic } = {}) {
    const shell = fs.readFileSync(htmlPath, 'utf8');
    const dir = path.dirname(htmlPath);
    const pages = AUTHORS.map((author, index) => {
        const stories = posts.filter(post => (findAuthor(post.author) || {}).slug === author.slug && isPublishedArticle(post, today, isPublic));
        const file = path.join(dir, author.slug, 'index.html');
        const html = renderAuthorPage(shell, author, index, stories);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== html) fs.writeFileSync(file, html);
        return { path: authorPath(author), stories: stories.length };
    });
    const keep = new Set(AUTHORS.map(author => author.slug));
    fs.readdirSync(dir, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && SLUG.test(entry.name) && !keep.has(entry.name) && fs.existsSync(path.join(dir, entry.name, 'index.html')))
        .forEach(entry => {
            fs.rmSync(path.join(dir, entry.name, 'index.html'));
            if (!fs.readdirSync(path.join(dir, entry.name)).length) fs.rmdirSync(path.join(dir, entry.name));
        });
    console.log(`Author pages rendered: ${pages.map(page => `${page.path} (${page.stories})`).join(', ')}`);
    return pages;
}

module.exports = { renderAuthorPage, writeAuthorPages };
