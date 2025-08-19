import { CacheDB } from "./db.ts"
import {
  GET_BUILD_DETAILS,
  GET_ORGANIZATION_AGENTS,
  GET_ORGANIZATION_PIPELINES_PAGINATED,
  GET_PIPELINE_BUILDS,
  getBuildkiteClient,
} from "../buildkite-client.ts"
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
  private inFlightRequests: WeakMap<symbol, Promise<any>> = new WeakMap()
  private lockSymbols: Map<string, symbol> = new Map()

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

  private async withLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
    // Check if there's already a symbol (and thus an in-flight request) for this key
    const existingSymbol = this.lockSymbols.get(key)
    if (existingSymbol && this.inFlightRequests.has(existingSymbol)) {
      const existingRequest = this.inFlightRequests.get(existingSymbol)!
      console.log(`Waiting for in-flight request: ${key}`)
      return await existingRequest
    }

    // Create a new symbol for this lock
    const lockSymbol = Symbol(key)
    this.lockSymbols.set(key, lockSymbol)

    // Start a new request and store the promise
    const promise = operation()
    this.inFlightRequests.set(lockSymbol, promise)

    try {
      const result = await promise
      return result
    } finally {
      // Clean up - the WeakMap entry will be GC'd when the symbol is collected
      this.lockSymbols.delete(key)
    }
  }

  // Get pipelines with multi-level caching
  async getPipelines(): Promise<AppPipeline[]> {
    // L1: Memory cache (1 minute) - check enriched pipelines first
    const memCachedEnriched = this.getFromMemory<AppPipeline[]>("all-pipelines-enriched")
    if (memCachedEnriched) {
      console.log("Cache hit: memory (all-pipelines-enriched)")
      return memCachedEnriched
    }

    // L2: Memory cache for basic pipelines (faster response)
    const memCachedBasic = this.getFromMemory<AppPipeline[]>("all-pipelines-basic")
    if (memCachedBasic) {
      console.log("Cache hit: memory (all-pipelines-basic), triggering background enrichment")
      // Trigger background enrichment (fire and forget)
      this.enrichPipelinesInBackground(memCachedBasic)
      return memCachedBasic
    }

    // Use locking for pipeline fetching (without GitHub enrichment)
    return await this.withLock("get-pipelines-basic", async () => {
      // Double-check memory cache after acquiring lock
      const memCachedAfterLock = this.getFromMemory<AppPipeline[]>("all-pipelines-enriched")
      if (memCachedAfterLock) {
        console.log("Cache hit: memory (all-pipelines-enriched) after lock")
        return memCachedAfterLock
      }

      const memCachedBasicAfterLock = this.getFromMemory<AppPipeline[]>("all-pipelines-basic")
      if (memCachedBasicAfterLock) {
        console.log("Cache hit: memory (all-pipelines-basic) after lock, triggering background enrichment")
        this.enrichPipelinesInBackground(memCachedBasicAfterLock)
        return memCachedBasicAfterLock
      }

      // L3: SQLite cache (check each org)
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

      // L4: Fetch missing orgs from Buildkite
      if (orgsToFetch.length > 0) {
        console.log(`Fetching fresh data for orgs: ${orgsToFetch.join(", ")}`)
        const freshPipelines = await this.fetchPipelinesFromBuildkite(orgsToFetch)
        cachedPipelines.push(...freshPipelines)
      }

      // Cache basic pipelines (without GitHub enrichment) for immediate response
      this.setInMemory("all-pipelines-basic", cachedPipelines, 60) // 1 minute

      // Trigger background enrichment (fire and forget)
      this.enrichPipelinesInBackground(cachedPipelines)

      return cachedPipelines
    })
  }

  private async fetchPipelinesFromBuildkite(orgSlugs: readonly string[]): Promise<AppPipeline[]> {
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
              await getBuildkiteClient().query(GET_ORGANIZATION_PIPELINES_PAGINATED, {
                slug: orgSlug,
                first: 50, // Reduced from 100 to lower complexity points per request
                after: cursor || undefined,
              }).toPromise(),
            { maxRetries: 3, initialDelay: 1000, maxDelay: 300000 }, // Allow up to 5 minute delays for rate limiting
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

          // Check if this is a rate limit error - if so, save what we have and exit gracefully
          if (error && typeof error === "object" && "graphQLErrors" in error) {
            const graphQLErrors = (error as any).graphQLErrors || []
            const rateLimitError = graphQLErrors.find((e: any) =>
              e.message?.includes("exceeded the limit") || e.message?.includes("rate limit")
            )

            if (rateLimitError) {
              console.log(
                `🚦 Rate limit hit on page ${pageCount}, saving ${allOrgPipelines.length} pipelines collected so far`,
              )
              break // Exit gracefully with partial data
            }
          }

          // For non-rate-limit errors, stop pagination
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

  // Background GitHub enrichment with locking
  private enrichPipelinesInBackground(pipelines: AppPipeline[]): void {
    // Fire and forget - don't await this
    this.withLock("github-enrichment", async () => {
      console.log(`🔄 Background: Starting GitHub enrichment for ${pipelines.length} pipelines`)
      const startTime = Date.now()

      try {
        const enrichedPipelines = await this.enrichPipelinesWithGitHub(pipelines)

        // Cache the enriched results
        this.setInMemory("all-pipelines-enriched", enrichedPipelines, 60) // 1 minute

        const duration = Date.now() - startTime
        console.log(`✅ Background: GitHub enrichment completed in ${duration}ms`)
      } catch (error) {
        console.error("❌ Background: GitHub enrichment failed:", error)
      }
    }).catch((error) => {
      console.error("❌ Background: GitHub enrichment lock failed:", error)
    })
  }

  private async enrichPipelinesWithGitHub(pipelines: AppPipeline[]): Promise<AppPipeline[]> {
    const githubToken = Deno.env.get("GITHUB_APP_TOKEN")
    if (!githubToken) {
      console.warn("GITHUB_APP_TOKEN not configured, skipping GitHub enrichment")
      return pipelines
    }

    console.log(`Enriching ${pipelines.length} pipelines with GitHub data`)

    // Collect batch operations
    const apiCallBatch: Array<{ service: string; endpoint: string; responseTimeMs: number; statusCode: number }> = []
    const repoCacheBatch: Array<{ repoPath: string; isPrivate: boolean; ttlSeconds: number }> = []

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
          apiCallBatch.push({
            service: "github",
            endpoint: `repos/${pipeline.repo}`,
            responseTimeMs: responseTime,
            statusCode: 200,
          })
        } else if (response.status === 404) {
          // Can't see it with app token, so it's private
          isPrivate = true
          apiCallBatch.push({
            service: "github",
            endpoint: `repos/${pipeline.repo}`,
            responseTimeMs: responseTime,
            statusCode: 404,
          })
        } else {
          console.warn(`GitHub API error for ${pipeline.repo}: ${response.status}`)
          apiCallBatch.push({
            service: "github",
            endpoint: `repos/${pipeline.repo}`,
            responseTimeMs: responseTime,
            statusCode: response.status,
          })
        }

        // Update pipeline
        pipeline.visibility = isPrivate ? "private" : "public"
        if (isPrivate && !pipeline.tags.includes("private")) {
          pipeline.tags.push("private")
        }

        // Add to cache batch for 30 minutes
        repoCacheBatch.push({ repoPath: pipeline.repo, isPrivate, ttlSeconds: 30 * 60 })
      } catch (error) {
        console.error(`Failed to check GitHub repo ${pipeline.repo}:`, error)
        apiCallBatch.push({
          service: "github",
          endpoint: `repos/${pipeline.repo}`,
          responseTimeMs: Date.now() - startTime,
          statusCode: 500,
        })
        // Default to private on error
        pipeline.visibility = "private"
      }
    }

    // Execute batch operations
    try {
      this.db.batchLogApiCalls(apiCallBatch)
      this.db.batchCacheGitHubRepos(repoCacheBatch)
    } catch (error) {
      console.error("Failed to execute batch database operations:", error)
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

    // Use locking to prevent concurrent fetches
    return await this.withLock("get-agents", async () => {
      // Double-check memory cache after acquiring lock
      const memCachedAfterLock = this.getFromMemory<AppAgent[]>("all-agents")
      if (memCachedAfterLock) {
        console.log("Cache hit: memory (all-agents) after lock")
        return memCachedAfterLock
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
    })
  }

  private async fetchAgentsFromBuildkite(orgSlugs: readonly string[]): Promise<AppAgent[]> {
    const allAgents: AppAgent[] = []

    for (const orgSlug of orgSlugs) {
      const startTime = Date.now()

      try {
        console.log(`Fetching agents for organization: ${orgSlug}`)

        const result = await withRetry(
          async () => await getBuildkiteClient().query(GET_ORGANIZATION_AGENTS, { slug: orgSlug }).toPromise(),
          { maxRetries: 3, initialDelay: 1000, maxDelay: 300000 }, // Allow up to 5 minute delays for rate limiting
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
      (acc: { total: number; passed: number; failed: number }, build: any) => {
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
    let currentJob: AppAgent["currentJob"] = undefined

    // Map job data if available
    if (agent.job && agent.isRunningJob) {
      currentJob = {
        id: agent.job.id,
        state: agent.job.state,
        url: agent.job.url,
        pipelineName: agent.job.build?.pipeline?.name || "Unknown",
        pipelineSlug: agent.job.build?.pipeline?.slug || "",
        buildNumber: agent.job.build?.number || 0,
        buildUrl: agent.job.build
          ? `https://buildkite.com/${orgSlug}/${agent.job.build.pipeline?.slug}/builds/${agent.job.build.number}`
          : "",
        startedAt: agent.job.startedAt,
        duration: agent.job.startedAt ? this.formatDuration(agent.job.startedAt) : undefined,
      }
    }

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
      currentJob,
      createdAt: new Date(agent.createdAt),
      connectedAt: agent.connectedAt ? new Date(agent.connectedAt) : undefined,
      disconnectedAt: agent.disconnectedAt ? new Date(agent.disconnectedAt) : undefined,
      lastSeen: agent.connectedAt ? new Date(agent.connectedAt) : undefined,
    }
  }

  private formatDuration(startedAt: string): string {
    const start = new Date(startedAt)
    const now = new Date()
    const durationMs = now.getTime() - start.getTime()

    const minutes = Math.floor(durationMs / (1000 * 60))
    const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    }
    return `${seconds}s`
  }

  private normalizeStatus(status: string): string {
    const statusMap: Record<string, string> = {
      "PASSED": "passed",
      "FAILED": "failed",
      "RUNNING": "running",
      "CREATING": "running",
      "SCHEDULED": "scheduled",
      "WAITING": "waiting",
      "BLOCKED": "blocked",
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

    // Handle specific latest build states first (most important)
    if (latestBuild) {
      // Only RUNNING and CREATING are truly "running"
      if (["RUNNING", "CREATING"].includes(latestBuild.state)) {
        return "running"
      }

      // BLOCKED is its own status - not running
      if (latestBuild.state === "BLOCKED") {
        return "blocked"
      }

      // SCHEDULED and WAITING are pending states
      if (["SCHEDULED", "WAITING"].includes(latestBuild.state)) {
        return this.normalizeStatus(latestBuild.state)
      }

      // If the latest build is cancelled, the pipeline is cancelled
      if (["CANCELED", "CANCELING"].includes(latestBuild.state)) {
        return "cancelled"
      }

      // If the latest build failed, pipeline is failed
      if (["FAILED", "WAITING_FAILED"].includes(latestBuild.state)) {
        return "failed"
      }

      // If the latest build passed, pipeline is passed
      if (latestBuild.state === "PASSED") {
        return "passed"
      }
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

    // Use locking to prevent concurrent refreshes
    return await this.withLock("refresh-pipelines", async () => {
      // Clear memory caches
      this.memoryCache.delete("all-pipelines-basic")
      this.memoryCache.delete("all-pipelines-enriched")

      // Fetch fresh data for all orgs
      const pipelines = await this.fetchPipelinesFromBuildkite(ORGANIZATIONS)

      // Cache basic pipelines immediately
      this.setInMemory("all-pipelines-basic", pipelines, 60)

      // Trigger background enrichment (fire and forget)
      this.enrichPipelinesInBackground(pipelines)

      return pipelines
    })
  }

  async refreshAgents(): Promise<AppAgent[]> {
    console.log("Forcing refresh of all agent data")

    // Use locking to prevent concurrent refreshes
    return await this.withLock("refresh-agents", async () => {
      // Clear memory cache
      this.memoryCache.delete("all-agents")

      // Fetch fresh data for all orgs
      const agents = await this.fetchAgentsFromBuildkite(ORGANIZATIONS)

      this.setInMemory("all-agents", agents, 60)
      return agents
    })
  }

  // Individual build caching with intelligent TTL
  async getCachedBuild(pipelineSlug: string, buildNumber: number): Promise<any | null> {
    // Check memory cache first
    const memKey = `build-${pipelineSlug}-${buildNumber}`
    const memCached = this.getFromMemory<any>(memKey)
    if (memCached) {
      console.log(`Cache hit: memory (${memKey})`)
      return memCached
    }

    // Check SQLite cache
    const cached = this.db.getCachedBuild(pipelineSlug, buildNumber)
    if (cached) {
      console.log(`Cache hit: database (${memKey})`)
      // Cache in memory for 5 minutes
      this.setInMemory(memKey, cached, 5 * 60)
      return cached
    }

    return null
  }

  async cacheBuild(pipelineSlug: string, buildNumber: number, build: any): Promise<void> {
    // Determine TTL based on build state
    let ttlSeconds: number
    if (["PASSED", "FAILED", "CANCELED", "WAITING_FAILED"].includes(build.state)) {
      // Finished builds are immutable - cache for 24 hours (effectively forever)
      ttlSeconds = 24 * 60 * 60
    } else {
      // Running builds need frequent updates - cache for 1 minute
      ttlSeconds = 60
    }

    // Cache in database
    this.db.cacheBuild(pipelineSlug, buildNumber, build, ttlSeconds)

    // Cache in memory for shorter time
    const memKey = `build-${pipelineSlug}-${buildNumber}`
    this.setInMemory(memKey, build, Math.min(ttlSeconds, 5 * 60))

    console.log(`Cached build ${pipelineSlug}#${buildNumber} (state: ${build.state}, TTL: ${ttlSeconds}s)`)
  }

  async getCachedBuildsForPipeline(pipelineSlug: string, limit = 20): Promise<any[]> {
    return this.db.getCachedBuilds(pipelineSlug, limit)
  }

  // Individual job caching with intelligent TTL
  async getCachedJob(pipelineSlug: string, buildNumber: number, jobId: string): Promise<any | null> {
    // Check memory cache first
    const memKey = `job-${pipelineSlug}-${buildNumber}-${jobId}`
    const memCached = this.getFromMemory<any>(memKey)
    if (memCached) {
      console.log(`Cache hit: memory (${memKey})`)
      return memCached
    }

    // Check SQLite cache
    const cached = this.db.getCachedJob(pipelineSlug, buildNumber, jobId)
    if (cached) {
      console.log(`Cache hit: database (${memKey})`)
      // Cache in memory for 5 minutes
      this.setInMemory(memKey, cached, 5 * 60)
      return cached
    }

    return null
  }

  async cacheJob(pipelineSlug: string, buildNumber: number, jobId: string, job: any): Promise<void> {
    // Determine TTL based on job state
    let ttlSeconds: number
    if (["passed", "failed", "canceled"].includes(job.state)) {
      // Finished jobs are immutable - cache for 24 hours (effectively forever)
      ttlSeconds = 24 * 60 * 60
    } else {
      // Running jobs need frequent updates - cache for 1 minute
      ttlSeconds = 60
    }

    // Cache in database
    this.db.cacheJob(pipelineSlug, buildNumber, jobId, job, ttlSeconds)

    // Cache in memory for shorter time
    const memKey = `job-${pipelineSlug}-${buildNumber}-${jobId}`
    this.setInMemory(memKey, job, Math.min(ttlSeconds, 5 * 60))

    console.log(`Cached job ${jobId} in ${pipelineSlug}#${buildNumber} (state: ${job.state}, TTL: ${ttlSeconds}s)`)
  }

  async getCachedJobsForBuild(pipelineSlug: string, buildNumber: number): Promise<any[]> {
    return this.db.getCachedJobsForBuild(pipelineSlug, buildNumber)
  }

  // Job log caching
  async getCachedJobLog(pipelineSlug: string, buildNumber: number, jobId: string): Promise<string | null> {
    // Check memory cache first
    const memKey = `job-log-${pipelineSlug}-${buildNumber}-${jobId}`
    const memCached = this.getFromMemory<string>(memKey)
    if (memCached) {
      console.log(`Cache hit: memory (${memKey})`)
      return memCached
    }

    // Check SQLite cache
    const cached = this.db.getCachedJobLog(pipelineSlug, buildNumber, jobId)
    if (cached) {
      console.log(`Cache hit: database (${memKey})`)
      // Cache in memory for 5 minutes
      this.setInMemory(memKey, cached, 5 * 60)
      return cached
    }

    return null
  }

  async cacheJobLog(
    pipelineSlug: string,
    buildNumber: number,
    jobId: string,
    logContent: string,
    isJobFinished: boolean,
  ): Promise<void> {
    // Determine TTL based on job state
    let ttlSeconds: number
    if (isJobFinished) {
      // Finished job logs are immutable - cache for 24 hours (effectively forever)
      ttlSeconds = 24 * 60 * 60
    } else {
      // Running job logs change frequently - cache for 1 minute
      ttlSeconds = 60
    }

    // Cache in database
    this.db.cacheJobLog(pipelineSlug, buildNumber, jobId, logContent, ttlSeconds)

    // Cache in memory for shorter time
    const memKey = `job-log-${pipelineSlug}-${buildNumber}-${jobId}`
    this.setInMemory(memKey, logContent, Math.min(ttlSeconds, 5 * 60))

    console.log(
      `Cached job log ${jobId} in ${pipelineSlug}#${buildNumber} (finished: ${isJobFinished}, TTL: ${ttlSeconds}s)`,
    )
  }

  // Cache-aware fetch methods that try cache first, then API
  async fetchAndCacheBuilds(pipelineSlug: string, limit = 20): Promise<any[]> {
    // Use locking to prevent concurrent fetches for the same pipeline
    return await this.withLock(`fetch-builds-${pipelineSlug}-${limit}`, async () => {
      // Try cache first
      let builds = await this.getCachedBuildsForPipeline(pipelineSlug, limit)

      if (builds.length === 0) {
        // No cached builds, fetch from API
        console.log(`No cached builds for ${pipelineSlug}, fetching from API`)
        const fullPipelineSlug = `divvun/${pipelineSlug}`
        const result = await withRetry(
          async () =>
            await getBuildkiteClient().query(GET_PIPELINE_BUILDS, {
              pipelineSlug: fullPipelineSlug,
              first: limit,
            }).toPromise(),
          { maxRetries: 3, initialDelay: 1000, maxDelay: 300000 },
        )

        if (result.error) {
          throw new Error(`Failed to fetch builds for ${pipelineSlug}: ${result.error}`)
        }

        builds = result.data?.pipeline?.builds?.edges?.map((edge) => edge.node) || []
        console.log(`Fetched ${builds.length} builds for pipeline ${fullPipelineSlug}`)

        // Cache each build
        for (const build of builds) {
          await this.cacheBuild(pipelineSlug, build.number, build)
        }
      } else {
        console.log(`Using ${builds.length} cached builds for pipeline ${pipelineSlug}`)
      }

      return builds
    })
  }

  async fetchAndCacheBuildById(buildId: string): Promise<{ build: any; jobs: any[] } | null> {
    // Use locking to prevent concurrent fetches for the same build
    return await this.withLock(`fetch-build-${buildId}`, async () => {
      try {
        // Decode the base64 build ID to extract the UUID
        const decodedId = atob(buildId) // "Build---uuid" format
        const uuid = decodedId.split("---")[1] // Extract just the UUID part

        const result = await withRetry(
          async () =>
            await getBuildkiteClient().query(GET_BUILD_DETAILS, {
              uuid: uuid,
            }).toPromise(),
          { maxRetries: 3, initialDelay: 1000, maxDelay: 300000 },
        )

        if (result.error) {
          throw new Error(`Failed to fetch build details for ${buildId}: ${result.error}`)
        }

        const build = result.data?.build
        if (!build) {
          return null
        }

        const jobs = build?.jobs?.edges?.map((edge) =>
          edge?.node
        ).filter((job): job is NonNullable<typeof job> => job != null).toReversed() || []

        // Cache the build and jobs if we have pipeline info
        if (build.pipeline?.slug && build.number) {
          await this.cacheBuild(build.pipeline.slug, build.number, build)

          // Cache each job using UUID if available, fallback to ID
          for (const job of jobs) {
            const jobKey = job.uuid || job.id
            if (jobKey) {
              await this.cacheJob(build.pipeline.slug, build.number, jobKey, job)
            }
          }
        }

        return { build, jobs }
      } catch (error) {
        console.error(`Error fetching build by ID ${buildId}:`, error)
        return null
      }
    })
  }

  // Webhook-triggered incremental updates
  async updatePipelineBuildStatus(pipelineSlug: string, buildNumber: number, state: string): Promise<void> {
    console.log(`🔄 Updating pipeline ${pipelineSlug} build #${buildNumber} to ${state}`)

    // Invalidate memory cache for this specific build if it's cached
    const memKey = `build-${pipelineSlug}-${buildNumber}`
    this.memoryCache.delete(memKey)

    // Invalidate pipeline list cache to refresh status
    this.memoryCache.delete("all-pipelines")
  }

  async updateJobStatus(jobId: string, state: string, pipelineSlug: string, buildNumber: number): Promise<void> {
    console.log(`🔄 Updating job ${jobId} in ${pipelineSlug}#${buildNumber} to ${state}`)

    // Invalidate memory cache for this specific job if it's cached
    const memKey = `job-${pipelineSlug}-${buildNumber}-${jobId}`
    this.memoryCache.delete(memKey)
  }

  async updateAgentStatus(agentId: string, connectionState: string, timestamp?: string): Promise<void> {
    console.log(`🔄 Updating agent ${agentId} to ${connectionState}`)

    // Invalidate agent cache to force refresh
    this.memoryCache.delete("all-agents")

    // TODO: Implement more granular agent status updates
  }

  async invalidatePipelineCache(pipelineSlug?: string): Promise<void> {
    if (pipelineSlug) {
      console.log(`🗑️ Invalidating cache for pipeline ${pipelineSlug}`)
      // For now, invalidate all pipeline cache
      // TODO: Implement pipeline-specific cache invalidation
    }

    this.memoryCache.delete("all-pipelines")
  }

  // Public methods for external cache access
  getFromMemoryCache<T>(key: string): T | null {
    return this.getFromMemory<T>(key)
  }

  setInMemoryCache<T>(key: string, data: T, ttlSeconds: number): void {
    this.setInMemory(key, data, ttlSeconds)
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
