import { Context } from "fresh"
import { fetchLongRunningBuilds, fetchQueueStatus } from "~/server/buildkite-data.ts"
import type { LongRunningBuild, QueueStatus } from "~/types/app.ts"
import { type AppState } from "~/server/middleware.ts"
import { userHasPermission } from "~/server/session.ts"

const LONG_RUNNING_THRESHOLD_HOURS = 3

interface QueuesResponse {
  queueStatus: QueueStatus[]
  longRunningBuilds: LongRunningBuild[]
  error?: string
}

export const handler = {
  async GET(ctx: Context<AppState>): Promise<Response> {
    // Check if user has permission to manage agents (includes queue management)
    if (!userHasPermission(ctx.state.session ?? null, "canManageAgents")) {
      const errorResponse: QueuesResponse = {
        queueStatus: [],
        longRunningBuilds: [],
        error: "Insufficient permissions to view queues",
      }

      return new Response(JSON.stringify(errorResponse), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })
    }

    try {
      console.log("API: Fetching queue status and long-running builds...")

      // Fetch queue status and long-running builds in parallel
      const [queueStatus, longRunningBuilds] = await Promise.all([
        fetchQueueStatus(),
        fetchLongRunningBuilds(LONG_RUNNING_THRESHOLD_HOURS),
      ])

      console.log(`API: Found ${queueStatus.length} queues, ${longRunningBuilds.length} long-running builds`)

      const response: QueuesResponse = {
        queueStatus,
        longRunningBuilds,
      }

      return new Response(JSON.stringify(response), {
        headers: { "Content-Type": "application/json" },
      })
    } catch (error) {
      console.error("API Error fetching queue status:", error)

      const errorResponse: QueuesResponse = {
        queueStatus: [],
        longRunningBuilds: [],
        error:
          "Unable to fetch queue status. This may be a temporary network issue or API rate limiting. Please wait a moment and try again.",
      }

      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }
  },
}
