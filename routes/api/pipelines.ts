import { Context } from "fresh"
import { type AppPipeline, fetchAllPipelines } from "~/utils/buildkite-data.ts"
import { type AppState, filterPipelinesForUser } from "~/utils/middleware.ts"
import { requireDivvunOrgAccess } from "~/utils/session.ts"

interface PipelinesResponse {
  pipelines: AppPipeline[]
  statusFilter?: string
  searchQuery?: string
  error?: string
}

export const handler = {
  async GET(ctx: Context<AppState>): Promise<Response> {
    try {
      // Require authentication and divvun organization membership
      requireDivvunOrgAccess(ctx.req)

      // Get filter parameters from URL
      const url = new URL(ctx.req.url)
      const statusFilter = url.searchParams.get("status") || ""
      const searchQuery = url.searchParams.get("search") || ""

      try {
        console.log("API: Fetching all pipelines from Buildkite API...")

        // Fetch real pipeline data from Buildkite (already enriched with GitHub data)
        const pipelines = await fetchAllPipelines()

        // Filter pipelines based on user access
        let visiblePipelines = filterPipelinesForUser(pipelines, ctx.state.session)

        // Apply status filter
        if (statusFilter) {
          visiblePipelines = visiblePipelines.filter((p) => p.status === statusFilter)
        }

        // Apply search filter
        if (searchQuery) {
          visiblePipelines = visiblePipelines.filter((p) =>
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.repo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
          )
        }

        console.log(
          `API: Returning ${visiblePipelines.length} visible pipelines (filtered by status: ${
            statusFilter || "none"
          }, search: ${searchQuery || "none"})`,
        )

        const response: PipelinesResponse = {
          pipelines: visiblePipelines,
          statusFilter,
          searchQuery,
        }

        return new Response(JSON.stringify(response), {
          headers: { "Content-Type": "application/json" },
        })
      } catch (error) {
        console.error("API Error fetching pipelines:", error)

        const errorResponse: PipelinesResponse = {
          pipelines: [],
          statusFilter,
          searchQuery,
          error:
            "Unable to load pipelines from Buildkite. This usually indicates an authentication issue. Please verify your BUILDKITE_API_KEY environment variable is set correctly and has the necessary permissions.",
        }

        return new Response(JSON.stringify(errorResponse), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        })
      }
    } catch (error) {
      console.error("API Error with authentication:", error)

      // Handle authentication errors (thrown as Response objects)
      if (error instanceof Response) {
        return error // Return the redirect response
      }

      const errorResponse: PipelinesResponse = {
        pipelines: [],
        error: "Authentication required",
      }

      return new Response(JSON.stringify(errorResponse), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }
  },
}
