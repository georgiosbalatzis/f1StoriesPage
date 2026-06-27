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

function esc(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function iconHTML(iconName, extraClass) {
    const classes = ['icon'];
    if (extraClass) classes.push(extraClass);
    return '<svg class="' + esc(classes.join(' ')) + '" aria-hidden="true"><use href="#' + esc(iconName || 'fa-circle-info') + '"/></svg>';
}

export function loadingCardHTML(options) {
    const config = options || {};
    const wrapperClass = config.wrapperClass || '';
    const stateClass = config.stateClass || 'standings-loading';
    const message = config.message || 'Loading...';
    const content = '<div class="' + esc(stateClass) + '">' + iconHTML(config.icon || 'fa-circle-notch', 'fa-spin') + '<p>' + esc(message) + '</p></div>';
    return wrapperClass ? '<div class="' + esc(wrapperClass) + '">' + content + '</div>' : content;
}

export function messageCardHTML(options) {
    const config = options || {};
    const wrapperClass = config.wrapperClass || '';
    const stateClass = config.stateClass || 'standings-empty';
    let html = '<div class="' + esc(stateClass) + '">'
        + iconHTML(config.icon || 'fa-circle-info')
        + '<p>' + esc(config.message || '') + '</p>';

    if (config.detail) {
        html += '<p class="' + esc(config.detailClass || 'standings-message-detail') + '">' + esc(config.detail) + '</p>';
    }

    if (config.retryAction) {
        html += '<button class="' + esc(config.retryClass || 'retry-btn') + '" type="button" data-standings-retry="' + esc(config.retryAction) + '">'
            + iconHTML(config.retryIcon || 'fa-redo')
            + ' ' + esc(config.retryLabel || 'Retry')
            + '</button>';
    }

    html += '</div>';
    return wrapperClass ? '<div class="' + esc(wrapperClass) + '">' + html + '</div>' : html;
}

export function renderTrustedHtml(target, html, reason, afterRender) {
    setTrustedHtml(target, html, reason);
    if (typeof afterRender === 'function') afterRender();
}

export function renderLoading(target, options, reason) {
    renderTrustedHtml(target, loadingCardHTML(options), reason || 'standings loading state');
}

export function renderMessage(target, options, reason, afterRender) {
    renderTrustedHtml(target, messageCardHTML(options), reason || 'standings message state', afterRender);
}
