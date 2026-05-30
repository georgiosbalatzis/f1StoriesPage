# Security Headers Strategy

Production deploys are built from `dist/` with `npm run build:public`.
GitHub Pages does not let this repository set arbitrary response headers, so
the public artifact injects two browser-supported meta policies into every
HTML file as a partial mitigation:

- `Content-Security-Policy`, sourced from `scripts/build/security-policy.mjs`
- `Referrer-Policy`, via `<meta name="referrer" content="strict-origin-when-cross-origin">`

The artifact validator fails if any public HTML file is missing those meta
tags or if they drift from `scripts/build/security-policy.mjs`.

## Required Real Headers

For an A+ production posture, put Cloudflare in front of the GitHub Pages
origin and configure these response headers for `https://f1stories.gr/*`.
These cannot be fully replaced by HTML meta tags.

```http
Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; form-action 'self' https://formspree.io; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://unpkg.com https://f1stories-gr.disqus.com https://*.disqus.com https://*.disquscdn.com https://connect.facebook.net https://platform.twitter.com https://www.instagram.com https://www.threads.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data: blob: https:; connect-src 'self' https://api.jolpi.ca https://api.openf1.org https://formspree.io https://fonts.googleapis.com https://fonts.gstatic.com https://cdnjs.cloudflare.com https://www.googletagmanager.com https://www.google-analytics.com https://analytics.google.com https://region1.google-analytics.com https://stats.g.doubleclick.net https://f1stories-gr.disqus.com https://*.disqus.com https://*.disquscdn.com https://connect.facebook.net https://www.facebook.com https://platform.twitter.com https://syndication.twitter.com https://twitter.com https://*.twitter.com https://x.com https://*.x.com https://www.instagram.com https://www.threads.net; frame-src 'self' https://www.youtube.com https://youtube.com https://www.youtube-nocookie.com https://open.spotify.com https://player.vimeo.com https://codepen.io https://datawrapper.dwcdn.net https://sketchfab.com https://www.sketchfab.com https://facebook.com https://www.facebook.com https://platform.twitter.com https://syndication.twitter.com https://www.instagram.com https://instagram.com https://threads.net https://www.threads.net https://f1stories.gr https://www.f1stories.gr https://georgiosbalatzis.github.io https://f1stories-gr.disqus.com https://disqus.com; worker-src 'self' blob:; manifest-src 'self'; media-src 'self' https:; upgrade-insecure-requests
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: accelerometer=(), ambient-light-sensor=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), usb=()
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

Do not add `preload` to HSTS until every current and future subdomain is known
to be HTTPS-only.

## Policy Notes

- `unsafe-inline` remains because the current public HTML uses inline critical
  CSS, inline JSON-LD, stylesheet `onload` handlers, and small boot scripts.
  Removing it is a later refactor, not a header-only change.
- Google Tag Manager is allowed because `scripts/analytics.js` only injects GA4
  after explicit analytics consent.
- `img-src https:` is intentionally broad because article and social embeds can
  load images from changing CDN hostnames. Script, frame, style, and connect
  sources remain explicit.
- Real response headers should replace the meta-only mitigation when Cloudflare
  is active. Keep `scripts/build/security-policy.mjs` and this document in sync.
