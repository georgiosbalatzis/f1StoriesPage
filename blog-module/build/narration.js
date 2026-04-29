const crypto = require('crypto');
const { decodeHtmlEntities } = require('./metadata');

const SOURCE_SECTION_MARKERS = ['πηγες', 'sources'];
const REMOVABLE_DIV_CLASSES = [
    'embed-container',
    'youtube-embed-container',
    'social-embed',
    'table-responsive-container',
    'gallery-carousel',
    'sponsor-strip',
    'social-share-bar',
    'article-author-footer',
    'article-comments',
    'reading-time-badge',
    'author-box',
    'video-caption'
];

function extractClassNames(openingTag) {
    const match = String(openingTag || '').match(/\bclass\s*=\s*["']([^"']+)["']/i);
    if (!match) return [];
    return match[1].split(/\s+/).map(name => name.trim()).filter(Boolean);
}

function findMatchingClosingTag(html, startIndex, tagName) {
    const tagRegex = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi');
    tagRegex.lastIndex = startIndex;
    let depth = 0;
    let match;

    while ((match = tagRegex.exec(html)) !== null) {
        const token = match[0];
        const isClosing = /^<\//.test(token);
        const isSelfClosing = /\/>$/.test(token);

        if (!isClosing) {
            depth++;
            if (isSelfClosing) depth--;
            continue;
        }

        depth--;
        if (depth === 0) return tagRegex.lastIndex;
    }

    return -1;
}

function removeBlocksByTag(html, tagName, predicate) {
    const openTagRegex = new RegExp(`<${tagName}\\b[^>]*>`, 'i');
    let cursor = 0;
    let result = '';

    while (cursor < html.length) {
        const rest = html.slice(cursor);
        const match = rest.match(openTagRegex);
        if (!match || match.index == null) {
            result += rest;
            break;
        }

        const start = cursor + match.index;
        const openingTag = match[0];
        const shouldRemove = typeof predicate === 'function' ? predicate(openingTag) : true;

        result += html.slice(cursor, start);
        if (!shouldRemove) {
            result += openingTag;
            cursor = start + openingTag.length;
            continue;
        }

        const end = findMatchingClosingTag(html, start, tagName);
        if (end === -1) {
            cursor = start + openingTag.length;
            continue;
        }

        cursor = end;
    }

    return result;
}

function normalizeSourceSectionText(text) {
    return decodeHtmlEntities(String(text || ''))
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]*>/g, ' ')
        .replace(/[“”«»"'`]/g, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .trim()
        .toLowerCase();
}

function isSourceSectionText(text) {
    const normalized = normalizeSourceSectionText(text);
    if (!normalized) return false;
    return SOURCE_SECTION_MARKERS.some(marker => (
        normalized === marker ||
        normalized.startsWith(`${marker}:`) ||
        normalized.startsWith(`${marker}\n`)
    ));
}

function truncateAtSourceSection(html) {
    const blockRegex = /<(p|h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let match;

    while ((match = blockRegex.exec(html)) !== null) {
        if (isSourceSectionText(match[2])) {
            return html.slice(0, match.index).trimEnd();
        }
    }

    return html;
}

function stripNarrationExcludedBlocks(contentHtml) {
    let html = String(contentHtml || '');
    html = truncateAtSourceSection(html);
    html = html.replace(/<!--[\s\S]*?-->/g, '');
    html = html.replace(/<script\b[\s\S]*?<\/script>/gi, '');
    html = html.replace(/<style\b[\s\S]*?<\/style>/gi, '');
    html = removeBlocksByTag(html, 'div', openingTag => {
        const classes = extractClassNames(openingTag);
        return REMOVABLE_DIV_CLASSES.some(className => classes.includes(className));
    });
    html = removeBlocksByTag(html, 'figure');
    html = removeBlocksByTag(html, 'table');
    html = removeBlocksByTag(html, 'blockquote');
    html = html.replace(/<iframe\b[\s\S]*?<\/iframe>/gi, '');
    html = html.replace(/<figcaption\b[\s\S]*?<\/figcaption>/gi, '');
    return html;
}

function htmlToNarrationBodyText(contentHtml) {
    const stripped = stripNarrationExcludedBlocks(contentHtml);
    const withBreaks = stripped
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|h1|h2|h3|h4|h5|h6|li|ul|ol)>/gi, '\n\n')
        .replace(/<(li)\b[^>]*>/gi, '')
        .replace(/<[^>]*>/g, ' ');

    return decodeHtmlEntities(withBreaks)
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .split(/\n{2,}/)
        .map(block => block.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join('\n\n');
}

function createNarrationHash(text, voiceProfileId = 'default') {
    return crypto.createHash('sha256')
        .update(JSON.stringify({
            voiceProfileId: String(voiceProfileId || 'default'),
            text: String(text || '')
        }))
        .digest('hex');
}

function buildNarrationPayload({ title, contentHtml, voiceProfileId } = {}) {
    const safeTitle = decodeHtmlEntities(String(title || '')).replace(/\s+/g, ' ').trim();
    const bodyText = htmlToNarrationBodyText(contentHtml);
    const text = safeTitle && bodyText
        ? `${safeTitle}\n\n${bodyText}`
        : (safeTitle || bodyText);

    return {
        text,
        bodyText,
        hash: createNarrationHash(text, voiceProfileId),
        voiceProfileId: String(voiceProfileId || 'default')
    };
}

module.exports = {
    SOURCE_SECTION_MARKERS,
    stripNarrationExcludedBlocks,
    htmlToNarrationBodyText,
    createNarrationHash,
    buildNarrationPayload
};
