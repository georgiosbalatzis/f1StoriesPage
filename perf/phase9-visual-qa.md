# Phase 9 Visual QA

Date: 2026-06-01

Command:

`npm run qa:visual`

Screenshot artifact directory:

`perf/visual-qa/phase9-2026-06-01T05-07-07-260Z/`

This directory is intentionally ignored by git because it contains binary screenshots. The run produced 72 route/theme/viewport screenshots plus interaction screenshots for the mobile menu and first-visit cookie banner.

## Matrix

Viewports:

- 390 x 844
- 768 x 1024
- 1440 x 900
- 1920 x 1080

Themes:

- dark
- light

Routes:

- `/`
- `/blog-module/blog/index.html`
- latest article page
- `/standings/`
- `/standings/?tab=constructors`
- `/standings/?tab=quali-gaps`
- `/standings/?tab=dirty-air`
- `/privacy/privacy.html`
- `/offline.html`

## Result

Status: PASS

- No horizontal overflow detected in the final run.
- No broken visible images detected in the final run.
- Mobile navigation opened and closed correctly.
- First-visit cookie banner occupied 29.7% of the 390 x 844 viewport and decline persisted.
- Theme toggle switched dark to light and back without layout errors.

## Fix Applied

The first run found oversized SVG icons on the privacy page at desktop and wide desktop sizes. The page used the shared SVG sprite but did not receive the base `.icon` sizing rule from the critical CSS used by the core pages. The fix moved the base `.icon` dimensions into `styles/shared-nav.css`, which is loaded by the legal pages and shared navigation.
