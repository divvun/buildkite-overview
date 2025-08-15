import {
  authorizationCodeGrant,
  calculatePKCECodeChallenge,
  type ClientMetadata,
  Configuration,
  discovery,
  randomPKCECodeVerifier,
  randomState,
  type ServerMetadata,
} from "openid-client"

// Environment variables for GitHub OAuth
const GITHUB_CLIENT_ID = Deno.env.get("GITHUB_CLIENT_ID") || ""
const GITHUB_CLIENT_SECRET = Deno.env.get("GITHUB_CLIENT_SECRET") || ""
const BASE_URL = Deno.env.get("BASE_URL") || "http://localhost:8000"

// GitHub OAuth server metadata
const GITHUB_SERVER_METADATA: ServerMetadata = {
  issuer: "https://github.com",
  authorization_endpoint: "https://github.com/login/oauth/authorize",
  token_endpoint: "https://github.com/login/oauth/access_token",
  userinfo_endpoint: "https://api.github.com/user",
}

// GitHub OAuth client metadata
const GITHUB_CLIENT_METADATA: ClientMetadata = {
  client_id: GITHUB_CLIENT_ID,
  client_secret: GITHUB_CLIENT_SECRET,
  redirect_uris: [`${BASE_URL}/auth/callback`],
  response_types: ["code"],
}

let config: Configuration | null = null

export function getOAuthConfig(): Configuration {
  if (!config) {
    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
      throw new Error(
        "GitHub OAuth credentials not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables.",
      )
    }

    config = new Configuration(GITHUB_SERVER_METADATA, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET)
  }
  return config
}

export async function generateAuthUrl(): Promise<{ url: string; state: string; codeVerifier: string }> {
  const codeVerifier = randomPKCECodeVerifier()
  const codeChallenge = await calculatePKCECodeChallenge(codeVerifier)
  const state = randomState()

  const authUrl = new URL("https://github.com/login/oauth/authorize")
  authUrl.searchParams.set("client_id", GITHUB_CLIENT_ID)
  authUrl.searchParams.set("redirect_uri", `${BASE_URL}/auth/callback`)
  authUrl.searchParams.set("scope", "read:user read:org repo")
  authUrl.searchParams.set("state", state)
  authUrl.searchParams.set("code_challenge", codeChallenge)
  authUrl.searchParams.set("code_challenge_method", "S256")
  authUrl.searchParams.set("prompt", "select_account")

  return {
    url: authUrl.toString(),
    state,
    codeVerifier,
  }
}

export interface GitHubUser {
  id: number
  login: string
  name: string | null
  email: string | null
  avatar_url: string
  company: string | null
}

export async function exchangeCodeForTokens(code: string, codeVerifier: string, state: string, storedState: string) {
  const config = getOAuthConfig()

  // Create a mock callback URL with the authorization code
  const callbackUrl = new URL(`${BASE_URL}/auth/callback`)
  callbackUrl.searchParams.set("code", code)
  callbackUrl.searchParams.set("state", state)

  const tokenSet = await authorizationCodeGrant(
    config,
    callbackUrl,
    { expectedState: storedState },
    { code_verifier: codeVerifier },
  )

  return tokenSet
}

export async function getUserInfo(accessToken: string): Promise<GitHubUser> {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "Divvun-Buildkite-Overview",
    },
  })

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
  }

  return await response.json()
}

export async function getUserOrganizations(accessToken: string): Promise<string[]> {
  const response = await fetch("https://api.github.com/user/orgs", {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "Divvun-Buildkite-Overview",
    },
  })

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
  }

  const orgs = await response.json()
  return orgs.map((org: any) => org.login)
}

export function hasRequiredOrgAccess(userOrgs: string[]): boolean {
  const requiredOrgs = ["divvun", "giellalt"]

  // Allow bypass for development if BYPASS_ORG_CHECK is set
  if (Deno.env.get("BYPASS_ORG_CHECK") === "true") {
    console.log("⚠️  Organization check bypassed for development")
    return true
  }

  const hasAccess = requiredOrgs.some((org) => userOrgs.includes(org))

  // Log for debugging
  console.log(
    `Organization check: User orgs: [${userOrgs.join(", ")}], Required: [${
      requiredOrgs.join(", ")
    }], Access: ${hasAccess}`,
  )

  return hasAccess
}
