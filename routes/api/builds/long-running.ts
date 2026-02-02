import { Context } from "fresh"
import { fetchLongRunningBuilds } from "~/server/buildkite-data.ts"
import type { LongRunningBuild } from "~/types/app.ts"
import { type AppState } from "~/server/middleware.ts"
import { userHasPermission } from "~/server/session.ts"

interface LongRunningBuildsResponse {
  builds: LongRunningBuild[]
  thresholdHours: number
  error?: string
}

export const handler = {
  async GET(ctx: Context<AppState>): Promise<Response> {
    // Check if user has permission to manage agents (includes build management)
    if (!userHasPermission(ctx.state.session ?? null, "canManageAgents")) {
      const errorResponse: LongRunningBuildsResponse = {
        builds: [],
        thresholdHours: 3,
        error: "Insufficient permissions to view long-running builds",
      }

      return new Response(JSON.stringify(errorResponse), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })
    }

    try {
      // Parse query parameters
      const url = new URL(ctx.req.url)
      const thresholdParam = url.searchParams.get("threshold")

      // Validate and parse threshold (default 3 hours, range 0-24)
      let thresholdHours = 3
      if (thresholdParam) {
        const parsed = parseFloat(thresholdParam)
        if (isNaN(parsed) || parsed < 0 || parsed > 24) {
          const errorResponse: LongRunningBuildsResponse = {
            builds: [],
            thresholdHours: 3,
            error: "Invalid threshold parameter. Must be a number between 0 and 24.",
          }

          return new Response(JSON.stringify(errorResponse), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          })
        }
        thresholdHours = parsed
      }

      console.log(`API: Fetching long-running builds (threshold: ${thresholdHours}h)...`)

      const builds = await fetchLongRunningBuilds(thresholdHours)

      console.log(`API: Found ${builds.length} long-running builds`)

      const response: LongRunningBuildsResponse = {
        builds,
        thresholdHours,
      }

      return new Response(JSON.stringify(response), {
        headers: { "Content-Type": "application/json" },
      })
    } catch (error) {
      console.error("API Error fetching long-running builds:", error)

      const errorResponse: LongRunningBuildsResponse = {
        builds: [],
        thresholdHours: 3,
        error:
          "Unable to fetch long-running builds. This may be a temporary network issue or API rate limiting. Please wait a moment and try again.",
      }

      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }
  },
}
