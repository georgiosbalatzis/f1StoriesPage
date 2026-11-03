// Review fixtures only; these titles are never inserted into the publication index.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import shared from '../../blog-module/build/shared.js';
import { buildSocialCards, renderSocialCard } from './social-cards.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
export const defaultIds = ['20260508W', '20250919W', '20250805WF', '20261011J', '20250429-1G', '20260418W', '20261015W', '20260923-2G', '20260904W', '20260606J'];
export const examples = [
    { name: 'short', title: 'Μια νίκη γεμάτη ιστορίες', author: 'Θέμης Χαρβάλης', image: '20261020W/2.webp' },
    { name: 'long', title: 'Πιασ(τ)άρικη Κυριαρχία και Βαρκελώνη στις Φλόγες! Ο Piastri Θριαμβεύει, ο Verstappen στο Μάτι του Κυκλώνα στο Ισπανικό GP του 2025!', author: 'Γιώργος Μπαλατζής', image: '20250602-1G/1.webp' },
    { name: 'technical', title: 'Γιατί το νέο πάτωμα δεν έφερε τα δέκατα που υποσχέθηκε: αεροδυναμική, ελαστικά και αγωνιστικός ρυθμός', author: 'Γιώργος Μπαλατζής', image: '20261015G/1.webp' },
    { name: 'optional', title: 'Μια ιστορία από την πίστα', image: '20261020W/1.webp' },
    { name: 'punctuation', title: '«F1» & <ρυθμός>: τ’ αγώνα, "νέα" και O’Connor', image: '20261020W/2.webp' },
    { name: 'home', home: true }
];

async function sheet(output, rows, width, name) {
    const height = Math.round(width * 630 / 1200);
    const labelHeight = 36;
    const layers = [];
    for (const [index, row] of rows.entries()) {
        const left = (index % 2) * width;
        const top = Math.floor(index / 2) * (height + labelHeight);
        layers.push({ input: await sharp(row.data).resize(width, height).toBuffer(), left, top });
        const label = `<svg width="${width}" height="${labelHeight}"><rect width="100%" height="100%" fill="#151515"/><text x="12" y="25" fill="white" font-size="20">${shared.escapeXml(row.id)}</text></svg>`;
        layers.push({ input: Buffer.from(label), left, top: top + height });
    }
    await sharp({ create: { width: width * 2, height: Math.ceil(rows.length / 2) * (height + labelHeight), channels: 3, background: '#151515' } })
        .composite(layers).jpeg({ quality: 85 }).toFile(path.join(output, name));
}

async function main() {
    const args = process.argv.slice(2);
    const idsArg = args.indexOf('--ids');
    const outArg = args.indexOf('--out');
    if ((idsArg !== -1 && !args[idsArg + 1]) || (outArg !== -1 && !args[outArg + 1])) throw new Error('Missing option value');
    const temp = fs.realpathSync(os.tmpdir());
    const requested = path.resolve(outArg === -1 ? path.join(temp, 'f1-social-card-examples') : args[outArg + 1]);
    let ancestor = requested;
    while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
    const output = path.join(fs.realpathSync(ancestor), path.relative(ancestor, requested));
    const relative = path.relative(temp, output);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Output must be inside the system temporary directory');
    fs.mkdirSync(output, { recursive: true });
    const rows = [];
    if (!args.includes('--synthetic')) {
        const ids = idsArg === -1 ? defaultIds : args[idsArg + 1].split(',');
        if (!ids.length || ids.some(id => !/^[\w-]+$/.test(id)) || new Set(ids).size !== ids.length) throw new Error('Invalid or duplicate article IDs');
        const posts = new Map(JSON.parse(fs.readFileSync(path.join(root, 'blog-module/blog-source-cache.json'))).posts.map(post => [post.id, post]));
        const scratch = fs.mkdtempSync(path.join(temp, 'f1-social-review-'));
        try {
            const htmlFiles = ids.map(id => {
                if (!posts.has(id)) throw new Error(`Unknown article: ${id}`);
                const dir = `blog-module/blog-entries/${id}`;
                fs.cpSync(path.join(root, dir), path.join(scratch, dir), { recursive: true });
                return `${dir}/article.html`;
            });
            fs.mkdirSync(path.join(scratch, 'images'), { recursive: true });
            fs.copyFileSync(path.join(root, 'images/logo-256.webp'), path.join(scratch, 'images/logo-256.webp'));
            const rendered = new Map();
            const result = await buildSocialCards({ repoRoot: root, distRoot: scratch, htmlFiles, cacheRoot: path.join(scratch, 'cache'), render: async (...input) => {
                const start = performance.now();
                const card = await renderSocialCard(...input);
                rendered.set(input[0].title, { layout: card.layout, ms: Math.round(performance.now() - start) });
                return card;
            } });
            for (const id of ids) {
                const record = result.records.find(item => item.page === `blog-module/blog-entries/${id}/article.html`);
                if (!record?.file) throw new Error(`Card missing for ${id}: ${record?.error || 'unknown error'}`);
                const data = fs.readFileSync(path.join(scratch, record.file));
                const title = posts.get(id).title;
                rows.push({ id, title, data, ...rendered.get(title) });
            }
        } finally {
            fs.rmSync(scratch, { recursive: true, force: true });
        }
    } else {
        for (const example of examples) {
            const image = example.image ? fs.readFileSync(path.join(root, 'blog-module/blog-entries', example.image)) : null;
            const start = performance.now();
            const { data, layout } = await renderSocialCard({ ...example, image });
            rows.push({ id: example.name, title: example.title || 'F1 Stories', data, layout, ms: Math.round(performance.now() - start) });
        }
    }
    for (const row of rows) fs.writeFileSync(path.join(output, `${row.id}.jpg`), row.data);
    fs.writeFileSync(path.join(output, 'review.json'), JSON.stringify(rows.map(({ data, ...row }) => ({ ...row, bytes: data.length })), null, 2) + '\n');
    if (args.includes('--sheet')) {
        await sheet(output, rows, 1200, 'sheet.jpg');
        await sheet(output, rows, 600, 'sheet-mobile.jpg');
    }
    console.log(`Wrote ${rows.length} cards to ${output}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
