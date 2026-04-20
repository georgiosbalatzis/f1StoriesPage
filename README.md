# F1 Stories

Το `f1stories.github.io` είναι το αποθετήριο του public website του F1 Stories: μιας στατικής, content-first πλατφόρμας για podcasting, αρθρογραφία, live Formula 1 dashboards και εξειδικευμένα microsurfaces γύρω από δεδομένα, ανάλυση και community content.

Το project είναι σχεδιασμένο με λογική static publishing και όχι ως κλασικό SPA ή framework app. Η βάση του είναι HTML, CSS και vanilla JavaScript, ενώ τα δυναμικά τμήματα ενισχύονται είτε με build-time generation είτε με client-side φόρτωση δεδομένων από εξωτερικές πηγές και τοπικά cache bundles.

> Το F1 Stories συνδυάζει editorial περιεχόμενο, podcast identity και data-driven Formula 1 εργαλεία σε ένα ενιαίο static-first web product. Το repository αυτό είναι ο λειτουργικός πυρήνας αυτής της εμπειρίας: από την αρχική σελίδα και το blog μέχρι τα standings dashboards, τα cache builders και τα βοηθητικά publishing scripts.

## Περιεχόμενα

- [Σύνοψη προϊόντος](#product-overview)
- [Τι είναι αυτό το project](#project-purpose)
- [Κύρια τμήματα της εφαρμογής](#application-sections)
- [Τεχνολογική προσέγγιση](#technical-approach)
- [Δομή αποθετηρίου](#repository-structure)
- [Ροή περιεχομένου blog](#blog-content-pipeline)
- [Data pipeline για standings](#standings-data-pipeline)
- [Τοπική ανάπτυξη](#local-development)
- [Απαιτούμενα εργαλεία για content build](#build-requirements)
- [Βασικά commands συντήρησης](#maintenance-commands)
- [Design και εμπειρία χρήστη](#design-and-ux)
- [Εξωτερικές υπηρεσίες και integrations](#integrations)
- [Deployment λογική](#deployment)
- [Πρακτικές σημειώσεις για maintainers](#maintainer-notes)
- [Γιατί αυτό το repository έχει ενδιαφέρον](#why-this-repo-matters)

<a id="product-overview"></a>
## Σύνοψη προϊόντος

Από πλευράς προϊόντος, το F1 Stories δεν είναι απλώς ένα ακόμη informational site για τη Formula 1. Είναι μια ενιαία ψηφιακή παρουσία που συνδέει:

- branded homepage για το podcast και το community
- editorial blog με long-form ανάλυση, embeds, custom media και structured article pages
- live και near-live dashboards με βαθμολογίες και advanced race metrics
- auxiliary routes που λειτουργούν ως είσοδος προς εξωτερικά εργαλεία του οικοσυστήματος

Αυτό κάνει το repository χρήσιμο σε τρία επίπεδα:

- ως website codebase
- ως content publishing workflow
- ως data presentation layer για motorsport analytics

<a id="project-purpose"></a>
## Τι είναι αυτό το project

Ο βασικός ρόλος του repository είναι να υποστηρίζει:

- την κεντρική σελίδα του brand `F1 Stories`
- το blog και τη ροή δημοσίευσης άρθρων
- dashboards βαθμολογιών και advanced metrics για τη Formula 1
- βοηθητικές landing pages και redirects προς εξωτερικά εργαλεία
- νομικές σελίδες και shared UI υποδομή για ολόκληρο το site

Πρακτικά, πρόκειται για ένα hybrid publishing system:

- static στο presentation layer
- scripted στο content generation layer
- API-assisted στο data layer

Αυτή η προσέγγιση επιτρέπει γρήγορο φόρτωμα, απλή φιλοξενία σε GitHub Pages ή αντίστοιχο static host, και ταυτόχρονα αρκετά πλούσιο functionality χωρίς frontend framework.

<a id="application-sections"></a>
## Κύρια τμήματα της εφαρμογής

### Αρχική σελίδα

Η ρίζα του project, στο [index.html](./index.html), λειτουργεί ως το βασικό landing page του brand και περιλαμβάνει:

- hero section για το podcast
- latest content area με tabs για βίντεο και άρθρα
- ομάδα παρουσιαστών και guests
- sponsor strip
- φόρμα επικοινωνίας μέσω Formspree
- shared navigation με countdown για τον επόμενο αγώνα

Η αρχική σελίδα τραβά τα πιο πρόσφατα blog posts από το παραγόμενο `blog-index-data.json` μέσω του [blog-loader.js](./blog-module/blog-loader.js).

### Blog module

Το blog ζει κάτω από το `blog-module/` και είναι το σημαντικότερο publishing subsystem του repo. Περιλαμβάνει:

- index σελίδα blog
- template για article pages
- generator που μετατρέπει source content σε έτοιμο HTML
- metadata bundles για homepage και blog listing
- βοηθητικά εργαλεία για εικόνες, TTS και caches

Η παραγωγή άρθρων γίνεται κυρίως από το [blog-processor.js](./blog-module/blog-processor.js), το οποίο:

- διαβάζει άρθρα από `blog-module/blog-entries/`
- υποστηρίζει source αρχεία `.docx` και `.txt`
- εντοπίζει και οργανώνει εικόνες άρθρων με συμβατικό naming
- μετατρέπει embedded media και external links σε ασφαλές HTML
- δημιουργεί `article.html` για κάθε post
- παράγει τα `blog-data.json` και `blog-index-data.json`
- συνδέει related articles, previous/next navigation και metadata
- ανανεώνει τα cache bundles που χρησιμοποιεί το standings dashboard

### Standings και data dashboards

Το route `/standings/`, με entry τα [standings/index.html](./standings/index.html), αποτελεί ξεχωριστό analytics surface για τη σεζόν της Formula 1.

Το subsystem αυτό δεν περιορίζεται μόνο σε κλασικές βαθμολογίες. Περιλαμβάνει πολλαπλές όψεις και custom visual analyses όπως:

- βαθμολογία οδηγών
- βαθμολογία κατασκευαστών
- teammate qualifying gaps
- lap 1 gains
- tyre pace distributions
- dirty air analysis
- track dominance
- pit stop comparisons
- destructors championship

Το rendering και η data orchestration γίνονται κυρίως από το [standings/standings.js](./standings/standings.js), ενώ η εμφάνιση ορίζεται στο [standings/standings.css](./standings/standings.css).

### Redirect pages και auxiliary routes

Το αποθετήριο περιλαμβάνει και lightweight routes που λειτουργούν ως redirect ή bridge προς ανεξάρτητα εργαλεία:

- [f1telemetry/index.html](./f1telemetry/index.html)
- [ghostcar/index.html](./ghostcar/index.html)

Οι σελίδες αυτές υπάρχουν κυρίως για canonical routing, social previews και ομαλή μετάβαση σε εξωτερικά projects.

### Νομικές σελίδες και shared infrastructure

Το folder `privacy/` περιέχει τους βασικούς νομικούς πόρους του site, ενώ στο `scripts/` και `styles/` βρίσκονται τα κοινά components υποδομής, όπως:

- analytics
- cookie consent
- shared navigation
- service worker registration
- κοινό styling για legal και global navigation

<a id="technical-approach"></a>
## Τεχνολογική προσέγγιση

Το project ακολουθεί μια συνειδητά απλή αλλά αποτελεσματική στοίβα:

- HTML για page structure
- CSS για theming, layout και responsive behavior
- vanilla JavaScript για client-side interaction και data rendering
- Bootstrap όπου χρειάζεται για baseline layout utilities
- Node.js scripts για content build και data preparation
- Python script για build-time text-to-speech generation

Δεν υπάρχει frontend bundler, framework router ή component runtime τύπου React/Vue/Next. Αυτό κρατά το deployment απλό και ταιριαστό σε static hosting, αλλά μεταφέρει μέρος της πειθαρχίας στην οργάνωση αρχείων, naming conventions και helper scripts.

<a id="repository-structure"></a>
## Δομή αποθετηρίου

Η ουσιαστική δομή του project είναι η εξής:

```text
.
├── index.html
├── README.md
├── blog-module/
│   ├── blog/
│   ├── blog-entries/
│   ├── blog-data.json
│   ├── blog-index-data.json
│   ├── blog-loader.js
│   ├── blog-processor.js
│   ├── blog-fixes.js
│   ├── blog-styles.css
│   ├── dirty-air-cache.js
│   ├── destructors-cache.js
│   ├── generate-image-variants.js
│   ├── convert-to-avifwebp.sh
│   └── tts-generator-parallel.py
├── standings/
│   ├── index.html
│   ├── standings.js
│   ├── standings.css
│   ├── dirty-air-cache.json
│   └── destructors-cache.json
├── scripts/
├── styles/
├── images/
├── ghostcar/
├── f1telemetry/
└── privacy/
```

<a id="blog-content-pipeline"></a>
## Πώς λειτουργεί η ροή περιεχομένου του blog

Η πιο σημαντική παραγωγική ροή του repo είναι η ροή δημιουργίας άρθρων.

### Source of truth

Κάθε άρθρο ζει σε δικό του folder μέσα στο `blog-module/blog-entries/`. Το naming convention ακολουθεί ημερομηνιακή λογική, συνήθως σε μορφές όπως:

```text
YYYYMMDDX
YYYYMMDD-1X
```

όπου το τελικό γράμμα χρησιμοποιείται ως author code.

### Αναμενόμενα αρχεία ανά post

Ένα folder άρθρου μπορεί να περιλαμβάνει:

- source κείμενο σε `.docx` ή `.txt`
- `1.*` ως thumbnail / primary image
- `2.*` ως background image
- `3.*`, `4.*`, `5.*` κ.ο.κ. ως content images
- `.csv` αρχεία για article tables
- `.html` ή `.svg` αρχεία για embeds όπου αυτό επιτρέπεται

### Τι κάνει ο blog processor

Όταν εκτελείται το `blog-processor.js`:

1. εντοπίζει νέα ή αλλαγμένα άρθρα
2. μετατρέπει DOCX περιεχόμενο σε HTML
3. εξάγει και οργανώνει media
4. δημιουργεί responsive εικόνες μέσα στο article content
5. συνθέτει το τελικό `article.html` με βάση το template
6. ανανεώνει τα συνολικά JSON feeds του blog
7. υπολογίζει related posts
8. συμπληρώνει previous/next article navigation
9. ανανεώνει τα cache αρχεία του standings module

Το script υποστηρίζει incremental rebuilds και `--force` mode για πλήρη αναδημιουργία.

<a id="standings-data-pipeline"></a>
## Data pipeline για τα standings

Το standings section είναι το πιο data-heavy μέρος του site. Η λογική του είναι μικτή:

- live client-side fetch από public APIs
- local cache bundles για ακριβά ή πιο εύθραυστα datasets
- curated mappings για λογότυπα, χρώματα ομάδων και driver headshots

### Κύριες πηγές δεδομένων

- `Jolpica / Ergast mirror` για championship standings
- `OpenF1` για sessions, drivers, laps, stints και telemetry-adjacent datasets
- `Formula1.com media CDN` για team logos και driver headshots
- `F1 Top App` για destructors standings μέσω HTML parsing

### Local cache artifacts

Τα παρακάτω αρχεία αποθηκεύονται στο repo και λειτουργούν ως intermediate outputs:

- [standings/dirty-air-cache.json](./standings/dirty-air-cache.json)
- [standings/destructors-cache.json](./standings/destructors-cache.json)

Αυτά δημιουργούνται ή ανανεώνονται από:

- [blog-module/dirty-air-cache.js](./blog-module/dirty-air-cache.js)
- [blog-module/destructors-cache.js](./blog-module/destructors-cache.js)

Σημαντικό: δεν είναι πλήρως αυτόνομα CLI scripts. Η κύρια αναμενόμενη ροή είναι να ενεργοποιούνται από το `blog-processor.js`.

<a id="local-development"></a>
## Τοπική ανάπτυξη

Επειδή το site χρησιμοποιεί absolute paths όπως `/blog-module/...` και `/standings/...`, πρέπει να σερβίρεται από τη ρίζα του repository και όχι να ανοίγεται απευθείας με `file://`.

### Γρήγορο local preview

Από τη ρίζα του project:

```bash
python3 -m http.server 8080
```

και μετά:

```text
http://localhost:8080/
```

### Προτεινόμενες runtime προϋποθέσεις

- Node.js 18 ή νεότερο
- Python 3.10 ή νεότερο

Το Node 18+ είναι ουσιαστικά αναγκαίο, επειδή αρκετά scripts βασίζονται στο built-in `fetch`.

<a id="build-requirements"></a>
## Απαιτούμενα εργαλεία για content build

Το αποθετήριο δεν περιλαμβάνει σήμερα ολοκληρωμένο `package.json`, οπότε οι εξαρτήσεις των build scripts είναι implicit και πρέπει να υπάρχουν στο περιβάλλον του maintainer.

### Node dependencies

Το `blog-processor.js` χρησιμοποιεί:

- `mammoth`
- `sharp`
- `adm-zip`

Ενδεικτική εγκατάσταση:

```bash
npm install mammoth sharp adm-zip
```

### Python dependencies

Το [tts-generator-parallel.py](./blog-module/tts-generator-parallel.py) απαιτεί:

- `edge-tts`
- `beautifulsoup4`

Ενδεικτική εγκατάσταση:

```bash
pip install edge-tts beautifulsoup4
```

### Προαιρετικά system tools

Το [convert-to-avifwebp.sh](./blog-module/convert-to-avifwebp.sh) υποθέτει macOS/Homebrew περιβάλλον και χρησιμοποιεί:

- `trash`
- `cwebp` από το package `webp`

<a id="maintenance-commands"></a>
## Βασικά commands συντήρησης

### Αναδημιουργία blog content

```bash
node blog-module/blog-processor.js
```

Για πλήρες rebuild:

```bash
node blog-module/blog-processor.js --force
```

### Δημιουργία image variants

Preview χωρίς write:

```bash
node blog-module/generate-image-variants.js
```

Πραγματική παραγωγή:

```bash
node blog-module/generate-image-variants.js --run
```

Force regeneration:

```bash
node blog-module/generate-image-variants.js --run --force
```

### Δημιουργία TTS narration για άρθρα

Για όσα posts δεν έχουν ήδη narration:

```bash
python3 blog-module/tts-generator-parallel.py
```

Για πλήρη αναπαραγωγή:

```bash
python3 blog-module/tts-generator-parallel.py --force
```

Για συγκεκριμένο post:

```bash
python3 blog-module/tts-generator-parallel.py --post 20250101G
```

<a id="design-and-ux"></a>
## Design και εμπειρία χρήστη

Το project δεν είναι απλώς data container. Υπάρχει εμφανής έμφαση σε:

- branded visual identity
- mobile-friendly εμπειρία
- shared navigation σε όλες τις σελίδες
- dark/light theme behavior
- social previews και metadata
- loading states, skeletons και lazy loading
- lightweight client-side enhancement χωρίς βαρύ runtime

Ιδιαίτερα το standings module δείχνει μια πιο editorial αντιμετώπιση των δεδομένων: όχι απλή παράθεση πινάκων, αλλά παρουσίαση με tabs, cards, charts, share/embed εργαλεία και tailored visual language.

<a id="integrations"></a>
## Εξωτερικές υπηρεσίες και integrations

Το site συνεργάζεται με τρίτες υπηρεσίες για συγκεκριμένες λειτουργίες:

- Google Analytics 4 μέσω του [scripts/analytics.js](./scripts/analytics.js)
- Formspree για την φόρμα επικοινωνίας
- YouTube για videos και embeds
- OpenF1 και Jolpica για motorsport data
- Formula1.com media CDN για official media assets

Αυτό σημαίνει ότι μέρος της συμπεριφοράς του site εξαρτάται από την υγεία και τη συμβατότητα αυτών των upstream υπηρεσιών.

<a id="deployment"></a>
## Deployment λογική

Η δομή του αποθετηρίου και τα routes δείχνουν ότι το project είναι προσανατολισμένο σε static hosting με root deployment, όπως:

- GitHub Pages
- custom domain που σερβίρει το repository root
- οποιοδήποτε static file host που διατηρεί ίδιες διαδρομές

Πριν από publish σε production, η ασφαλής ροή είναι:

1. ενημέρωση ή προσθήκη περιεχομένου στο `blog-module/blog-entries/`
2. εκτέλεση `blog-processor.js`
3. έλεγχος ότι ενημερώθηκαν σωστά τα `blog-data.json`, `blog-index-data.json` και τα cache bundles
4. local preview του site
5. deploy των static artifacts

<a id="maintainer-notes"></a>
## Πρακτικές σημειώσεις για maintainers

- Το blog subsystem είναι convention-driven. Αν τα filenames των εικόνων ή των source documents παρεκκλίνουν, το build μπορεί να μην παράξει το αναμενόμενο αποτέλεσμα.
- Το standings module συνδυάζει live fetch και local fallback data. Άρα κάποια regressions ενδέχεται να εμφανίζονται μόνο σε πραγματικό runtime και όχι σε απλή ανάγνωση κώδικα.
- Η απουσία ενιαίου package manifest σημαίνει ότι το περιβάλλον build χρειάζεται λίγη χειροκίνητη πειθαρχία.
- Το `blog-processor.js` δεν παράγει μόνο άρθρα. Ανανεώνει και supporting datasets που επηρεάζουν το `/standings/`.
- Τα redirect routes σε `f1telemetry/` και `ghostcar/` είναι μέρος της public εμπειρίας του domain και δεν πρέπει να αντιμετωπίζονται ως άσχετα placeholder αρχεία.

<a id="why-this-repo-matters"></a>
## Γιατί αυτό το repository έχει ενδιαφέρον

Το project είναι ένα καλό παράδειγμα για το πώς μπορεί να στηθεί ένα media/product site χωρίς βαρύ framework, αλλά με αρκετά ώριμη λογική publishing:

- static-first για απόδοση και απλότητα
- scripted automation για editorial workflows
- selective χρήση APIs για live αθλητικά δεδομένα
- local caches όπου οι upstream πηγές είναι ασταθείς ή ακριβές
- καθαρός διαχωρισμός ανάμεσα σε brand site, content system και analytics surfaces

Με απλά λόγια, το `f1stories.github.io` δεν είναι μόνο ένα website. Είναι το λειτουργικό publishing layer του F1 Stories.

<a id="performance-budget"></a>
## Performance budget

Ένα ελαφρύ guardrail για το βάρος των critical JS/CSS assets. Το budget ζει στο `perf/size-budget.json` και ελέγχεται με το script `scripts/perf/size-guard.mjs`.

- `npm run perf:budget` — τρέχει τον έλεγχο· exit code 1 αν οποιοδήποτε tracked αρχείο έχει μεγαλώσει πάνω από `thresholdPercent` (default 10%) σε σχέση με το αποθηκευμένο baseline.
- `npm run perf:budget:update` — ξαναγράφει το baseline με τα τρέχοντα μεγέθη. Τρέξε το μόνο μετά από συνειδητό perf review (π.χ. μετά από Phase 1 minification).
- Ο πρώτος baseline ελήφθη στις `2026-04-20` (βλ. `perf/baseline-2026-04-20.md`) — είναι το reference point για κάθε φάση optimization που ακολουθεί στο `nextsteps.txt`.

Επίσης, κάθε σελίδα landing (home, blog index, standings, article template) φορτώνει το `scripts/perf/web-vitals-beacon.js` μέσα σε `requestIdleCallback` και στέλνει στο GA4 event `web_vital` με `metric_name`, `metric_value`, `metric_rating`, `page_path`. Οι ζωντανές τιμές δημιουργούν ένα RUM dataset για LCP/INP/CLS/FCP/TTFB ανά route — αυτό είναι το χρήσιμο signal πριν και μετά από κάθε perf phase.
