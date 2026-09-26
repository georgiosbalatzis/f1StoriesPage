// Renders the /authors/ directory from the one author list (taxonomy.js AUTHORS),
// so a writer's name, portrait, desk, specialty, bio, column and featured stories
// are never retyped in HTML. Numbering follows the list order.
const { fs, path, CONFIG, escapeHtmlAttribute } = require('./shared');
const { AUTHORS } = require('../taxonomy');

const AUTHORS_HTML_PATH = path.join(CONFIG.BLOG_DIR, '..', '..', 'authors', 'index.html');
const BEGIN = '<!-- f1s:authors-directory:begin -->';
const END = '<!-- f1s:authors-directory:end -->';

function renderAuthorProfile(author, index, postsById) {
    const esc = escapeHtmlAttribute;
    // A featured story may carry a shorter display title; otherwise the article's own.
    const stories = (author.stories || [])
        .map(story => ({ story, post: postsById.get(story.id) }))
        .filter(item => item.post);
    const year = stories.length ? String(stories[0].post.date || '').slice(0, 4) : '';
    const links = stories
        .map(({ story, post }) => `<a href="/blog-module/blog-entries/${esc(post.id)}/article.html">${esc(story.title || post.title)}</a>`)
        .join('');
    const social = author.instagram
        ? `<a class="author-profile__social" href="${esc(author.instagram)}" target="_blank" rel="noopener">Instagram ↗</a>`
        : '';
    return `<article id="author-${author.slug}" class="author-profile" data-author-slug="${author.slug}" data-author-name="${esc(author.name)}">
          <div class="author-profile__portrait-wrap">
            <a class="author-profile__portrait" href="/authors/?author=${author.slug}" aria-label="Προφίλ ${esc(author.label)}">
              <img src="${esc(author.portrait)}" alt="${esc(author.label)}" width="240" height="240" loading="${index === 0 ? 'eager' : 'lazy'}" decoding="async">
            </a>
            <span class="author-profile__number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
          </div>
          <div class="author-profile__content">
            <span class="author-profile__kicker">${esc(author.desk)}</span>
            <h2 class="author-profile__name"><a href="/authors/?author=${author.slug}">${esc(author.label)}</a></h2>
            <p class="author-profile__specialty">${esc(author.specialty)}</p>
            <p class="author-profile__bio">${esc(author.bio)}</p>
            <div class="author-profile__column"><strong>Επαναλαμβανόμενη στήλη</strong><span>${esc(author.column)}</span></div>`
        + (links ? `\n            <div class="author-profile__stories"><div class="author-profile__stories-head"><strong>Επιλεγμένα άρθρα</strong><span>${year}</span></div>${links}</div>` : '')
        + `\n            <div class="author-profile__links"><a class="author-profile__archive" href="/blog-module/blog/index.html?author=${author.slug}">Όλα τα άρθρα ↗</a>${social}</div>
          </div>
        </article>`;
}

function injectAuthorsDirectory(posts, htmlPath = AUTHORS_HTML_PATH) {
    if (!fs.existsSync(htmlPath)) return false;
    const html = fs.readFileSync(htmlPath, 'utf8');
    const start = html.indexOf(BEGIN);
    const end = html.indexOf(END);
    if (start === -1 || end < start) {
        console.warn('⚠️  authors/index.html has no directory markers; /authors/ not rendered');
        return false;
    }
    const postsById = new Map(posts.map(post => [post.id, post]));
    AUTHORS.forEach(author => (author.stories || []).forEach(story => {
        if (!postsById.has(story.id)) console.warn(`⚠️  ${author.slug}: featured story "${story.id}" not found; it is left out of /authors/`);
    }));
    const body = AUTHORS.map((author, index) => `        ${renderAuthorProfile(author, index, postsById)}`).join('\n\n');
    const updated = `${html.slice(0, start + BEGIN.length)}\n${body}\n        ${html.slice(end)}`;
    if (updated === html) return false;
    fs.writeFileSync(htmlPath, updated);
    console.log(`Authors directory rendered into ${htmlPath}`);
    return true;
}

module.exports = { injectAuthorsDirectory, renderAuthorProfile };
