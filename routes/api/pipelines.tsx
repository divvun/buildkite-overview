import { Context, RouteHandler } from "fresh"
import { type AppState, filterPipelinesForUser } from "~/utils/middleware.ts"
import { enrichPipelinesWithGitHubData, fetchAllPipelines } from "~/utils/buildkite-data.ts"

export const handler: RouteHandler<unknown, AppState> = {
  async GET(ctx: Context<AppState>) {
    try {
      // Fetch pipeline data from Buildkite
      let pipelines = await fetchAllPipelines()

      // Enrich with GitHub data if authenticated
      if (ctx.state.session) {
        pipelines = await enrichPipelinesWithGitHubData(pipelines, ctx.state.session)
      }

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
