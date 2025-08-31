import {
  BUILD_ADMIN_TEAMS,
  getRolePermissions,
  hasPermission,
  isRoleAtLeast,
  REQUIRED_ORGS,
  type UserPermissions,
  UserRole,
} from "~/utils/rbac.ts"
import { getConfig, shouldBypassOrgCheck } from "~/utils/config.ts"
import { createSession, deleteSession, getSession, updateSession } from "~/utils/session-store.ts"

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
  teamMemberships: string[]
  role: UserRole
  expires_at: number
}

export async function getSessionFromRequest(request: Request): Promise<SessionData | null> {
  // Check if BYPASS_ORG_CHECK is enabled for development
  if (shouldBypassOrgCheck()) {
    return createMockSession()
  }

  try {
    const sessionIdCookie = request.headers.get("cookie")
      ?.split("; ")
      .find((c) => c.startsWith("session_id="))
      ?.split("=")[1]

    if (!sessionIdCookie) {
      return null
    }

    const sessionWithTokens = await getSession(sessionIdCookie)
    if (!sessionWithTokens) {
      return null
    }

    // Return session data without the sessionId and csrfToken
    const { sessionId, csrfToken, ...sessionData } = sessionWithTokens
    return sessionData
  } catch (error) {
    console.error("Error retrieving session:", error)
    return null
  }
}

export async function requireAuth(request: Request): Promise<SessionData> {
  const session = await getSessionFromRequest(request)
  if (!session) {
    throw new Response(null, {
      status: 302,
      headers: { "Location": "/auth/login" },
    })
  }
  return session
}

export async function getOptionalSession(request: Request): Promise<SessionData | null> {
  return await getSessionFromRequest(request)
}

export function hasOrgAccess(session: SessionData, org: string): boolean {
  return session.organizations.includes(org)
}

export async function requireDivvunOrgAccess(request: Request): Promise<SessionData> {
  const session = await requireAuth(request)
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
    organizations: [...REQUIRED_ORGS],
    teamMemberships: [...BUILD_ADMIN_TEAMS],
    role: UserRole.ADMIN,
    expires_at: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days from now
  }
}

export function shouldRefreshSession(session: SessionData): boolean {
  // Refresh if less than 3 days remaining
  const threeDaysFromNow = Date.now() + (3 * 24 * 60 * 60 * 1000)
  return session.expires_at < threeDaysFromNow
}

export async function refreshSession(sessionId: string, session: SessionData): Promise<SessionData> {
  const refreshedSession = {
    ...session,
    expires_at: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days from now
  }

  await updateSession(sessionId, refreshedSession)
  return refreshedSession
}

export async function createSessionCookie(session: SessionData): Promise<string> {
  const config = getConfig()
  const sessionWithTokens = await createSession(session)

  const cookieFlags = `HttpOnly; ${config.app.isProduction ? "Secure; " : ""}SameSite=Lax; Max-Age=${
    7 * 24 * 60 * 60
  }; Path=/`
  return `session_id=${sessionWithTokens.sessionId}; ${cookieFlags}`
}

// Role-based helper functions
export function getUserRole(session: SessionData | null): UserRole {
  return session?.role ?? UserRole.GUEST
}

export function getUserPermissions(session: SessionData | null): UserPermissions {
  const role = getUserRole(session)
  return getRolePermissions(role)
}

export function userHasPermission(session: SessionData | null, permission: keyof UserPermissions): boolean {
  const role = getUserRole(session)
  return hasPermission(role, permission)
}

export function userHasRole(session: SessionData | null, requiredRole: UserRole): boolean {
  const userRole = getUserRole(session)
  return isRoleAtLeast(userRole, requiredRole)
}

export function isGuest(session: SessionData | null): boolean {
  return getUserRole(session) === UserRole.GUEST
}

export function isMember(session: SessionData | null): boolean {
  return isRoleAtLeast(getUserRole(session), UserRole.MEMBER)
}

export function isAdmin(session: SessionData | null): boolean {
  return getUserRole(session) === UserRole.ADMIN
}

// Updated role-based access control functions
export async function requireRole(request: Request, requiredRole: UserRole): Promise<SessionData> {
  const session = await requireAuth(request)

  if (!userHasRole(session, requiredRole)) {
    throw new Response(null, {
      status: 403,
      headers: { "Location": "/auth/login?error=insufficient_permissions" },
    })
  }

  return session
}

export async function requireMember(request: Request): Promise<SessionData> {
  return await requireRole(request, UserRole.MEMBER)
}

export async function requireAdmin(request: Request): Promise<SessionData> {
  return await requireRole(request, UserRole.ADMIN)
}
