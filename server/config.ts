// Server-only configuration module
// This module should NEVER be imported by client-side code
// All configuration access is centralized here to prevent leakage

console.log("🔧 Loading configuration...")

if (typeof Deno === "undefined") {
  throw new Error("Config module can only be used on the server side")
}

import { existsSync } from "@std/fs"
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
    dataDir: string
  }

  // Background Polling Configuration
  polling: {
    enabled: boolean
    pipelineIntervalMs: number
    agentIntervalMs: number
  }
}

// Interface for parsed TOML structure
interface ParsedTomlConfig {
  github?: {
    client_id?: string
    client_secret?: string
    app_token?: string
  }
  buildkite?: {
    api_key?: string
    webhook_token?: string
  }
  app?: {
    base_url?: string
    session_secret?: string
    is_production?: boolean
    require_auth?: boolean
    bypass_org_check?: boolean
    data_dir?: string
  }
  polling?: {
    enabled?: boolean
    pipeline_interval_ms?: number
    agent_interval_ms?: number
  }
}

// Load and parse TOML configuration from file or environment variable
function loadConfigFromTOML(configPath?: string): AppConfig {
  let configToml: string

  if (configPath) {
    // Load from specified file path
    if (!existsSync(configPath)) {
      console.error(`❌ Config file not found: ${configPath}`)
      Deno.exit(1)
    }

    try {
      configToml = Deno.readTextFileSync(configPath)
    } catch (error) {
      console.error(`❌ Failed to read config file: ${configPath}`)
      console.error(error instanceof Error ? error.message : String(error))
      Deno.exit(1)
    }
  } else {
    // Try CONFIG_TOML environment variable first
    configToml = Deno.env.get("CONFIG_TOML") ?? ""

    // If no CONFIG_TOML, try default config.toml file
    if (!configToml) {
      const defaultConfigPath = "config.toml"
      if (existsSync(defaultConfigPath)) {
        try {
          configToml = Deno.readTextFileSync(defaultConfigPath)
          console.log(`✅ Loaded config from ${defaultConfigPath}`)
        } catch (error) {
          console.error(`❌ Failed to read default config file: ${defaultConfigPath}`)
          console.error(error instanceof Error ? error.message : String(error))
          Deno.exit(1)
        }
      } else {
        console.error("❌ No configuration found")
        console.error("Please provide configuration via:")
        console.error("  1. -c/--config flag with config file path")
        console.error("  2. CONFIG_TOML environment variable")
        console.error("  3. config.toml file in current directory")
        Deno.exit(1)
      }
    }
  }

  try {
    const parsed = parse(configToml) as ParsedTomlConfig

    // Validate required structure
    if (!parsed.github?.client_id || !parsed.github?.client_secret || !parsed.github?.app_token) {
      throw new Error("Missing required github configuration fields")
    }

    if (!parsed.buildkite?.api_key || !parsed.buildkite?.webhook_token) {
      throw new Error("Missing required buildkite configuration fields")
    }

    if (!parsed.app?.session_secret) {
      throw new Error("Missing required app.session_secret in configuration. Generate one with: openssl rand -hex 32")
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
        sessionSecret: parsed.app.session_secret,
        isProduction: parsed.app?.is_production === true,
        requireAuth: parsed.app?.require_auth === true,
        bypassOrgCheck: parsed.app?.bypass_org_check === true,
        dataDir: parsed.app?.data_dir || ".",
      },
      polling: {
        enabled: parsed.polling?.enabled !== false, // Default to true
        pipelineIntervalMs: Math.max(parsed.polling?.pipeline_interval_ms || 120000, 30000), // 2 minutes default, min 30s
        agentIntervalMs: Math.max(parsed.polling?.agent_interval_ms || 300000, 30000), // 5 minutes default, min 30s
      },
    }
  } catch (error) {
    console.error("❌ Failed to parse CONFIG_TOML:", error instanceof Error ? error.message : String(error))
    console.error("Please ensure CONFIG_TOML contains valid TOML configuration.")
    Deno.exit(1)
  }
}

// Initialize configuration
function createConfig(configPath?: string): AppConfig {
  return loadConfigFromTOML(configPath)
}

// Singleton configuration instance
let config: AppConfig | null = null

export function getConfig(configPath?: string): AppConfig {
  if (!config) {
    config = createConfig(configPath)
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

// App configuration accessors
export function getDataDir(): string {
  return getConfig().app.dataDir
}

// Polling configuration accessors
export function getPollingConfig(): { enabled: boolean; pipelineIntervalMs: number; agentIntervalMs: number } {
  return getConfig().polling
}
