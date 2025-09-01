import { Context, RouteHandler } from "fresh"
import { type AppState } from "~/server/middleware.ts"
import { userHasPermission } from "~/server/session.ts"
import { getCacheManager } from "~/server/cache/cache-manager.ts"
import process from "node:process"

export const handler: RouteHandler<unknown, AppState> = {
  GET(ctx: Context<AppState>) {
    // Check if user has admin permissions for cache access
    if (!userHasPermission(ctx.state.session ?? null, "canAccessAdminFeatures")) {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions to access cache status" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    try {
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
    // Check if user has admin permissions for cache management
    if (!userHasPermission(ctx.state.session ?? null, "canAccessAdminFeatures")) {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions to manage cache" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    try {
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
