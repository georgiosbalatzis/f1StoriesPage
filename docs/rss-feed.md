# Publication RSS feed

Public URL: **https://f1-stories.gr/feed.xml** (RSS 2.0, UTF-8 Greek).

The initial audit found no publication RSS/Atom feed or discovery metadata in the repository;
the YouTube and Anchor RSS references are incoming media feeds. `/feed.xml`, `/rss.xml` and
`/atom.xml` on the live site returned HTTP 404 before implementation.

`npm run build:blog` generates the feed from the same processed `blogPosts` as the blog index
and sitemap. There is no separate article list. `npm run build:public` includes it in `dist/`
and validates its XML, metadata and agreement with `blog-source-cache.json`.
The shared head partial adds RSS discovery to the homepage, journal, articles and other site pages.
Site Maintenance already runs the blog build after article changes and commits generated artifacts.

Retention is the **30 newest eligible articles**, with excerpts only, not full article bodies.
Items sort by publication date, newest first; same-day ties retain the blog's established order
(first-parent Git arrival time, then previous index order). Invalid/missing dates, future dates,
`draft: true`, `published: false` and statuses other than `published` are excluded.
The last three flags are optional front matter preserved by source processing; existing articles
have no such flags. Unknown authors are omitted; known authors use the shared author directory's
Greek display name in `dc:creator` (RSS `author` requires an email address, which is not available).
Categories use the existing taxonomy's Greek labels. The absolute article canonical URL is also
the permanent GUID, so title/excerpt edits do not change identity.

Publication dates are the existing **Europe/Athens folder calendar dates**. No exact publication
time is available in article metadata. The feed represents each day as Athens midnight, with the
correct winter/summer offset, and emits RFC 822 dates in GMT. It does not claim a precise merge time.
Local author drafts stay in browser storage. Unmerged article PRs are absent from the production checkout and feed.
A future-dated article manually placed on main becomes feed-eligible on the next blog build
on or after its Athens publication day; the feed itself does not trigger deployments.

No current build timestamp is emitted: `lastBuildDate` is the newest included publication date,
and empty feeds omit it. Identical publishing metadata and eligibility produce identical bytes.
`npm run test:blog` covers XML parsing, escaping, retention, ordering, identity, exclusions,
source metadata propagation, Athens midnight and DST, and deterministic output.
`npm run build:data-contracts` checks real item targets in the checkout; the public artifact
validator also requires the packaged feed. `npm run verify` runs the complete site gates.
