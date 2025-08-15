import { Context, RouteHandler } from "fresh"
import { type AppState } from "~/utils/middleware.ts"
import { type BuildkiteBuild, buildkiteClient, GET_PIPELINE_BUILDS } from "~/utils/buildkite-client.ts"

export const handler: RouteHandler<unknown, AppState> = {
  async GET(ctx: Context<AppState>) {
    const pipelineSlug = ctx.params.slug
    const url = new URL(ctx.url)
    const limit = parseInt(url.searchParams.get("limit") || "50")

    try {
      const result = await buildkiteClient.query(GET_PIPELINE_BUILDS, {
        pipelineSlug: `divvun/${pipelineSlug}`,
        first: limit,
      })

      if (result.error) {
        console.error("Error fetching pipeline builds:", result.error)
        return new Response(
          JSON.stringify({ error: "Failed to fetch builds" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        )
      }

      const builds = result.data?.pipeline?.builds?.edges?.map((edge) => edge.node) || []

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
