import { DOMParser } from "@b-fuze/deno-dom"

/**
 * Renders HTML template by replacing elements based on a parts object
 * @param {string} template - HTML template string
 * @param {Object} parts - Object with selectors as keys and content as values
 * @returns {string} - Rendered HTML string
 */
const renderTemplate = (template, parts) => {
  if (!template) {
    throw new Error(`No template provided`)
  }
  
  if (!parts) {
    throw new Error(`No parts provided`)
  }

  let dom = new DOMParser().parseFromString(template, "text/html")
  if (!dom) {
    throw new Error(`Failed to parse template HTML`)
  }

  // Process each selector and content pair
  Object.entries(parts).forEach(([key, content]) => {
    // Handle different content types
    if (key.startsWith('#')) {
      // ID selector
      const element = dom.getElementById(key.substring(1))
      if (element) updateElement(element, content)
    } else if (key.startsWith('.')) {
      // Class selector
      const elements = dom.getElementsByClassName(key.substring(1))
      for (const element of elements) {
        updateElement(element, content)
      }
    } else {
      // Try as a generic selector
      const elements = dom.querySelectorAll(key)
      for (const element of elements) {
        updateElement(element, content)
      }
    }
  })

  return dom.documentElement.outerHTML
}

/**
 * Updates an element with the provided content
 * @param {Element} element - DOM element to update
 * @param {string|Element|Array|Object} content - Content to insert
 */
function updateElement(element, content) {
  if (!element) return;
  
  if (typeof content === "string") {
    element.innerHTML = content
  } else if (content instanceof Array) {
    // Handle arrays (like for lists)
    element.innerHTML = "" // Clear existing content
    content.forEach(item => {
      if (typeof item === "string") {
        const div = dom.createElement("div")
        div.innerHTML = item
        element.appendChild(div)
      } else if (item instanceof Element) {
        element.appendChild(item)
      }
    })
  } else if (typeof content === "object" && content !== null) {
    // Handle attribute updates
    Object.entries(content).forEach(([attr, value]) => {
      if (attr === "text" || attr === "textContent") {
        element.textContent = value
      } else if (attr === "html" || attr === "innerHTML") {
        element.innerHTML = value
      } else {
        element.setAttribute(attr, value)
      }
    })
  }
}

export { renderTemplate }