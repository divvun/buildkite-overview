// Helper module for detecting "server only" markers in files
// This provides shared utilities for the lint plugin

import { dirname, join, resolve } from "https://deno.land/std@0.224.0/path/mod.ts"

// Cache for files marked as server-only
const serverOnlyFileCache = new Map<string, boolean>()

/**
 * Checks if a file contains a "server only" string literal at module scope
 * @param sourceCode The source code to scan
 * @returns true if "server only" marker is found
 */
export function scanForServerOnlyMarker(sourceCode: string): boolean {
  // Look for string literals containing "server only" (case-insensitive)
  // This regex matches both single and double quoted strings
  const serverOnlyRegex = /^[\s]*(?:["']server only["']|`server only`)\s*;?\s*$/gmi

  return serverOnlyRegex.test(sourceCode)
}

/**
 * Resolves an import path to an actual file path
 * @param importPath The import path from the import statement
 * @param currentFilePath The path of the file containing the import
 * @returns Resolved absolute file path
 */
export function resolveImportPath(importPath: string, currentFilePath: string): string {
  const currentDir = dirname(currentFilePath)

  if (importPath.startsWith("~/")) {
    // Handle tilde imports - assume project root is found by going up until we find deno.jsonc
    const projectRoot = findProjectRoot(currentFilePath)
    return join(projectRoot, importPath.slice(2))
  }

  if (importPath.startsWith("./") || importPath.startsWith("../")) {
    // Handle relative imports
    return resolve(currentDir, importPath)
  }

  if (importPath.startsWith("/")) {
    // Handle absolute imports
    return importPath
  }

  // For other imports (node modules, etc.), return as-is
  return importPath
}

/**
 * Finds the project root by looking for deno.jsonc
 * @param filePath Starting file path
 * @returns Project root directory
 */
function findProjectRoot(filePath: string): string {
  let currentDir = dirname(filePath)

  while (currentDir !== "/" && currentDir !== ".") {
    try {
      const denoJsonPath = join(currentDir, "deno.jsonc")
      if (Deno.statSync(denoJsonPath).isFile) {
        return currentDir
      }
    } catch {
      // File doesn't exist, continue up
    }

    const parentDir = dirname(currentDir)
    if (parentDir === currentDir) break
    currentDir = parentDir
  }

  // Fallback to current working directory
  return Deno.cwd()
}

/**
 * Checks if a file is marked as server-only (with caching)
 * @param filePath Absolute path to the file
 * @returns true if file contains "server only" marker
 */
export function isServerOnlyFile(filePath: string): boolean {
  // Check cache first
  if (serverOnlyFileCache.has(filePath)) {
    return serverOnlyFileCache.get(filePath)!
  }

  try {
    // Add common TypeScript/JavaScript extensions if not present
    let actualPath = filePath
    if (
      !filePath.endsWith(".ts") && !filePath.endsWith(".tsx") &&
      !filePath.endsWith(".js") && !filePath.endsWith(".jsx")
    ) {
      // Try different extensions
      const extensions = [".ts", ".tsx", ".js", ".jsx"]
      for (const ext of extensions) {
        try {
          const pathWithExt = filePath + ext
          Deno.statSync(pathWithExt)
          actualPath = pathWithExt
          break
        } catch {
          // Extension doesn't exist, try next
        }
      }
    }

    const sourceCode = Deno.readTextFileSync(actualPath)
    const isServerOnly = scanForServerOnlyMarker(sourceCode)

    // Cache the result
    serverOnlyFileCache.set(filePath, isServerOnly)

    return isServerOnly
  } catch (error) {
    // File doesn't exist or can't be read
    serverOnlyFileCache.set(filePath, false)
    return false
  }
}

/**
 * Clears the server-only file cache (useful for testing)
 */
export function clearServerOnlyCache(): void {
  serverOnlyFileCache.clear()
}

/**
 * Gets all cached server-only files (for debugging)
 */
export function getServerOnlyFiles(): string[] {
  return Array.from(serverOnlyFileCache.entries())
    .filter(([, isServerOnly]) => isServerOnly)
    .map(([path]) => path)
}
