// Secure token storage separate from session data
// Access tokens should never be stored in cookies or session storage

import { Database } from "@db/sqlite"
import { expandGlobSync } from "@std/fs"
import { decryptData, encryptData } from "~/server/crypto.ts"
import { getConfig } from "~/server/config.ts"

// Token schema version - increment this to force a fresh database
const TOKEN_SCHEMA_VERSION = 1

// Helper to extract changes from SQLite result
function getChanges(result: unknown): number {
  return typeof result === "object" && result && "changes" in result ? (result as any).changes : 0
}

interface StoredToken {
  user_id: number
  encrypted_token: string
  token_type: "github_access" | "github_refresh"
  expires_at: number
  created_at: number
  last_used: number
}

let tokenDb: Database | null = null

// Clean up old token database files
function cleanupOldTokenFiles(dataDir = ".") {
  try {
    // Find all tokens-*-v*.db* files using glob in the data directory
    const globPattern = `${dataDir}/tokens-*-v*.db*`
    for (const file of expandGlobSync(globPattern)) {
      const match = file.name.match(/^tokens-.*-v(\d+)\.db/)
      if (match) {
        const fileVersion = parseInt(match[1])
        if (fileVersion < TOKEN_SCHEMA_VERSION) {
          console.log(`🗑️  Cleaning up old token file: ${file.name}`)
          try {
            Deno.removeSync(file.path)
          } catch (error) {
            console.warn(`Failed to remove ${file.name}:`, error)
          }
        }
      }
    }
  } catch (error) {
    console.warn("Failed to cleanup old token files:", error)
  }
}

function getTokenDatabase(): Database {
  if (!tokenDb) {
    const config = getConfig()
    const dataDir = config.app.dataDir
    const env = config.app.isProduction ? "" : "dev-"
    const dbPath = `${dataDir}/tokens-${env}v${TOKEN_SCHEMA_VERSION}.db`

    // Ensure directory exists
    const dir = dbPath.substring(0, dbPath.lastIndexOf("/"))
    if (dir && dir !== ".") {
      try {
        Deno.mkdirSync(dir, { recursive: true })
      } catch (err) {
        if (!(err instanceof Deno.errors.AlreadyExists)) {
          throw err
        }
      }
    }

    // Clean up old token database versions
    cleanupOldTokenFiles(dataDir)

    tokenDb = new Database(dbPath)

    // Create tokens table
    tokenDb.exec(`
      CREATE TABLE IF NOT EXISTS tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        encrypted_token TEXT NOT NULL,
        token_type TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        last_used INTEGER NOT NULL
      )
    `)

    // Create indexes
    tokenDb.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_tokens_user_type ON tokens(user_id, token_type)
    `)

    tokenDb.exec(`
      CREATE INDEX IF NOT EXISTS idx_tokens_expires_at ON tokens(expires_at)
    `)

    console.log("✅ Token database initialized")
  }

  return tokenDb
}

// Store an access token securely
export async function storeAccessToken(userId: number, token: string, expiresAt?: number): Promise<void> {
  const db = getTokenDatabase()
  const encryptedToken = await encryptData(token)
  const now = Date.now()
  const tokenExpiresAt = expiresAt || (now + (24 * 60 * 60 * 1000)) // Default 24 hours

  // Use REPLACE to update existing token for this user
  db.prepare(`
    INSERT OR REPLACE INTO tokens (
      user_id, encrypted_token, token_type, expires_at, created_at, last_used
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    encryptedToken,
    "github_access",
    tokenExpiresAt,
    now,
    now,
  )
}

// Retrieve an access token
export async function getAccessToken(userId: number): Promise<string | null> {
  const db = getTokenDatabase()
  const now = Date.now()

  const row = db.prepare(`
    SELECT encrypted_token, expires_at FROM tokens 
    WHERE user_id = ? AND token_type = 'github_access' AND expires_at > ?
  `).get(userId, now) as { encrypted_token: string; expires_at: number } | undefined

  if (!row) {
    return null
  }

  const decryptedToken = await decryptData(row.encrypted_token)
  if (!decryptedToken) {
    // If decryption fails, remove the invalid token
    await deleteAccessToken(userId)
    return null
  }

  // Update last used time
  db.prepare(`
    UPDATE tokens 
    SET last_used = ? 
    WHERE user_id = ? AND token_type = 'github_access'
  `).run(now, userId)

  return decryptedToken
}

// Delete an access token
export async function deleteAccessToken(userId: number): Promise<boolean> {
  const db = getTokenDatabase()

  const result = db.prepare(`
    DELETE FROM tokens 
    WHERE user_id = ? AND token_type = 'github_access'
  `).run(userId)

  return getChanges(result) > 0
}

// Delete all tokens for a user
export async function deleteUserTokens(userId: number): Promise<number> {
  const db = getTokenDatabase()

  const result = db.prepare(`
    DELETE FROM tokens 
    WHERE user_id = ?
  `).run(userId)

  return getChanges(result)
}

// Clean up expired tokens
export function cleanupExpiredTokens(): void {
  const db = getTokenDatabase()
  const now = Date.now()

  const result = db.prepare(`
    DELETE FROM tokens 
    WHERE expires_at < ?
  `).run(now)
  const changes = getChanges(result)

  if (changes > 0) {
    console.log(`🧹 Cleaned up ${changes} expired tokens`)
  }
}

// Token cleanup scheduler
let tokenCleanupInterval: number | null = null

export function startTokenCleanup(): void {
  if (tokenCleanupInterval !== null) {
    return // Already started
  }

  // Clean up expired tokens every hour
  tokenCleanupInterval = setInterval(() => {
    cleanupExpiredTokens()
  }, 60 * 60 * 1000)

  // Initial cleanup
  cleanupExpiredTokens()

  console.log("🚀 Token cleanup scheduler started")
}

export function stopTokenCleanup(): void {
  if (tokenCleanupInterval !== null) {
    clearInterval(tokenCleanupInterval)
    tokenCleanupInterval = null
    console.log("🛑 Token cleanup scheduler stopped")
  }
}
