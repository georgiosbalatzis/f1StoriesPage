(function (global) {
    'use strict';

    function defaultThumbnailForPost(id) {
        return '/blog-module/blog-entries/' + encodeURIComponent(id || '') + '/1-card.webp';
    }

    function expandCompactPosts(data) {
        if (!data || data.v !== 2 || !Array.isArray(data.p)) return null;
        var authors = data.a || [];
        var categories = data.c || [];

        return data.p.map(function (row) {
            var id = row[0] || '';
            var categoryIndexes = Array.isArray(row[8]) ? row[8] : [];
            var categoryList = categoryIndexes.map(function (index) {
                return categories[index];
            }).filter(Boolean);
            var tag = categoryList[0] || '';
            var category = categoryList.slice(1).join(', ');

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
                tag: tag,
                category: category,
                categories: categoryList
            };
        });
    }

    function extractPosts(data) {
        var compact = expandCompactPosts(data);
        if (compact) return compact;
        if (data && Array.isArray(data.posts)) return data.posts;
        return Array.isArray(data) ? data : [];
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
            if (tag && post.tag !== tag) return false;
            if (category && post.category !== category) return false;
            if (author && post.author !== author) return false;
            if (query) {
                var haystack = (
                    (post.title || '') + ' ' +
                    (post.author || '') + ' ' +
                    (post.tag || '') + ' ' +
                    (post.category || '') + ' ' +
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
            if (post.tag) tags.add(post.tag);
            if (post.category) categories.add(post.category);
            if (post.author) authors.add(post.author);
        });

        return {
            tags: Array.from(tags).sort(),
            categories: Array.from(categories).sort(),
            authors: Array.from(authors).sort()
        };
    }

    global.F1S_AUTHOR_ARTICLE_INDEX = {
        collectFilterOptions: collectFilterOptions,
        defaultThumbnailForPost: defaultThumbnailForPost,
        expandCompactPosts: expandCompactPosts,
        extractPosts: extractPosts,
        filterPosts: filterPosts,
        sortNewestFirst: sortNewestFirst
    };
})(window);
