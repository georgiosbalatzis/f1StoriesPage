(function (root, factory) {
    'use strict';
    const taxonomy = factory();
    if (typeof module === 'object' && module.exports) module.exports = taxonomy;
    else root.F1S_TAXONOMY = taxonomy;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const PUBLIC_CATEGORIES = Object.freeze([
        'News', 'Analysis', 'Technical', 'History', 'Opinion', 'Betting', 'Drivers', 'Teams', '2026'
    ]);
    const aliases = Object.freeze({
        news: 'News', 'race news': 'News', 'f1 news': 'News',
        analysis: 'Analysis', 'race analysis': 'Analysis', 'race review': 'Analysis', head2head: 'Analysis', 'head to head': 'Analysis',
        technical: 'Technical', tech: 'Technical', technology: 'Technical', 'technical analysis': 'Technical',
        history: 'History', historical: 'History', 'racing history': 'History', 'f1 history': 'History',
        legend: 'History', legends: 'History', 'f1 legend': 'History', 'f1 legends': 'History',
        'racing legend': 'History', 'racing legends': 'History', 'le mans legends': 'History', 'wrc legend': 'History', 'mclaren history': 'History',
        opinion: 'Opinion', opinions: 'Opinion', editorial: 'Opinion', commentary: 'Opinion',
        betting: 'Betting', bet: 'Betting', betcast: 'Betting', 'bet cast': 'Betting',
        drivers: 'Drivers', driver: 'Drivers', teams: 'Teams', team: 'Teams',
        '2026': '2026', '2026 season': '2026', 'season 2026': '2026', '2026 championship': '2026', 'f1 2026': '2026'
    });
    const legacyTeams = new Set([
        'ferrari', 'redbull', 'red bull', 'mclaren', 'mercedes', 'audi', 'cadillac',
        'sauber', 'honda', 'astonmartin', 'aston martin', 'lotus', 'williams', 'alpine', 'haas', 'rb'
    ]);

    // Reviewed legacy series whose source headers contain only "F1 Racing".
    // These migrations apply only without a specific category; modern categories always win.
    const LEGACY_CATEGORY_OVERRIDES = Object.freeze({
        '20260523J': 'Betting', // Betcast #264
        '20260606J': 'Betting', // Betcast #265
        '20260719J': 'Betting', // Betcast #269
        '20260822J': 'Betting', // Betcast #271
        '20260507D': 'Opinion', // Μέσα από το F1λτρο μου
        '20260526D': 'Opinion',
        '20260607D': 'Opinion',
        '20260701D': 'Opinion',
        '20260706D': 'Opinion',
        '20260726D': 'Opinion',
        '20260824D': 'Opinion'
    });

    function comparisonKey(value) {
        return value.normalize('NFC').toLowerCase().replace(/ς/g, 'σ');
    }

    /** Split legacy delimiter artifacts without losing multiword names or Unicode text. */
    function normalizeTags(values) {
        const tags = [];
        const seen = new Set();
        function visit(value) {
            if (Array.isArray(value)) {
                value.forEach(visit);
                return;
            }
            if (typeof value !== 'string' && typeof value !== 'number') return;
            String(value).split(/[,;|\r\n]+/).forEach(part => {
                const tag = part.normalize('NFC')
                    .replace(/[-_\u2010-\u2015]+/g, ' ')
                    .replace(/^\s*#+\s*/, '')
                    .replace(/\s+/g, ' ').trim();
                const key = comparisonKey(tag);
                if (!tag || seen.has(key)) return;
                seen.add(key);
                tags.push(tag);
            });
        }
        visit(values);
        return tags;
    }

    /** Public labels are canonical, case-sensitive values; aliases are input-only. */
    function isPublicCategory(value) {
        return PUBLIC_CATEGORIES.includes(value);
    }

    function normalizeCategories(values) {
        const selected = new Set(normalizeTags(values).map(value => aliases[comparisonKey(value)]).filter(Boolean));
        return PUBLIC_CATEGORIES.filter(category => selected.has(category));
    }

    function getPostTaxonomy(post) {
        const record = post && typeof post === 'object' ? post : {};
        const suppliedCategories = normalizeTags(record.categories);
        const modern = Array.isArray(record.categories) && suppliedCategories.length > 0 && suppliedCategories.every(isPublicCategory);
        const sourceTags = normalizeTags([record.tags, record.tag]);
        if (modern) {
            const categories = normalizeCategories(suppliedCategories);
            const category = categories.includes(record.category) ? record.category : categories[0];
            // Explicit tags are internal metadata, even when a tag resembles a category.
            const tags = Object.prototype.hasOwnProperty.call(record, 'tags') ? normalizeTags(record.tags) : sourceTags;
            return { category, categories, tags };
        }

        const legacyCategoryTags = normalizeTags([record.categories, record.category]);
        const allTags = normalizeTags([sourceTags, legacyCategoryTags]);
        let categories = normalizeCategories(allTags);
        if (legacyCategoryTags.length && legacyCategoryTags.every(value => legacyTeams.has(comparisonKey(value)))) {
            categories = normalizeCategories([categories, 'Teams']);
        }
        if (!categories.length) {
            categories = [Object.prototype.hasOwnProperty.call(LEGACY_CATEGORY_OVERRIDES, record.id) ? LEGACY_CATEGORY_OVERRIDES[record.id] : 'News'];
        }
        const explicitCategory = normalizeCategories(record.category);
        const category = explicitCategory.length === 1 && categories.includes(explicitCategory[0]) ? explicitCategory[0] : categories[0];
        const explicitTagKeys = new Set(normalizeTags(record.tags).map(comparisonKey));
        const tags = allTags.filter(tag => explicitTagKeys.has(comparisonKey(tag)) || !normalizeCategories(tag).includes(tag));
        return { category, categories, tags };
    }

    return Object.freeze({ PUBLIC_CATEGORIES, LEGACY_CATEGORY_OVERRIDES, normalizeTags, normalizeCategories, isPublicCategory, getPostTaxonomy });
}));
