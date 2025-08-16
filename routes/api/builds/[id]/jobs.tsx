import { Context, RouteHandler } from "fresh"
import { type AppState } from "~/utils/middleware.ts"
import { getCacheManager } from "~/utils/cache/cache-manager.ts"

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
