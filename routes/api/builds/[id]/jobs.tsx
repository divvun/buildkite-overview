import { Context, RouteHandler } from "fresh"
import { type AppState, canAccessPipeline } from "~/server/middleware.ts"
import { getCacheManager } from "~/server/cache/cache-manager.ts"
import { fetchAllPipelines } from "~/server/buildkite-data.ts"

export const handler: RouteHandler<unknown, AppState> = {
  async GET(ctx: Context<AppState>) {
    const buildId = ctx.params.id

    try {
      const cacheManager = getCacheManager()
      const result = await cacheManager.fetchAndCacheBuildById(buildId)

      if (!result) {
        return new Response(
          JSON.stringify({ error: "Build not found" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          },
        )
      }

      const { build, jobs } = result

      // Check if user has access to the pipeline this build belongs to
      if (build?.pipeline?.slug) {
        const allPipelines = await fetchAllPipelines()
        const pipeline = allPipelines.find((p) => p.slug === build.pipeline.slug)

        if (pipeline && !canAccessPipeline(pipeline, ctx.state.session)) {
          // Return 404 instead of 403 to avoid leaking build existence
          return new Response(
            JSON.stringify({ error: "Build not found" }),
            {
              status: 404,
              headers: { "Content-Type": "application/json" },
            },
          )
        }
      }

      return new Response(
        JSON.stringify({
          jobs,
          buildNumber: build?.number,
          pipelineSlug: build?.pipeline?.slug,
          pipelineName: build?.pipeline?.name,
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      )
    } catch (error) {
      console.error("Error fetching build jobs:", error)
      return new Response(
        JSON.stringify({ error: "Failed to fetch build jobs" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      )
    }
  },
}
