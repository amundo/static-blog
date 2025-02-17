import { join } from "@std/path";
import { ensureDir } from "@std/fs";
import { extract } from "@std/front-matter/any";
import { parse } from '@marked'


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
    </style>
</head>
<body>
    <article>
        <h1>${metadata.title}</h1>
        <time>${new Date(metadata.date).toLocaleDateString()}</time>
        ${content}
    </article>
</body>
</html>
  `;
}

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
    
    const files = [];
    for await (const entry of Deno.readDir(postsDir)) {
      if (entry.isFile && entry.name.endsWith('.md')) {
        files.push(entry.name);
      }
    }
    
    await Promise.all(
      files.map(file => 
        processFile(join(postsDir, file), outputDir)
      )
    );
  } catch (error) {
    console.error('Build failed:', error);
  }
}

// CLI
if (import.meta.main) {
  await build();
}