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
  const session = requireAuth(request)
  if (!hasOrgAccess(session, "divvun")) {
    throw new Response(null, {
      status: 403,
      headers: { "Location": "/auth/login?error=insufficient_access" },
    })
  }
  return session
}
