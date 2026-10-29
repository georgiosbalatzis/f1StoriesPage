// Build a public, deterministic passage index from the rendered article body only.
const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const { isDay, athensDay } = require('../taxonomy');

const VOID = new Set('area base br col embed hr img input link meta source track wbr'.split(' '));
const RAW = new Set(['script', 'style', 'textarea']);
const BLOCKED = new Set(['script', 'style', 'textarea', 'template', 'nav', 'footer', 'table', 'figure', 'svg', 'iframe', 'button', 'form']);
const CHROME = /(?:^|\s)(?:rr-data(?:__\S*)?|rr-related\S*|rr-pitwall\S*|rr-share\S*|gallery\S*|betcast-article-block\S*|article-share\S*|related\S*|author-card\S*)(?:\s|$)/i;
const TOKEN = /<!--[\s\S]*?(?:-->|$)|<![^>]*>|<(\/?)([a-zA-Z][\w:-]*)\b(?:[^>"']|"[^"]*"|'[^']*')*>/g;
const sha = value => createHash('sha256').update(value).digest('hex');
const HTML_ENTITIES = {"AElig": "Æ", "Aacute": "Á", "Acirc": "Â", "Agrave": "À", "Aring": "Å", "Atilde": "Ã", "Auml": "Ä", "Ccedil": "Ç", "ETH": "Ð", "Eacute": "É", "Ecirc": "Ê", "Egrave": "È", "Euml": "Ë", "Iacute": "Í", "Icirc": "Î", "Igrave": "Ì", "Iuml": "Ï", "Ntilde": "Ñ", "Oacute": "Ó", "Ocirc": "Ô", "Ograve": "Ò", "Oslash": "Ø", "Otilde": "Õ", "Ouml": "Ö", "THORN": "Þ", "Uacute": "Ú", "Ucirc": "Û", "Ugrave": "Ù", "Uuml": "Ü", "Yacute": "Ý", "aacute": "á", "acirc": "â", "acute": "´", "aelig": "æ", "agrave": "à", "amp": "&", "aring": "å", "atilde": "ã", "auml": "ä", "brvbar": "¦", "ccedil": "ç", "cedil": "¸", "cent": "¢", "copy": "©", "curren": "¤", "deg": "°", "divide": "÷", "eacute": "é", "ecirc": "ê", "egrave": "è", "eth": "ð", "euml": "ë", "euro": "€", "frac12": "½", "frac14": "¼", "frac34": "¾", "gt": ">", "hellip": "…", "iacute": "í", "icirc": "î", "iexcl": "¡", "igrave": "ì", "iquest": "¿", "iuml": "ï", "laquo": "«", "ldquo": "“", "lsquo": "‘", "lt": "<", "macr": "¯", "mdash": "—", "micro": "µ", "middot": "·", "nbsp": " ", "ndash": "–", "not": "¬", "ntilde": "ñ", "oacute": "ó", "ocirc": "ô", "ograve": "ò", "ordf": "ª", "ordm": "º", "oslash": "ø", "otilde": "õ", "ouml": "ö", "para": "¶", "plusmn": "±", "pound": "£", "quot": "\"", "raquo": "»", "rdquo": "”", "reg": "®", "rsquo": "’", "sect": "§", "shy": "­", "sup1": "¹", "sup2": "²", "sup3": "³", "szlig": "ß", "thorn": "þ", "times": "×", "uacute": "ú", "ucirc": "û", "ugrave": "ù", "uml": "¨", "uuml": "ü", "yacute": "ý", "yen": "¥", "yuml": "ÿ"};

function decode(text) {
    return text.replace(/&(#(?:x[\da-f]+|\d+)|[a-z][a-z\d]+);/gi, (match, entity) => {
        if (entity[0] !== '#') return Object.hasOwn(HTML_ENTITIES, entity) ? HTML_ENTITIES[entity] : match;
        const n = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
        return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '\ufffd';
    });
}
function attribute(tag, name) {
    const match = new RegExp('(?:^|\\s)' + name + '(?:\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+)))?(?=\\s|/?>)', 'i').exec(tag);
    return match ? decode(match[1] ?? match[2] ?? match[3] ?? '') : null;
}
function extract(html) {
    const tokens = new RegExp(TOKEN.source, 'g');
    const stack = [], headings = [], passages = [];
    let found = false, closed = false, ordinal = 0, heading = -1, active = null, last = 0, match;
    function append(text) { if (active && !stack.some(node => node.blocked)) active.parts.push(text); }
    function finish(node) {
        if (!node.candidate || node.candidate !== active) return;
        const text = decode(active.parts.join('')).replace(/\s+/g, ' ').trim();
        if (text && !active.blocked) {
            if (active.kind === 'heading') {
                heading = headings.length;
                headings.push({ text, id: active.id || '' });
            }
            passages.push({ kind: active.kind, ordinal: active.ordinal, heading, text });
        }
        active = null;
    }
    while ((match = tokens.exec(html))) {
        if (found && !closed) append(html.slice(last, match.index));
        last = tokens.lastIndex;
        if (match[0].startsWith('<!')) continue;
        const name = match[2].toLowerCase(), closing = !!match[1], tag = match[0];
        if (!found) {
            if (!closing && RAW.has(name)) {
                const end = new RegExp('</' + name + '\\s*>', 'ig'); end.lastIndex = tokens.lastIndex;
                const close = end.exec(html);
                if (!close) break;
                tokens.lastIndex = end.lastIndex;
                continue;
            }
            if (!closing && name === 'div') {
                const classes = (attribute(tag, 'class') || '').split(/\s+/);
                if (classes.includes('rr-body') && classes.includes('article-content') && attribute(tag, 'data-body') !== null) {
                    found = true; stack.push({ name, body: true, blocked: false });
                }
            }
            continue;
        }
        if (closed) break;
        if (closing) {
            const index = stack.map(node => node.name).lastIndexOf(name);
            if (index < 0) continue;
            while (stack.length > index) {
                const node = stack.pop(); finish(node);
                if (node.parentCandidate) active = node.parentCandidate;
                if (node.body) { closed = true; break; }
            }
            continue;
        }
        const blocked = BLOCKED.has(name) || CHROME.test(attribute(tag, 'class') || '') || attribute(tag, 'hidden') !== null
            || attribute(tag, 'aria-hidden') === 'true' || /(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(attribute(tag, 'style') || '');
        const kind = /^h[1-6]$/.test(name) ? 'heading' : name === 'p' ? 'paragraph' : name === 'li' ? 'list-item' : '';
        const node = { name, blocked, candidate: null };
        if (kind) {
            const currentOrdinal = ordinal++;
            if (!active || (kind === 'list-item' && active.kind === 'list-item')) {
                // A nested list item is independent; the enclosing item is resumed afterwards.
                if (active) { node.parentCandidate = active; active = null; }
                active = node.candidate = { kind, ordinal: currentOrdinal, id: attribute(tag, 'id'), parts: [], blocked: blocked || stack.some(item => item.blocked) };
            }
        }
        if (name === 'br' && active) active.parts.push(' ');
        if (!VOID.has(name) && !tag.endsWith('/>')) stack.push(node);
        if (RAW.has(name)) {
            const end = new RegExp('</' + name + '\\s*>', 'ig'); end.lastIndex = tokens.lastIndex;
            const close = end.exec(html);
            if (!close) return { error: 'malformed-body', headings: [], passages: [] };
            tokens.lastIndex = end.lastIndex; last = end.lastIndex;
            const rawNode = stack.pop(); finish(rawNode);
        }
    }
    if (!found) return { error: 'missing-body', headings: [], passages: [] };
    if (!closed) return { error: 'malformed-body', headings: [], passages: [] };
    passages.sort((a, b) => a.ordinal - b.ordinal);
    return { headings, passages };
}

function writeChanged(file, data) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== data) fs.writeFileSync(file, data);
}
function buildResearchContent(root, indexBytes, today = athensDay()) {
    const index = JSON.parse(indexBytes), groups = new Map(), excluded = [];
    if (index.v !== 2 || !Array.isArray(index.p)) throw new Error('Invalid research metadata index');
    const rows = index.p.filter(row => Array.isArray(row) && typeof row[0] === 'string' && /^[\p{L}\p{N}_-]+$/u.test(row[0])
        && isDay(row[3]) && row[3] <= today).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
    if (new Set(rows.map(row => row[0])).size !== rows.length) throw new Error('Duplicate article ID');
    let searchable = 0;
    for (const row of rows) {
        const id = row[0], file = path.join(root, 'blog-module', 'blog-entries', id, 'article.html');
        const result = fs.existsSync(file) ? extract(fs.readFileSync(file, 'utf8')) : { error: 'missing-article', headings: [], passages: [] };
        const prose = result.passages.some(p => p.kind !== 'heading' && p.text.length >= 40 && /\p{L}/u.test(p.text));
        if (prose) searchable++; else excluded.push({ id, reason: result.error || (result.passages.length ? 'no-prose-passage-at-least-40-characters' : 'no-prose') });
        const article = { id, digest: sha(JSON.stringify({ headings: result.headings, passages: result.passages })), headings: result.headings, passages: result.passages };
        const month = row[3].slice(0, 7);
        if (!groups.has(month)) groups.set(month, []);
        groups.get(month).push(article);
    }
    const output = path.join(root, 'scripts', 'author', 'research-content');
    fs.mkdirSync(output, { recursive: true });
    const shards = [];
    for (const month of Array.from(groups.keys()).sort()) {
        const articles = groups.get(month), data = JSON.stringify({ version: 1, articles });
        if (data.length > 500000 || Buffer.byteLength(data) > 1000000) throw new Error('Research shard exceeds size limit: ' + month);
        const file = month + '.json';
        shards.push({ file, sha256: sha(data), articles: articles.length, passages: articles.reduce((sum, article) => sum + article.passages.length, 0) });
        writeChanged(path.join(output, file), data);
    }
    const manifest = { version: 1, metadataSha256: sha(indexBytes), coverage: { eligible: rows.length, searchableProse: searchable, minimumProseCharacters: 40, excluded }, shards };
    writeChanged(path.join(output, 'manifest.json'), JSON.stringify(manifest));
    const wanted = new Set(shards.map(shard => shard.file));
    for (const name of fs.readdirSync(output)) if (/^\d{4}-(?:0[1-9]|1[0-2])\.json$/.test(name) && !wanted.has(name)) fs.unlinkSync(path.join(output, name));
    return manifest;
}
module.exports = { extract, decode, buildResearchContent };
