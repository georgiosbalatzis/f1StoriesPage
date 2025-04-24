#!/usr/bin/env bash
#===============================================================================
# convert_to_webp.sh — Convert all images in current folder to WebP and delete originals
# Requires: bash (nullglob/nocaseglob), cwebp
#===============================================================================

set -euo pipefail

#-------------------------------------------------------------------------------
# 1) Ensure cwebp is installed
#-------------------------------------------------------------------------------
command -v cwebp >/dev/null 2>&1 || {
  echo "Error: cwebp not found. Install via 'brew install webp' or 'sudo apt-get install webp'." >&2
  exit 1
}

#-------------------------------------------------------------------------------
# 2) Set quality (0–100)
#-------------------------------------------------------------------------------
QUALITY=80

#-------------------------------------------------------------------------------
# 3) Enable nullglob & nocaseglob for safe file matching
#-------------------------------------------------------------------------------
shopt -s nullglob nocaseglob    # ignore globs with no matches :contentReference[oaicite:0]{index=0}

#-------------------------------------------------------------------------------
# 4) Counter for converted files
#-------------------------------------------------------------------------------
count=0

echo "🔍 Converting images in $(pwd)…"

#-------------------------------------------------------------------------------
# 5) Loop through images via brace expansion
#-------------------------------------------------------------------------------
for SRC in *.{jpg,jpeg,png,bmp,tiff,gif}; do
  [[ -f "$SRC" ]] || continue    # skip non-files :contentReference[oaicite:1]{index=1}

  TARGET="${SRC%.*}.webp"

  # Skip if target exists and is newer
  if [[ -f "$TARGET" && "$TARGET" -nt "$SRC" ]]; then
    echo "⚡ Skipping up-to-date: $TARGET"
    continue
  fi

  echo "🔄 Converting: $SRC → $TARGET"
  if cwebp -q "$QUALITY" "$SRC" -o "$TARGET" >/dev/null 2>&1; then
    echo "✅ Success: $TARGET"
    ((count++))
    #-------------------------------------------------------------------------------
    # 6) Remove original on success
    #-------------------------------------------------------------------------------
    rm "$SRC" && echo "🗑️ Deleted original: $SRC"                   # remove original
  else
    echo "❌ Failed: $SRC"
  fi
done

#-------------------------------------------------------------------------------
# 7) Summary
#-------------------------------------------------------------------------------
if (( count == 0 )); then
  echo "ℹ️  No new conversions."
else
  echo "🎉 Converted $count images to WebP and removed originals!"
fi
