import {
  type BuildkiteAgent,
  buildkiteClient,
  type BuildkiteOrganization,
  type BuildkitePipeline,
  GET_ORGANIZATION_AGENTS,
  GET_ORGANIZATION_PIPELINES,
} from "./buildkite-client.ts"
import type { SessionData } from "./session.ts"
import { apiCache, withRetry } from "./retry-helper.ts"
import { normalizeStatus, ORGANIZATIONS } from "./formatters.ts"
import { getCacheManager } from "./cache/cache-manager.ts"

export interface AppPipeline {
  id: string
  name: string
  slug: string
  repo?: string
  status: string
  lastBuild: string
  tags: string[]
  visibility?: string
  builds: {
    total: number
    passed: number
    failed: number
  }
  url: string
}

export interface AppBuild {
  name: string
  status: string
  duration: string
  lastRun: string
  repo: string
  url: string
  pipelineSlug?: string
  number?: number
}

export interface BuildHistoryItem {
  status: "success" | "failed" | "running" | "cancelled"
  buildNumber: number
  finishedAt?: string
}

export interface FailingPipeline {
  id: string
  name: string
  slug: string
  repo?: string
  failingSince: Date
  last10Builds: BuildHistoryItem[]
  url: string
}

export interface AgentMetrics {
  averageWaitTime: number // in seconds
  p95WaitTime: number // in seconds
  p99WaitTime: number // in seconds
}

export interface AppAgent {
  id: string
  name: string
  hostname?: string
  connectionState: string
  isRunningJob: boolean
  operatingSystem?: string
  version?: string
  ipAddress?: string
  organization: string
  metadata?: Array<{
    key: string
    value: string
  }>
  currentJob?: {
    id: string
    state: string
    url?: string
    pipelineName: string
    pipelineSlug: string
    buildNumber: number
    buildUrl: string
    startedAt?: string
    duration?: string
  }
  createdAt: Date
  connectedAt?: Date
  disconnectedAt?: Date
  lastSeen?: Date
}

function mapBuildToHistoryItem(build: any): BuildHistoryItem {
  let status: "success" | "failed" | "running" | "cancelled"

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
    case "SCHEDULED":
    case "CREATING":
    case "WAITING":
    case "BLOCKED":
      status = "running"
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
    status: normalizeStatus(latestBuild?.state || "NOT_RUN"),
    lastBuild,
    tags: pipeline.tags?.map((tag) => tag.label) || [],
    visibility: pipeline.visibility.toLowerCase(),
    builds: buildStats,
    url: pipeline.url,
  }

  return mapped
}

function mapBuildkiteBuildToApp(build: any, pipelineName: string, pipelineSlug: string, repo?: string): AppBuild {
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
  const allBuilds: AppBuild[] = []

  for (const orgSlug of ORGANIZATIONS) {
    try {
      const result = await buildkiteClient.query(GET_ORGANIZATION_PIPELINES, { slug: orgSlug })

      if (result.error) {
        console.error(`Error fetching builds for ${orgSlug}:`, result.error)
        continue
      }

      if (result.data?.organization?.pipelines) {
        const orgBuilds: AppBuild[] = []

        for (const pipelineEdge of result.data.organization.pipelines.edges) {
          const pipeline = pipelineEdge.node
          const builds = pipeline.builds?.edges || []

          const repoUrl = pipeline.repository?.url
          let repo: string | undefined
          if (repoUrl) {
            const match = repoUrl.match(/github\.com\/([^\/]+\/[^\/]+)/)
            repo = match?.[1]
          }

          for (const buildEdge of builds) {
            orgBuilds.push(mapBuildkiteBuildToApp(buildEdge.node, pipeline.name, pipeline.slug, repo))
          }
        }

        orgBuilds.sort((a, b) => {
          const timeA = a.lastRun === "now" ? Date.now() : new Date(`${a.lastRun} ago`).getTime()
          const timeB = b.lastRun === "now" ? Date.now() : new Date(`${b.lastRun} ago`).getTime()
          return timeB - timeA
        })

        allBuilds.push(...orgBuilds.slice(0, limit))
      }
    } catch (error) {
      console.error(`Failed to fetch builds for ${orgSlug}:`, error)
    }
  }

  allBuilds.sort((a, b) => {
    if (a.lastRun === "now" && b.lastRun !== "now") return -1
    if (b.lastRun === "now" && a.lastRun !== "now") return 1
    return 0
  })

  return allBuilds.slice(0, limit)
}

export async function enrichPipelinesWithGitHubData(
  pipelines: AppPipeline[],
): Promise<AppPipeline[]> {
  // This function is now deprecated - GitHub enrichment is handled
  // automatically by the cache manager using the GITHUB_APP_TOKEN
  // Just return the pipelines as they already contain GitHub data
  return pipelines
}

function findFailingSince(builds: any[]): Date | null {
  // Find the first failed build in chronological order (reverse the array since it comes as last 10)
  const chronologicalBuilds = [...builds].reverse()

  for (let i = 0; i < chronologicalBuilds.length; i++) {
    const build = chronologicalBuilds[i]
    if (["FAILED", "WAITING_FAILED"].includes(build.state)) {
      // Find when this failing streak started
      for (let j = i - 1; j >= 0; j--) {
        const prevBuild = chronologicalBuilds[j]
        if (prevBuild.state === "PASSED") {
          // The failing streak started after this successful build
          return new Date(build.finishedAt || build.createdAt)
        }
      }
      // If we didn't find a successful build before, use the earliest failed build
      return new Date(build.finishedAt || build.createdAt)
    }
  }

  return null
}

export async function fetchFailingPipelines(): Promise<FailingPipeline[]> {
  const allPipelines = await fetchAllPipelines()
  const failingPipelines: FailingPipeline[] = []

  for (const pipeline of allPipelines) {
    if (pipeline.status === "failed") {
      try {
        const orgSlug = "divvun" // Default for now, could be extracted from pipeline data
        const result = await buildkiteClient.query(GET_ORGANIZATION_PIPELINES, { slug: orgSlug })

        const fullPipeline = result.data?.organization?.pipelines?.edges
          ?.find((edge) => edge.node.slug === pipeline.slug)?.node

        if (fullPipeline?.builds?.edges) {
          const builds = fullPipeline.builds.edges.map((edge) => edge.node)
          const failingSince = findFailingSince(builds)

          if (failingSince) {
            failingPipelines.push({
              id: pipeline.id,
              name: pipeline.name,
              slug: pipeline.slug,
              repo: pipeline.repo,
              failingSince,
              last10Builds: builds.map(mapBuildToHistoryItem),
              url: pipeline.url,
            })
          }
        }
      } catch (error) {
        console.error(`Failed to fetch detailed data for pipeline ${pipeline.slug}:`, error)
      }
    }
  }

  // Sort by failing since (most recent failures first)
  failingPipelines.sort((a, b) => b.failingSince.getTime() - a.failingSince.getTime())

  return failingPipelines
}

function mapBuildkiteAgentToApp(agent: BuildkiteAgent, orgSlug: string): AppAgent {
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
    metadata: undefined, // Not available in simplified query
    currentJob: undefined, // Not available in simplified query for now
    createdAt: new Date(agent.createdAt),
    connectedAt: agent.connectedAt ? new Date(agent.connectedAt) : undefined,
    disconnectedAt: agent.disconnectedAt ? new Date(agent.disconnectedAt) : undefined,
    lastSeen: agent.connectedAt ? new Date(agent.connectedAt) : undefined,
  }
}

export async function fetchAllAgents(): Promise<AppAgent[]> {
  const cacheManager = getCacheManager()
  return await cacheManager.getAgents()
}

export async function fetchRunningBuilds(): Promise<AppBuild[]> {
  const allRunningBuilds: AppBuild[] = []

  // Directly query for running builds from each organization
  for (const orgSlug of ORGANIZATIONS) {
    try {
      const result = await buildkiteClient.query(GET_ORGANIZATION_PIPELINES, { slug: orgSlug })

      if (result.error) {
        console.error(`Error fetching running builds for ${orgSlug}:`, result.error)
        continue
      }

      if (result.data?.organization?.pipelines) {
        for (const pipelineEdge of result.data.organization.pipelines.edges) {
          const pipeline = pipelineEdge.node
          const builds = pipeline.builds?.edges || []

          const repoUrl = pipeline.repository?.url
          let repo: string | undefined
          if (repoUrl) {
            const sshMatch = repoUrl.match(/git@github\.com:([^\/]+\/[^\/]+?)(?:\.git)?$/)
            const httpsMatch = repoUrl.match(/github\.com\/([^\/]+\/[^\/]+?)(?:\.git)?(?:\/.*)?$/)
            repo = (sshMatch || httpsMatch)?.[1]
          }

          // Only get currently running builds (not all recent builds)
          const runningBuilds = builds
            .filter((buildEdge) => {
              const state = buildEdge.node.state
              return ["RUNNING", "SCHEDULED", "CREATING", "WAITING", "BLOCKED"].includes(state)
            })
            .map((buildEdge) => mapBuildkiteBuildToApp(buildEdge.node, pipeline.name, pipeline.slug, repo))

          allRunningBuilds.push(...runningBuilds)
        }
      }
    } catch (error) {
      console.error(`Failed to fetch running builds for ${orgSlug}:`, error)
    }
  }

  // Sort by most recently started
  allRunningBuilds.sort((a, b) => {
    if (a.lastRun === "now" && b.lastRun !== "now") return -1
    if (b.lastRun === "now" && a.lastRun !== "now") return 1
    return 0
  })

  console.log(`Found ${allRunningBuilds.length} running builds`)
  return allRunningBuilds
}

export async function fetchAgentMetrics(): Promise<AgentMetrics> {
  // Placeholder implementation - Buildkite GraphQL might not have detailed wait time metrics
  // This would need to be implemented via REST API or other means
  return {
    averageWaitTime: 45, // 45 seconds placeholder
    p95WaitTime: 120, // 2 minutes placeholder
    p99WaitTime: 300, // 5 minutes placeholder
  }
}
