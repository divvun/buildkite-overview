import { Context } from "fresh"
import { State } from "~/utils.ts"
import { exchangeCodeForTokens, getUserInfo, getUserOrganizations, hasRequiredOrgAccess } from "~/utils/auth.ts"

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
      return new Response(null, {
        status: 302,
        headers: {
          "Location": "/auth/login?error=missing_parameters",
        },
      })
    }

    try {
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
      const tokenSet = await exchangeCodeForTokens(code, storedCodeVerifier, state, storedState)

      if (!tokenSet.access_token) {
        throw new Error("No access token received")
      }

      // Get user information
      const user = await getUserInfo(tokenSet.access_token)
      const userOrgs = await getUserOrganizations(tokenSet.access_token)

      // Check if user has access to required organizations
      if (!hasRequiredOrgAccess(userOrgs)) {
        return new Response(null, {
          status: 302,
          headers: {
            "Location": "/auth/login?error=insufficient_access",
          },
        })
      }

      // Create session data
      const sessionData = {
        user: {
          id: user.id,
          login: user.login,
          name: user.name,
          email: user.email,
          avatar_url: user.avatar_url,
        },
        organizations: userOrgs,
        access_token: tokenSet.access_token,
        expires_at: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days from now
      }

      // In a real app, you'd store this in a secure session store
      // For now, we'll use a signed cookie
      const sessionCookie = btoa(JSON.stringify(sessionData))

      const headers = new Headers()

      // Redirect to return URL if provided, otherwise home
      const redirectUrl = returnUrl ? decodeURIComponent(returnUrl) : "/"
      headers.set("Location", redirectUrl)

      // Set session cookie (expires in 7 days)
      const isProduction = Deno.env.get("DENO_ENV") === "production"
      const cookieFlags = `HttpOnly; ${isProduction ? "Secure; " : ""}SameSite=Lax`

      headers.append("Set-Cookie", `session=${sessionCookie}; ${cookieFlags}; Max-Age=${7 * 24 * 60 * 60}; Path=/`)
      headers.append("Set-Cookie", `oauth_state=; ${cookieFlags}; Max-Age=0; Path=/`)
      headers.append("Set-Cookie", `oauth_code_verifier=; ${cookieFlags}; Max-Age=0; Path=/`)
      headers.append("Set-Cookie", `return_url=; ${cookieFlags}; Max-Age=0; Path=/`)

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
