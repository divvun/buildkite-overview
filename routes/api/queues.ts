import { Context } from "fresh"
import { fetchQueueStatus } from "~/server/buildkite-data.ts"
import type { QueueStatus } from "~/types/app.ts"
import { type AppState } from "~/server/middleware.ts"
import { userHasPermission } from "~/server/session.ts"

interface QueuesResponse {
  queueStatus: QueueStatus[]
  error?: string
}

export const handler = {
  async GET(ctx: Context<AppState>): Promise<Response> {
    // Check if user has permission to manage agents (includes queue management)
    if (!userHasPermission(ctx.state.session ?? null, "canManageAgents")) {
      const errorResponse: QueuesResponse = {
        queueStatus: [],
        error: "Insufficient permissions to view queues",
      }

      return new Response(JSON.stringify(errorResponse), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })
    }

    try {
      try {
        console.log("API: Fetching queue status data...")

        // Fetch queue status
        const queueStatus = await fetchQueueStatus()

        console.log(`API: Found ${queueStatus.length} queues`)

        const response: QueuesResponse = {
          queueStatus,
        }

        return new Response(JSON.stringify(response), {
          headers: { "Content-Type": "application/json" },
        })
      } catch (error) {
        console.error("API Error fetching queue status:", error)

        const errorResponse: QueuesResponse = {
          queueStatus: [],
          error:
            "Unable to fetch queue status. This may be a temporary network issue or API rate limiting. Please wait a moment and try again.",
        }

        return new Response(JSON.stringify(errorResponse), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        })
      }
    } catch (error) {
      console.error("API Error fetching queue status:", error)

      const errorResponse: QueuesResponse = {
        queueStatus: [],
        error: "Failed to fetch queue status data",
      }

      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }
  },
}
