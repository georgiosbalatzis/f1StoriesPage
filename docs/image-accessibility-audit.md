# P0.4 image alternative-text audit

Audited on 2026-10-21 against production `https://f1-stories.gr/` and a clean public build
of main `8bb09bca`. Counts below are **image occurrences in HTML**, not unique files.

The production response, production browser DOM and baseline build each contain **33 homepage
images, 25 empty alt attributes and zero missing alt attributes**. The hypothesis of roughly
21 empty attributes does not match this release. After correction: **33 images, 24 empty,
zero missing**. One homepage image is corrected; the other empty alternatives remain intentional.

## Homepage decisions

Classes: A decorative; B informative editorial; C functional; D adequately described by adjacent
content. Classes can overlap: a linked thumbnail can be C/D when its headline names the link.

| Pattern | Count | Class | Decision |
| --- | ---: | --- | --- |
| Navigation logo | 1 | C/D | Keep existing Greek alt and the link's explicit Greek home-page label. |
| Lead cover photograph | 1 | A/D | Keep the existing image inside the hidden duplicate link; the visible headline and story button carry the content/action. |
| Two linked cover previews | 2 | C/D | Keep empty alt; each link contains its headline. |
| Paddock analysis photograph | 1 | D | Keep empty alt; a visual teaser for the adjacent named story and excerpt. |
| Hamilton/Vasseur opinion poster | 1 | B | Correct: describe the composition and its printed phrase, absent from the adjacent headline. |
| Opinion byline portraits | 3 | D | Keep empty alt; each portrait is immediately followed by the author's name. |
| Archive story previews | 2 | D | Keep empty alt; adjacent headlines/excerpts identify the subjects; the pictures add no separate instruction or data. |
| Technical preview photograph | 1 | A/D | Keep empty alt on the hidden duplicate image link; the heading and analysis link name the destination. |
| Main episode image | 1 | C/D | Keep empty alt; its control already has a Greek read/play action and episode name. |
| Previous episode thumbnails | 2 | A/D | Keep empty alt on hidden duplicate links; adjacent episode-title links provide the destinations. |
| Crew roster/spotlight portraits | 12 | D | Keep empty alt; named profiles provide the identity, including profiles not currently displayed. |
| Sponsor/partner logos | 6 | C | Keep their existing business-name alternatives: the surrounding labels say only sponsor/partner and cannot identify the destination. Proper business names remain in their original language. |
| **Total** | **33** | | **1 corrected; 24 intentionally empty; 0 missing.** |

The decisions follow the [W3C image decision tree](https://www.w3.org/WAI/tutorials/images/decision-tree/),
[decorative/adjacent-content guidance](https://www.w3.org/WAI/tutorials/images/decorative/) and
[functional-image guidance](https://www.w3.org/WAI/tutorials/images/functional/).
An automated image-alt pass alone cannot distinguish useful descriptions from headline repetition.

## Sampled pages and corrections

| Page | Images | Corrected | Intentionally empty after correction |
| --- | ---: | ---: | ---: |
| `/` | 33 | 1 | 24 |
| `/blog-module/blog-entries/20261020W/article.html` | 17 | 3 | 7 |
| `/blog-module/blog-entries/20261015G/article.html` | 13 | 1 | 5 |
| `/blog-module/blog-entries/20261011J/article.html` | 13 | 1 | 5 |
| `/blog-module/blog/section/technical/` | 5 | 0 | 4 |
| `/blog-module/blog/archive/2026/10/` | 1 | 0 | 0 |
| **Total** | **82** | **6** | **45** |

Five inspected image assets receive verified Greek descriptions in the existing
`blog-module/media-metadata.json`: the Ferrari cover and two gallery photographs, the exploded
Mercedes assembly photograph, and the Hamilton/Vasseur poster (reused on the homepage and article).
The article descriptions previously repeated the headline or added only a photograph number.
Descriptions use visible facts; they do not infer a driver, race, date or technical conclusion.

The remaining article/category empties are named author portraits, related-story thumbnails
inside headline links, and gallery thumbnails inside numbered, Greek-labelled buttons. The browser
also creates one initially hidden lightbox image per sampled article: **3 additional runtime images**,
all with empty alt until opened. The viewer copies the selected image's description when displayed.
Thus the rendered audit sees 85 images, with 48 intentional empties, and no missing alt attributes.

## Authoritative sources and validation

- `blog-module/build/index.js`: linked story thumbnails default to empty alt; standalone Paddock
  figures can supply their recorded description. The shared renderer escapes the attribute.
- `blog-module/media-metadata.json`, `build/media-meta.js`, `build/article-render.js`: the existing
  editorial descriptions are applied to article covers and gallery/body images, including cached articles.
- `partials/nav.html`, `build/authors-page.js`, `build/home-panels.js`, `build/discovery.js` and
  `build/related.js`: reviewed labelled/decorative image patterns; no changes needed.

Validation:

- `npm run build:public` passes, including data contracts, social-card generation and artifact validation.
- `npm run test:blog`: **258 tests pass**, including five new image-alt regressions; golden snapshots match.
- `npm run quality:static`, `npm run qa:media` and `npm run qa:edition` pass (358 edition checks).
- Production Lighthouse snapshot reports **100 accessibility**; it already passes image-alt checks,
  illustrating why the poster and generic article descriptions required manual inspection.
- Browser checks using the installed axe tooling cover image-alt, redundant-image-alt, link-name and
  button-name on all six routes at desktop and mobile widths. No violations or missing alt attributes.
- A full comparison of **456 built HTML pages** finds only four changed pages, with changes exclusively
  in six image alt attributes. Dimensions, formats, src/srcset/sizes, picture/source selection, preload,
  loading/fetch priorities and layout markup are identical. Desktop/mobile screenshots and image geometry
  are compared with the baseline; no stylesheet or image asset is changed.

This audit covers all current homepage image patterns and the listed samples. Historical editorial
images outside those article samples have not been individually described or retrospectively rewritten.
