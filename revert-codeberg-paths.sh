#!/bin/bash

echo "♻️ Reverting HTML files to .bak backups (undo fix)..."

find . -name "*.html.bak" | while read bakfile; do
  original="${bakfile%.bak}"
  echo "⏪ Restoring $original"
  mv "$bakfile" "$original"
done

echo "✅ Revert complete."
