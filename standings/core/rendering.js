// Explicit raw HTML sink for standings templates.
//
// Use this only for local templates that are assembled by source-controlled
// renderers and escape any API/user-provided values before interpolation.
export function setTrustedHtml(target, html, reason) {
    if (!target) return;
    if (!reason || typeof reason !== 'string') {
        throw new Error('setTrustedHtml requires a short rendering reason.');
    }
    target.innerHTML = html == null ? '' : String(html);
}
