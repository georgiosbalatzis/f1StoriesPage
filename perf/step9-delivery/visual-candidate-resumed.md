# Step 12 Visual QA

Generated: 2026-10-15T17:41:34.839Z
Screenshots: /tmp/f1-step9-visual-candidate
Routes: 4
Matrix captures: 15
Status: FAIL

## Route Matrix

| Theme | Viewport | Route | Screenshot | Issues |
| --- | --- | --- | --- | --- |
| dark | 1440x900 | Blog index | dark-desktop-blog.png | ok |
| dark | 1440x900 | Latest article | dark-desktop-latest-article.png | heading-order: h3#section-1 h1 followed by h3 |
| dark | 1440x900 | Standings drivers | dark-desktop-standings-drivers.png | ok |
| light | 390x844 | Home | light-mobile-home.png | ok |
| light | 390x844 | Blog index | light-mobile-blog.png | ok |
| light | 390x844 | Latest article | light-mobile-latest-article.png | heading-order: h3#section-1 h1 followed by h3 |
| light | 390x844 | Standings drivers | light-mobile-standings-drivers.png | ok |
| light | 768x1024 | Home | light-tablet-home.png | ok |
| light | 768x1024 | Blog index | light-tablet-blog.png | ok |
| light | 768x1024 | Latest article | light-tablet-latest-article.png | heading-order: h3#section-1 h1 followed by h3 |
| light | 768x1024 | Standings drivers | light-tablet-standings-drivers.png | ok |
| light | 1440x900 | Home | light-desktop-home.png | ok |
| light | 1440x900 | Blog index | light-desktop-blog.png | ok |
| light | 1440x900 | Latest article | light-desktop-latest-article.png | heading-order: h3#section-1 h1 followed by h3 |
| light | 1440x900 | Standings drivers | light-desktop-standings-drivers.png | ok |

## Interaction Checks

| Check | Status | Detail | Screenshot |
| --- | --- | --- | --- |
| mobile menu opens and closes | ok | opened to 365px and closed cleanly | interaction-mobile-nav-open.jpg |
| cookie banner first visit and decline | ok | banner height 311px (36.8% of viewport), decline persisted | interaction-cookie-first-visit-mobile.jpg |
| theme toggle switches light/dark | ok | default -> light -> default |  |

## Findings

- dark 1440x900 Latest article: heading-order: h3#section-1 h1 followed by h3
- light 390x844 Latest article: heading-order: h3#section-1 h1 followed by h3
- light 768x1024 Latest article: heading-order: h3#section-1 h1 followed by h3
- light 1440x900 Latest article: heading-order: h3#section-1 h1 followed by h3
