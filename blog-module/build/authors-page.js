// Renders the /authors/ directory from the one author list (taxonomy.js AUTHORS),
// so a writer's name, portrait, desk, specialty, bio, column and featured stories
// are never retyped in HTML. Numbering follows the list order.
const { fs, path, CONFIG, escapeHtmlAttribute } = require('./shared');
const { AUTHORS, findAuthor, greekUpper } = require('../taxonomy');

const AUTHORS_HTML_PATH = path.join(CONFIG.BLOG_DIR, '..', '..', 'authors', 'index.html');
const HOME_HTML_PATH = path.join(CONFIG.BLOG_DIR, '..', '..', 'index.html');
const BEGIN = '<!-- f1s:authors-directory:begin -->';
const END = '<!-- f1s:authors-directory:end -->';
const TEAM_BEGIN = '<!-- f1s:home-team:begin -->';
const TEAM_END = '<!-- f1s:home-team:end -->';

function replaceBetween(html, begin, end, body) {
    const start = html.indexOf(begin);
    const stop = html.indexOf(end);
    if (start === -1 || stop < start) return null;
    return `${html.slice(0, start + begin.length)}\n${body}\n${html.slice(stop)}`;
}

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

// "2026-09-23" → "23.09.2026"
function dotDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
    return match ? `${match[3]}.${match[2]}.${match[1]}` : '';
}

// Homepage team: one spotlight card per writer (the page script rotates them) and
// the roster beside it. Every card carries the writer's three newest stories.
function renderHomeTeam(posts) {
    const esc = escapeHtmlAttribute;
    const newest = [...posts].sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)));
    const total = AUTHORS.length;
    const cards = AUTHORS.map((author, index) => {
        const stories = newest
            .filter(post => (findAuthor(post.author) || {}).slug === author.slug)
            .slice(0, 3)
            .map(post => `<li><span>${dotDate(post.date)}</span><a href="/blog-module/blog-entries/${esc(post.id)}/article.html">${esc(post.title)}</a></li>`)
            .join('');
        const social = author.instagram
            ? `<a class="team-card__social" href="${esc(author.instagram)}" target="_blank" rel="noopener">INSTAGRAM <span aria-hidden="true">↗</span></a>`
            : '';
        return `                <article class="team-card${index === 0 ? ' is-active' : ''}" data-author-slug="${author.slug}" role="group" aria-roledescription="slide" aria-label="${index + 1} από ${total}: ${esc(author.label)}">
                    <span class="team-card__timer" aria-hidden="true"></span>
                    <p class="team-card__label">ΣΤΗΝ ΠΡΩΤΗ ΣΕΛΙΔΑ / ${esc(greekUpper(author.column))}</p>
                    <div class="team-card__head">
                        <img class="team-card__avatar" src="${esc(author.portrait)}" alt="" width="240" height="240" loading="lazy" decoding="async">
                        <div>
                            <p class="team-card__desk">${esc(greekUpper(author.desk))}</p>
                            <h3 class="team-card__name"><a href="/authors/?author=${author.slug}">${esc(author.label)}</a></h3>
                            <p class="team-card__specialty">${esc(author.specialty)}</p>
                        </div>
                    </div>
                    <p class="team-card__bio">${esc(author.bio)}</p>`
            + (stories ? `\n                    <ul class="team-card__stories">${stories}</ul>` : '')
            + `\n                    <div class="team-card__actions"><a class="team-card__all" href="/blog-module/blog/index.html?author=${author.slug}">ΟΛΑ ΤΑ ΑΡΘΡΑ ΤΟΥ ${esc(greekUpper(author.genitive))} <span aria-hidden="true">→</span></a>${social}</div>
                </article>`;
    }).join('\n');
    const roster = AUTHORS.map((author, index) => `                <li class="team-roster__item${index === 0 ? ' is-current' : ''}" data-author-slug="${author.slug}"${index === 0 ? ' aria-current="true"' : ''}>
                    <span class="team-roster__num" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
                    <img src="${esc(author.portrait)}" alt="" width="240" height="240" loading="lazy" decoding="async">
                    <div class="team-roster__text">
                        <p class="team-roster__desk">${esc(greekUpper(author.desk))}</p>
                        <h3 class="team-roster__name"><a href="/authors/?author=${author.slug}">${esc(author.label)}</a></h3>
                        <p>${esc(author.specialty)}</p>
                    </div>
                    <span class="team-roster__arrow" aria-hidden="true">→</span>
                </li>`).join('\n');
    return `            <div class="team-spotlight" data-team-spotlight role="region" aria-roledescription="carousel" aria-label="Συντάκτης στο προσκήνιο">
                <button class="team-spotlight__pause" type="button" aria-pressed="false" data-team-pause hidden><span class="visually-hidden">Παύση εναλλαγής</span><span aria-hidden="true">❚❚</span></button>
                <div class="team-spotlight__cards">
${cards}
                </div>
            </div>
            <div class="team-side">
                <ol class="team-roster" aria-label="Η ομάδα">
${roster}
                </ol>
                <a class="team-directory-link" href="/authors/">ΓΝΩΡΙΣΕ ΟΛΗ ΤΗΝ ΟΜΑΔΑ <span aria-hidden="true">→</span></a>
            </div>
            `;
}

function injectHomeTeam(posts, htmlPath = HOME_HTML_PATH) {
    if (!fs.existsSync(htmlPath)) return false;
    const html = fs.readFileSync(htmlPath, 'utf8');
    const updated = replaceBetween(html, TEAM_BEGIN, TEAM_END, renderHomeTeam(posts));
    if (updated === null) {
        console.warn('⚠️  index.html has no home-team markers; the homepage team was not rendered');
        return false;
    }
    if (updated === html) return false;
    fs.writeFileSync(htmlPath, updated);
    console.log(`Homepage team rendered into ${htmlPath}`);
    return true;
}

module.exports = { injectAuthorsDirectory, renderAuthorProfile, injectHomeTeam, renderHomeTeam };
