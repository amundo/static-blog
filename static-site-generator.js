import { join } from "@std/path";
import { ensureDir } from "@std/fs";
import { extract } from "@std/front-matter";
import { parse } from '@marked';

// Parse date from frontmatter
function parseFrontmatterDate(dateValue) {
  // If it's already a Temporal.PlainDate, return it
  if (dateValue instanceof Temporal.PlainDate) {
    return dateValue;
  }
  
  // If it's a Date object, convert to PlainDate
  if (dateValue instanceof Date) {
    return Temporal.PlainDate.from({
      year: dateValue.getFullYear(),
      month: dateValue.getMonth() + 1,
      day: dateValue.getDate(),
    });
  }
  
  // If it's a string, parse it
  if (typeof dateValue === 'string') {
    const [year, month, day] = dateValue.split('-').map(Number);
    return new Temporal.PlainDate(year, month, day);
  }
  
  throw new Error(`Unexpected date format: ${dateValue}`);
}

// Format date for display
function formatDate(date) {
  return date.toLocaleString({
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Generate HTML page from template and content
function generatePage(content, metadata) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${metadata.title}</title>
    <style>
      body {
        max-width: 800px;
        margin: 0 auto;
        padding: 1rem;
        font-family: system-ui, sans-serif;
        line-height: 1.5;
      }
      pre {
        padding: 1rem;
        background: #f6f8fa;
        border-radius: 4px;
        overflow-x: auto;
      }
      a {
        color: #0066cc;
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }
    </style>
</head>
<body>
    <article>
        <h1>${metadata.title}</h1>
        <time>${formatDate(parseFrontmatterDate(metadata.date))}</time>
        ${content}
    </article>
</body>
</html>
  `;
}

function generateIndexPage(posts) {
  // Create a new array for sorting
  const sortedPosts = [...posts].sort((a, b) => {
    // First sort by date
    const dateCompare = Temporal.PlainDate.compare(b.date, a.date);
    if (dateCompare !== 0) return dateCompare;
    
    // If dates are equal, sort by slug number
    const getNumber = (slug) => parseInt(slug, 10) || 0;
    return getNumber(b.slug) - getNumber(a.slug);
  });

  const postsList = sortedPosts.map(post => `
      <article class="post-preview">
        <h2><a href="${post.slug}.html">${post.title}</a></h2>
        <time>${formatDate(post.date)}</time>
        ${post.description ? `<p>${post.description}</p>` : ''}
      </article>
    `).join('\n');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Blog Index</title>
    <style>
      body {
        max-width: 800px;
        margin: 0 auto;
        padding: 1rem;
        font-family: system-ui, sans-serif;
        line-height: 1.5;
      }
      .post-preview {
        margin-bottom: 2rem;
        padding-bottom: 2rem;
        border-bottom: 1px solid #eee;
      }
      .post-preview:last-child {
        border-bottom: none;
      }
      h2 {
        margin: 0;
      }
      time {
        color: #666;
        font-size: 0.9rem;
      }
      a {
        color: #0066cc;
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }
    </style>
</head>
<body>
    <h1>Blog Posts</h1>
    <main>
      ${postsList}
    </main>
</body>
</html>
  `;
}

// Keep track of post metadata
const postMetadata = new Map();

// Process a single markdown file
async function processFile(srcPath, destDir) {
  const fileName = srcPath.split('/').pop();
  const baseName = fileName?.split('.')[0];
  const destPath = join(destDir, `${baseName}.html`);

  try {
    const content = await Deno.readTextFile(srcPath);
    const { attrs: metadata, body } = extract(content);
    const html = parse(body);
    const pageHtml = generatePage(html, metadata);
    
    await Deno.writeTextFile(destPath, pageHtml);
    console.log(`Generated ${baseName}.html`);
  } catch (error) {
    console.error(`Error processing ${baseName}:`, error);
  }
}

// Main build function
async function build(postsDir = './posts', outputDir = './blog') {
  try {
    await ensureDir(outputDir);
    
    // Clear existing metadata
    postMetadata.clear();
    
    for await (const entry of Deno.readDir(postsDir)) {
      if (entry.isFile && entry.name.endsWith('.md')) {
        const content = await Deno.readTextFile(join(postsDir, entry.name));
        const { attrs: metadata } = extract(content);
        const slug = entry.name.split('.')[0];
        
        postMetadata.set(slug, {
          title: metadata.title,
          date: parseFrontmatterDate(metadata.date),
          description: metadata.description,
          slug
        });
        
        await processFile(join(postsDir, entry.name), outputDir);
      }
    }
    
    // Generate and write index page
    const indexHtml = generateIndexPage([...postMetadata.values()]);
    await Deno.writeTextFile(join(outputDir, 'index.html'), indexHtml);
    console.log('Generated index.html');
    
  } catch (error) {
    console.error('Build failed:', error);
  }
}

// Watch for changes
async function watch(postsDir = './posts', outputDir = './blog') {
  console.log('Watching for changes...');
  
  // Initial build and metadata collection
  await build(postsDir, outputDir);
  
  const watcher = Deno.watchFs(postsDir);
  
  for await (const event of watcher) {
    if (event.kind === 'modify' || event.kind === 'create') {
      for (const path of event.paths) {
        if (path.endsWith('.md')) {
          try {
            // Process the changed file
            await processFile(path, outputDir);
            
            // Update metadata for this post
            const content = await Deno.readTextFile(path);
            const { attrs: metadata } = extract(content);
            const fileName = path.split('/').pop();
            const slug = fileName?.split('.')[0];
            
            postMetadata.set(slug, {
              title: metadata.title,
              date: parseFrontmatterDate(metadata.date),
              description: metadata.description,
              slug
            });
            
            // Regenerate index with updated metadata
            const indexHtml = generateIndexPage([...postMetadata.values()]);
            await Deno.writeTextFile(join(outputDir, 'index.html'), indexHtml);
            console.log('Updated index.html');
          } catch (error) {
            console.error(`Error processing ${path}:`, error);
          }
        }
      }
    }
  }
}

// CLI
if (import.meta.main) {
  const args = Deno.args;
  if (args.includes('--watch')) {
    await watch();
  } else {
    await build();
  }
}