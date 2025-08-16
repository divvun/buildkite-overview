import { CacheDB } from "./db.ts"
import { buildkiteClient, GET_ORGANIZATION_AGENTS, GET_ORGANIZATION_PIPELINES_PAGINATED } from "../buildkite-client.ts"
import { withRetry } from "../retry-helper.ts"
import { ORGANIZATIONS } from "../formatters.ts"
import type { AppAgent, AppPipeline } from "../buildkite-data.ts"

interface MemoryCacheItem<T> {
  data: T
  expires: number
}

export class CacheManager {
  private db: CacheDB
  private memoryCache: Map<string, MemoryCacheItem<any>> = new Map()

  constructor() {
    this.db = new CacheDB()
    this.setupPeriodicCleanup()
  }

  private setupPeriodicCleanup(): void {
    // Clean up expired entries every hour
    setInterval(() => {
      this.db.cleanup()
      this.cleanupMemoryCache()
    }, 60 * 60 * 1000)
  }

  private cleanupMemoryCache(): void {
    const now = Date.now()
    for (const [key, item] of this.memoryCache.entries()) {
      if (item.expires < now) {
        this.memoryCache.delete(key)
      }
    }
  }

  private getFromMemory<T>(key: string): T | null {
    const item = this.memoryCache.get(key)
    if (!item) return null

    if (Date.now() > item.expires) {
      this.memoryCache.delete(key)
      return null
    }

    return item.data
  }

  private setInMemory<T>(key: string, data: T, ttlSeconds: number): void {
    this.memoryCache.set(key, {
      data,
      expires: Date.now() + ttlSeconds * 1000,
    })
  }

  // Get pipelines with multi-level caching
  async getPipelines(): Promise<AppPipeline[]> {
    // L1: Memory cache (1 minute)
    const memCached = this.getFromMemory<AppPipeline[]>("all-pipelines")
    if (memCached) {
      console.log("Cache hit: memory (all-pipelines)")
      return memCached
    }

    // L2: SQLite cache (check each org)
    const cachedPipelines: AppPipeline[] = []
    const orgsToFetch: string[] = []

    for (const orgSlug of ORGANIZATIONS) {
      const orgPipelines = this.db.getCachedPipelines(orgSlug)
      if (orgPipelines.length > 0) {
        console.log(`Cache hit: database (${orgSlug}, ${orgPipelines.length} pipelines)`)
        cachedPipelines.push(...orgPipelines)
      } else {
        orgsToFetch.push(orgSlug)
      }
    }

    // L3: Fetch missing orgs from Buildkite
    if (orgsToFetch.length > 0) {
      console.log(`Fetching fresh data for orgs: ${orgsToFetch.join(", ")}`)
      const freshPipelines = await this.fetchPipelinesFromBuildkite(orgsToFetch)
      cachedPipelines.push(...freshPipelines)
    }

    // Enrich with GitHub data
    const enrichedPipelines = await this.enrichPipelinesWithGitHub(cachedPipelines)

    // Cache in memory
    this.setInMemory("all-pipelines", enrichedPipelines, 60) // 1 minute

    return enrichedPipelines
  }

  private async fetchPipelinesFromBuildkite(orgSlugs: string[]): Promise<AppPipeline[]> {
    const allPipelines: AppPipeline[] = []

    for (const orgSlug of orgSlugs) {
      console.log(`Fetching all pipelines for organization: ${orgSlug}`)

      let hasNextPage = true
      let cursor: string | null = null
      const allOrgPipelines: AppPipeline[] = []
      let pageCount = 0

      while (hasNextPage) {
        const startTime = Date.now()
        pageCount++

        try {
          console.log(
            `Fetching page ${pageCount} for ${orgSlug}${
              cursor ? ` (after cursor: ${cursor.substring(0, 10)}...)` : ""
            }`,
          )

          const result = await withRetry(
            async () =>
              await buildkiteClient.query(GET_ORGANIZATION_PIPELINES_PAGINATED, {
                slug: orgSlug,
                first: 100,
                after: cursor,
              }).toPromise(),
            { maxRetries: 2, initialDelay: 5000 },
          ) as any

          const responseTime = Date.now() - startTime

          if (result.error) {
            console.error(`Error fetching pipelines page ${pageCount} for ${orgSlug}:`, result.error)
            this.db.logApiCall("buildkite", `pipelines/${orgSlug}/page-${pageCount}`, responseTime, 500)
            break
          }

          if (result.data?.organization?.pipelines) {
            const pageData = result.data.organization.pipelines
            const pipelines = pageData.edges.map((edge: any) => this.mapBuildkitePipelineToApp(edge.node))

            allOrgPipelines.push(...pipelines)
            console.log(`Fetched ${pipelines.length} pipelines from ${orgSlug} page ${pageCount}`)

            // Update pagination info
            hasNextPage = pageData.pageInfo.hasNextPage
            cursor = pageData.pageInfo.endCursor

            this.db.logApiCall("buildkite", `pipelines/${orgSlug}/page-${pageCount}`, responseTime, 200)
          } else {
            hasNextPage = false
          }
        } catch (error) {
          console.error(`Failed to fetch pipelines page ${pageCount} for ${orgSlug}:`, error)
          this.db.logApiCall("buildkite", `pipelines/${orgSlug}/page-${pageCount}`, Date.now() - startTime, 500)
          hasNextPage = false
        }
      }

      // Cache all pipelines from this org with 15-minute TTL
      for (const pipeline of allOrgPipelines) {
        this.db.cachePipeline(pipeline.slug, orgSlug, pipeline, 15 * 60) // 15 minutes
      }

      allPipelines.push(...allOrgPipelines)
      console.log(`✅ Fetched ${allOrgPipelines.length} total pipelines from ${orgSlug} across ${pageCount} pages`)
    }

    return allPipelines
  }

  private async enrichPipelinesWithGitHub(pipelines: AppPipeline[]): Promise<AppPipeline[]> {
    const githubToken = Deno.env.get("GITHUB_APP_TOKEN")
    if (!githubToken) {
      console.warn("GITHUB_APP_TOKEN not configured, skipping GitHub enrichment")
      return pipelines
    }

    console.log(`Enriching ${pipelines.length} pipelines with GitHub data`)

    for (const pipeline of pipelines) {
      if (!pipeline.repo) continue

      // Check cache first
      const cached = this.db.getCachedGitHubRepo(pipeline.repo)
      if (cached) {
        pipeline.visibility = cached.is_private ? "private" : "public"
        if (cached.is_private && !pipeline.tags.includes("private")) {
          pipeline.tags.push("private")
        }
        continue
      }

      // Fetch from GitHub API
      const startTime = Date.now()
      try {
        const [owner, repoName] = pipeline.repo.split("/")
        const response = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, {
          headers: {
            "Authorization": `Bearer ${githubToken}`,
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "Divvun-Buildkite-Overview",
          },
        })

        const responseTime = Date.now() - startTime
        let isPrivate = true // Default to private

        if (response.ok) {
          const data = await response.json()
          isPrivate = data.private
          this.db.logApiCall("github", `repos/${pipeline.repo}`, responseTime, 200)
        } else if (response.status === 404) {
          // Can't see it with app token, so it's private
          isPrivate = true
          this.db.logApiCall("github", `repos/${pipeline.repo}`, responseTime, 404)
        } else {
          console.warn(`GitHub API error for ${pipeline.repo}: ${response.status}`)
          this.db.logApiCall("github", `repos/${pipeline.repo}`, responseTime, response.status)
        }

        // Update pipeline
        pipeline.visibility = isPrivate ? "private" : "public"
        if (isPrivate && !pipeline.tags.includes("private")) {
          pipeline.tags.push("private")
        }

        // Cache result for 30 minutes
        this.db.cacheGitHubRepo(pipeline.repo, isPrivate, 30 * 60)
      } catch (error) {
        console.error(`Failed to check GitHub repo ${pipeline.repo}:`, error)
        this.db.logApiCall("github", `repos/${pipeline.repo}`, Date.now() - startTime, 500)
        // Default to private on error
        pipeline.visibility = "private"
      }
    }

    return pipelines
  }

  // Get agents with caching
  async getAgents(): Promise<AppAgent[]> {
    // L1: Memory cache (1 minute)
    const memCached = this.getFromMemory<AppAgent[]>("all-agents")
    if (memCached) {
      console.log("Cache hit: memory (all-agents)")
      return memCached
    }

    // L2: SQLite cache
    const cachedAgents: AppAgent[] = []
    const orgsToFetch: string[] = []

    for (const orgSlug of ORGANIZATIONS) {
      const orgAgents = this.db.getCachedAgents(orgSlug)
      if (orgAgents.length > 0) {
        console.log(`Cache hit: database (agents for ${orgSlug})`)
        cachedAgents.push(...orgAgents)
      } else {
        orgsToFetch.push(orgSlug)
      }
    }

    // L3: Fetch missing orgs from Buildkite
    if (orgsToFetch.length > 0) {
      console.log(`Fetching fresh agent data for orgs: ${orgsToFetch.join(", ")}`)
      const freshAgents = await this.fetchAgentsFromBuildkite(orgsToFetch)
      cachedAgents.push(...freshAgents)
    }

    // Cache in memory
    this.setInMemory("all-agents", cachedAgents, 60) // 1 minute

    return cachedAgents
  }

  private async fetchAgentsFromBuildkite(orgSlugs: string[]): Promise<AppAgent[]> {
    const allAgents: AppAgent[] = []

    for (const orgSlug of orgSlugs) {
      const startTime = Date.now()

      try {
        console.log(`Fetching agents for organization: ${orgSlug}`)

        const result = await withRetry(
          async () => await buildkiteClient.query(GET_ORGANIZATION_AGENTS, { slug: orgSlug }).toPromise(),
          { maxRetries: 2, initialDelay: 5000 },
        ) as any

        const responseTime = Date.now() - startTime

        if (result.error) {
          console.error(`Error fetching agents for ${orgSlug}:`, result.error)
          this.db.logApiCall("buildkite", `agents/${orgSlug}`, responseTime, 500)
          continue
        }

        if (result.data?.organization?.agents) {
          const agents = result.data.organization.agents.edges.map((edge: any) =>
            this.mapBuildkiteAgentToApp(edge.node, orgSlug)
          )

          // Cache agents for 5 minutes
          this.db.cacheAgents(orgSlug, agents, 5 * 60)

          allAgents.push(...agents)
          console.log(`Fetched ${agents.length} agents from ${orgSlug}`)
        }

        this.db.logApiCall("buildkite", `agents/${orgSlug}`, responseTime, 200)
      } catch (error) {
        console.error(`Failed to fetch agents for ${orgSlug}:`, error)
        this.db.logApiCall("buildkite", `agents/${orgSlug}`, Date.now() - startTime, 500)
      }
    }

    return allAgents
  }

  // Utility methods for mapping Buildkite data
  private mapBuildkitePipelineToApp(pipeline: any): AppPipeline {
    const builds = pipeline.builds?.edges?.map((edge: any) => edge.node) || []
    const latestBuild = builds[0]

    const buildStats = builds.reduce(
      (acc, build) => {
        acc.total++
        if (build.state === "PASSED") {
          acc.passed++
        } else if (["FAILED", "CANCELED", "WAITING_FAILED"].includes(build.state)) {
          acc.failed++
        }
        return acc
      },
      { total: 0, passed: 0, failed: 0 },
    )

    let lastBuild = "Never"
    if (latestBuild) {
      const buildTime = new Date(latestBuild.startedAt || latestBuild.createdAt)
      const now = new Date()
      const diffMs = now.getTime() - buildTime.getTime()
      const diffMins = Math.floor(diffMs / (1000 * 60))
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

      if (diffMins < 1) {
        lastBuild = "now"
      } else if (diffMins < 60) {
        lastBuild = `${diffMins} minutes ago`
      } else if (diffHours < 24) {
        lastBuild = `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`
      } else {
        lastBuild = `${diffDays} day${diffDays > 1 ? "s" : ""} ago`
      }
    }

    const repoUrl = pipeline.repository?.url
    let repo: string | undefined
    if (repoUrl) {
      const sshMatch = repoUrl.match(/git@github\.com:([^\/]+\/[^\/]+?)(?:\.git)?$/)
      const httpsMatch = repoUrl.match(/github\.com\/([^\/]+\/[^\/]+?)(?:\.git)?(?:\/.*)?$/)
      repo = (sshMatch || httpsMatch)?.[1]
    }

    // Map actual builds to BuildHistoryItem format
    const buildHistory = builds.map((build: any) => ({
      status: this.normalizeStatus(build.state) as "success" | "failed" | "running" | "cancelled",
      buildNumber: build.number,
      finishedAt: build.finishedAt || build.createdAt,
    }))

    return {
      id: pipeline.id,
      name: pipeline.name,
      slug: pipeline.slug,
      repo,
      status: this.determinePipelineStatus(builds),
      lastBuild,
      tags: pipeline.tags?.map((tag: any) => tag.label) || [],
      visibility: pipeline.visibility.toLowerCase(),
      builds: buildStats,
      buildHistory,
      url: pipeline.url,
    }
  }

  private mapBuildkiteAgentToApp(agent: any, orgSlug: string): AppAgent {
    return {
      id: agent.id,
      name: agent.name,
      hostname: agent.hostname,
      connectionState: agent.connectionState,
      isRunningJob: agent.isRunningJob,
      operatingSystem: agent.operatingSystem?.name,
      version: agent.version,
      ipAddress: agent.ipAddress,
      organization: orgSlug,
      queueKey: agent.clusterQueue?.key,
      metadata: undefined,
      currentJob: undefined,
      createdAt: new Date(agent.createdAt),
      connectedAt: agent.connectedAt ? new Date(agent.connectedAt) : undefined,
      disconnectedAt: agent.disconnectedAt ? new Date(agent.disconnectedAt) : undefined,
      lastSeen: agent.connectedAt ? new Date(agent.connectedAt) : undefined,
    }
  }

  private normalizeStatus(status: string): string {
    const statusMap: Record<string, string> = {
      "PASSED": "passed",
      "FAILED": "failed",
      "RUNNING": "running",
      "SCHEDULED": "running",
      "CREATING": "running",
      "WAITING": "running",
      "BLOCKED": "running",
      "CANCELED": "cancelled",
      "CANCELING": "cancelled",
      "WAITING_FAILED": "failed",
      "NOT_RUN": "unknown",
    }
    return statusMap[status] || status.toLowerCase()
  }

  private determinePipelineStatus(builds: any[]): string {
    if (!builds || builds.length === 0) {
      return "unknown"
    }

    const latestBuild = builds[0]

    // If the latest build is running, the pipeline is running
    if (latestBuild && ["RUNNING", "SCHEDULED", "CREATING", "WAITING", "BLOCKED"].includes(latestBuild.state)) {
      return "running"
    }

    // If the latest build is cancelled, the pipeline is cancelled
    if (latestBuild && ["CANCELED", "CANCELING"].includes(latestBuild.state)) {
      return "cancelled"
    }

    // Look at recent builds to determine failing vs passing pattern
    // Consider the last 3 builds to determine the pipeline health trend
    const recentBuilds = builds.slice(0, 3)
    const failedBuilds = recentBuilds.filter((build) => ["FAILED", "WAITING_FAILED"].includes(build.state))
    const passedBuilds = recentBuilds.filter((build) => build.state === "PASSED")

    // If the latest build failed, or if 2+ of the last 3 builds failed, mark as failing
    if (latestBuild && ["FAILED", "WAITING_FAILED"].includes(latestBuild.state)) {
      return "failed"
    } else if (failedBuilds.length >= 2) {
      return "failed"
    } else if (passedBuilds.length > 0) {
      return "passed"
    }

    // Default to the normalized latest build status
    return this.normalizeStatus(latestBuild?.state || "NOT_RUN")
  }

  // Get cache statistics
  getStats(): any {
    return {
      database: this.db.getStats(),
      rateLimits: this.db.getRateLimitStatus(),
      memoryCache: {
        size: this.memoryCache.size,
      },
    }
  }

  // Manual cache refresh
  async refreshPipelines(): Promise<AppPipeline[]> {
    console.log("Forcing refresh of all pipeline data")

    // Clear memory cache
    this.memoryCache.delete("all-pipelines")

    // Fetch fresh data for all orgs
    const pipelines = await this.fetchPipelinesFromBuildkite(ORGANIZATIONS)
    const enriched = await this.enrichPipelinesWithGitHub(pipelines)

    this.setInMemory("all-pipelines", enriched, 60)
    return enriched
  }

  async refreshAgents(): Promise<AppAgent[]> {
    console.log("Forcing refresh of all agent data")

    // Clear memory cache
    this.memoryCache.delete("all-agents")

    // Fetch fresh data for all orgs
    const agents = await this.fetchAgentsFromBuildkite(ORGANIZATIONS)

    this.setInMemory("all-agents", agents, 60)
    return agents
  }

  // Clean shutdown
  close(): void {
    this.db.close()
  }
}

// Singleton instance
let cacheManagerInstance: CacheManager | null = null

export function getCacheManager(): CacheManager {
  if (!cacheManagerInstance) {
    cacheManagerInstance = new CacheManager()
  }
  return cacheManagerInstance
}
