// The article description contract: one plain-text value per article for <meta name="description">,
// og:/twitter:description and the JSON-LD description, at most DESCRIPTION_MAX characters (grapheme clusters, an
// F1 Stories convention). An editor's `excerpt:` front matter is authoritative: validated, never rewritten beyond
// whitespace, never truncated. Articles without one get a fallback taken from the article body as served.
// scripts/author/article-source.js mirrors the counting and validation for the author tool (parity is tested).
const fs = require('fs');
const path = require('path');
const { utils } = require('./shared');
const { articleBodyHtml } = require('./reading-time');
const { isReleased, isPublishedArticle } = require('./entities/hubs');
const { athensDay } = require('../taxonomy');

const ROOT = path.resolve(__dirname, '../..');
const DESCRIPTION_MAX = 155;
const MIN_WORDS = 3;
const EXEMPT_PATH = path.join(__dirname, 'excerpt-exempt.json');

const segmenter = typeof Intl === 'object' && Intl.Segmenter ? new Intl.Segmenter('el', { granularity: 'grapheme' }) : null;
function graphemes(text) {
    return segmenter ? Array.from(segmenter.segment(text), part => part.segment) : Array.from(text);
}

// Every Unicode space (no-break, thin, line separators…) to one space, invisible characters dropped. No Unicode
// normalisation: NFC would rewrite the Greek question mark and ano teleia, and graphemes count either form alike.
function normalizeText(value) {
    return String(value ?? '').replace(/[­​-‍⁠﻿]/g, '').replace(/\s+/g, ' ').trim();
}

function wordCount(text) {
    return (String(text).match(/[\p{L}\p{N}]+/gu) || []).length;
}

const NAMED_ENTITIES = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ensp: ' ', emsp: ' ', thinsp: ' ',
    ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»', lsquo: '‘', rsquo: '’', sbquo: '‚',
    ldquo: '“', rdquo: '”', bdquo: '„', middot: '·', bull: '•', deg: '°', copy: '©', reg: '®', trade: '™',
    euro: '€', pound: '£', times: '×', divide: '÷', plusmn: '±', shy: '', zwnj: '', zwj: '', lrm: '', rlm: ''
};
const ENTITY = /&(?:#(\d{1,7})|#x([\da-f]{1,6})|([a-z][a-z\d]{1,31}));/gi;
const LAYERED_ENTITY = /&amp;(?:#\d{1,7}|#x[\da-f]{1,6}|[a-z][a-z\d]{1,31});/i;

// Unknown names and invalid or control code points stay as written (the report flags them).
function decodeEntitiesOnce(text) {
    return text.replace(ENTITY, (match, dec, hex, name) => {
        if (name) return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, name) ? NAMED_ENTITIES[name] : match;
        const code = dec ? Number(dec) : parseInt(hex, 16);
        const control = code < 0x20 ? ![9, 10, 13].includes(code) : code >= 0x7f && code <= 0x9f;
        return control || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff) ? match : String.fromCodePoint(code);
    });
}

// Text taken from HTML is decoded once, as a browser reads it; an entity still hiding behind "&amp;" was escaped
// twice upstream ("&amp;amp;") and is decoded again, at most twice more. Editorial excerpts are never decoded.
function decodeHtmlText(text) {
    let out = String(text ?? '');
    for (let pass = 0; pass < 3; pass++) {
        const layered = LAYERED_ENTITY.test(out);
        out = decodeEntitiesOnce(out);
        if (!layered) break;
    }
    return out;
}

// Elements whose content is not article prose: code, media, embeds, controls, data tables and the page furniture the
// build adds to bodies (galleries, data bands, BetCast blocks, credits).
const SKIP_TAGS = new Set(['script', 'style', 'template', 'noscript', 'svg', 'math', 'iframe', 'object', 'video', 'audio',
    'canvas', 'picture', 'figure', 'table', 'button', 'select', 'textarea', 'form', 'nav']);
const FURNITURE = /(?:^|\s)(?:gallery-carousel|table-|card-container|embed-container|social-embed|youtube-|video-caption|media-credit|instagram-media|twitter-tweet|text-post-media|fb-|rr-data|rr-chart|betcast-)/;
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const BLOCK_TAGS = new Set(['address', 'article', 'aside', 'blockquote', 'br', 'caption', 'dd', 'details', 'div', 'dl', 'dt',
    'figcaption', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'ol', 'p', 'pre', 'section',
    'summary', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul']);
const TOKEN = /<!--[\s\S]*?(?:-->|$)|<(\/?)([a-z][a-z\d-]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;

function skipsContent(name, attrs) {
    const className = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
    return SKIP_TAGS.has(name) || /\baria-hidden\s*=\s*["']?true/i.test(attrs)
        || Boolean(className && FURNITURE.test(className[1] ?? className[2] ?? className[3]));
}

// Readable prose of an HTML fragment: block boundaries and <br> become spaces, inline markup joins its neighbours,
// comments, attributes and skipped elements leave nothing, entities are decoded and whitespace collapsed.
function htmlToText(html) {
    const source = String(html ?? '');
    let text = '';
    let skip = '';
    let depth = 0;
    let last = 0;
    for (const match of source.matchAll(TOKEN)) {
        const [token, close, rawName = '', attrs = ''] = match;
        const name = rawName.toLowerCase();
        if (!skip) text += source.slice(last, match.index);
        last = match.index + token.length;
        if (!name) continue;
        const opens = !close && !VOID_TAGS.has(name) && !/\/\s*$/.test(attrs);
        if (skip) {
            if (name === skip) depth += close ? -1 : opens ? 1 : 0;
            if (depth === 0) skip = '';
        } else if (opens && skipsContent(name, attrs)) {
            skip = name;
            depth = 1;
        } else if (BLOCK_TAGS.has(name)) {
            text += ' ';
        }
    }
    if (!skip) text += source.slice(last);
    return normalizeText(decodeHtmlText(text));
}

// Function words a cut description must not end on.
const DANGLING = new Set(('και ή να θα το τα η ο οι του της των τον την τη στο στη στην στον στα στις στους σε με για '
    + 'από που ότι αλλά ενώ ως αν όπως ούτε μα and or the a an of to in on at for with by but as').split(' '));

// At most `max` characters: complete text as is; otherwise the last whole sentence when it fills most of the room,
// else a whole-word cut without trailing punctuation or function words, plus "…" (counted in the limit).
function clampDescription(text, max = DESCRIPTION_MAX) {
    const parts = graphemes(text);
    if (parts.length <= max) return text;
    const room = max - 1;
    let cut = parts.slice(0, room).join('');
    let sentenceEnd = -1;
    // A full stop after a list number or an initial ("1.", "Κ.") does not end a sentence.
    for (const match of parts.slice(0, room + 1).join('').matchAll(/(?<!(?:^|\s)(?:\d{1,2}|\p{L}))[.!?;;…](?= )/gu)) {
        if (match.index < cut.length) sentenceEnd = match.index + 1;
    }
    if (sentenceEnd >= cut.length * 0.6) return cut.slice(0, sentenceEnd);
    if (parts[room] !== ' ') {
        const space = cut.lastIndexOf(' ');
        if (space >= cut.length * 0.5) cut = cut.slice(0, space);
    }
    for (let pass = 0; pass < 4; pass++) {
        const before = cut;
        cut = cut.replace(/[\s,;;:·\-–—(«“"'‘/|&]+$/u, '');
        const space = cut.lastIndexOf(' ');
        if (space > 0 && DANGLING.has(cut.slice(space + 1).toLocaleLowerCase('el'))) cut = cut.slice(0, space);
        if (cut === before) break;
    }
    return `${cut.replace(/[.…]+$/, '')}…`;
}

// The generated description of an article without an editorial excerpt: its prose, minus a leading repeat of the
// title. A body with no usable prose (an image gallery) is described by its title rather than by invented text.
function fallbackDescription(bodyHtml, title = '') {
    const heading = normalizeText(title);
    let text = htmlToText(bodyHtml);
    if (heading && text.toLocaleLowerCase('el').startsWith(heading.toLocaleLowerCase('el'))) {
        text = text.slice(heading.length).replace(/^[\s:.,|–—-]+/, '');
    }
    return clampDescription(wordCount(text) >= MIN_WORDS ? text : heading);
}

function excerptIssues(value) {
    const text = normalizeText(value);
    if (!text) return [{ code: 'missing' }];
    const issues = [];
    if (/<[a-z!/?]/i.test(text) || /&(?:#\d|#x[\da-f]|[a-z][a-z\d]*;)/i.test(text)) issues.push({ code: 'markup' });
    if (wordCount(text) < MIN_WORDS) issues.push({ code: 'short' });
    const length = graphemes(text).length;
    if (length > DESCRIPTION_MAX) issues.push({ code: 'long', length });
    return issues;
}

const EXCERPT_MESSAGES = {
    missing: () => 'Λείπει η περιγραφή άρθρου (excerpt). Γράψε μια σύντομη περιγραφή έως ' + DESCRIPTION_MAX + ' χαρακτήρες.',
    markup: () => 'Η περιγραφή περιέχει HTML ή κωδικούς χαρακτήρων (π.χ. &amp;). Γράψε απλό κείμενο, με τους χαρακτήρες όπως είναι.',
    short: () => 'Η περιγραφή είναι πολύ σύντομη. Γράψε τουλάχιστον μία πρόταση για το περιεχόμενο του άρθρου.',
    long: issue => 'Η περιγραφή έχει ' + issue.length + ' χαρακτήρες· το όριο είναι ' + DESCRIPTION_MAX + '. Συντόμευσέ τη κατά ' + (issue.length - DESCRIPTION_MAX) + '.'
};

function excerptMessage(issue) {
    return EXCERPT_MESSAGES[issue.code](issue);
}

// The description fields of a post from its source front matter and rendered body content.
function articleDescription(metadata, bodyHtml) {
    const excerpt = normalizeText(metadata.excerpt);
    return excerpt ? { excerpt, editorialExcerpt: true } : { excerpt: fallbackDescription(bodyHtml, metadata.title) };
}

function servedBody(post, root) {
    const file = path.join(root, 'blog-module/blog-entries', post.id, 'article.html');
    return fs.existsSync(file) ? articleBodyHtml(fs.readFileSync(file, 'utf8')) : post.content || '';
}

// Posts without an editorial excerpt take their fallback from the body as served, so a skipped, cached or source-less
// article gets exactly the description a full rebuild gives it.
function syncDescriptions(posts, { root = ROOT } = {}) {
    posts.forEach(post => {
        if (!post.editorialExcerpt) post.excerpt = fallbackDescription(servedBody(post, root), post.title);
    });
}

function loadExemptIds(file = EXEMPT_PATH) {
    return new Set(JSON.parse(fs.readFileSync(file, 'utf8')).ids);
}

function hasSourceDocument(post, root) {
    const dir = path.join(root, 'blog-module/blog-entries', post.id);
    return fs.existsSync(dir) && Boolean(utils.findSourceDocument(fs.readdirSync(dir)));
}

// Build step. An editorial excerpt is always validated. Every article outside the exempt list (the articles published
// before the rule, by id, so a backdated folder is still new) needs one once it is released, drafts excepted.
function checkExcerpts(posts, { exempt = loadExemptIds(), root = ROOT } = {}) {
    const errors = posts.flatMap(post => {
        if (post.editorialExcerpt) return excerptIssues(post.excerpt).map(issue => `  - ${post.id}: ${excerptMessage(issue)}`);
        if (exempt.has(post.id) || !isReleased(post) || !hasSourceDocument(post, root)) return [];
        return [`  - ${post.id}: ${excerptMessage({ code: 'missing' })} Πρόσθεσε στο source.txt τη γραμμή «excerpt: …».`];
    });
    if (errors.length) throw new Error(`Article descriptions need attention:\n${errors.join('\n')}`);
    const editorial = posts.filter(post => post.editorialExcerpt).length;
    console.log(`📝 Article descriptions: ${editorial} editorial, ${posts.length - editorial} generated (${exempt.size} articles predate the excerpt rule)`);
}

// Editorial backlog (npm run descriptions:report). The repository holds no Search Console or analytics export, so the
// order is stated, not a traffic ranking: quality warnings first, then articles editable in the author tools, newest first.
const SHORT_DESCRIPTION = 70;

function describeArticles(posts, { today = athensDay(), root = ROOT, isPublic } = {}) {
    const visible = posts.filter(post => isPublishedArticle(post, today, isPublic));
    const counts = new Map();
    visible.forEach(post => counts.set(post.excerpt, (counts.get(post.excerpt) || 0) + 1));
    return visible.map(post => {
        const text = htmlToText(servedBody(post, root));
        const warnings = [
            !post.editorialExcerpt && wordCount(text) < MIN_WORDS && 'title only: no usable body prose',
            graphemes(post.excerpt || '').length < SHORT_DESCRIPTION && `short (${graphemes(post.excerpt || '').length} characters)`,
            counts.get(post.excerpt) > 1 && 'duplicate of another article',
            /&(?:#\d|#x[\da-f]|[a-z][a-z\d]*;)/i.test(post.excerpt || '') && 'entity text',
            graphemes(post.excerpt || '').length > DESCRIPTION_MAX && `over ${DESCRIPTION_MAX} characters`
        ].filter(Boolean);
        const source = hasSourceDocument(post, root) ? `blog-module/blog-entries/${post.id}/source.txt` : '';
        return { id: post.id, date: post.date, title: post.title, editorial: Boolean(post.editorialExcerpt), source, warnings, excerpt: post.excerpt };
    }).sort((a, b) => (b.warnings.length > 0) - (a.warnings.length > 0) || Boolean(b.source) - Boolean(a.source)
        || b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

function renderDescriptionReport(rows) {
    const generated = rows.filter(row => !row.editorial);
    const flagged = rows.filter(row => row.warnings.length);
    return [
        `Article descriptions (editorial maximum ${DESCRIPTION_MAX} characters; excerpt: required for new articles)`,
        `- Published articles: ${rows.length}`,
        `- Editorial excerpts: ${rows.length - generated.length}`,
        `- Generated descriptions: ${generated.length} (${generated.filter(row => row.source).length} editable in the author tools, ${generated.filter(row => !row.source).length} without a source document)`,
        `- With quality warnings: ${flagged.length}`, ...flagged.map(row => `  - ${row.id}: ${row.warnings.join('; ')}`),
        '- Traffic data: none in the repository. The backlog is not a traffic ranking; rank it with a Search Console export.',
        '',
        'Backlog: articles using a generated description (warnings first, then editable sources, newest first)',
        ...generated.map((row, index) => `${index + 1}. ${row.id} · ${row.date} · ${row.source || 'no source document (edit in the repository)'}\n   ${row.title}\n   ${row.excerpt}`)
    ].join('\n') + '\n';
}

if (require.main === module) {
    const { posts } = JSON.parse(fs.readFileSync(path.join(ROOT, 'blog-module/blog-source-cache.json'), 'utf8'));
    process.stdout.write(renderDescriptionReport(describeArticles(posts)));
}

module.exports = {
    DESCRIPTION_MAX, MIN_WORDS, graphemes, normalizeText, wordCount, decodeHtmlText, htmlToText, clampDescription,
    fallbackDescription, excerptIssues, excerptMessage, articleDescription, syncDescriptions, loadExemptIds, checkExcerpts,
    describeArticles, renderDescriptionReport
};
