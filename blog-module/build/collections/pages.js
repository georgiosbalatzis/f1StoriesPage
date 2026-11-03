const model = require('./model');
const render = require('./render');
const { writeHubPages } = require('../entities/hubs');

function buildCollectionPages(articles, options = {}) {
    const inputs = model.loadCollectionInputs();
    const selected = model.selectCollections(inputs.manifest, articles, options);
    const eligible = selected.filter(item => item.eligible);
    const pages = eligible.length ? [render.renderCollectionsIndex(eligible, options), ...eligible.map(item => render.renderCollection(item, options))] : [];
    const links = eligible.map(item => ({ href: model.collectionPath(item.collection.slug), label: item.collection.title, count: item.posts.length }));
    return { selected, pages, links };
}

function writeCollectionPages(blogDir, pages, shell) {
    return writeHubPages(blogDir, pages, shell, { generated: model.GENERATED, roots: ['collections'], stopAt: 'collections' });
}

module.exports = { buildCollectionPages, writeCollectionPages };
