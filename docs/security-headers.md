# Security Headers Strategy

Production deploys are built from `dist/` with `npm run build:public`.
`scripts/build/security-policy.mjs` is the single source of the policy, and
the build writes it in two forms:

- `<meta http-equiv="Content-Security-Policy">` and `<meta name="referrer">`
  in every HTML file. This is what actually applies on GitHub Pages;
- a generated `dist/_headers` for hosts that honor static header rules
  (Cloudflare Pages, Netlify). **GitHub Pages ignores `_headers`.**

The artifact validator fails if any page's meta tags or `dist/_headers` drift
from `security-policy.mjs`.

## Per-page Content-Security-Policy

| Profile | Pages | Why it differs |
|---|---|---|
| `public` | every public page (home, archive, articles, standings, authors, legal, 404) | analytics after consent, Disqus, social embeds, F1 data APIs, Formspree |
| `author-tools` | `housekeeping.html` | holds the GitHub token; talks only to `api.github.com`; runs no third-party code |
| `author-generate` | `generate.html` | as `author-tools`, plus the live preview: YouTube and whitelisted iframes, and the X, Instagram, Threads and Facebook embed SDKs |

`PAGE_CSP_PROFILES` maps pages to profiles; everything else is `public`.
`injectSecurityMeta(html, relPath)` replaces whatever policy a page carries
with the one for its path. So `public-artifact.mjs` can no longer overwrite a
tool page's policy with the broader public one, which it did before
2026-09-26. The tool pages' sources carry the same meta block, so
`serve-tools.mjs` (local dev) enforces the production policy.

The tool profiles share a strict base: `base-uri 'none'`, `form-action 'none'`,
`object-src 'none'`, `worker-src 'none'`, `media-src 'none'`,
`manifest-src 'none'`, `font-src 'self'`, `script-src-attr 'none'`, no inline
script, and no scheme-wide (`https:`) source in `script-src`, `connect-src`,
`frame-src` or `img-src`.

### Changing a tool policy

`scripts/build/__tests__/security-policy.test.mjs` (`npm run test:security`,
run by Site Quality) pins every tool profile source by source, and checks that:

- no tool profile allows anything the public profile does not;
- every directive that would otherwise be open (`base-uri`, `form-action`) or
  silently fall back is set explicitly;
- no inline/eval/wildcard script is allowed; public tracking, ads, comments,
  CDNs and F1-data origins stay off tool pages;
- only author tools can reach `api.github.com`.

A new origin needs the policy change **and** the matching `REVIEWED` entry in
that test, with the reason, in the same review.

## Headers GitHub Pages cannot serve

GitHub Pages sends its own fixed response headers. The site cannot add:

| Header | Covered today? |
|---|---|
| `Content-Security-Policy` | yes, via `<meta>` (a meta policy cannot carry `frame-ancestors`, `sandbox` or reporting) |
| `Referrer-Policy` | yes, via `<meta name="referrer">` |
| `Strict-Transport-Security` | no |
| `X-Content-Type-Options` | no |
| `Permissions-Policy` | no |
| `frame-ancestors` / `X-Frame-Options` | no; author tools refuse to hold a token when framed (`session-token.js`) |

To serve them, proxy `f1stories.gr` through Cloudflare and add the `dist/_headers`
values as a Response Header Transform Rule, or deploy `dist/` to a host that
applies `_headers`. Do not add `preload` to HSTS until every current and future
subdomain is known to be HTTPS-only.

## Verifying production

```bash
npm run security:headers                # https://f1stories.gr, human-readable
node scripts/quality/security-headers-verify.mjs --json
node scripts/quality/security-headers-verify.mjs --strict   # also fail on host limits
```

For every checked page it reports each header as `pass`, `meta-fallback`,
`host-limit` (the detected host, e.g. GitHub Pages, cannot serve it),
`missing` (the host could serve it), `weak` or `mismatch`, plus the HTTP→HTTPS
redirect. Exit code 1 means drift, or a header the host could serve but does
not; 2 means the site could not be fetched. The **Security Headers** workflow
runs it weekly and on demand.

## Policy notes

- `script-src` never allows `unsafe-inline`; `script-src-attr 'none'` blocks
  inline event attributes.
- `style-src 'unsafe-inline'` remains for generated critical CSS, article
  styles and style attributes. This is CSS only.
- Google Tag Manager is allowed on public pages only, because
  `scripts/analytics.js` injects GA4 only after analytics consent.
- Public `img-src https:` is intentionally broad for article and social
  embeds. Tool pages allow only `'self'`, `data:` and `blob:` images.
- Fonts are self-hosted everywhere.
