#!/bin/bash

# Log file & fallback folder
LOGFILE="fix-log.txt"
FALLBACK_DIR="fallback"
mkdir -p "$FALLBACK_DIR"

echo "🧼 F1 HTML Footer Fix Log — $(date)" > "$LOGFILE"

# Find all .html files recursively
find . -type f -name "*.html" | while read -r FILE; do
  # Check for both necessary markers
  if grep -q "</footer>" "$FILE" && grep -q '<div class="mobile-menu-wrapper hidden md:hidden"' "$FILE"; then
    echo "🔧 Fixing: $FILE"

    # Backup the file to fallback folder (preserving relative path)
    RELATIVE_PATH="${FILE#./}"
    BACKUP_PATH="$FALLBACK_DIR/$RELATIVE_PATH"
    BACKUP_DIR=$(dirname "$BACKUP_PATH")
    mkdir -p "$BACKUP_DIR"
    cp "$FILE" "$BACKUP_PATH"
    echo "  💾 Backup saved: $BACKUP_PATH"

    # Extract content up to and including </footer>
    HEADER=$(awk '/<\/footer>/{print; exit} 1' "$FILE")

    # Extract from mobile menu onward
    FOOTER=$(awk '/<div class="mobile-menu-wrapper hidden md:hidden"/,EOF' "$FILE")

    # Rebuild file
    {
      echo "$HEADER"
      echo ""
      echo "<!-- ✅ Removed duplicate footer social & copyright sections -->"
      echo ""
      echo "$FOOTER"
    } > "$FILE"

    echo "  ✅ Cleaned $FILE"
    echo "✅ Cleaned: $FILE" >> "$LOGFILE"

  else
    echo "✅ Already clean or not matching: $FILE"
    echo "⚠️ Skipped (no duplication found): $FILE" >> "$LOGFILE"
  fi
done

echo -e "\n📦 All done! Backups in /fallback, see fix-log.txt for results."
