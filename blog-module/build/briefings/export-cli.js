const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const T = require('../../taxonomy');
const model = require('./model');
const { briefingDocument, exportHtml, exportText } = require('./export');
const ROOT = fs.realpathSync(path.resolve(__dirname, '../../..'));

function candidate(selected, id) {
    const item = selected.find(entry => entry.edition.id === id);
    if (!item || item.edition.status === 'retired' || item.reasons.some(reason => !['status', 'approval', 'digest'].includes(reason.code))) throw new Error(`Edition ${id} is not available for review`);
    return item;
}

function exportEdition(id, out) {
    if (!id) throw new Error('An edition id is required');
    const inputs = model.loadBriefingInputs();
    const item = candidate(model.selectBriefings(inputs.manifest, inputs.articles, { today: T.athensDay() }), id);
    let directory;
    if (out) {
        const target = path.resolve(out);
        const parent = fs.realpathSync(path.dirname(target));
        if (parent === ROOT || parent.startsWith(ROOT + path.sep)) throw new Error('Export destination must be outside the repository');
        directory = path.join(parent, path.basename(target));
        fs.mkdirSync(directory);
    } else directory = fs.mkdtempSync(path.join(os.tmpdir(), 'f1-briefing-'));
    const doc = briefingDocument(item);
    const html = path.join(directory, 'edition.html'), text = path.join(directory, 'edition.txt');
    fs.writeFileSync(html, exportHtml(doc), { flag: 'wx' });
    fs.writeFileSync(text, exportText(doc), { flag: 'wx' });
    console.log(`${html}\n${text}`);
    return { directory, html, text };
}

if (require.main === module) {
    try {
        const args = process.argv.slice(2);
        const id = args.indexOf('--id'), out = args.indexOf('--out');
        if (id < 0 || !args[id + 1] || args[id + 1].startsWith('--') || (out >= 0 && (!args[out + 1] || args[out + 1].startsWith('--'))) || args.filter(x => x === '--id').length !== 1 || args.filter(x => x === '--out').length > 1 || args.some((x, i) => !['--id', '--out'].includes(x) && i !== id + 1 && i !== out + 1)) throw new Error('Usage: npm run briefings:export -- --id <id> [--out <dir>]');
        exportEdition(args[id + 1], out < 0 ? undefined : args[out + 1]);
    } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { candidate, exportEdition };
