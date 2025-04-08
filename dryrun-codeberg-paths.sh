#!/bin/bash

echo "🔍 Dry-run: Listing relative paths that would be rewritten to absolute"

find . -name "*.html" | while read file; do
  matches=$(grep -En 'href="\.\.|src="\.\.' "$file")
  if [[ ! -z "$matches" ]]; then
    echo "🔸 $file:"
    echo "$matches" | sed 's/^/    ➤ /'
  fi
done

echo "✅ Done. Above lines would be changed by fix-codeberg-paths.sh"
