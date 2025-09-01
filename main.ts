console.log("🚀 Starting Buildkite Overview Application...")

import { App, staticFiles } from "fresh"
import { getBackgroundPoller } from "./server/background-poller.ts"
import { getCacheManager } from "./server/cache/cache-manager.ts"
import { parseCliArgs } from "./server/cli.ts"
import { getConfig, shouldBypassOrgCheck, shouldRequireAuth } from "./server/config.ts"
import { csrfContext, csrfProtection } from "./server/csrf.ts"
import { type AppState, localizationMiddleware, requireGlobalAuth, sessionMiddleware } from "./server/middleware.ts"
import { securityHeaders } from "./server/security-headers.ts"
import { startSessionCleanup } from "./server/session-store.ts"
import { startTokenCleanup } from "./server/token-store.ts"
import { define } from "./utils.ts"

// Parse CLI arguments
const cliOptions = parseCliArgs()

// Initialize configuration (validates environment variables/config file)
getConfig(cliOptions.config)
console.log("✅ Configuration initialized and validated")

// Log configuration status
if (shouldBypassOrgCheck()) {
  console.log("⚠️  Development mode: GitHub organization check is bypassed")
}

if (shouldRequireAuth()) {
  console.log("🔒 Global authentication is enabled - all routes require login")
}

// Initialize cache manager and database
console.log("🗄️  Initializing cache database...")
getCacheManager() // Initialize the singleton

// Cache cleanup is handled internally by the cache manager
console.log("✅ Cache system initialized")

// Start security-related cleanup services
console.log("🛡️  Starting security services...")
startSessionCleanup()
startTokenCleanup()
console.log("✅ Security services started")

// Initialize and start background polling service
const backgroundPoller = getBackgroundPoller()
backgroundPoller.start()

export const app = new App<AppState>()

// Apply middleware in order - security headers first
app.use(staticFiles())
app.use(securityHeaders)
app.use(sessionMiddleware)
app.use(csrfContext) // Add CSRF token to context
app.use(csrfProtection) // Protect state-changing requests
app.use(localizationMiddleware)

// Apply global auth middleware only if REQUIRE_AUTH is enabled
if (shouldRequireAuth()) {
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
const loggerMiddleware = define.middleware(async (ctx) => {
  if (ctx.req.url.endsWith("/health")) {
    return ctx.next()
  }
  const response = await ctx.next()
  const status = response instanceof Response ? response.status : "unknown"
  console.log(`${ctx.req.method} ${status} ${ctx.req.url}`)
  return response
})
app.use(loggerMiddleware)

// Include file-system based routes here
app.fsRoutes()
