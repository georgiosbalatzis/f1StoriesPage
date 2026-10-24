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

    // Non-blocking checks for headline hygiene: a repeated adjacent word, a
    // shouted (mostly capitals) title, or emoji in the title or heading lines.
    // titleIssues() returns stable codes; titleWarnings() renders them in Greek.
    var EMOJI = /\p{Extended_Pictographic}/u;
    function titleIssues(title, body) {
        var text = String(title || '').trim();
        var issues = [];
        var repeat = text.match(/(^|[^\p{L}\p{N}])([\p{L}\p{N}]{2,})\s+\2(?![\p{L}\p{N}])/iu);
        if (repeat) issues.push({ code: 'repeat', word: repeat[2] });
        var letters = text.replace(/[^\p{L}]/gu, '');
        var upper = letters.replace(/[^\p{Lu}]/gu, '');
        if (letters.length >= 8 && upper.length / letters.length > 0.6) issues.push({ code: 'caps' });
        if (EMOJI.test(text)) issues.push({ code: 'emoji' });
        var headings = String(body || '').split('\n').filter(function (line) { return /^#{1,6}\s/.test(line.trim()); });
        if (headings.some(function (line) { return EMOJI.test(line); })) issues.push({ code: 'heading-emoji' });
        return issues;
    }

    var TITLE_MESSAGES = {
        repeat: function (issue) { return 'Ο τίτλος επαναλαμβάνει τη λέξη «' + issue.word + '».'; },
        caps: function () { return 'Ο τίτλος είναι κυρίως κεφαλαία.'; },
        emoji: function () { return 'Ο τίτλος περιέχει emoji.'; },
        'heading-emoji': function () { return 'Κάποιοι υπότιτλοι περιέχουν emoji.'; }
    };

    function titleWarnings(title, body) {
        return titleIssues(title, body).map(function (issue) { return TITLE_MESSAGES[issue.code](issue); });
    }

    // Distinct F1 Stories destinations the body links to with [text](url): site paths and f1-stories.gr URLs, never
    // fragments or other sites. The pattern is inline-markup.js's LINK_PATTERN (the syntax the build renders).
    var LINK_PATTERN = /(?<!!)\[([^\]\n]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g;
    function internalLinkCount(body) {
        var seen = {};
        String(body || '').replace(LINK_PATTERN, function (match, label, url) {
            var site = /^https?:\/\/(?:www\.)?f1-stories\.gr(\/[^?#]*)?/i.exec(url);
            var target = site ? site[1] || '/' : /^\/(?!\/)/.test(url) ? url.split(/[?#]/)[0] : '';
            if (target) seen[target.replace(/\/index\.html$/, '/')] = true;
            return match;
        });
        return Object.keys(seen).length;
    }

    // Advisory: 2–3 contextual links to earlier stories, sections or topic hubs (blog-module/build/body-links.js).
    function linkWarnings(body) {
        var count = internalLinkCount(body);
        if (!String(body || '').trim() || count >= 2) return [];
        return [(count ? 'Ένας μόνο εσωτερικός σύνδεσμος' : 'Κανένας εσωτερικός σύνδεσμος') + ' στο κείμενο. Προτείνονται 2–3 όπου βοηθούν τον αναγνώστη: προς προηγούμενα άρθρα, ενότητες ή θέματα του F1 Stories, π.χ. [Τεχνικά](/blog-module/blog/section/technical/).'];
    }

    // The article description (`excerpt:`) contract of blog-module/build/description.js: the same normalisation,
    // grapheme count, issue codes and messages, so the tools block exactly what the build rejects (parity is tested).
    var DESCRIPTION_MAX = 155;
    var segmenter = typeof Intl === 'object' && Intl.Segmenter ? new Intl.Segmenter('el', { granularity: 'grapheme' }) : null;
    function normalizeExcerpt(value) {
        return String(value == null ? '' : value).replace(/[­​-‍⁠﻿]/g, '').replace(/\s+/g, ' ').trim();
    }
    function descriptionLength(value) {
        var text = normalizeExcerpt(value);
        return segmenter ? Array.from(segmenter.segment(text)).length : Array.from(text).length;
    }
    function excerptIssues(value) {
        var text = normalizeExcerpt(value);
        if (!text) return [{ code: 'missing' }];
        var issues = [];
        if (/<[a-z!/?]/i.test(text) || /&(?:#\d|#x[\da-f]|[a-z][a-z\d]*;)/i.test(text)) issues.push({ code: 'markup' });
        if ((text.match(/[\p{L}\p{N}]+/gu) || []).length < 3) issues.push({ code: 'short' });
        var length = descriptionLength(text);
        if (length > DESCRIPTION_MAX) issues.push({ code: 'long', length: length });
        return issues;
    }
    var EXCERPT_MESSAGES = {
        missing: function () { return 'Λείπει η περιγραφή άρθρου (excerpt). Γράψε μια σύντομη περιγραφή έως ' + DESCRIPTION_MAX + ' χαρακτήρες.'; },
        markup: function () { return 'Η περιγραφή περιέχει HTML ή κωδικούς χαρακτήρων (π.χ. &amp;). Γράψε απλό κείμενο, με τους χαρακτήρες όπως είναι.'; },
        short: function () { return 'Η περιγραφή είναι πολύ σύντομη. Γράψε τουλάχιστον μία πρόταση για το περιεχόμενο του άρθρου.'; },
        long: function (issue) { return 'Η περιγραφή έχει ' + issue.length + ' χαρακτήρες· το όριο είναι ' + DESCRIPTION_MAX + '. Συντόμευσέ τη κατά ' + (issue.length - DESCRIPTION_MAX) + '.'; }
    };
    function excerptMessage(issue) {
        return EXCERPT_MESSAGES[issue.code](issue);
    }

    // Removes emoji (and flag/variation-selector/ZWJ residue) from a title.
    function stripEmoji(title) {
        return String(title || '')
            .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\uFE0F\u200D]/gu, '')
            .replace(/\s{2,}/g, ' ')
            .replace(/\s+([!?.;:,])/g, '$1')
            .trim();
    }

    global.F1S_AUTHOR_ARTICLE_SOURCE = {
        stripEmoji: stripEmoji,
        titleIssues: titleIssues,
        titleWarnings: titleWarnings,
        internalLinkCount: internalLinkCount,
        linkWarnings: linkWarnings,
        DESCRIPTION_MAX: DESCRIPTION_MAX,
        normalizeExcerpt: normalizeExcerpt,
        descriptionLength: descriptionLength,
        excerptIssues: excerptIssues,
        excerptMessage: excerptMessage,
        buildSourceText: buildSourceText,
        normalizeZipPath: normalizeZipPath,
        parseSourceText: parseSourceText
    };
})(window);
