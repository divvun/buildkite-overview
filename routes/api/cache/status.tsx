import { Context, RouteHandler } from "fresh"
import { type AppState } from "~/utils/middleware.ts"
import { requireDivvunOrgAccess } from "~/utils/session.ts"
import { getCacheManager } from "~/utils/cache/cache-manager.ts"

export const handler: RouteHandler<unknown, AppState> = {
  async GET(ctx: Context<AppState>) {
    try {
      // Require divvun org access for cache status
      requireDivvunOrgAccess(ctx.req)

      const cacheManager = getCacheManager()
      const stats = cacheManager.getStats()

      return new Response(
        JSON.stringify({
          ...stats,
          timestamp: new Date().toISOString(),
          uptime: process.uptime ? `${Math.floor(process.uptime())}s` : "unknown",
          cacheImplementation: "SQLite + Memory",
          githubTokenConfigured: !!Deno.env.get("GITHUB_APP_TOKEN"),
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      )
    } catch (error) {
      if (error instanceof Response) {
        // This is a redirect response from requireDivvunOrgAccess
        return error
      }

      console.error("Error fetching cache status:", error)
      return new Response(
        JSON.stringify({ error: "Failed to fetch cache status" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      )
    }
  },

  async POST(ctx: Context<AppState>) {
    try {
      // Require divvun org access for cache refresh
      requireDivvunOrgAccess(ctx.req)

      const url = new URL(ctx.req.url)
      const action = url.searchParams.get("action")

      const cacheManager = getCacheManager()

      if (action === "refresh-pipelines") {
        console.log("Manual cache refresh requested for pipelines")
        const pipelines = await cacheManager.refreshPipelines()
        return new Response(
          JSON.stringify({
            success: true,
            message: `Refreshed ${pipelines.length} pipelines`,
            timestamp: new Date().toISOString(),
          }),
          {
            headers: { "Content-Type": "application/json" },
          },
        )
      } else if (action === "refresh-agents") {
        console.log("Manual cache refresh requested for agents")
        const agents = await cacheManager.refreshAgents()
        return new Response(
          JSON.stringify({
            success: true,
            message: `Refreshed ${agents.length} agents`,
            timestamp: new Date().toISOString(),
          }),
          {
            headers: { "Content-Type": "application/json" },
          },
        )
      } else {
        return new Response(
          JSON.stringify({ error: "Invalid action. Use 'refresh-pipelines' or 'refresh-agents'" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        )
      }
    } catch (error) {
      if (error instanceof Response) {
        // This is a redirect response from requireDivvunOrgAccess
        return error
      }

      console.error("Error performing cache action:", error)
      return new Response(
        JSON.stringify({ error: "Failed to perform cache action" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      )
    }
  },
}
