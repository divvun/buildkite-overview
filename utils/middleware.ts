import { FluentBundle, type FluentVariable } from "@fluent/bundle"
import { define, State } from "~/utils.ts"
import {
  createMockSession,
  createSessionCookie,
  getOptionalSession,
  refreshSession,
  type SessionData,
  shouldRefreshSession,
} from "~/utils/session.ts"
import type { SupportedLocale } from "~/utils/localization.ts"

// Extend the State interface to include session and localization
export interface AppState extends State {
  session?: SessionData | null
  locale: SupportedLocale
  l10n: FluentBundle
  t: (id: string, args?: Record<string, unknown>) => string
  title?: string
}

export const sessionMiddleware = define.middleware(async (ctx) => {
  // Check if BYPASS_ORG_CHECK is enabled
  if (Deno.env.get("BYPASS_ORG_CHECK") === "true") {
    console.log("⚠️  Using mock session for development (BYPASS_ORG_CHECK=true)")
    ;(ctx.state as AppState).session = createMockSession()
  } else {
    // Get session from request (optional, doesn't throw)
    let session = getOptionalSession(ctx.req)

    // Check if session needs refresh
    if (session && shouldRefreshSession(session)) {
      session = refreshSession(session)

      // Set updated cookie for refreshed session
      const isProduction = Deno.env.get("DENO_ENV") === "production"
      const sessionCookie = createSessionCookie(session, isProduction)

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
  // Check if global auth is required via environment variable
  const requireAuth = Deno.env.get("REQUIRE_AUTH") === "true"

  if (!requireAuth) {
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

  // If BYPASS_ORG_CHECK is enabled, mock session should already be in context
  if (Deno.env.get("BYPASS_ORG_CHECK") === "true") {
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
