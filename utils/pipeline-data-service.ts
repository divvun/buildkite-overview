import { getCacheManager } from "./cache/cache-manager.ts"
import type { AppBuild, AppPipeline, BuildHistoryItem, FailingPipeline } from "./buildkite-data.ts"

export interface DashboardData {
  pipelines: AppPipeline[]
  failingPipelines: FailingPipeline[]
  recentBuilds: AppBuild[]
  runningBuilds: AppBuild[]
  runningPipelinesCount: number
}

/**
 * Unified data service that fetches pipeline data once and derives all dashboard metrics
 */
export async function fetchDashboardData(): Promise<DashboardData> {
  console.log("Fetching unified dashboard data...")

  // Single fetch of all pipeline data (uses multi-level caching)
  const pipelines = await getCacheManager().getPipelines()

  console.log(`Processing ${pipelines.length} pipelines for dashboard metrics`)

  // Extract all dashboard data from the single fetch
  const failingPipelines = extractFailingPipelines(pipelines)
  const recentBuilds = extractRecentBuilds(pipelines, 50)
  const runningBuilds = extractRunningBuilds(pipelines)
  const runningPipelinesCount = countRunningPipelines(pipelines)

  console.log(
    `Dashboard metrics: ${failingPipelines.length} failing, ${recentBuilds.length} recent builds, ${runningBuilds.length} running builds, ${runningPipelinesCount} pipelines with running builds`,
  )

  return {
    pipelines,
    failingPipelines,
    recentBuilds,
    runningBuilds,
    runningPipelinesCount,
  }
}

/**
 * Extract failing pipelines from cached pipeline data
 * Uses the last 10 builds that are already available in each pipeline
 */
export function extractFailingPipelines(pipelines: AppPipeline[]): FailingPipeline[] {
  const failingPipelines: FailingPipeline[] = []

  for (const pipeline of pipelines) {
    if (pipeline.status === "failed") {
      // Use actual build history from the cached pipeline data
      const last10Builds = pipeline.buildHistory || []

      // If we have build history, use it; otherwise skip this pipeline
      if (last10Builds.length > 0) {
        // Find when failing started using real build data
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
  }

  // Sort by failing since (most recent failures first)
  failingPipelines.sort((a, b) => b.failingSince.getTime() - a.failingSince.getTime())

  return failingPipelines
}

/**
 * Extract recent builds from cached pipeline data
 * Uses the last 10 builds that are already available in each pipeline
 */
export function extractRecentBuilds(pipelines: AppPipeline[], limit: number = 20): AppBuild[] {
  const allBuilds: AppBuild[] = []

  for (const pipeline of pipelines) {
    // Create builds from the pipeline's last build info
    // Since we don't have individual build details in the pipeline cache,
    // we create a representative build based on the pipeline's current state
    if (pipeline.lastBuild !== "Never") {
      const build: AppBuild = {
        name: pipeline.name,
        status: pipeline.status,
        duration: "0s", // Would need build details for accurate duration
        lastRun: pipeline.lastBuild,
        repo: pipeline.repo || "unknown",
        url: pipeline.url,
        pipelineSlug: pipeline.slug,
        number: 1, // Would need build details for accurate number
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

/**
 * Extract running builds from cached pipeline data
 */
export function extractRunningBuilds(pipelines: AppPipeline[]): AppBuild[] {
  const runningBuilds: AppBuild[] = []

  for (const pipeline of pipelines) {
    if (pipeline.status === "running") {
      const build: AppBuild = {
        name: pipeline.name,
        status: "running",
        duration: "0s", // Would need build details for accurate duration
        lastRun: pipeline.lastBuild,
        repo: pipeline.repo || "unknown",
        url: pipeline.url,
        pipelineSlug: pipeline.slug,
        number: 1, // Would need build details for accurate number
      }

      runningBuilds.push(build)
    }
  }

  // Sort by most recently started
  runningBuilds.sort((a, b) => {
    if (a.lastRun === "now" && b.lastRun !== "now") return -1
    if (b.lastRun === "now" && a.lastRun !== "now") return 1
    return 0
  })

  return runningBuilds
}

/**
 * Count unique pipelines that have running builds
 */
export function countRunningPipelines(pipelines: AppPipeline[]): number {
  return pipelines.filter((pipeline) => pipeline.status === "running").length
}

/**
 * Helper function to determine when a pipeline started failing
 */
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
