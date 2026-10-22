const fs = require('node:fs');
const path = require('node:path');
const { hubPath } = require('./entities/hubs');
const { normalize, validateIndex } = require('../search-destinations');
const tools = require('./search-tools.json');
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

function buildSearchDestinations({ hubs, pages }, manifest = tools) {
    const generated = new Set(pages.map(page => page.path));
    const entities = hubs.filter(hub => hub.eligible && generated.has(hubPath(hub.entity))).map(({ entity }) => ({
        type: 'entity', id: entity.id, label: entity.labelEl, href: hubPath(entity),
        aliases: [entity.name, ...entity.aliases.filter(alias => ['article-tag', 'f1-tag'].includes(alias.scope)).map(alias => alias.value)]
    }));
    const records = [...entities, ...manifest.map(tool => ({ ...tool, type: 'tool' }))].map(record => {
        const aliases = new Map();
        for (const value of record.aliases) {
            const alias = value.trim().normalize('NFC'), key = normalize(alias);
            if (key !== normalize(record.label) && (!aliases.has(key) || compare(alias, aliases.get(key)) < 0)) aliases.set(key, alias);
        }
        return { ...record, aliases: [...aliases.values()].sort(compare) };
    }).sort((a, b) => compare(a.type, b.type) || compare(a.id, b.id));
    return validateIndex({ v: 1, records });
}

function writeSearchDestinations(result, output = path.join(__dirname, '../search-destinations.json')) {
    const json = JSON.stringify(buildSearchDestinations(result)) + '\n';
    if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== json) fs.writeFileSync(output, json);
}

module.exports = { buildSearchDestinations, writeSearchDestinations };
