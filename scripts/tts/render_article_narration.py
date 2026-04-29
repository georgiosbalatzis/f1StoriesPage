#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.request
import zipfile
from pathlib import Path
from typing import Iterable, Sequence


DEFAULT_MODEL_NAME = "tts_models/multilingual/multi-dataset/xtts_v2"
DEFAULT_OUTPUT_ROOT = Path("/tmp/f1stories-narration")
DEFAULT_LANGUAGE = os.environ.get("NARRATION_LANGUAGE", "el")
DEFAULT_MAX_CHARS_PER_CHUNK = 220
DEFAULT_MP3_BITRATE = "96k"
SUPPORTED_AUDIO_EXTENSIONS = {".wav", ".mp3", ".m4a", ".flac", ".ogg", ".aac"}
KNOWN_MODEL_LANGUAGES = {
    DEFAULT_MODEL_NAME: {
        "en", "es", "fr", "de", "it", "pt", "pl", "tr",
        "ru", "nl", "cs", "ar", "zh-cn", "hu", "ko", "ja"
    }
}
SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?;\u037e])\s+")
CLAUSE_SPLIT_RE = re.compile(r"(?<=[,:-])\s+")
WHITESPACE_RE = re.compile(r"[ \t]+")


class NarrationRenderError(RuntimeError):
    pass


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Render article narration to MP3 with Coqui XTTS and ffmpeg post-processing."
    )
    parser.add_argument("--article-id", help="Article folder id used for filenames and metadata.")
    parser.add_argument("--text-file", help="Path to a UTF-8 narration text file.")
    parser.add_argument("--text", help="Inline narration text.")
    parser.add_argument("--output", help="Final MP3 output path.")
    parser.add_argument("--work-dir", help="Scratch directory for refs, chunks, and manifests.")
    parser.add_argument("--manifest-file", help="Optional JSON manifest output path.")
    parser.add_argument("--voice-ref-path", help="Local voice reference bundle path (dir, archive, or audio file).")
    parser.add_argument(
        "--voice-ref-bundle-url",
        default=os.environ.get("VOICE_REF_BUNDLE_URL", ""),
        help="Download URL for the private voice reference bundle."
    )
    parser.add_argument(
        "--voice-ref-bundle-sha256",
        default=os.environ.get("VOICE_REF_BUNDLE_SHA256", ""),
        help="Optional SHA256 checksum for the downloaded bundle."
    )
    parser.add_argument(
        "--voice-profile-id",
        default=os.environ.get("VOICE_PROFILE_ID", "default"),
        help="Human-readable voice profile identifier for metadata."
    )
    parser.add_argument("--model-name", default=DEFAULT_MODEL_NAME, help="Coqui model name.")
    parser.add_argument("--language", default=DEFAULT_LANGUAGE, help="Target TTS language code.")
    parser.add_argument("--max-chars-per-chunk", type=int, default=DEFAULT_MAX_CHARS_PER_CHUNK)
    parser.add_argument("--mp3-bitrate", default=DEFAULT_MP3_BITRATE)
    parser.add_argument(
        "--device",
        choices=("auto", "cpu", "cuda"),
        default="auto",
        help="Torch device preference for synthesis."
    )
    parser.add_argument(
        "--allow-unsupported-language",
        action="store_true",
        help="Bypass the stock-model language check when using a custom fine-tuned model."
    )
    parser.add_argument(
        "--allow-unsupported-runtime",
        action="store_true",
        help="Bypass the Python-version compatibility guard for the Coqui TTS runtime."
    )
    parser.add_argument("--keep-work-dir", action="store_true", help="Keep scratch files after completion.")
    parser.add_argument("--dry-run", action="store_true", help="Build metadata and chunking output without synthesis.")
    parser.add_argument("--self-test", action="store_true", help="Run a local ffmpeg/chunking smoke test.")
    args = parser.parse_args()

    if args.self_test:
        return args

    if not args.article_id:
        parser.error("--article-id is required unless --self-test is used.")
    if not args.text and not args.text_file:
        parser.error("Provide one of --text or --text-file.")
    if args.max_chars_per_chunk < 80:
        parser.error("--max-chars-per-chunk must be at least 80.")

    return args


def ensure_command(name: str) -> str:
    path = shutil.which(name)
    if not path:
        raise NarrationRenderError(f"Required command not found on PATH: {name}")
    return path


def run_command(command: Sequence[str], *, capture_output: bool = False) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        list(command),
        check=True,
        text=True,
        capture_output=capture_output,
    )


def ffmpeg_command(*args: str) -> list[str]:
    return [ensure_command("ffmpeg"), "-hide_banner", "-loglevel", "error", *args]


def normalize_text(raw_text: str) -> str:
    raw = str(raw_text or "").replace("\r\n", "\n").replace("\r", "\n")
    paragraphs = []
    for paragraph in re.split(r"\n\s*\n+", raw):
        compact = WHITESPACE_RE.sub(" ", paragraph.replace("\n", " ")).strip()
        if compact:
            paragraphs.append(compact)
    return "\n\n".join(paragraphs)


def pack_segments(segments: Iterable[str], max_chars: int) -> list[str]:
    packed: list[str] = []
    current = ""
    for segment in segments:
        part = WHITESPACE_RE.sub(" ", str(segment or "")).strip()
        if not part:
            continue
        candidate = part if not current else f"{current} {part}"
        if len(candidate) <= max_chars:
            current = candidate
            continue
        if current:
            packed.append(current)
            current = ""
        if len(part) <= max_chars:
            current = part
            continue
        words = part.split()
        word_bucket = ""
        for word in words:
            next_candidate = word if not word_bucket else f"{word_bucket} {word}"
            if len(next_candidate) <= max_chars:
                word_bucket = next_candidate
            else:
                if word_bucket:
                    packed.append(word_bucket)
                if len(word) <= max_chars:
                    word_bucket = word
                    continue
                hard_slices = [word[index:index + max_chars] for index in range(0, len(word), max_chars)]
                packed.extend(hard_slices[:-1])
                word_bucket = hard_slices[-1]
        if word_bucket:
            current = word_bucket
    if current:
        packed.append(current)
    return packed


def split_long_paragraph(paragraph: str, max_chars: int) -> list[str]:
    compact = WHITESPACE_RE.sub(" ", paragraph).strip()
    if not compact:
        return []
    if len(compact) <= max_chars:
        return [compact]

    sentences = [item.strip() for item in SENTENCE_SPLIT_RE.split(compact) if item.strip()]
    if len(sentences) > 1:
        expanded: list[str] = []
        for sentence in sentences:
            expanded.extend(split_long_paragraph(sentence, max_chars))
        return pack_segments(expanded, max_chars)

    clauses = [item.strip() for item in CLAUSE_SPLIT_RE.split(compact) if item.strip()]
    if len(clauses) > 1:
        return pack_segments(clauses, max_chars)

    return pack_segments([compact], max_chars)


def chunk_narration_text(raw_text: str, max_chars: int) -> list[str]:
    normalized = normalize_text(raw_text)
    if not normalized:
        raise NarrationRenderError("Narration text is empty after normalization.")

    chunks: list[str] = []
    for paragraph in normalized.split("\n\n"):
        chunks.extend(split_long_paragraph(paragraph, max_chars))

    if not chunks:
        raise NarrationRenderError("Could not derive any narration chunks.")
    for chunk in chunks:
        if len(chunk) > max_chars:
            raise NarrationRenderError(f"Chunk exceeds max size ({len(chunk)} > {max_chars}): {chunk[:60]!r}")
    return chunks


def validate_runtime(model_name: str, language: str, allow_unsupported_language: bool, allow_unsupported_runtime: bool) -> None:
    supported_languages = KNOWN_MODEL_LANGUAGES.get(model_name)
    if supported_languages and language not in supported_languages and not allow_unsupported_language:
        supported_list = ", ".join(sorted(supported_languages))
        raise NarrationRenderError(
            "The selected stock Coqui model does not list this language as supported. "
            f"model={model_name!r} language={language!r}. Supported languages: {supported_list}. "
            "Use --allow-unsupported-language only if you are intentionally running a custom fine-tuned model."
        )

    if sys.version_info >= (3, 11) and not allow_unsupported_runtime:
        raise NarrationRenderError(
            "The stable Coqui TTS runtime used by this phase is documented for Python < 3.11. "
            f"Current interpreter: {sys.version.split()[0]}. "
            "Use a Python 3.10 runner for real synthesis, or pass --allow-unsupported-runtime if you are deliberately testing."
        )


def read_text_input(args: argparse.Namespace) -> str:
    if args.text:
        return str(args.text)
    if not args.text_file:
        raise NarrationRenderError("No narration text source provided.")
    return Path(args.text_file).read_text(encoding="utf-8")


def compute_sha256(file_path: Path) -> str:
    digest = hashlib.sha256()
    with file_path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download_bundle(url: str, destination: Path, expected_sha256: str) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url) as response, destination.open("wb") as handle:
        shutil.copyfileobj(response, handle)

    if expected_sha256:
        actual_sha256 = compute_sha256(destination)
        if actual_sha256.lower() != expected_sha256.lower():
            raise NarrationRenderError(
                f"Voice reference bundle SHA256 mismatch for {destination.name}: "
                f"expected {expected_sha256.lower()} got {actual_sha256.lower()}"
            )
    return destination


def unpack_bundle(bundle_path: Path, extract_dir: Path) -> Path:
    if bundle_path.is_dir():
        return bundle_path
    if bundle_path.suffix.lower() in SUPPORTED_AUDIO_EXTENSIONS:
        return bundle_path
    if zipfile.is_zipfile(bundle_path):
        with zipfile.ZipFile(bundle_path) as archive:
            archive.extractall(extract_dir)
        return extract_dir
    if tarfile.is_tarfile(bundle_path):
        with tarfile.open(bundle_path) as archive:
            archive.extractall(extract_dir)
        return extract_dir
    raise NarrationRenderError(f"Unsupported voice reference bundle format: {bundle_path}")


def collect_audio_files(root: Path) -> list[Path]:
    if root.is_file():
        if root.suffix.lower() not in SUPPORTED_AUDIO_EXTENSIONS:
            raise NarrationRenderError(f"Unsupported voice reference audio file: {root}")
        return [root]

    audio_files = sorted(
        path for path in root.rglob("*")
        if path.is_file() and path.suffix.lower() in SUPPORTED_AUDIO_EXTENSIONS
    )
    if not audio_files:
        raise NarrationRenderError(f"No audio reference files found in {root}")
    return audio_files


def normalize_reference_audio_files(audio_files: Sequence[Path], refs_dir: Path) -> list[Path]:
    refs_dir.mkdir(parents=True, exist_ok=True)
    normalized_files: list[Path] = []

    for index, audio_file in enumerate(audio_files, start=1):
        output_path = refs_dir / f"ref-{index:02d}.wav"
        command = ffmpeg_command(
            "-y",
            "-i",
            str(audio_file),
            "-vn",
            "-ac",
            "1",
            "-ar",
            "24000",
            "-c:a",
            "pcm_s16le",
            str(output_path),
        )
        run_command(command)
        normalized_files.append(output_path)

    return normalized_files


def resolve_voice_reference_files(args: argparse.Namespace, work_dir: Path) -> list[Path]:
    bundle_source: Path
    if args.voice_ref_path:
        bundle_source = Path(args.voice_ref_path).expanduser().resolve()
        if not bundle_source.exists():
            raise NarrationRenderError(f"Voice reference path does not exist: {bundle_source}")
    elif args.voice_ref_bundle_url:
        bundle_destination = work_dir / "downloads" / "voice-ref-bundle"
        bundle_source = download_bundle(
            args.voice_ref_bundle_url,
            bundle_destination,
            args.voice_ref_bundle_sha256,
        )
    else:
        raise NarrationRenderError("Provide either --voice-ref-path or --voice-ref-bundle-url.")

    unpacked_root = unpack_bundle(bundle_source, work_dir / "voice-ref-extracted")
    audio_files = collect_audio_files(unpacked_root)
    return normalize_reference_audio_files(audio_files, work_dir / "voice-ref-wav")


def choose_device(preference: str) -> str:
    if preference == "cpu":
        return "cpu"
    try:
        import torch  # type: ignore
    except ImportError as exc:
        if preference == "cuda":
            raise NarrationRenderError("Torch is required to honor --device cuda.") from exc
        return "cpu"

    if preference == "cuda":
        if not torch.cuda.is_available():
            raise NarrationRenderError("CUDA was requested but torch.cuda.is_available() is false.")
        return "cuda"
    return "cuda" if torch.cuda.is_available() else "cpu"


def load_tts_model(model_name: str, device: str):
    try:
        from TTS.api import TTS  # type: ignore
    except ImportError as exc:
        raise NarrationRenderError(
            "The Coqui TTS package is not installed. Install scripts/tts/requirements.txt in a Python 3.10 environment."
        ) from exc

    tts = TTS(model_name)
    if hasattr(tts, "to"):
        tts = tts.to(device)
    return tts


def synthesize_chunks(tts, chunks: Sequence[str], speaker_wavs: Sequence[Path], language: str, chunks_dir: Path) -> list[Path]:
    chunks_dir.mkdir(parents=True, exist_ok=True)
    rendered_paths: list[Path] = []
    speaker_inputs = [str(path) for path in speaker_wavs]

    for index, chunk in enumerate(chunks, start=1):
        output_path = chunks_dir / f"chunk-{index:03d}.wav"
        kwargs = {
            "text": chunk,
            "file_path": str(output_path),
            "speaker_wav": speaker_inputs,
            "language": language,
        }
        try:
            tts.tts_to_file(split_sentences=False, **kwargs)
        except TypeError as exc:
            if "split_sentences" not in str(exc):
                raise
            tts.tts_to_file(**kwargs)
        rendered_paths.append(output_path)

    return rendered_paths


def write_concat_file(audio_paths: Sequence[Path], concat_file: Path) -> Path:
    concat_file.parent.mkdir(parents=True, exist_ok=True)
    lines = []
    for audio_path in audio_paths:
        safe_path = str(audio_path.resolve()).replace("'", "'\\''")
        lines.append(f"file '{safe_path}'")
    concat_file.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return concat_file


def concat_and_encode_mp3(audio_paths: Sequence[Path], output_path: Path, work_dir: Path, bitrate: str) -> Path:
    if not audio_paths:
        raise NarrationRenderError("No audio chunks were rendered.")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    concat_file = write_concat_file(audio_paths, work_dir / "concat-list.txt")
    merged_wav = work_dir / "merged.wav"

    concat_command = ffmpeg_command(
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(concat_file),
        "-ar",
        "24000",
        "-ac",
        "1",
        "-c:a",
        "pcm_s16le",
        str(merged_wav),
    )
    run_command(concat_command)

    encode_command = ffmpeg_command(
        "-y",
        "-i",
        str(merged_wav),
        "-af",
        "silenceremove=start_periods=1:start_silence=0.25:start_threshold=-50dB:"
        "stop_periods=-1:stop_silence=0.35:stop_threshold=-50dB,loudnorm=I=-16:TP=-1.5:LRA=11",
        "-ar",
        "24000",
        "-ac",
        "1",
        "-c:a",
        "libmp3lame",
        "-b:a",
        bitrate,
        str(output_path),
    )
    run_command(encode_command)
    return output_path


def create_manifest(
    *,
    article_id: str,
    model_name: str,
    language: str,
    device: str,
    voice_profile_id: str,
    output_path: Path,
    work_dir: Path,
    chunks: Sequence[str],
    speaker_wavs: Sequence[Path],
    dry_run: bool,
) -> dict:
    return {
        "articleId": article_id,
        "modelName": model_name,
        "language": language,
        "device": device,
        "voiceProfileId": voice_profile_id,
        "outputPath": str(output_path),
        "workDir": str(work_dir),
        "chunkCount": len(chunks),
        "maxChunkChars": max(len(chunk) for chunk in chunks) if chunks else 0,
        "speakerWavs": [str(path) for path in speaker_wavs],
        "dryRun": dry_run,
    }


def write_manifest(manifest: dict, manifest_path: Path | None) -> None:
    if not manifest_path:
        return
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def run_self_test() -> None:
    ensure_command("ffmpeg")
    work_dir = Path(tempfile.mkdtemp(prefix="f1stories-tts-selftest-"))
    try:
        sample_text = (
            "First paragraph with enough words to force chunking. It should split at sentence boundaries. "
            "This keeps the renderer deterministic.\n\n"
            "Second paragraph includes another boundary; the chunker should preserve paragraph pauses."
        )
        chunks = chunk_narration_text(sample_text, 90)
        if len(chunks) < 3:
            raise NarrationRenderError(f"Self-test expected multiple chunks, got {len(chunks)}.")
        if any(len(chunk) > 90 for chunk in chunks):
            raise NarrationRenderError("Self-test produced an oversized chunk.")

        synthetic_chunks = []
        for index in range(1, 3):
            chunk_path = work_dir / f"synthetic-{index:02d}.wav"
            command = ffmpeg_command(
                "-y",
                "-f",
                "lavfi",
                "-i",
                f"sine=frequency={440 + (index * 30)}:duration=0.35",
                "-ac",
                "1",
                "-ar",
                "24000",
                "-c:a",
                "pcm_s16le",
                str(chunk_path),
            )
            run_command(command)
            synthetic_chunks.append(chunk_path)

        output_path = concat_and_encode_mp3(
            synthetic_chunks,
            work_dir / "self-test.mp3",
            work_dir,
            DEFAULT_MP3_BITRATE,
        )
        if not output_path.exists() or output_path.stat().st_size <= 1024:
            raise NarrationRenderError("Self-test MP3 output was not created correctly.")
        print("Phase 3 self-test passed.")
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


def build_output_path(article_id: str, explicit_output: str | None) -> Path:
    if explicit_output:
        return Path(explicit_output).expanduser().resolve()
    return (DEFAULT_OUTPUT_ROOT / f"{article_id}.mp3").resolve()


def build_work_dir(article_id: str, explicit_work_dir: str | None) -> Path:
    if explicit_work_dir:
        return Path(explicit_work_dir).expanduser().resolve()
    return (DEFAULT_OUTPUT_ROOT / article_id).resolve()


def main() -> int:
    args = parse_args()
    if args.self_test:
        run_self_test()
        return 0

    article_id = str(args.article_id)
    output_path = build_output_path(article_id, args.output)
    work_dir = build_work_dir(article_id, args.work_dir)
    manifest_path = Path(args.manifest_file).expanduser().resolve() if args.manifest_file else work_dir / "render-manifest.json"
    work_dir.mkdir(parents=True, exist_ok=True)

    try:
        narration_text = read_text_input(args)
        chunks = chunk_narration_text(narration_text, args.max_chars_per_chunk)
        speaker_wavs = resolve_voice_reference_files(args, work_dir)
        validate_runtime(
            args.model_name,
            args.language,
            args.allow_unsupported_language,
            args.allow_unsupported_runtime,
        )
        device = choose_device(args.device) if not args.dry_run else "n/a"

        if not args.dry_run:
            tts = load_tts_model(args.model_name, device)
            audio_chunks = synthesize_chunks(
                tts,
                chunks,
                speaker_wavs,
                args.language,
                work_dir / "tts-chunks",
            )
            concat_and_encode_mp3(audio_chunks, output_path, work_dir, args.mp3_bitrate)

        manifest = create_manifest(
            article_id=article_id,
            model_name=args.model_name,
            language=args.language,
            device=device,
            voice_profile_id=args.voice_profile_id,
            output_path=output_path,
            work_dir=work_dir,
            chunks=chunks,
            speaker_wavs=speaker_wavs,
            dry_run=args.dry_run,
        )
        write_manifest(manifest, manifest_path)
        print(json.dumps(manifest, indent=2, ensure_ascii=False))
        return 0
    except NarrationRenderError as exc:
        print(f"render_article_narration.py: {exc}", file=sys.stderr)
        return 1
    except subprocess.CalledProcessError as exc:
        print(f"render_article_narration.py: command failed with exit code {exc.returncode}: {exc.cmd}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
