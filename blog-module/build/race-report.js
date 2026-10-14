// THE RACE REPORT (P3B): the build-time half of the article design. It reads an article body as written and
// returns it with its presentation structure: data bands around F1 Stories tools, chart panels, paragraph
// subheads exposed as headings, section ids, plus the running order built from what the body really contains.
// Every transform is idempotent: source-less entries are re-rendered from their own published body on each build.
const { escapeHtmlAttribute } = require('./shared');

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW_TAGS = new Set(['script', 'style', 'textarea']);

// Top-level nodes of an HTML fragment (elements and non-blank text), without a DOM. Balanced markup is assumed;
// an element that never closes runs to the end of the fragment.
function topLevelBlocks(html) {
    const blocks = [];
    const token = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)\b(?:[^>"']|"[^"]*"|'[^']*')*>/g;
    let depth = 0;
    let start = 0;
    let tag = '';
    let textStart = 0;
    let match;
    const pushText = end => {
        if (html.slice(textStart, end).trim()) blocks.push({ tag: '#text', start: textStart, end });
    };
    while ((match = token.exec(html))) {
        if (match[0].startsWith('<!--')) {
            if (depth === 0) { pushText(match.index); blocks.push({ tag: '#comment', start: match.index, end: token.lastIndex }); textStart = token.lastIndex; }
            continue;
        }
        const closing = match[1] === '/';
        const name = match[2].toLowerCase();
        if (!closing && RAW_TAGS.has(name)) {
            const close = html.toLowerCase().indexOf(`</${name}`, token.lastIndex);
            const end = close < 0 ? html.length : html.indexOf('>', close) + 1;
            if (depth === 0) { pushText(match.index); blocks.push({ tag: name, start: match.index, end }); textStart = end; }
            token.lastIndex = end;
            continue;
        }
        if (VOID_TAGS.has(name) || match[0].endsWith('/>')) {
            if (depth === 0) { pushText(match.index); blocks.push({ tag: name, start: match.index, end: token.lastIndex }); textStart = token.lastIndex; }
            continue;
        }
        if (!closing) {
            if (depth === 0) { pushText(match.index); start = match.index; tag = name; }
            depth += 1;
        } else if (depth > 0) {
            depth -= 1;
            if (depth === 0) { blocks.push({ tag, start, end: token.lastIndex }); textStart = token.lastIndex; }
        }
    }
    if (depth > 0) blocks.push({ tag, start, end: html.length });
    else pushText(html.length);
    // `before` keeps the original whitespace between nodes, so inline runs reassemble byte for byte.
    return blocks.map((block, i) => ({ ...block, before: html.slice(i ? blocks[i - 1].end : 0, block.start), html: html.slice(block.start, block.end) }));
}

const joinBlocks = blocks => blocks.map(block => (block.before === undefined ? '\n' : block.before) + block.html).join('');

const textOf = html => String(html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/\s+/g, ' ').trim();
const openTag = html => (/^<[^>]*>/.exec(html) || [''])[0];
const hasClass = (html, name) => new RegExp(`\\bclass=(["'])[^"']*\\b${name}\\b`).test(openTag(html));
const pad = n => String(n).padStart(2, '0');
const decodeAmp = value => String(value || '').replace(/&amp;/g, '&');

// Tools that get a data band: F1 Stories' own racing-data products. Third-party embeds (Sketchfab, social) stay in the column.
function toolKind(src) {
    let url;
    try { url = new URL(decodeAmp(src)); } catch (_) { return null; }
    const host = url.hostname;
    const route = url.pathname;
    if (host === 'georgiosbalatzis.github.io' && route.startsWith('/Tyres/')) return { label: 'TYRES', el: 'Ελαστικά' };
    if (host === 'georgiosbalatzis.github.io' && route.startsWith('/ghostcar/')) return { label: 'GHOST CAR', el: 'Σύγκριση γύρων' };
    if (host === 'georgiosbalatzis.github.io' && route.startsWith('/f1-telemetry-dashboard/')) return { label: 'TELEMETRY', el: 'Τηλεμετρία' };
    if (host === 'georgiosbalatzis.github.io' && route.startsWith('/BetCastVisualisation/')) return { label: 'BETCAST', el: 'Προγνωστικά' };
    if (/(^|\.)f1-stories\.gr$/.test(host) && route.startsWith('/telemetry/')) return { label: 'TELEMETRY', el: 'Τηλεμετρία' };
    if (/(^|\.)f1-stories\.gr$/.test(host) && route.startsWith('/standings/')) {
        const tabs = {
            debrief: ['DEBRIEF', 'Debrief Παρασκευής'], 'lap1-gains': ['LAP 1', 'Κέρδη 1ου γύρου'], 'tyre-pace': ['TYRE PACE', 'Ρυθμός ελαστικών'],
            'quali-gaps': ['QUALI GAPS', 'Κενά κατατακτήριων'], 'dirty-air': ['DIRTY AIR', 'Βρόμικος αέρας'], 'track-dominance': ['TRACK DOMINANCE', 'Κυριαρχία πίστας'],
            'pit-stops': ['PIT STOPS', 'Pit stops']
        };
        const [label, el] = tabs[url.searchParams.get('tab')] || ['STANDINGS', 'Βαθμολογία'];
        return { label, el };
    }
    return null;
}

// The tool's own page: the embed URL without its embed flag (the Tyres embed routes have no other page).
function toolOpenUrl(src) {
    const url = new URL(decodeAmp(src));
    url.searchParams.delete('embed');
    url.hash = '';
    return url.toString();
}

function renderDataBand(container, n, total, kind, src, title) {
    const label = title || kind.el;
    return `<section class="rr-data" id="data-${n}" aria-labelledby="data-${n}-title">
<div class="rr-data__inner">
<header class="rr-data__head">
<p class="rr-data__no">DATA ${pad(n)}<span>/${pad(total)}</span></p>
<p class="rr-data__kind">${kind.label} <span>· ${kind.el}</span></p>
<p class="rr-data__title" id="data-${n}-title">${escapeHtmlAttribute(decodeAmp(label))}</p>
<p class="rr-data__links"><a href="${escapeHtmlAttribute(toolOpenUrl(src))}" target="_blank" rel="noopener">Άνοιγμα εργαλείου <span aria-hidden="true">↗</span></a><a href="#after-data-${n}">Συνέχεια κειμένου <span aria-hidden="true">↓</span></a></p>
</header>
<div class="rr-data__screen">
${container}
</div>
</div>
</section>
<span class="rr-anchor" id="after-data-${n}"></span>`;
}

// The embed container inside an existing band (so a re-render renumbers instead of nesting).
function unwrapDataBand(html) {
    const open = html.indexOf('<div class="rr-data__screen">');
    if (open < 0) return null;
    const inner = html.slice(open + '<div class="rr-data__screen">'.length);
    const [container] = topLevelBlocks(inner);
    return container ? container.html : null;
}

// Word imports put a chart's <figure> inside the preceding paragraph (invalid HTML that browsers split anyway):
// lift it out so the paragraph and the figure are siblings.
function liftFigure(block) {
    const at = block.html.indexOf('<figure class="article-figure">');
    if (block.tag !== 'p' || !PLAIN_P.test(block.html) || at < 0 || !block.html.endsWith('</p>')) return [block];
    const text = block.html.slice(3, at).trim();
    const figure = block.html.slice(at, -4).trim();
    return text
        ? [{ tag: 'p', before: block.before, html: `<p>${text}</p>` }, { tag: 'figure', html: figure }]
        : [{ tag: 'figure', before: block.before, html: figure }];
}

const PLAIN_P = /^<p>/;
const ENDS_LIKE_SENTENCE = /[.,:;!?…»"”·)]$/;
// A section an earlier build inferred (an R3 paragraph with a heading role, or an inferred h2) goes back to the paragraph
// it was written as, so every build judges it afresh and an inferred h2 is never mistaken for an authored one.
const INFERRED_SECTION = /^<(p|h2)(?: id="section-\d+")? class="rr-subhead"(?: role="heading" aria-level="2")?>([\s\S]*)<\/\1>$/;
const unpromote = block => {
    const m = INFERRED_SECTION.exec(block.html);
    return m ? { ...block, tag: 'p', html: `<p>${m[2]}</p>` } : block;
};
// The page title is the only h1. A few Word imports used h1 for their top-level sections; those are h2s (the article
// styles have always drawn body h1 and h2 alike), attributes and content unchanged.
const demoteBodyH1 = block => (block.tag === 'h1' && /<\/h1>$/.test(block.html)
    ? { ...block, tag: 'h2', fromH1: true, html: `<h2${block.html.slice(3, -5)}</h2>` } : block);
// A heading is a navigable section only with words of its own and no media: Word imports leave empty headings around
// bookmark anchors, and one wraps a figure. Those keep their markup and id but get no running-order entry.
const navigable = html => !/<(figure|img|picture|iframe|video)\b/.test(html) && Boolean(textOf(html));
const FULL_PARAGRAPH = 100;
const ENDS_SENTENCE = /[.!;?…»”"]$/;
const BOLD_LINE = /^<p>\s*<(strong|b)>(?:(?!<\/?(?:strong|b)>)[\s\S])*<\/\1>\s*<\/p>$/;

// Editorial section titles that older imports carry as plain paragraphs. Authored h2/h3 are the authority: a body
// that has any gets no promotions. Otherwise a line is a section title only when the structure around it says so:
//  - a short, unpunctuated line (no link, image, line break, table cells or odds) that opens a full paragraph;
//  - not inside a run of data lines: the paragraph before it is not a lead-in ending in ":" (the line would be that
//    list's first item) and not itself a short line without sentence punctuation (a specification, results or
//    standings list, where the last item happens to precede a long paragraph). A short closing sentence of the
//    previous section ("Αυτό δεν ήταν παρά μόνο η αρχή.") is prose and does not break the pattern, and neither does
//    a line the author set entirely in bold (heading formatting from the Word import: a heading pair, not a list);
//  - and part of a recurring structure: an article needs at least two such sections; one alone stays a paragraph.
function subheadIndexes(blocks) {
    if (blocks.some(block => /^h[23]$/.test(block.tag))) return [];
    const found = blocks.map((block, i) => {
        const prev = blocks[i - 1];
        const next = blocks[i + 1];
        if (i === 0 || !PLAIN_P.test(block.html) || !next || !PLAIN_P.test(next.html)) return -1;
        if (/<(a|img|br)\b/.test(block.html) || /[|\t]|\d,\d/.test(block.html)) return -1;
        const text = textOf(block.html);
        if (text.length < 3 || text.length > 90 || ENDS_LIKE_SENTENCE.test(text)) return -1;
        if (textOf(next.html).length < FULL_PARAGRAPH) return -1;
        if (prev.tag === 'p') {
            const prevText = textOf(prev.html);
            if (/:$/.test(prevText)) return -1;
            if (prevText.length < FULL_PARAGRAPH && !ENDS_SENTENCE.test(prevText) && !BOLD_LINE.test(prev.html)) return -1;
        }
        return i;
    }).filter(i => i >= 0);
    return found.length >= 2 ? found : [];
}

// Technical charts keep a legible width on phones: the raster sits in its own labelled, keyboard-focusable
// horizontal scroller (the page itself never scrolls sideways). Idempotent.
function wrapChartScroller(chartHtml) {
    if (chartHtml.includes('class="rr-chart__scroll"')) return chartHtml;
    const title = textOf((/<p class="rr-chart__title">([\s\S]*?)<\/p>/.exec(chartHtml) || [])[1]);
    const label = escapeHtmlAttribute(`Γράφημα${title ? `: ${decodeAmp(title)}` : ''} (οριζόντια κύλιση)`);
    return chartHtml.replace(/(<figure class="article-figure">\s*)(<picture>[\s\S]*?<\/picture>|<img\b[^>]*>)/,
        `$1<div class="rr-chart__scroll" tabindex="0" role="region" aria-label="${label}">$2</div>`);
}

// Images carry their own pixel size, so CSS never enlarges them past it: with width descriptors a browser sizes an
// image to its `sizes` slot (a 275px file in a "770px" slot draws 770px wide). Figures get --nat-w, gallery frames
// --nat-h (the filmstrip shares one height). No gallery frame loads before it nears the viewport (the first used to
// load eagerly although the strip sits below the fold). Idempotent: only this build's own style is replaced.
const OWN_STYLE = /\sstyle="--nat-[hw]: \d+px"/;
function naturalSizes(html) {
    const sized = (img, prop, attr) => {
        const value = Number((new RegExp(`\\s${attr}="(\\d+)"`).exec(img) || [])[1]);
        const tag = img.replace(OWN_STYLE, '');
        return value && !/\sstyle="/.test(tag) ? tag.replace(/>$/, ` style="--nat-${prop}: ${value}px">`) : tag;
    };
    // A frame is drawn at its own ratio in a strip 220px tall on phones and at most 400px tall (never past its own
    // pixels, never wider than 720px); `sizes` asks for that width instead of the article column's 770px.
    const frameSizes = img => {
        const w = Number((/\swidth="(\d+)"/.exec(img) || [])[1]);
        const h = Number((/\sheight="(\d+)"/.exec(img) || [])[1]);
        if (!w || !h) return null;
        const at = height => Math.min(720, Math.round(Math.min(height, h) * w / h));
        return `(max-width: 733px) ${at(220)}px, ${at(400)}px`;
    };
    return html
        .replace(/(<div class="gallery-slide[^"]*"[^>]*>\s*(?:<picture>[\s\S]*?)?)(<img\b[^>]*>)/g, (match, before, img) => {
            const sizes = frameSizes(img);
            const set = text => (sizes ? text.replace(/\ssizes="[^"]*"/g, ` sizes="${sizes}"`) : text);
            return set(before) + set(sized(img.replace(/\bloading="eager"(\s+fetchpriority="low")?/, 'loading="lazy"'), 'h', 'height'));
        })
        .replace(/(<figure class="article-figure">\s*(?:<div class="rr-chart__scroll"[^>]*>\s*)?(?:<picture>[\s\S]*?)?)(<img\b[^>]*\bclass="article-content-img"[^>]*>)/g, (match, before, img) =>
            before + sized(img, 'w', 'width'));
}

function transformBody(rawHtml) {
    let figureNo = 0;
    // Generic captions count the figures a reader sees (they used to print the file's slot number, starting at 3).
    const html = naturalSizes(String(rawHtml || '')
        .replace(/<figcaption>Image (\d+)<\/figcaption>/g, '<figcaption>Εικ. $1</figcaption>')
        .replace(/<figcaption>Εικ\. \d+/g, () => `<figcaption>Εικ. ${++figureNo}`));
    let blocks = topLevelBlocks(html)
        .map(unpromote)
        .map(demoteBodyH1)
        .flatMap(liftFigure)
        .filter(block => !(block.tag === 'p' && !textOf(block.html) && !/<(img|iframe|figure|svg|video|picture)\b/.test(block.html)));

    // Data bands, numbered in reading order.
    const tools = blocks.map(block => {
        const container = block.tag === 'section' && hasClass(block.html, 'rr-data') ? unwrapDataBand(block.html)
            : block.tag === 'div' && hasClass(block.html, 'embed-container') ? block.html : null;
        const iframe = container && /<iframe\b[^>]*>/.exec(container);
        const src = iframe && (/\bsrc="([^"]+)"/.exec(iframe[0]) || [])[1];
        const kind = src && toolKind(src);
        return kind ? { container, src, kind, title: (/\btitle="([^"]*)"/.exec(iframe[0]) || [])[1] || '' } : null;
    });
    const total = tools.filter(Boolean).length;
    let n = 0;
    blocks = blocks.map((block, i) => {
        const tool = tools[i];
        if (!tool) return block.tag === 'span' && hasClass(block.html, 'rr-anchor') ? null : block;
        n += 1;
        return { before: block.before, tag: 'section', html: renderDataBand(tool.container, n, total, tool.kind, tool.src, tool.title), data: { n, label: tool.kind.label } };
    }).filter(Boolean);

    // Chart panels: a short title paragraph, a one- or two-line description, then the chart figure.
    for (let i = 2; i < blocks.length; i += 1) {
        const [title, desc, figure] = [blocks[i - 2], blocks[i - 1], blocks[i]];
        if (figure.tag !== 'figure' || !hasClass(figure.html, 'article-figure')) continue;
        if (!PLAIN_P.test(title.html) || !PLAIN_P.test(desc.html)) continue;
        const titleText = textOf(title.html);
        if (!titleText || titleText.length > 90 || ENDS_LIKE_SENTENCE.test(titleText) || textOf(desc.html).length > 280) continue;
        const chart = `<div class="rr-chart">\n${title.html.replace(/^<p>/, '<p class="rr-chart__title">')}\n${desc.html.replace(/^<p>/, '<p class="rr-chart__desc">')}\n${figure.html}\n</div>`;
        blocks.splice(i - 2, 3, { tag: 'div', before: title.before, html: chart });
        i -= 2;
    }
    blocks.forEach(block => {
        if (block.tag === 'div' && hasClass(block.html, 'rr-chart')) block.html = wrapChartScroller(block.html);
    });

    // Paragraph subheads (archive entries imported without real headings) become native h2 sections, text and inline
    // markup unchanged. The class marks them as inferred, so the next build can tell them from authored headings.
    subheadIndexes(blocks).forEach(i => {
        blocks[i] = { ...blocks[i], tag: 'h2', html: `<h2 class="rr-subhead">${blocks[i].html.slice(3, -4)}</h2>` };
    });

    // Section ids. An id already in the body is kept. New ids follow the former contents list's scheme (section-N over
    // the h2/h3 in order), so existing anchors keep their numbers; former body h1s are numbered after them, and a new
    // id never collides with one the body already uses.
    const used = new Set(blocks.flatMap(block => [...block.html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1])));
    const setId = (block, id) => { used.add(id); block.html = block.html.replace(/^<(h[23])\b/, `<$1 id="${id}"`); };
    const headings = blocks.filter(block => /^h[23]$/.test(block.tag));
    headings.filter(block => !block.fromH1).forEach((block, i) => {
        let k = i + 1;
        if (/\bid="/.test(openTag(block.html))) return;
        while (used.has(`section-${k}`)) k += 1;
        setId(block, `section-${k}`);
    });
    headings.filter(block => block.fromH1 && !/\bid="/.test(openTag(block.html))).forEach(block => {
        let k = headings.filter(other => !other.fromH1).length + 1;
        while (used.has(`section-${k}`)) k += 1;
        setId(block, `section-${k}`);
    });
    const entries = [];
    let shown = 0;
    blocks.forEach(block => {
        if (block.data) { entries.push({ type: 'data', id: `data-${block.data.n}`, label: block.data.label }); return; }
        if (!/^h[23]$/.test(block.tag) || !navigable(block.html)) return;
        shown += 1;
        entries.push({ type: 'section', id: /\bid="([^"]+)"/.exec(openTag(block.html))[1], n: shown, label: textOf(block.html) });
    });

    const trailing = (/\s*$/.exec(html) || [''])[0];
    return {
        html: joinBlocks(blocks) + trailing,
        entries,
        sections: shown,
        dataCount: total
    };
}

// The running order: sections and data stops as they occur. Empty when the article has neither.
// Section labels are the headings' own HTML text with tags removed (entities intact), so they are not re-escaped.
function renderRunningOrder(entries) {
    return entries.map(entry => entry.type === 'data'
        ? `<li class="is-data"><a href="#${entry.id}"><span class="rr-ro__no">DATA</span><span class="rr-ro__label">${entry.label}</span></a></li>`
        : `<li><a href="#${entry.id}"><span class="rr-ro__no">${pad(entry.n)}</span><span class="rr-ro__label">${entry.label}</span></a></li>`).join('\n');
}

// Cover composition from the photograph itself: a full-bleed band for wide landscape sources, a split cover for
// mid-size landscape ones, and an inset (shown no larger than its own pixels, never cropped) for small or portrait files.
function coverVariant(width, height) {
    const w = Number(width) || 0;
    const h = Number(height) || 0;
    if (!w || !h) return 'inset';
    if (w >= 1400 && w / h >= 1.3) return 'bleed';
    if (w >= 1000 && h >= 620 && w / h >= 1.2) return 'split';
    return 'inset';
}

const COVER_SIZES = {
    bleed: '100vw',
    split: '(max-width: 899px) 100vw, 50vw',
    inset: '(max-width: 899px) 100vw, 50vw'
};

module.exports = { topLevelBlocks, toolKind, toolOpenUrl, transformBody, renderRunningOrder, coverVariant, COVER_SIZES };
