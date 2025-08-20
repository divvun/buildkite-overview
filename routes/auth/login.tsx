import { Context, page } from "fresh"
import { generateAuthUrl } from "~/utils/auth.ts"
import { type AppState } from "~/utils/middleware.ts"
import { getOptionalSession } from "~/utils/session.ts"

export const config = {
  skipInheritedLayouts: true,
}

interface LoginProps {
  error?: string
  returnUrl?: string
  message?: string
}

export const handler = {
  GET(ctx: Context<AppState>) {
    const url = new URL(ctx.req.url)
    const error = url.searchParams.get("error")
    const returnUrl = url.searchParams.get("return")
    const reason = url.searchParams.get("reason")

    // If already authenticated with a valid session, redirect to return URL or home
    const session = getOptionalSession(ctx.req)
    if (session && session.user.login !== "dev-user") {
      return new Response(null, {
        status: 302,
        headers: { "Location": returnUrl || "/" },
      })
    }

    // Create appropriate message based on context
    let message: string | undefined
    if (reason === "logs_require_auth") {
      message = "Please sign in with GitHub to view build logs"
    } else if (returnUrl?.includes('/logs')) {
      message = "Sign in to view build logs"
    }

    return page({ 
      error: error || undefined,
      returnUrl: returnUrl || undefined,
      message
    })
  },

  async POST(ctx: Context<AppState>) {
    try {
      // Extract return URL from form data
      const formData = await ctx.req.formData()
      const returnUrl = formData.get("returnUrl")?.toString()

      const { url, state, codeVerifier } = await generateAuthUrl()

      const headers = new Headers()
      headers.set("Location", url)

      // Store OAuth state, code verifier, and return URL in cookies (expires in 10 minutes)
      const isProduction = Deno.env.get("DENO_ENV") === "production"
      const cookieFlags = `HttpOnly; ${isProduction ? "Secure; " : ""}SameSite=Lax; Max-Age=600; Path=/`

      headers.append("Set-Cookie", `oauth_state=${state}; ${cookieFlags}`)
      headers.append("Set-Cookie", `oauth_code_verifier=${codeVerifier}; ${cookieFlags}`)
      
      if (returnUrl) {
        headers.append("Set-Cookie", `return_url=${encodeURIComponent(returnUrl)}; ${cookieFlags}`)
      }

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

export default function Login(props: { data: LoginProps; state: AppState }) {
  const { error, returnUrl, message } = props.data
  let errorMessage = ""
  switch (error) {
    case "oauth_error":
      errorMessage = props.state.t("auth-failed")
      break
    case "missing_parameters":
      errorMessage = props.state.t("invalid-auth-response")
      break
    case "state_mismatch":
      errorMessage = props.state.t("security-validation-failed")
      break
    case "insufficient_access":
      errorMessage = props.state.t("insufficient-access-error")
      break
    case "callback_error":
      errorMessage = props.state.t("auth-error-occurred")
      break
  }

  return (
    <html lang="en" class="wa-cloak">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{props.state.t("login-page-title")}</title>
        <link rel="stylesheet" href="/webawesome/styles/webawesome.css" />
        <script type="module" src="/webawesome/webawesome.loader.js"></script>
      </head>
      <body>
        <div
          class="wa-center"
          style="min-height: 100vh; padding: var(--wa-space-xl); display: flex; align-items: center; justify-content: center"
        >
          <wa-card style={"max-width: 400px; width: 100%" as any}>
            <div class="wa-stack wa-gap-l wa-align-items-center" style="padding: var(--wa-space-l)">
              <div class="wa-stack wa-gap-s wa-align-items-center">
                <wa-icon name="building" style={"font-size: 3rem; color: var(--wa-color-brand-fill-loud)" as any}>
                </wa-icon>
                <h1 class="wa-heading-l">{props.state.t("divvun-buildkite")}</h1>
                <p class="wa-body-m wa-color-text-quiet wa-text-center">
                  {message || props.state.t("login-description")}
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
                  {returnUrl && <input type="hidden" name="returnUrl" value={returnUrl} />}
                  <wa-button type="submit" variant="brand" style={"width: 100%; justify-content: center" as any}>
                    <wa-icon
                      slot="prefix"
                      name={error === "insufficient_access" ? "arrow-rotate-right" : "github"}
                      style={"font-size: 1.2em" as any}
                    >
                    </wa-icon>
                    {error === "insufficient_access"
                      ? props.state.t("try-different-account")
                      : props.state.t("sign-in-github")}
                  </wa-button>
                </form>
                {error === "insufficient_access" && (
                  <div class="wa-stack wa-gap-xs wa-align-items-center">
                    <p class="wa-caption-s wa-color-text-quiet wa-text-center">
                      {props.state.t("choose-different-account-desc")}
                    </p>
                    <p class="wa-caption-xs wa-color-text-quiet wa-text-center">
                      You can also{" "}
                      <a
                        href={`https://github.com/settings/connections/applications/${
                          Deno.env.get("GITHUB_CLIENT_ID")
                        }`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style="color: var(--wa-color-brand-fill-loud)"
                        class="wa-cluster wa-gap-xs"
                      >
                        {props.state.t("review-app-permissions")}
                        <wa-icon name="arrow-up-right-from-square" style="font-size: 0.75em"></wa-icon>
                      </a>
                    </p>
                  </div>
                )}

                <div class="wa-stack wa-gap-xs wa-align-items-center">
                  <wa-callout variant="neutral">
                    <wa-icon slot="icon" name="circle-info" variant="regular"></wa-icon>
                    {props.state.t("requires-membership", { org1: "divvun", org2: "giellalt" })}
                  </wa-callout>
                  <p class="wa-caption-xs wa-color-text-quiet wa-text-center">
                    {props.state.t("access-description")}
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
