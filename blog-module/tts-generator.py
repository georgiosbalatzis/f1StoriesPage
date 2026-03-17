#!/usr/bin/env python3
"""
tts-generator.py — Build-time TTS audio generator using Microsoft Edge TTS

Generates high-quality Greek MP3 narration for each blog post.
Uses edge-tts (free, no API key, Neural voices).

Install:
    pip install edge-tts beautifulsoup4

Usage:
    python tts-generator.py                     # Generate for all posts missing audio
    python tts-generator.py --force             # Regenerate all audio
    python tts-generator.py --post 20250101G    # Generate for a specific post
    python tts-generator.py --list-voices       # Show available Greek voices
    python tts-generator.py --voice el-GR-NestorasNeural   # Use male voice

Available Greek voices:
    el-GR-AthinaNeural     (Female) — clear, natural, great for articles
    el-GR-NestorasNeural   (Male)   — deep, confident, great for analysis
"""

import asyncio
import argparse
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

# Default voice — Athina is clear and natural for Greek articles
DEFAULT_VOICE = "el-GR-AthinaNeural"

# Speaking rate: -50% to +200%. Negative = slower, positive = faster
DEFAULT_RATE = "-5%"   # Slightly slower for article readability

# Volume adjustment: -50% to +50%
DEFAULT_VOLUME = "+0%"

# Pitch adjustment
DEFAULT_PITCH = "+0Hz"


# ── Text extraction ───────────────────────────────────────────
def extract_article_text(html_path: Path) -> str | None:
    """Extract clean readable text from article.html for TTS."""
    if not html_path.exists():
        return None

    html = html_path.read_text(encoding="utf-8", errors="replace")
    soup = BeautifulSoup(html, "html.parser")

    # Find the article content div
    content_div = soup.select_one(".article-content")
    if not content_div:
        print(f"   ⚠️  No .article-content found")
        return None

    # Remove elements that shouldn't be narrated
    for tag in content_div.select(
        "script, style, .tts-widget, .social-share-bar, "
        ".youtube-embed-container, .csv-error, .table-responsive-container, "
        "iframe, img, figure figcaption, .article-gallery"
    ):
        tag.decompose()

    # Extract text with structural awareness
    parts = []

    for element in content_div.descendants:
        if element.name in ("h1", "h2", "h3", "h4"):
            text = element.get_text(strip=True)
            if text:
                # Add a pause before headings for natural flow
                parts.append(f"\n\n{text}.\n\n")
        elif element.name == "p":
            text = element.get_text(strip=True)
            if text:
                parts.append(text + "\n\n")
        elif element.name == "li":
            text = element.get_text(strip=True)
            if text:
                parts.append(text + ".\n")
        elif element.name == "blockquote":
            text = element.get_text(strip=True)
            if text:
                parts.append(f"\n{text}\n\n")

    if not parts:
        # Fallback: just get all text
        text = content_div.get_text(separator="\n", strip=True)
        if text:
            parts = [text]

    full_text = " ".join(parts)

    # Clean up
    full_text = re.sub(r"\n{3,}", "\n\n", full_text)
    full_text = re.sub(r"[ \t]+", " ", full_text)
    full_text = full_text.strip()

    # Remove common artifacts
    full_text = re.sub(r"CSV_TABLE:\S+", "", full_text)
    full_text = re.sub(r"\[img-instert-tag\]", "", full_text)

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


async def generate_for_post(post_dir: Path, voice: str, rate: str, volume: str, pitch: str) -> bool:
    """Generate narration MP3 for a single blog post."""
    folder_name = post_dir.name
    article_path = post_dir / "article.html"
    output_path = post_dir / OUTPUT_FILENAME

    print(f"\n🎙️  Processing: {folder_name}")

    # Extract text
    text = extract_article_text(article_path)
    if not text:
        print(f"   ⚠️  Skipping — no usable text found")
        return False

    char_count = len(text)
    word_count = len(text.split())
    est_minutes = max(1, round(word_count / 150))
    print(f"   📝 {char_count:,} chars, ~{word_count:,} words (~{est_minutes} min audio)")

    # Generate
    start = time.time()
    print(f"   🔊 Generating with {voice}...", end="", flush=True)

    success = await generate_mp3(text, output_path, voice, rate, volume, pitch)

    if success and output_path.exists():
        elapsed = time.time() - start
        size_mb = output_path.stat().st_size / (1024 * 1024)
        print(f" ✅ ({size_mb:.2f} MB, {elapsed:.1f}s)")
        return True
    else:
        print(f" ❌ Failed")
        return False


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
    print(f"\n💡 Usage: python tts-generator.py --voice {greek[0]['ShortName']}")


# ── Main ──────────────────────────────────────────────────────
async def main():
    parser = argparse.ArgumentParser(
        description="Generate MP3 narration for F1 Stories blog posts using Edge TTS",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python tts-generator.py                          Generate missing audio
  python tts-generator.py --force                  Regenerate all
  python tts-generator.py --post 20250615G         Single post
  python tts-generator.py --voice el-GR-NestorasNeural   Male voice
  python tts-generator.py --rate "-10%"            Slower narration
  python tts-generator.py --list-voices            Show available voices
        """,
    )
    parser.add_argument("--force", action="store_true", help="Regenerate all audio files")
    parser.add_argument("--post", type=str, help="Generate for a specific post folder name")
    parser.add_argument("--voice", type=str, default=DEFAULT_VOICE, help=f"TTS voice (default: {DEFAULT_VOICE})")
    parser.add_argument("--rate", type=str, default=DEFAULT_RATE, help=f"Speaking rate (default: {DEFAULT_RATE})")
    parser.add_argument("--volume", type=str, default=DEFAULT_VOLUME, help=f"Volume (default: {DEFAULT_VOLUME})")
    parser.add_argument("--pitch", type=str, default=DEFAULT_PITCH, help=f"Pitch (default: {DEFAULT_PITCH})")
    parser.add_argument("--list-voices", action="store_true", help="List available Greek voices")
    parser.add_argument("--blog-dir", type=str, default=None, help="Override blog entries directory")

    args = parser.parse_args()

    if args.list_voices:
        await list_voices()
        return

    blog_dir = Path(args.blog_dir) if args.blog_dir else BLOG_DIR

    if not blog_dir.exists():
        print(f"❌ Blog entries directory not found: {blog_dir}")
        print(f"   Run from the blog-module directory, or use --blog-dir")
        sys.exit(1)

    print("🎙️  F1 Stories TTS Generator (Edge TTS)")
    print(f"   Voice:  {args.voice}")
    print(f"   Rate:   {args.rate}")
    print(f"   Mode:   {'Force regenerate all' if args.force else f'Single post: {args.post}' if args.post else 'Generate missing only'}")
    print(f"   Dir:    {blog_dir}")
    print()

    # Collect post directories
    if args.post:
        target = blog_dir / args.post
        if not target.exists():
            print(f"❌ Post directory not found: {target}")
            sys.exit(1)
        post_dirs = [target]
    else:
        post_dirs = sorted(
            [d for d in blog_dir.iterdir() if d.is_dir()],
            key=lambda d: d.name,
        )

    generated = 0
    skipped = 0
    failed = 0
    total_chars = 0

    for post_dir in post_dirs:
        audio_path = post_dir / OUTPUT_FILENAME

        # Skip if audio exists (unless --force)
        if not args.force and audio_path.exists() and audio_path.stat().st_size > 1000:
            size_kb = audio_path.stat().st_size / 1024
            print(f"⏭️  Skipping {post_dir.name} — audio exists ({size_kb:.0f} KB)")
            skipped += 1
            continue

        # Count characters
        article_path = post_dir / "article.html"
        text = extract_article_text(article_path)
        if text:
            total_chars += len(text)

        success = await generate_for_post(post_dir, args.voice, args.rate, args.volume, args.pitch)
        if success:
            generated += 1
        else:
            failed += 1

    print("\n" + "═" * 50)
    print(f"✅ Generated: {generated}")
    print(f"⏭️  Skipped:   {skipped}")
    print(f"❌ Failed:     {failed}")
    print(f"📝 Characters: ~{total_chars:,}")
    print("═" * 50)


if __name__ == "__main__":
    asyncio.run(main())
