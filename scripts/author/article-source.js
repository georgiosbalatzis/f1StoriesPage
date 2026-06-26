(function (global) {
    'use strict';

    function normalizeZipPath(path) {
        return String(path || '')
            .replace(/\\/g, '/')
            .replace(/^\.\/+/, '')
            .replace(/^\/+/, '');
    }

    function headerToken(value, fallback, options) {
        var token = value || fallback;
        return options && options.decodeHeaderTokens ? token.replace(/-/g, ' ') : token;
    }

    function parseSourceText(text, options) {
        var lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
        var first = (lines[0] || '').trim().split(/\s+/);
        var tag = headerToken(first[0], 'F1', options);
        var category = headerToken(first[1], 'Racing', options);
        var titleIdx = -1;

        for (var i = 1; i < lines.length; i++) {
            if (lines[i].trim() !== '') {
                titleIdx = i;
                break;
            }
        }

        var title = titleIdx !== -1 ? lines[titleIdx].trim() : '';
        var body = '';
        if (titleIdx !== -1) {
            var rest = lines.slice(titleIdx + 1);
            while (rest.length && rest[0].trim() === '') rest.shift();
            body = rest.join('\n').replace(/\s+$/, '');
        }

        return { tag: tag, category: category, title: title, body: body };
    }

    function buildSourceText(tag, category, title, body) {
        var safeTag = (tag || 'F1').replace(/\s+/g, '-');
        var safeCategory = (category || 'Racing').replace(/\s+/g, '-');
        var safeTitle = (title || 'Untitled').replace(/\r/g, '');
        var safeBody = (body || '').replace(/\r/g, '');
        return safeTag + ' ' + safeCategory + '\n\n' + safeTitle + '\n\n' + safeBody + '\n';
    }

    global.F1S_AUTHOR_ARTICLE_SOURCE = {
        buildSourceText: buildSourceText,
        normalizeZipPath: normalizeZipPath,
        parseSourceText: parseSourceText
    };
})(window);
