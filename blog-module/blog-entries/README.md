# F1 Stories Blog System

## Overview
This blog system allows for easy creation and management of blog posts using a simple folder-based structure.

## Prerequisites
- Node.js (v14+ recommended)
- npm (Node Package Manager)

## Setup
1. Clone the repository
2. Install dependencies:
```bash
npm install mammoth
```

## Blog Post Creation

### Folder Structure
Each blog post is stored in a folder named with the date (YYYYMMDD format) inside `blog-entries/`:

```
blog-entries/
└── 20250524/
    ├── 1.jpg       # Thumbnail image
    ├── 2.jpg       # Background/featured image
    └── post.docx   # Blog post content (Word or text file)
```

### Metadata (Optional)
You can include metadata at the top of your document:

```
---
title: Miami GP Review
author: F1 Stories Team
categories: Race Review, Formula 1
excerpt: A detailed look at the exciting Miami Grand Prix
---

[Rest of the blog post content]
```

## Generating Blog Content
Run the processor script to generate blog posts:

```bash
node blog-processor.js
```

This will:
- Convert documents to HTML
- Generate individual blog post pages
- Create a `blog-data.json` file
- Add related articles and navigation between posts

## Features
- Automatic metadata extraction
- Dynamic blog post generation
- Responsive design
- SEO-friendly URLs
- Related article suggestions

## Troubleshooting
- Ensure all image and document files are in the correct format
- Check that folder names follow the YYYYMMDD format
- Verify Node.js and dependencies are correctly installed

## Contributing
1. Create blog posts in the `blog-entries/` directory
2. Run the processor script
3. Commit and push changes

## License
[Your License Here]