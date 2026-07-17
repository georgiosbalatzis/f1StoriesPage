# Security headers strategy

Production is built from the validated `dist/` artifact with `npm run build:public`.

## Visitor policy

The visitor policy is defined in `scripts/build/security-policy.mjs` as `CONTENT_SECURITY_POLICY`. The public build writes it as:

- a generated `dist/_headers` file for hosts that honor static header rules;
- a `Content-Security-Policy` and `Referrer-Policy` meta fallback in public HTML for GitHub Pages.

The visitor policy intentionally excludes GitHub API, Google OAuth, Google Analytics Data API, `blob:` images, and `blob:` workers. Visitor pages need only the public APIs and embeds they actually use.

GitHub Pages does not apply `_headers`; use an edge host such as Cloudflare if real response headers are required. HTML meta tags are a fallback, not a replacement for response headers.

## Local author policy

Local author tools are served only by `scripts/author/serve-tools.mjs`. That server imports `AUTHOR_CONTENT_SECURITY_POLICY` from the same policy module and applies it as both an HTTP response header and an HTML meta tag.

The author policy is intentionally separate because local tools require GitHub API access, Google OAuth/Analytics Data API access, `blob:` image previews, and local ZIP/image processing. None of those permissions are included in the visitor artifact.

## Maintenance rules

- Keep policy changes in `scripts/build/security-policy.mjs`; do not hand-edit generated public headers.
- Run `npm run build:public`, `npm run audit:runtime`, and `npm run quality:static` after policy changes.
- Keep `script-src-attr 'none'` and do not add `script-src 'unsafe-inline'`.
- Keep third-party script, frame, and connect origins explicit. Avoid broadening `https:` except for image sources that genuinely require changing CDN hosts.
- Do not serve author tools from a public host without a separate threat model and an authenticated server boundary.
