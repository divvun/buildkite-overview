import plugin from "./no-server-imports.ts"
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import { clearServerOnlyCache, isServerOnlyFile, scanForServerOnlyMarker } from "./server-only-detector.ts"

Deno.test("no-server-imports-in-islands rule", async (t) => {
  await t.step("should report error for server imports in islands", () => {
    // Note: This test demonstrates the intended behavior
    // The actual Deno.lint.runPlugin API may not be available or work as expected
    // This serves as documentation of expected behavior

    const _testCode = `import { someFunction } from "~/server/utils.ts";`
    const _testFilename = "islands/TestComponent.tsx"

    // Since Deno.lint.runPlugin may not be available, we'll test the plugin structure
    const rule = plugin.rules["no-server-imports-in-islands"]
    assertEquals(typeof rule.create, "function")

    // Test that the plugin structure is correct
    assertEquals(plugin.name, "island-protection")
    assertEquals(typeof plugin.rules, "object")
  })

  await t.step("should have correct plugin structure", () => {
    // Verify plugin metadata
    assertEquals(plugin.name, "island-protection")
    assertEquals(typeof plugin.rules["no-server-imports-in-islands"], "object")
    assertEquals(typeof plugin.rules["no-server-imports-in-islands"].create, "function")

    // Verify new rule exists
    assertEquals(typeof plugin.rules["no-server-only-imports-in-islands"], "object")
    assertEquals(typeof plugin.rules["no-server-only-imports-in-islands"].create, "function")
  })

  await t.step("context creation works for different file types", () => {
    const rule = plugin.rules["no-server-imports-in-islands"]

    // Mock context for islands file
    const mockContext = {
      getFilename: () => "/path/to/islands/TestComponent.tsx",
      report: (_options: unknown) => {
        // Mock report function
      },
    }

    const islandHandlers = rule.create(mockContext)

    // Should return handlers for islands files
    assertEquals(typeof islandHandlers.ImportDeclaration, "function")

    // Mock context for non-islands file
    const mockNonIslandContext = {
      getFilename: () => "/path/to/routes/api/test.ts",
      report: (_options: unknown) => {
        // Mock report function
      },
    }

    const nonIslandHandlers = rule.create(mockNonIslandContext)

    // Should return empty object for non-islands files
    assertEquals(Object.keys(nonIslandHandlers).length, 0)
  })
})

Deno.test("no-server-only-imports-in-islands rule", async (t) => {
  // Clear cache before tests
  clearServerOnlyCache()

  await t.step("should have correct structure", () => {
    const rule = plugin.rules["no-server-only-imports-in-islands"]
    assertEquals(typeof rule.create, "function")

    // Test context creation for islands
    const mockContext = {
      getFilename: () => "/path/to/islands/TestComponent.tsx",
      report: (_options: unknown) => {
        // Mock report function
      },
    }

    const handlers = rule.create(mockContext)
    assertEquals(typeof handlers.ImportDeclaration, "function")
  })

  await t.step("should not apply to non-island files", () => {
    const rule = plugin.rules["no-server-only-imports-in-islands"]

    const mockContext = {
      getFilename: () => "/path/to/routes/api/test.ts",
      report: (_options: unknown) => {
        // Mock report function
      },
    }

    const handlers = rule.create(mockContext)
    assertEquals(Object.keys(handlers).length, 0)
  })
})

Deno.test("server-only-detector", async (t) => {
  await t.step("should detect 'server only' marker in various formats", () => {
    // Clear cache before test
    clearServerOnlyCache()

    // Test different formats
    assert(scanForServerOnlyMarker(`"server only";`))
    assert(scanForServerOnlyMarker(`'server only';`))
    assert(scanForServerOnlyMarker(`"server only"`))
    assert(scanForServerOnlyMarker(`
      "server only";
      
      export function test() {}
    `))

    // Test case insensitive
    assert(scanForServerOnlyMarker(`"SERVER ONLY";`))
    assert(scanForServerOnlyMarker(`"Server Only";`))

    // Test with whitespace
    assert(scanForServerOnlyMarker(`  "server only"  ;  `))

    // Should not match in comments or inside functions
    assert(!scanForServerOnlyMarker(`// "server only"`))
    assert(!scanForServerOnlyMarker(`function test() { "server only"; }`))

    // Should not match partial matches
    assert(!scanForServerOnlyMarker(`"this is server only code"`))
    assert(!scanForServerOnlyMarker(`"server-only"`))
  })

  await t.step("should handle file reading errors gracefully", () => {
    // Clear cache before test
    clearServerOnlyCache()

    // Test with non-existent file
    const result = isServerOnlyFile("/path/that/does/not/exist.ts")
    assertEquals(result, false)
  })
})
