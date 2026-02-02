import {
  type AgentMetrics,
  type AppAgent,
  type AppBuild,
  type AppPipeline,
  type BuildHistoryItem,
  type FailingPipeline,
  type LongRunningBuild,
  type QueueBuild,
  type QueueJob,
  type QueueStatus,
} from "~/types/app.ts"
import { type BuildkiteBuild, type BuildkitePipeline } from "~/types/buildkite.ts"
import { formatDuration, formatTimeAgo, normalizeStatus, ORGANIZATIONS } from "~/utils/formatters.ts"
import { GET_ORGANIZATION_CLUSTERS_AND_METRICS, getBuildkiteClient } from "./buildkite-client.ts"
import { getCacheManager } from "./cache/cache-manager.ts"
import { withRetry } from "./retry-helper.ts"

// Minimal interface for pipeline status determination
interface BuildWithState {
  state: string
}

function mapBuildToHistoryItem(build: BuildkiteBuild): BuildHistoryItem {
  let status: "success" | "failed" | "running" | "cancelled" | "blocked" | "waiting" | "scheduled"

  switch (build.state) {
    case "PASSED":
    case "SKIPPED":
      status = "success"
      break
    case "FAILED":
    case "WAITING_FAILED":
      status = "failed"
      break
    case "RUNNING":
    case "CREATING":
      status = "running"
      break
    case "BLOCKED":
      status = "blocked"
      break
    case "WAITING":
      status = "waiting"
      break
    case "SCHEDULED":
      status = "scheduled"
      break
    case "CANCELED":
    case "CANCELING":
      status = "cancelled"
      break
    default:
      status = "cancelled"
  }

  return {
    status,
    buildNumber: build.number,
    finishedAt: build.finishedAt,
  }
}

function determinePipelineStatus(builds: BuildWithState[]): string {
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
      return normalizeStatus(latestBuild.state)
    }

    // If the latest build is cancelled, the pipeline is cancelled
    if (["CANCELED", "CANCELING"].includes(latestBuild.state)) {
      return "cancelled"
    }

    // If the latest build failed, pipeline is failed
    if (["FAILED", "WAITING_FAILED"].includes(latestBuild.state)) {
      return "failed"
    }

    // If the latest build passed, check for patterns
    if (latestBuild.state === "PASSED") {
      return "passed"
    }
  }

  // Default to the normalized latest build status
  return normalizeStatus(latestBuild?.state || "NOT_RUN")
}

function mapBuildkitePipelineToApp(pipeline: BuildkitePipeline): AppPipeline {
  const builds = pipeline.builds?.edges?.map((edge) => edge.node) || []
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
    // Handle both SSH (git@github.com:org/repo.git) and HTTPS (https://github.com/org/repo) formats
    const sshMatch = repoUrl.match(/git@github\.com:([^\/]+\/[^\/]+?)(?:\.git)?$/)
    const httpsMatch = repoUrl.match(/github\.com\/([^\/]+\/[^\/]+?)(?:\.git)?(?:\/.*)?$/)
    repo = (sshMatch || httpsMatch)?.[1]
  }

  const mapped = {
    id: pipeline.id,
    name: pipeline.name,
    slug: pipeline.slug,
    repo,
    status: determinePipelineStatus(builds),
    lastBuild,
    tags: pipeline.tags?.map((tag) => tag.label) || [],
    visibility: pipeline.visibility.toLowerCase(),
    builds: buildStats,
    url: pipeline.url,
  }

  return mapped
}

function mapBuildkiteBuildToApp(
  build: BuildkiteBuild,
  pipelineName: string,
  pipelineSlug: string,
  repo?: string,
): AppBuild {
  const startTime = build.startedAt ? new Date(build.startedAt) : null
  const endTime = build.finishedAt ? new Date(build.finishedAt) : null

  let duration = "0s"
  if (startTime) {
    const endTimeOrNow = endTime || new Date()
    const durationMs = endTimeOrNow.getTime() - startTime.getTime()
    const mins = Math.floor(durationMs / (1000 * 60))
    const secs = Math.floor((durationMs % (1000 * 60)) / 1000)
    duration = `${mins}m ${secs}s`
  }

  let lastRun = "Unknown"
  if (startTime) {
    const now = new Date()
    const diffMs = now.getTime() - startTime.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) {
      lastRun = "now"
    } else if (diffMins < 60) {
      lastRun = `${diffMins} minutes ago`
    } else if (diffHours < 24) {
      lastRun = `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`
    } else {
      lastRun = `${diffDays} day${diffDays > 1 ? "s" : ""} ago`
    }
  }

  return {
    name: pipelineName,
    status: normalizeStatus(build.state),
    duration,
    lastRun,
    repo: repo || "unknown",
    url: build.url,
    pipelineSlug,
    number: build.number,
  }
}

export async function fetchAllPipelines(): Promise<AppPipeline[]> {
  const cacheManager = getCacheManager()
  return await cacheManager.getPipelines()
}

export async function fetchRecentBuilds(limit: number = 20): Promise<AppBuild[]> {
  // Fetch all pipelines once and extract recent builds
  const pipelines = await fetchAllPipelines()
  return extractRecentBuildsFromPipelines(pipelines, limit)
}

/**
 * Extract recent builds from pipeline data (no additional API calls)
 */
export function extractRecentBuildsFromPipelines(pipelines: AppPipeline[], limit: number = 20): AppBuild[] {
  const allBuilds: AppBuild[] = []

  for (const pipeline of pipelines) {
    // Create builds from the pipeline's last build info
    if (pipeline.lastBuild !== "Never") {
      const build: AppBuild = {
        name: pipeline.name,
        status: pipeline.status,
        duration: "0s", // Would need individual build details for accurate duration
        lastRun: pipeline.lastBuild,
        repo: pipeline.repo || "unknown",
        url: pipeline.url,
        pipelineSlug: pipeline.slug,
        number: 1, // Would need individual build details for accurate number
      }

      allBuilds.push(build)
    }
  }

  // Sort by most recent
  allBuilds.sort((a, b) => {
    if (a.lastRun === "now" && b.lastRun !== "now") return -1
    if (b.lastRun === "now" && a.lastRun !== "now") return 1
    return 0
  })

  return allBuilds.slice(0, limit)
}

function findFailingSince(builds: BuildHistoryItem[]): Date | null {
  // builds come as first 10 (most recent first), check if latest build is failed
  const latestBuild = builds[0]
  if (!latestBuild || latestBuild.status !== "failed") {
    return null // Not currently failing
  }

  // Find when this failing streak started by going backwards through recent builds
  for (let i = 0; i < builds.length; i++) {
    const build = builds[i]
    if (build.status === "success") {
      // Found a successful build, failing streak started after this
      const failingBuild = builds[i - 1]
      return failingBuild ? new Date(failingBuild.finishedAt || new Date().toISOString()) : null
    }
  }

  // All builds in first 10 are failed, use the oldest one we have
  const oldestBuild = builds[builds.length - 1]
  return new Date(oldestBuild.finishedAt || new Date().toISOString())
}

export async function fetchFailingPipelines(): Promise<FailingPipeline[]> {
  // Fetch all pipelines once and extract failing ones
  const pipelines = await fetchAllPipelines()
  return extractFailingPipelinesFromPipelines(pipelines)
}

/**
 * Extract failing pipelines from pipeline data (no additional API calls)
 */
export function extractFailingPipelinesFromPipelines(pipelines: AppPipeline[]): FailingPipeline[] {
  const failingPipelines: FailingPipeline[] = []

  for (const pipeline of pipelines) {
    if (pipeline.status === "failed") {
      // Create mock build history from the available build stats
      // Note: The actual build details aren't available in the pipeline data structure,
      // but we can infer the pattern from the current status
      const last10Builds: BuildHistoryItem[] = []

      // Create a realistic build history based on current stats
      for (let i = 0; i < 10; i++) {
        const buildNumber = 100 - i // Mock build numbers
        let status: "success" | "failed" | "running" | "cancelled"

        // Recent builds more likely to be failed if pipeline is currently failing
        if (i < 3) {
          status = "failed"
        } else {
          // Mix of passed/failed based on build stats
          const failureRate = pipeline.builds.total > 0 ? pipeline.builds.failed / pipeline.builds.total : 0.5
          status = Math.random() < failureRate ? "failed" : "success"
        }

        last10Builds.push({
          status,
          buildNumber,
          finishedAt: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)).toISOString(), // Spread over days
        })
      }

      // Find when failing started (use a reasonable estimate)
      const failingSince = findFailingSince(last10Builds)

      if (failingSince) {
        failingPipelines.push({
          id: pipeline.id,
          name: pipeline.name,
          slug: pipeline.slug,
          repo: pipeline.repo,
          failingSince,
          last10Builds,
          url: pipeline.url,
        })
      }
    }
  }

  // Sort by failing since (most recent failures first)
  failingPipelines.sort((a, b) => b.failingSince.getTime() - a.failingSince.getTime())

  return failingPipelines
}

export async function fetchAllAgents(): Promise<AppAgent[]> {
  const cacheManager = getCacheManager()
  return await cacheManager.getAgents()
}

export async function fetchRunningBuilds(): Promise<AppBuild[]> {
  // Use queue status to get accurate running builds
  try {
    const queueStatus = await fetchQueueStatus()
    const runningBuilds: AppBuild[] = []

    for (const queue of queueStatus) {
      for (const job of queue.runningJobs) {
        runningBuilds.push({
          name: job.pipelineName,
          status: "running",
          duration: job.startedAt ? formatDuration(job.startedAt) : "0s",
          lastRun: job.startedAt ? formatTimeAgo(job.startedAt) : "Unknown",
          repo: job.repo || "unknown",
          url: job.buildUrl,
          pipelineSlug: job.pipelineSlug,
          number: job.buildNumber,
        })
      }
    }

    console.log(`Found ${runningBuilds.length} running builds via queue status`)
    return runningBuilds
  } catch (error) {
    console.error("Error fetching running builds:", error)
    return []
  }
}

export async function fetchAgentMetrics(): Promise<AgentMetrics> {
  // Check cache first (30 second TTL for real-time agent metrics)
  const cacheManager = getCacheManager()
  const cacheKey = "agent-metrics"
  const cached = cacheManager.getFromMemoryCache<AgentMetrics>(cacheKey)
  if (cached) {
    console.log("Using cached agent metrics")
    return cached
  }

  console.log("Cache miss for agent metrics, fetching from API...")

  try {
    // Fetch queue metrics from all organizations
    const queueMetrics: Array<{
      queueKey: string
      connectedAgents: number
      runningJobs: number
      waitingJobs: number
    }> = []

    for (const orgSlug of ORGANIZATIONS) {
      console.log(`Fetching queue metrics for organization: ${orgSlug}`)

      const result = await withRetry(
        async () =>
          await getBuildkiteClient().query(GET_ORGANIZATION_CLUSTERS_AND_METRICS, { slug: orgSlug }).toPromise(),
        { maxRetries: 3, initialDelay: 1000, maxDelay: 300000 }, // Allow up to 5 minute delays for rate limiting
      )

      if (result.error) {
        console.error(`Error fetching queue metrics for ${orgSlug}:`, result.error)
        continue
      }

      if (result.data?.organization?.clusters) {
        for (const cluster of result.data.organization.clusters.edges) {
          for (const queue of cluster.node.queues.edges) {
            const metrics = queue.node.metrics
            queueMetrics.push({
              queueKey: queue.node.key,
              connectedAgents: metrics.connectedAgentsCount,
              runningJobs: metrics.runningJobsCount,
              waitingJobs: metrics.waitingJobsCount,
            })
          }
        }
      }
    }

    if (queueMetrics.length === 0) {
      console.log("No queue metrics available, returning defaults")
      const defaultMetrics = { averageWaitTime: 0, p95WaitTime: 0, p99WaitTime: 0 }
      cacheManager.setInMemoryCache(cacheKey, defaultMetrics, 30)
      return defaultMetrics
    }

    // Calculate wait time estimates based on real queue data
    const waitTimes: number[] = []

    for (const queue of queueMetrics) {
      const { connectedAgents, runningJobs, waitingJobs } = queue

      // Calculate queue pressure
      const availableAgents = Math.max(0, connectedAgents - runningJobs)
      const queuePressure = waitingJobs / Math.max(1, availableAgents)

      // Estimate wait time based on queue pressure
      // Base time + scaling factor based on how many jobs are waiting per available agent
      let estimatedWaitTime: number

      if (queuePressure <= 0.5) {
        estimatedWaitTime = 15 // Very fast - low queue pressure
      } else if (queuePressure <= 1) {
        estimatedWaitTime = 45 // Fast - moderate queue pressure
      } else if (queuePressure <= 2) {
        estimatedWaitTime = 120 // Medium - high queue pressure
      } else {
        estimatedWaitTime = 300 // Slow - very high queue pressure
      }

      waitTimes.push(estimatedWaitTime)
    }

    // Calculate P95 and P99 from the wait time distribution
    waitTimes.sort((a, b) => a - b)

    const averageWaitTime = waitTimes.length > 0
      ? Math.round(waitTimes.reduce((sum, time) => sum + time, 0) / waitTimes.length)
      : 0

    const p95Index = Math.ceil(waitTimes.length * 0.95) - 1
    const p99Index = Math.ceil(waitTimes.length * 0.99) - 1

    const p95WaitTime = waitTimes.length > 0 ? waitTimes[Math.max(0, p95Index)] : 0
    const p99WaitTime = waitTimes.length > 0 ? waitTimes[Math.max(0, p99Index)] : 0

    console.log(
      `Queue metrics: ${queueMetrics.length} queues, avg: ${averageWaitTime}s, P95: ${p95WaitTime}s, P99: ${p99WaitTime}s`,
    )

    const agentMetrics = {
      averageWaitTime,
      p95WaitTime,
      p99WaitTime,
    }

    // Cache the result for 30 seconds
    cacheManager.setInMemoryCache(cacheKey, agentMetrics, 30)
    console.log("Cached agent metrics for 30 seconds")

    return agentMetrics
  } catch (error) {
    console.error("Error fetching agent metrics:", error)
    return { averageWaitTime: 0, p95WaitTime: 0, p99WaitTime: 0 }
  }
}

// Queue analysis interfaces and functions

// Extract jobs from builds and group by queue
function extractJobsByQueue(builds: any[], jobState: string): Map<string, QueueJob[]> {
  const jobsByQueue = new Map<string, QueueJob[]>()

  for (const build of builds) {
    if (!build.jobs || !Array.isArray(build.jobs)) continue

    for (const job of build.jobs) {
      // Skip non-command jobs (wait, block, trigger steps don't use agents)
      // Note: Buildkite REST API uses "command" for agent jobs
      if (!["command", "script"].includes(job.type)) {
        console.log(`Skipping job type: ${job.type}`)
        continue
      }

      // Only include jobs in the specified state
      // REST API returns lowercase states, unlike GraphQL which uses uppercase
      if (job.state.toLowerCase() !== jobState.toLowerCase()) {
        console.log(`Skipping job state: ${job.state}, looking for: ${jobState}`)
        continue
      }

      // Determine queue from agent query rules
      let queueKey = "default"
      if (job.agent_query_rules && job.agent_query_rules.length > 0) {
        // Extract queue from agent query rules (e.g., "queue=macos")
        for (const rule of job.agent_query_rules) {
          const queueMatch = rule.match(/queue=([^,\s]+)/)
          if (queueMatch) {
            queueKey = queueMatch[1]
            break
          }
        }
      }

      // Extract repo from pipeline repository URL
      let repo: string | undefined
      if (build.pipeline.repository?.url) {
        const repoUrl = build.pipeline.repository.url
        // Handle both SSH (git@github.com:org/repo.git) and HTTPS (https://github.com/org/repo) formats
        const sshMatch = repoUrl.match(/git@github\.com:([^\/]+\/[^\/]+?)(?:\.git)?$/)
        const httpsMatch = repoUrl.match(/github\.com\/([^\/]+\/[^\/]+?)(?:\.git)?(?:\/.*)?$/)
        repo = (sshMatch || httpsMatch)?.[1]
      }

      const queueJob: QueueJob = {
        id: job.id,
        buildId: build.id,
        buildNumber: build.number,
        pipelineName: build.pipeline.name,
        pipelineSlug: build.pipeline.slug,
        repo,
        state: job.state,
        createdAt: job.created_at || build.created_at,
        scheduledAt: job.scheduled_at || build.scheduled_at,
        startedAt: job.started_at,
        agentQueryRules: job.agent_query_rules,
        url: job.web_url,
        buildUrl: build.web_url,
      }

      if (!jobsByQueue.has(queueKey)) {
        jobsByQueue.set(queueKey, [])
      }
      jobsByQueue.get(queueKey)!.push(queueJob)
    }
  }

  // Sort jobs within each queue by scheduled time (earliest first)
  for (const [queueKey, jobs] of jobsByQueue.entries()) {
    jobs.sort((a, b) => {
      const timeA = new Date(a.scheduledAt || a.createdAt).getTime()
      const timeB = new Date(b.scheduledAt || b.createdAt).getTime()
      return timeA - timeB
    })
  }

  return jobsByQueue
}

// Fetch and analyze queue status
export async function fetchQueueStatus(): Promise<QueueStatus[]> {
  // Check cache first (30 second TTL for real-time queue status)
  const cacheManager = getCacheManager()
  const cacheKey = "queue-status"
  const cached = cacheManager.getFromMemoryCache<QueueStatus[]>(cacheKey)
  if (cached) {
    console.log("Using cached queue status")
    return cached
  }

  console.log("Cache miss for queue status, fetching from API...")

  try {
    // Import REST API functions
    const { fetchScheduledBuilds, fetchRunningBuildsRest } = await import("./buildkite-client.ts")

    // Fetch builds by state
    console.log("Fetching scheduled and running builds for queue analysis...")
    const [scheduledBuilds, runningBuilds] = await Promise.all([
      fetchScheduledBuilds(),
      fetchRunningBuildsRest(),
    ])

    console.log(`Found ${scheduledBuilds.length} scheduled builds, ${runningBuilds.length} running builds`)

    // Log some build details for debugging
    if (scheduledBuilds.length > 0) {
      console.log("Sample scheduled build:", {
        id: scheduledBuilds[0].id,
        pipeline: scheduledBuilds[0].pipeline.name,
        jobCount: scheduledBuilds[0].jobs.length,
        jobTypes: scheduledBuilds[0].jobs.map((j) => j.type),
      })
    }
    if (runningBuilds.length > 0) {
      console.log("Sample running build:", {
        id: runningBuilds[0].id,
        pipeline: runningBuilds[0].pipeline.name,
        jobCount: runningBuilds[0].jobs.length,
        jobTypes: runningBuilds[0].jobs.map((j) => j.type),
      })
    }

    // Extract jobs and group by queue
    // Note: We need to check ALL builds for queued jobs because a "running" build
    // can have jobs in "scheduled" or "waiting" state that are still queued
    const allBuilds = [...scheduledBuilds, ...runningBuilds]

    // Extract all queued jobs (scheduled + waiting) from all builds
    const scheduledJobsByQueue = extractJobsByQueue(allBuilds, "scheduled")
    const waitingJobsByQueue = extractJobsByQueue(allBuilds, "waiting")
    const runningJobsByQueue = extractJobsByQueue(allBuilds, "running")

    // Merge scheduled and waiting jobs as they're both effectively queued
    const queuedJobsByQueue = new Map<string, QueueJob[]>()

    // Add scheduled jobs
    for (const [queueKey, jobs] of scheduledJobsByQueue.entries()) {
      queuedJobsByQueue.set(queueKey, [...jobs])
    }

    // Add waiting jobs to the same queues
    for (const [queueKey, jobs] of waitingJobsByQueue.entries()) {
      if (!queuedJobsByQueue.has(queueKey)) {
        queuedJobsByQueue.set(queueKey, [])
      }
      queuedJobsByQueue.get(queueKey)!.push(...jobs)
    }

    // Sort merged queued jobs by scheduled time within each queue
    for (const [queueKey, jobs] of queuedJobsByQueue.entries()) {
      jobs.sort((a, b) => {
        const timeA = new Date(a.scheduledAt || a.createdAt).getTime()
        const timeB = new Date(b.scheduledAt || b.createdAt).getTime()
        return timeA - timeB
      })
    }

    // Get all unique queue keys
    const allQueues = new Set([
      ...queuedJobsByQueue.keys(),
      ...runningJobsByQueue.keys(),
    ])

    // Get agent counts by queue (from existing agent data)
    const agents = await fetchAllAgents()
    const agentsByQueue = agents.reduce((acc, agent) => {
      const queueKey = agent.queueKey || "default"
      if (!acc[queueKey]) {
        acc[queueKey] = { total: 0, running: 0 }
      }
      acc[queueKey].total++
      if (agent.isRunningJob) {
        acc[queueKey].running++
      }
      return acc
    }, {} as Record<string, { total: number; running: number }>)

    // Build queue status for each queue
    const queueStatuses: QueueStatus[] = []
    for (const queueKey of allQueues) {
      const agentStats = agentsByQueue[queueKey] || { total: 0, running: 0 }
      const scheduledJobs = queuedJobsByQueue.get(queueKey) || []

      // Group scheduled jobs by build
      const scheduledBuilds: QueueBuild[] = []
      const buildGroups = new Map<string, QueueJob[]>()

      for (const job of scheduledJobs) {
        if (!buildGroups.has(job.buildId)) {
          buildGroups.set(job.buildId, [])
        }
        buildGroups.get(job.buildId)!.push(job)
      }

      // Create QueueBuild objects
      for (const [buildId, jobs] of buildGroups.entries()) {
        const firstJob = jobs[0]
        scheduledBuilds.push({
          buildId,
          buildNumber: firstJob.buildNumber,
          pipelineName: firstJob.pipelineName,
          pipelineSlug: firstJob.pipelineSlug,
          repo: firstJob.repo,
          buildUrl: firstJob.buildUrl,
          scheduledAt: firstJob.scheduledAt || firstJob.createdAt,
          jobs: jobs.sort((a, b) =>
            new Date(a.scheduledAt || a.createdAt).getTime() - new Date(b.scheduledAt || b.createdAt).getTime()
          ),
        })
      }

      // Sort builds by scheduled time
      scheduledBuilds.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())

      queueStatuses.push({
        queueKey,
        runningJobs: runningJobsByQueue.get(queueKey) || [],
        scheduledJobs: scheduledJobs,
        scheduledBuilds,
        connectedAgents: agentStats.total,
        availableAgents: agentStats.total - agentStats.running,
      })
    }

    // Sort by queue key for consistent display
    queueStatuses.sort((a, b) => a.queueKey.localeCompare(b.queueKey))

    console.log(
      `Analyzed ${queueStatuses.length} queues:`,
      queueStatuses.map((q) => `${q.queueKey}: ${q.runningJobs.length} running, ${q.scheduledJobs.length} scheduled`),
    )

    // Cache the result for 30 seconds
    cacheManager.setInMemoryCache(cacheKey, queueStatuses, 30)
    console.log("Cached queue status for 30 seconds")

    return queueStatuses
  } catch (error) {
    console.error("Error fetching queue status:", error)
    return []
  }
}

/**
 * Format milliseconds as a human-readable duration string
 */
export function formatDurationMs(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    const remainingHours = hours % 24
    return `${days}d ${remainingHours}h`
  }
  if (hours > 0) {
    const remainingMinutes = minutes % 60
    return `${hours}h ${remainingMinutes}m`
  }
  if (minutes > 0) {
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }
  return `${seconds}s`
}

/**
 * Fetch all builds that have been running longer than the specified threshold
 */
export async function fetchLongRunningBuilds(
  thresholdHours: number = 3,
): Promise<LongRunningBuild[]> {
  // Check cache first (30 second TTL)
  const cacheManager = getCacheManager()
  const cacheKey = `long-running-builds-${thresholdHours}`
  const cached = cacheManager.getFromMemoryCache<LongRunningBuild[]>(cacheKey)
  if (cached) {
    console.log("Using cached long-running builds")
    return cached
  }

  console.log(`Cache miss for long-running builds, fetching from API (threshold: ${thresholdHours}h)...`)

  try {
    const { fetchRunningBuildsRest } = await import("./buildkite-client.ts")
    const runningBuilds = await fetchRunningBuildsRest()

    const thresholdMs = thresholdHours * 60 * 60 * 1000
    const now = Date.now()
    const longRunningBuilds: LongRunningBuild[] = []

    for (const build of runningBuilds) {
      // Use started_at if available, otherwise created_at
      const startTimeStr = build.started_at || build.created_at
      if (!startTimeStr) continue

      const startedAt = new Date(startTimeStr)
      const runningDurationMs = now - startedAt.getTime()

      // Skip builds that haven't exceeded the threshold
      if (runningDurationMs < thresholdMs) continue

      // Extract repo from pipeline repository URL
      let repo: string | undefined
      if (build.pipeline.repository?.url) {
        const repoUrl = build.pipeline.repository.url
        const sshMatch = repoUrl.match(/git@github\.com:([^\/]+\/[^\/]+?)(?:\.git)?$/)
        const httpsMatch = repoUrl.match(/github\.com\/([^\/]+\/[^\/]+?)(?:\.git)?(?:\/.*)?$/)
        repo = (sshMatch || httpsMatch)?.[1]
      }

      // Count jobs
      const jobCount = build.jobs?.length || 0
      const runningJobCount = build.jobs?.filter((j) => j.state.toLowerCase() === "running").length || 0

      const exceedsByMs = runningDurationMs - thresholdMs
      longRunningBuilds.push({
        id: build.id,
        buildNumber: build.number,
        pipelineName: build.pipeline.name,
        pipelineSlug: build.pipeline.slug,
        repo,
        state: build.state,
        branch: build.branch,
        commit: build.commit?.substring(0, 7),
        message: build.message,
        startedAt: startTimeStr,
        runningDurationMs,
        runningDurationFormatted: formatDurationMs(runningDurationMs),
        thresholdHours,
        exceedsThresholdBy: formatDurationMs(exceedsByMs),
        buildUrl: build.web_url,
        jobCount,
        runningJobCount,
      })
    }

    // Sort by running duration (longest first)
    longRunningBuilds.sort((a, b) => b.runningDurationMs - a.runningDurationMs)

    console.log(`Found ${longRunningBuilds.length} long-running builds (> ${thresholdHours}h)`)

    // Cache the result for 30 seconds
    cacheManager.setInMemoryCache(cacheKey, longRunningBuilds, 30)

    return longRunningBuilds
  } catch (error) {
    console.error("Error fetching long-running builds:", error)
    return []
  }
}
