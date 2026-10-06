// Embed-mode helpers shared by the shell and the tab modules.
//
// An embed (?embed=1) renders the focused element only, so long lists are capped and end with a link to
// the full interactive view. The link href is filled by the shell (it knows the current URL state) when the
// reader reaches for it; see wireEmbedCapLinks().

export const EMBED_ROW_CAP = 10;

export function isEmbedSearch(search) {
    return new URLSearchParams(search || '').get('embed') === '1';
}

export const IS_EMBED = typeof window !== 'undefined' && !!window.location && isEmbedSearch(window.location.search);

export function capEmbedRows(items, cap) {
    const list = Array.isArray(items) ? items : [];
    return IS_EMBED ? list.slice(0, cap || EMBED_ROW_CAP) : list;
}

// Link row for a list that was cut at `cap` of `total` rows; empty when nothing is hidden.
export function embedCapLinkHTML(total, cap) {
    const hidden = (Number(total) || 0) - (cap || EMBED_ROW_CAP);
    if (!IS_EMBED || hidden <= 0) return '';
    return '<a class="embed-cap-link" data-embed-cap href="/standings/" target="_top">Δες όλο τον πίνακα (+' + hidden + ') →</a>';
}

// Point every cap link at the full view of the same state, refreshed whenever one is about to be used.
export function wireEmbedCapLinks(getHref) {
    const refresh = function(event) {
        const link = event.target && event.target.closest ? event.target.closest('[data-embed-cap]') : null;
        if (link) link.setAttribute('href', getHref());
    };
    ['pointerdown', 'focusin', 'mouseover', 'touchstart', 'contextmenu', 'auxclick'].forEach(function(type) {
        document.addEventListener(type, refresh, { passive: true });
    });
    // Set an initial href too, so the links are valid even for assistive tech that never fires the above.
    new MutationObserver(function() {
        document.querySelectorAll('[data-embed-cap]:not([data-embed-cap-ready])').forEach(function(link) {
            link.setAttribute('data-embed-cap-ready', '');
            link.setAttribute('href', getHref());
        });
    }).observe(document.body, { childList: true, subtree: true });
}
