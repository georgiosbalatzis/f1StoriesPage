#!/usr/bin/env python3
"""
tts-generator-parallel.py — Parallel build-time TTS audio generator using Microsoft Edge TTS

Generates high-quality Greek MP3 narration for each blog post.
Uses edge-tts (free, no API key, Neural voices).

Install:
    pip install edge-tts beautifulsoup4

Usage:
    python tts-generator-parallel.py                    # Generate for all posts missing audio
    python tts-generator-parallel.py --force            # Regenerate all audio
    python tts-generator-parallel.py --post 20250101G   # Generate for a specific post
    python tts-generator-parallel.py --parallel 8       # Run 8 concurrent TTS jobs
    python tts-generator-parallel.py --list-voices      # Show available Greek voices
    python tts-generator-parallel.py --voice el-GR-NestorasNeural   # Use male voice
"""

import argparse
import asyncio
import os
import re
import sys
import time
from pathlib import Path

try:
    import edge_tts
except ImportError:
    print("❌ edge-tts not installed. Run: pip install edge-tts")
    sys.exit(1)

try:
    from bs4 import BeautifulSoup
except ImportError:
    print("❌ beautifulsoup4 not installed. Run: pip install beautifulsoup4")
    sys.exit(1)


# ── Configuration ─────────────────────────────────────────────
BLOG_DIR = Path(__file__).parent / "blog-entries"
OUTPUT_FILENAME = "narration.mp3"

DEFAULT_VOICE = "el-GR-AthinaNeural"
DEFAULT_RATE = "-5%"
DEFAULT_VOLUME = "+0%"
DEFAULT_PITCH = "+0Hz"
DEFAULT_PARALLEL = min(8, max(1, (os.cpu_count() or 4)))


# ── Text extraction ───────────────────────────────────────────
def extract_article_text(html_path: Path) -> str | None:
    """Extract clean readable text from article.html for TTS."""
    if not html_path.exists():
        return None

    html = html_path.read_text(encoding="utf-8", errors="replace")
    soup = BeautifulSoup(html, "html.parser")

    content_div = soup.select_one(".article-content")
    if not content_div:
        print(f"   ⚠️  No .article-content found in {html_path}")
        return None

    for tag in content_div.select(
        "script, style, .tts-widget, .social-share-bar, "
        ".youtube-embed-container, .csv-error, .table-responsive-container, "
        "iframe, img, figure figcaption, .article-gallery"
    ):
        tag.decompose()

    parts = []
    for element in content_div.descendants:
        if getattr(element, "name", None) in ("h1", "h2", "h3", "h4"):
            text = element.get_text(strip=True)
            if text:
                parts.append(f"\n\n{text}.\n\n")
        elif getattr(element, "name", None) == "p":
            text = element.get_text(strip=True)
            if text:
                parts.append(text + "\n\n")
        elif getattr(element, "name", None) == "li":
            text = element.get_text(strip=True)
            if text:
                parts.append(text + ".\n")
        elif getattr(element, "name", None) == "blockquote":
            text = element.get_text(strip=True)
            if text:
                parts.append(f"\n{text}\n\n")

    if not parts:
        text = content_div.get_text(separator="\n", strip=True)
        if text:
            parts = [text]

    full_text = " ".join(parts)
    full_text = re.sub(r"\n{3,}", "\n\n", full_text)
    full_text = re.sub(r"[ \t]+", " ", full_text)
    full_text = re.sub(r"CSV_TABLE:\S+", "", full_text)
    full_text = re.sub(r"\[img-instert-tag\]", "", full_text)
    full_text = full_text.strip()

    return full_text if len(full_text) > 50 else None


# ── TTS generation ────────────────────────────────────────────
async def generate_mp3(text: str, output_path: Path, voice: str, rate: str, volume: str, pitch: str) -> bool:
    """Generate MP3 from text using Edge TTS."""
    try:
        communicate = edge_tts.Communicate(
            text=text,
            voice=voice,
            rate=rate,
            volume=volume,
            pitch=pitch,
        )
        await communicate.save(str(output_path))
        return True
    except Exception as e:
        print(f"   ❌ TTS error: {e}")
        return False


async def generate_for_post(post_dir: Path, voice: str, rate: str, volume: str, pitch: str, semaphore: asyncio.Semaphore):
    """Generate narration MP3 for a single blog post with bounded parallelism."""
    folder_name = post_dir.name
    article_path = post_dir / "article.html"
    output_path = post_dir / OUTPUT_FILENAME

    text = extract_article_text(article_path)
    if not text:
        print(f"⚠️  Skipping {folder_name} — no usable text found")
        return {
            "status": "failed",
            "folder": folder_name,
            "chars": 0,
        }

    char_count = len(text)
    word_count = len(text.split())
    est_minutes = max(1, round(word_count / 150))

    async with semaphore:
        print(f"🎙️  {folder_name}: {char_count:,} chars, ~{word_count:,} words (~{est_minutes} min) — generating...")
        start = time.time()
        success = await generate_mp3(text, output_path, voice, rate, volume, pitch)
        elapsed = time.time() - start

    if success and output_path.exists() and output_path.stat().st_size > 1000:
        size_mb = output_path.stat().st_size / (1024 * 1024)
        print(f"✅ {folder_name}: done ({size_mb:.2f} MB, {elapsed:.1f}s)")
        return {
            "status": "generated",
            "folder": folder_name,
            "chars": char_count,
            "elapsed": elapsed,
        }

    print(f"❌ {folder_name}: failed")
    return {
        "status": "failed",
        "folder": folder_name,
        "chars": char_count,
        "elapsed": elapsed,
    }


# ── Voice listing ─────────────────────────────────────────────
async def list_voices():
    """List all available Greek voices."""
    print("🎤 Available Greek voices:\n")
    voices = await edge_tts.list_voices()
    greek = [v for v in voices if v["Locale"].startswith("el")]

    if not greek:
        print("   No Greek voices found. Available locales:")
        locales = sorted(set(v["Locale"] for v in voices))
        for loc in locales[:20]:
            print(f"     {loc}")
        return

    for v in greek:
        marker = " ← default" if v["ShortName"] == DEFAULT_VOICE else ""
        print(f"   {v['ShortName']:30s} {v['Gender']:8s} {v['Locale']}{marker}")

    print(f"\n   Total: {len(greek)} Greek voice(s)")
    print(f"\n💡 Usage: python tts-generator-parallel.py --voice {greek[0]['ShortName']}")


# ── Main ──────────────────────────────────────────────────────
async def main():
    parser = argparse.ArgumentParser(
        description="Generate MP3 narration for F1 Stories blog posts using Edge TTS",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python tts-generator-parallel.py                       Generate missing audio
  python tts-generator-parallel.py --force               Regenerate all
  python tts-generator-parallel.py --post 20250615G      Single post
  python tts-generator-parallel.py --parallel 8          Run 8 concurrent jobs
  python tts-generator-parallel.py --voice el-GR-NestorasNeural
  python tts-generator-parallel.py --rate "-10%"
  python tts-generator-parallel.py --list-voices
        """,
    )
    parser.add_argument("--force", action="store_true", help="Regenerate all audio files")
    parser.add_argument("--post", type=str, help="Generate for a specific post folder name")
    parser.add_argument("--voice", type=str, default=DEFAULT_VOICE, help=f"TTS voice (default: {DEFAULT_VOICE})")
    parser.add_argument("--rate", type=str, default=DEFAULT_RATE, help=f"Speaking rate (default: {DEFAULT_RATE})")
    parser.add_argument("--volume", type=str, default=DEFAULT_VOLUME, help=f"Volume (default: {DEFAULT_VOLUME})")
    parser.add_argument("--pitch", type=str, default=DEFAULT_PITCH, help=f"Pitch (default: {DEFAULT_PITCH})")
    parser.add_argument("--parallel", type=int, default=DEFAULT_PARALLEL, help=f"Concurrent TTS jobs (default: {DEFAULT_PARALLEL})")
    parser.add_argument("--list-voices", action="store_true", help="List available Greek voices")
    parser.add_argument("--blog-dir", type=str, default=None, help="Override blog entries directory")

    args = parser.parse_args()

    if args.list_voices:
        await list_voices()
        return

    blog_dir = Path(args.blog_dir) if args.blog_dir else BLOG_DIR
    if not blog_dir.exists():
        print(f"❌ Blog entries directory not found: {blog_dir}")
        print("   Run from the blog-module directory, or use --blog-dir")
        sys.exit(1)

    parallel = max(1, args.parallel)
    semaphore = asyncio.Semaphore(parallel)

    print("🎙️  F1 Stories TTS Generator (Edge TTS, Parallel)")
    print(f"   Voice:     {args.voice}")
    print(f"   Rate:      {args.rate}")
    print(f"   Parallel:  {parallel}")
    print(f"   Mode:      {'Force regenerate all' if args.force else f'Single post: {args.post}' if args.post else 'Generate missing only'}")
    print(f"   Dir:       {blog_dir}")
    print()

    if args.post:
        target = blog_dir / args.post
        if not target.exists():
            print(f"❌ Post directory not found: {target}")
            sys.exit(1)
        post_dirs = [target]
    else:
        post_dirs = sorted([d for d in blog_dir.iterdir() if d.is_dir()], key=lambda d: d.name)

    jobs = []
    skipped = 0
    total_chars = 0

    for post_dir in post_dirs:
        audio_path = post_dir / OUTPUT_FILENAME

        if not args.force and audio_path.exists() and audio_path.stat().st_size > 1000:
            size_kb = audio_path.stat().st_size / 1024
            print(f"⏭️  Skipping {post_dir.name} — audio exists ({size_kb:.0f} KB)")
            skipped += 1
            continue

        article_path = post_dir / "article.html"
        text = extract_article_text(article_path)
        if text:
            total_chars += len(text)

        jobs.append(asyncio.create_task(generate_for_post(
            post_dir,
            args.voice,
            args.rate,
            args.volume,
            args.pitch,
            semaphore,
        )))

    started = time.time()
    results = await asyncio.gather(*jobs) if jobs else []
    total_elapsed = time.time() - started

    generated = sum(1 for r in results if r["status"] == "generated")
    failed = sum(1 for r in results if r["status"] == "failed")

    print("\n" + "═" * 50)
    print(f"✅ Generated: {generated}")
    print(f"⏭️  Skipped:   {skipped}")
    print(f"❌ Failed:     {failed}")
    print(f"📝 Characters: ~{total_chars:,}")
    print(f"⏱️  Total time: {total_elapsed:.1f}s")
    print("═" * 50)


if __name__ == "__main__":
    asyncio.run(main())
