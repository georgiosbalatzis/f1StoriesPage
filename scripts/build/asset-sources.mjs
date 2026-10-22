// Production asset entry points shared by minification and icon discovery.
export const CSS_INPUTS = [
    'styles.css',
    'home.css',
    'theme-overrides.css',
    'styles/shared-nav.css',
    'styles/critical-common.css',
    'styles/critical-standings.css',
    'styles/fonts.css',
    'styles/home-fonts.css',
    'styles/editorial.css',
    'styles/authors.css',
    'blog-module/blog/archive-editorial.css',
    'blog-module/blog/article-editorial.css',
    'standings/standings-editorial.css',
    'styles/vendor/bootstrap.slim.css',
    'blog-module/blog-styles.css',
    'blog-module/blog/article-styles.css',
    'standings/standings.css',
    'standings/standings-polish.css',
    // Phase 7: per-tab stylesheets lazily injected by standings.js.
    'standings/tabs/quali-gaps.css',
    'standings/tabs/lap1-gains.css',
    'standings/tabs/tyre-pace.css',
    'standings/tabs/dirty-air.css',
    'standings/tabs/track-dominance.css',
    'standings/tabs/pit-stops.css',
    'standings/tabs/debrief.css'
];

export const CSS_DEPENDENCIES = [
    'styles/layers.css'
];

export const JS_INPUTS = [
    'scripts/theme-init.js',
    'scripts/external-redirect.js',
    'scripts/analytics.js',
    'scripts/cookie-consent.js',
    'scripts/shared-nav.js',
    'scripts/authors.js',
    'scripts/sw-cleanup.js',
    'scripts/f1-optimized.js',
    'scripts/perf/error-beacon.js',
    'scripts/perf/web-vitals-collector.js', // Build first: the loader embeds its content hash.
    'scripts/perf/web-vitals-beacon.js',
    'blog-module/taxonomy.js',
    'blog-module/inline-markup.js',
    'blog-module/search-destinations.js',
    'blog-module/blog-index.js',
    'blog-module/blog/article-embeds.js',
    'blog-module/blog/article-script.js',
    'blog-module/blog-fixes.js',
    // Author tools (generate.html, housekeeping.html).
    'scripts/author/session-token.js',
    'scripts/author/github-client.js',
    'scripts/author/dom-tools.js',
    'scripts/author/dialogs.js',
    'scripts/author/image-tools.js',
    'scripts/author/article-source.js',
    'scripts/author/article-index.js',
    'scripts/author/local-drafts.js',
    'scripts/author/draft-manager.js',
    'scripts/author/article-preview.js',
    'scripts/author/generate-page.js',
    'scripts/author/housekeeping-page.js'
];

export const STANDINGS_TAB_ENTRIES = [
    'pit-stops', 'quali-gaps', 'lap1-gains',
    'tyre-pace', 'dirty-air', 'track-dominance', 'debrief'
];
