import { FluentBundle } from "@fluent/bundle"
import { define, State } from "~/utils.ts"
import type { SupportedLocale } from "~/utils/localization.ts"
import {
  createMockSession,
  createSessionCookie,
  getOptionalSession,
  getUserRole,
  refreshSession,
  shouldRefreshSession,
  userHasPermission,
  userHasRole,
} from "./session.ts"
import { type UserPermissions, UserRole } from "~/utils/rbac.ts"
import { shouldBypassOrgCheck, shouldRequireAuth } from "./config.ts"
import type { SessionData } from "~/types/session.ts"

// Extend the State interface to include session and localization
export interface AppState extends State {
  session?: SessionData | null
  locale: SupportedLocale
  l10n: FluentBundle
  t: (id: string, args?: Record<string, unknown>) => string
  title?: string
}

export const sessionMiddleware = define.middleware(async (ctx) => {
  // Check if bypass is enabled
  if (shouldBypassOrgCheck()) {
    console.log("⚠️  Using mock session for development (bypass enabled)")
    ;(ctx.state as AppState).session = createMockSession()
  } else {
    // Get session from request (optional, doesn't throw)
    let session = await getOptionalSession(ctx.req)

    // Check if session needs refresh
    if (session && shouldRefreshSession(session)) {
      // Note: refreshSession now requires sessionId, but we'll handle this differently
      // For now, just update the expires_at time locally
      session = {
        ...session,
        expires_at: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days from now
      }

      // Set updated cookie for refreshed session
      const sessionCookie = await createSessionCookie(session)

      // Get response and add the cookie
      const response = await ctx.next()
      if (response instanceof Response) {
        const newResponse = new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: new Headers(response.headers),
        })
        newResponse.headers.append("Set-Cookie", sessionCookie)
        ;(ctx.state as AppState).session = session
        return newResponse
      }
    }

    ;(ctx.state as AppState).session = session
  }

  // Continue to the route handler
  return await ctx.next()
})

export const localizationMiddleware = define.middleware(async (ctx) => {
  const { createTranslationFunction, getLocalizationBundle, negotiateLocale } = await import("~/utils/localization.ts")

  // First check for lang cookie, then fall back to Accept-Language header
  const langCookie = ctx.req.headers.get("cookie")
    ?.split("; ")
    .find((c: string) => c.startsWith("lang="))
    ?.split("=")[1]

  const acceptLanguageHeader = ctx.req.headers.get("Accept-Language")
  const locale = langCookie || negotiateLocale(acceptLanguageHeader || undefined)

  // Create localization bundle
  const bundle = await getLocalizationBundle(locale)
  const t = createTranslationFunction(bundle) // Add to context state
  ;(ctx.state as AppState).locale = locale
  ;(ctx.state as AppState).l10n = bundle
  ;(ctx.state as AppState).t = t
  ;(ctx.state as AppState).title = t("app-title") // Default title, routes can override

  // Get the response and set headers
  const response = await ctx.next()

  if (response instanceof Response) {
    // Create a new response with the proper headers
    const newResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(response.headers),
    })

    newResponse.headers.set("Content-Language", locale)

    // Append to Vary header if it exists, otherwise set it
    const existingVary = newResponse.headers.get("Vary")
    const varyValue = existingVary ? `${existingVary}, Accept-Language` : "Accept-Language"
    newResponse.headers.set("Vary", varyValue)

    return newResponse
  }

  return response
})

export const requireGlobalAuth = define.middleware(async (ctx) => {
  // Check if global auth is required via config
  if (!shouldRequireAuth()) {
    // Global auth not required, continue normally
    return await ctx.next()
  }

  // Skip auth check for auth routes, webhooks, and badge API to avoid infinite redirects
  if (
    ctx.url.pathname.startsWith("/auth/") ||
    ctx.url.pathname.startsWith("/api/webhooks/") ||
    ctx.url.pathname.startsWith("/api/badge/")
  ) {
    return await ctx.next()
  }

  // If bypass is enabled, mock session should already be in context from sessionMiddleware

  // Check if user has a valid session
  const session = await getOptionalSession(ctx.req)
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

// RBAC Middleware Functions
export function createRoleMiddleware(requiredRole: UserRole) {
  return define.middleware(async (ctx) => {
    const session = (ctx.state as AppState).session ?? null

    if (!userHasRole(session, requiredRole)) {
      // Redirect to login with insufficient permissions error
      const loginUrl = new URL("/auth/login", ctx.req.url)
      loginUrl.searchParams.set("error", "insufficient_permissions")
      loginUrl.searchParams.set("required_role", requiredRole)

      return new Response(null, {
        status: 302,
        headers: { "Location": loginUrl.toString() },
      })
    }

    return await ctx.next()
  })
}

export function createPermissionMiddleware(requiredPermission: keyof UserPermissions) {
  return define.middleware(async (ctx) => {
    const session = (ctx.state as AppState).session ?? null

    if (!userHasPermission(session, requiredPermission)) {
      // For API routes, return 403 JSON response
      if (ctx.req.url.includes("/api/")) {
        return new Response(
          JSON.stringify({
            error: "Insufficient permissions",
            required: requiredPermission,
            userRole: getUserRole(session),
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          },
        )
      }

      // For page routes, redirect to login
      const loginUrl = new URL("/auth/login", ctx.req.url)
      loginUrl.searchParams.set("error", "insufficient_permissions")
      loginUrl.searchParams.set("required_permission", requiredPermission)

      return new Response(null, {
        status: 302,
        headers: { "Location": loginUrl.toString() },
      })
    }

    return await ctx.next()
  })
}

// Pre-built middleware for common roles
export const requireMemberRole = createRoleMiddleware(UserRole.MEMBER)
export const requireAdminRole = createRoleMiddleware(UserRole.ADMIN)

// Pre-built middleware for common permissions
export const requirePrivatePipelineAccess = createPermissionMiddleware("canViewPrivatePipelines")
export const requireCreateBuilds = createPermissionMiddleware("canCreateBuilds")
export const requireManageAgents = createPermissionMiddleware("canManageAgents")
export const requireAdminFeatures = createPermissionMiddleware("canAccessAdminFeatures")
