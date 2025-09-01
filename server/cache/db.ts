if (typeof Deno === "undefined") {
  throw new Error("Config module can only be used on the server side")
}

import { Database } from "@db/sqlite"
import { expandGlobSync } from "@std/fs"
import { getDataDir } from "../config.ts"

// Cache schema version - increment this to force a fresh database
const CACHE_SCHEMA_VERSION = 2

// Type definitions for database query results
interface CountResult {
  count: number
}

interface DataJsonResult {
  data_json: string
}

interface IsPrivateResult {
  is_private: number
}

export class CacheDB {
  private db: Database

  constructor(path?: string) {
    const dataDir = getDataDir()
    const dbPath = path || `${dataDir}/cache-v${CACHE_SCHEMA_VERSION}.db`

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

    this.cleanupOldCacheFiles(dataDir)
    this.db = new Database(dbPath)
    this.initialize()
  }

  private cleanupOldCacheFiles(dataDir = ".") {
    try {
      // Find all cache-v*.db* files using glob in the data directory
      const globPattern = `${dataDir}/cache-v*.db*`
      for (const file of expandGlobSync(globPattern)) {
        const match = file.name.match(/^cache-v(\d+)\.db/)
        if (match) {
          const fileVersion = parseInt(match[1])
          if (fileVersion < CACHE_SCHEMA_VERSION) {
            console.log(`🗑️  Cleaning up old cache file: ${file.name}`)
            try {
              Deno.removeSync(file.path)
            } catch (error) {
              console.warn(`Failed to remove ${file.name}:`, error)
            }
          }
        }
      }
    } catch (error) {
      console.warn("Failed to cleanup old cache files:", error)
    }
  }

  // Retry wrapper for database operations that might fail due to locking
  private withRetry<T>(operation: () => T, maxRetries = 3): T {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return operation()
      } catch (error) {
        if (error instanceof Error && error.message.includes("database is locked") && attempt < maxRetries) {
          // Wait with exponential backoff before retrying
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
          console.warn(`Database locked, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`)

          // Use setTimeout for delay (convert to promise for async compatibility)
          const start = Date.now()
          while (Date.now() - start < delay) {
            // Busy wait for the delay
          }
          continue
        }
        throw error // Re-throw if not a lock error or max retries exceeded
      }
    }
    throw new Error("Max retries exceeded") // Should never reach here
  }

  private initialize() {
    // Enable WAL mode for better concurrency and reduce lock contention
    this.db.exec("PRAGMA journal_mode = WAL")
    this.db.exec("PRAGMA busy_timeout = 5000") // Wait up to 5 seconds for lock
    this.db.exec("PRAGMA synchronous = NORMAL") // Better performance with WAL

    // Create tables if they don't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cache_pipelines (
        slug TEXT PRIMARY KEY,
        org_slug TEXT NOT NULL,
        data_json TEXT NOT NULL,
        fetched_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS cache_github_repos (
        repo_path TEXT PRIMARY KEY,
        is_private INTEGER NOT NULL,
        checked_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS cache_builds (
        pipeline_slug TEXT NOT NULL,
        build_number INTEGER NOT NULL,
        data_json TEXT NOT NULL,
        fetched_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        PRIMARY KEY (pipeline_slug, build_number)
      );
      
      CREATE TABLE IF NOT EXISTS cache_jobs (
        pipeline_slug TEXT NOT NULL,
        build_number INTEGER NOT NULL,
        job_id TEXT NOT NULL,
        data_json TEXT NOT NULL,
        fetched_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        PRIMARY KEY (pipeline_slug, build_number, job_id)
      );
      
      CREATE TABLE IF NOT EXISTS cache_job_logs (
        pipeline_slug TEXT NOT NULL,
        build_number INTEGER NOT NULL,
        job_id TEXT NOT NULL,
        log_content TEXT NOT NULL,
        fetched_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        PRIMARY KEY (pipeline_slug, build_number, job_id)
      );
      
      CREATE TABLE IF NOT EXISTS cache_agents (
        org_slug TEXT PRIMARY KEY,
        data_json TEXT NOT NULL,
        fetched_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS api_calls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        response_time_ms INTEGER,
        status_code INTEGER
      );
      
      -- Create indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_pipelines_expires ON cache_pipelines(expires_at);
      CREATE INDEX IF NOT EXISTS idx_pipelines_org ON cache_pipelines(org_slug);
      CREATE INDEX IF NOT EXISTS idx_github_expires ON cache_github_repos(expires_at);
      CREATE INDEX IF NOT EXISTS idx_builds_expires ON cache_builds(expires_at);
      CREATE INDEX IF NOT EXISTS idx_builds_pipeline ON cache_builds(pipeline_slug);
      CREATE INDEX IF NOT EXISTS idx_jobs_expires ON cache_jobs(expires_at);
      CREATE INDEX IF NOT EXISTS idx_jobs_build ON cache_jobs(pipeline_slug, build_number);
      CREATE INDEX IF NOT EXISTS idx_job_logs_expires ON cache_job_logs(expires_at);
      CREATE INDEX IF NOT EXISTS idx_job_logs_build ON cache_job_logs(pipeline_slug, build_number);
      CREATE INDEX IF NOT EXISTS idx_agents_expires ON cache_agents(expires_at);
      CREATE INDEX IF NOT EXISTS idx_api_calls_timestamp ON api_calls(timestamp);
      CREATE INDEX IF NOT EXISTS idx_api_calls_service ON api_calls(service);
    `)
  }

  // Pipeline cache operations
  cachePipeline(slug: string, orgSlug: string, data: any, ttlSeconds: number): void {
    const now = Date.now()
    this.db
      .prepare("INSERT OR REPLACE INTO cache_pipelines VALUES (?, ?, ?, ?, ?)")
      .run(slug, orgSlug, JSON.stringify(data), now, now + ttlSeconds * 1000)
  }

  getCachedPipelines(orgSlug?: string): any[] {
    const now = Date.now()
    let query = "SELECT data_json FROM cache_pipelines WHERE expires_at > ?"
    let params: (number | string)[] = [now]

    if (orgSlug) {
      query += " AND org_slug = ?"
      params.push(orgSlug)
    }

    return this.db.prepare(query).all(...params).map((row: any) => JSON.parse(row.data_json))
  }

  // GitHub repo cache operations
  cacheGitHubRepo(repoPath: string, isPrivate: boolean, ttlSeconds: number): void {
    const now = Date.now()
    this.db
      .prepare("INSERT OR REPLACE INTO cache_github_repos VALUES (?, ?, ?, ?)")
      .run(repoPath, isPrivate ? 1 : 0, now, now + ttlSeconds * 1000)
  }

  getCachedGitHubRepo(repoPath: string): { is_private: boolean } | null {
    const now = Date.now()
    const result = this.db
      .prepare("SELECT is_private FROM cache_github_repos WHERE repo_path = ? AND expires_at > ?")
      .get(repoPath, now) as IsPrivateResult | undefined

    return result ? { is_private: Boolean(result.is_private) } : null
  }

  // Agent cache operations
  cacheAgents(orgSlug: string, agents: any[], ttlSeconds: number): void {
    const now = Date.now()
    this.db
      .prepare("INSERT OR REPLACE INTO cache_agents VALUES (?, ?, ?, ?)")
      .run(orgSlug, JSON.stringify(agents), now, now + ttlSeconds * 1000)
  }

  getCachedAgents(orgSlug?: string): any[] {
    const now = Date.now()
    let query = "SELECT data_json FROM cache_agents WHERE expires_at > ?"
    let params: (number | string)[] = [now]

    if (orgSlug) {
      query += " AND org_slug = ?"
      params.push(orgSlug)
    }

    const results = this.db.prepare(query).all(...params)
    return results.flatMap((row: any) => JSON.parse(row.data_json))
  }

  // Build cache operations
  cacheBuild(pipelineSlug: string, buildNumber: number, data: any, ttlSeconds: number): void {
    const now = Date.now()
    this.db
      .prepare("INSERT OR REPLACE INTO cache_builds VALUES (?, ?, ?, ?, ?)")
      .run(pipelineSlug, buildNumber, JSON.stringify(data), now, now + ttlSeconds * 1000)
  }

  getCachedBuild(pipelineSlug: string, buildNumber: number): any | null {
    const now = Date.now()
    const result = this.db
      .prepare("SELECT data_json FROM cache_builds WHERE pipeline_slug = ? AND build_number = ? AND expires_at > ?")
      .get(pipelineSlug, buildNumber, now) as DataJsonResult | undefined

    return result ? JSON.parse(result.data_json) : null
  }

  getCachedBuilds(pipelineSlug: string, limit = 50): any[] {
    const now = Date.now()
    return this.db
      .prepare(
        "SELECT data_json FROM cache_builds WHERE pipeline_slug = ? AND expires_at > ? ORDER BY build_number DESC LIMIT ?",
      )
      .all(pipelineSlug, now, limit)
      .map((row: any) => JSON.parse(row.data_json))
  }

  // Job cache operations
  cacheJob(pipelineSlug: string, buildNumber: number, jobId: string, data: any, ttlSeconds: number): void {
    const now = Date.now()
    this.db
      .prepare("INSERT OR REPLACE INTO cache_jobs VALUES (?, ?, ?, ?, ?, ?)")
      .run(pipelineSlug, buildNumber, jobId, JSON.stringify(data), now, now + ttlSeconds * 1000)
  }

  getCachedJob(pipelineSlug: string, buildNumber: number, jobId: string): any | null {
    const now = Date.now()
    const result = this.db
      .prepare(
        "SELECT data_json FROM cache_jobs WHERE pipeline_slug = ? AND build_number = ? AND job_id = ? AND expires_at > ?",
      )
      .get(pipelineSlug, buildNumber, jobId, now) as DataJsonResult | undefined

    return result ? JSON.parse(result.data_json) : null
  }

  getCachedJobsForBuild(pipelineSlug: string, buildNumber: number): any[] {
    const now = Date.now()
    return this.db
      .prepare("SELECT data_json FROM cache_jobs WHERE pipeline_slug = ? AND build_number = ? AND expires_at > ?")
      .all(pipelineSlug, buildNumber, now)
      .map((row: any) => JSON.parse(row.data_json))
  }

  // Job log cache operations
  cacheJobLog(pipelineSlug: string, buildNumber: number, jobId: string, logContent: string, ttlSeconds: number): void {
    const now = Date.now()
    this.db
      .prepare("INSERT OR REPLACE INTO cache_job_logs VALUES (?, ?, ?, ?, ?, ?)")
      .run(pipelineSlug, buildNumber, jobId, logContent, now, now + ttlSeconds * 1000)
  }

  getCachedJobLog(pipelineSlug: string, buildNumber: number, jobId: string): string | null {
    const now = Date.now()
    const result = this.db
      .prepare(
        "SELECT log_content FROM cache_job_logs WHERE pipeline_slug = ? AND build_number = ? AND job_id = ? AND expires_at > ?",
      )
      .get(pipelineSlug, buildNumber, jobId, now) as { log_content: string } | undefined

    return result ? result.log_content : null
  }

  // API call logging
  logApiCall(service: string, endpoint: string, responseTimeMs: number, statusCode: number): void {
    this.db
      .prepare(
        "INSERT INTO api_calls (service, endpoint, timestamp, response_time_ms, status_code) VALUES (?, ?, ?, ?, ?)",
      )
      .run(service, endpoint, Date.now(), responseTimeMs, statusCode)
  }

  // Batch API call logging
  batchLogApiCalls(
    calls: Array<{ service: string; endpoint: string; responseTimeMs: number; statusCode: number }>,
  ): void {
    if (calls.length === 0) return

    this.withRetry(() => {
      const stmt = this.db.prepare(
        "INSERT INTO api_calls (service, endpoint, timestamp, response_time_ms, status_code) VALUES (?, ?, ?, ?, ?)",
      )

      const transaction = this.db.transaction(() => {
        for (const call of calls) {
          stmt.run(call.service, call.endpoint, Date.now(), call.responseTimeMs, call.statusCode)
        }
      })

      transaction()
    })
  }

  // Batch GitHub repo caching
  batchCacheGitHubRepos(repos: Array<{ repoPath: string; isPrivate: boolean; ttlSeconds: number }>): void {
    if (repos.length === 0) return

    this.withRetry(() => {
      const stmt = this.db.prepare("INSERT OR REPLACE INTO cache_github_repos VALUES (?, ?, ?, ?)")
      const now = Date.now()

      const transaction = this.db.transaction(() => {
        for (const repo of repos) {
          stmt.run(repo.repoPath, repo.isPrivate ? 1 : 0, now, now + repo.ttlSeconds * 1000)
        }
      })

      transaction()
    })
  }

  // Get rate limit stats
  getRateLimitStatus(): { buildkite: number; github: number } {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000

    const buildkiteResult = this.db
      .prepare("SELECT COUNT(*) as count FROM api_calls WHERE service = ? AND timestamp > ?")
      .get("buildkite", fiveMinutesAgo) as CountResult | undefined

    const githubResult = this.db
      .prepare("SELECT COUNT(*) as count FROM api_calls WHERE service = ? AND timestamp > ?")
      .get("github", fiveMinutesAgo) as CountResult | undefined

    return {
      buildkite: buildkiteResult?.count || 0,
      github: githubResult?.count || 0,
    }
  }

  // Cache statistics
  getStats(): {
    pipelines: number
    github_repos: number
    builds: number
    jobs: number
    job_logs: number
    agents: number
    api_calls_24h: number
  } {
    const now = Date.now()
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000

    const pipelines = this.db.prepare("SELECT COUNT(*) as count FROM cache_pipelines WHERE expires_at > ?").get(now) as
      | CountResult
      | undefined
    const githubRepos = this.db.prepare("SELECT COUNT(*) as count FROM cache_github_repos WHERE expires_at > ?").get(
      now,
    ) as CountResult | undefined
    const builds = this.db.prepare("SELECT COUNT(*) as count FROM cache_builds WHERE expires_at > ?").get(now) as
      | CountResult
      | undefined
    const jobs = this.db.prepare("SELECT COUNT(*) as count FROM cache_jobs WHERE expires_at > ?").get(now) as
      | CountResult
      | undefined
    const jobLogs = this.db.prepare("SELECT COUNT(*) as count FROM cache_job_logs WHERE expires_at > ?").get(now) as
      | CountResult
      | undefined
    const agents = this.db.prepare("SELECT COUNT(*) as count FROM cache_agents WHERE expires_at > ?").get(now) as
      | CountResult
      | undefined
    const apiCalls = this.db.prepare("SELECT COUNT(*) as count FROM api_calls WHERE timestamp > ?").get(
      twentyFourHoursAgo,
    ) as CountResult | undefined

    return {
      pipelines: pipelines?.count || 0,
      github_repos: githubRepos?.count || 0,
      builds: builds?.count || 0,
      jobs: jobs?.count || 0,
      job_logs: jobLogs?.count || 0,
      agents: agents?.count || 0,
      api_calls_24h: apiCalls?.count || 0,
    }
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now()
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000

    this.db.exec(`
      DELETE FROM cache_pipelines WHERE expires_at < ${now};
      DELETE FROM cache_github_repos WHERE expires_at < ${now};
      DELETE FROM cache_builds WHERE expires_at < ${now};
      DELETE FROM cache_jobs WHERE expires_at < ${now};
      DELETE FROM cache_job_logs WHERE expires_at < ${now};
      DELETE FROM cache_agents WHERE expires_at < ${now};
      DELETE FROM api_calls WHERE timestamp < ${twentyFourHoursAgo};
    `)

    // Vacuum to reclaim space
    this.db.exec("VACUUM;")
  }

  close(): void {
    this.db.close()
  }
}
