import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
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
const themes = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/design-tokens.json'))).themes;
const tokens = themes.light;
export const TEMPLATE = 'cinematic-v1';
const hash = data => createHash('sha256').update(data).digest('hex');
export const rendererKey = hash(Buffer.concat([
    fs.readFileSync(fileURLToPath(import.meta.url)), fs.readFileSync(path.join(ROOT, 'blog-module/build/media-meta.js')), fs.readFileSync(FONT), fs.readFileSync(process.env.FONTCONFIG_FILE), logo,
    Buffer.from(JSON.stringify({ themes, template: TEMPLATE, node: process.versions.node, icu: process.versions.icu, versions: sharp.versions, platform: process.platform, arch: process.arch }))
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

async function renderLegacyCard({ title, category = '', author = '', image, disclosure = '', home = false }, maxBytes = 300 * 1024) {
    fs.mkdirSync(path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'fontconfig'), { recursive: true });
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

let headerLayers;
const lineMetrics = new Map();
let accentLayer;
async function cinematicHeader() {
    if (!headerLayers) {
        const icon = await sharp(logo).resize(72, 72).png().toBuffer();
        // Build the shadow from the logo alpha without changing the official artwork.
        const alpha = await sharp(icon).ensureAlpha().extractChannel('alpha').linear(0.35).blur(3).raw().toBuffer();
        const black = await sharp({ create: { width: 72, height: 72, channels: 3, background: '#000000' } }).joinChannel(alpha, { raw: { width: 72, height: 72, channels: 1 } }).png().toBuffer();
        const word = await textLayer('F1 STORIES', { size: 32, width: 600, color: '#ffffff' });
        const dot = await textLayer('.', { size: 32, width: 40, color: tokens['--accent'] });
        const domain = await textLayer('f1-stories.gr', { size: 23, width: 400, color: '#ffffff' });
        const baseline = 36 + Math.round((72 + word.height) / 2);
        const headerBottom = Math.max(baseline, 108);
        const scrim = Buffer.from(`<svg width="1200" height="${headerBottom + 60}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x2="0" y2="1"><stop offset="${(headerBottom + 12) / (headerBottom + 60)}" stop-color="black" stop-opacity=".6"/><stop offset="1" stop-color="black" stop-opacity="0"/></linearGradient></defs><rect width="1200" height="100%" fill="url(#g)"/></svg>`);
        headerLayers = { word, domain, baseline, layers: [
            { input: scrim, left: 0, top: 0 }, { input: black, left: 48, top: 38 },
            { input: icon, left: 48, top: 36 }, { input: word.data, left: 136, top: baseline - word.height },
            { input: dot.data, left: 136 + word.width, top: baseline - dot.height },
            { input: domain.data, left: 1152 - domain.width, top: baseline - domain.height }
        ] };
    }
    return headerLayers;
}

async function coverImage(image, focus) {
    const info = await sharp(image).metadata();
    const rotated = info.orientation >= 5 && info.orientation <= 8;
    const sourceWidth = rotated ? info.height : info.width;
    const sourceHeight = rotated ? info.width : info.height;
    const scale = Math.max(SOCIAL_WIDTH / sourceWidth, SOCIAL_HEIGHT / sourceHeight);
    const width = Math.max(SOCIAL_WIDTH, Math.ceil(sourceWidth * scale));
    const height = Math.max(SOCIAL_HEIGHT, Math.ceil(sourceHeight * scale));
    const match = /^(100|\d{1,2})% (100|\d{1,2})%$/.exec(focus || '');
    const x = match ? Number(match[1]) : 50;
    const y = match ? Number(match[2]) : 50;
    return sharp(image).rotate().resize(width, height, { fit: 'fill' }).extract({ left: Math.round((width - SOCIAL_WIDTH) * x / 100), top: Math.round((height - SOCIAL_HEIGHT) * y / 100), width: SOCIAL_WIDTH, height: SOCIAL_HEIGHT }).png().toBuffer();
}

async function headlineLayer(title, height) {
    let displayText = clean(title);
    if (!displayText) throw new Error('Article title metadata unavailable');
    let truncated = false;
    for (let size = 68; ; size = Math.max(36, size - 4)) {
        const options = { size, width: 1104, color: '#ffffff' };
        if (!lineMetrics.has(size)) {
            const line = await textLayer('Ag', options);
            const pair = await textLayer('Ag\nAg', options);
            lineMetrics.set(size, { height: line.height, pitch: pair.height - line.height });
        }
        const line = lineMetrics.get(size);
        const pitch = line.pitch;
        let layer = await textLayer(displayText, options);
        const lines = Math.max(1, Math.round((layer.height - line.height) / pitch) + 1);
        if (layer.height <= height && lines <= 4) return { ...layer, lines, pitch, truncated };
        if (size === 36) {
            const graphemes = [...new Intl.Segmenter('el', { granularity: 'grapheme' }).segment(displayText.replace(/…$/, ''))].map(s => s.segment);
            if (graphemes.length < 2) throw new Error('Social title does not fit');
            displayText = graphemes.slice(0, Math.floor(graphemes.length * 0.85)).join('').trimEnd() + '…';
            truncated = true;
        }
    }
}

export async function renderSocialCard({ title, author = '', image, disclosure = '', home = false, media: imageMeta = {}, fallback = null, category = '' }, maxBytes = 300 * 1024) {
    if (home) return renderLegacyCard({ title, author, image, disclosure, home, category }, maxBytes);
    fs.mkdirSync(path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'fontconfig'), { recursive: true });
    const timings = {};
    let mark = performance.now();
    const stageTime = name => { if (process.env.SOCIAL_CARD_PROFILE) timings[name] = Math.round((performance.now() - mark) * 100) / 100; mark = performance.now(); };
    const contained = Boolean(image && media.isContained(imageMeta));
    let background;
    if (image) {
        try { background = await coverImage(image, imageMeta.focus); } catch (error) { error.code = 'SOCIAL_SOURCE_DECODE'; throw error; }
        stageTime('decodeResize');
        if (contained) background = await sharp(background).blur(20).modulate({ brightness: 0.45 }).png().toBuffer();
        stageTime('blur');
    } else {
        background = Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x2="0" y2="1"><stop stop-color="${themes.dark['--bg-surface-alt']}"/><stop offset="1" stop-color="${themes.dark['--bg-base']}"/></linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/></svg>`);
    }
    const layers = [];
    if (contained) {
        let picture;
        try { picture = await sharp(image).rotate().resize(1104, 200, { fit: 'inside', withoutEnlargement: false }).png().toBuffer({ resolveWithObject: true }); } catch (error) { error.code = 'SOCIAL_SOURCE_DECODE'; throw error; }
        layers.push({ input: picture.data, left: 48 + Math.floor((1104 - picture.info.width) / 2), top: 128 + Math.floor((200 - picture.info.height) / 2) });
    }
    const byline = author ? await textLayer(clean(author), { size: 26, width: 650, color: '#ffffff' }) : await textLayer('Ag', { size: 26, width: 650, color: '#ffffff' });
    const bylineTop = 590 - byline.height;
    const accentTop = bylineTop - 25;
    const headlineBottom = accentTop - 28;
    const headline = await headlineLayer(title, Math.min(300, headlineBottom - (contained ? 348 : 150)));
    const headlineTop = headlineBottom - headline.height;
    const start = Math.max(0, headlineTop - 24);
    const footer = Buffer.from(`<svg width="1200" height="${630 - start}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x2="0" y2="1"><stop stop-color="black" stop-opacity=".6"/><stop offset="1" stop-color="black" stop-opacity=".9"/></linearGradient></defs><rect width="1200" height="100%" fill="url(#g)"/></svg>`);
    const header = await cinematicHeader();
    layers.push({ input: footer, left: 0, top: start }, ...header.layers);
    layers.push({ input: headline.data, left: 48, top: headlineTop });
    accentLayer ||= await sharp({ create: { width: 88, height: 5, channels: 3, background: tokens['--accent'] } }).png().toBuffer();
    layers.push({ input: accentLayer, left: 48, top: accentTop });
    if (author) layers.push({ input: byline.data, left: 48, top: bylineTop });
    let disclosureBox = null;
    if (disclosure) {
        const label = await textLayer(clean(disclosure), { size: 17, width: 440, color: '#ffffff' });
        const pillWidth = label.width + 24;
        if (author && 48 + byline.width + 24 > 1152 - pillWidth) throw new Error('Social footer does not fit');
        disclosureBox = { left: 1152 - pillWidth + 12, top: 590 - label.height - 6, width: label.width, height: label.height };
        const pill = Buffer.from(`<svg width="${pillWidth}" height="${label.height + 12}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" rx="6" fill="black" fill-opacity=".75"/></svg>`);
        layers.push({ input: pill, left: 1152 - pillWidth, top: 590 - label.height - 12 }, { input: label.data, left: 1152 - pillWidth + 12, top: 590 - label.height - 6 });
    }
    stageTime('textLayers');
    const raw = await sharp(background).composite(layers).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    stageTime('composite');
    for (const quality of [78, 68, 58]) {
        const data = await sharp(raw.data, { raw: raw.info }).jpeg({ quality, mozjpeg: true, chromaSubsampling: '4:4:4' }).toBuffer();
        if (data.length <= maxBytes) {
            stageTime('jpeg');
            if (process.env.SOCIAL_CARD_PROFILE) console.error('SOCIAL_CARD_PROFILE ' + JSON.stringify(timings));
            return { data, layout: { width: headline.width, height: headline.height, fontSize: headline.fontSize, lines: headline.lines, displayText: headline.displayText, truncated: headline.truncated, headlineTop, headlineBottom, headlineRight: 48 + headline.width, accentTop, contained, fallback,
            wordmarkBox: { left: 136, top: header.baseline - header.word.height, width: header.word.width, height: header.word.height },
            domainBox: { left: 1152 - header.domain.width, top: header.baseline - header.domain.height, width: header.domain.width, height: header.domain.height },
            headlineBoxes: Array.from({ length: headline.lines }, (_, i) => ({ left: 48, top: headlineTop + i * headline.pitch, width: headline.width, height: i === headline.lines - 1 ? headline.height - i * headline.pitch : headline.pitch })),
            bylineBox: author ? { left: 48, top: bylineTop, width: byline.width, height: byline.height } : null, disclosureBox } };
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
    const report = { eligible: 0, cards: 0, cacheHits: 0, fallbacks: [], failures: [], truncated: 0, overBudget: 0, metadataFailures: 0, missingFiles: 0, legacyTemplate: 0, home: null };
    fs.mkdirSync(cacheRoot, { recursive: true });
    const pages = htmlFiles.filter(file => file === 'index.html' || (/^blog-module\/blog-entries\/[^/]+\/article\.html$/.test(file) && posts.has(file.split('/')[2])));
    for (const page of pages) {
        const home = page === 'index.html';
        if (!home) report.eligible++;
        const htmlPath = path.join(distRoot, page);
        const record = { page, source: '', template: TEMPLATE, rendererKey };
        let stage = 'read';
        try {
            const html = fs.readFileSync(htmlPath, 'utf8');
            record.source = home ? '' : imageRef(html);
            const post = home ? {} : posts.get(page.split('/')[2]);
            if (!home && !clean(post?.title)) throw new Error('Article title metadata unavailable');
            const meta = home ? null : media.mediaFor(post.id, media.slotOf(record.source));
            const imageMeta = { focus: meta?.focus || '', type: meta?.type || '', synthetic: meta?.synthetic || '', contained: media.isContained(meta) };
            let image = null;
            if (!home) {
                let reason = '';
                if (!record.source) reason = 'source-missing';
                else {
                    try {
                        const parsed = new URL(record.source, ORIGIN);
                        const pathname = decodeURIComponent(parsed.pathname);
                        const expected = '/' + path.posix.dirname(page) + '/';
                        const brand = pathname === '/images/logo-256.webp';
                        if (parsed.origin !== ORIGIN || (!brand && (!pathname.startsWith(expected) || pathname.slice(expected.length).includes('/'))) || !/\.(?:webp|avif|png|jpe?g)$/i.test(pathname)) throw new Error('invalid');
                        const resolved = path.resolve(distRoot, '.' + pathname);
                        if (!brand && !resolved.startsWith(path.resolve(distRoot, path.dirname(page)) + path.sep)) throw new Error('invalid');
                    } catch { reason = 'source-invalid'; }
                    if (!reason) {
                        try {
                            const file = localImage(distRoot, record.source);
                            const articleDir = fs.realpathSync(path.join(distRoot, path.dirname(page)));
                            const brandPath = path.join(fs.realpathSync(distRoot), 'images/logo-256.webp');
                            if (!file.startsWith(articleDir + path.sep) && file !== brandPath) reason = 'source-invalid';
                            else image = fs.readFileSync(file);
                        } catch (error) {
                            reason = error.code === 'ENOENT' || error.code === 'EACCES' || error.code === 'EISDIR' ? 'source-unreadable' : 'source-invalid';
                        }
                    }
                }
                if (reason) { record.fallback = reason; report.fallbacks.push({ page, reason }); }
            }
            const title = home ? 'F1 Stories — Formula 1, αναλύσεις, νέα και podcast' : clean(post.title);
            const author = home ? '' : taxonomy.findAuthor(post.author)?.label || '';
            const disclosure = meta?.synthetic === 'confirmed' ? media.AI_LABEL : '';
            record.sourceSha256 = image ? hash(image) : '';
            record.contained = Boolean(image && imageMeta.contained);
            const key = hash(rendererKey + JSON.stringify({ title, author, disclosure, home, source: record.sourceSha256, media: imageMeta, fallback: record.fallback || '', maxBytes }));
            const cacheFile = path.join(cacheRoot, key + '.jpg');
            const cacheMeta = path.join(cacheRoot, key + '.json');
            let data, layout;
            try {
                const cached = JSON.parse(fs.readFileSync(cacheMeta));
                data = fs.readFileSync(cacheFile);
                if (cached.template !== TEMPLATE || cached.rendererKey !== rendererKey || hash(data) !== cached.sha256 || data.length > maxBytes || !cached.layout?.fontSize) throw new Error('Invalid cached card');
                const info = await sharp(data).metadata();
                if (info.format !== 'jpeg' || info.width !== SOCIAL_WIDTH || info.height !== SOCIAL_HEIGHT) throw new Error('Invalid cached dimensions');
                layout = cached.layout;
                if (cached.fallback === 'source-decode') { record.fallback = cached.fallback; record.contained = false; report.fallbacks.push({ page, reason: cached.fallback }); }
                record.cacheHit = true;
            } catch {
                stage = 'render';
                if (image) {
                    try { await sharp(image).metadata(); } catch {
                        image = null;
                        record.contained = false;
                        record.fallback = 'source-decode';
                        report.fallbacks.push({ page, reason: record.fallback });
                    }
                }
                try {
                    ({ data, layout } = await render({ title, author, disclosure, home, image, media: imageMeta, fallback: record.fallback || null }, maxBytes));
                } catch (error) {
                    if (!image || error.code !== 'SOCIAL_SOURCE_DECODE') throw error;
                    record.contained = false;
                    record.fallback = 'source-decode';
                    report.fallbacks.push({ page, reason: record.fallback });
                    ({ data, layout } = await render({ title, author, disclosure, home, image: null, media: imageMeta, fallback: record.fallback }, maxBytes));
                }
                if (data.length > maxBytes) throw new Error(`Social card exceeds ${maxBytes} bytes`);
                const info = await sharp(data).metadata();
                if (info.format !== 'jpeg' || info.width !== SOCIAL_WIDTH || info.height !== SOCIAL_HEIGHT || !layout?.fontSize) throw new Error('Invalid rendered card');
                record.cacheHit = false;
                fs.writeFileSync(cacheFile, data);
                fs.writeFileSync(cacheMeta, JSON.stringify({ sha256: hash(data), layout, template: TEMPLATE, rendererKey, fallback: record.fallback || null }));
            }
            record.sha256 = hash(data);
            record.file = `images/social/${home ? 'home' : 'article'}-${record.sha256.slice(0, 20)}.jpg`;
            record.url = ORIGIN + '/' + record.file;
            record.bytes = data.length;
            record.truncated = layout.truncated;
            record.fontSize = layout.fontSize;
            record.lines = layout.lines;
            fs.mkdirSync(path.join(distRoot, 'images/social'), { recursive: true });
            fs.writeFileSync(path.join(distRoot, record.file), data);
            stage = 'metadata';
            const updated = socialMetadata(html, { url: record.url, title });
            const head = /<head\b[^>]*>[\s\S]*?<\/head>/i.exec(updated)?.[0] || '';
            for (const [attribute, name] of [['property', 'og:image'], ['name', 'twitter:image']]) {
                const tags = [...head.matchAll(new RegExp(`<meta\\b[^>]*\\b${attribute}=["']${name}["'][^>]*>`, 'gi'))];
                if (tags.length !== 1 || !tags[0][0].includes(`content="${record.url}"`)) throw new Error('Social metadata replacement failed');
            }
            fs.writeFileSync(htmlPath, updated, 'utf8');
            files.add(record.file);
            if (!home) {
                report.cards++;
                if (record.cacheHit) report.cacheHits++;
                if (record.truncated) report.truncated++;
            }
        } catch (error) {
            record.error = error.message;
            if (home) {
                try {
                    const html = fs.readFileSync(htmlPath, 'utf8');
                    fs.writeFileSync(htmlPath, socialMetadata(html, { url: ORIGIN + '/images/icons/icon-512.png', title: 'F1 Stories', width: 512, height: 512, type: 'image/png', card: 'summary' }));
                } catch { /* The existing homepage fallback cannot repair an unreadable page. */ }
                warn(`Social card fallback (${page}): ${error.message}`);
            } else {
                report.failures.push({ page, error: error.message });
                if (stage === 'metadata') report.metadataFailures++;
                if (stage === 'read' && error.code === 'ENOENT') report.missingFiles++;
                if (/exceeds .* bytes/.test(error.message)) report.overBudget++;
            }
        }
        records.push(record);
        if (home) report.home = record;
    }
    const result = { ...report, files: [...files].sort(), records, elapsedMs: Math.round(performance.now() - started) };
    fs.writeFileSync(path.join(cacheRoot, 'report.json'), JSON.stringify(result, null, 2));
    if (report.failures.length) throw new Error(`Social card generation failed for ${report.failures.length} article(s); see ${path.join(cacheRoot, 'report.json')}`);
    return result;
}
