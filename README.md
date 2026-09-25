# F1 Stories

Αυτό είναι το αποθετήριο του δημόσιου site [f1stories.gr](https://f1stories.gr). Το F1 Stories είναι ελληνικό podcast και editorial project για τη Formula 1. Το site περιλαμβάνει αρχική σελίδα, blog με άρθρα, dashboards βαθμολογιών και στατιστικών, σελίδα συντακτών και τοπικά εργαλεία συγγραφής άρθρων.

Είναι ένα static site. Δεν έχει backend, βάση δεδομένων ή frontend framework. Είναι γραμμένο σε HTML, CSS και vanilla JavaScript. Τα Node.js scripts παράγουν ό,τι χρειάζεται στο build time, όπως τα άρθρα, τα JSON feeds, τα cache δεδομένων, τα minified assets και το τελικό artifact. Το GitHub Actions κάνει τα builds, τα merges των άρθρων, την ανανέωση δεδομένων και το deploy στο GitHub Pages.

---

## Περιεχόμενα

1. [Γρήγορη εκκίνηση](#1-γρήγορη-εκκίνηση)
2. [Αρχιτεκτονική με μια ματιά](#2-αρχιτεκτονική-με-μια-ματιά)
3. [Δομή αποθετηρίου](#3-δομή-αποθετηρίου)
4. [Δημόσιες σελίδες (routes)](#4-δημόσιες-σελίδες-routes)
5. [Άρθρα: πώς γράφεται ένα άρθρο](#5-άρθρα-πώς-γράφεται-ένα-άρθρο)
6. [Το build του blog](#6-το-build-του-blog)
7. [Κατηγορίες και tags](#7-κατηγορίες-και-tags)
8. [Standings: βαθμολογίες και αναλύσεις](#8-standings-βαθμολογίες-και-αναλύσεις)
9. [YouTube snapshot](#9-youtube-snapshot)
10. [Build του shell και των assets](#10-build-του-shell-και-των-assets)
11. [Το δημόσιο artifact (`dist/`)](#11-το-δημόσιο-artifact-dist)
12. [Εργαλεία συντακτών](#12-εργαλεία-συντακτών)
13. [GitHub Actions](#13-github-actions)
14. [Έλεγχοι ποιότητας και tests](#14-έλεγχοι-ποιότητας-και-tests)
15. [Όλα τα npm scripts](#15-όλα-τα-npm-scripts)
16. [Μεταβλητές περιβάλλοντος](#16-μεταβλητές-περιβάλλοντος)
17. [Source, generated και ignored αρχεία](#17-source-generated-και-ignored-αρχεία)
18. [Εξωτερικές υπηρεσίες](#18-εξωτερικές-υπηρεσίες)
19. [Συνηθισμένες εργασίες](#19-συνηθισμένες-εργασίες)
20. [Αντιμετώπιση προβλημάτων](#20-αντιμετώπιση-προβλημάτων)
21. [Σχετικά έγγραφα](#21-σχετικά-έγγραφα)

---

## 1. Γρήγορη εκκίνηση

### Προαπαιτούμενα

- **Node.js 22 ή νεότερο.** Το CI τρέχει σε Node 22 και το `package.json` δηλώνει `>=22`.
- **npm** με υποστήριξη για `npm ci`.
- **Google Chrome**, μόνο για τα `qa:visual`, `perf:lighthouse` και `test:consent`. Αν δεν βρεθεί αυτόματα, δώστε τη διαδρομή του με `CHROME_PATH`.
- **Σύνδεση στο internet** για τα builds που τραβούν δεδομένα (YouTube, Jolpica, OpenF1, F1 Top App).

### Εγκατάσταση

```bash
git clone https://github.com/georgiosbalatzis/f1StoriesPage.git
cd f1StoriesPage
npm ci
```

### Τοπική προβολή του site

```bash
npm run preview
```

Η εντολή χτίζει τα browser assets, ελέγχει ότι υπάρχουν τα απαραίτητα generated αρχεία και ανοίγει server στο `http://127.0.0.1:4173/`. Ο server σερβίρει τη ρίζα του αποθετηρίου και όχι το `dist/`. Σταματάει με `Ctrl+C`.

Το site χρησιμοποιεί απόλυτα paths όπως `/blog-module/...` και `/standings/...`. Γι' αυτό πρέπει να σερβίρεται πάντα από server. Αν ανοίξετε τα αρχεία με `file://`, δεν θα δουλέψει.

### Τοπικά εργαλεία συντακτών

```bash
node scripts/author/serve-tools.mjs
```

Ανοίγει server στο `http://127.0.0.1:4179/` με συνδέσμους για τα `generate.html`, `housekeeping.html` και `statistics.html`. Περισσότερα στην [ενότητα 12](#12-εργαλεία-συντακτών).

### Πλήρης έλεγχος πριν από release

```bash
npm run verify
```

---

## 2. Αρχιτεκτονική με μια ματιά

```text
                        ΠΗΓΕΣ (επεξεργάζονται από ανθρώπους ή εργαλεία)
  partials/*.html, root HTML shells, *.css / *.js, blog-module/build/, blog/template.html,
  blog-entries/<id>/source.txt + εικόνες + csv, scripts/**, standings/**, workflows, docs/
                                         |
         +-------------------------------+--------------------------------+
         |                |                         |                     |
   build:html       build:youtube              build:blog           build:assets
   (include.mjs)    (fetch-youtube.mjs)        (blog-module/build)  (sprite, bootstrap,
         |                |                         |               minify, stamp-html)
         v                v                         v                     v
                 GENERATED ΚΑΙ COMMITTED ΣΤΟ GIT
  HTML shells με include/stamp/sprite blocks, blog-entries/*/article.html,
  blog-index-data.json, blog-index-page-1.json, home-latest.json, blog-source-cache.json,
  sitemap.xml, assets/youtube-latest.json, standings/*-cache.json
                                         |
                          build:public (public-artifact.mjs + validators)
                                         v
                    dist/  (ignored, το μόνο που φτάνει στην παραγωγή)
                                         |
                     actions/upload-pages-artifact  ->  actions/deploy-pages
                                         v
                                 https://f1stories.gr
```

Βασικές αποφάσεις:

- **Static hosting.** Ό,τι είναι δυναμικό γίνεται στο build time, με client-side JavaScript πάνω σε δημόσια APIs ή με JSON cache αρχεία που υπάρχουν στο repo.
- **Δεν υπάρχει backend CMS.** Το ρόλο του CMS τον παίζουν το git και τα τοπικά εργαλεία συντακτών. Κάθε δημοσίευση είναι ένα κανονικό Pull Request.
- **Τα παραγόμενα άρθρα γίνονται commit.** Το `article.html` και τα JSON feeds βρίσκονται στο git. Έτσι το review, το rollback και ένα καθαρό checkout είναι απλά.
- **Το `dist/` είναι το δημόσιο όριο.** Η ρίζα του repo έχει εργαλεία, scripts, tests και σημειώσεις. Στην παραγωγή φτάνει μόνο ό,τι αντιγράφει ρητά το `public-artifact.mjs`, και ο validator το ελέγχει.
- **Vanilla JavaScript.** Δεν υπάρχει React, Vue ή client-side router. Το esbuild χρησιμοποιείται μόνο για minify και για code splitting στα standings.

---

## 3. Δομή αποθετηρίου

```text
.
├── index.html                  Αρχική σελίδα
├── 404.html                    Σελίδα 404
├── generate.html               Εργαλείο δημιουργίας άρθρου (συντάκτες)
├── housekeeping.html           Εργαλείο επεξεργασίας, διαγραφής και εισαγωγής ZIP (συντάκτες)
├── statistics.html             Dashboard Google Analytics 4 (συντάκτες)
├── home.css, styles.css, theme-overrides.css
├── sw.js                       Stub που αφαιρεί τον παλιό service worker (βλ. ενότητα «Χωρίς εφαρμογή»)
├── robots.txt, sitemap.xml, CNAME, .nojekyll
├── partials/                   head-meta.html, footer.html (γίνονται include με build:html)
├── assets/                     youtube-latest.json, fonts/
├── images/                     Λογότυπα, backgrounds, οδηγοί, ομάδες, sponsors, avatars, icons
├── styles/                     Κοινά CSS (editorial, shared-nav, fonts, legal, authors, author/*)
│   └── vendor/bootstrap.slim.scss   Υποσύνολο του Bootstrap που χτίζεται τοπικά
├── scripts/
│   ├── *.js                    Runtime JS: nav, theme, consent, analytics, SW register κ.λπ.
│   ├── author/                 JS των εργαλείων συντακτών και τα tests τους
│   ├── build/                  Build scripts (include, minify, stamp, public artifact, fetchers)
│   ├── perf/                   Performance guards, Lighthouse, visual QA, beacons
│   └── quality/                Static source guards, runtime audit
├── blog-module/
│   ├── blog-entries/<id>/      Ένας φάκελος ανά άρθρο (source.txt, εικόνες, article.html)
│   ├── build/                  Pipeline παραγωγής άρθρων (orchestrator, worker, parsers)
│   │   └── __tests__/          Golden tests και taxonomy tests
│   ├── blog/                   index.html (αρχείο άρθρων), template.html, CSS/JS άρθρου
│   ├── blog-processor.js       Wrapper που καλεί το build/
│   ├── taxonomy.js             Δημόσιες κατηγορίες, aliases, labels (Node και browser)
│   ├── blog-loader.js, blog-index.js, blog-fixes.js
│   ├── dirty-air-cache.js, destructors-cache.js   Builders για τα cache των standings
│   ├── generate-image-variants.js
│   └── *.json                  Generated feeds (index, page-1, home-latest, source-cache)
├── standings/
│   ├── index.html, standings.js, standings.css, ...
│   ├── core/                   Κοινά modules (cache, fetchers, format, teams, rendering) και tests
│   ├── tabs/                   Ένα lazy module και ένα CSS αρχείο για κάθε tab ανάλυσης
│   ├── debrief-cache.js        Builder του Friday debrief cache
│   └── *-cache.json            Committed snapshots δεδομένων
├── authors/index.html          Σελίδα συντακτών
├── privacy/                    privacy.html, terms.html
├── f1telemetry/, ghostcar/     Redirect σελίδες προς εξωτερικά εργαλεία
├── perf/                       Budgets (size, article media, lighthouse, !important)
├── quality/                    Baseline για τα rendering sinks
├── docs/                       Τεχνική τεκμηρίωση (βλ. ενότητα 21)
├── DESIGN.md, KEEP.md          Design system και χαρακτηριστικά που δεν πρέπει να αλλάξουν
└── .github/workflows/          4 workflows (βλ. ενότητα 13)
```

---

## 4. Δημόσιες σελίδες (routes)

| Route | Αρχείο | Τι είναι |
|---|---|---|
| `/` | `index.html` | Αρχική σελίδα με cover story, journal με τα πιο πρόσφατα άρθρα, videos, ομάδα, sponsors και φόρμα επικοινωνίας (Formspree). Το build του blog γράφει το κύριο άρθρο κατευθείαν μέσα στο HTML. |
| `/blog-module/blog/` | `blog-module/blog/index.html` | Αρχείο άρθρων με αναζήτηση, φίλτρα κατηγορίας και σελιδοποίηση. Η πρώτη σελίδα γράφεται στο HTML στο build time. Οι επόμενες φορτώνουν από τα JSON. |
| `/blog-module/blog-entries/<id>/article.html` | παράγεται από `template.html` | Σελίδα άρθρου με hero, rail, σχετικά άρθρα, προηγούμενο/επόμενο και σχόλια Disqus. |
| `/standings/` | `standings/index.html` | Βαθμολογίες οδηγών και κατασκευαστών και 8 tabs αναλύσεων (ενότητα 8). |
| `/authors/` | `authors/index.html` | Οι συντάκτες. |
| `/privacy/privacy.html`, `/privacy/terms.html` | `privacy/` | Νομικές σελίδες. |
| `/f1telemetry/` | `f1telemetry/index.html` | Redirect στο `georgiosbalatzis.github.io/f1-telemetry-dashboard/`. |
| `/ghostcar/` | `ghostcar/index.html` | Redirect στο `georgiosbalatzis.github.io/ghostcar/`. |
| `/404.html` | | Σελίδα σφάλματος. |
| `/generate.html`, `/housekeeping.html`, `/statistics.html` | | Εργαλεία συντακτών. Ανεβαίνουν στο `dist/` με `noindex, nofollow` και λειτουργούν μόνο με GitHub token ή Google login (ενότητα 12). |

Όλες οι σελίδες είναι `lang="el"`. Το σκούρο θέμα είναι το προεπιλεγμένο. Το ανοιχτό ενεργοποιείται με `html[data-theme="light"]` μέσω του `scripts/theme-init.js`. Τα analytics (GA4) φορτώνουν μόνο αφού ο επισκέπτης δώσει ρητή συγκατάθεση στο cookie banner (`scripts/cookie-consent.js`, `scripts/analytics.js`).

---

## 5. Άρθρα: πώς γράφεται ένα άρθρο

### 5.1 Φάκελος άρθρου

Κάθε άρθρο έχει τον δικό του φάκελο στο `blog-module/blog-entries/`. Το όνομα του φακέλου είναι το ID του άρθρου και καθορίζει την ημερομηνία και τον συντάκτη:

```text
YYYYMMDD[-N][X]

20260922W      άρθρο της 22/09/2026 από τον συντάκτη W
20250414-1G    δεύτερο άρθρο της ίδιας μέρας από τον G
```

- `YYYYMMDD` είναι η ημερομηνία δημοσίευσης.
- `-N` είναι προαιρετικό. Μπαίνει όταν ο ίδιος συντάκτης δημοσιεύει δεύτερο άρθρο την ίδια μέρα.
- `X` είναι ο κωδικός του συντάκτη:

| Κωδικός | Συντάκτης |
|---|---|
| `G` | Georgios Balatzis (Γιώργος Μπαλατζής) |
| `J` | Giannis Poulikidis (Γιάννης Πουλικίδης) |
| `T` | Thanasis Batalas (Θανάσης Μπαταλάς) |
| `W` | Themis Charvalis (Θέμης Χαρβάλης) |
| `D` | Dimitris Keramidiotis (Δημήτρης Κεραμιδιώτης) |
| κανένας | F1 Stories Team |

Οι συντάκτες ορίζονται στο `CONFIG.AUTHOR_MAP` και `AUTHOR_AVATARS` (`blog-module/build/shared.js`), στο `AUTHOR_CODES` (`scripts/author/article-folder.js`) και στο `AUTHOR_LABELS` (`blog-module/taxonomy.js`). Για νέο συντάκτη πρέπει να ενημερωθούν και τα τρία αρχεία, και να προστεθεί avatar στο `images/avatars/`.

### 5.2 Αρχεία μέσα στον φάκελο

| Αρχείο | Ρόλος |
|---|---|
| `source.txt` | Το κείμενο του άρθρου. Είναι το source of truth. Υποστηρίζεται και `.docx`, και αν υπάρχουν και τα δύο, προτιμάται το `.docx`. Τα `.docx` είναι στο `.gitignore`. |
| `1.webp` | Κύρια εικόνα: thumbnail, κάρτα και εικόνα κοινοποίησης. |
| `2.webp` | Εικόνα header/background του άρθρου. |
| `3.webp`, `4.webp`, ... | Εικόνες μέσα στο κείμενο, με τη σειρά που εμφανίζονται. |
| `*.csv` | Δεδομένα για πίνακες μέσα στο άρθρο. |
| `*.html` / `*.htm` | Τοπικά embeds (widgets), στον φάκελο ή στον υποφάκελο `embeds/`. |
| `article.html` | **Generated.** Το τελικό HTML του άρθρου. Γίνεται commit, αλλά δεν το επεξεργάζεστε με το χέρι. |
| `1.avif`, `1-mobile.*`, `1-card.webp`, `N-sm.*`, ... | **Generated.** Responsive παραλλαγές των εικόνων. Γίνονται commit. |

Αν οι εικόνες 1 και 2 δοθούν ως `.jpg`, `.png` ή `.gif`, το build τις μετατρέπει σε `.webp` και `.avif`. Η πολιτική του repo όμως είναι να μην γίνονται commit raw JPG/PNG/GIF. Το `perf:article-media` αποτυγχάνει για κάθε νέο raw αρχείο εικόνας (βλ. `docs/article-media-policy.md`).

### 5.3 Μορφή του `source.txt`

Τα νέα άρθρα ξεκινούν με front matter, το οποίο το `generate.html` γράφει αυτόματα:

```text
---
category: Analysis
tags: Lewis Hamilton, Ferrari F1
title: Ο τίτλος του άρθρου
---

Η πρώτη παράγραφος γίνεται η εισαγωγή (lead) του άρθρου.

# Υπότιτλος (γίνεται <h2>)

## Μικρότερος υπότιτλος (γίνεται <h3>)

Κείμενο με **έντονα** και *πλάγια*.

- στοιχείο λίστας
- άλλο στοιχείο

[img-instert-tag]

| Οδηγός | Βαθμοί |
|---|---|
| Norris | 25 |
```

- `category` είναι μία από τις δημόσιες κατηγορίες (ενότητα 7). Αν δοθεί, υπερισχύει.
- `tags` είναι εσωτερικά tags χωρισμένα με κόμμα. Χρησιμοποιούνται στην αναζήτηση και στα σχετικά άρθρα.
- `title` είναι ο τίτλος.
- Άλλα κλειδιά με μορφή `key: value` διατηρούνται ως metadata.

Τα παλιά άρθρα έχουν άλλη μορφή, που υποστηρίζεται ακόμα: η πρώτη γραμμή περιέχει tags και κατηγορία χωρισμένα με παύλες και κόμματα (π.χ. `F1 Racing,-Pedro-de-la-Rosa,-legend,-Historical`) και η πρώτη μη κενή γραμμή μετά από αυτή είναι ο τίτλος.

### 5.4 Ειδικοί δείκτες μέσα στο κείμενο

| Δείκτης | Αποτέλεσμα |
|---|---|
| `[img-instert-tag]` | Βάζει την επόμενη εικόνα περιεχομένου (`3.*`, μετά `4.*`, ...) σε αυτό το σημείο. Η ορθογραφία είναι όντως `instert`. Εικόνες που περισσεύουν μπαίνουν σε carousel στο τέλος. |
| `CSV_TABLE:αρχείο.csv` | Φτιάχνει responsive πίνακα από CSV του φακέλου. Μορφή: `CSV_TABLE:αρχείο.csv \| λεζάντα \| πηγή`. |
| `CSV_TABLE_HTML:αρχείο.csv` | Το ίδιο, αλλά επιτρέπει HTML μέσα στα κελιά. |
| `IFRAME:https://...` | Iframe, μόνο από hosts του `CONFIG.IFRAME_WHITELIST`: YouTube, Spotify, Vimeo, CodePen, Datawrapper, Sketchfab, Facebook, f1stories.gr, georgiosbalatzis.github.io. |
| `EMBED:αρχείο.html` ή `WIDGET:αρχείο.html` | Βάζει ένα τοπικό `.html`/`.htm` του φακέλου ή του `embeds/`. Paths που βγαίνουν έξω από τον φάκελο μπλοκάρονται. |
| Σκέτος σύνδεσμος σε δική του γραμμή | Ένα link YouTube (και Shorts), X/Twitter, Instagram, Threads ή Facebook μετατρέπεται σε embed. |
| Pipe πίνακας (`\| a \| b \|` και από κάτω `\|---\|---\|`) | Responsive πίνακας. |

Όλα τα embeds περνούν από sanitization (`blog-module/build/embed-render.js`). Η λίστα των επιτρεπτών πηγών πρέπει να ταιριάζει με το Content Security Policy στο `scripts/build/security-policy.mjs`.

---

## 6. Το build του blog

```bash
npm run build:blog          # incremental
npm run build:blog:force    # ξαναχτίζει όλα τα άρθρα που έχουν source
```

Το σημείο εισόδου είναι το `blog-module/build/index.js`. Το `blog-module/blog-processor.js`, που καλούν τα workflows, είναι απλώς wrapper του.

### 6.1 Βήματα

1. **Εντοπισμός.** Διαβάζει όλους τους φακέλους του `blog-entries/` και αποφασίζει για τον καθένα αν θα χτιστεί, αν θα παραλειφθεί ή αν θα χρησιμοποιηθεί το cache.
2. **Incremental έλεγχος** (`utils.shouldSkip`). Ένα άρθρο ξαναχτίζεται όταν:
   - δεν υπάρχει `article.html`,
   - το source, κάποια εικόνα, CSV ή embed έχει νεότερο `mtime` από το `article.html`,
   - το `article.html` έχει inline `data:image` ή δεν έχει responsive `srcset` στο hero.
3. **Worker pool.** Κάθε άρθρο χτίζεται σε δικό του `worker_thread` (`build/worker.js`). Ο αριθμός των workers είναι όσοι οι πυρήνες της CPU, ή όσο ορίζει το `BLOG_WORKERS`.
4. **Ανά άρθρο:**
   - parse του source (`parse-txt.js` ή `parse-docx.js` μέσω mammoth),
   - εξαγωγή εικόνων από το `.docx`, αν υπάρχει,
   - μετατροπή εικόνων με sharp (WebP/AVIF στα 1600px, `-sm` στα 800px),
   - embeds, CSV πίνακες, γκαλερί,
   - metadata: τίτλος, excerpt, χρόνος ανάγνωσης, κατηγορίες,
   - render μέσω του `blog/template.html` (`article-render.js`).
5. **Άρθρα χωρίς source.** Παλιά άρθρα χωρίς `source.txt`/`.docx` δεν ξαναχτίζονται. Χρησιμοποιούνται τα committed metadata, και στο HTML τους ενημερώνεται μόνο το taxonomy.
6. **Feeds.** Γράφει:
   - `blog-module/blog-data.json`: πλήρη metadata. Είναι τοπικό αρχείο και δεν γίνεται commit.
   - `blog-module/blog-source-cache.json`: κανονικοποιημένα metadata όλων των άρθρων.
   - `blog-module/blog-index-data.json`: compact index `v: 2` για το αρχείο και την αναζήτηση.
   - `blog-module/blog-index-page-1.json`: η πρώτη σελίδα του αρχείου.
   - `blog-module/home-latest.json`: έως 4 άρθρα για την αρχική σελίδα.
7. **Εικόνες καρτών.** Τρέχει το `generate-image-variants.js --run --cards-only` και φτιάχνει όσα `-card`/`-mobile` λείπουν.
8. **Static render.** Γράφει την πρώτη σελίδα του αρχείου στο `blog/index.html` και το κύριο άρθρο στο `index.html`.
9. **Sitemap.** Ξαναγράφει το `sitemap.xml`.
10. **Διασύνδεση.** Βάζει σχετικά άρθρα (`related.js`) και συνδέσμους προηγούμενο/επόμενο (`nav.js`) σε κάθε `article.html`.

### 6.2 Παραλλαγές εικόνων

Το `blog-module/generate-image-variants.js` συμπληρώνει τις παραλλαγές που λείπουν:

```bash
node blog-module/generate-image-variants.js                  # dry run, δείχνει μόνο τι θα γίνει
node blog-module/generate-image-variants.js --run            # τις δημιουργεί
node blog-module/generate-image-variants.js --run --force    # τις ξαναδημιουργεί όλες
```

| Παραλλαγή | Πλάτος | Χρήση |
|---|---|---|
| `N.webp` / `N.avif` | έως 1600px | κύριες εικόνες |
| `N-sm.webp` / `N-sm.avif` | έως 800px | `srcset` εικόνων περιεχομένου |
| `1-mobile.*`, `2-mobile.*` | έως 800px | hero σε κινητά |
| `1-card.webp`, `2-card.webp` | έως 400px | κάρτες στο αρχείο και στην αρχική |

### 6.3 Golden tests

Το `blog-module/build/__tests__/` περιέχει τα αναμενόμενα HTML για αντιπροσωπευτικά άρθρα. Αν αλλάξετε σκόπιμα το markup των άρθρων:

```bash
node blog-module/build/__tests__/run-golden.js --update
npm run test:blog
```

Μετά ελέγξτε το diff των fixtures.

---

## 7. Κατηγορίες και tags

Οι δημόσιες κατηγορίες ορίζονται σε ένα σημείο, στο `blog-module/taxonomy.js`, και είναι εννέα:

| Κατηγορία | Ελληνική ετικέτα |
|---|---|
| `News` | Ειδήσεις |
| `Analysis` | Ανάλυση |
| `Technical` | Τεχνικά |
| `History` | Ιστορία |
| `Opinion` | Άποψη |
| `Betting` | Στοίχημα |
| `Drivers` | Οδηγοί |
| `Teams` | Ομάδες |
| `2026` | 2026 |

- Τα δεδομένα, τα URLs και τα φίλτρα χρησιμοποιούν τις αγγλικές τιμές. Ο αναγνώστης βλέπει τις ελληνικές ετικέτες.
- Link σε κατηγορία: `/blog-module/blog/index.html?category=History`.
- Οι aliases μετατρέπουν παλιές τιμές σε κανονικές, π.χ. `Historical` σε `History` και `betcast` σε `Betting`.
- Η κατηγορία `2026` προκύπτει μόνο από ρητά metadata, ποτέ από το έτος δημοσίευσης.
- Αν δεν αναγνωριστεί κατηγορία, χρησιμοποιείται η `News`.
- Τα **tags** (οδηγοί, ομάδες, αγώνες, σειρές) είναι εσωτερικά. Χρησιμοποιούνται στην αναζήτηση και στη βαθμολόγηση σχετικών άρθρων, αλλά δεν εμφανίζονται ως δημόσιες κατηγορίες.
- Το `LEGACY_CATEGORY_OVERRIDES` ορίζει την κατηγορία για συγκεκριμένα παλιά άρθρα που έχουν ελεγχθεί.

Το ίδιο αρχείο φορτώνει και στο Node (build) και στον browser (`window.F1S_TAXONOMY`). Έτσι το build και η σελίδα βγάζουν ίδιο αποτέλεσμα. Τα tests τρέχουν με `npm run test:taxonomy`.

---

## 8. Standings: βαθμολογίες και αναλύσεις

### 8.1 Runtime

Η σελίδα `/standings/` δουλεύει με ES modules. Το `standings.js` είναι το κύριο module. Τα κοινά modules είναι στο `standings/core/`. Κάθε tab είναι ξεχωριστό module στο `standings/tabs/` και φορτώνει με `import()` την πρώτη φορά που ανοίγει το tab. Το ίδιο ισχύει και για το CSS κάθε tab. Το `standings-nomodule.js` είναι fallback για browsers χωρίς υποστήριξη modules.

| Tab | Module | Δεδομένα |
|---|---|---|
| Βαθμολογία οδηγών / κατασκευαστών | `standings.js` | `standings-cache.json`, μετά live Jolpica, με fallback στο OpenF1 |
| Destructors | `tabs/destructors.js` | `destructors-cache.json` |
| Pit stops | `tabs/pit-stops.js` | OpenF1 (live) |
| Quali gaps | `tabs/quali-gaps.js` | OpenF1 (live) |
| Lap 1 gains | `tabs/lap1-gains.js` | OpenF1 (live) |
| Tyre pace | `tabs/tyre-pace.js` | OpenF1 (live) |
| Dirty air | `tabs/dirty-air.js` | `dirty-air/index.json` + `dirty-air/<session_key>.json` |
| Track dominance | `tabs/track-dominance.js` | OpenF1 (live) |
| Debrief | `tabs/debrief.js` | `debrief-cache.json` |

Πώς φορτώνουν οι βασικές βαθμολογίες:

1. Πρώτα φορτώνει το committed `standings-cache.json`, ώστε η σελίδα να εμφανιστεί γρήγορα.
2. Μετά από λίγο γίνεται ανανέωση από το live Jolpica API.
3. Αν αποτύχει το snapshot, φορτώνει κατευθείαν από το Jolpica, και αν αποτύχει κι αυτό, από το OpenF1.

Τα live responses αποθηκεύονται στον browser σε IndexedDB, με fallback στο `sessionStorage` (`standings/core/cache.js`). Η διάρκειά τους είναι 1 ώρα. Το κουμπί «Εκκαθάριση cache» στο footer τα καθαρίζει.

### 8.2 Committed δεδομένα

| Αρχείο | Builder | Πηγή |
|---|---|---|
| `standings/standings-cache.json` | `scripts/build/refresh-standings-data.mjs` | Jolpica (Ergast mirror) |
| `standings/dirty-air-cache.json` (+ split `standings/dirty-air/`) | `blog-module/dirty-air-cache.js` | OpenF1 |
| `standings/destructors-cache.json` | `blog-module/destructors-cache.js` | F1 Top App (parse του HTML) |
| `standings/debrief-cache.json` | `standings/debrief-cache.js` | OpenF1 |

Ανανεώνονται όλα μαζί με:

```bash
npm run build:standings-data
node scripts/build/refresh-standings-data.mjs --force --year 2026
```

Το `--force` ξαναχτίζει και ό,τι υπάρχει ήδη στο cache. Το `--year` ορίζει σεζόν διαφορετική από την τρέχουσα. Τα requests έχουν timeout 20s και έως 3 προσπάθειες.

Στην παραγωγή τα δεδομένα ανανεώνονται αυτόματα κάθε Παρασκευή στις 23:59 (μετά τα ελεύθερα δοκιμαστικά), κάθε Σάββατο στις 07:01 (μετά τις κατατακτήριες) και κάθε Δευτέρα στις 07:01 (μετά τον αγώνα), ώρα Αθήνας (ενότητα 13.3). Είναι το μόνο σημείο που ανανεώνει αυτά τα αρχεία. Το build του blog δεν τα αγγίζει.

### 8.3 Εικόνες οδηγών και ομάδων

```bash
npm run build:driver-headshots   # images/drivers/ από το Formula1.com media CDN
npm run build:team-logos         # images/teams/
npm run build:logo               # βελτιστοποιημένες εκδόσεις του λογοτύπου
npm run build:images             # και τα τρία
```

Αυτά τα scripts τρέχουν μόνο χειροκίνητα. Δεν είναι μέρος του κανονικού build.

---

## 9. YouTube snapshot

Η αρχική σελίδα δείχνει τα πιο πρόσφατα videos από το `assets/youtube-latest.json`, όχι από live API.

```bash
npm run build:youtube
```

- Διαβάζει το δημόσιο RSS του καναλιού (`YOUTUBE_CHANNEL_ID`, με προεπιλογή το κανάλι του F1 Stories).
- Το `lastUpdated` αλλάζει μόνο όταν αλλάξουν τα videos. Έτσι δεν γίνονται άσκοπα commits.
- Αν το YouTube δεν απαντά και υπάρχει ήδη snapshot, το script κρατά το παλιό και τερματίζει με exit code 0. Αποτυγχάνει μόνο όταν δεν υπάρχει καθόλου snapshot.

Στην παραγωγή τρέχει αυτόματα δύο φορές τη μέρα (ενότητα 13.3).

---

## 10. Build του shell και των assets

```bash
npm run build
```

Τρέχει με αυτή τη σειρά: `build:html`, `build:youtube`, `build:blog`, `build:assets`.

### 10.1 `build:html`: partials

Το `scripts/build/include.mjs` αντικαθιστά τους δείκτες `<!-- @include partials/... -->` με το περιεχόμενο του partial, μέσα σε μπλοκ `@include:begin` / `@include:end`. Η λειτουργία είναι idempotent. Εφαρμόζεται σε αυτά τα shells: `index.html`, `404.html`, `standings/index.html`, `blog-module/blog/index.html`, `blog-module/blog/template.html`, `authors/index.html`, `privacy/*.html`, `generate.html`, `housekeeping.html`, `statistics.html`.

Το `.blog-nav` **δεν** είναι partial. Υπάρχει αντίγραφό του σε κάθε shell και σε κάθε `article.html`. Αν αλλάξει το markup του, πρέπει να ενημερωθούν τα shells και το `template.html`, και τα άρθρα να περάσουν migration με το `scripts/build/article-editorial.mjs`.

### 10.2 `build:assets`: minify και stamp

1. `build:sponsors` αφαιρεί τα διάφανα περιθώρια από τα λογότυπα των sponsors.
2. `build-icon-sprite.mjs` σαρώνει τις κλάσεις `fa-*` και φτιάχνει το `images/icons/sprite.svg` με μόνο τα Font Awesome icons που χρησιμοποιούνται.
3. `build:bootstrap` φτιάχνει το `styles/vendor/bootstrap.slim.css` από το SCSS υποσύνολο.
4. `minify.mjs` παράγει ένα `.min.css` με lightningcss και ένα `.min.js` με esbuild δίπλα σε κάθε source. Τα standings χτίζονται με code splitting στο `standings/chunks/`. Γράφει και το `scripts/build/asset-manifest.json`.
5. `stamp-html.mjs` ξαναγράφει τα references στο HTML ώστε να δείχνουν σε `.min.<ext>?v=<hash>` (cache busting), βάζει inline το icon sprite στα shells και ενημερώνει τα runtime references και το editorial shell στα committed άρθρα.

Τα `*.min.*`, το sprite, το bootstrap CSS και το manifest είναι στο `.gitignore`. Χτίζονται σε κάθε build, και στο CI. Μόνο το HTML με τα ενημερωμένα `?v=` γίνεται commit.

Χρήσιμες παραλλαγές:

```bash
npm run build:assets:watch                           # minify σε κάθε αλλαγή
node scripts/build/stamp-html.mjs --dry              # δείχνει μόνο τι θα αλλάξει
node scripts/build/stamp-html.mjs --article-ids=20260913G,20260912W
```

### 10.3 Fonts

Τα fonts φιλοξενούνται στο ίδιο το site (IBM Plex Sans, Barlow Condensed, GFS Didot). Δεν γίνεται κανένα request στο Google Fonts ή σε CDN. Ανανεώνονται με το `npm run build:fonts`. Οι άδειες OFL βρίσκονται στο `assets/fonts/licenses/`.

### 10.4 CSS

Κάθε CSS αρχείο αντιστοιχεί σε συγκεκριμένη σελίδα ή λειτουργία. Η σειρά φόρτωσης ανά route περιγράφεται στο `docs/css-architecture.md`. Το design system (χρώματα, τυπογραφία, components) περιγράφεται στο `DESIGN.md`. Το `KEEP.md` λέει ποια χαρακτηριστικά της εμφάνισης δεν πρέπει να αλλάξουν.

---

## 11. Το δημόσιο artifact (`dist/`)

```bash
npm run build:public
```

Βήματα:

1. `pages:guard` ελέγχει ότι τα workflows, το `package.json`, το `public-artifact.mjs` και ο validator τηρούν το μοντέλο δημοσίευσης. Για παράδειγμα, το deploy ανεβάζει μόνο το `dist`, τα εργαλεία συντακτών δεν φορτώνουν JSZip από CDN, δεν αποθηκεύουν token στο `localStorage` και δεν γράφουν κατευθείαν στο `main`.
2. `build:html`, `build:blog`, `build:assets` (ενότητα 10). Το `build:youtube` **δεν** τρέχει, και το build του blog δεν τραβά δεδομένα από το internet. Έτσι το `dist/` χτίζεται μόνο από ό,τι είναι committed, και ένα PR check ή ένα deploy δεν αποτυγχάνει επειδή κάποιο εξωτερικό API δεν απαντά.
3. `build:data-contracts` ελέγχει το schema και την έκδοση κάθε generated JSON/XML (βλ. `docs/data-contracts.md`).
4. `public-artifact.mjs` σβήνει το `dist/` και αντιγράφει μέσα μόνο:
   - τα αρχεία των allowlists,
   - τις εικόνες και τα αρχεία των άρθρων που χρησιμοποιούνται πραγματικά,
   - τα `.min` assets.

   Γράφει επίσης το `dist/_headers`.
5. `validate-public-artifact.mjs` αποτυγχάνει αν:
   - υπάρχουν ιδιωτικά ή source αρχεία,
   - λείπουν απαιτούμενα αρχεία,
   - υπάρχουν σπασμένα references ή λάθος URLs στα metadata,
   - το sitemap έχει κακούς συνδέσμους,
   - η πολιτική ασφαλείας δεν ταιριάζει.

Στο `dist/` **δεν** μπαίνουν: scripts του build, tests, `package*.json`, σημειώσεις, source maps, `.docx`, `source.txt`, raw εικόνες, `blog-data.json`, `template.html` και `asset-manifest.json`.

### Ασφάλεια

Η πολιτική ορίζεται σε ένα σημείο, στο `scripts/build/security-policy.mjs`, και εφαρμόζεται με δύο τρόπους:

- ως `dist/_headers`, για hosts που τα υποστηρίζουν (Cloudflare Pages, Netlify),
- ως meta tags `Content-Security-Policy` και `Referrer-Policy` σε κάθε HTML, επειδή το GitHub Pages αγνοεί το `_headers`.

Το CSP δεν επιτρέπει inline scripts ούτε `on*` attributes. Όλη η JavaScript βρίσκεται σε αρχεία. Αν προσθέσετε νέα εξωτερική πηγή (script, iframe, API), πρέπει να ενημερώσετε το `security-policy.mjs`. Λεπτομέρειες στο `docs/security-headers.md`.

### Χωρίς εφαρμογή (μόνο browser)

Το site λειτουργεί μόνο online, μέσα από browser. Δεν έχει web app manifest, offline λειτουργία ή εγκατάσταση ως εφαρμογή, και το CSP ορίζει `manifest-src 'none'`. Παλαιότερες εκδόσεις είχαν service worker. Για τους επισκέπτες που τον έχουν ακόμη, το `scripts/sw-cleanup.js` (σε κάθε δημόσια σελίδα) τον καταργεί και σβήνει τις caches `f1s-*`. Το `sw.js` είναι stub που κάνει το ίδιο αν ο browser ελέγξει για ενημέρωση. Και τα δύο αρχεία μπορούν να διαγραφούν μερικούς μήνες μετά τον Σεπτέμβριο 2026.

---

## 12. Εργαλεία συντακτών

Τα εργαλεία είναι στατικές σελίδες. Μιλούν κατευθείαν με το GitHub API από τον browser, με token του ίδιου του συντάκτη. Ανεβαίνουν στο `dist/` με `noindex, nofollow`, αλλά χωρίς token δεν μπορούν να γράψουν τίποτα. Μπορείτε να τα τρέξετε και τοπικά με `node scripts/author/serve-tools.mjs`.

### 12.1 GitHub token

Χρειάζεται fine-grained Personal Access Token για το `georgiosbalatzis/f1StoriesPage` με:

- **Contents:** Read and write
- **Pull requests:** Read and write

Το token κρατιέται στη μνήμη και στο `sessionStorage` της καρτέλας (`scripts/author/session-token.js`). Δεν αποθηκεύεται μόνιμα στο `localStorage`, και το `pages:guard` ελέγχει ότι αυτό ισχύει.

### 12.2 `generate.html`: νέο άρθρο

Ροή σε πέντε βήματα: Βασικά, Κείμενο, Εικόνες, Προεπισκόπηση, Έλεγχος & PR.

- Επιλέγετε συντάκτη, κατηγορία, tags και τίτλο και γράφετε το κείμενο με τους δείκτες της ενότητας 5.4.
- Οι εικόνες μετατρέπονται σε WebP στον browser: `1.webp` για το hero, `2.webp` για το header, `3.webp` και μετά για το περιεχόμενο.
- Το βήμα ελέγχου δείχνει όλα τα warnings: τίτλο με κεφαλαία ή emoji, επαναλαμβανόμενες λέξεις, εικόνες που δεν αντιστοιχούν σε δείκτες.
- Αν υπάρχει ήδη φάκελος με την ίδια ημερομηνία, διαλέγετε ανάμεσα σε νέα έκδοση `-N` και αντικατάσταση. Η αντικατάσταση ζητά δεύτερη επιβεβαίωση.
- **Δημοσίευση:** δημιουργεί branch `author/blog/<slug>-<timestamp>`, κάνει ένα commit μόνο μέσα στο `blog-module/blog-entries/` και ανοίγει PR προς το `main`.
- **Εξαγωγή ZIP:** κατεβάζει τον φάκελο του άρθρου (`source.txt`, εικόνες, `README.txt`) για χειροκίνητη δημοσίευση ή για εισαγωγή από το housekeeping.

### 12.3 `housekeeping.html`: συντήρηση

- Οργανώνει το αρχείο άρθρων σε ομάδες εργασιών με βάση το `blog-index-data.json`. Υπάρχουν ομάδες για προβλήματα τίτλων, άρθρα χωρίς tags, επαναλαμβανόμενους τίτλους, φακέλους με μη τυπικό όνομα και ανοιχτά PR `author/*`, καθώς και μια ομάδα με όλα τα άρθρα.
- **Επεξεργασία** (`author/edit/...`): αλλάζει μόνο το `source.txt`. Άρθρα χωρίς `source.txt` εμφανίζονται μόνο για ανάγνωση. Όσο υπάρχει ανοιχτό PR για ένα άρθρο στην τρέχουσα συνεδρία, το άρθρο είναι κλειδωμένο.
- **Διαγραφή** (`author/delete/...`): αφαιρεί τον φάκελο μέσω PR.
- **Εισαγωγή ZIP** (`author/import/...`): δέχεται ZIP από το `generate.html` και το ανεβάζει μέσω PR.

### 12.4 `statistics.html`: F1 Data Hub

Dashboard με δεδομένα GA4 από το Google Analytics Data API, με read-only scope `analytics.readonly`. Κάνει login με Google Identity Services. Το GA4 property ID και το OAuth Client ID ορίζονται στο `scripts/author/statistics-config.js`. Αν το Client ID είναι κενό, η σελίδα το ζητά και το κρατά τοπικά.

### 12.5 Τι γίνεται μετά το PR

Το PR περνά αυτόματα από έλεγχο, γίνεται merge, χτίζεται και δημοσιεύεται (ενότητα 13.2). Ο συντάκτης δεν χρειάζεται να κάνει τίποτα άλλο.

---

## 13. GitHub Actions

Υπάρχουν τέσσερα workflows στο `.github/workflows/`:

| Αρχείο | Όνομα | Πότε τρέχει | Τι κάνει |
|---|---|---|---|
| `quality.yml` | **Site Quality** | PR προς `main`, χειροκίνητα | Build και έλεγχοι, μόνο με ανάγνωση. Δεν κάνει deploy. |
| `auto-publish-author-pr.yml` | **Publish Article** | Όταν ολοκληρωθεί το Site Quality σε branch `author/**` | Έλεγχος και merge του PR του συντάκτη, μετά κλήση του Site Maintenance (`task: blog`). |
| `publish-blog.yml` | **Site Maintenance** | Schedule, push σε άρθρα, χειροκίνητα, κλήση από το Publish Article | Build του blog, ανανέωση YouTube, ανανέωση standings, deploy αν άλλαξε κάτι. |
| `deploy-pages.yml` | **Deploy Pages** | Push στο `main`, χειροκίνητα, κλήση από άλλο workflow | `build:public`, έλεγχοι, upload και deploy στο GitHub Pages. |

Τα κοινά βήματα βρίσκονται σε δύο composite actions στο `.github/actions/`:

- **`setup`**: `actions/setup-node@v5` με Node 22 και npm cache, και μετά `npm ci --no-audit --no-fund`. Το χρησιμοποιούν όλα τα jobs. Η έκδοση του Node αλλάζει μόνο εδώ.
- **`commit-and-push`**: ορίζει την ταυτότητα του commit, κάνει stage τα `paths` (προεπιλογή `-A`) και commit με το `message`, και κάνει push στο `main`. Αν το push χάσει race με άλλο publisher, κάνει `fetch` και `rebase` και ξαναδοκιμάζει έως 3 φορές. Επιστρέφει `changed=true` μόνο όταν έγινε push.

Όλα τα jobs τρέχουν σε `ubuntu-latest`.

### 13.1 Site Quality (`quality.yml`)

- **Trigger:** `pull_request` προς `main` και `workflow_dispatch`.
- **Δικαιώματα:** `contents: read`.
- **Concurrency:** `quality-<ref>` με `cancel-in-progress`. Ένα νέο push στο ίδιο PR ακυρώνει τον προηγούμενο έλεγχο.
- **Βήματα:**
  1. `npm run build:public`
  2. `npm run quality:static`
  3. `npm run audit:runtime`
  4. `npm run test:author`
  5. `npm run test:standings`
- Timeout 25 λεπτά.

### 13.2 Publish Article (`auto-publish-author-pr.yml`)

Αυτό το workflow δημοσιεύει αυτόματα τα άρθρα που έρχονται από τα εργαλεία συντακτών.

- **Trigger:** `workflow_run` όταν ολοκληρωθεί το **Site Quality** σε branch `author/blog/**`, `author/import/**`, `author/delete/**` ή `author/edit/**`.
- **Προϋπόθεση:** το Site Quality πέτυχε και το event ήταν `pull_request`.

**Job `merge`** (`contents: write`, `pull-requests: write`, timeout 5 λεπτά):

1. **Έλεγχος του PR.** Η δημοσίευση παραλείπεται σιωπηλά αν:
   - το PR δεν είναι ανοιχτό,
   - είναι draft,
   - δεν στοχεύει στο `main`,
   - έρχεται από fork,
   - το branch δεν είναι `author/*`,
   - δεν έχει αλλαγμένα αρχεία.

   Αν το PR αλλάζει οποιοδήποτε αρχείο **έξω** από το `blog-module/blog-entries/`, το job **αποτυγχάνει**.
2. **Merge.** Τρέχει `gh pr merge --merge --delete-branch`.

**Job `publish`:** αν έγινε merge, καλεί το `publish-blog.yml` ως reusable workflow με `task: blog`. Εκεί τρέχει το job `publish_blog` (build, commit, push) και, αν έγινε commit, το deploy (ενότητα 13.3). Το build του blog υπάρχει έτσι σε ένα μόνο σημείο.

Στο tab Actions, ένα άρθρο φαίνεται λοιπόν ως δύο runs, **Site Quality** και **Publish Article**. Το build και το deploy είναι nested jobs μέσα στο Publish Article.

```text
generate.html / housekeeping.html
        |  branch author/... + commit + PR (GitHub API)
        v
Site Quality  (build:public, guards, tests)  -- αποτυχία --> το PR μένει ανοιχτό
        | επιτυχία
        v
Publish Article: έλεγχος PR -> merge
        |
        v
Site Maintenance (reusable, task: blog): mtimes -> blog build -> commit [skip ci] -> push main
        |
        v
Deploy Pages (reusable): build:public -> guards -> upload dist -> deploy
```

### 13.3 Site Maintenance (`publish-blog.yml`)

Κάνει τρεις ανεξάρτητες εργασίες, με ένα job για την καθεμία, και στο τέλος deploy.

**Triggers και schedule** (οι ώρες του cron είναι σε UTC):

| Cron | Job | Ώρα |
|---|---|---|
| `17 0,12 * * *` | `refresh_youtube` | κάθε μέρα 00:17 και 12:17 UTC |
| `59 20 * * 5`, `59 21 * * 5` | `refresh_standings_data` | Παρασκευή 23:59 ώρα Αθήνας |
| `1 4 * * 6`, `1 5 * * 6` | `refresh_standings_data` | Σάββατο 07:01 ώρα Αθήνας |
| `1 4 * * 1`, `1 5 * * 1` | `refresh_standings_data` | Δευτέρα 07:01 ώρα Αθήνας |

Το `publish_blog` δεν έχει schedule. Τρέχει μόνο όταν αλλάξει κάποιο άρθρο, αφού το build του blog βγάζει ίδιο αποτέλεσμα όταν δεν αλλάζει τίποτα.

Επιπλέον:

- **`push` στο `main`** που αλλάζει κάποιο από τα:
  - `blog-module/blog-entries/**`, `blog-processor.js`, `blog/template.html`,
  - το ίδιο το workflow.

  Αυτό τρέχει μόνο το `publish_blog`.
- **`workflow_dispatch`** με επιλογή `task`: `blog`, `standings` ή `youtube`.
- **`workflow_call`** με input `task`. Το χρησιμοποιεί το Publish Article με `task: blog`.

**Γιατί υπάρχουν δύο cron για κάθε ώρα των standings.** Το cron του GitHub είναι πάντα σε UTC, ενώ η Αθήνα αλλάζει μεταξύ UTC+2 (χειμώνας) και UTC+3 (θερινή ώρα). Γι' αυτό προγραμματίζονται και οι δύο εκδοχές. Το πρώτο βήμα του job υπολογίζει την ώρα Αθήνας από το cron που ενεργοποιήθηκε, όχι από το ρολόι, και συνεχίζει μόνο αν βγαίνει 23 ή 7. Το GitHub συχνά ξεκινά τα scheduled runs με καθυστέρηση, οπότε ένας έλεγχος με βάση το ρολόι θα παρέλειπε τα runs.

**Jobs:**

- **`publish_blog`**: checkout του `main` με πλήρες ιστορικό και επαναφορά των git mtimes. Κάθε αρχείο του `blog-entries/` παίρνει ως `mtime` την ώρα του τελευταίου commit που το άλλαξε. Το checkout δίνει σε όλα τα αρχεία την ίδια ώρα, οπότε χωρίς αυτό το βήμα ο incremental έλεγχος θα παρέλειπε άρθρα που άλλαξαν. Μετά `node blog-module/blog-processor.js` και `commit-and-push` με `chore(blog): auto-build generated artifacts [skip ci]`.
- **`refresh_youtube`**: `node scripts/build/fetch-youtube.mjs` και `commit-and-push` του `assets/youtube-latest.json` ως `chore(data): refresh youtube snapshot [skip ci]`.
- **`refresh_standings_data`**: `npm run build:standings-data` και `commit-and-push` των τεσσάρων `standings/*-cache.json` ως `chore(data): refresh standings snapshots [skip ci]`.
- **`deploy`**: καλεί το `deploy-pages.yml` **μόνο** αν κάποιο από τα παραπάνω jobs έκανε πραγματικό push.

Και τα τρία jobs είναι στο concurrency group `content-publishing`, και τα runs τους μπαίνουν σε ουρά. Έτσι δεν γράφουν ποτέ ταυτόχρονα στο `main`, ακόμα και όταν τα καλεί το Publish Article.

### 13.4 Deploy Pages (`deploy-pages.yml`)

- **Triggers:**
  - `workflow_call`, όταν το καλούν το Publish Article ή το Site Maintenance.
  - `push` στο `main`.
  - `workflow_dispatch`.
- **`paths-ignore` στο push:** τα ίδια paths που ενεργοποιούν το Site Maintenance. Μια αλλαγή σε άρθρο δεν κάνει deploy δύο φορές. Κάνει deploy μόνο το Site Maintenance, και μόνο αφού ξαναχτίσει το blog.
- **Δικαιώματα:** `contents: read`, `pages: write`, `id-token: write`.
- **Concurrency:** `pages`, σε ουρά.
- **Job `build`** (timeout 25 λεπτά): checkout του `main`, `setup`, `npm run build:public`, `npm run quality:static`, `npm run audit:runtime`, `actions/configure-pages@v6` και `actions/upload-pages-artifact@v5` με `path: dist`.
- **Job `deploy`:** `actions/deploy-pages@v5` στο environment `github-pages`.

### 13.5 Σημαντικές λεπτομέρειες

- **`[skip ci]` και reusable deploy.** Τα commits των workflows γίνονται με το `GITHUB_TOKEN`. Το GitHub δεν ξεκινά νέα workflows από τέτοια pushes, και επιπλέον έχουν `[skip ci]`. Γι' αυτό το deploy δεν περιμένει κάποιο push. Το workflow που έκανε το commit καλεί το ίδιο το `deploy-pages.yml`.
- **Ταυτότητα των commits.** Τα αυτόματα commits γίνονται με `user.name "Georgios Balatzis"` και `user.email "georgios.balatzis@gmail.com"`. Το `.mailmap` ενώνει τις παλιές ταυτότητες (bot, noreply) σε μία.
- **Secrets.** Δεν χρειάζεται κανένα secret. Όλα δουλεύουν με το αυτόματο `GITHUB_TOKEN` και δημόσια APIs.
- **Ρυθμίσεις του repository:**
  - Settings > Pages > Source πρέπει να είναι **GitHub Actions**. Το παλιό publishing από branch δεν χρησιμοποιείται.
  - Το custom domain ορίζεται από το `CNAME` (`f1stories.gr`).
  - Οι κανόνες προστασίας του `main` πρέπει να επιτρέπουν στο `GITHUB_TOKEN` να κάνει merge PR και push.
- **Χειροκίνητη εκτέλεση.** Actions > Site Maintenance > Run workflow > επιλογή `blog`, `standings` ή `youtube`. Για deploy χωρίς αλλαγές: Actions > Deploy Pages > Run workflow.
- **Όλοι οι δρόμοι προς την παραγωγή:**
  - push κώδικα στο `main`: Deploy Pages.
  - αλλαγή άρθρου με push ή schedule: Site Maintenance, και μετά Deploy Pages.
  - PR συντάκτη: Site Quality, Publish Article, Site Maintenance (`task: blog`), και μετά Deploy Pages.

---

## 14. Έλεγχοι ποιότητας και tests

| Εντολή | Τι ελέγχει | Τρέχει στο CI |
|---|---|---|
| `npm run pages:guard` | Workflows, allowlists και εργαλεία συντακτών τηρούν το μοντέλο δημοσίευσης. | ναι (μέσω `build:public`) |
| `npm run build:data-contracts` | Schema και έκδοση των generated JSON/XML. | ναι (μέσω `build:public`) |
| `npm run build:public` | Assembly και validation του `dist/`, χωρίς κλήσεις σε εξωτερικά APIs. | ναι |
| `npm run quality:static` | Static source κανόνες, ratchet στη χρήση `!important`, raw HTML rendering sinks (`innerHTML` κ.λπ.) σε σχέση με το `quality/rendering-sinks-baseline.json`. | ναι |
| `npm run audit:runtime` | Όρια του runtime μέσα στο `dist/` (εξαρτήσεις και επιφάνεια browser). | ναι |
| `npm run test:author` | Modules των εργαλείων συντακτών (`node --test`). | ναι (Site Quality) |
| `npm run test:standings` | Core modules των standings. | ναι (Site Quality) |
| `npm run build:check` | Αν το build άλλαξε committed generated αρχεία (drift). | όχι |
| `npm run test:blog` | Taxonomy tests και golden tests άρθρων. | όχι |
| `npm run test:taxonomy` | Μόνο τα taxonomy tests. | όχι |
| `npm run test:build` | Tests των build scripts (`scripts/build/__tests__`). | όχι |
| `npm run perf:budget` | Μέγεθος κρίσιμων CSS/JS σε σχέση με το `perf/size-budget.json` (ανοχή 10%). | όχι |
| `npm run perf:article-media` | Μέγεθος των εικόνων των άρθρων στο repo και απαγόρευση raw εικόνων. | όχι |
| `npm run perf:images` | Καμία δημόσια εικόνα πάνω από 300 KB. | όχι |
| `npm run test:consent` | Τα analytics δεν φορτώνουν πριν από συγκατάθεση (Chrome). | όχι |
| `npm run qa:visual` | Screenshots σε desktop και mobile, overflow, σπασμένες εικόνες, landmarks, focus, contrast, tabs, 404 (Chrome, πάνω στο `dist/`). Αποτελέσματα στο `perf/visual-qa/`. | όχι |
| `npm run perf:lighthouse` | Lighthouse budgets ανά route πάνω στο `dist/` (Chrome). | όχι |
| `npm run verify` | Όλα τα παραπάνω με τη σειρά. Είναι ο πλήρης έλεγχος πριν από release. | όχι |

Τα baselines ενημερώνονται μόνο σκόπιμα, μετά από review:

```bash
npm run perf:budget:update
npm run perf:article-media:update
npm run quality:rendering:update
```

---

## 15. Όλα τα npm scripts

| Script | Εντολή / ρόλος |
|---|---|
| `build` | `build:html`, `build:youtube`, `build:blog`, `build:assets` |
| `build:html` | Expand των partials (`include.mjs`) |
| `build:youtube` | YouTube snapshot |
| `build:blog` / `build:blog:force` | Build του blog, incremental ή πλήρες |
| `build:standings-data` | Και τα τέσσερα cache των standings |
| `build:assets` | Sponsors, icon sprite, Bootstrap, minify, stamp |
| `build:assets:minify` | Μόνο minify |
| `build:assets:stamp` | `build:html` και μετά stamp |
| `build:assets:watch` | Minify σε κάθε αλλαγή |
| `build:bootstrap` | Χτίζει το `styles/vendor/bootstrap.slim.css` με Sass |
| `build:icons` | Μόνο το icon sprite |
| `build:sponsors` | Κανονικοποίηση των λογοτύπων των sponsors |
| `build:fonts` | Κατεβάζει τα self-hosted fonts |
| `build:images` | `build:logo`, `build:driver-headshots`, `build:team-logos` |
| `build:image-variants` | `generate-image-variants.js --run` |
| `build:article-image-backfill` | Προσθέτει `width`/`height` στις εικόνες των παλιών άρθρων |
| `build:public` | Το δημόσιο artifact `dist/` (ενότητα 11) |
| `build:data-contracts` | Έλεγχος των generated contracts |
| `build:check` | Drift guard |
| `check:assets` | Ελέγχει ότι υπάρχουν τα generated assets που χρειάζεται το preview |
| `preview` | `build:assets`, `check:assets` και preview server στη θύρα 4173 |
| `pages:guard` | Έλεγχος του μοντέλου δημοσίευσης |
| `quality:static`, `quality:rendering`, `quality:rendering:update` | Static guards |
| `audit:runtime` | Runtime audit του `dist/` |
| `test:blog`, `test:taxonomy`, `test:author`, `test:standings`, `test:build`, `test:consent` | Tests |
| `perf:budget`, `perf:article-media`, `perf:images`, `perf:lighthouse` (και `:update`) | Performance guards |
| `qa:visual` | Visual QA |
| `verify` | Πλήρης έλεγχος |

---

## 16. Μεταβλητές περιβάλλοντος

Όλες είναι προαιρετικές.

| Μεταβλητή | Script | Προεπιλογή | Ρόλος |
|---|---|---|---|
| `BLOG_WORKERS` | `build:blog` | πυρήνες CPU | Μέγιστος αριθμός workers |
| `YOUTUBE_CHANNEL_ID` | `build:youtube` | κανάλι F1 Stories | Άλλο κανάλι |
| `PREVIEW_HOST` / `PREVIEW_PORT` | `preview` | `127.0.0.1` / `4173` | Διεύθυνση του preview server |
| `AUTHOR_HOST` / `AUTHOR_PORT` | `serve-tools.mjs` | `127.0.0.1` / `4179` | Διεύθυνση του server των εργαλείων |
| `CHROME_PATH` | `qa:visual`, `perf:lighthouse`, `test:consent` | αυτόματος εντοπισμός | Διαδρομή του Chrome |
| `PUPPETEER_EXECUTABLE_PATH` | `qa:visual` | | Εναλλακτική του `CHROME_PATH` |
| `LIGHTHOUSE_ROOT`, `LIGHTHOUSE_BUDGET_PATH`, `LIGHTHOUSE_OUTPUT_DIR`, `LIGHTHOUSE_KEEP_JSON`, `LIGHTHOUSE_CHROME_FLAGS` | `perf:lighthouse` | | Ρυθμίσεις του Lighthouse guard |

---

## 17. Source, generated και ignored αρχεία

**Source.** Τα επεξεργάζεστε και τα ελέγχετε στο review ως κώδικα:

- `package*.json`, `.github/workflows/`, `partials/`
- τα root HTML shells, όλα τα source `.css`/`.js`
- `blog-module/build/`, `blog-module/blog/`
- τα εργαλεία συντακτών
- `scripts/**`, `docs/`
- τα `source.txt`, οι εικόνες και τα CSV των άρθρων

**Generated και committed.** Δεν τα επεξεργάζεστε με το χέρι. Τα ξαναπαράγετε με την εντολή που αναφέρεται:

| Αρχείο | Εντολή |
|---|---|
| Μπλοκ `@include` στα shells | `build:html` |
| `?v=` references, inline sprite, editorial shell στα άρθρα | `build:assets` |
| `blog-module/blog-entries/*/article.html` και παραλλαγές εικόνων | `build:blog` |
| `blog-index-data.json`, `blog-index-page-1.json`, `blog-source-cache.json`, `home-latest.json` | `build:blog` |
| Static first page στο `blog/index.html`, κύριο άρθρο στο `index.html` | `build:blog` |
| `sitemap.xml` | `build:blog` |
| `assets/youtube-latest.json` | `build:youtube` |
| `standings/*-cache.json` | `build:standings-data` |

**Ignored.** Δεν γίνονται ποτέ commit:

- `node_modules/`, `dist/`, `.build/pages/`
- `*.min.css`, `*.min.js`, source maps, `scripts/build/asset-manifest.json`
- `styles/vendor/bootstrap.slim.css`, `images/icons/sprite.svg`, `standings/chunks/`
- `blog-module/blog-data.json`, `blog-entries/*/extracted/`, `*.docx`, `*.bak`
- `perf/visual-qa/`, `audit/`, `graphify-out/`
- τοπικές σημειώσεις (`context.md`, `nextsteps.txt`, `laststeps.txt`, `appdev.txt`), `.idea/`

---

## 18. Εξωτερικές υπηρεσίες

| Υπηρεσία | Χρήση | Πότε |
|---|---|---|
| Jolpica (`api.jolpi.ca`, Ergast mirror) | Βαθμολογίες | build και browser |
| OpenF1 (`api.openf1.org`) | Sessions, laps, stints, pit stops, debrief, dirty air | build και browser |
| F1 Top App (`f1.top-app.eu`) | Destructors championship | build |
| Formula1.com media CDN | Φωτογραφίες οδηγών και λογότυπα ομάδων | χειροκίνητο build |
| YouTube RSS | Snapshot των πρόσφατων videos | build |
| Google Analytics 4 | Analytics και Web Vitals (`web_vital` event), μόνο μετά από συγκατάθεση | browser |
| GA4 Data API και Google Identity | Dashboard στο `statistics.html` | εργαλείο συντακτών |
| Formspree | Φόρμα επικοινωνίας της αρχικής | browser |
| Disqus (`f1stories-gr`) | Σχόλια άρθρων | browser |
| YouTube, Spotify, X, Instagram, Threads, Facebook κ.λπ. | Embeds μέσα στα άρθρα | browser |
| GitHub REST API | Δημοσίευση από τα εργαλεία συντακτών | εργαλείο συντακτών |

Αν μία από αυτές τις υπηρεσίες δεν είναι διαθέσιμη, οι σελίδες συνεχίζουν να λειτουργούν με τα committed snapshots. Τα builds συνεχίζουν με warnings, εκτός αν λείπει εντελώς το αρχείο που θα έπρεπε να παραχθεί.

---

## 19. Συνηθισμένες εργασίες

### Νέο άρθρο (προτεινόμενος τρόπος)

1. `node scripts/author/serve-tools.mjs` και άνοιγμα του `generate.html`, ή απευθείας το `https://f1stories.gr/generate.html`.
2. Συμπλήρωση των πέντε βημάτων και «Δημοσίευση».
3. Τα υπόλοιπα γίνονται αυτόματα (ενότητα 13.2). Το άρθρο εμφανίζεται στο site μέσα σε λίγα λεπτά.

### Νέο άρθρο χειροκίνητα

```bash
mkdir blog-module/blog-entries/20260923G
# αντιγραφή source.txt, 1.webp, 2.webp, 3.webp ... στον φάκελο
npm run build:blog
npm run preview                 # έλεγχος στο http://127.0.0.1:4173/
git checkout -b article/20260923G
git add blog-module/blog-entries/20260923G
git commit -m "feat(blog): νέο άρθρο"
```

Μετά ανοίγετε PR. Αν κάνετε push κατευθείαν στο `main`, το Site Maintenance θα χτίσει και θα κάνει deploy.

### Διόρθωση κειμένου σε υπάρχον άρθρο

Από το `housekeeping.html` > επιλογή άρθρου > επεξεργασία > PR. Εναλλακτικά, αλλάζετε το `source.txt` και τρέχετε `npm run build:blog`.

### Αλλαγή στο template των άρθρων ή στο build του blog

```bash
npm run build:blog:force
node blog-module/build/__tests__/run-golden.js --update
npm run test:blog
npm run build:check
```

Γίνονται commit μαζί οι αλλαγές στον κώδικα, τα αναγεννημένα άρθρα και τα fixtures.

### Αλλαγή σε CSS ή JS

```bash
npm run build:assets    # για να ενημερωθούν τα ?v= στα HTML
npm run perf:budget
```

Γίνονται commit τα sources και τα HTML με τα νέα hashes, όχι τα `.min`.

### Αλλαγή σε partial (head ή footer)

```bash
npm run build           # ή: npm run build:html && npm run build:assets:stamp
```

### Νέα δημόσια σελίδα ή νέο δημόσιο asset

1. Προσθήκη στο allowlist του `scripts/build/public-artifact.mjs`.
2. Προσθήκη στο `scripts/build/validate-public-artifact.mjs`, αν είναι απαιτούμενο αρχείο.
3. Αν η σελίδα χρησιμοποιεί partials, προσθήκη στο `TARGET_HTML` του `include.mjs` και του `stamp-html.mjs`.
4. Νέες εξωτερικές πηγές στο `scripts/build/security-policy.mjs`.
5. `npm run build:public` για έλεγχο.

### Αλλαγή μορφής σε generated JSON

Ενημερώνετε στην ίδια αλλαγή το `scripts/build/validate-data-contracts.mjs` και το `docs/data-contracts.md`.

### Άμεση ανανέωση των standings

Actions > Site Maintenance > Run workflow > `standings`. Τοπικά: `npm run build:standings-data`.

---

## 20. Αντιμετώπιση προβλημάτων

| Σύμπτωμα | Αιτία και λύση |
|---|---|
| Το site δεν φορτώνει CSS/JS τοπικά | Λείπουν τα `.min` αρχεία. Τρέξτε `npm run preview` ή `npm run build:assets`. |
| Σελίδες χωρίς στυλ ή με 404 σε `file://` | Το site χρειάζεται server. Τρέξτε `npm run preview`. |
| Το άρθρο δεν ξαναχτίστηκε μετά από αλλαγή | Το incremental build βασίζεται στο `mtime`. Κάντε `touch` στο `source.txt` ή τρέξτε `npm run build:blog:force`. |
| Το Publish Article δεν έκανε τίποτα | Ελέγξτε ότι το PR δεν είναι draft, ότι το branch είναι `author/*`, ότι είναι από το ίδιο repo και ότι το Site Quality πέτυχε. |
| Το Publish Article απέτυχε με «files outside blog entries» | Το PR αλλάζει αρχεία εκτός του `blog-module/blog-entries/`. Κάντε merge χειροκίνητα μετά από review, ή χωρίστε το PR. |
| Το Site Maintenance έτρεξε αλλά δεν έγινε deploy | Το job δεν έκανε commit γιατί δεν υπήρχαν αλλαγές. Αυτό είναι αναμενόμενο. Για deploy, τρέξτε χειροκίνητα το Deploy Pages. |
| Το scheduled standings run γράφει `run=false` | Ήταν το cron της άλλης ζώνης ώρας (EET/EEST). Αυτό είναι αναμενόμενο. |
| Το `build:public` αποτυγχάνει στον validator | Διαβάστε το μήνυμα. Συνήθως είναι νέο αρχείο που δεν είναι στο allowlist, σπασμένο reference ή λάθος CSP. |
| Το `perf:article-media` αποτυγχάνει | Προστέθηκε raw JPG/PNG/GIF. Μετατρέψτε το σε WebP/AVIF ή ενημερώστε το baseline με αιτιολόγηση. |
| Το `qa:visual` / `perf:lighthouse` δεν βρίσκει Chrome | Ορίστε `CHROME_PATH`. |
| Κενό icon σε κάποια σελίδα | Το sprite δεν είναι ενημερωμένο. Τρέξτε `npm run build:assets` και `npm run check:assets`. |
| Ο browser δείχνει παλιά έκδοση | Κάντε hard reload. Αν επιμένει, ελέγξτε στο DevTools > Application ότι δεν υπάρχει service worker (το `sw-cleanup.js` τον αφαιρεί στην πρώτη επίσκεψη). |

---

## 21. Σχετικά έγγραφα

| Αρχείο | Περιεχόμενο |
|---|---|
| `docs/static-publishing-model.md` | Αναλυτικό μοντέλο δημοσίευσης, ownership αρχείων, decision records. |
| `docs/data-contracts.md` | Μορφή και εκδόσεις των generated JSON. |
| `docs/article-media-policy.md` | Πολιτική εικόνων άρθρων και baseline. |
| `docs/css-architecture.md` | Ποιο CSS ανήκει σε ποια σελίδα και σειρά φόρτωσης. |
| `docs/security-headers.md` | CSP, headers, Cloudflare. |
| `docs/release-checklist.md` | Checklist πριν από release. |
| `DESIGN.md` | Design system όπως είναι υλοποιημένο. |
| `KEEP.md` | Χαρακτηριστικά της εμφάνισης που πρέπει να διατηρηθούν. |
| `REPO_CLEANUP_REPORT.md`, `HISTORY_REWRITE_PLAN.md` | Καθαρισμός του repo και επανεγγραφή του ιστορικού (2026-09-23). |
| `perf/baseline-2026-04-20.md` | Αρχικό performance baseline. |
