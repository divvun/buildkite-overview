export interface SessionUser {
  id: number
  login: string
  name: string | null
  email: string | null
  avatar_url: string
}

export interface SessionData {
  user: SessionUser
  organizations: string[]
  access_token: string
  expires_at: number
}

export function getSessionFromRequest(request: Request): SessionData | null {
  // Check if BYPASS_ORG_CHECK is enabled for development
  if (Deno.env.get("BYPASS_ORG_CHECK") === "true") {
    return createMockSession()
  }

  try {
    const sessionCookie = request.headers.get("cookie")
      ?.split("; ")
      .find((c) => c.startsWith("session="))
      ?.split("=")[1]

    if (!sessionCookie) {
      return null
    }

    const sessionData = JSON.parse(atob(sessionCookie)) as SessionData

    // Check if session has expired
    if (Date.now() > sessionData.expires_at) {
      return null
    }

    return sessionData
  } catch (error) {
    console.error("Error parsing session:", error)
    return null
  }
}

export function requireAuth(request: Request): SessionData {
  const session = getSessionFromRequest(request)
  if (!session) {
    throw new Response(null, {
      status: 302,
      headers: { "Location": "/auth/login" },
    })
  }
  return session
}

export function getOptionalSession(request: Request): SessionData | null {
  return getSessionFromRequest(request)
}

export function hasOrgAccess(session: SessionData, org: string): boolean {
  return session.organizations.includes(org)
}

export function requireDivvunOrgAccess(request: Request): SessionData {
  // Check if BYPASS_ORG_CHECK is enabled for development
  if (Deno.env.get("BYPASS_ORG_CHECK") === "true") {
    return createMockSession()
  }

  const session = requireAuth(request)
  if (!hasOrgAccess(session, "divvun")) {
    throw new Response(null, {
      status: 403,
      headers: { "Location": "/auth/login?error=insufficient_access" },
    })
  }
  return session
}

export function createMockSession(): SessionData {
  return {
    user: {
      id: 99999,
      login: "dev-user",
      name: "Development User",
      email: "dev@example.com",
      avatar_url: "https://github.com/github.png",
    },
    organizations: ["divvun", "giellalt"],
    access_token: "mock_token_for_development",
    expires_at: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days from now
  }
}

export function shouldRefreshSession(session: SessionData): boolean {
  // Refresh if less than 3 days remaining
  const threeDaysFromNow = Date.now() + (3 * 24 * 60 * 60 * 1000)
  return session.expires_at < threeDaysFromNow
}

export function refreshSession(session: SessionData): SessionData {
  return {
    ...session,
    expires_at: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days from now
  }
}

export function createSessionCookie(session: SessionData, isProduction: boolean = false): string {
  const sessionCookie = btoa(JSON.stringify(session))
  const cookieFlags = `HttpOnly; ${isProduction ? "Secure; " : ""}SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}; Path=/`
  return `session=${sessionCookie}; ${cookieFlags}`
}
