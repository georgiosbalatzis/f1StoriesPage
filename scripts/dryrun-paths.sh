#!/bin/bash

echo "🔍 Dry Run: Listing problematic absolute paths (starting with `/`)"

# Find all .html files
find . -name "*.html" | while read file; do
  matches=$(grep -En 'href="/|src="/' "$file")
  if [[ ! -z "$matches" ]]; then
    echo "🔸 In $file:"
    echo "$matches" | sed 's/^/    ➤ /'
  fi
done

echo "✅ Dry run completed — these are the paths that would be rewritten."
