// Attribute reading for approval and publication checks (entity hubs, collections, the public-artifact validator).
// Quote-aware: a `>` or `href=` inside a quoted value is text. Quoted, unquoted and spaced `=` forms alike; the first
// occurrence of an attribute wins (as in HTML); character references are decoded. Dependency-free on purpose.
const ENTITIES = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };
const decodeEntities = value => value.replace(/&(?:#(\d+)|#x([0-9a-f]+)|(amp|quot|apos|lt|gt));?/gi, (match, dec, hex, name) => {
    try { return dec ? String.fromCodePoint(Number(dec)) : hex ? String.fromCodePoint(parseInt(hex, 16)) : ENTITIES[name.toLowerCase()]; } catch (_) { return match; }
});

// Each <name ...> opening tag in `html` as a lowercase-keyed attribute map.
function tagAttributes(html, name) {
    return [...html.matchAll(new RegExp(`<${name}\\b((?:[^>"']|"[^"]*"|'[^']*')*)>`, 'gi'))].map(([, attrs]) => {
        const out = {};
        for (const [, key, double, single, bare] of attrs.matchAll(/([^\s"'=<>/`]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
            const k = key.toLowerCase();
            if (!Object.hasOwn(out, k)) out[k] = decodeEntities(double ?? single ?? bare ?? '');
        }
        return out;
    });
}

// One canonical equal to `canonical`, no robots/googlebot noindex; `direct` also forbids a meta refresh.
function pageIsIndexable(html, canonical, { direct = false } = {}) {
    const canonicals = tagAttributes(html, 'link').filter(tag => tag.rel?.toLowerCase().split(/\s+/).includes('canonical'));
    const metas = tagAttributes(html, 'meta');
    const blocked = metas.some(tag =>
        ['robots', 'googlebot'].includes(tag.name?.toLowerCase()) && /(?:^|[,\s])(?:noindex|none)(?:$|[,\s])/i.test(tag.content || ''));
    const refresh = direct && metas.some(tag => tag['http-equiv']?.toLowerCase() === 'refresh');
    return canonicals.length === 1 && canonicals[0].href === canonical && !blocked && !refresh;
}

module.exports = { decodeEntities, tagAttributes, pageIsIndexable };
