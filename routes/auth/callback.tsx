import { Context } from "fresh"
import { exchangeCodeForTokens, getUserDataWithGraphQL, hasRequiredOrgAccess } from "~/server/auth.ts"
import { getConfig } from "~/server/config.ts"
import { createSessionCookie } from "~/server/session.ts"
import { storeAccessToken } from "~/server/token-store.ts"
import { State } from "~/utils.ts"
import { determineUserRole } from "~/utils/rbac.ts"

export const handler = {
  async GET(ctx: Context<State>) {
    const url = new URL(ctx.req.url)
    const code = url.searchParams.get("code")
    const state = url.searchParams.get("state")
    const error = url.searchParams.get("error")

    // Handle OAuth errors
    if (error) {
      console.error("OAuth error:", error)
      return new Response(null, {
        status: 302,
        headers: {
          "Location": "/auth/login?error=oauth_error",
        },
      })
    }

    // Validate required parameters
    if (!code || !state) {
      console.error("Missing OAuth parameters")
      return new Response(null, {
        status: 302,
        headers: {
          "Location": "/auth/login?error=missing_parameters",
        },
      })
    }

    try {
      const startTime = Date.now()
      console.log("🔄 Starting OAuth callback processing...")

      // Get stored OAuth state from session/cookie
      const cookieHeader = ctx.req.headers.get("cookie")
      const storedState = cookieHeader
        ?.split("; ")
        .find((c) => c.startsWith("oauth_state="))
        ?.split("=")[1]

      const storedCodeVerifier = cookieHeader
        ?.split("; ")
        .find((c) => c.startsWith("oauth_code_verifier="))
        ?.split("=")[1]

      const returnUrl = cookieHeader
        ?.split("; ")
        .find((c) => c.startsWith("return_url="))
        ?.split("=")[1]

      console.log(`⏱️  Cookie parsing took ${Date.now() - startTime}ms`)

      // Validate state parameter
      if (!storedState || storedState !== state) {
        console.error("OAuth state mismatch")
        return new Response(null, {
          status: 302,
          headers: {
            "Location": "/auth/login?error=state_mismatch",
          },
        })
      }

      if (!storedCodeVerifier) {
        console.error("Missing code verifier")
        return new Response(null, {
          status: 302,
          headers: {
            "Location": "/auth/login?error=missing_verifier",
          },
        })
      }

      // Exchange code for tokens
      const tokenExchangeStart = Date.now()
      const tokenSet = await exchangeCodeForTokens(code, storedCodeVerifier, state, storedState)
      console.log(`⏱️  Token exchange took ${Date.now() - tokenExchangeStart}ms`)

      if (!tokenSet.access_token) {
        console.error("No access token received")
        throw new Error("No access token received")
      }

      // Get all user data with a single GraphQL query
      const graphqlStart = Date.now()
      const { user, organizations: userOrgs, isBuildAdmin } = await getUserDataWithGraphQL(tokenSet.access_token)
      console.log(`⏱️  GraphQL user data fetch took ${Date.now() - graphqlStart}ms`)

      // Determine user role based on org and team membership
      const roleStart = Date.now()
      const teamMemberships = isBuildAdmin ? ["divvun/Build Admins"] : []
      const userRole = determineUserRole(userOrgs, teamMemberships)
      console.log(`⏱️  Role determination took ${Date.now() - roleStart}ms`)

      // Check if user has access to required organizations (guests are allowed but with limited access)
      if (!hasRequiredOrgAccess(userOrgs)) {
        console.log(`User ${user.login} does not have required org access, assigning GUEST role`)
      }

      // Store access token securely (not in session/cookies)
      const tokenStoreStart = Date.now()
      await storeAccessToken(user.id, tokenSet.access_token)
      console.log(`⏱️  Token storage took ${Date.now() - tokenStoreStart}ms`)

      // Create session data WITHOUT access token
      const sessionData = {
        user: {
          id: user.id,
          login: user.login,
          name: user.name,
          email: user.email,
          avatar_url: user.avatar_url,
        },
        organizations: userOrgs,
        teamMemberships,
        role: userRole,
        expires_at: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days from now
      }

      // Create secure session cookie (stores only session ID)
      const sessionCreateStart = Date.now()
      const sessionCookie = await createSessionCookie(sessionData)
      console.log(`⏱️  Session creation took ${Date.now() - sessionCreateStart}ms`)

      const headers = new Headers()

      // Redirect to return URL if provided, otherwise home
      const redirectUrl = returnUrl ? decodeURIComponent(returnUrl) : "/"
      headers.set("Location", redirectUrl)

      // Set session cookie and clear OAuth state cookies
      const config = getConfig()
      const cookieFlags = `HttpOnly; ${config.app.isProduction ? "Secure; " : ""}SameSite=Lax`

      headers.append("Set-Cookie", sessionCookie)
      headers.append("Set-Cookie", `oauth_state=; ${cookieFlags}; Max-Age=0; Path=/`)
      headers.append("Set-Cookie", `oauth_code_verifier=; ${cookieFlags}; Max-Age=0; Path=/`)
      headers.append("Set-Cookie", `return_url=; ${cookieFlags}; Max-Age=0; Path=/`)

      console.log(`User ${user.login} authenticated successfully with role ${userRole}`)
      console.log(`🏁 Total OAuth callback processing took ${Date.now() - startTime}ms`)
      return new Response(null, {
        status: 302,
        headers,
      })
    } catch (error) {
      console.error("OAuth callback error:", error)
      return new Response(null, {
        status: 302,
        headers: {
          "Location": "/auth/login?error=callback_error",
        },
      })
    }
  },
}
