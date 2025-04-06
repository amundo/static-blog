---
title: Static blog generator
author: Patrick Hall
---

# How to Install and Use the Static Blog Generator

This guide will walk you through setting up and using the static blog generator based on Deno, a secure JavaScript runtime. This simple yet powerful tool allows you to create and maintain a static blog using Markdown files.

## Prerequisites

- [Deno](https://deno.com/) installed on your system
- Basic familiarity with JavaScript and Markdown

## Step 1: Create a New Project Directory

```bash
mkdir my-static-blog
cd my-static-blog
```

## Step 2: Set Up the Project Structure

Create the required directories:

```bash
mkdir -p posts blog templates
```

This creates:
- `posts/`: Where your Markdown files will go
- `blog/`: Where generated HTML files will be stored
- `templates/`: Where HTML templates are kept

## Step 3: Create the Template Files

Create two template files in the `templates/` directory:

**templates/post-template.html**:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>title</title>
  <style>
    body { 
      max-width: 800px; 
      margin: 0 auto; 
      padding: 20px;
      font-family: system-ui, sans-serif;
      line-height: 1.6;
    }
    .post-date { color: #666; }
    .navigation { 
      display: flex; 
      justify-content: space-between;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
    }
  </style>
</head>
<body>
  <header>
    <h1 class="post-title">Post Title</h1>
    <p class="post-date">Post Date</p>
    <p class="post-author">Author</p>
    <p class="post-description">Description</p>
    <p class="post-tags">Tags</p>
  </header>
  <main>Article content goes here</main>
  <footer>
    <div class="navigation">
      <div class="previous-post"></div>
      <div class="next-post"></div>
    </div>
  </footer>
</body>
</html>
```

**templates/index-template.html**:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>title</title>
  <style>
    body { 
      max-width: 800px; 
      margin: 0 auto; 
      padding: 20px;
      font-family: system-ui, sans-serif;
      line-height: 1.6;
    }
    .post-item {
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 1px solid #eee;
    }
    .tag {
      display: inline-block;
      background: #f0f0f0;
      padding: 2px 8px;
      border-radius: 4px;
      margin-right: 6px;
      font-size: 0.8em;
    }
  </style>
</head>
<body>
  <header>
    <h1 class="blog-title">Blog Title</h1>
    <p class="blog-description">Blog Description</p>
  </header>
  <main class="post-list">
    <!-- Post list will be inserted here -->
  </main>
</body>
</html>
```

## Step 4: Create the Configuration Files

Create the following files in your project root:

**deno.json**:

```json
{
  "tasks": {
    "blog": "deno run --allow-read --allow-write --unstable-temporal generate.js",
    "watch": "deno run --allow-read --allow-write --unstable-temporal watch.js",
    "clean": "rm blog/*.html"
  },
  "imports": {
    "@b-fuze/deno-dom": "jsr:@b-fuze/deno-dom@^0.1.49",
    "@std/cli": "jsr:@std/cli@^1.0.13",
    "@std/front-matter": "jsr:@std/front-matter@^1.0.7",
    "@std/fs": "jsr:@std/fs@^1.0.13",
    "@std/path": "jsr:@std/path@^1.0.8",
    "@marked": "npm:marked"
  }
}
```

## Step 5: Add the JavaScript Files

Create these three JavaScript files in your project root:

**render-template.js**:

Copy the content from the `static-blog/render-template.js` file you provided.

**generate.js**:

Copy the content from the `static-blog/generate.js` file you provided.

**watch.js**:

Copy the content from the `static-blog/watch.js` file you provided.

## Step 6: Create Your First Blog Post

Create a Markdown file in the `posts/` directory. For example, `posts/hello-world.md`:

```markdown
---
title: Hello, World!
date: 2025-02-27
author: Your Name
description: My first blog post using the static site generator
tags: [first, hello, blog]
---

# Hello, World!

This is my first blog post using the static site generator.

## Features

- Simple Markdown formatting
- Front matter for metadata
- Automatic index page generation
```

Note the YAML front matter at the top (between the `---` markers), which defines metadata for your post.

## Step 7: Generate Your Blog

Run the generator to create HTML files from your Markdown posts:

```bash
deno task blog
```

This will create HTML files in the `blog/` directory, including an `index.html` file and individual post pages.

## Step 8: View Your Blog

You can open the HTML files directly in your browser, or serve them using a local web server:

```bash
deno run --allow-net --allow-read https://deno.land/std/http/file_server.ts blog/
```

This starts a simple web server serving your blog files. Open `http://localhost:4507` in your browser to view your blog.

## Step 9: Continuous Development

For a smoother development experience, use the watch mode which automatically rebuilds your blog when files change:

```bash
deno task watch
```

This will monitor your `posts/` and `templates/` directories for changes and rebuild only what's necessary.

## Additional Features

### Post Navigation

Posts are automatically linked with "previous" and "next" navigation based on their dates.

### Customizing Templates

You can modify the HTML templates in the `templates/` directory to change the appearance and structure of your blog.

### Adding More Posts

Simply add more Markdown files to the `posts/` directory. The generator will automatically include them in your blog.

## Troubleshooting

- If you encounter permissions errors, make sure you're including the necessary `--allow-read` and `--allow-write` flags.
- Check that your Markdown front matter is formatted correctly with proper YAML syntax.
- Ensure your template files include all the necessary elements used by the renderer.

Now you have a simple, fast, and efficient static blog generator running with Deno!