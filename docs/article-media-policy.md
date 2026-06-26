# Article Media Policy

This repository publishes a static site through GitHub Pages. Article media can stay in the repository when it is needed to build or serve the static article experience, but raw originals must not grow silently.

## Source Of Truth

- Article source text lives in each `blog-module/blog-entries/<entry>/` folder.
- Public article media should be optimized AVIF/WebP variants.
- Raw JPG, JPEG, PNG, and GIF files are treated as reviewed source assets, not default public assets.
- Generated/public delivery size is guarded separately from repository size.

## Rules

- Do not add new raw article images unless there is a clear reason to keep the original in git.
- Convert article images to optimized AVIF/WebP variants before publishing.
- Keep card and small variants generated and reviewable.
- If a raw original must stay, update `perf/article-media-budget.json` in the same review and explain why.
- If the total article media budget grows, check whether the growth came from a real article need or an avoidable raw asset.

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

The first reviewed baseline was created on 2026-06-23:

- 1,808 tracked article media files.
- 146.66 MB tracked article media.
- 1,794 optimized AVIF/WebP files.
- 14 reviewed raw source images.

New raw article image paths fail the guard until the baseline is intentionally updated.
