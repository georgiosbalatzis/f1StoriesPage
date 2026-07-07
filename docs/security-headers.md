# Security Headers Strategy

Production deploys are built from `dist/` with `npm run build:public`.
The public artifact centralizes security policy in
`scripts/build/security-policy.mjs` and writes it in two forms:

- a generated `_headers` file for hosts that honor static header rules
- browser-supported `Content-Security-Policy` and `Referrer-Policy` meta tags
  in every HTML file as a GitHub Pages fallback

GitHub Pages ignores `_headers`, so serving directly from GitHub Pages still
relies on the HTML meta fallback unless Cloudflare or another edge layer adds
real response headers. The artifact validator fails if public HTML security
meta tags or `dist/_headers` drift from `scripts/build/security-policy.mjs`.

## Generated Headers

`npm run build:public` generates `dist/_headers` with this rule for hosts such
as Cloudflare Pages or Netlify:

```http
/*
  Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; form-action 'self' https://formspree.io; script-src 'self' https://www.googletagmanager.com https://f1stories-gr.disqus.com https://*.disqus.com https://*.disquscdn.com https://connect.facebook.net https://platform.twitter.com https://www.instagram.com https://www.threads.net; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; style-src-attr 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https:; connect-src 'self' https://api.jolpi.ca https://api.openf1.org https://formspree.io https://www.googletagmanager.com https://www.google-analytics.com https://analytics.google.com https://region1.google-analytics.com https://stats.g.doubleclick.net https://f1stories-gr.disqus.com https://*.disqus.com https://*.disquscdn.com https://connect.facebook.net https://www.facebook.com https://platform.twitter.com https://syndication.twitter.com https://twitter.com https://*.twitter.com https://x.com https://*.x.com https://www.instagram.com https://www.threads.net; frame-src 'self' https://www.youtube.com https://youtube.com https://www.youtube-nocookie.com https://open.spotify.com https://player.vimeo.com https://codepen.io https://datawrapper.dwcdn.net https://sketchfab.com https://www.sketchfab.com https://facebook.com https://www.facebook.com https://platform.twitter.com https://syndication.twitter.com https://www.instagram.com https://instagram.com https://threads.net https://www.threads.net https://f1stories.gr https://www.f1stories.gr https://georgiosbalatzis.github.io https://f1stories-gr.disqus.com https://disqus.com; worker-src 'self' blob:; manifest-src 'self'; media-src 'self' https:; upgrade-insecure-requests
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: accelerometer=(), ambient-light-sensor=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), usb=()
  X-Content-Type-Options: nosniff
  Strict-Transport-Security: max-age=31536000; includeSubDomains
```

For an A+ production posture on `https://f1stories.gr/*`, put Cloudflare in
front of the GitHub Pages origin or deploy the generated artifact to a host
that applies `_headers`. Real response headers cannot be fully replaced by
HTML meta tags.

Do not add `preload` to HSTS until every current and future subdomain is known
to be HTTPS-only.

## Policy Notes

- `script-src` no longer allows `unsafe-inline`, and `script-src-attr 'none'`
  blocks inline event attributes. Runtime behavior that previously used inline
  boot scripts or `on*` attributes now lives in versioned local JavaScript.
- `style-src 'unsafe-inline'` remains for generated critical CSS, generated
  article styles, and existing style attributes. This is limited to CSS; script
  execution remains externalized.
- Google Tag Manager is allowed because `scripts/analytics.js` only injects GA4
  after explicit analytics consent.
- `img-src https:` is intentionally broad because article and social embeds can
  load images from changing CDN hostnames. Script, frame, style, and connect
  sources remain explicit.
- Fonts are self-hosted. Google Fonts and CDNJS are not allowed by `style-src`,
  `font-src`, or `connect-src`.
- Real response headers should replace the meta fallback when Cloudflare is
  active. Keep this document aligned with `scripts/build/security-policy.mjs`.
