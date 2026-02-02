import { Context } from "fresh"
import type { AppState } from "~/server/middleware.ts"
import { type BuildkiteBuildRest, fetchBuildsByState } from "~/server/buildkite-client.ts"
import { userHasPermission } from "~/server/session.ts"

interface BuildHistoryResponse {
  builds: BuildkiteBuildRest[]
  error?: string
}

export const handler = {
  async GET(ctx: Context<AppState>): Promise<Response> {
    // Check if user has admin features permission
    if (!userHasPermission(ctx.state.session ?? null, "canAccessAdminFeatures")) {
      const errorResponse: BuildHistoryResponse = {
        builds: [],
        error: "Insufficient permissions to view build history",
      }

      return new Response(JSON.stringify(errorResponse), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })
    }

    try {
      const url = new URL(ctx.req.url)
      const limit = parseInt(url.searchParams.get("limit") || "50")

      console.log(`[/api/admin/builds] Fetching completed build history (limit: ${limit})...`)

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

      console.log(`[/api/admin/builds] Returning ${limitedBuilds.length} completed builds`)

      const response: BuildHistoryResponse = {
        builds: limitedBuilds,
      }

      return new Response(JSON.stringify(response), {
        headers: { "Content-Type": "application/json" },
      })
    } catch (error) {
      console.error("[/api/admin/builds] Error fetching build history:")
      console.error("[/api/admin/builds] Error type:", error?.constructor?.name)
      console.error("[/api/admin/builds] Error message:", error instanceof Error ? error.message : String(error))
      if (error instanceof Error && error.stack) {
        console.error("[/api/admin/builds] Stack trace:", error.stack)
      }

      // Handle response errors
      if (error instanceof Response) {
        return error
      }

      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorResponse: BuildHistoryResponse = {
        builds: [],
        error: `Unable to load build history: ${errorMessage}`,
      }

      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }
  },
}
