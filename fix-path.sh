#!/bin/bash

echo "🔧 Fixing HTML paths in project..."

# Fix paths in /spotify, /episodes
find ./spotify ./episodes -name "*.html" | while read file; do
  echo "🛠️  Updating $file"
  sed -i '' \
    -e 's|href="/pages/|href="../index.html|g' \
    -e 's|href="/pages/#|href="../index.html#|g' \
    -e 's|href="/pages/episodes/|href="../episodes/index.html|g' \
    "$file"
done

# Fix paths in /blog-module/blog/
find ./blog-module/blog -name "*.html" | while read file; do
  echo "🛠️  Updating $file"
  sed -i '' \
    -e 's|href="/pages/|href="../../index.html|g' \
    -e 's|href="/pages/#|href="../../index.html#|g' \
    -e 's|href="/pages/episodes/|href="../../episodes/index.html|g' \
    -e 's|href="/blog-module/blog/index.html|href="../../blog/index.html|g' \
    -e 's|/styles.css|../../styles.css|g' \
    -e 's|/images/logo.png|../../images/logo.png|g' \
    -e 's|/scripts/|../../scripts/|g' \
    "$file"
done

# Fix paths in /blog-module/blog-entries (article.html files)
find ./blog-module/blog-entries -name "article.html" | while read file; do
  echo "🛠️  Updating $file"
  sed -i '' \
    -e 's|/styles.css|../../styles.css|g' \
    -e 's|/images/logo.png|../../images/logo.png|g' \
    -e 's|/scripts/|../../scripts/|g' \
    -e 's|/blog-module/blog/index.html|../../blog/index.html|g' \
    "$file"
done

echo "✅ Done!"
