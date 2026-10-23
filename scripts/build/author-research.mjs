// Inventory existing files, not an estimate of how many rounds a season should have.
import fs from 'node:fs';
import path from 'node:path';

export function buildResearchCatalog(root) {
    const rounds = fs.readdirSync(path.join(root, 'standings/rounds')).filter(name => /^\d{4}-[1-9]\d?\.json$/.test(name))
        .map(name => name.slice(0, -5).split('-').map(Number)).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    const tools = JSON.parse(fs.readFileSync(path.join(root, 'blog-module/build/search-tools.json'), 'utf8'))
        .filter(tool => ['standings', 'telemetry', 'ghostcar', 'tyres'].includes(tool.id))
        .map(({ id, label, href }) => ({ id, label, href }));
    const data = { version: 1, rounds, tools };
    fs.writeFileSync(path.join(root, 'scripts/author/research-catalog.json'), JSON.stringify(data) + '\n');
    return data;
}
