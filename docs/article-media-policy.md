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

- at most **3200 px wide**, aspect ratio kept. That is twice the widest public
  variant (1600 px). Lossy WebP stores colour at half resolution, so a 2x master
  still gives the build's Lanczos downscale full-resolution colour for every
  1600 px AVIF/WebP variant. A 1600 px master measurably softens them;
- at most **1 MB**, the per-original cap of `perf:article-media`. WebP quality
  starts at the 0.9 the tools always used and steps down only when needed;
- a WebP that already fits is uploaded byte for byte.

`npm run qa:author-images` runs that code in Chromium on generated fixtures and
real article photos. It checks the size, the format and the aspect ratio, and
that the reader-facing AVIF stays within 1 dB PSNR of what the previous tool
produced.

Originals already in the repository can be brought under the same policy with
`npm run build:article-originals` (dry run; `--write` to apply, `--all` to also
resize every original wider than 3200 px). Existing AVIF and small variants are
left untouched; rebuild the affected articles afterwards.

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
