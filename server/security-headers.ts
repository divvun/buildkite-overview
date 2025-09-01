// Security headers middleware
// Adds essential security headers to protect against common attacks

import { define } from "~/utils.ts"
import type { AppState } from "~/server/middleware.ts"
import { getConfig } from "~/server/config.ts"

export interface SecurityHeadersConfig {
  contentSecurityPolicy?: string | false
  strictTransportSecurity?: boolean
  frameOptions?: "DENY" | "SAMEORIGIN" | string
  contentTypeOptions?: boolean
  referrerPolicy?: string
  permissionsPolicy?: string
}

// Default CSP that should work for most applications
const DEFAULT_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Relaxed for dev, should be stricter in prod
  "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
  "img-src 'self' data: https:", // Allow external images (e.g., avatars from GitHub)
  "font-src 'self' data: fonts.gstatic.com ka-f.fontawesome.com",
  "connect-src 'self' data: ka-f.fontawesome.com", // Allow FontAwesome icon fetching and data URLs
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests", // Only in HTTPS environments
].join("; ")

// Production-ready CSP (more restrictive)
const PRODUCTION_CSP = [
  "default-src 'self'",
  "script-src 'self' 'sha256-TD1slf8Kg59cpgxSBug27yb3OWtTY16Od+ESF7pY72A=' 'sha256-FjUAjMKOpu3WTb29bhP7Rr6eMrTmEItWMn/b0HjOApQ='", // Allow specific WebAwesome initialization scripts
  "style-src 'self' 'unsafe-inline' fonts.googleapis.com", // May need hashes for inline styles
  "img-src 'self' data: https: ka-f.fontawesome.com", // Allow external images and FontAwesome SVGs
  "font-src 'self' data: fonts.gstatic.com ka-f.fontawesome.com",
  "connect-src 'self' data: ka-f.fontawesome.com https:", // Allow FontAwesome icon fetching and HTTPS requests
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ")

// Security headers middleware
export function createSecurityHeaders(config: SecurityHeadersConfig = {}) {
  return define.middleware(async (ctx) => {
    const response = await ctx.next()

    if (!(response instanceof Response)) {
      return response
    }

    const appConfig = getConfig()
    const newResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(response.headers),
    })

    // Content Security Policy
    if (config.contentSecurityPolicy !== false) {
      const csp = config.contentSecurityPolicy ||
        (appConfig.app.isProduction ? PRODUCTION_CSP : DEFAULT_CSP)
      newResponse.headers.set("Content-Security-Policy", csp)
    }

    // Strict Transport Security (HTTPS only)
    if (config.strictTransportSecurity !== false && appConfig.app.isProduction) {
      newResponse.headers.set(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains; preload",
      )
    }

    // X-Frame-Options
    const frameOptions = config.frameOptions || "DENY"
    newResponse.headers.set("X-Frame-Options", frameOptions)

    // X-Content-Type-Options
    if (config.contentTypeOptions !== false) {
      newResponse.headers.set("X-Content-Type-Options", "nosniff")
    }

    // X-XSS-Protection (legacy, but still useful for older browsers)
    newResponse.headers.set("X-XSS-Protection", "1; mode=block")

    // Referrer-Policy
    const referrerPolicy = config.referrerPolicy || "strict-origin-when-cross-origin"
    newResponse.headers.set("Referrer-Policy", referrerPolicy)

    // Permissions-Policy (modern replacement for Feature-Policy)
    const permissionsPolicy = config.permissionsPolicy || [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "interest-cohort=()", // Disable FLoC
    ].join(", ")
    newResponse.headers.set("Permissions-Policy", permissionsPolicy)

    // Cross-Origin-Embedder-Policy and Cross-Origin-Opener-Policy for additional isolation
    newResponse.headers.set("Cross-Origin-Embedder-Policy", "credentialless")
    newResponse.headers.set("Cross-Origin-Opener-Policy", "same-origin")

    // Remove potentially revealing server headers
    newResponse.headers.delete("Server")
    newResponse.headers.delete("X-Powered-By")

    // Set secure cache control for sensitive pages
    const pathname = new URL(ctx.req.url).pathname
    if (pathname.startsWith("/api/") || pathname.includes("admin") || pathname.includes("auth")) {
      newResponse.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private")
      newResponse.headers.set("Pragma", "no-cache")
      newResponse.headers.set("Expires", "0")
    }

    return newResponse
  })
}

// Default security headers middleware with sensible defaults
export const securityHeaders = createSecurityHeaders()

// Stricter security headers for admin/sensitive areas
export const strictSecurityHeaders = createSecurityHeaders({
  contentSecurityPolicy: [
    "default-src 'self'",
    "script-src 'self'", // No unsafe-inline
    "style-src 'self'", // No unsafe-inline
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'", // Only same origin - no external APIs from client
    "form-action 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
  ].join("; "),
  frameOptions: "DENY",
})

// Helper to check if a response should have strict security headers
export function requiresStrictSecurity(pathname: string): boolean {
  const strictPaths = [
    "/admin/",
    "/api/builds/",
    "/api/agents/",
    "/api/pipelines/",
    "/auth/",
  ]

  return strictPaths.some((path) => pathname.startsWith(path))
}
