# Social cards

The public artifact builds a 1200 × 630 JPEG for every copied article whose ID is in `blog-module/blog-source-cache.json`. The homepage has a separate, stable card. Article cards use the cinematic-v1 layout: the published OG image fills the frame, with a white headline, author byline and red accent. The official `images/logo-256.webp` sits beside the F1 STORIES wordmark; the domain is at the upper right. The card omits the category.

## Image and layout policy

Each article uses only its own published OG image or the branded fallback. Photographs cover the frame without stretching. A recorded media focus selects the crop using object-position semantics; otherwise the crop is centered. Archival images, posters, graphics, diagrams, charts and illustrations use a blurred, darkened version of the same image behind the whole image, contained in the upper area. Renders are treated as photographs.

Missing, invalid, unreadable or undecodable sources receive a deterministic dark branded background. The report records the reason as `source-missing`, `source-invalid`, `source-unreadable` or `source-decode`. Confirmed synthetic published images are used with the readable disclosure from `media.AI_LABEL`; no imagery is generated. The homepage retains its existing icon fallback.

The pinned IBM Plex Sans SemiBold font and Fontconfig configuration provide Greek and Latin text. The headline is measured at sizes from 68 down to 36 pixels, with at most four lines and the available height determined by the image treatment. Only at the minimum size may it be shortened with a grapheme-safe ellipsis. The byline uses the canonical taxonomy author label when known. The disclosure occupies a separate footer pill. Header and headline/footer scrims provide at least 60% black behind white text, increasing to 90% at the bottom, for at least 4.5:1 contrast over white.

## Output, cache and coverage

Article URLs use the first 20 hexadecimal characters of the JPEG SHA-256: `images/social/article-<sha20>.jpg`. Cards are at most 307,200 bytes. Only OG and Twitter image metadata is replaced; article content, JSON-LD and normal page imagery are preserved. The original article files remain unchanged.

The validated cache is `.build/public-images/social-cards/`. Its renderer identity includes the template, renderer and media metadata code, pinned font and Fontconfig, logo, design tokens, Node/ICU, sharp and platform versions. Per-card identity includes source bytes, article data, image focus, type, synthetic status, containment and fallback reason. Sidecars carry the template and renderer key; incompatible or corrupt cached cards are rendered again. Identical inputs in the same rendering environment produce identical bytes.

`report.json` contains article counters `eligible`, `cards`, `cacheHits`, `truncated`, `overBudget`, `metadataFailures`, `missingFiles` and `legacyTemplate`, plus `fallbacks` entries with page and reason and `failures` entries with page and error. Records include the page, output digest and URL, template, renderer key and cache status. The homepage is reported separately from article counters. A missing title, rendering or encoding failure, exhausted JPEG budget or metadata replacement failure is fatal after the report is written.

Release validation independently derives eligible articles from the built artifact and source cache. It requires exactly one current card per eligible page, matching OG and Twitter metadata, a valid digest-named JPEG within budget, no failures, and no obsolete template or missing output. It also checks the homepage separately and preserves JSON-LD and article bodies.

## QA and performance

Use an existing build and write review output outside the repository:

```sh
node scripts/build/social-card-examples.mjs --ids <id1>,<id2> --sheet
node --test scripts/build/__tests__/social-cards-release.test.mjs
```

Review the owner-selected articles and a sample of the archive, including contained and synthetic media, long headlines and fallbacks. The release test requires a built `dist` and its matching cache report.

| Measurement | Result |
| --- | --- |
| Base cold render, 424 cards | 34.0 s on the reference machine |
| Cinematic cold render | To be measured by coordinator |
| Cinematic warm render | To be measured by coordinator |

These are local measurements, not CI guarantees. To roll back, revert the renderer and integration changes; caches key on renderer bytes, so an incompatible template is not reused. Social platforms cache previews independently and refresh them on their own schedules, even after a new card is deployed.
