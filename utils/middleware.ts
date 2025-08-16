import { define, State } from "~/utils.ts"
import { getOptionalSession, type SessionData } from "~/utils/session.ts"

// Extend the State interface to include session
export interface AppState extends State {
  session?: SessionData | null
}

export const sessionMiddleware = define.middleware(async (ctx) => {
  // Get session from request (optional, doesn't throw)
  ctx.state.session = getOptionalSession(ctx.req)

  // Continue to the route handler
  return await ctx.next()
})

export const requireGlobalAuth = define.middleware(async (ctx) => {
  // Check if global auth is required via environment variable
  const requireAuth = Deno.env.get("REQUIRE_AUTH") === "true"

  if (!requireAuth) {
    // Global auth not required, continue normally
    return await ctx.next()
  }

  // Skip auth check for auth routes to avoid infinite redirects
  if (ctx.url.pathname.startsWith("/auth/")) {
    return await ctx.next()
  }

  // Check if user has a valid session
  const session = getOptionalSession(ctx.req)
  if (!session) {
    // No valid session, redirect to login
    return new Response(null, {
      status: 302,
      headers: { "Location": "/auth/login" },
    })
  }

  // Valid session exists, continue to route handler
  return await ctx.next()
})

export function isPrivatePipeline(pipeline: { repo?: string; visibility?: string; tags?: string[] }): boolean {
  // A pipeline is private if:
  // 1. It has visibility set to "private"
  // 2. Or it's from a private repository (we'll determine this from repo patterns)
  // 3. Or it has a "private" tag

  if (pipeline.visibility === "private") {
    return true
  }

  if (pipeline.tags?.includes("private")) {
    return true
  }

  // You could add more logic here to determine if a repo is private
  // For now, assume all repos are public unless explicitly marked
  return false
}

export function canAccessPipeline(
  pipeline: { repo?: string; visibility?: string; tags?: string[] },
  session?: SessionData | null,
): boolean {
  // Public pipelines are accessible to everyone
  if (!isPrivatePipeline(pipeline)) {
    return true
  }

  // Private pipelines require authentication
  if (!session) {
    return false
  }

  // If authenticated, check if user has access to the relevant organization
  if (pipeline.repo) {
    const [org] = pipeline.repo.split("/")
    return session.organizations.includes(org)
  }

  // Default to allowing access if authenticated
  return true
}

export function filterPipelinesForUser<T extends { repo?: string; visibility?: string; tags?: string[] }>(
  pipelines: T[],
  session?: SessionData | null,
): T[] {
  return pipelines.filter((pipeline) => canAccessPipeline(pipeline, session))
}
