import { Context, RouteHandler } from "fresh"
import { type AppState } from "~/utils/middleware.ts"
import { buildkiteClient, GET_BUILD_DETAILS } from "~/utils/buildkite-client.ts"

export const handler: RouteHandler<unknown, AppState> = {
  async GET(ctx: Context<AppState>) {
    const buildId = ctx.params.id

    try {
      // Decode the base64 build ID to extract the UUID
      const decodedId = atob(buildId) // "Build---uuid" format
      const uuid = decodedId.split("---")[1] // Extract just the UUID part

      const result = await buildkiteClient.query(GET_BUILD_DETAILS, {
        uuid: uuid,
      })

      if (result.error) {
        console.error("Error fetching build details:", result.error)
        return new Response(
          JSON.stringify({ error: "Failed to fetch build jobs" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        )
      }

      const build = result.data?.build
      const jobs = build?.jobs?.edges?.map((edge) => edge.node) || []

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
