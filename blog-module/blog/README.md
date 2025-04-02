# F1 Stories Blog System

This document provides an overview of the dynamic blog system implemented for the F1 Stories website.

## System Overview

The blog system consists of three main components:

1. **Blog Content Processing** - A Node.js script that processes text/Word documents into HTML
2. **Blog Data Storage** - A JSON file that stores metadata about all blog posts
3. **Client-Side Display** - JavaScript that loads and displays blog posts dynamically

## File Structure

```
/
├── blog-data.json              # Central blog post metadata
├── blog-loader.js              # Client-side loader script
├── blog-processor.js           # Server-side processing script
├── blog-entries/               # Raw blog post content
│   ├── 20250524/               # Date-based folders (YYYYMMDD)
│   │   ├── miami-gp-review.txt # Content file (title is first line)
│   │   ├── 1.jpg               # Entry thumbnail image
│   │   └── 2.jpg               # Background/header image
│   └── ...
├── blog/                       # Generated blog HTML files
│   ├── index.html              # Blog index page
│   ├── miami-gp-review.html    # Individual blog post pages
│   ├── ferrari-comeback.html
│   └── ...
└── ...
```

## How the System Works

### 1. Content Creation

Authors create blog posts as text files (.txt) or Word documents (.docx) in date-based folders:

- The folder name follows the YYYYMMDD format
- The document's first line becomes the post title
- Images are saved as 1.jpg (thumbnail) and 2.jpg (header image) in the same folder
- Categories/tags are added as hashtags at the end of the content (#Category1 #Category2)

### 2. Content Processing

The `blog-processor.js` script:

- Scans the `/blog-entries` directory for date folders
- Reads and processes each content file
- Extracts title, date, categories, and content
- Generates an excerpt from the content
- Creates blog post HTML files from a template
- Builds the `blog-data.json` file with all post metadata

### 3. Dynamic Display

The client-side functionality:

- `blog-loader.js` loads data from `blog-data.json`
- On the homepage: Shows the 3 most recent blog posts
- On the blog index page: Shows all posts with filtering and search
- Handles category filtering, search functionality, and animations

## Key Features

### Homepage Blog Section
- Automatically displays the 3 most recent blog posts
- Each post shows thumbnail, title, author, date, and excerpt
- Clicking "Read More" takes the user to the full article

### Blog Index Page
- Shows a featured post (most recent) at the top
- Displays all blog posts in a grid layout
- Includes dynamic filtering by category
- Features a search function that highlights matching text
- All posts are sorted by date (newest first)

### Individual Blog Posts
- Generated from a template with consistent styling
- Shows the full content with proper formatting
- Displays related articles at the bottom
- Includes navigation to previous/next posts

## How to Add a New Blog Post

1. **Create a folder** in `/blog-entries` with today's date (YYYYMMDD format)
2. **Create a text file** with your content (title as the first line)
3. **Add two images**:
    - `1.jpg` - Thumbnail image for preview cards
    - `2.jpg` - Header image for the article page
4. **Run the processor script**:
   ```
   node blog-processor.js
   ```
5. **That's it!** The new post will automatically appear on your site

## Technical Details

### Server-Side Requirements
- Node.js
- npm packages: mammoth (for Word document processing)

### Blog Post Format
- Simple text or Word documents
- Markdown-style formatting:
    - `## Heading` for section headings
    - `> Quote text` for quotations
    - Regular paragraphs separated by blank lines
    - `#tag1 #tag2` at the end for categories

### Customization
- Blog appearance can be modified through CSS
- Blog template can be adjusted for different layouts
- Processing script can be extended for additional formats

## Best Practices

- Keep paragraphs short and concise
- Use section headings to break up content
- Include relevant images with good quality (but reasonable file size)
- Add appropriate categories/tags for better organization
- Run the processor whenever new content is added

## Troubleshooting

- If a post doesn't appear, check the browser console for errors
- Ensure image files are named correctly (1.jpg and 2.jpg)
- Verify that the date folder is in the correct format (YYYYMMDD)
- Check that the processor script has proper permissions to read/write files