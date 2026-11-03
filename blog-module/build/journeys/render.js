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

// Markers and the pit wall are found with the tokenizer, so their strings inside scripts, textareas, attributes or other
// comments are body text and never touched. Returns the [start, end) ranges of the real marker pairs; an unpaired real
// marker throws.
function journeyRegions(html) {
    const ranges = [];
    let open = null;
    for (const token of tags(html, { comments: true })) {
        if (token.comment === BEGIN.slice(4, -3)) {
            if (open) throw new Error('Malformed journey region');
            open = token;
        } else if (token.comment === END.slice(4, -3)) {
            if (!open) throw new Error('Malformed journey region');
            ranges.push([open.start, token.end]);
            open = null;
        }
    }
    if (open) throw new Error('Malformed journey region');
    return ranges;
}

// Strips every real region wherever it is (a withdrawn journey leaves nothing, whatever the anchors), then inserts the
// component directly before the single pit wall. Separators sit inside the markers: stripping restores the page bytes.
function withJourney(html, component) {
    let stripped = html;
    for (const [start, end] of journeyRegions(html).reverse()) stripped = stripped.slice(0, start) + stripped.slice(end);
    if (!component) return stripped;
    const pits = tags(stripped).filter(tag => !tag.close && tag.name === 'section' && (tag.attrs.class || '').split(/\s+/).includes('rr-pitwall'));
    if (pits.length !== 1) throw new Error('Journey requires exactly one rr-pitwall section');
    const head = stripped.slice(0, pits[0].start);
    const indent = /[\t ]*$/.exec(head)[0];
    return `${head}${BEGIN}\n${component}\n${indent}${END}${stripped.slice(pits[0].start)}`;
}

module.exports = { BEGIN, END, journeyHtml, journeyRegions, withJourney };
