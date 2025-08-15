import { Context, RouteHandler } from "fresh"
import { type AppState } from "~/utils/middleware.ts"

const BUILDKITE_API_KEY = Deno.env.get("BUILDKITE_API_KEY")
const BUILDKITE_REST_API = "https://api.buildkite.com/v2"

export const handler: RouteHandler<unknown, AppState> = {
  async GET(ctx: Context<AppState>) {
    const jobId = ctx.params.id
    const url = new URL(ctx.url)
    const buildNumber = url.searchParams.get("build")
    const pipelineSlug = url.searchParams.get("pipeline")

    if (!buildNumber || !pipelineSlug) {
      return new Response(
        JSON.stringify({
          error: "Missing required parameters: build number and pipeline slug",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    if (!BUILDKITE_API_KEY) {
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
    } catch (e) {
      // If not base64, use as is
    }

    try {
      const logUrl =
        `${BUILDKITE_REST_API}/organizations/divvun/pipelines/${pipelineSlug}/builds/${buildNumber}/jobs/${uuid}/log`

      const response = await fetch(logUrl, {
        headers: {
          "Authorization": `Bearer ${BUILDKITE_API_KEY}`,
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
