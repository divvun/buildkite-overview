import { Context, RouteHandler } from "fresh"
import { type AppState, canAccessPipeline } from "~/utils/middleware.ts"
import { getCacheManager } from "~/utils/cache/cache-manager.ts"
import { fetchAllPipelines } from "~/utils/buildkite-data.ts"
import { userHasPermission } from "~/utils/session.ts"
import { getBuildkiteApiKey } from "~/utils/config.ts"
const BUILDKITE_REST_API = "https://api.buildkite.com/v2"

export const handler: RouteHandler<unknown, AppState> = {
  async GET(ctx: Context<AppState>) {
    const jobId = ctx.params.id
    const buildNumber = ctx.params.build
    const pipelineSlug = ctx.params.pipeline

    // Check if user is authenticated (job logs require GitHub login)
    if (!ctx.state.session) {
      return new Response(
        JSON.stringify({
          error: "Authentication required",
          requireAuth: true,
          message: "Please sign in with GitHub to view build logs",
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "X-Auth-Required": "github",
          },
        },
      )
    }

    // Check if user has access to this pipeline
    try {
      const allPipelines = await fetchAllPipelines()
      const pipeline = allPipelines.find((p) => p.slug === pipelineSlug)

      if (!pipeline) {
        return new Response(
          JSON.stringify({ error: "Job not found" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          },
        )
      }

      if (!canAccessPipeline(pipeline, ctx.state.session)) {
        // Return 404 instead of 403 to avoid leaking job existence
        return new Response(
          JSON.stringify({ error: "Job not found" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          },
        )
      }
    } catch (err) {
      console.error("Error checking pipeline access:", err)
      return new Response(
        JSON.stringify({ error: "Error verifying access" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    // Extract UUID from GraphQL ID if it's base64 encoded
    let uuid = jobId
    try {
      const decodedId = atob(jobId)
      if (
        decodedId.startsWith("JobTypeCommand---") || decodedId.startsWith("JobTypeBlock---") ||
        decodedId.startsWith("JobTypeTrigger---") || decodedId.startsWith("JobTypeWait---")
      ) {
        uuid = decodedId.replace(/^JobType\w+---/, "")
      }
    } catch (_e) {
      // If not base64, use as is
    }

    const cacheManager = getCacheManager()

    // Try to get log from cache first
    const cachedLog = await cacheManager.getCachedJobLog(pipelineSlug, parseInt(buildNumber), uuid)
    if (cachedLog) {
      console.log(`Cache hit: job log for ${pipelineSlug}#${buildNumber}/${uuid}`)
      return new Response(
        JSON.stringify({
          content: cachedLog,
          contentType: "text/plain",
          jobId: uuid,
          build: buildNumber,
          pipeline: pipelineSlug,
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    // Get job info to determine if it's finished (for proper caching TTL)
    let cachedJob = await cacheManager.getCachedJob(pipelineSlug, parseInt(buildNumber), uuid)

    // If we don't have the job cached, fetch the build to get job info
    if (!cachedJob) {
      console.log(`No cached job info for ${uuid}, fetching build to get job details`)
      // We need to find the build ID first - try to get it from the build number
      const builds = await cacheManager.fetchAndCacheBuilds(pipelineSlug, 50)
      const targetBuild = builds.find((build) => build.number === parseInt(buildNumber))

      if (targetBuild?.id) {
        const buildResult = await cacheManager.fetchAndCacheBuildById(targetBuild.id)
        if (buildResult) {
          // Find our specific job in the cached build jobs using UUID or ID
          cachedJob = buildResult.jobs.find((job) =>
            job.uuid === uuid || job.uuid === jobId || job.id === jobId || job.id === uuid
          )
        }
      }
    }

    let isJobFinished = false
    if (cachedJob) {
      // Job states that indicate completion: passed, failed, canceled
      isJobFinished = ["passed", "failed", "canceled"].includes(cachedJob.state?.toLowerCase())
    }

    const buildkiteApiKey = getBuildkiteApiKey()
    if (!buildkiteApiKey) {
      return new Response(
        JSON.stringify({
          error: "Buildkite API key not configured",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    // No cache miss - need to fetch from API
    console.log(`Cache miss: fetching job log for ${pipelineSlug}#${buildNumber}/${jobId} from API`)

    try {
      const logUrl =
        `${BUILDKITE_REST_API}/organizations/divvun/pipelines/${pipelineSlug}/builds/${buildNumber}/jobs/${uuid}/log`

      const response = await fetch(logUrl, {
        headers: {
          "Authorization": `Bearer ${buildkiteApiKey}`,
          "Accept": "text/plain",
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          return new Response(
            JSON.stringify({
              error: "Job logs not found. The job may not have started yet or logs may not be available.",
            }),
            {
              status: 404,
              headers: { "Content-Type": "application/json" },
            },
          )
        }

        if (response.status === 403) {
          return new Response(
            JSON.stringify({
              error:
                "Access denied to job logs. This may be due to insufficient API permissions or the logs may have been purged.",
            }),
            {
              status: 403,
              headers: { "Content-Type": "application/json" },
            },
          )
        }

        throw new Error(`Buildkite API error: ${response.status} ${response.statusText}`)
      }

      const logContent = await response.text()

      // We should always have job info by now, but if not, default to frequent updates
      if (!cachedJob) {
        console.warn(`Could not determine job completion status for ${uuid}, defaulting to short TTL`)
        isJobFinished = false
      }

      await cacheManager.cacheJobLog(pipelineSlug, parseInt(buildNumber), uuid, logContent, isJobFinished)

      return new Response(
        JSON.stringify({
          content: logContent,
          contentType: "text/plain",
          jobId: uuid,
          build: buildNumber,
          pipeline: pipelineSlug,
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      )
    } catch (error) {
      console.error("Error fetching job logs:", error)
      return new Response(
        JSON.stringify({
          error: "Failed to fetch job logs from Buildkite API",
          details: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      )
    }
  },
}
