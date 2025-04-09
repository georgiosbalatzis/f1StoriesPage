#!/bin/bash

# Script to remove the "Follow Us" section in mobile view from all HTML files
# This script looks for the pattern that starts with <div class="footer-social-section md:hidden mt-6">
# and ends with </div> after all the social icons

echo "Starting to process HTML files..."

# Find all HTML files in the current directory
HTML_FILES=$(find . -maxdepth 1 -name "*.html")

# Counter for modified files
MODIFIED_COUNT=0

for file in $HTML_FILES; do
  echo "Processing $file..."

  # Create a backup of the original file
  cp "$file" "${file}.bak"

  # Use sed to remove the mobile "Follow Us" section
  # The pattern matching starts with the div class and ends after the closing div
  # We use the -i option for in-place editing and .bak for backup
  sed -i.temp '/<div class="footer-social-section md:hidden mt-6">/,/<\/div>/{
    /<div class="footer-social-section md:hidden mt-6">/d
    /<\/div>/!d
    /<\/div>/d
  }' "$file"

  # Check if file was modified
  if cmp -s "$file" "${file}.bak"; then
    echo "  No changes made to $file"
    # Remove temporary backup if no changes
    rm "${file}.temp"
  else
    echo "  Successfully removed 'Follow Us' section from $file"
    MODIFIED_COUNT=$((MODIFIED_COUNT + 1))
    # Remove temporary backup
    rm "${file}.temp"
  fi
done

echo "Process completed. Modified $MODIFIED_COUNT HTML files."
echo "Backup files with .bak extension have been created for the modified files."