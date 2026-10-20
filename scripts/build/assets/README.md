# Social-card font

IBM Plex Sans SemiBold is the existing editorial type family. This complete TTF includes Greek and Latin glyphs for the build-time Pango renderer; the browser WOFF2 subsets are unchanged.

- Upstream: https://github.com/IBM/plex/blob/71f558992315a12ca1f06a2215d57962a1992162/packages/plex-sans/fonts/complete/ttf/IBMPlexSans-SemiBold.ttf
- SHA-256: `a20caf8286023a6a7a85e40b1d2a4ae9fc3e3b1f9eda8f4c542dd4986af67bb1`
- License: [SIL OFL 1.1](IBMPlexSans-OFL.txt), copied from the site's existing IBM Plex license.
- `fontconfig.conf` restricts shaping to this directory. No installed system font or network font is required.
- These files are source-only; the public artifact excludes `scripts/build/`.
