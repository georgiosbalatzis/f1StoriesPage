// P3D media contract: what the editors have verified about an image, keyed by "<article id>/<slot>" in
// blog-module/media-metadata.json (slot = the file's number: 1 card, 2 cover background, 3+ body images).
// Every field is optional and a missing entry changes nothing: no credit, caption, type or label is ever
// inferred. Only what is recorded here is printed, and only `synthetic: "confirmed"` prints the AI label.
//
//   type        photo | archival | poster | graphic | diagram | chart | illustration | render  (presentation only)
//   focus       "x% y%"  the point a crop keeps (object-position)
//   caption     verified caption text;  captionLang  BCP 47 tag when the caption is not Greek
//   credit      credit exactly as documented;  source  where that credit is documented (internal)
//   license     licence or permission reference, when one is on file (internal)
//   alt         verified alt text (replaces the generated "<title>: εικόνα N")
//   synthetic   "confirmed" when the image is documented as AI-generated
//   rights      "documented" when a licence/permission is on file (internal; unresolved cases live in the audit)
const { fs, path, escapeHtmlAttribute } = require('./shared');

const REGISTER_PATH = path.join(__dirname, '..', 'media-metadata.json');
const TYPES = new Set(['photo', 'archival', 'poster', 'graphic', 'diagram', 'chart', 'illustration', 'render']);
// Artwork that carries printed type or a drawing, and archival prints: shown whole, never cropped to a photo frame.
const CONTAINED = new Set(['archival', 'poster', 'graphic', 'diagram', 'chart', 'illustration']);
const FIELDS = new Set(['type', 'focus', 'caption', 'captionLang', 'credit', 'source', 'license', 'alt', 'synthetic', 'rights', 'note']);
const AI_LABEL = 'Εικονογράφηση δημιουργημένη με AI';

function validateRegister(data) {
    const images = data && typeof data.images === 'object' && !Array.isArray(data.images) ? data.images : {};
    const errors = [];
    for (const [key, entry] of Object.entries(images)) {
        if (!/^[^/\s]+\/\d+$/.test(key)) errors.push(`${key}: key must be "<article id>/<slot number>"`);
        if (!entry || typeof entry !== 'object') { errors.push(`${key}: entry must be an object`); continue; }
        for (const field of Object.keys(entry)) if (!FIELDS.has(field)) errors.push(`${key}: unknown field "${field}"`);
        if (entry.type !== undefined && !TYPES.has(entry.type)) errors.push(`${key}: type "${entry.type}" is not one of ${[...TYPES].join(', ')}`);
        if (entry.focus !== undefined && !/^(?:100|\d{1,2})% (?:100|\d{1,2})%$/.test(entry.focus)) errors.push(`${key}: focus must look like "50% 30%"`);
        if (entry.synthetic !== undefined && entry.synthetic !== 'confirmed') errors.push(`${key}: synthetic can only be "confirmed" (suspicions belong in the editorial audit)`);
        if (entry.rights !== undefined && entry.rights !== 'documented') errors.push(`${key}: rights can only be "documented"`);
        for (const field of ['caption', 'credit', 'alt', 'source', 'license', 'captionLang', 'note']) {
            if (entry[field] !== undefined && (typeof entry[field] !== 'string' || !entry[field].trim())) errors.push(`${key}: ${field} must be non-empty text`);
        }
    }
    return { images, errors };
}

let register = null;
function loadMediaRegister(file = REGISTER_PATH) {
    if (register && register.file === file) return register.images;
    const raw = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
    const { images, errors } = validateRegister(raw);
    if (errors.length) throw new Error(`media-metadata.json is invalid:\n  ${errors.join('\n  ')}`);
    register = { file, images };
    return images;
}

const mediaFor = (id, slot) => loadMediaRegister()[`${id}/${slot}`] || null;
// The slot number of an image path or file name ("/blog-module/blog-entries/X/2.webp", "2-card.webp" → "2").
const slotOf = image => (/(?:^|\/)(\d+)(?:-(?:card|mobile|sm|thumb))?\.(?:webp|avif|png|jpe?g)(?:[?#].*)?$/i.exec(String(image || '')) || [])[1] || null;
const isContained = meta => Boolean(meta && CONTAINED.has(meta.type));

// One quiet line under an image: caption, documented credit, AI disclosure. Empty when nothing is recorded.
function creditLineHtml(meta) {
    if (!meta) return '';
    const parts = [];
    if (meta.caption) parts.push(`<span class="media-credit__caption"${meta.captionLang ? ` lang="${escapeHtmlAttribute(meta.captionLang)}"` : ''}>${escapeHtmlAttribute(meta.caption)}</span>`);
    if (meta.credit) parts.push(`<span class="media-credit__source"><span class="media-credit__label">Πηγή</span> ${escapeHtmlAttribute(meta.credit)}</span>`);
    if (meta.synthetic === 'confirmed') parts.push(`<span class="media-credit__ai">${AI_LABEL}</span>`);
    return parts.length ? `<span class="media-credit">${parts.join('')}</span>` : '';
}

// Attributes for a card picture: data-media marks artwork/archival for containment, --focus is the crop's focal point.
function mediaAttributes(id, image) {
    const meta = mediaFor(id, slotOf(image));
    if (!meta) return '';
    return (meta.type && meta.type !== 'photo' ? ` data-media="${meta.type}"` : '') + (meta.focus ? ` style="--focus: ${meta.focus}"` : '');
}

// Discovery cards: only the AI disclosure travels with a picture (credits stay with the article).
function cardDisclosureHtml(id, image) {
    const meta = mediaFor(id, slotOf(image));
    return meta && meta.synthetic === 'confirmed' ? `<span class="media-credit__ai media-credit__ai--card">${AI_LABEL}</span>` : '';
}

// Body figures and gallery frames get their verified alt, caption and credit. Idempotent: the generated part sits
// between <!--media--> markers and is removed before each pass, so a re-render from the published body is stable.
function applyBodyMedia(html, id) {
    let out = String(html || '')
        .replace(/<figcaption class="media-figcap"><!--media-->[\s\S]*?<!--\/media--><\/figcaption>/g, '')
        .replace(/<!--media-->[\s\S]*?<!--\/media-->/g, '');
    out = out.replace(/<img\b[^>]*\bclass="article-content-img"[^>]*>/g, tag => {
        const meta = mediaFor(id, slotOf((/\ssrc="([^"]+)"/.exec(tag) || [])[1]));
        if (meta?.alt) tag = tag.replace(/\balt="[^"]*"/, `alt="${escapeHtmlAttribute(meta.alt)}"`);
        if (meta?.type === 'graphic') tag = tag.replace(/\sdata-media="[^"]*"/g, '').replace(/>$/, ' data-media="graphic">');
        return tag;
    });
    out = out.replace(/<div class="gallery-slide[^"]*"[^>]*>[\s\S]*?<\/div>/g, slide => {
        const meta = mediaFor(id, slotOf((/<img\b[^>]*?\ssrc="([^"]+)"/.exec(slide) || [])[1]));
        const line = creditLineHtml(meta);
        return line ? slide.replace(/<\/div>$/, `<!--media-->${line}<!--/media--></div>`) : slide;
    });
    if (/<div class="gallery-slide[^"]*"[^>]*>[\s\S]*?data-media="graphic"/.test(out)) {
        out = out.replace(/(class="gallery-carousel"[^>]*aria-label=")Φωτογραφικό αρχείο/g, '$1Αρχείο εικόνων');
    }
    return out.replace(/<figure class="article-figure">[\s\S]*?<\/figure>/g, figure => {
        const meta = mediaFor(id, slotOf((/<img\b[^>]*?\ssrc="([^"]+)"/.exec(figure) || [])[1]));
        const line = creditLineHtml(meta);
        if (!line) return figure;
        if (/<figcaption>/.test(figure)) return figure.replace(/<\/figcaption>/, `<!--media-->${line}<!--/media--></figcaption>`);
        return figure.replace(/<\/figure>$/, `<figcaption class="media-figcap"><!--media-->${line}<!--/media--></figcaption></figure>`);
    });
}

module.exports = { AI_LABEL, TYPES, CONTAINED, validateRegister, loadMediaRegister, mediaFor, slotOf, isContained, creditLineHtml, mediaAttributes, cardDisclosureHtml, applyBodyMedia };
