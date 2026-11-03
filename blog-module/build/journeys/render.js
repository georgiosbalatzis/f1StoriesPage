const { escapeHtmlAttribute: esc } = require('../shared');
const { articleUrl } = require('../entities/hubs');
const { tags } = require('../html-attributes');

function journeyHtml(selected, articleId) {
    const { journey, steps } = selected;
    const current = steps.findIndex(step => step.id === articleId);
    if (current < 0) throw new Error(`Article is not a journey member: ${articleId}`);
    const items = steps.map((step, i) => i === current
        ? `<li aria-current="step"><strong>${esc(step.title)}</strong> <span>(αυτό το άρθρο)</span></li>`
        : `<li><a href="${esc(new URL(articleUrl(step)).pathname)}">${esc(step.title)}</a></li>`);
    const ending = current === steps.length - 1 ? 'Τέλος της σειράς.' : `<strong>Επόμενο:</strong> ${esc(steps[current].transition)}`;
    return `<div class="rr-layout" data-article-end><nav class="rr-body" aria-labelledby="rr-journey-title">\n`
        + `<p class="rr-label">Ανάγνωση με σειρά · Μέρος ${current + 1} από ${steps.length}</p>\n`
        + `<h2 class="rr-subhead" id="rr-journey-title">${esc(journey.title)}</h2>\n`
        + `<p>${esc(journey.description)}</p>\n<ol>\n${items.join('\n')}\n</ol>\n<p>${ending}</p>\n</nav></div>`;
}

const BEGIN = '<!-- f1s:journey:begin -->';
const END = '<!-- f1s:journey:end -->';

// The region lives only directly before the real pit-wall tag (found by the tokenizer, so a marker or anchor string in a
// comment, script or textarea is body text and never touched). Separators sit inside the markers, so removing the
// region restores the page byte for byte. Returns { at, from } (region start, pit-wall start) or null without a pit wall.
function journeyRegion(html) {
    const pits = tags(html).filter(tag => !tag.close && tag.name === 'section' && (tag.attrs.class || '').split(/\s+/).includes('rr-pitwall'));
    if (pits.length !== 1) return null;
    const at = pits[0].start;
    if (!html.slice(0, at).endsWith(END)) return { at, from: at };
    const from = html.lastIndexOf(BEGIN, at - END.length);
    if (from < 0) throw new Error('Malformed journey region');
    return { at, from };
}

function withJourney(html, component) {
    const region = journeyRegion(html);
    if (!region) {
        if (component) throw new Error('Journey requires exactly one rr-pitwall section');
        return html;
    }
    const head = html.slice(0, region.from);
    const indent = /[\t ]*$/.exec(head)[0];
    return head + (component ? `${BEGIN}\n${component}\n${indent}${END}` : '') + html.slice(region.at);
}

module.exports = { BEGIN, END, journeyHtml, journeyRegion, withJourney };
