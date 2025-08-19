import { Context, RouteHandler } from "fresh"
import { type AppState, canAccessPipeline } from "~/utils/middleware.ts"
import { getCacheManager } from "~/utils/cache/cache-manager.ts"
import { fetchAllPipelines } from "~/utils/buildkite-data.ts"

export const handler: RouteHandler<unknown, AppState> = {
  async GET(ctx: Context<AppState>) {
    const pipelineSlug = ctx.params.slug
    const url = new URL(ctx.url)
    const limit = parseInt(url.searchParams.get("limit") || "50")

    try {
      // First, verify that user has access to this pipeline
      const allPipelines = await fetchAllPipelines()
      const pipeline = allPipelines.find((p) => p.slug === pipelineSlug)

      if (!pipeline) {
        return new Response(
          JSON.stringify({ error: "Pipeline not found" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          },
        )
      }

      // Check if user has access to this pipeline
      if (!canAccessPipeline(pipeline, ctx.state.session)) {
        // Return 404 instead of 403 to avoid leaking pipeline existence
        return new Response(
          JSON.stringify({ error: "Pipeline not found" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          },
        )
      }

      const cacheManager = getCacheManager()
      const builds = await cacheManager.fetchAndCacheBuilds(pipelineSlug, limit)

      return new Response(JSON.stringify(builds), {
        headers: { "Content-Type": "application/json" },
      })
    } catch (error) {
      console.error("Error fetching pipeline builds:", error)
      return new Response(
        JSON.stringify({ error: "Failed to fetch builds" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      )
    }
  },
}
