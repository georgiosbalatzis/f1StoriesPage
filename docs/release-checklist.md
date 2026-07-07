# Release Checklist

Use this checklist before publishing changes that affect layout, navigation, article rendering, consent behavior, standings, public assets, or deploy output.

## Automated Gate

Run the full gate from a clean working tree when practical:

```bash
npm run verify
```

For visual-only iteration after `dist/` already exists:

```bash
npm run qa:visual
```

`qa:visual` serves `dist/`, captures desktop and mobile screenshots, and checks critical routes for layout overflow, broken visible images, page errors, headings, landmarks, labelled controls, focus traversal, control contrast, article readability, standings tab state, consent UI, navigation, and 404 behavior. Screenshot runs are written under `perf/visual-qa/`, which is intentionally ignored by git.

## Manual Visual Pass

- Home: hero image crops cleanly on 390 px mobile, tablet, desktop, and wide desktop; the next section is visible enough to invite scrolling.
- Navigation: desktop links, mobile menu, theme toggle, and scroll-to-top control look aligned and have visible focus states.
- Blog index: first-page cards have stable image ratios, readable excerpts, working category/search controls, and no cramped pagination states.
- Article page: title, hero image, metadata, body paragraphs, related articles, previous/next links, and sponsor area read cleanly on mobile and desktop.
- Consent banner: first-visit banner does not dominate mobile, actions are readable, and decline/accept/customize states persist.
- Standings: every tab can be reached with keyboard and pointer, active tab and panel stay in sync, dense tables do not hide important labels.
- 404/offline: both pages explain the state accurately and offer a clear recovery path.
- Legal pages: privacy/terms pages keep readable line length and shared navigation/footer styling.

## Review Notes

- Do not commit `perf/visual-qa/**` screenshots unless the team intentionally decides to maintain visual baselines.
- If `qa:visual` fails on contrast or focus, fix the UI first. Only relax the check when the assertion is demonstrably wrong.
- If generated files drift after the checks, rerun the specific build command that owns them and review the diff before publishing.
