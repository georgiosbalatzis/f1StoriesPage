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

    // Display layer. Data, URLs and filters keep the canonical values above;
    // only the text a reader sees is Greek.
    const CATEGORY_LABELS = Object.freeze({
        News: 'Ειδήσεις', Analysis: 'Ανάλυση', Technical: 'Τεχνικά', History: 'Ιστορία', Opinion: 'Άποψη',
        Betting: 'Στοίχημα', Drivers: 'Οδηγοί', Teams: 'Ομάδες', '2026': '2026'
    });
    // The writers, in directory order: the one source for names, folder codes,
    // portraits and the short editorial profile (build, archive, articles and the
    // author tools all read it). Each writer's accent ink lives in CSS, keyed by slug.
    const AUTHORS = Object.freeze([
        {
            name: 'Themis Charvalis', label: 'Θέμης Χαρβάλης', genitive: 'Θέμη', slug: 'themis-charvalis', code: 'W',
            portrait: '/images/avatars/AS.webp', desk: 'Ιστορία · Οδηγοί',
            specialty: 'Ιστορικές αναδρομές και πορτρέτα οδηγών',
            bio: 'Αναζητά το ανθρώπινο κομμάτι πίσω από τα αποτελέσματα και γράφει ιστορίες που συνδέουν το τότε με το σημερινό grid.',
            column: 'Ιστορίες οδηγών και θρύλων', instagram: 'https://www.instagram.com/myf1stories/'
        },
        {
            name: 'Giannis Poulikidis', label: 'Γιάννης Πουλικίδης', genitive: 'Γιάννη', slug: 'giannis-poulikidis', code: 'J',
            portrait: '/images/avatars/SV.webp', desk: 'Άποψη · Στοίχημα',
            specialty: 'Αγωνιστική άποψη και BetCast',
            bio: 'Γράφει όπως μιλάει: άμεσα, με χιούμορ και θέση. Μετατρέπει το αγωνιστικό τριήμερο σε κουβέντα που συνεχίζεται.',
            column: 'Τροφή για σκέψη', instagram: 'https://www.instagram.com/john_pouliks/'
        },
        {
            name: 'Georgios Balatzis', label: 'Γιώργος Μπαλατζής', genitive: 'Γιώργου', slug: 'georgios-balatzis', code: 'G',
            portrait: '/images/avatars/CSW.webp', desk: 'Τεχνικά · Δεδομένα',
            specialty: 'Τεχνική ανάλυση και αγωνιστικός ρυθμός',
            bio: 'Μετράει όσα δεν φαίνονται στον πίνακα αποτελεσμάτων: upgrades, ελαστικά, ρυθμό και τις αποφάσεις που κρίνουν έναν αγώνα.',
            column: 'Τεχνικό δελτίο', instagram: 'https://www.instagram.com/borgos_gialatzis/'
        },
        {
            name: 'Dimitris Keramidiotis', label: 'Δημήτρης Κεραμιδιώτης', genitive: 'Δημήτρη', slug: 'dimitris-keramidiotis', code: 'D',
            portrait: '/images/avatars/dr3R.webp', desk: 'Άποψη',
            specialty: 'Προσωπική ματιά στο αγωνιστικό τριήμερο',
            bio: 'Το ημερολόγιο ενός θεατή που κοιτάζει την F1 από την κερκίδα, το paddock και όλα όσα συμβαίνουν ανάμεσα στις γραμμές.',
            column: 'Μέσα από το F1λτρο μου', instagram: 'https://www.instagram.com/dimkeram/'
        },
        {
            name: 'Thanasis Batalas', label: 'Θανάσης Μπαταλάς', genitive: 'Θανάση', slug: 'thanasis-batalas', code: 'T',
            portrait: '/images/avatars/LN.webp', desk: 'Ιστορία · Ανάλυση',
            specialty: 'Ιστορία, πρόσωπα και ψυχολογία',
            bio: 'Συνδέει τις εποχές της Formula 1 με τις σημερινές μάχες και θυμίζει γιατί οι λεπτομέρειες μένουν περισσότερο από τα νούμερα.',
            column: 'Από το αρχείο του grid', instagram: 'https://www.instagram.com/thanasismpatalas/'
        }
    ].map(Object.freeze));
    function findAuthor(value) {
        const key = String(value || '').trim();
        return AUTHORS.find(author => author.name === key || author.slug === key) || null;
    }
    // Every portrait ships with a 96px square for small marks (filters, the archive's author view).
    function authorThumb(author) {
        return author ? author.portrait.replace(/\.webp$/, '-96.webp') : '';
    }
    // One kind per public category: the class/data value that carries its signal colour.
    const CATEGORY_KINDS = Object.freeze({
        News: 'news', Analysis: 'analysis', Technical: 'technical', History: 'history', Opinion: 'opinion',
        Betting: 'betting', Drivers: 'drivers', Teams: 'teams', '2026': 'season'
    });
    // Fixed month tables keep build (Node ICU) and browser output identical.
    const MONTHS_SHORT = ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαΐ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];
    const MONTHS_LONG = ['Ιανουαρίου', 'Φεβρουαρίου', 'Μαρτίου', 'Απριλίου', 'Μαΐου', 'Ιουνίου', 'Ιουλίου',
        'Αυγούστου', 'Σεπτεμβρίου', 'Οκτωβρίου', 'Νοεμβρίου', 'Δεκεμβρίου'];
    // Nominative capitals for the archive's month rules ("ΣΕΠΤΕΜΒΡΙΟΣ 2026").
    const MONTHS_TITLE = ['ΙΑΝΟΥΑΡΙΟΣ', 'ΦΕΒΡΟΥΑΡΙΟΣ', 'ΜΑΡΤΙΟΣ', 'ΑΠΡΙΛΙΟΣ', 'ΜΑΪΟΣ', 'ΙΟΥΝΙΟΣ', 'ΙΟΥΛΙΟΣ',
        'ΑΥΓΟΥΣΤΟΣ', 'ΣΕΠΤΕΜΒΡΙΟΣ', 'ΟΚΤΩΒΡΙΟΣ', 'ΝΟΕΜΒΡΙΟΣ', 'ΔΕΚΕΜΒΡΙΟΣ'];

    function categoryLabel(value) {
        return Object.prototype.hasOwnProperty.call(CATEGORY_LABELS, value) ? CATEGORY_LABELS[value] : String(value || '');
    }

    function categoryKind(value) {
        return Object.prototype.hasOwnProperty.call(CATEGORY_KINDS, value) ? CATEGORY_KINDS[value] : 'journal';
    }

    // Greek capitals drop the tonos but keep the dialytika: "Ειδήσεις" → "ΕΙΔΗΣΕΙΣ", "Μαΐ" → "ΜΑΪ".
    function greekUpper(value) {
        return String(value || '').normalize('NFD').replace(/́/g, '').toUpperCase().normalize('NFC');
    }

    /** "2026-09-20" → { day: "20", month: "ΣΕΠ", monthTitle: "ΣΕΠΤΕΜΒΡΙΟΣ 2026", key: "2026-09" }. */
    function ledgerDate(value) {
        const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
        if (!match) return null;
        const month = Number(match[2]) - 1;
        return {
            day: String(Number(match[3])),
            month: greekUpper(MONTHS_SHORT[month]),
            year: match[1],
            monthTitle: `${MONTHS_TITLE[month]} ${match[1]}`,
            key: `${match[1]}-${match[2]}`
        };
    }

    function authorLabel(name) {
        const author = findAuthor(name);
        return author ? author.label : String(name || '').trim();
    }

    /** "2026-09-20" → "20 Σεπ 2026" (short) or "20 Σεπτεμβρίου 2026" (long). */
    function formatDate(value, style) {
        const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
        if (!match) return String(value || '');
        const months = style === 'long' ? MONTHS_LONG : MONTHS_SHORT;
        return `${Number(match[3])} ${months[Number(match[2]) - 1]} ${match[1]}`;
    }

    /** Accepts 4, "4", "4 min" or "4 λεπ" and returns "4 λεπτά" (or "1 λεπτό"). */
    function formatReadingTime(value) {
        const minutes = parseInt(String(value || '').replace(/[^\d]/g, ''), 10);
        if (!minutes) return '';
        return minutes === 1 ? '1 λεπτό' : `${minutes} λεπτά`;
    }

    // Every "<name>-card.webp" (400w) ships with "<name>-mobile.webp" (800w) and
    // "<name>.webp" (1600w); the public artifact copies them together. Leads may
    // ask for the 1600w original; grid cards stop at 800w to keep bytes sane.
    const CARD_SIZES = Object.freeze({
        archiveLead: '(min-width: 1200px) 780px, (min-width: 768px) 55vw, 100vw',
        // Secondary front stories: a 96px square on phones, the margin column above.
        archiveSecond: '(max-width: 767px) 96px, (min-width: 1200px) 480px, 38vw',
        // Occasional pictures inside the archive ledger.
        archiveLedger: '(max-width: 767px) 100vw, 320px',
        homeLead: '(min-width: 1200px) 640px, (min-width: 768px) 55vw, 100vw',
        // 16:9 cards cropped into a 104px square on phones need ~185px of width.
        homeSecondary: '(max-width: 767px) 185px, 400px',
        related: '(max-width: 767px) 40vw, 390px'
    });
    // The Journal front and archive ledger, shared by the build and the browser.
    // A ledger page shows `page` rows; every `pictureEvery` rows, starting at
    // `pictureAt`, one row carries a photograph so the long list keeps a rhythm.
    const JOURNAL_LAYOUT = Object.freeze({ secondary: 2, recent: 4, deepReads: 2, page: 24, pictureAt: 5, pictureEvery: 8 });
    function isLedgerPicture(index) {
        return index >= JOURNAL_LAYOUT.pictureAt && (index - JOURNAL_LAYOUT.pictureAt) % JOURNAL_LAYOUT.pictureEvery === 0;
    }
    function cardImageSrcset(url, includeFull) {
        const match = /^(.*)-card\.webp$/.exec(String(url || ''));
        if (!match) return '';
        return `${match[1]}-card.webp 400w, ${match[1]}-mobile.webp 800w${includeFull ? `, ${match[1]}.webp 1600w` : ''}`;
    }

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

    return Object.freeze({
        PUBLIC_CATEGORIES, LEGACY_CATEGORY_OVERRIDES, normalizeTags, normalizeCategories, isPublicCategory, getPostTaxonomy,
        AUTHORS, findAuthor, authorThumb, categoryLabel, categoryKind, authorLabel, greekUpper, formatDate, ledgerDate, formatReadingTime,
        cardImageSrcset, CARD_SIZES, JOURNAL_LAYOUT, isLedgerPicture
    });
}));
