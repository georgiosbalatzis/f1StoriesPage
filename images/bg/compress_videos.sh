#!/bin/bash

# Directory containing the MP4 videos
VIDEO_DIR="."

# Check if the directory exists
if [ ! -d "$VIDEO_DIR" ]; then
  echo "Directory $VIDEO_DIR does not exist."
  exit 1
fi

# Loop through all MP4 files in the directory
for video in "$VIDEO_DIR"/*.mp4; do
  # Check if it's a file and not a directory
  if [ -f "$video" ]; then
    # Extract the filename without extension
    filename=$(basename -- "$video")
    filename="${filename%.*}"

    # Define output file path
    output_video="$VIDEO_DIR/${filename}_compressed.mp4"

    # Compress the video using ffmpeg
    ffmpeg -i "$video" -vcodec libx264 -crf 23 -preset slow -vf "scale=1280:720" -acodec aac -b:a 128k "$output_video"

    # Check if ffmpeg was successful
    if [ $? -eq 0 ]; then
      echo "Compressed $video to $output_video"
      # Remove the original video
      rm "$video"
      echo "Removed original video: $video"
    else
      echo "Failed to compress $video"
    fi
  fi
done

echo "MP4 video compression complete."
