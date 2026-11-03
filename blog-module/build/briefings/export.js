const T = require('../../taxonomy');
const { escapeHtmlAttribute } = require('../shared');
const esc = value => escapeHtmlAttribute(value).replace(/'/g, '&#39;');
const { articleUrl } = require('../entities/hubs');

const DRAFT = 'ΠΡΟΣΧΕΔΙΟ — δεν έχει εγκριθεί για δημοσίευση';

function periodLabel(period) {
    const start = T.formatDate(period.start, 'long');
    const end = T.formatDate(period.end, 'long');
    const first = period.start.slice(0, 7) === period.end.slice(0, 7) ? start.split(' ')[0]
        : period.start.slice(0, 4) === period.end.slice(0, 4) ? start.replace(/ \d{4}$/, '') : start;
    return `Εβδομάδα ${period.week} · ${first} – ${end}`;
}

function briefingDocument(selected) {
    const { edition, period, sections } = selected;
    return {
        draft: selected.eligible !== true, id: edition.id, title: edition.title,
        period: { label: periodLabel(period), start: period.start, end: period.end },
        description: edition.description, opening: [...edition.opening],
        sections: sections.map(section => ({ heading: section.heading,
            ...(section.intro !== undefined ? { intro: section.intro } : {}),
            items: section.items.map(post => ({ title: post.title, url: articleUrl(post),
                author: T.authorLabel(post.author || 'F1 Stories'), date: String(post.date).slice(0, 10),
                dateLabel: T.formatDate(post.date), rationale: post.rationale, context: post.context === true })) })),
        closing: [...(edition.closing || [])]
    };
}

function exportHtml(doc) {
    const paragraphs = items => items.map(text => `<p>${esc(text)}</p>`).join('');
    return '<!doctype html><html lang="el"><meta charset="utf-8">'
        + `<title>${esc(doc.title)}</title><body>${doc.draft ? `<p><strong>${DRAFT}</strong></p>` : ''}`
        + `<h1>${esc(doc.title)}</h1><p>${esc(doc.period.label)}</p>${paragraphs(doc.opening)}`
        + doc.sections.map(section => `<h2>${esc(section.heading)}</h2>${section.intro ? `<p>${esc(section.intro)}</p>` : ''}<ol>`
            + section.items.map(item => `<li><p><a href="${esc(item.url)}">${esc(item.title)}</a> — ${esc(item.author)}, ${esc(item.dateLabel)}</p>`
                + `${item.context ? '<p>Για αναδρομή</p>' : ''}<p>${esc(item.rationale)}</p><p>${esc(item.url)}</p></li>`).join('') + '</ol>').join('')
        + `${paragraphs(doc.closing)}</body></html>`;
}

function exportText(doc) {
    const lines = [];
    if (doc.draft) lines.push(DRAFT, '');
    lines.push(doc.title, doc.period.label, '', ...doc.opening, '');
    for (const section of doc.sections) {
        lines.push(section.heading);
        if (section.intro) lines.push(section.intro);
        section.items.forEach((item, i) => {
            lines.push(`${i + 1}. ${item.title} — ${item.author}, ${item.dateLabel}`);
            if (item.context) lines.push('Για αναδρομή');
            lines.push(item.rationale, item.url);
        });
        lines.push('');
    }
    lines.push(...doc.closing);
    return lines.join('\n').replace(/\n+$/, '') + '\n';
}

module.exports = { periodLabel, briefingDocument, exportHtml, exportText };
