// The one reading-time policy: whitespace-separated words of the article body / 200, rounded up, at least one minute.
// The worker, the index, the homepage/archive cards and the article badge all take their value from here, so no page
// recomputes (or guesses) it in the browser. Greek and Latin text are counted the same way: one word per token.
const WORDS_PER_MINUTE = 200;

function countWords(text) {
    const plain = String(text || '').replace(/&nbsp;|&#160;/gi, ' ').replace(/\s+/g, ' ').trim();
    return plain ? plain.split(' ').length : 0;
}

function readingTimeFromWords(wordCount) {
    return `${Math.max(1, Math.ceil((Number(wordCount) || 0) / WORDS_PER_MINUTE))} min`;
}

// A data band's header (tool name, links) is page furniture, not reading (race-report.js).
function wordsInHtml(html) {
    return countWords(String(html || '').replace(/<header class="rr-data__head">[\s\S]*?<\/header>/g, '').replace(/<[^>]*>/g, ''));
}

// Inner HTML of the article body in a rendered page (nested divs are balanced); '' when the page has none.
function articleBodyHtml(pageHtml) {
    const html = String(pageHtml || '');
    const open = /<div\b[^>]*\bclass=(["'])[^"']*\barticle-content\b[^"']*\1[^>]*>/i.exec(html);
    if (!open) return '';
    const start = open.index + open[0].length;
    const tag = /<(\/?)div\b[^>]*>/gi;
    tag.lastIndex = start;
    let depth = 1;
    let match;
    while ((match = tag.exec(html))) {
        depth += match[1] ? -1 : 1;
        if (depth === 0) return html.slice(start, match.index);
    }
    return '';
}

// Reading time of a page as served, or '' when it has no article body.
function readingTimeFromPage(pageHtml) {
    const body = articleBodyHtml(pageHtml);
    return body ? readingTimeFromWords(wordsInHtml(body)) : '';
}

module.exports = { WORDS_PER_MINUTE, countWords, readingTimeFromWords, wordsInHtml, articleBodyHtml, readingTimeFromPage };
