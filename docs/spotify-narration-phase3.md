# Spotify Narration Phase 3

Phase 3 adds the local text-to-speech renderer that future CI wiring will call before Spotify publishing.

## Scope

This phase does not publish to Spotify yet and does not modify article rendering.

It adds:

- a standalone narration renderer CLI
- conservative paragraph/sentence chunking
- voice-reference bundle loading and normalization
- ffmpeg concat + loudness-normalized MP3 export
- a local self-test entrypoint

## Files

- `scripts/tts/render_article_narration.py`
- `scripts/tts/requirements.txt`
- `package.json`

## CLI contract

Primary input:

- narration text from `--text-file` or `--text`

Primary output:

- MP3 at `/tmp/f1stories-narration/<ARTICLE_ID>.mp3` by default

Scratch output:

- `/tmp/f1stories-narration/<ARTICLE_ID>/`

Reference audio source:

- `--voice-ref-path`
- or `VOICE_REF_BUNDLE_URL` / `VOICE_REF_BUNDLE_SHA256`

## Runtime notes

The renderer intentionally keeps heavy imports lazy so local validation can run without installing the Coqui model stack.

`--self-test` checks:

- chunking
- `ffmpeg` presence
- concat + MP3 export

Run:

```bash
npm run spotify:phase3:test
```

## Current constraint

The stock Coqui XTTS v2 model is still the default backend in this phase, but the current official XTTS v2 language list does not include Greek.

Because of that, the renderer fails fast when asked to run stock XTTS with `language=el`, unless `--allow-unsupported-language` is passed explicitly for a custom fine-tuned setup.

The current stable Coqui `TTS` package documentation also targets Python `< 3.11`, so real synthesis should run on a Python 3.10 runner.
