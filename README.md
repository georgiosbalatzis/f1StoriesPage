# F1 Stories — Complete Bundle (copy-paste ready)

## Deploy
1. Copy all files into your repo (overwrite existing)
2. Delete these old files:
   - polish.css
   - blog-module/blog-visual-fixes.css
   - blog-module/blog-mobile-fixes.css
   - blog-module/blog-mobile-fixes.js
   - blog-module/blog-perf-fixes.js
   - scripts/flag-fallback.js
3. Run: node blog-module/blog-processor.js
   (rebuilds article.html files with new template)

## Files in this bundle (10 files)
- index.html                           ← homepage
- styles.css                           ← base tokens + polish merged in
- scripts/f1-optimized.js              ← absorbs script.js
- blog-module/blog-styles.css          ← 4 files merged into 1
- blog-module/blog-fixes.js            ← NEW: replaces 2 JS files
- blog-module/blog/index.html          ← inline styles removed
- blog-module/blog/template.html       ← updated refs
- blog-module/blog/article-styles.css  ← cleaned aliases
- standings/index.html                 ← fixed API + team badges

All pages now load theme-overrides.css for consistent dark/light mode.
