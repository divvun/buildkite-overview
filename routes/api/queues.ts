import { Context } from "fresh"
import { fetchQueueStatus, type QueueStatus } from "~/utils/buildkite-data.ts"
import { type AppState } from "~/utils/middleware.ts"
import { requireDivvunOrgAccess } from "~/utils/session.ts"

interface QueuesResponse {
  queueStatus: QueueStatus[]
  error?: string
}

export const handler = {
  async GET(ctx: Context<AppState>): Promise<Response> {
    try {
      // Require authentication and divvun organization membership
      requireDivvunOrgAccess(ctx.req)

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
      console.error("API Error with authentication:", error)

      // Handle authentication errors (thrown as Response objects)
      if (error instanceof Response) {
        return error // Return the redirect response
      }

      const errorResponse: QueuesResponse = {
        queueStatus: [],
        error: "Authentication required",
      }

      return new Response(JSON.stringify(errorResponse), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }
  },
}
