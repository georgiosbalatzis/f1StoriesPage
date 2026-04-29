# Spotify Narration Phase 0

This document locks the non-code prerequisites for Spotify article narration before the pipeline work starts.

## Scope

Phase 0 does not modify the live article build or Spotify publishing flow.

It establishes:

- the required secrets/inputs
- the accepted operating constraints
- the default failure mode
- the validation entrypoint used locally and later in CI

## Required secrets and inputs

The current contract is:

- `SPOTIFY_CREATORS_EMAIL`
  Spotify for Creators login email

- `SPOTIFY_CREATORS_PASSWORD`
  Spotify for Creators login password

- `SPOTIFY_SHOW_URL` or `SPOTIFY_SHOW_ID`
  Existing Spotify show target for published narrations

- `VOICE_REF_BUNDLE_URL`
  Private downloadable bundle of clean reference audio for voice cloning

Optional:

- `VOICE_REF_BUNDLE_SHA256`
  Integrity check for the reference bundle download

- `VOICE_PROFILE_ID`
  Human-readable identifier for the voice profile version, for example `georgios-v1`

## Current operating decisions

- Spotify-hosted show remains the source of truth for narration audio
- generated MP3 files are not stored in the git repo
- automation is accepted even though Spotify publishing will require browser automation against Spotify for Creators
- article publication should remain more reliable than Spotify publishing
- if Spotify automation fails, the preferred default is to keep article publication alive and retry narration separately

## Authoring rule needed for narration extraction

To make narration extraction deterministic, article source lists should be introduced with a clear heading:

`## Πηγές`

Accepted fallback aliases can be added later, but this should become the default article-writing rule.

## Runner guidance

Cloned-voice TTS is workable on CPU but slower for long articles.

Preferred:

- self-hosted GPU runner for TTS generation

Fallback:

- GitHub-hosted CPU runner with chunked synthesis and model caching

Phase 0 does not lock the runner choice yet, but the validation script reports whether a GPU is visible on the current machine.

## Validation command

Run:

```bash
npm run spotify:phase0:check
```

This validates the required environment contract and reports whether the current runner appears to have an NVIDIA GPU.

## Related repo files

- `stepsforspotify.txt`
- `package.json`
- `scripts/spotify/validate-config.mjs`
