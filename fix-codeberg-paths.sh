#!/bin/bash

echo "🔧 Fixing paths for Codeberg Pages (site root: /)"

fix_paths() {
  file="$1"
  echo "🛠️  Updating $file → restoring absolute paths"

  cp "$file" "$file.bak"

  sed -i '' \
    -e 's|href="\.\./\.\./styles.css|href="/styles.css|g' \
    -e 's|href="\.\./styles.css|href="/styles.css|g' \
    -e 's|href="styles.css"|href="/styles.css|g' \
    -e 's|src="\.\./\.\./scripts/|src="/scripts/|g' \
    -e 's|src="\.\./scripts/|src="/scripts/|g' \
    -e 's|src="scripts/|src="/scripts/|g' \
    -e 's|src="\.\./\.\./images/|src="/images/|g' \
    -e 's|src="\.\./images/|src="/images/|g' \
    -e 's|src="images/|src="/images/|g' \
    -e 's|href="\.\./\.\./images/|href="/images/|g' \
    -e 's|href="\.\./images/|href="/images/|g' \
    -e 's|href="images/|href="/images/|g' \
    -e 's|href="\.\./index.html|href="/index.html|g' \
    -e 's|href="\.\./episodes/index.html|href="/episodes/index.html|g' \
    -e 's|href="\.\./\.\./blog-module/|href="/blog-module/|g' \
    "$file"
}

find . -name "*.html" | while read file; do
  fix_paths "$file"
done

echo "✅ All paths updated for Codeberg. Backups saved as .bak."
