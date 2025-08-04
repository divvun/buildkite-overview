import { Context, page } from "fresh"
import { State } from "~/utils.ts"
import { generateAuthUrl } from "~/utils/auth.ts"

export const config = {
  skipInheritedLayouts: true,
}

interface LoginProps {
  error?: string
}

export const handler = {
  GET(ctx: Context<State>) {
    const url = new URL(ctx.req.url)
    const error = url.searchParams.get("error")

    // If already authenticated, redirect to home
    const sessionCookie = ctx.req.headers.get("cookie")
      ?.split("; ")
      .find(c => c.startsWith("session="))

    if (sessionCookie) {
      return new Response(null, {
        status: 302,
        headers: { "Location": "/" },
      })
    }

    return page({ error: error || undefined })
  },

  async POST(ctx: Context<State>) {
    try {
      const { url, state, codeVerifier } = await generateAuthUrl()

      const headers = new Headers()
      headers.set("Location", url)
      
      // Store OAuth state and code verifier in cookies (expires in 10 minutes)
      const isProduction = Deno.env.get("DENO_ENV") === "production"
      const cookieFlags = `HttpOnly; ${isProduction ? "Secure; " : ""}SameSite=Lax; Max-Age=600; Path=/`
      
      headers.append("Set-Cookie", `oauth_state=${state}; ${cookieFlags}`)
      headers.append("Set-Cookie", `oauth_code_verifier=${codeVerifier}; ${cookieFlags}`)

      return new Response(null, {
        status: 302,
        headers,
      })
    } catch (error) {
      console.error("Login error:", error)
      return new Response(null, {
        status: 302,
        headers: {
          "Location": "/auth/login?error=oauth_error",
        },
      })
    }
  },
}

export default function Login(props: { data: LoginProps }) {
  const { error } = props.data
  let errorMessage = ""
  switch (error) {
    case "oauth_error":
      errorMessage = "Authentication failed. Please try again."
      break
    case "missing_parameters":
      errorMessage = "Invalid authentication response."
      break
    case "state_mismatch":
      errorMessage = "Security validation failed. Please try again."
      break
    case "insufficient_access":
      errorMessage = "You don't have access to the required GitHub organizations (divvun or giellalt). You may need to re-authenticate to update your organization permissions."
      break
    case "callback_error":
      errorMessage = "Authentication error occurred. Please try again."
      break
  }

  return (
    <html lang="en" class="wa-cloak">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Sign In - Buildkite Overview</title>
        <link rel="stylesheet" href="/webawesome/styles/webawesome.css" />
        <script type="module" src="/webawesome/webawesome.loader.js"></script>
      </head>
      <body>
        <div class="wa-center" style="min-height: 100vh; padding: var(--wa-space-xl)">
          <wa-card style={"max-width: 400px; width: 100%" as any}>
            <div class="wa-stack wa-gap-l wa-align-items-center" style="padding: var(--wa-space-l)">
              <div class="wa-stack wa-gap-s wa-align-items-center">
                <wa-icon name="building" style={"font-size: 3rem; color: var(--wa-color-brand-fill-loud)" as any}></wa-icon>
                <h1 class="wa-heading-l">Divvun Buildkite</h1>
                <p class="wa-body-m wa-color-text-quiet wa-text-center">
                  Sign in with your GitHub account to access the build overview dashboard
                </p>
              </div>

              {errorMessage && (
                <wa-callout variant="danger">
                  <wa-icon slot="icon" name="triangle-exclamation"></wa-icon>
                  {errorMessage}
                </wa-callout>
              )}

              <div class="wa-stack wa-gap-s wa-align-items-center">
                <form method="POST" style="width: 100%">
                  <wa-button type="submit" variant="brand" style={"width: 100%; justify-content: center" as any}>
                    <wa-icon slot="prefix" name={error === "insufficient_access" ? "arrow-rotate-right" : "github"} style={"font-size: 1.2em" as any}></wa-icon>
                    {error === "insufficient_access" ? "Try Different Account" : "Sign in with GitHub"}
                  </wa-button>
                </form>
                {error === "insufficient_access" && (
                  <div class="wa-stack wa-gap-xs wa-align-items-center">
                    <p class="wa-caption-s wa-color-text-quiet wa-text-center">
                      Choose a different account or re-authorize to update organization permissions
                    </p>
                    <p class="wa-caption-xs wa-color-text-quiet wa-text-center">
                      You can also <a href={`https://github.com/settings/connections/applications/${Deno.env.get("GITHUB_CLIENT_ID")}`} target="_blank" rel="noopener noreferrer" style="color: var(--wa-color-brand-fill-loud)">review app permissions on GitHub</a>
                    </p>
                  </div>
                )}
                
                <div class="wa-stack wa-gap-xs wa-align-items-center">
                  <p class="wa-caption-s wa-color-text-quiet wa-text-center">
                    Requires access to divvun or giellalt organizations
                  </p>
                  <p class="wa-caption-xs wa-color-text-quiet wa-text-center">
                    We only access your public profile and organization membership
                  </p>
                </div>
              </div>
            </div>
          </wa-card>
        </div>
      </body>
    </html>
  )
}