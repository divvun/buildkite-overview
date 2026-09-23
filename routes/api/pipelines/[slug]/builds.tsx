import { Context, RouteHandler } from "fresh"
import { type AppState, canAccessPipeline } from "~/server/middleware.ts"
import { getCacheManager } from "~/server/cache/cache-manager.ts"
import { fetchAllPipelines } from "~/server/buildkite-data.ts"

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
      const { builds, staleReason } = await cacheManager.fetchAndCacheBuilds(pipelineSlug, limit)

      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (staleReason) {
        headers["X-Data-Stale"] = staleReason
      }

      return new Response(JSON.stringify(builds), { headers })
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
