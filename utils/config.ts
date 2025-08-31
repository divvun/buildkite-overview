// Server-only configuration module
// This module should NEVER be imported by client-side code
// All configuration access is centralized here to prevent leakage

if (typeof Deno === "undefined") {
  throw new Error("Config module can only be used on the server side")
}

import { parse } from "@std/toml"

export interface AppConfig {
  // OAuth Configuration
  github: {
    clientId: string
    clientSecret: string
    appToken: string
  }

  // API Keys
  buildkite: {
    apiKey: string
    webhookToken: string
  }

  // App Configuration
  app: {
    baseUrl: string
    sessionSecret: string
    isProduction: boolean
    requireAuth: boolean
    bypassOrgCheck: boolean
  }
}

// Load and parse TOML configuration from environment variable
function loadConfigFromTOML(): AppConfig {
  const configToml = Deno.env.get("CONFIG_TOML")

  if (!configToml) {
    console.error("❌ Missing CONFIG_TOML environment variable")
    console.error("Please provide configuration as a TOML string in the CONFIG_TOML environment variable.")
    Deno.exit(1)
  }

  try {
    const parsed = parse(configToml) as Record<string, any>

    // Validate required structure
    if (!parsed.github?.client_id || !parsed.github?.client_secret || !parsed.github?.app_token) {
      throw new Error("Missing required github configuration fields")
    }

    if (!parsed.buildkite?.api_key || !parsed.buildkite?.webhook_token) {
      throw new Error("Missing required buildkite configuration fields")
    }

    return {
      github: {
        clientId: parsed.github.client_id,
        clientSecret: parsed.github.client_secret,
        appToken: parsed.github.app_token,
      },
      buildkite: {
        apiKey: parsed.buildkite.api_key,
        webhookToken: parsed.buildkite.webhook_token,
      },
      app: {
        baseUrl: parsed.app?.base_url || "http://localhost:8000",
        sessionSecret: parsed.app?.session_secret || generateSessionSecret(),
        isProduction: parsed.app?.is_production === true,
        requireAuth: parsed.app?.require_auth === true,
        bypassOrgCheck: parsed.app?.bypass_org_check === true,
      },
    }
  } catch (error) {
    console.error("❌ Failed to parse CONFIG_TOML:", error instanceof Error ? error.message : String(error))
    console.error("Please ensure CONFIG_TOML contains valid TOML configuration.")
    Deno.exit(1)
  }
}

// Generate session secret if not provided
function generateSessionSecret(): string {
  const randomSecret = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

  console.warn("⚠️  Using generated session secret (no session_secret in config)")
  console.warn("   Set session_secret in your TOML configuration for production")

  return randomSecret
}

// Initialize configuration
function createConfig(): AppConfig {
  return loadConfigFromTOML()
}

// Singleton configuration instance
let config: AppConfig | null = null

export function getConfig(): AppConfig {
  if (!config) {
    config = createConfig()
  }
  return config
}

// Utility functions for common config access
export function isProduction(): boolean {
  return getConfig().app.isProduction
}

export function getBaseUrl(): string {
  return getConfig().app.baseUrl
}

export function getSessionSecret(): string {
  return getConfig().app.sessionSecret
}

export function shouldRequireAuth(): boolean {
  return getConfig().app.requireAuth
}

export function shouldBypassOrgCheck(): boolean {
  return getConfig().app.bypassOrgCheck
}

// API key accessors (server-only)
export function getBuildkiteApiKey(): string {
  return getConfig().buildkite.apiKey
}

export function getBuildkiteWebhookToken(): string {
  return getConfig().buildkite.webhookToken
}

export function getGithubCredentials(): { clientId: string; clientSecret: string; appToken: string } {
  const config = getConfig()
  return {
    clientId: config.github.clientId,
    clientSecret: config.github.clientSecret,
    appToken: config.github.appToken,
  }
}
