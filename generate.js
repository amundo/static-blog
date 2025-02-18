import { basename, join, dirname } from "@std/path"
import { ensureDir, expandGlob } from "@std/fs"
import { extract } from "@std/front-matter/any"
import { parse } from "@marked"
import { renderTemplate } from "./render-template.js"

/**
 * Build a static site from markdown files
 * 
 * @param {Object} options Build options
 * @param {String} options.postsDirectory Directory containing markdown files
 * @param {String} options.outputDirectory Directory to write generated files
 * @param {String} options.templateDirectory Directory containing HTML templates
 * @returns {Object} Build results
 */
const buildStaticSite = async ({ 
  postsDirectory = 'posts', 
  outputDirectory = 'blog',
  templateDirectory = 'templates'
} = {}) => {
  // Prepare environment and load templates
  await setupDirectories({ postsDirectory, outputDirectory, templateDirectory });
  const templates = await loadTemplates(templateDirectory);
  
  // Process content
  const markdownFiles = await discoverMarkdownFiles(postsDirectory);
  const posts = await processMarkdownFiles(markdownFiles, outputDirectory);
  
  // Organize content
  const organizedPosts = sortAndLinkPosts(posts);
  
  // Generate output
  await generatePostPages(organizedPosts, templates.post, outputDirectory);
  await generateIndexPage(organizedPosts, templates.index, outputDirectory);
  
  console.log(`Build complete: ${organizedPosts.length} posts generated`);
  return { posts: organizedPosts.map(post => post.metadata) };
}

/**
 * Set up required directories
 * 
 * @param {Object} options Directory paths
 * @param {String} options.postsDirectory Directory containing markdown files
 * @param {String} options.outputDirectory Directory to write generated files
 * @param {String} options.templateDirectory Directory containing HTML templates
 * @returns {Promise} Promise that resolves when directories are created
 */
async function setupDirectories({ postsDirectory, outputDirectory, templateDirectory }) {
  await ensureDir(postsDirectory);
  await ensureDir(outputDirectory);
  await ensureDir(templateDirectory);
}

/**
 * Load HTML templates
 */
async function loadTemplates(templateDirectory) {
  // Use URL-based approach for bundled templates
  const postTemplatePath = new URL(`${templateDirectory}/post-template.html`, import.meta.url);
  const indexTemplatePath = new URL(`${templateDirectory}/index-template.html`, import.meta.url);
  
  return {
    post: await Deno.readTextFile(postTemplatePath),
    index: await Deno.readTextFile(indexTemplatePath)
  };
}

/**
 * Find all markdown files in the posts directory
 */
async function discoverMarkdownFiles(postsDirectory) {
  const globPattern = `${postsDirectory}/*.md`;
  return await Array.fromAsync(expandGlob(globPattern));
}

/**
 * Process markdown files into structured post objects
 */
async function processMarkdownFiles(markdownFiles, outputDirectory) {
  const posts = [];
  
  for (const fileEntry of markdownFiles) {
    // Read and parse markdown
    const markdown = await Deno.readTextFile(fileEntry.path);
    const { attrs: metadata, body: markdownContent } = extract(markdown);
    
    // Generate HTML from markdown
    const html = parse(markdownContent);
    
    // Prepare filename info
    const fileName = basename(fileEntry.path, ".md");
    const outputFileName = `${fileName}.html`;
    const outputPath = join(outputDirectory, outputFileName);
    
    // Process and normalize metadata
    const processedMetadata = processPostMetadata(metadata, fileEntry.path, outputPath, outputFileName);
    
    // Store post information
    posts.push({
      metadata: processedMetadata,
      markdown: markdownContent,
      html,
    });
  }
  
  return posts;
}

/**
 * Process and normalize post metadata
 * 
 * @param {Object} metadata Front matter metadata
 * @param {String} markdownPath Path to the markdown file
 * @param {String} outputPath Path to the output HTML file
 * @param {String} outputFileName Output filename
 * @returns {Object} Processed metadata
 */
function processPostMetadata(metadata, markdownPath, outputPath, outputFileName) {
  const processedMetadata = { ...metadata };
  
  // Normalize date if present
  if (processedMetadata.date && typeof processedMetadata.date === 'string') {
    try {
      // Ensure consistent date format
      const date = new Date(processedMetadata.date);
      processedMetadata.isoDate = date.toISOString();
      processedMetadata.formattedDate = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      console.warn(`Invalid date format in ${markdownPath}: ${processedMetadata.date}`);
    }
  }
  
  // Add file paths to metadata
  Object.assign(processedMetadata, {
    markdownPath,
    outputPath,
    // Create URL relative to the project structure
    url: outputFileName,
  });
  
  return processedMetadata;
}

/**
 * Sort posts by date and add navigation links
 * 
 * @param {Array} posts List of post objects
 * @returns {Array} Sorted and linked posts
 */
function sortAndLinkPosts(posts) {
  // Sort posts by date (newest first)
  posts.sort((a, b) => {
    // Use isoDate if available, otherwise fallback to comparison
    const dateA = a.metadata.isoDate ? new Date(a.metadata.isoDate) : new Date(0);
    const dateB = b.metadata.isoDate ? new Date(b.metadata.isoDate) : new Date(0);
    return dateB - dateA;
  });
  
  // Add navigation links
  posts.forEach((post, index) => {
    post.metadata.isFirst = index === 0;
    post.metadata.isLast = index === posts.length - 1;
    post.metadata.previousPost = index > 0 ? posts[index - 1].metadata : null;
    post.metadata.nextPost = index < posts.length - 1 ? posts[index + 1].metadata : null;
  });
  
  return posts;
}

/**
 * Generate individual post HTML pages
 * 
 * @param {Array} posts List of post objects
 * @param {String} postTemplate Post HTML template
 * @param {String} outputDirectory Directory to write generated files
 * @returns {Promise} Promise that resolves when all posts are generated
 */
async function generatePostPages(posts, postTemplate, outputDirectory) {
  for (const post of posts) {
    const { metadata, html } = post;
    
    // Render the post using template
    const renderedPost = `<!doctype html>\n` + renderTemplate(postTemplate, {
      'title': metadata.title || 'Untitled Post',
      '.post-date': metadata.formattedDate || '',
      'main': html,
      '.post-title': metadata.title || 'Untitled Post',
      '.post-description': metadata.description || '',
      '.post-author': metadata.author || '',
      '.post-tags': metadata.tags ? metadata.tags.join(', ') : '',
      
      // Navigation
      '.previous-post': metadata.previousPost ? 
        `<a href="${metadata.previousPost.url}">&larr; ${metadata.previousPost.title}</a>` : '',
      '.next-post': metadata.nextPost ? 
        `<a href="${metadata.nextPost.url}">${metadata.nextPost.title} &rarr;</a>` : '',
    });
    
    // Write post file
    await ensureDir(dirname(metadata.outputPath));
    await Deno.writeTextFile(metadata.outputPath, renderedPost);
  }
}

/**
 * Generate the index page listing all posts
 * 
 * @param {Array} posts List of post objects
 * @param {String} indexTemplate Index HTML template
 * @param {String} outputDirectory Directory to write generated files
 * @returns {Promise} Promise that resolves when the index page is generated
 */
async function generateIndexPage(posts, indexTemplate, outputDirectory) {
  const postMetadata = posts.map(post => post.metadata);
  
  // Build index page
  const indexHtml = renderTemplate(indexTemplate, {
    '.post-list': createPostListHtml(postMetadata),
    'title': 'Blog Index',
    '.blog-title': 'My Blog',
    '.blog-description': 'A collection of my thoughts and ideas',
  });
  
  // Write index file
  const indexOutputPath = join(outputDirectory, "index.html");
  await Deno.writeTextFile(indexOutputPath, indexHtml);
  console.log(`Generated: ${indexOutputPath}`);
}

/**
 * Generate HTML for the post list
 * 
 * @param {Array} posts List of post metadata objects
 * @returns {String} HTML for the post list
 */
function createPostListHtml(posts) {
  return posts.map(post => {
    return `
      <article class="post-item">
        <header>
          <h2><a href="${post.url}">${post.title || 'Untitled Post'}</a></h2>
          ${post.formattedDate ? `<time datetime="${post.isoDate}">${post.formattedDate}</time>` : ''}
        </header>
        ${post.description ? `<p>${post.description}</p>` : ''}
        ${post.tags ? `<div class="tags">${post.tags.map(tag => 
          `<span class="tag">${tag}</span>`).join('')}</div>` : ''}
      </article>
    `
  }).join('\n');
}

// Run build if executed directly
if (import.meta.main) {
  await buildStaticSite();
}

export { 
  buildStaticSite,
  createPostListHtml,
  processPostMetadata,
  sortAndLinkPosts,
  generateIndexPage,
  generatePostPages,
  processMarkdownFiles,
  discoverMarkdownFiles,
  loadTemplates,
  setupDirectories
}