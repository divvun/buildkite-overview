// CSRF Protection middleware and utilities
// Protects against Cross-Site Request Forgery attacks

import { define } from "~/utils.ts"
import { constantTimeCompare, generateCSRFToken } from "~/utils/crypto.ts"
import { getSession } from "~/utils/session-store.ts"
import { getConfig } from "~/utils/config.ts"

export interface CSRFProtectedState {
  csrfToken?: string
}

// Extract CSRF token from various sources
function extractCSRFToken(request: Request): string | null {
  // 1. Check X-CSRF-Token header (most common for API requests)
  const headerToken = request.headers.get("X-CSRF-Token")
  if (headerToken) {
    return headerToken
  }

  // 2. Check form data for POST requests
  if (request.method === "POST") {
    const contentType = request.headers.get("content-type") || ""

    if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      // For form submissions, we'll need to parse the body
      // This is handled in the middleware by cloning the request
      return null // Will be handled by form parsing in middleware
    }
  }

  // 3. Check query parameter (less secure, but sometimes needed)
  const url = new URL(request.url)
  const queryToken = url.searchParams.get("_token")
  if (queryToken) {
    return queryToken
  }

  return null
}

// Get CSRF token from form data (for POST requests)
async function extractCSRFFromFormData(request: Request): Promise<string | null> {
  const contentType = request.headers.get("content-type") || ""

  if (
    !contentType.includes("application/x-www-form-urlencoded") &&
    !contentType.includes("multipart/form-data")
  ) {
    return null
  }

  try {
    const formData = await request.formData()
    return formData.get("_token") as string || null
  } catch {
    return null
  }
}

// Verify CSRF token for a session
async function verifyCSRFToken(request: Request): Promise<boolean> {
  // Get session ID from cookie
  const sessionIdCookie = request.headers.get("cookie")
    ?.split("; ")
    .find((c) => c.startsWith("session_id="))
    ?.split("=")[1]

  if (!sessionIdCookie) {
    return false // No session, no CSRF protection needed
  }

  // Get session to verify CSRF token
  const sessionWithTokens = await getSession(sessionIdCookie)
  if (!sessionWithTokens) {
    return false // Invalid session
  }

  // Extract CSRF token from request
  let providedToken = extractCSRFToken(request)

  // If not found in headers/query, try form data
  if (!providedToken && (request.method === "POST" || request.method === "PUT" || request.method === "DELETE")) {
    // Clone request to avoid consuming the body
    const clonedRequest = request.clone()
    providedToken = await extractCSRFFromFormData(clonedRequest)
  }

  if (!providedToken) {
    console.warn("CSRF token missing from request")
    return false
  }

  // Use constant-time comparison to prevent timing attacks
  const isValid = constantTimeCompare(sessionWithTokens.csrfToken, providedToken)

  if (!isValid) {
    console.warn("CSRF token verification failed")
  }

  return isValid
}

// CSRF protection middleware - protects state-changing requests
export const csrfProtection = define.middleware(async (ctx) => {
  const request = ctx.req
  const method = request.method.toUpperCase()

  // Only protect state-changing methods
  const protectedMethods = ["POST", "PUT", "DELETE", "PATCH"]
  if (!protectedMethods.includes(method)) {
    return await ctx.next()
  }

  // Skip CSRF protection for certain routes
  const pathname = new URL(request.url).pathname
  const exemptPaths = [
    "/api/webhooks/", // Webhooks use different authentication
    "/auth/", // OAuth flows have their own CSRF protection
  ]

  if (exemptPaths.some((path) => pathname.startsWith(path))) {
    return await ctx.next()
  }

  // Verify CSRF token
  const isValid = await verifyCSRFToken(request)
  if (!isValid) {
    // For API routes, return JSON error
    if (pathname.startsWith("/api/")) {
      return new Response(
        JSON.stringify({
          error: "CSRF token validation failed",
          code: "INVALID_CSRF_TOKEN",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    // For page routes, redirect with error
    const loginUrl = new URL("/auth/login", request.url)
    loginUrl.searchParams.set("error", "csrf_error")

    return new Response(null, {
      status: 302,
      headers: { "Location": loginUrl.toString() },
    })
  }

  return await ctx.next()
})

// Generate CSRF token for forms/API calls
export async function getCSRFTokenForSession(request: Request): Promise<string | null> {
  const sessionIdCookie = request.headers.get("cookie")
    ?.split("; ")
    .find((c) => c.startsWith("session_id="))
    ?.split("=")[1]

  if (!sessionIdCookie) {
    return null
  }

  const sessionWithTokens = await getSession(sessionIdCookie)
  return sessionWithTokens?.csrfToken || null
}

// Helper function to generate CSRF meta tag for HTML pages
export async function generateCSRFMetaTag(request: Request): Promise<string> {
  const token = await getCSRFTokenForSession(request)
  if (!token) {
    return "<!-- No CSRF token available -->"
  }

  return `<meta name="csrf-token" content="${token}">`
}

// Helper function to generate hidden CSRF input for forms
export async function generateCSRFInput(request: Request): Promise<string> {
  const token = await getCSRFTokenForSession(request)
  if (!token) {
    return "<!-- No CSRF token available -->"
  }

  return `<input type="hidden" name="_token" value="${token}">`
}

// Middleware to add CSRF token to page context
export const csrfContext = define.middleware(async (ctx) => {
  const csrfToken = await getCSRFTokenForSession(ctx.req) // Add CSRF token to state for templates to use
  ;(ctx.state as CSRFProtectedState).csrfToken = csrfToken || undefined

  return await ctx.next()
})
