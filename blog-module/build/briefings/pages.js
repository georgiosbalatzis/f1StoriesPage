const model = require('./model');
const render = require('./render');
const { writeHubPages } = require('../entities/hubs');

function buildBriefingPages(articles, options = {}) {
    const inputs = model.loadBriefingInputs();
    const selected = model.selectBriefings(inputs.manifest, articles, options);
    const eligible = selected.filter(item => item.eligible);
    const pages = eligible.length ? [render.renderBriefingsIndex(eligible, options), ...eligible.map(item => render.renderBriefing(item, options))] : [];
    // The Edition aside links the archive and the newest edition only; the archive lists the rest.
    const links = eligible.slice(0, 1).map(item => ({ href: model.editionPath(item.edition.id), label: item.edition.title }));
    return { selected, pages, links };
}

function writeBriefingPages(blogDir, pages, shell) {
    return writeHubPages(blogDir, pages, shell, { generated: model.GENERATED, roots: ['briefing'], stopAt: 'briefing' });
}

module.exports = { buildBriefingPages, writeBriefingPages };
