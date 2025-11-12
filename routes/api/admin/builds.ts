import { Context } from "fresh"
import type { AppState } from "~/server/middleware.ts"
import { requireAdminFeatures } from "~/server/middleware.ts"
import { type BuildkiteBuildRest, fetchBuildsByState } from "~/server/buildkite-client.ts"

interface BuildHistoryResponse {
  builds: BuildkiteBuildRest[]
  error?: string
}

export const handler = [
  requireAdminFeatures,
  {
    async GET(ctx: Context<AppState>): Promise<Response> {
      try {
        const url = new URL(ctx.req.url)
        const limit = parseInt(url.searchParams.get("limit") || "50")

        console.log(`API: Fetching completed build history (limit: ${limit})...`)

        // Fetch all terminal state builds from the divvun organization
        const builds = await fetchBuildsByState("divvun", ["passed", "failed", "cancelled", "blocked"])

        // Filter to only include builds that have finished_at set
        const completedBuilds = builds.filter((build) => build.finished_at)

        // Sort by finished_at descending (newest first)
        completedBuilds.sort((a, b) => {
          const timeA = a.finished_at ? new Date(a.finished_at).getTime() : 0
          const timeB = b.finished_at ? new Date(b.finished_at).getTime() : 0
          return timeB - timeA
        })

        // Limit to requested number of builds
        const limitedBuilds = completedBuilds.slice(0, limit)

        console.log(`API: Returning ${limitedBuilds.length} completed builds`)

        const response: BuildHistoryResponse = {
          builds: limitedBuilds,
        }

        return new Response(JSON.stringify(response), {
          headers: { "Content-Type": "application/json" },
        })
      } catch (error) {
        console.error("API Error fetching build history:", error)

        // Handle response errors
        if (error instanceof Response) {
          return error
        }

        const errorResponse: BuildHistoryResponse = {
          builds: [],
          error:
            "Unable to load build history. This could be due to: 1) Missing BUILDKITE_API_KEY environment variable, 2) Invalid API key, or 3) Network connectivity issues. Please check your configuration and try again.",
        }

        return new Response(JSON.stringify(errorResponse), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        })
      }
    },
  },
]
