import { App, staticFiles } from "fresh"
import "jsr:@std/dotenv/load"
import { define } from "./utils.ts"
import { getBackgroundPoller } from "./utils/background-poller.ts"
import { getCacheManager } from "./utils/cache/cache-manager.ts"
import { type AppState, localizationMiddleware, requireGlobalAuth, sessionMiddleware } from "./utils/middleware.ts"

// Validate required environment variables
const requiredEnvVars = [
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "BASE_URL",
  "BUILDKITE_API_KEY",
  "BUILDKITE_WEBHOOK_TOKEN",
  "GITHUB_APP_TOKEN",
] as const

// Optional environment variables for development
const _optionalEnvVars = [
  "BYPASS_ORG_CHECK", // Set to "true" to bypass GitHub organization requirement
  "REQUIRE_AUTH", // Set to "true" to require authentication for all routes
] as const

const missingVars = requiredEnvVars.filter((varName) => !Deno.env.get(varName))

if (missingVars.length > 0) {
  console.error("❌ Missing required environment variables:")
  missingVars.forEach((varName) => {
    console.error(`   ${varName}`)
  })
  console.error("\nPlease create a .env file with the required variables.")
  Deno.exit(1)
}

console.log("✅ All required environment variables are present")

// Log optional environment variable status
if (Deno.env.get("BYPASS_ORG_CHECK") === "true") {
  console.log("⚠️  Development mode: GitHub organization check is bypassed")
}

if (Deno.env.get("REQUIRE_AUTH") === "true") {
  console.log("🔒 Global authentication is enabled - all routes require login")
}

// Initialize cache manager and database
console.log("🗄️  Initializing cache database...")
getCacheManager() // Initialize the singleton

// Cache cleanup is handled internally by the cache manager
console.log("✅ Cache system initialized")

// Initialize and start background polling service
const backgroundPoller = getBackgroundPoller()
backgroundPoller.start()

export const app = new App<AppState>()

app.use(staticFiles())
app.use(sessionMiddleware)
app.use(localizationMiddleware)

// Apply global auth middleware only if REQUIRE_AUTH is enabled
if (Deno.env.get("REQUIRE_AUTH") === "true") {
  app.use(requireGlobalAuth)
}

// this is the same as the /api/:name route defined via a file. feel free to delete this!
app.get("/api2/:name", (ctx) => {
  const name = ctx.params.name
  return new Response(
    `Hello, ${name.charAt(0).toUpperCase() + name.slice(1)}!`,
  )
})

// this can also be defined via a file. feel free to delete this!
const exampleLoggerMiddleware = define.middleware((ctx) => {
  console.log(`${ctx.req.method} ${ctx.req.url}`)
  return ctx.next()
})
app.use(exampleLoggerMiddleware)

// Include file-system based routes here
app.fsRoutes()
