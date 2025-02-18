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
const build = async ({ 
  postsDirectory = 'posts', 
  outputDirectory = 'blog',
  templateDirectory = 'templates'
} = {}) => {
  // Resolve paths
  postsDirectory = join(Deno.cwd(), postsDirectory)
  outputDirectory = join(Deno.cwd(), outputDirectory)
  templateDirectory = join(Deno.cwd(), templateDirectory)
  
  // Ensure directories exist
  await ensureDir(postsDirectory)
  await ensureDir(outputDirectory)
  await ensureDir(templateDirectory)
  
  // Read templates
  const postTemplatePath = join(templateDirectory, "post-template.html")
  const indexTemplatePath = join(templateDirectory, "index-template.html")
  const postTemplate = await Deno.readTextFile(postTemplatePath)
  const indexTemplate = await Deno.readTextFile(indexTemplatePath)
  
  // Find all markdown files
  const globPattern = `${postsDirectory}/*.md`
  const postFileEntries = await Array.fromAsync(expandGlob(globPattern))
  
  // Process all posts
  const posts = []
  
  for (const postFileEntry of postFileEntries) {
    // Read and parse markdown
    const postMarkdown = await Deno.readTextFile(postFileEntry.path)
    const { attrs: metadata, body: markdown } = extract(postMarkdown)
    
    // Generate HTML from markdown
    const html = parse(markdown)
    
    // Prepare filename info
    const fileName = basename(postFileEntry.path, ".md")
    const outputPath = join(outputDirectory, `${fileName}.html`)
    
    // Normalize date if present
    if (metadata.date && typeof metadata.date === 'string') {
      try {
        // Ensure consistent date format
        const date = new Date(metadata.date)
        metadata.isoDate = date.toISOString()
        metadata.formattedDate = date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      } catch (e) {
        console.warn(`Invalid date format in ${fileName}: ${metadata.date}`)
      }
    }
    
    // Add file paths to metadata
    Object.assign(metadata, {
      markdownPath: postFileEntry.path,
      outputPath,
      url: `/${outputPath}`,
    })
    
    // Store post information
    posts.push({
      metadata,
      markdown,
      html,
    })
  }
  
  // Sort posts by date (newest first)
  posts.sort((a, b) => {
    // Use isoDate if available, otherwise fallback to comparison
    const dateA = a.metadata.isoDate ? new Date(a.metadata.isoDate) : new Date(0)
    const dateB = b.metadata.isoDate ? new Date(b.metadata.isoDate) : new Date(0)
    return dateB - dateA
  })
  
  // Add navigation links
  posts.forEach((post, index) => {
    post.metadata.isFirst = index === 0
    post.metadata.isLast = index === posts.length - 1
    post.metadata.previousPost = index > 0 ? posts[index - 1].metadata : null
    post.metadata.nextPost = index < posts.length - 1 ? posts[index + 1].metadata : null
  })

  // Generate post files
  for (const post of posts) {
    const { metadata, html } = post
    
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
    })
    
    // Write post file
    const postOutputPath = join(outputDirectory, metadata.outputPath)
    await ensureDir(dirname(postOutputPath))
    await Deno.writeTextFile(postOutputPath, renderedPost)
  }
  
  // Extract metadata for index
  const postMetadata = posts.map(post => post.metadata)
  
  // Build index page
  const indexHtml = renderTemplate(indexTemplate, {
    '.post-list': buildPostList(postMetadata),
    'title': 'Blog Index',
    '.blog-title': 'My Blog',
    '.blog-description': 'A collection of my thoughts and ideas',
  })
  
  // Write index file
  const indexOutputPath = join(outputDirectory, "index.html")
  await Deno.writeTextFile(indexOutputPath, indexHtml)
  console.log(`Generated: ${indexOutputPath}`)
  
  console.log(`Build complete: ${posts.length} posts generated`)
  return { posts: postMetadata }
}

/**
 * Generate HTML for the post list
 * 
 * @param {Array} posts List of post metadata objects
 * @returns {String} HTML for the post list
 */
function buildPostList(posts) {
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
  }).join('\n')
}

// Run build if executed directly
if (import.meta.main) {
  await build()
}

export { build }