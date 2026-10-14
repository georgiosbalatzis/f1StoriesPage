# Article Media Policy

This repository publishes a static site through GitHub Pages. Article media can stay in the repository when it is needed to build or serve the static article experience, but raw originals must not grow silently.

## Source Of Truth

- Article source text lives in each `blog-module/blog-entries/<entry>/` folder.
- Public article media should be optimized AVIF/WebP variants.
- The build-generated `embeds/telemetry-<sha256>-<variant>.svg` files are an intentional vector-chart exception. The telemetry publisher validates their XML, bounds each file to 1 MiB, names assets from the immutable publication bundle, and the public artifact copies only those referenced generated variants. SVGs are not raw photo uploads and are not included in the photo media budget.
- Raw JPG, JPEG, PNG, and GIF files are treated as reviewed source assets, not default public assets.
- Generated/public delivery size is guarded separately from repository size.

## Rules

- Do not add new raw article images unless there is a clear reason to keep the original in git.
- Convert article images to optimized AVIF/WebP variants before publishing.
- Keep card and small variants generated and reviewable.
- If a raw original must stay, update `perf/article-media-budget.json` in the same review and explain why.
- If the total article media budget grows, check whether the growth came from a real article need or an avoidable raw asset.

## Ingestion (author tools)

`generate.html` and `housekeeping.html` size every article image in the browser
before a ZIP export or an author PR is created (`ARTICLE_IMAGE_POLICY` in
`scripts/author/image-tools.js`):

- at most **1600 px wide**, matching the widest public variant, with the aspect
  ratio preserved and no upscaling;
- at most **300 KiB (307,200 bytes)**, matching the public image budget. WebP
  quality starts at 0.9 and steps down only when needed. If quality alone cannot
  meet the cap, the browser reduces dimensions and retries from the original;
- a genuine WebP that already fits is uploaded byte for byte. Imports with a
  misleading extension are converted rather than passed through;
- unsupported WebP encoding, unreadable images, and an impossible budget fail
  with an error instead of producing a mislabeled or oversized upload.

These are publication-ready originals, replacing the former 3200 px / 1 MiB
masters. Some fidelity is traded for smaller uploads and faster publication.
The public artifact copies these originals without re-encoding them. The build
still creates responsive AVIF/WebP variants; cached CI compression remains a
fallback for oversized images committed outside the author tools.

`npm run qa:author-images` runs the browser code in Chromium on generated
fixtures and real article photos. It checks format, dimensions, aspect ratio,
byte limits, unchanged fitting WebP files, difficult oversized images, failure
cases, and that every output bypasses the public optimizer. Reader-facing AVIF
PSNR against the previous master policy is reported for comparison, rather than
requiring fidelity equivalent to the larger masters.

The repository media guard retains its separate historical limits. Existing
originals can be checked with `npm run build:article-originals` (dry run; `--write`
to apply, `--all` to also resize originals wider than the current policy).
Existing AVIF and small variants are left untouched; rebuild affected articles
if originals are intentionally changed.

## Commands

Check the current repository-side article media budget:

```bash
npm run perf:article-media
```

Update the reviewed baseline after an intentional media change:

```bash
npm run perf:article-media:update
```

The public delivery budget still runs separately:

```bash
npm run perf:images
```

## Current Baseline

The raw-asset cleanup baseline was reviewed on 2026-06-30:

- 1,806 tracked article media files.
- 143.47 MB tracked article media.
- 1,806 optimized AVIF/WebP files.
- 0 reviewed raw source images.

New raw article image paths fail the guard until the baseline is intentionally updated.

## Editorial media record (P3D)

`blog-module/media-metadata.json` holds what the editors have verified about an
image, keyed by `"<article id>/<slot>"` (slot `1` card, `2` cover background,
`3`+ body images). It works for every article, including the legacy ones without
a `source.txt`. Every field is optional; a missing entry changes nothing, and the
build never infers a credit, caption, type or label. `npm run test:blog` and
`node scripts/perf/media-qa.mjs` validate it.

| Field | Meaning | Public? |
| --- | --- | --- |
| `type` | `photo`, `archival`, `poster`, `graphic`, `diagram`, `chart`, `illustration` or `render`. Every type except `photo` and `render` is shown whole (never cropped) on the cover, homepage, Edition Index and NEXT UP. | presentation only |
| `focus` | `"x% y%"`, the point a remaining crop keeps. | presentation only |
| `caption` (+ `captionLang`) | Verified caption: what, where, when. | printed under the image |
| `credit` | Credit exactly as documented (file metadata, agency record or text printed in the image). | printed as «Πηγή …» |
| `source` | Where that credit is documented. | internal |
| `license` | Licence or permission reference, only when one is on file. | internal |
| `alt` | Verified alt text; replaces the generated «τίτλος: εικόνα N». | alt attribute |
| `synthetic` | `"confirmed"` only when the file or its author documents AI generation. | prints «Εικονογράφηση δημιουργημένη με AI» on the article and on prominent cards |
| `rights` | `"documented"` when a licence or permission is on file. | internal |

Rules for authors and editors:

- Record only what you can show: an agency caption, a licence, the author's own
  statement. A visual impression is not provenance. Suspicions and open rights
  questions belong in the editorial audit, not in this file.
- Do not write a public «source not recorded» line. A missing credit is a
  publishing question, not a caption.
- Alt text describes the picture. Do not repeat the headline, and do not name a
  driver, circuit, incident, date or measurement you cannot confirm. Card
  pictures inside a link that already carries the headline keep `alt=""`.
- Charts: transcribe the title and finding the image itself prints, and credit
  the data source only when the chart prints it.
- `homeImage: graphic` in front matter still works for the homepage Technical
  spread; the media record is the preferred home for new type information.
- The author tools convert uploads to WebP, which drops XMP/IPTC metadata. Copy
  any agency credit or AI marker into this file **before** publishing, because
  the WebP original will no longer carry it.

Derivatives: `generate-image-variants.js` re-encodes a full AVIF that is wider
than 1600px at 1600px, carrying over the file's XMP (so a provenance marker such
as IPTC `trainedAlgorithmicMedia` survives). It keeps an AVIF that is wider than
its own WebP source, because that file is the only high-resolution copy.
`--run --cap-only` applies only that cap. Pages describe every image at its
measured width (`srcset` widths are never nominal).
## Preserved public destinations and release checks

`scripts/build/preserved-public-media.json` pins previously emitted originals whose page references disappeared. The normal public build retains their exact bytes and rejects missing or changed inputs; use a new destination for an optimized or different image. Add entries only with evidence that the path was public, its authoritative input, and its published SHA-256. The scoped list does not publish every historical original.

`npm run qa:media` checks the completed `dist/` artifact, including final optimizer widths, viewer originals, retained destinations and verified AI markers. Run `npm run build:public` first. `--root=.` checks generated source pages for the content-only CI path. Missing prerequisites fail; verification never fetches media from the network. `verify`, quality CI and Pages artifact preparation run the gate after their build.

An AI disclosure must remain visible in the image viewer as well as prominent editorial artwork. Source attribution, copyright ownership and usage permission are separate facts: an embedded agency credit or CDN URL does not establish permission. Suspected images stay in the private editorial decision queue until evidence supports a public label.

### P3D public-release conditions (2026-10-13)

The R6-approved remediation and upstream article integration may be updated on
the non-production `ultrareview` branch. Public deployment still requires:

- Owner/editor decisions on these ten existing assets under
  `blog-module/blog-entries/`: `20260922W/2.webp`, `20260525-2W/2.webp`,
  `20260430W/2.webp`, `20250905W/2.webp`, `20250618G/2.webp`,
  `20260722/1.webp`, `20250328G/5.webp`, `20261007F/1.webp`,
  `20250412G/7.webp`, and `20260926D/1.webp`. Agency/illustration permissions,
  event context, and the parody's origin remain unresolved.
- Source and consent confirmation for `20261002W/4.webp`, which depicts an
  identifiable child. The archive's remaining rights/authenticity queue stays
  open, including `20250409G/1.webp`, the underlying photo in the
  `20260508W/4.webp` screenshot, and third-party media usage terms.
- A physical-device spot check remains required. P6's local Lighthouse 13.5
  three-run medians passed all four route budgets after correcting the retired
  DOM audit name in the harness; this does not verify physical devices.
- After an authorized deployment, refresh social previews for `20250409G`,
  `20260817J`, and `20260930G`.

The nine previously documented performance-budget failures remain accepted
legacy exceptions; their budgets are unchanged. Recovery originals and audit
evidence stay local and outside the production commit and public artifact.
Historical originals already in Git remain retrievable from repository history.
