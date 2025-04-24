#!/usr/bin/env bash
set -euo pipefail

#===============================================================================
# build_memes_json.sh — scan all .webp in CWD and build memes.json
#===============================================================================

# Enable nullglob so "*.webp" with no matches expands to nothing
shopt -s nullglob

OUT="memes.json"
echo "[" > "$OUT"

first=true
for file in *.webp; do
  # strip extension
  base="${file%.*}"

  # make a human-readable title:
  # 1) replace underscores/hyphens with spaces
  # 2) insert a space between lower→upper transitions (e.g. "SainzJesus" → "Sainz Jesus")
  title=$(printf "%s" "$base" \
    | sed -E 's/[_-]+/ /g' \
    | sed -E 's/([a-z])([A-Z])/\1 \2/g')

  # comma-separate entries (but no leading comma)
  if $first; then
    first=false
  else
    echo "," >> "$OUT"
  fi

  # append this entry
  # note: we escape the title for JSON
  esc_title=$(printf '%s' "$title" | sed 's/"/\\"/g')
  printf '  {"title": "%s", "filename": "%s"}\n' "$esc_title" "$file" >> "$OUT"
done

echo "]" >> "$OUT"

echo "✅ Wrote $(wc -l < "$OUT")-line $OUT with $(ls *.webp | wc -l) memes."
