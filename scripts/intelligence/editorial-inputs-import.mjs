#!/usr/bin/env node
// Owner-local only: no network, credentials, decryption or analytics printed to the terminal.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { EDITORIAL_INPUT_VERSION, canonicalArticleUrl, validateEditorialInputs } from './editorial-inputs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// RFC 4180 quoting, including doubled quotes, CRLF and embedded newlines; ambiguous CSV fails closed.
export function parseCsv(input) {
    const records = [];
    let row = [], field = '', quoted = false, closed = false;
    const csv = input.replace(/^\uFEFF/, '');
    for (let i = 0; i < csv.length; i++) {
        const c = csv[i];
        if (quoted) {
            if (c === '"' && csv[i + 1] === '"') { field += '"'; i++; }
            else if (c === '"') { quoted = false; closed = true; }
            else field += c;
        } else if (c === '"') {
            if (field || closed) throw new Error('invalid CSV quoting');
            quoted = true;
        } else if (c === ',' || c === '\n' || c === '\r') {
            row.push(field); field = ''; closed = false;
            if (c !== ',') {
                if (c === '\r' && csv[i + 1] === '\n') i++;
                records.push(row); row = [];
            }
        } else {
            if (closed) throw new Error('invalid CSV after quoted field');
            field += c;
        }
    }
    if (quoted) throw new Error('unterminated CSV field');
    if (row.length || field || closed) records.push([...row, field]);
    if (records.length < 2) throw new Error('CSV needs a header and data rows');
    if (records.some(record => record.length !== records[0].length)) throw new Error('inconsistent CSV columns');
    return records;
}

function numeric(value, percent = false) {
    const pattern = percent ? /^\d+(?:\.\d+)?%$/ : /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/;
    if (!pattern.test(value)) throw new Error('unsupported CSV number; use English decimal/percent format');
    return Number(value.replaceAll(',', '').replace('%', '')) / (percent ? 100 : 1);
}

export function importSearchConsoleCsv(csv, { property, start, end, asOf, dataState = 'NOT VERIFIED' }) {
    const [header, ...data] = parseCsv(csv);
    const dimension = header[0];
    if (!['Top pages', 'Top queries'].includes(dimension)
        || JSON.stringify(header.slice(1)) !== JSON.stringify(['Clicks', 'Impressions', 'CTR', 'Position'])) {
        throw new Error('expected English Search Console Pages/Queries CSV columns');
    }
    const pages = dimension === 'Top pages';
    return {
        source: 'search-console', population: 'google-search', unit: 'search-performance',
        period: { start, end }, timezone: 'America/Los_Angeles', asOf,
        freshness: { cadence: 'daily', carried: false, dataState }, status: 'present',
        property, aggregation: pages ? 'page' : 'property', searchType: 'web',
        rows: data.map(([dimensionValue, clicks, impressions, ctr, position]) => ({
            date: null, page: pages ? dimensionValue : null,
            mapping: pages ? canonicalArticleUrl(dimensionValue).status : null,
            ...(!pages ? { query: dimensionValue || null } : {}), country: null, device: null,
            clicks: numeric(clicks), impressions: numeric(impressions), ctr: numeric(ctr, true),
            position: position === '-' ? null : numeric(position)
        }))
    };
}

function inside(file, root) {
    const relative = path.relative(root, file);
    return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

export function writeEditorialInputs(doc, output, { allowRepoPath = false } = {}) {
    const result = validateEditorialInputs(doc);
    if (!result.ok) throw new Error('input validation FAIL; no output written');
    const requested = path.resolve(output);
    // Resolve the existing parent before checking: a symlink outside the worktree must not bypass the guard.
    const destination = path.join(fs.realpathSync(path.dirname(requested)), path.basename(requested));
    const fixtureRoot = fs.realpathSync(path.join(ROOT, 'scripts/intelligence/__tests__/fixtures/editorial-inputs'));
    let inRepository = inside(destination, fs.realpathSync(ROOT));
    for (let directory = path.dirname(destination); ; directory = path.dirname(directory)) {
        if (fs.existsSync(path.join(directory, '.git'))) { inRepository = true; break; }
        if (directory === path.dirname(directory)) break;
    }
    if (inRepository && !(allowRepoPath && doc.synthetic === true
        && inside(destination, fixtureRoot) && path.extname(destination) === '.json')) {
        throw new Error('repository output refused; --allow-repo-path requires synthetic fixtures');
    }
    // Exclusive creation refuses existing files and symlinks, keeping owner exports intact.
    fs.writeFileSync(destination, `${JSON.stringify(doc, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    return result;
}

export function main(argv) {
    const { values } = parseArgs({ args: argv, options: {
        csv: { type: 'string' }, site: { type: 'string' }, output: { type: 'string' },
        property: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' }, 'as-of': { type: 'string' },
        'search-type': { type: 'string' }, 'data-state': { type: 'string' },
        synthetic: { type: 'boolean', default: false }, 'allow-repo-path': { type: 'boolean', default: false },
        help: { type: 'boolean', default: false }
    } });
    if (values.help) {
        process.stdout.write('Usage: editorial-inputs-import.mjs --csv=<Pages.csv|Queries.csv> --property=<exact property>\n'
            + '  --start=YYYY-MM-DD --end=YYYY-MM-DD --as-of=YYYY-MM-DD --search-type=web\n'
            + '  [--site=<contract site section JSON>] [--output=<new local path>]\n'
            + '  [--data-state=final|preliminary|NOT VERIFIED] [--synthetic] [--allow-repo-path]\n');
        return;
    }
    if (process.env.CI || process.env.GITHUB_ACTIONS) throw new Error('owner-local importer refuses CI');
    if (!['csv', 'property', 'start', 'end', 'as-of'].every(key => values[key]) || values['search-type'] !== 'web') {
        throw new Error('CSV, exact property, dates and --search-type=web are required');
    }
    const doc = {
        version: EDITORIAL_INPUT_VERSION, synthetic: values.synthetic,
        gsc: importSearchConsoleCsv(fs.readFileSync(values.csv, 'utf8'), {
            property: values.property, start: values.start, end: values.end, asOf: values['as-of'],
            dataState: values['data-state'] ?? 'NOT VERIFIED'
        }),
        ...(values.site ? { site: JSON.parse(fs.readFileSync(values.site, 'utf8')) } : {})
    };
    const output = values.output ?? path.join(os.homedir(), 'f1stories-editorial-inputs.json');
    const result = writeEditorialInputs(doc, output, { allowRepoPath: values['allow-repo-path'] });
    process.stdout.write(`PASS: input contract validated; ${result.warnings.length} WARNING(s). Production correctness NOT VERIFIED.\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try { main(process.argv.slice(2)); }
    catch {
        // Parser/OS exceptions may contain query text or local paths. Never echo them into public logs.
        process.stderr.write('FAIL: local import refused; check CSV format, provenance, dates and new output path (see --help).\n');
        process.exitCode = 1;
    }
}
