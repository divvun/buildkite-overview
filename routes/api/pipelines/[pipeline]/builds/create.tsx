import { Context, RouteHandler } from "fresh"
import { gql } from "graphql-tag"
import { type AppState, canAccessPipeline } from "~/utils/middleware.ts"
import { CREATE_BUILD_MUTATION, getBuildkiteClient } from "~/utils/buildkite-client.ts"
import { fetchAllPipelines } from "~/utils/buildkite-data.ts"
import { userHasPermission } from "~/utils/session.ts"

export const handler: RouteHandler<unknown, AppState> = {
  async POST(ctx: Context<AppState>) {
    const pipelineSlug = ctx.params.pipeline

    // Check if user has permission to create builds
    const session = ctx.state.session

    if (!session) {
      return new Response(
        JSON.stringify({
          error: "Authentication required",
          requireAuth: true,
          message: "Please sign in with GitHub to create builds",
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "X-Auth-Required": "github",
          },
        },
      )
    }

    // Check if user has permission to create builds (requires MEMBER role)
    if (!userHasPermission(session, "canCreateBuilds")) {
      return new Response(
        JSON.stringify({
          error: "Insufficient permissions",
          message: "You need member-level access to create builds",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    // Check if user has access to this pipeline
    try {
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

      // Create the build using GraphQL mutation
      const client = getBuildkiteClient()

      // Use the pipeline ID from AppPipeline to avoid extra query
      const pipelineGraphQLId = pipeline.id

      // If we need the default branch, query for it separately
      let defaultBranch = "main" // fallback

      if (pipelineGraphQLId) {
        // Query for pipeline's default branch
        const pipelineQuery = gql`
          query GetPipelineDefaultBranch($slug: ID!) {
            pipeline(slug: $slug) {
              defaultBranch
            }
          }
        `

        const fullPipelineSlug = `divvun/${pipelineSlug}`
        console.log(`Querying pipeline details for: ${fullPipelineSlug}`)

        const pipelineData = await client.query(pipelineQuery, { slug: fullPipelineSlug }).toPromise()

        // Check for GraphQL errors first
        if (pipelineData.error) {
          console.error("GraphQL query error:", pipelineData.error)
          return new Response(
            JSON.stringify({
              error: "Failed to query pipeline details",
              details: pipelineData.error.message || String(pipelineData.error),
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            },
          )
        }

        // Check if pipeline exists
        if (!pipelineData.data?.pipeline) {
          console.error(`Pipeline not found in Buildkite: ${fullPipelineSlug}`)
          return new Response(
            JSON.stringify({
              error: "Pipeline not found in Buildkite",
              details: `Pipeline '${pipelineSlug}' does not exist or you don't have access to it`,
            }),
            {
              status: 404,
              headers: { "Content-Type": "application/json" },
            },
          )
        }

        // Use the pipeline's default branch if available
        defaultBranch = pipelineData.data.pipeline.defaultBranch || "main"
        console.log(`Using branch: ${defaultBranch} for pipeline: ${pipelineSlug}`)
      }

      console.log(`Creating build for pipeline ID: ${pipelineGraphQLId}, branch: ${defaultBranch}`)

      const result = await client.mutation(CREATE_BUILD_MUTATION, {
        input: {
          pipelineID: pipelineGraphQLId,
          branch: defaultBranch,
          commit: "HEAD", // Use latest commit on the branch
        },
      }).toPromise()

      if (result.error) {
        console.error("GraphQL mutation error:", result.error)

        // Parse the error message to provide better feedback
        const errorMessage = result.error.message || String(result.error)
        let userFriendlyError = "Failed to create build"
        let statusCode = 500

        if (errorMessage.includes("commit") && errorMessage.includes("required")) {
          userFriendlyError = "Unable to create build: commit not found"
          statusCode = 400
        } else if (errorMessage.includes("branch") && errorMessage.includes("required")) {
          userFriendlyError = "Unable to create build: branch not found"
          statusCode = 400
        } else if (errorMessage.includes("permission") || errorMessage.includes("access")) {
          userFriendlyError = "Permission denied: you don't have access to create builds on this pipeline"
          statusCode = 403
        }

        return new Response(
          JSON.stringify({
            error: userFriendlyError,
            details: errorMessage,
          }),
          {
            status: statusCode,
            headers: { "Content-Type": "application/json" },
          },
        )
      }

      const newBuild = result.data?.buildCreate?.build
      if (!newBuild) {
        return new Response(
          JSON.stringify({ error: "Build creation failed - no build returned" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        )
      }

      console.log(`✅ Created new build #${newBuild.number} for pipeline ${pipelineSlug}`)

      return new Response(
        JSON.stringify({
          success: true,
          build: {
            id: newBuild.id,
            number: newBuild.number,
            url: newBuild.url,
            state: newBuild.state,
            pipeline: {
              slug: newBuild.pipeline.slug,
              name: newBuild.pipeline.name,
            },
          },
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      )
    } catch (error) {
      console.error("Error creating build:", error)
      return new Response(
        JSON.stringify({
          error: "Failed to create build",
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
