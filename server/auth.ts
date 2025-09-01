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
import { BUILD_ADMIN_TEAMS, REQUIRED_ORGS } from "~/utils/rbac.ts"

import { getBaseUrl, getGithubCredentials, shouldBypassOrgCheck } from "./config.ts"

// Get OAuth configuration from secure config module
function getOAuthCredentials() {
  return getGithubCredentials()
}

function getAppBaseUrl(): string {
  return getBaseUrl()
}

// GitHub OAuth server metadata
const GITHUB_SERVER_METADATA: ServerMetadata = {
  issuer: "https://github.com",
  authorization_endpoint: "https://github.com/login/oauth/authorize",
  token_endpoint: "https://github.com/login/oauth/access_token",
  userinfo_endpoint: "https://api.github.com/user",
}

// GitHub OAuth client metadata - created dynamically
function getGitHubClientMetadata(): ClientMetadata {
  const credentials = getOAuthCredentials()
  const baseUrl = getAppBaseUrl()

  return {
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    redirect_uris: [`${baseUrl}/auth/callback`],
    response_types: ["code"],
  }
}

let config: Configuration | null = null

export function getOAuthConfig(): Configuration {
  if (!config) {
    const credentials = getOAuthCredentials()

    if (!credentials.clientId || !credentials.clientSecret) {
      throw new Error(
        "GitHub OAuth credentials not configured. Check your environment variables.",
      )
    }

    config = new Configuration(GITHUB_SERVER_METADATA, credentials.clientId, credentials.clientSecret)
  }
  return config
}

export async function generateAuthUrl(): Promise<{ url: string; state: string; codeVerifier: string }> {
  const codeVerifier = randomPKCECodeVerifier()
  const codeChallenge = await calculatePKCECodeChallenge(codeVerifier)
  const state = randomState()
  const credentials = getOAuthCredentials()
  const baseUrl = getAppBaseUrl()

  const authUrl = new URL("https://github.com/login/oauth/authorize")
  authUrl.searchParams.set("client_id", credentials.clientId)
  authUrl.searchParams.set("redirect_uri", `${baseUrl}/auth/callback`)
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
  const baseUrl = getAppBaseUrl()

  // Create a mock callback URL with the authorization code
  const callbackUrl = new URL(`${baseUrl}/auth/callback`)
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

export async function getUserDataWithGraphQL(accessToken: string): Promise<{
  user: GitHubUser
  organizations: string[]
  isBuildAdmin: boolean
}> {
  const query = `
    query GetUserData {
      viewer {
        id: databaseId
        login
        name
        email
        avatarUrl
        # Get ALL user's organizations
        organizations(first: 100) {
          nodes {
            login
          }
        }
      }
      # Check if user is member of specific orgs we care about
      divvun: organization(login: "divvun") {
        viewerIsAMember
        # Check if user is in Build Admins team
        # If this returns non-null, user is a member
        team(slug: "build-admins") {
          slug
        }
      }
      giellalt: organization(login: "giellalt") {
        viewerIsAMember
      }
    }
  `

  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "User-Agent": "Divvun-Buildkite-Overview",
    },
    body: JSON.stringify({ query }),
  })

  if (!response.ok) {
    throw new Error(`GraphQL API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()

  if (data.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`)
  }

  const user = {
    id: data.data.viewer.id,
    login: data.data.viewer.login,
    name: data.data.viewer.name,
    email: data.data.viewer.email,
    avatar_url: data.data.viewer.avatarUrl,
    company: null,
  }

  // Get all organizations
  const organizations = data.data.viewer.organizations.nodes.map((org: any) => org.login)

  // Check if user is in Build Admins team
  // If team is not null, user is a member (otherwise team would be null)
  const isBuildAdmin = !!data.data.divvun?.team

  console.log(`GraphQL query returned: orgs [${organizations.join(", ")}], buildAdmin: ${isBuildAdmin}`)
  return { user, organizations, isBuildAdmin }
}

export function hasRequiredOrgAccess(userOrgs: string[]): boolean {
  const hasAccess = REQUIRED_ORGS.some((org) => userOrgs.includes(org))

  // Log for debugging
  console.log(
    `Organization check: User orgs: [${userOrgs.join(", ")}], Required: [${
      REQUIRED_ORGS.join(", ")
    }], Access: ${hasAccess}`,
  )

  return hasAccess
}
