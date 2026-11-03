// HTML reading for approval and publication checks (entity hubs, collections, the public-artifact validator).
// A small tokenizer shaped on the HTML spec's tag/attribute states, not a regex scrape: comments, bogus comments and the
// raw text of script/style/textarea/title are skipped; quotes open a value only right after `=`; the first occurrence of
// an attribute wins; character references are decoded. An attribute it cannot decode is listed in the tag's
// `unresolved`, and callers fail closed when that attribute matters. Dependency-free on purpose (the validator runs in the public build).
const ENTITIES = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };
const RAW_TEXT = new Set(['script', 'style', 'textarea', 'title']);

function decode(value) {
    let ambiguous = false;
    const text = value.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z][a-z0-9]*))(;?)/gi, (match, dec, hex, name, semi, offset, all) => {
        try {
            if (dec || hex) return String.fromCodePoint(dec ? Number(dec) : parseInt(hex, 16));
        } catch (_) { ambiguous = true; return match; }
        // In an attribute, `&name` without `;` before `=` or an alphanumeric stays literal (`?x=1&foo=2`).
        if (!semi && /[=a-z0-9]/i.test(all[offset + match.length] || '')) return match;
        if (Object.hasOwn(ENTITIES, name)) return ENTITIES[name];
        ambiguous = true; // a named reference outside the table (e.g. &sol;, &Tab;): never guess
        return match;
    });
    return { text, ambiguous };
}
const decodeEntities = value => decode(value).text;

// Attributes of one tag, from just after its name; returns { attrs, unresolved, end }: `unresolved` lists the attribute
// names whose value held an undecodable reference, `end` is the index after `>`.
function readAttributes(html, i) {
    const attrs = {};
    const unresolved = [];
    const n = html.length;
    while (i < n) {
        while (i < n && /[\s/]/.test(html[i])) i++;
        if (i >= n || html[i] === '>') break;
        let name = '';
        do { name += html[i++]; } while (i < n && !/[\s/>=]/.test(html[i]));
        while (i < n && /\s/.test(html[i])) i++;
        let value = '';
        if (html[i] === '=') {
            i++;
            while (i < n && /\s/.test(html[i])) i++;
            const quote = html[i];
            if (quote === '"' || quote === "'") {
                const close = html.indexOf(quote, i + 1);
                value = html.slice(i + 1, close < 0 ? n : close);
                i = close < 0 ? n : close + 1;
            } else {
                while (i < n && !/[\s>]/.test(html[i])) value += html[i++];
            }
        }
        const key = name.toLowerCase();
        if (!Object.hasOwn(attrs, key)) {
            const decoded = decode(value);
            attrs[key] = decoded.text;
            if (decoded.ambiguous) unresolved.push(key);
        }
    }
    return { attrs, unresolved, end: Math.min(i + 1, n) };
}

// Opening ({ name, attrs, unresolved, start: index of `<` }) and closing ({ name, close: true }) tags in document order.
function tags(html) {
    const out = [];
    const n = html.length;
    let i = 0;
    while ((i = html.indexOf('<', i)) >= 0) {
        if (html.startsWith('<!--', i)) {
            // `<!-->` and `<!--->` close at once, as in HTML.
            const abrupt = /^<!---?>/.exec(html.slice(i, i + 6));
            const end = abrupt ? -1 : html.indexOf('-->', i + 4);
            i = abrupt ? i + abrupt[0].length : end < 0 ? n : end + 3;
        } else if (/^<[!?]/.test(html.slice(i, i + 2)) || /^<\/[^a-z]/i.test(html.slice(i, i + 3))) {
            const end = html.indexOf('>', i); // doctype and bogus comments
            i = end < 0 ? n : end + 1;
        } else if (/^<\/[a-z]/i.test(html.slice(i, i + 3))) {
            const match = /^<\/([^\s/>]+)/.exec(html.slice(i));
            const end = html.indexOf('>', i);
            out.push({ name: match[1].toLowerCase(), close: true });
            i = end < 0 ? n : end + 1;
        } else if (/^<[a-z]/i.test(html.slice(i, i + 2))) {
            const match = /^<([^\s/>]+)/.exec(html.slice(i));
            const name = match[1].toLowerCase();
            const { attrs, unresolved, end } = readAttributes(html, i + match[0].length);
            out.push({ name, attrs, unresolved, start: i });
            i = end;
            if (RAW_TEXT.has(name)) {
                const close = new RegExp(`</${name}(?=[\\s/>])`, 'ig');
                close.lastIndex = i;
                const found = close.exec(html);
                if (!found) break;
                const gt = html.indexOf('>', found.index);
                out.push({ name, close: true });
                i = gt < 0 ? n : gt + 1;
            }
        } else i++;
    }
    return out;
}

// Each <name ...> opening tag in `html` as a lowercase-keyed attribute map (comments and raw text excluded).
const tagAttributes = (html, name) => tags(html).filter(tag => !tag.close && tag.name === name).map(tag => tag.attrs);

const ROBOTS = ['robots', 'googlebot'];
// An undecodable value that could change the decision: a link's rel/href, a meta's name/http-equiv, a robots meta's content.
const undecidable = tag => (tag.name === 'link' && tag.unresolved.some(key => ['rel', 'href'].includes(key)))
    || (tag.name === 'meta' && (tag.unresolved.some(key => ['name', 'http-equiv'].includes(key))
        || (tag.unresolved.includes('content') && ROBOTS.includes(tag.attrs.name?.toLowerCase()))));

// One canonical equal to `canonical`, no robots/googlebot noindex; `direct` also forbids a meta refresh. A <base> or an
// undecidable link/meta is never accepted.
function pageIsIndexable(html, canonical, { direct = false } = {}) {
    const all = tags(html).filter(tag => !tag.close);
    if (all.some(tag => tag.name === 'base' || undecidable(tag))) return false;
    const canonicals = all.filter(tag => tag.name === 'link' && tag.attrs.rel?.toLowerCase().split(/\s+/).includes('canonical'));
    const metas = all.filter(tag => tag.name === 'meta').map(tag => tag.attrs);
    const blocked = metas.some(tag =>
        ROBOTS.includes(tag.name?.toLowerCase()) && /(?:^|[,\s])(?:noindex|none)(?:$|[,\s])/i.test(tag.content || ''));
    const refresh = direct && metas.some(tag => tag['http-equiv']?.toLowerCase() === 'refresh');
    return canonicals.length === 1 && canonicals[0].attrs.href === canonical && !blocked && !refresh;
}

module.exports = { decodeEntities, tags, tagAttributes, pageIsIndexable };
