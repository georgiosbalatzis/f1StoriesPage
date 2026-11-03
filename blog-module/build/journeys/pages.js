const fs = require('node:fs');
const path = require('node:path');
const { journeysByArticle } = require('./model');
const { journeyHtml, withJourney } = require('./render');

// Every article.html on disk, not only this build's posts: the artifact ships them all, so a stale component of a
// withdrawn journey must be stripped even when nothing is eligible. Writes only when a page changes.
function injectJourneys(blogDir, selected) {
    const members = journeysByArticle(selected);
    const written = [];
    for (const entry of fs.readdirSync(blogDir, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
        if (!entry.isDirectory()) continue;
        const file = path.join(blogDir, entry.name, 'article.html');
        if (!fs.existsSync(file)) continue;
        const original = fs.readFileSync(file, 'utf8');
        const member = members.get(entry.name);
        const updated = withJourney(original, member ? journeyHtml(member.selected, entry.name) : '');
        if (updated !== original) fs.writeFileSync(file, updated);
        if (member) written.push(entry.name);
    }
    return written;
}

module.exports = { injectJourneys };
