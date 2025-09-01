import { Context, RouteHandler } from "fresh"
import { type AppState, filterPipelinesForUser } from "~/server/middleware.ts"
import { fetchAllPipelines } from "~/server/buildkite-data.ts"

export const handler: RouteHandler<unknown, AppState> = {
  async GET(ctx: Context<AppState>) {
    try {
      // Fetch pipeline data from Buildkite (already enriched with GitHub data)
      const pipelines = await fetchAllPipelines()

      // Filter based on user access
      const visiblePipelines = filterPipelinesForUser(pipelines, ctx.state.session)

      return new Response(JSON.stringify(visiblePipelines), {
        headers: { "Content-Type": "application/json" },
      })
    } catch (error) {
      console.error("Error fetching pipelines:", error)
      return new Response(
        JSON.stringify({ error: "Failed to fetch pipelines" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      )
    }
  },
}
