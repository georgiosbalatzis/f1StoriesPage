#!/bin/bash

# Make sure required utilities are installed (for macOS)
if ! command -v trash &> /dev/null; then
    echo "Installing 'trash' utility..."
    brew install trash
fi

if ! command -v cwebp &> /dev/null; then
    echo "cwebp not found. Installing webp..."
    brew install webp
fi

# Folder to process (default is current directory)
FOLDER="${1:-.}"

# Counter for processed files
COUNT=0
SKIPPED=0

echo "Starting recursive conversion in: $FOLDER"
echo "Note: Files with 'logo' or 'default-blog' will be skipped."
echo "------------------------"

# Find the newest folder in blog-entries
NEWEST_BLOG_FOLDER=$(find "$FOLDER/blog-entries" -type d -printf '%T+ %p\n' | sort -r | head -n 1 | cut -d' ' -f2-)

# Process PNG and JPG/JPEG files recursively, ignoring specified files
find "$FOLDER" -type f \( -iname "*.png" -o -iname "*.jpg" -o -iname "*.jpeg" \) | while read -r FILE; do
    BASENAME=$(basename "$FILE")

    # Skip files with global exceptions
    if [[ "$BASENAME" == *"logo"* ]] || [[ "$BASENAME" == *"default-blog"* ]]; then
        echo "⏩ Skipping file: $FILE"
        ((SKIPPED++))
        continue
    fi

    # Skip additional exceptions for the newest folder in blog-entries
    if [[ "$FILE" == "$NEWEST_BLOG_FOLDER"* ]]; then
        if [[ "$BASENAME" == *"logo"* ]] || [[ "$BASENAME" == *"default-blog"* ]]; then
            echo "⏩ Skipping file: $FILE"
            ((SKIPPED++))
            continue
        fi
    fi

    FILENAME="${BASENAME%.*}"
    EXT="${BASENAME##*.}"
    DIR=$(dirname "$FILE")

    WEBP_OUTPUT="$DIR/$FILENAME.webp"

    # Skip if the WebP version already exists
    if [ -f "$WEBP_OUTPUT" ]; then
        echo "⏩ Skipping already converted: $FILE"
        ((SKIPPED++))
        continue
    fi

    echo "Converting: $FILE"

    # Convert to WebP with 80% quality
    echo "→ Creating WebP: $WEBP_OUTPUT"
    cwebp -q 80 "$FILE" -o "$WEBP_OUTPUT"
    WEBP_SUCCESS=$?

    # Check if conversion was successful
    if [ $WEBP_SUCCESS -eq 0 ]; then
        # Print file size comparison
        ORIGINAL_SIZE=$(du -h "$FILE" | cut -f1)
        WEBP_SIZE=$(du -h "$WEBP_OUTPUT" | cut -f1)

        echo "✓ Conversion successful! File sizes:"
        echo "   Original: $ORIGINAL_SIZE | WebP: $WEBP_SIZE"

        # Move original file to Trash
        echo "→ Moving original $EXT to Trash..."
        trash "$FILE"

        ((COUNT++))
    else
        echo "❌ Error during conversion of $FILE:"
        [ $WEBP_SUCCESS -ne 0 ] && echo "   WebP conversion failed"
        echo "   Original file kept."

        [ $WEBP_SUCCESS -ne 0 ] && [ -f "$WEBP_OUTPUT" ] && rm "$WEBP_OUTPUT"
    fi

    echo "------------------------"
done

echo "✅ Conversion complete."
echo "🔢 Successfully converted $COUNT files."
echo "⏩ Skipped $SKIPPED files (logos, default-blog, or already converted)."
