import { Context, RouteHandler } from "fresh"
import { gql } from "graphql-tag"
import { type AppState, canAccessPipeline } from "~/utils/middleware.ts"
import { CREATE_BUILD_MUTATION, getBuildkiteClient } from "~/utils/buildkite-client.ts"
import { fetchAllPipelines } from "~/utils/buildkite-data.ts"
import { hasOrgAccess } from "~/utils/session.ts"

export const handler: RouteHandler<unknown, AppState> = {
  async POST(ctx: Context<AppState>) {
    const pipelineSlug = ctx.params.pipeline

    // Require real GitHub authentication for build creation (not mock dev user)
    if (!ctx.state.session || ctx.state.session.user.login === "dev-user") {
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

    // Now TypeScript knows session is not null due to the guard clause above
    const session = ctx.state.session
    if (!hasOrgAccess(session, "divvun") && !hasOrgAccess(session, "giellalt")) {
      return new Response(
        JSON.stringify({
          error: "Insufficient permissions",
          message: "You must be a member of the divvun or giellalt organization to create builds",
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
      const fullPipelineSlug = `divvun/${pipelineSlug}`

      // Find the pipeline by its slug to get the ID
      const pipelineQuery = gql`
        query GetPipelineId($slug: ID!) {
          pipeline(slug: $slug) {
            id
          }
        }
      `

      const pipelineData = await client.query(pipelineQuery, { slug: fullPipelineSlug }).toPromise()

      if (!pipelineData.data?.pipeline?.id) {
        return new Response(
          JSON.stringify({ error: "Pipeline not found in Buildkite" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          },
        )
      }

      const result = await client.mutation(CREATE_BUILD_MUTATION, {
        input: {
          pipelineID: pipelineData.data.pipeline.id,
          // Using API defaults - no branch, commit, or message specified
        },
      }).toPromise()

      if (result.error) {
        console.error("GraphQL mutation error:", result.error)
        return new Response(
          JSON.stringify({
            error: "Failed to create build",
            details: result.error.message,
          }),
          {
            status: 500,
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
