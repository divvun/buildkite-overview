import { Context, RouteHandler } from "fresh"
import { type AppState } from "~/utils/middleware.ts"
import { getCacheManager } from "~/utils/cache/cache-manager.ts"

export const handler: RouteHandler<unknown, AppState> = {
  async GET(ctx: Context<AppState>) {
    const pipelineSlug = ctx.params.slug
    const url = new URL(ctx.url)
    const limit = parseInt(url.searchParams.get("limit") || "50")

    try {
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
