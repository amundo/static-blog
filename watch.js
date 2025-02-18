/**
 * Watch for changes in markdown files and incrementally rebuild
 * only the affected HTML files when markdown files are created or modified
 * 
 * @param {Object} options Watch options
 * @param {String} options.postsDirectory Directory containing markdown files
 * @param {String} options.outputDirectory Directory to write generated files
 * @param {String} options.templateDirectory Directory containing HTML templates
 * @param {Number} options.debounceMs Debounce time in milliseconds
 * @returns {Promise<void>} Resolves when watch is stopped
 */
async function watch({
  postsDirectory = 'posts',
  outputDirectory = 'blog',
  templateDirectory = 'templates',
  debounceMs = 200
} = {}) {
  // Keep track of file modification times
  const fileModTimes = new Map();
  
  // Create a debounce mechanism
  let pendingChanges = new Set();
  let templateChanged = false;
  let debounceTimer = null;
  
  console.log(`Starting watch mode...`);
  console.log(`- Watching markdown files in: ${postsDirectory}`);
  console.log(`- Watching templates in: ${templateDirectory}`);
  console.log(`- Output directory: ${outputDirectory}`);
  
  // Perform initial build
  await initialBuild();
  
  // Set up watchers
  const watcher = Deno.watchFs([postsDirectory, templateDirectory]);
  
  // Process file system events
  for await (const event of watcher) {
    // Skip events we don't care about
    if (event.kind !== "create" && event.kind !== "modify") {
      continue;
    }
    
    // Determine which files changed
    const changedMarkdownFiles = event.paths.filter(path => 
      path.endsWith(".md") && path.startsWith(postsDirectory)
    );
    
    const changedTemplates = event.paths.filter(path => 
      path.endsWith(".html") && path.startsWith(templateDirectory)
    );
    
    // Add changed markdown files to pending changes
    for (const path of changedMarkdownFiles) {
      pendingChanges.add(path);
    }
    
    // Set flag if any templates changed
    if (changedTemplates.length > 0) {
      templateChanged = true;
    }
    
    // If we have changes, schedule a rebuild
    if (pendingChanges.size > 0 || templateChanged) {
      // Debounce rebuilds
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      
      debounceTimer = setTimeout(processPendingChanges, debounceMs);
    }
  }
  
  /**
   * Perform initial build and record file modification times
   */
  async function initialBuild() {
    console.log("Performing initial build...");
    
    // Discover all markdown files and record their modification times
    const markdownFiles = await discoverMarkdownFiles(postsDirectory);
    for (const entry of markdownFiles) {
      try {
        const stats = await Deno.stat(entry.path);
        fileModTimes.set(entry.path, stats.mtime?.getTime() || 0);
      } catch (err) {
        console.warn(`Couldn't stat file ${entry.path}:`, err);
      }
    }
    
    // Do initial full build
    await buildStaticSite({
      postsDirectory,
      outputDirectory,
      templateDirectory
    });
    
    console.log("Initial build complete. Watching for changes...");
  }
  
  /**
   * Process any pending changes
   */
  async function processPendingChanges() {
    // Handle template changes first - requires full rebuild
    if (templateChanged) {
      console.log("Templates changed - performing full rebuild...");
      await buildStaticSite({
        postsDirectory,
        outputDirectory,
        templateDirectory
      });
      
      // Update modification times for all files
      const markdownFiles = await discoverMarkdownFiles(postsDirectory);
      for (const entry of markdownFiles) {
        try {
          const stats = await Deno.stat(entry.path);
          fileModTimes.set(entry.path, stats.mtime?.getTime() || 0);
        } catch (err) {
          // File might have been deleted
          if (err instanceof Deno.errors.NotFound) {
            fileModTimes.delete(entry.path);
          }
        }
      }
      
      templateChanged = false;
      pendingChanges.clear();
      console.log("Full rebuild complete");
      return;
    }
    
    // Process markdown file changes
    if (pendingChanges.size === 0) return;
    
    console.log(`Processing ${pendingChanges.size} changed markdown file(s)...`);
    
    // Load templates
    const templates = await loadTemplates(templateDirectory);
    
    // Filter to files that have actually changed by comparing modification times
    const filesToProcess = [];
    
    for (const filePath of pendingChanges) {
      try {
        const stats = await Deno.stat(filePath);
        const newModTime = stats.mtime?.getTime() || 0;
        const oldModTime = fileModTimes.get(filePath) || 0;
        
        if (newModTime > oldModTime) {
          fileModTimes.set(filePath, newModTime);
          filesToProcess.push(filePath);
        }
      } catch (err) {
        // File might have been deleted
        if (err instanceof Deno.errors.NotFound) {
          fileModTimes.delete(filePath);
          // We should rebuild index to remove deleted posts
          console.log(`File deleted: ${filePath}`);
        } else {
          console.error(`Error checking file ${filePath}:`, err);
        }
      }
    }
    
    // Clear pending changes
    pendingChanges.clear();
    
    if (filesToProcess.length === 0) {
      console.log("No files actually changed (same modification time)");
      return;
    }
    
    console.log(`Rebuilding ${filesToProcess.length} changed file(s)...`);
    
    try {
      // Process changed markdown files
      const fileEntries = filesToProcess.map(path => ({ path }));
      const changedPosts = await processMarkdownFiles(fileEntries, outputDirectory);
      
      // We need all posts for navigation links and index
      const allMarkdownFiles = await discoverMarkdownFiles(postsDirectory);
      const unchangedFilePaths = allMarkdownFiles
        .filter(entry => !filesToProcess.includes(entry.path))
        .map(entry => entry.path);
      
      // Process unchanged files
      const unchangedFileEntries = unchangedFilePaths.map(path => ({ path }));
      const unchangedPosts = await processMarkdownFiles(unchangedFileEntries, outputDirectory);
      
      // Combine and organize all posts
      const allPosts = sortAndLinkPosts([...changedPosts, ...unchangedPosts]);
      
      // Only generate changed post files
      const postsToGenerate = allPosts.filter(post => 
        filesToProcess.includes(post.metadata.markdownPath)
      );
      
      // Generate the HTML for changed posts
      await generatePostPages(postsToGenerate, templates.post, outputDirectory);
      
      // Always regenerate index since order or metadata might have changed
      await generateIndexPage(allPosts, templates.index, outputDirectory);
      
      console.log(`Successfully rebuilt ${postsToGenerate.length} file(s) and index`);
    } catch (error) {
      console.error("Error during incremental build:", error);
    }
  }
}

// Import helper functions from the main module
import { 
  loadTemplates, 
  discoverMarkdownFiles, 
  processMarkdownFiles,
  sortAndLinkPosts,
  generatePostPages,
  generateIndexPage,
  buildStaticSite
} from "./generate.js";

if(import.meta.main){
  watch({})
}

export { watch };