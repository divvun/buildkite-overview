// Custom lint plugin to prevent server imports in islands
// Islands are client-side components and should not import server-side code

import { isServerOnlyFile, resolveImportPath } from "./server-only-detector.ts"

const plugin = {
  name: "island-protection",
  rules: {
    "no-server-imports-in-islands": {
      create(context: any) {
        // Only apply rule to files in islands/ directory
        const filename = context.getFilename()
        if (!filename.includes("/islands/")) {
          return {}
        }

        return {
          ImportDeclaration(node: any) {
            const importPath = node.source.value

            // Check if import is from ~/server/
            if (
              typeof importPath === "string" &&
              (importPath.startsWith("~/server/") ||
                importPath.startsWith("../server/") ||
                importPath.includes("/server/"))
            ) {
              context.report({
                node: node.source,
                message:
                  "Islands cannot import from server directory. Server-side code should not be included in client-side bundles.",
                hint: "Move shared types to ~/types/ or use API endpoints to communicate with server code.",
              })
            }
          },

          // Also check dynamic imports
          'CallExpression[callee.name="import"]'(node: any) {
            if (node.arguments.length > 0) {
              const arg = node.arguments[0]
              if (arg.type === "Literal" && typeof arg.value === "string") {
                const importPath = arg.value

                if (
                  importPath.startsWith("~/server/") ||
                  importPath.startsWith("../server/") ||
                  importPath.includes("/server/")
                ) {
                  context.report({
                    node: arg,
                    message: "Islands cannot dynamically import from server directory.",
                    hint: "Use API endpoints to fetch server data.",
                  })
                }
              }
            }
          },
        }
      },
    },

    "no-server-only-imports-in-islands": {
      create(context: any) {
        // Only apply rule to files in islands/ directory
        const filename = context.getFilename()
        if (!filename.includes("/islands/")) {
          return {}
        }

        return {
          ImportDeclaration(node: any) {
            const importPath = node.source.value

            if (typeof importPath === "string") {
              try {
                // Resolve the import path to an actual file path
                const resolvedPath = resolveImportPath(importPath, filename)

                // Check if the imported file is marked as server-only
                if (isServerOnlyFile(resolvedPath)) {
                  context.report({
                    node: node.source,
                    message:
                      `Islands cannot import from server-only files. The file "${importPath}" is marked with "server only".`,
                    hint:
                      "Remove the 'server only' marker from the imported file, move shared types to ~/types/, or use API endpoints to access server functionality.",
                  })
                }
              } catch (error) {
                // If we can't resolve the path, skip this check
                // (the TypeScript compiler will catch actual missing files)
              }
            }
          },

          // Also check dynamic imports
          'CallExpression[callee.name="import"]'(node: any) {
            if (node.arguments.length > 0) {
              const arg = node.arguments[0]
              if (arg.type === "Literal" && typeof arg.value === "string") {
                const importPath = arg.value

                try {
                  // Resolve the import path to an actual file path
                  const resolvedPath = resolveImportPath(importPath, filename)

                  // Check if the imported file is marked as server-only
                  if (isServerOnlyFile(resolvedPath)) {
                    context.report({
                      node: arg,
                      message:
                        `Islands cannot dynamically import from server-only files. The file "${importPath}" is marked with "server only".`,
                      hint: "Use API endpoints to fetch server data instead of dynamic imports.",
                    })
                  }
                } catch (error) {
                  // If we can't resolve the path, skip this check
                }
              }
            }
          },
        }
      },
    },
  },
}

export default plugin
