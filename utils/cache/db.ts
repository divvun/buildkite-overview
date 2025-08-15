import { Database } from "@db/sqlite"

export class CacheDB {
  private db: Database

  constructor(path = "./cache.db") {
    this.db = new Database(path)
    this.initialize()
  }

  private initialize() {
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
    let params = [now]

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
      .get(repoPath, now)

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
    let params = [now]

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
      .get(pipelineSlug, buildNumber, now)

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

  // API call logging
  logApiCall(service: string, endpoint: string, responseTimeMs: number, statusCode: number): void {
    this.db
      .prepare(
        "INSERT INTO api_calls (service, endpoint, timestamp, response_time_ms, status_code) VALUES (?, ?, ?, ?, ?)",
      )
      .run(service, endpoint, Date.now(), responseTimeMs, statusCode)
  }

  // Get rate limit stats
  getRateLimitStatus(): { buildkite: number; github: number } {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000

    const buildkiteResult = this.db
      .prepare("SELECT COUNT(*) as count FROM api_calls WHERE service = ? AND timestamp > ?")
      .get("buildkite", fiveMinutesAgo)

    const githubResult = this.db
      .prepare("SELECT COUNT(*) as count FROM api_calls WHERE service = ? AND timestamp > ?")
      .get("github", fiveMinutesAgo)

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
    agents: number
    api_calls_24h: number
  } {
    const now = Date.now()
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000

    const pipelines = this.db.prepare("SELECT COUNT(*) as count FROM cache_pipelines WHERE expires_at > ?").get(now)
    const githubRepos = this.db.prepare("SELECT COUNT(*) as count FROM cache_github_repos WHERE expires_at > ?").get(
      now,
    )
    const builds = this.db.prepare("SELECT COUNT(*) as count FROM cache_builds WHERE expires_at > ?").get(now)
    const agents = this.db.prepare("SELECT COUNT(*) as count FROM cache_agents WHERE expires_at > ?").get(now)
    const apiCalls = this.db.prepare("SELECT COUNT(*) as count FROM api_calls WHERE timestamp > ?").get(
      twentyFourHoursAgo,
    )

    return {
      pipelines: pipelines?.count || 0,
      github_repos: githubRepos?.count || 0,
      builds: builds?.count || 0,
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
