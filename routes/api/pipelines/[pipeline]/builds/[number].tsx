import { Context, RouteHandler } from "fresh"
import {
  type BuildkiteBuild,
  type BuildkiteJob,
  GET_BUILD_DETAILS,
  GET_PIPELINE_BUILDS,
  getBuildkiteClient,
} from "~/utils/buildkite-client.ts"
import { fetchAllPipelines } from "~/utils/buildkite-data.ts"
import { type AppState, canAccessPipeline } from "~/utils/middleware.ts"
import { withRetry } from "~/utils/retry-helper.ts"

export const handler: RouteHandler<unknown, AppState> = {
  async GET(ctx: Context<AppState>) {
    const pipelineSlug = ctx.params.pipeline
    const buildNumber = parseInt(ctx.params.number)

    if (isNaN(buildNumber)) {
      return new Response(
        JSON.stringify({ error: "Invalid build number" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

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

      // Buildkite GraphQL API expects format: organization-slug/pipeline-slug
      const fullPipelineSlug = `divvun/${pipelineSlug}`

      // Fetch builds to find the specific build
      const result = await withRetry(
        async () =>
          await getBuildkiteClient().query(GET_PIPELINE_BUILDS, {
            pipelineSlug: fullPipelineSlug,
            first: 100, // Increase limit to find older builds
          }).toPromise(),
        { maxRetries: 3, initialDelay: 1000, maxDelay: 300000 },
      )

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

      const builds = result.data?.pipeline?.builds?.edges?.map((edge: { node: BuildkiteBuild }) => edge.node) || []
      const build = builds.find((b: BuildkiteBuild) => b.number === buildNumber)

      if (!build) {
        return new Response(
          JSON.stringify({
            error: "Build not found",
            message: `Build #${buildNumber} not found in pipeline ${pipelineSlug}`,
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          },
        )
      }

      // Fetch jobs for this build
      const decodedId = atob(build.id)
      const uuid = decodedId.split("---")[1]
      const buildDetailsResult = await withRetry(
        async () =>
          await getBuildkiteClient().query(GET_BUILD_DETAILS, {
            uuid: uuid,
          }).toPromise(),
        { maxRetries: 3, initialDelay: 1000, maxDelay: 300000 },
      )

      const jobs = (buildDetailsResult.data?.build?.jobs?.edges?.map((edge: any) =>
        edge?.node
      ).filter((job: any): job is BuildkiteJob =>
        job != null
      ) || []) as BuildkiteJob[]

      return new Response(
        JSON.stringify({
          build,
          jobs,
          pipelineSlug,
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      )
    } catch (error) {
      console.error("Error fetching build details:", error)

      return new Response(
        JSON.stringify({
          error: "Failed to load build details",
          details: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      )
    }
  },
}
