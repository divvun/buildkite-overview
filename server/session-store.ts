// Secure server-side session storage
// This module handles session storage separately from user-facing cookies

import { Database } from "@db/sqlite"
import { expandGlobSync } from "@std/fs"
import type { SessionData } from "~/types/session.ts"
import { decryptData, encryptData, generateCSRFToken } from "~/server/crypto.ts"
import { getConfig } from "~/server/config.ts"

// Session schema version - increment this to force a fresh database
const SESSION_SCHEMA_VERSION = 1

// Helper to extract changes from SQLite result
function getChanges(result: unknown): number {
  return typeof result === "object" && result && "changes" in result ? (result as any).changes : 0
}

interface StoredSession {
  session_id: string
  encrypted_data: string
  user_id: number
  csrf_token: string
  expires_at: number
  created_at: number
  last_accessed: number
}

interface SessionWithTokens extends SessionData {
  sessionId: string
  csrfToken: string
}

// Database connection for session storage
let sessionDb: Database | null = null

// Clean up old session database files
function cleanupOldSessionFiles(dataDir = ".") {
  try {
    // Find all sessions-*-v*.db* files using glob in the data directory
    const globPattern = `${dataDir}/sessions-*-v*.db*`
    for (const file of expandGlobSync(globPattern)) {
      const match = file.name.match(/^sessions-.*-v(\d+)\.db/)
      if (match) {
        const fileVersion = parseInt(match[1])
        if (fileVersion < SESSION_SCHEMA_VERSION) {
          console.log(`🗑️  Cleaning up old session file: ${file.name}`)
          try {
            Deno.removeSync(file.path)
          } catch (error) {
            console.warn(`Failed to remove ${file.name}:`, error)
          }
        }
      }
    }
  } catch (error) {
    console.warn("Failed to cleanup old session files:", error)
  }
}

function getSessionDatabase(): Database {
  if (!sessionDb) {
    const config = getConfig()
    const dataDir = config.app.dataDir
    const env = config.app.isProduction ? "" : "dev-"
    const dbPath = `${dataDir}/sessions-${env}v${SESSION_SCHEMA_VERSION}.db`

    console.log(`Initializing session database at: ${dbPath}`)
    console.log(`Production mode: ${config.app.isProduction}`)
    console.log(`Data directory: ${dataDir}`)

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

    // Clean up old session database versions
    cleanupOldSessionFiles(dataDir)

    sessionDb = new Database(dbPath)

    // Create sessions table
    sessionDb.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        encrypted_data TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        csrf_token TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        last_accessed INTEGER NOT NULL
      )
    `)

    // Create index on user_id for efficient lookups
    sessionDb.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)
    `)

    // Create index on expires_at for efficient cleanup
    sessionDb.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)
    `)

    console.log("✅ Session database initialized")
  }

  return sessionDb
}

// Generate a cryptographically secure session ID
function generateSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

// Clean up expired sessions (called periodically)
export function cleanupExpiredSessions(): void {
  const db = getSessionDatabase()
  const now = Date.now()

  const result = db.prepare(`
    DELETE FROM sessions 
    WHERE expires_at < ?
  `).run(now)
  const changes = getChanges(result)

  if (changes > 0) {
    console.log(`🧹 Cleaned up ${changes} expired sessions`)
  }
}

// Store a new session
export async function createSession(sessionData: SessionData): Promise<SessionWithTokens> {
  const db = getSessionDatabase()
  const sessionId = generateSessionId()
  const csrfToken = generateCSRFToken()
  const now = Date.now()

  console.log(`Creating session ${sessionId} for user ${sessionData.user.login} (ID: ${sessionData.user.id})`)
  console.log(`Session expires at: ${new Date(sessionData.expires_at)}`)

  // Remove access token from session data before encryption
  // We'll store it separately and securely
  const sessionForStorage = {
    ...sessionData,
    // Don't store access_token in the session - we'll handle it separately
    access_token: undefined,
  }

  const encryptedData = await encryptData(JSON.stringify(sessionForStorage))

  try {
    db.prepare(`
      INSERT INTO sessions (
        session_id, encrypted_data, user_id, csrf_token, 
        expires_at, created_at, last_accessed
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      encryptedData,
      sessionData.user.id,
      csrfToken,
      sessionData.expires_at,
      now,
      now,
    )

    console.log(`✅ Session ${sessionId} successfully inserted into database`)
  } catch (error) {
    console.error(`❌ Failed to insert session ${sessionId}:`, error)
    throw error
  }

  return {
    ...sessionData,
    sessionId,
    csrfToken,
  }
}

// Retrieve a session by ID
export async function getSession(sessionId: string): Promise<SessionWithTokens | null> {
  if (!sessionId || typeof sessionId !== "string") {
    console.log("Invalid session ID provided to getSession")
    return null
  }

  const db = getSessionDatabase()
  const now = Date.now()

  console.log(`Looking up session ${sessionId} at ${new Date(now)}`)

  const row = db.prepare(`
    SELECT * FROM sessions 
    WHERE session_id = ? AND expires_at > ?
  `).get(sessionId, now) as StoredSession | undefined

  if (!row) {
    // Check if session exists but is expired
    const expiredRow = db.prepare(`
      SELECT expires_at, user_id FROM sessions WHERE session_id = ?
    `).get(sessionId) as { expires_at: number; user_id: number } | undefined

    if (expiredRow) {
      console.log(
        `❌ Session ${sessionId} exists but expired at ${new Date(
          expiredRow.expires_at,
        )} (user ID: ${expiredRow.user_id})`,
      )
    } else {
      console.log(`❌ Session ${sessionId} not found in database at all`)
    }
    return null
  }

  console.log(`✅ Session ${sessionId} found for user ID ${row.user_id}, expires at ${new Date(row.expires_at)}`)

  // Decrypt session data
  const decryptedData = await decryptData(row.encrypted_data)
  if (!decryptedData) {
    // If decryption fails, remove the invalid session
    await deleteSession(sessionId)
    return null
  }

  let sessionData: SessionData
  try {
    sessionData = JSON.parse(decryptedData)
  } catch (error) {
    console.warn("Failed to parse session data:", error)
    await deleteSession(sessionId)
    return null
  }

  // Update last accessed time
  db.prepare(`
    UPDATE sessions 
    SET last_accessed = ? 
    WHERE session_id = ?
  `).run(now, sessionId)

  return {
    ...sessionData,
    sessionId,
    csrfToken: row.csrf_token,
  }
}

// Update an existing session
export async function updateSession(sessionId: string, sessionData: SessionData): Promise<boolean> {
  const db = getSessionDatabase()

  const sessionForStorage = {
    ...sessionData,
    access_token: undefined, // Don't store access token
  }

  const encryptedData = await encryptData(JSON.stringify(sessionForStorage))

  const result = db.prepare(`
    UPDATE sessions 
    SET encrypted_data = ?, expires_at = ?, last_accessed = ?
    WHERE session_id = ?
  `).run(
    encryptedData,
    sessionData.expires_at,
    Date.now(),
    sessionId,
  )

  return getChanges(result) > 0
}

// Delete a session
export async function deleteSession(sessionId: string): Promise<boolean> {
  const db = getSessionDatabase()

  const result = db.prepare(`
    DELETE FROM sessions 
    WHERE session_id = ?
  `).run(sessionId)

  return getChanges(result) > 0
}

// Delete all sessions for a user (useful for logout everywhere)
export async function deleteUserSessions(userId: number): Promise<number> {
  const db = getSessionDatabase()

  const result = db.prepare(`
    DELETE FROM sessions 
    WHERE user_id = ?
  `).run(userId)

  return getChanges(result)
}

// Verify CSRF token for a session
export function verifyCSRFToken(sessionId: string, providedToken: string): boolean {
  if (!sessionId || !providedToken) {
    return false
  }

  const db = getSessionDatabase()

  const row = db.prepare(`
    SELECT csrf_token FROM sessions 
    WHERE session_id = ?
  `).get(sessionId) as { csrf_token: string } | undefined

  if (!row) {
    return false
  }

  // Use constant-time comparison to prevent timing attacks
  return constantTimeCompare(row.csrf_token, providedToken)
}

// Get session statistics (for monitoring)
export function getSessionStats(): { total: number; expired: number; active: number } {
  const db = getSessionDatabase()
  const now = Date.now()

  const total = db.prepare(`SELECT COUNT(*) as count FROM sessions`).get() as { count: number }
  const expired = db.prepare(`SELECT COUNT(*) as count FROM sessions WHERE expires_at < ?`).get(now) as {
    count: number
  }

  return {
    total: total.count,
    expired: expired.count,
    active: total.count - expired.count,
  }
}

// Constant-time string comparison helper (re-export from crypto module)
import { constantTimeCompare } from "~/server/crypto.ts"

// Initialize cleanup scheduler
let cleanupInterval: number | null = null

export function startSessionCleanup(): void {
  if (cleanupInterval !== null) {
    return // Already started
  }

  // Clean up expired sessions every 30 minutes
  cleanupInterval = setInterval(() => {
    cleanupExpiredSessions()
  }, 30 * 60 * 1000)

  // Initial cleanup
  cleanupExpiredSessions()

  console.log("🚀 Session cleanup scheduler started")
}

export function stopSessionCleanup(): void {
  if (cleanupInterval !== null) {
    clearInterval(cleanupInterval)
    cleanupInterval = null
    console.log("🛑 Session cleanup scheduler stopped")
  }
}
