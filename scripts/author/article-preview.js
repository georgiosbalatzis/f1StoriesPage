const environment = require('./preview-environment');
const { convertTxtToHtml } = require('../../blog-module/build/parse-txt');
const { stripLeadingArticleBoilerplate } = require('../../blog-module/build/metadata');
const { processImageInsertTags, mergeConsecutiveFigures, appendOrphanContentImagesGallery } = require('../../blog-module/build/media');
const { renderArticleHtml } = require('../../blog-module/build/article-render');
const { parseInstant, isCalendarDay } = require('../../blog-module/build/article-dates');
const corrections = require('./article-corrections');
const { loadMediaRegister } = require('../../blog-module/build/media-meta');
const styles = require('./preview-styles');

const allowedTags = new Set('main article header footer section aside nav div span p h1 h2 h3 h4 h5 h6 a strong em b i u s small sup sub mark abbr del ins br hr ul ol li dl dt dd figure figcaption picture source img blockquote pre code table thead tbody tfoot tr th td caption colgroup col details summary time button svg use path iframe'.split(' '));

// The pipeline escapes ordinary text and sanitizes embeds. A final DOM allowlist
// plus a script-disabled sandbox protects the token-bearing parent from raw widgets.
function sanitize(document) {
    document.querySelectorAll('*').forEach(element => {
        if (!allowedTags.has(element.localName)) { element.remove(); return; }
        [...element.attributes].forEach(attribute => {
            const name = attribute.name.toLowerCase();
            if (name.startsWith('on') || ['srcdoc', 'formaction', 'action', 'name'].includes(name)
                || (name === 'style' && /url\s*\(|expression|@import/i.test(attribute.value))) element.removeAttribute(attribute.name);
            if (['src', 'href', 'xlink:href', 'data-full-src'].includes(name)) {
                const value = attribute.value.trim();
                if (!(value.startsWith('#') || /^\/(?!\/)/.test(value) || /^\d+\.webp$/.test(value) || /^https?:\/\//i.test(value))) element.removeAttribute(attribute.name);
            }
        });
        if (element.localName === 'iframe') {
            let url;
            try { url = new URL(element.getAttribute('src')); } catch (_) {}
            if (!url || !['http:', 'https:'].includes(url.protocol) || !environment.CONFIG.IFRAME_WHITELIST.some(host => url.hostname === host || url.hostname.endsWith('.' + host))) { element.remove(); return; }
            element.setAttribute('sandbox', '');
            element.setAttribute('referrerpolicy', 'no-referrer');
        }
        if (element.localName === 'a' && !String(element.getAttribute('href')).startsWith('#')) { element.setAttribute('target', '_blank'); element.setAttribute('rel', 'noopener noreferrer'); }
    });
}

async function renderNow(state) {
    await environment.configure(state);
    loadMediaRegister('/preview-reset'); // Invalidate the production helper's per-file cache between drafts.
    const metadata = { ...state.metadata, title: state.title || 'Χωρίς τίτλο', author: state.author, categories: [state.category], tags: state.tags };
    let content = await convertTxtToHtml('/draft/local/source.txt');
    content = stripLeadingArticleBoilerplate(content, metadata);
    content = await processImageInsertTags(content, {}, 'local', metadata.title);
    content = await mergeConsecutiveFigures(content, 'local', metadata.title);
    content = await appendOrphanContentImagesGallery(content, 'local', metadata.title);
    const today = new Date();
    let dateISO = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
    const records = metadata.corrections ? corrections.parse(metadata.corrections) : [];
    if (metadata.publishedAtISO) dateISO = parseInstant(metadata.publishedAtISO, 'publishedAtISO').day;
    else if (records.length) dateISO = records[0].date;
    else if (metadata.updatedDateISO) {
        const updated = isCalendarDay(metadata.updatedDateISO) ? metadata.updatedDateISO : parseInstant(metadata.updatedDateISO, 'updatedDateISO').day;
        if (updated < dateISO) dateISO = updated;
    }
    const image = state.banner ? '/blog-module/blog-entries/local/2.webp' : state.hero ? '/blog-module/blog-entries/local/1.webp' : environment.CONFIG.DEFAULT_BLOG_IMAGE;
    const html = await renderArticleHtml({ ...metadata, content, image, dateISO }, '/draft/local', 'local');
    const document = new DOMParser().parseFromString(html, 'text/html');
    // Sharing and publication-only navigation would imply a canonical URL that a draft does not have.
    document.querySelectorAll('.rr-pitwall__share, .rr-sectorbar__share, .rr-pitwall__side > .rr-label').forEach(element => element.remove());
    sanitize(document.body);
    const urls = [];
    const images = new Map();
    [state.hero, state.banner, ...state.images].forEach((value, index) => {
        if (!value) return;
        const url = URL.createObjectURL(value.blob);
        urls.push(url); images.set((index + 1) + '.webp', url);
    });
    document.querySelectorAll('img').forEach(img => {
        const name = img.getAttribute('src');
        if (images.has(name)) {
            img.src = images.get(name); img.removeAttribute('srcset');
            img.removeAttribute('data-fallback-src'); img.setAttribute('data-full-src', images.get(name));
        }
    });
    document.querySelectorAll('source').forEach(source => source.remove());
    const icons = new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg">' + PREVIEW_SYMBOLS + '</svg>', 'image/svg+xml');
    const iconBox = document.createElement('div'); iconBox.hidden = true;
    iconBox.append(document.importNode(icons.documentElement, true)); document.body.prepend(iconBox);
    const limitations = environment.getLimitations();
    if (/^(?:EMBED|WIDGET|CSV):/im.test(state.text)) environment.unavailable();
    limitations.push(...environment.getLimitations().filter(message => !limitations.includes(message)));
    if (document.querySelector('iframe, .social-embed, .youtube-facade')) limitations.push('Οι ενσωματώσεις εμφανίζονται χωρίς scripts. Τα ζωντανά εργαλεία και τα social embeds ελέγχονται μετά το build.');
    const head = document.createElement('head');
    const meta = document.createElement('meta'); meta.name = 'viewport'; meta.content = 'width=device-width, initial-scale=1'; head.append(meta);
    styles.forEach(href => { const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = href; head.append(link); });
    document.head.replaceWith(head);
    document.documentElement.lang = 'el';
    document.documentElement.dataset.theme = window.document.documentElement.dataset.theme || 'dark';
    document.body.className = 'editorial-page article-page';
    return { html: '<!doctype html>\n' + document.documentElement.outerHTML, limitations,
        dispose: () => urls.forEach(url => URL.revokeObjectURL(url)) };
}
let queue = Promise.resolve();
window.F1S_ARTICLE_PREVIEW = { hydrate(document) {
    document.querySelectorAll('.rr-body .gallery-carousel').forEach(carousel => {
        carousel.removeAttribute('aria-roledescription');
        const strip = carousel.querySelector('.gallery-carousel-slides');
        if (strip && strip.children.length > 1) {
            strip.tabIndex = 0; strip.setAttribute('role', 'group');
            strip.setAttribute('aria-label', strip.children.length + ' φωτογραφίες, οριζόντια κύλιση');
        }
    });
    document.querySelectorAll('.view-toggle-btn[data-table]').forEach(button => button.addEventListener('click', () => {
        const id = button.getAttribute('data-table'), view = button.getAttribute('data-view');
        document.querySelectorAll('.view-toggle-btn[data-table]').forEach(other => {
            if (other.getAttribute('data-table') === id) other.classList.toggle('active', other === button);
        });
        for (const type of ['scroll', 'card']) document.getElementById(id + '-' + type)?.classList.toggle('active', type === view);
    }));
}, render(state) {
    const result = queue.then(() => renderNow(state));
    queue = result.catch(() => {});
    return result;
} };
