#!/bin/bash

# Make sure required utilities are installed (for macOS)
if ! command -v trash &> /dev/null; then
    echo "Installing 'trash' utility..."
    brew install trash
fi

if ! command -v avifenc &> /dev/null; then
    echo "avifenc not found. Please install libavif."
    echo "brew install libavif"
    exit 1
fi

if ! command -v cwebp &> /dev/null; then
    echo "cwebp not found. Installing webp..."
    brew install webp
fi

# Folder to process (default is current directory)
FOLDER="${1:-.}"

# Process PNG and JPG/JPEG files
find "$FOLDER" -type f \( -iname "*.png" -o -iname "*.jpg" -o -iname "*.jpeg" \) | while read -r FILE; do
    BASENAME=$(basename "$FILE")
    FILENAME="${BASENAME%.*}"
    EXT="${BASENAME##*.}"
    DIR=$(dirname "$FILE")

    # Output files
    AVIF_OUTPUT="$DIR/$FILENAME.avif"
    WEBP_OUTPUT="$DIR/$FILENAME.webp"

    echo "Converting: $FILE"

    # Convert to AVIF with quality 20-40 (lower number = higher quality)
    echo "→ Creating AVIF: $AVIF_OUTPUT"
    avifenc --min 20 --max 40 "$FILE" "$AVIF_OUTPUT"
    AVIF_SUCCESS=$?

    # Convert to WebP with 80% quality (as fallback format)
    echo "→ Creating WebP: $WEBP_OUTPUT"
    cwebp -q 80 "$FILE" -o "$WEBP_OUTPUT"
    WEBP_SUCCESS=$?

    # Check if both conversions were successful
    if [ $AVIF_SUCCESS -eq 0 ] && [ $WEBP_SUCCESS -eq 0 ]; then
        # Print file size comparison
        ORIGINAL_SIZE=$(du -h "$FILE" | cut -f1)
        AVIF_SIZE=$(du -h "$AVIF_OUTPUT" | cut -f1)
        WEBP_SIZE=$(du -h "$WEBP_OUTPUT" | cut -f1)

        echo "✓ Conversion successful! File sizes:"
        echo "   Original: $ORIGINAL_SIZE | AVIF: $AVIF_SIZE | WebP: $WEBP_SIZE"

        # Move original file to Trash
        echo "→ Moving original $EXT to Trash..."
        trash "$FILE"
    else
        echo "❌ Error during conversion of $FILE:"
        [ $AVIF_SUCCESS -ne 0 ] && echo "   AVIF conversion failed"
        [ $WEBP_SUCCESS -ne 0 ] && echo "   WebP conversion failed"
        echo "   Original file kept."

        # Clean up any partial conversion files
        [ $AVIF_SUCCESS -ne 0 ] && [ -f "$AVIF_OUTPUT" ] && rm "$AVIF_OUTPUT"
        [ $WEBP_SUCCESS -ne 0 ] && [ -f "$WEBP_OUTPUT" ] && rm "$WEBP_OUTPUT"
    fi

    echo "------------------------"
done

echo "✅ Conversion complete. Created both AVIF and WebP versions."