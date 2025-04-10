#!/bin/bash

echo "🔧 Fixing HTML paths for GitHub Pages (repo: /f1stories.github.io)..."

fix_paths() {
  file="$1"
  depth="$2"
  prefix=$(printf '../%.0s' $(seq 1 $depth))

  echo "🛠️  Updating $file with prefix: $prefix"

  cp "$file" "$file.bak"

  sed -i '' \
    -e "s|href=\"/styles.css|href=\"${prefix}styles.css|g" \
    -e "s|src=\"/scripts/|src=\"${prefix}scripts/|g" \
    -e "s|src=\"/images/|src=\"${prefix}images/|g" \
    -e "s|href=\"/images/|href=\"${prefix}images/|g" \
    -e "s|href=\"/blog-module/|href=\"${prefix}blog-module/|g" \
    -e "s|href=\"/episodes/|href=\"${prefix}episodes/|g" \
    -e "s|href=\"/index.html|href=\"${prefix}index.html|g" \
    "$file"
}

# Root level = depth 0
find . -maxdepth 1 -name "*.html" | while read file; do
  fix_paths "$file" 0
done

# One level deep = depth 1 (spotify, episodes)
find ./spotify ./episodes -maxdepth 1 -name "*.html" | while read file; do
  fix_paths "$file" 1
done

# Two levels deep = depth 2 (blog-module/blog)
find ./blog-module/blog -maxdepth 1 -name "*.html" | while read file; do
  fix_paths "$file" 2
done

# Three levels deep = depth 3 (blog-module/blog-entries/xxxx/article.html)
find ./blog-module/blog-entries -mindepth 2 -name "article.html" | while read file; do
  fix_paths "$file" 3
done

echo "✅ Paths fixed with .bak backups created!"
