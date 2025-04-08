#!/bin/bash

echo "♻️ Reverting all .html files to their .bak backups..."

find . -name "*.html.bak" | while read bakfile; do
  original="${bakfile%.bak}"
  echo "⏪ Restoring $original from backup"
  mv "$bakfile" "$original"
done

echo "✅ All files restored to original state."
