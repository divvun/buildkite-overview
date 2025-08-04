import { App, staticFiles } from "fresh"
import "jsr:@std/dotenv/load"
import { define } from "./utils.ts"
import { sessionMiddleware, type AppState } from "./utils/middleware.ts"

// Validate required environment variables
const requiredEnvVars = [
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "BASE_URL"
] as const

// Optional environment variables for development
const optionalEnvVars = [
  "BYPASS_ORG_CHECK"  // Set to "true" to bypass GitHub organization requirement
] as const

const missingVars = requiredEnvVars.filter(varName => !Deno.env.get(varName))

if (missingVars.length > 0) {
  console.error("❌ Missing required environment variables:")
  missingVars.forEach(varName => {
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

export const app = new App<AppState>()

app.use(staticFiles())
app.use(sessionMiddleware)

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
