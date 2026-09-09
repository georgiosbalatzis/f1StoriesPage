(function (global) {
    'use strict';

    function normalizeZipPath(path) {
        return String(path || '')
            .replace(/\\/g, '/')
            .replace(/^\.\/+/, '')
            .replace(/^\/+/, '');
    }

    function parseSourceText(text, options) {
        var raw = String(text || '').replace(/\r\n?/g, '\n').trimStart();
        var frontmatter = raw.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
        var metadata = {};
        if (frontmatter) {
            frontmatter[1].split('\n').forEach(function (line) {
                var separator = line.indexOf(':');
                if (separator !== -1) {
                    metadata[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
                }
            });
            var record = Object.assign({}, metadata, { id: options && options.id });
            if (Object.prototype.hasOwnProperty.call(metadata, 'categories') || global.F1S_TAXONOMY.isPublicCategory(metadata.category)) {
                record.categories = global.F1S_TAXONOMY.normalizeCategories(metadata.categories || metadata.category);
            }
            var taxonomy = global.F1S_TAXONOMY.getPostTaxonomy(record);
            return {
                tag: taxonomy.tags.join(', '),
                tags: taxonomy.tags,
                category: taxonomy.category,
                categories: taxonomy.categories,
                metadata: metadata,
                title: metadata.title || '',
                body: raw.slice(frontmatter[0].length).replace(/^\n+/, '').replace(/\s+$/, '')
            };
        }

        var lines = raw.split('\n');
        var first = (lines[0] || '').trim().match(/^(\S+)(?:\s+([\s\S]*))?$/) || [];
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

        var legacyTaxonomy = global.F1S_TAXONOMY.getPostTaxonomy({
            id: options && options.id,
            tag: first[1] || '',
            category: first[2] || '',
            title: title
        });
        return {
            tag: legacyTaxonomy.tags.join(', '),
            tags: legacyTaxonomy.tags,
            category: legacyTaxonomy.category,
            categories: legacyTaxonomy.categories,
            metadata: {},
            title: title,
            body: body
        };
    }

    function buildSourceText(tag, category, title, body, metadata) {
        if (!global.F1S_TAXONOMY.isPublicCategory(category)) {
            throw new Error('Choose a public category before saving the article.');
        }
        var safeTags = global.F1S_TAXONOMY.normalizeTags(tag).join(', ');
        var safeTitle = String(title || 'Untitled').replace(/[\r\n]+/g, ' ');
        var safeBody = (body || '').replace(/\r/g, '');
        var extraFields = Object.keys(metadata || {}).filter(function (key) {
            return ['tag', 'tags', 'category', 'categories', 'title'].indexOf(key) === -1 && /^[a-zA-Z][\w-]*$/.test(key);
        }).map(function (key) {
            return key + ': ' + String(metadata[key]).replace(/[\r\n]+/g, ' ');
        });
        return ['---', 'category: ' + category, 'tags: ' + safeTags, 'title: ' + safeTitle]
            .concat(extraFields, ['---', '', safeBody, '']).join('\n');
    }

    global.F1S_AUTHOR_ARTICLE_SOURCE = {
        buildSourceText: buildSourceText,
        normalizeZipPath: normalizeZipPath,
        parseSourceText: parseSourceText
    };
})(window);
