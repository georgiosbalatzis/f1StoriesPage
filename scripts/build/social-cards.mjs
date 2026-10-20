import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import sharp from 'sharp';
import shared from '../../blog-module/build/shared.js';
import taxonomy from '../../blog-module/taxonomy.js';
import media from '../../blog-module/build/media-meta.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FONT = fileURLToPath(new URL('./assets/IBMPlexSans-SemiBold.ttf', import.meta.url));
// Only the pinned face participates in shaping, including on machines with no system Fontconfig.
process.env.FONTCONFIG_FILE = fileURLToPath(new URL('./assets/fontconfig.conf', import.meta.url));
const logo = fs.readFileSync(path.join(ROOT, 'images/logo-256.webp'));
const tokens = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/design-tokens.json'))).themes.light;
const hash = data => createHash('sha256').update(data).digest('hex');
const rendererKey = hash(Buffer.concat([
    fs.readFileSync(fileURLToPath(import.meta.url)), fs.readFileSync(FONT), fs.readFileSync(process.env.FONTCONFIG_FILE), logo,
    Buffer.from(JSON.stringify({ tokens, versions: sharp.versions, platform: process.platform, arch: process.arch }))
]));
const clean = value => String(value || '').normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
const { escapeXml, escapeHtmlAttribute: esc } = shared;
export const SOCIAL_WIDTH = 1200;
export const SOCIAL_HEIGHT = 630;
const ORIGIN = 'https://f1-stories.gr';

async function textLayer(text, { size, width, height = Infinity, color = tokens['--ink'], minSize = size }) {
    let displayText = text;
    let truncated = false;
    for (let fontSize = size; ; fontSize = Math.max(minSize, fontSize - 4)) {
        const { data, info } = await sharp({ text: {
            text: `<span foreground="${color}" fallback="false">${escapeXml(displayText)}</span>`,
            font: `IBM Plex Sans Semi-Bold ${fontSize}`, fontfile: FONT,
            width, wrap: 'word-char', rgba: true, dpi: 72, spacing: 4
        } }).png().toBuffer({ resolveWithObject: true });
        if (info.height <= height) return { data, width: info.width, height: info.height, fontSize, displayText, truncated };
        if (fontSize === minSize) {
            const graphemes = [...new Intl.Segmenter('el', { granularity: 'grapheme' }).segment(displayText.replace(/…$/, ''))].map(s => s.segment);
            if (graphemes.length < 2) throw new Error('Social title does not fit');
            displayText = graphemes.slice(0, Math.floor(graphemes.length * 0.85)).join('').trimEnd() + '…';
            truncated = true;
        }
    }
}

export async function renderSocialCard({ title, category = '', author = '', image, disclosure = '', home = false }, maxBytes = 300 * 1024) {
    const layers = [];
    const addText = async (text, left, top, options) => {
        const layer = await textLayer(text, options);
        layers.push({ input: layer.data, left, top });
        return layer;
    };
    const brand = await sharp(logo).resize(home ? 256 : 64).png().toBuffer();
    layers.push({ input: brand, left: home ? 900 : 40, top: home ? 240 : 32 });
    await addText('F1 STORIES.', home ? 40 : 120, 46, { size: 40, width: 600 });
    await addText('f1-stories.gr', 954, 55, { size: 23, width: 206 });
    layers.push({ input: await sharp({ create: { width: 1120, height: 6, channels: 3, background: tokens['--accent'] } }).png().toBuffer(), left: 40, top: 118 });
    let titleLayout;
    if (home) {
        titleLayout = await addText('Formula 1.\nΑναλύσεις, νέα\nκαι podcast.', 40, 186, { size: 80, minSize: 44, width: 810, height: 350 });
    } else {
        // Contain the whole image: archival prints, diagrams and printed captions must survive the adaptation.
        const picture = await sharp(image).rotate().resize(440, 366, { fit: 'contain', background: tokens['--bg-surface'] }).flatten({ background: tokens['--bg-surface'] }).png().toBuffer();
        layers.push({ input: picture, left: 40, top: 154 });
        if (category) await addText(category, 528, 160, { size: 23, width: 632, height: 36 });
        titleLayout = await addText(title, 528, 210, { size: 56, minSize: 28, width: 632, height: 310 });
        if (author) await addText(author, 528, 556, { size: 23, width: 632, height: 36 });
        if (disclosure) await addText(disclosure, 40, 542, { size: 17, width: 440, height: 48 });
    }
    const canvas = sharp({ create: { width: SOCIAL_WIDTH, height: SOCIAL_HEIGHT, channels: 3, background: tokens['--bg-base'] } }).composite(layers);
    for (const quality of [86, 78, 68, 58]) {
        const data = await canvas.clone().jpeg({ quality, mozjpeg: true, chromaSubsampling: '4:4:4' }).toBuffer();
        if (data.length <= maxBytes) {
            const { width, height, fontSize, displayText, truncated } = titleLayout;
            return { data, layout: { width, height, fontSize, displayText, truncated } };
        }
    }
    throw new Error(`Social card exceeds ${maxBytes} bytes`);
}

function imageRef(html) {
    return /<meta\b[^>]*property="og:image"[^>]*content="([^"]+)"[^>]*>/.exec(html)?.[1] || '';
}

function localImage(root, url) {
    const parsed = new URL(url, ORIGIN);
    if (parsed.origin !== ORIGIN) throw new Error('Social image must be local');
    const file = fs.realpathSync(path.resolve(root, '.' + decodeURIComponent(parsed.pathname)));
    const relative = path.relative(fs.realpathSync(root), file);
    if (relative.startsWith('..') || path.isAbsolute(relative) || !/\.(?:webp|avif|png|jpe?g)$/i.test(file)) throw new Error('Invalid social image path');
    return file;
}

export function socialMetadata(html, { url, title, width = SOCIAL_WIDTH, height = SOCIAL_HEIGHT, type = 'image/jpeg', card = 'summary_large_image' }) {
    const tags = [
        ['property', 'og:image', url], ['property', 'og:image:width', width], ['property', 'og:image:height', height],
        ['property', 'og:image:type', type], ['property', 'og:image:alt', title],
        ['name', 'twitter:image', url], ['name', 'twitter:image:alt', title], ['name', 'twitter:card', card]
    ];
    return html.replace(/<head\b[^>]*>[\s\S]*?<\/head>/i, head => {
        for (const [attribute, name, value] of tags) {
            let found = false;
            const tag = `<meta ${attribute}="${name}" content="${esc(value)}">`;
            const pattern = new RegExp(`<meta\\b[^>]*\\b${attribute}=["']${name}["'][^>]*>`, 'gi');
            head = head.replace(pattern, () => { if (found) return ''; found = true; return tag; });
            if (!found) head = head.replace(/\s*<\/head>/i, `\n    ${tag}\n</head>`);
        }
        return head;
    });
}

export async function buildSocialCards({ repoRoot = ROOT, distRoot, htmlFiles, cacheRoot = path.join(repoRoot, '.build/public-images/social-cards'), maxBytes = 300 * 1024, render = renderSocialCard, warn = console.warn }) {
    const started = performance.now();
    const posts = new Map(JSON.parse(fs.readFileSync(path.join(repoRoot, 'blog-module/blog-source-cache.json'))).posts.map(post => [post.id, post]));
    const records = [];
    const files = new Set();
    fs.mkdirSync(cacheRoot, { recursive: true });
    for (const page of htmlFiles.filter(file => file === 'index.html' || /^blog-module\/blog-entries\/[^/]+\/article\.html$/.test(file))) {
        const home = page === 'index.html';
        const htmlPath = path.join(distRoot, page);
        const html = fs.readFileSync(htmlPath, 'utf8');
        const record = { page, source: home ? '' : imageRef(html) };
        try {
            const post = home ? {} : posts.get(page.split('/')[2]);
            if (!home && !clean(post?.title)) throw new Error('Article title metadata unavailable');
            const meta = home ? null : media.mediaFor(post.id, media.slotOf(record.source));
            const image = home ? null : fs.readFileSync(localImage(distRoot, record.source));
            const title = home ? 'F1 Stories — Formula 1, αναλύσεις, νέα και podcast' : clean(post.title);
            const author = home ? '' : taxonomy.findAuthor(post.author)?.label || '';
            const category = home || !taxonomy.isPublicCategory(post.category) ? '' : taxonomy.categoryLabel(post.category);
            const disclosure = meta?.synthetic === 'confirmed' ? media.AI_LABEL : '';
            record.sourceSha256 = image ? hash(image) : '';
            const key = hash(rendererKey + JSON.stringify({ title, author, category, disclosure, home, source: record.sourceSha256, maxBytes }));
            const cacheFile = path.join(cacheRoot, key + '.jpg');
            const cacheMeta = path.join(cacheRoot, key + '.json');
            let data, layout;
            try {
                const cached = JSON.parse(fs.readFileSync(cacheMeta));
                data = fs.readFileSync(cacheFile);
                if (hash(data) !== cached.sha256 || data.length > maxBytes || !cached.layout?.fontSize) throw new Error('Invalid cached card');
                const info = await sharp(data).metadata();
                if (info.format !== 'jpeg' || info.width !== SOCIAL_WIDTH || info.height !== SOCIAL_HEIGHT) throw new Error('Invalid cached dimensions');
                layout = cached.layout;
                record.cacheHit = true;
            } catch {
                ({ data, layout } = await render({ title, author, category, disclosure, home, image }, maxBytes));
                record.cacheHit = false;
                fs.writeFileSync(cacheFile, data);
                fs.writeFileSync(cacheMeta, JSON.stringify({ sha256: hash(data), layout }));
            }
            record.sha256 = hash(data);
            record.file = `images/social/${home ? 'home' : 'article'}-${record.sha256.slice(0, 20)}.jpg`;
            record.url = ORIGIN + '/' + record.file;
            record.bytes = data.length;
            record.truncated = layout.truncated;
            fs.mkdirSync(path.join(distRoot, 'images/social'), { recursive: true });
            fs.writeFileSync(path.join(distRoot, record.file), data);
            fs.writeFileSync(htmlPath, socialMetadata(html, { url: record.url, title }), 'utf8');
            files.add(record.file);
        } catch (error) {
            record.error = error.message;
            // Articles retain their original social image; homepage fallback is always the brand, never a story.
            if (home) fs.writeFileSync(htmlPath, socialMetadata(html, { url: ORIGIN + '/images/icons/icon-512.png', title: 'F1 Stories', width: 512, height: 512, type: 'image/png', card: 'summary' }));
            warn(`Social card fallback (${page}): ${error.message}`);
        }
        records.push(record);
    }
    const result = { files: [...files].sort(), records, elapsedMs: Math.round(performance.now() - started) };
    fs.writeFileSync(path.join(cacheRoot, 'report.json'), JSON.stringify(result, null, 2));
    return result;
}
