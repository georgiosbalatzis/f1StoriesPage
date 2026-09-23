(function (global) {
    'use strict';

    function createSvgIcon(iconId, extraClass) {
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', extraClass ? 'icon ' + extraClass : 'icon');
        svg.setAttribute('aria-hidden', 'true');
        var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', '#' + iconId);
        svg.appendChild(use);
        return svg;
    }

    function setIconText(el, iconId, text, options) {
        options = options || {};
        var nodes = [createSvgIcon(iconId, options.iconClass || '')];
        if (text) nodes.push(document.createTextNode(' ' + text));
        el.replaceChildren.apply(el, nodes);
        return el;
    }

    function setBusyText(el, text) {
        return setIconText(el, 'fa-spinner', text, { iconClass: 'fa-spin' });
    }

    function createStatusMessage(className, text, iconId, iconClass) {
        var div = document.createElement('div');
        div.className = className;
        if (iconId) {
            div.appendChild(createSvgIcon(iconId, iconClass));
            div.appendChild(document.createTextNode(' '));
        }
        div.appendChild(document.createTextNode(text || ''));
        return div;
    }

    function createMetaItem(iconId, text) {
        var span = document.createElement('span');
        span.appendChild(createSvgIcon(iconId));
        span.appendChild(document.createTextNode(' ' + (text || '')));
        return span;
    }

    function createIconTextButton(className, title, iconId, text) {
        var button = document.createElement('button');
        button.className = className;
        button.title = title;
        return setIconText(button, iconId, text);
    }

    function setTrustedHtml(el, html, reason) {
        if (!reason) {
            throw new Error('setTrustedHtml requires a short reason for the raw HTML sink.');
        }
        el.innerHTML = String(html == null ? '' : html);
        return el;
    }

    global.F1S_AUTHOR_DOM_TOOLS = {
        createIconTextButton: createIconTextButton,
        createMetaItem: createMetaItem,
        createStatusMessage: createStatusMessage,
        createSvgIcon: createSvgIcon,
        setBusyText: setBusyText,
        setIconText: setIconText,
        setTrustedHtml: setTrustedHtml
    };
})(window);
