# F1 Stories Blog: Setup Instructions for Static Hosting

## Overview
These instructions will guide you through setting up your static blog system for hosting on Codeberg or similar static hosting services.

## Files Structure
Follow this structure to ensure all files are properly organized:

```
/ (root directory)
├── index.html
├── styles.css
├── script.js
├── background-randomizer.js
├── images/
│   ├── logo.png
│   ├── bg.jpg
│   ├── LN.webp
│   ├── SV.webp
│   ├── FA.webp
│   └── default-avatar.jpg
├── episodes.js
├── blog-module/
│   ├── blog-loader.js          # Updated static loader script
│   ├── blog-styles.css         # Separated blog styles
│   ├── blog-data.json          # Static JSON file with blog post data
│   ├── images/
│   │   ├── default-blog.jpg    # Fallback image for blog thumbnails
│   │   ├── default-blog-bg.jpg # Fallback image for blog backgrounds
│   │   └── blog/               # Directory for blog post images
│   │       ├── verstappen-dominance.jpg
│   │       ├── verstappen-background.jpg
│   │       └── ... (other blog images)
│   ├── blog/
│       ├── index.html          # Blog index page (listing all posts)
│       ├── 20240315.html       # Individual blog post pages
│       └── ... (other blog posts)
```

## Required Files
Make sure these files exist:

1. `/blog-module/blog-loader.js` - JS script that loads blog content
2. `/blog-module/blog-styles.css` - Styling for blog pages
3. `/blog-module/blog-data.json` - Data for all blog posts
4. `/blog-module/blog/index.html` - Blog index/listing page
5. `/blog-module/images/default-blog.jpg` - Default thumbnail image
6. `/blog-module/images/default-blog-bg.jpg` - Default header background

## Setting Up Your First Blog Post

1. **Create a blog post file**
    - Create a new HTML file in `/blog-module/blog/` with a name following the format `YYYYMMDD.html` (e.g., `20240331.html`)
    - Use the following template:

   ```html
   <!DOCTYPE html>
   <html lang="en">
   <head>
       <meta charset="UTF-8">
       <meta name="viewport" content="width=device-width, initial-scale=1.0">
       <title>Your Blog Title - F1 Stories Blog</title>
       <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
       <link rel="stylesheet" href="/styles.css">
       <link rel="stylesheet" href="/blog-module/blog-styles.css">
       <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" rel="stylesheet">
       <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
   </head>
   <body>
   <!-- Your blog post content here -->
   </body>
   </html>
   ```

2. **Add blog post images**
    - Add at least two images for your blog post:
        - A thumbnail image: `/blog-module/images/blog/your-post-thumbnail.jpg`
        - A header background: `/blog-module/images/blog/your-post-background.jpg`

3. **Update blog-data.json**
    - Add an entry for your post in `/blog-module/blog-data.json`:

   ```json
   {
     "id": "YYYYMMDD",  // The date ID matching your HTML filename
     "title": "Your Blog Post Title",
     "author": "Your Name",
     "date": "YYYY-MM-DD",
     "displayDate": "Month DD, YYYY",
     "image": "/blog-module/images/blog/your-post-thumbnail.jpg",
     "backgroundImage": "/blog-module/images/blog/your-post-background.jpg",
     "excerpt": "A short description of your blog post (2-3 sentences)",
     "comments": 0,
     "url": "/blog-module/blog/YYYYMMDD.html",
     "categories": ["Category1", "Category2"]
   }
   ```

## Troubleshooting

If you experience issues with image loading, check the following:

1. **Path issues**: Make sure all paths are correct. The system will try both absolute paths (starting with `/`) and relative paths.

2. **Fallback images**: Ensure you have default images at:
    - `/blog-module/images/default-blog.jpg`
    - `/blog-module/images/default-blog-bg.jpg`

3. **JSON errors**: Verify your `blog-data.json` file is valid JSON (no trailing commas, quotes around all keys and string values)

4. **Console errors**: Check your browser's developer console for any JavaScript errors

## URL Path Configuration

If your site is hosted at a subdirectory (e.g., `example.com/f1stories/` instead of directly at the root), you may need to update paths in:

1. The `blog-loader.js` file - Look for fetch URLs and update them to include your subdirectory path
2. All absolute path references (those starting with `/`) in your HTML and CSS files