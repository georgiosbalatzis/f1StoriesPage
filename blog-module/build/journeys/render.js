const { escapeHtmlAttribute: esc } = require('../shared');
const { articleUrl } = require('../entities/hubs');

function journeyHtml(selected, articleId) {
    const { journey, steps } = selected;
    const current = steps.findIndex(step => step.id === articleId);
    if (current < 0) throw new Error(`Article is not a journey member: ${articleId}`);
    const items = steps.map((step, i) => i === current
        ? `<li aria-current="step"><strong>${esc(step.title)}</strong> <span>(αυτό το άρθρο)</span></li>`
        : `<li><a href="${esc(new URL(articleUrl(step)).pathname)}">${esc(step.title)}</a></li>`);
    const ending = current === steps.length - 1 ? 'Τέλος της σειράς.' : `Επόμενο: ${esc(steps[current].transition)}`;
    return `<div class="rr-layout" data-article-end><nav class="rr-body" aria-labelledby="rr-journey-title">\n`
        + `<p class="rr-label">Ανάγνωση με σειρά · Μέρος ${current + 1} από ${steps.length}</p>\n`
        + `<h2 class="rr-subhead" id="rr-journey-title">${esc(journey.title)}</h2>\n`
        + `<p>${esc(journey.description)}</p>\n<ol>\n${items.join('\n')}\n</ol>\n<p>${ending}</p>\n</nav></div>`;
}

function withJourney(html, component) {
    const begin = '<!-- f1s:journey:begin -->';
    const end = '<!-- f1s:journey:end -->';
    const region = /<!-- f1s:journey:begin -->[\s\S]*?<!-- f1s:journey:end -->(?:\r?\n[\t ]*)?/g;
    const stripped = html.replace(region, () => '');
    if (stripped.includes(begin) || stripped.includes(end)) throw new Error('Malformed journey region');
    if (!component) return stripped;
    const anchor = /(^[\t ]*)?(?=<section class="rr-pitwall")/m;
    if (!anchor.test(stripped)) throw new Error('Journey requires an rr-pitwall anchor');
    return stripped.replace(anchor, (_, indent = '') => `${indent}${begin}\n${component}\n${end}\n${indent}`);
}

module.exports = { journeyHtml, withJourney };
