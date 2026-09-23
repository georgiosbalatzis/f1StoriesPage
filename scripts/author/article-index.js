(function (global) {
    'use strict';

    function defaultThumbnailForPost(id) {
        return '/blog-module/blog-entries/' + encodeURIComponent(id || '') + '/1-card.webp';
    }

    // Decodes a run-length flag string ("12,01" = true, true, false) into
    // one boolean per post. Returns null when absent or malformed.
    function decodeRunFlags(flags, count) {
        if (typeof flags !== 'string' || !flags) return null;
        var out = [];
        var runs = flags.split(',');
        for (var i = 0; i < runs.length; i++) {
            var marker = runs[i].charAt(0);
            var length = parseInt(runs[i].slice(1), 36);
            if ((marker !== '0' && marker !== '1') || !length || out.length + length > count) return null;
            for (var j = 0; j < length; j++) out.push(marker === '1');
        }
        return out.length === count ? out : null;
    }

    function expandCompactPosts(data) {
        if (!data || data.v !== 2 || !Array.isArray(data.p)) return null;
        var authors = data.a || [];
        var categories = data.c || [];
        var tagDictionary = data.t || [];
        var sourceFlags = decodeRunFlags(data.s, data.p.length);

        return data.p.map(function (row, rowIndex) {
            var id = row[0] || '';
            var categoryIndexes = Array.isArray(row[8]) ? row[8] : [];
            var categoryList = categoryIndexes.map(function (index) {
                return categories[index];
            }).filter(Boolean);
            var tags = (Array.isArray(row[9]) ? row[9] : []).map(function (tag) {
                return typeof tag === 'number' ? tagDictionary[tag] : tag;
            }).filter(Boolean);
            var taxonomy = global.F1S_TAXONOMY.getPostTaxonomy({ categories: categoryList, tags: tags });

            return {
                id: id,
                title: row[1] || '',
                author: authors[row[2]] || 'F1 Stories Team',
                date: row[3] || '',
                dateISO: row[3] || '',
                displayDate: row[3] || '',
                image: defaultThumbnailForPost(id),
                imageWidth: parseInt(row[4], 10) || 400,
                imageHeight: parseInt(row[5], 10) || 188,
                excerpt: row[6] || '',
                readingTime: row[7] || '',
                url: '/blog-module/blog-entries/' + encodeURIComponent(id) + '/article.html',
                tags: taxonomy.tags,
                category: taxonomy.category,
                categories: taxonomy.categories,
                // true/false from the index; null when the index predates the flag.
                hasSource: sourceFlags ? sourceFlags[rowIndex] : null
            };
        });
    }

    function extractPosts(data) {
        var compact = expandCompactPosts(data);
        if (compact) return compact;
        var posts = data && Array.isArray(data.posts) ? data.posts : (Array.isArray(data) ? data : []);
        return posts.map(function (post) {
            return Object.assign({}, post, global.F1S_TAXONOMY.getPostTaxonomy(post));
        });
    }

    function mergeInternalMetadata(posts, sourceData) {
        var metadataById = new Map();
        extractPosts(sourceData).forEach(function (post) { metadataById.set(post.id, post); });
        return (posts || []).map(function (post) {
            var source = metadataById.get(post.id);
            return Object.assign({}, post, { tags: source ? source.tags : (post.tags || []) });
        });
    }

    function sortNewestFirst(posts) {
        return (posts || []).slice().sort(function (a, b) {
            return (b.dateISO || b.date || '').localeCompare(a.dateISO || a.date || '');
        });
    }

    function filterPosts(posts, filters) {
        filters = filters || {};
        var query = String(filters.query || '').trim().toLowerCase();
        var tag = filters.tag || '';
        var category = filters.category || '';
        var author = filters.author || '';

        return (posts || []).filter(function (post) {
            if (tag && (post.tags || []).indexOf(tag) === -1) return false;
            if (category && (post.categories || [post.category]).indexOf(category) === -1) return false;
            if (author && post.author !== author) return false;
            if (query) {
                var haystack = (
                    (post.title || '') + ' ' +
                    (post.author || '') + ' ' +
                    (post.tags || []).join(' ') + ' ' +
                    (post.categories || [post.category]).join(' ') + ' ' +
                    (post.id || '')
                ).toLowerCase();
                if (haystack.indexOf(query) === -1) return false;
            }
            return true;
        });
    }

    function collectFilterOptions(posts) {
        var tags = new Set();
        var categories = new Set();
        var authors = new Set();

        (posts || []).forEach(function (post) {
            (post.tags || []).forEach(function (tag) { tags.add(tag); });
            (post.categories || [post.category]).filter(Boolean).forEach(function (category) { categories.add(category); });
            if (post.author) authors.add(post.author);
        });

        return {
            tags: Array.from(tags).sort(),
            categories: global.F1S_TAXONOMY.PUBLIC_CATEGORIES.filter(function (category) { return categories.has(category); }),
            authors: Array.from(authors).sort()
        };
    }

    var STANDARD_FOLDER = /^\d{8}(?:-\d+)?[A-Z]?$/;

    // Groups posts into the maintenance lanes Housekeeping can prove from the
    // index alone. titleIssues is article-source.js titleIssues().
    function maintenanceLanes(posts, titleIssues) {
        var lanes = { emoji: [], caps: [], repeat: [], tags: [], duplicate: [], folder: [] };
        var byTitle = new Map();
        (posts || []).forEach(function (post) {
            titleIssues(post.title, '').forEach(function (issue) {
                if (lanes[issue.code]) lanes[issue.code].push(post);
            });
            if (!(post.tags || []).length) lanes.tags.push(post);
            if (!STANDARD_FOLDER.test(post.id || '')) lanes.folder.push(post);
            var key = String(post.title || '').trim().toLowerCase();
            if (key) byTitle.set(key, (byTitle.get(key) || []).concat(post));
        });
        byTitle.forEach(function (group) { if (group.length > 1) lanes.duplicate.push(group); });
        return lanes;
    }

    global.F1S_AUTHOR_ARTICLE_INDEX = {
        STANDARD_FOLDER: STANDARD_FOLDER,
        decodeRunFlags: decodeRunFlags,
        maintenanceLanes: maintenanceLanes,
        collectFilterOptions: collectFilterOptions,
        defaultThumbnailForPost: defaultThumbnailForPost,
        expandCompactPosts: expandCompactPosts,
        extractPosts: extractPosts,
        filterPosts: filterPosts,
        mergeInternalMetadata: mergeInternalMetadata,
        sortNewestFirst: sortNewestFirst
    };
})(window);
