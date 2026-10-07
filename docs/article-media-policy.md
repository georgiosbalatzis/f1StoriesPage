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
