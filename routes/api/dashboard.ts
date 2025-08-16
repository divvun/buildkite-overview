import { Context } from "fresh"
import { type AgentMetrics, type FailingPipeline, fetchAgentMetrics, fetchQueueStatus } from "~/utils/buildkite-data.ts"
import { type AppState } from "~/utils/middleware.ts"
import { fetchDashboardData } from "~/utils/pipeline-data-service.ts"
import { requireDivvunOrgAccess } from "~/utils/session.ts"

interface DashboardResponse {
  totalPipelines: number
  runningPipelines: number
  pendingBuilds: number
  agentMetrics: AgentMetrics
  failingPipelines: FailingPipeline[]
  error?: string
}

export const handler = {
  async GET(ctx: Context<AppState>): Promise<Response> {
    try {
      // Require authentication and divvun organization membership
      requireDivvunOrgAccess(ctx.req)

      console.log("API: Fetching dashboard data...")

      // Fetch all dashboard data with a single API call (uses caching)
      const [dashboardData, agentMetrics, queueStatus] = await Promise.all([
        fetchDashboardData(),
        fetchAgentMetrics(),
        fetchQueueStatus(),
      ])

      // Calculate total pending builds
      const pendingBuilds = queueStatus.reduce((total, queue) => total + queue.scheduledJobs.length, 0)

      console.log(
        `API Dashboard stats: ${dashboardData.pipelines.length} total pipelines, ${dashboardData.failingPipelines.length} failing, ${dashboardData.runningPipelinesCount} pipelines with running builds`,
      )

      const response: DashboardResponse = {
        totalPipelines: dashboardData.pipelines.length,
        runningPipelines: dashboardData.runningPipelinesCount,
        pendingBuilds,
        agentMetrics,
        failingPipelines: dashboardData.failingPipelines,
      }

      return new Response(JSON.stringify(response), {
        headers: { "Content-Type": "application/json" },
      })
    } catch (error) {
      console.error("API Error fetching dashboard data:", error)

      // Handle authentication errors (thrown as Response objects)
      if (error instanceof Response) {
        return error // Return the redirect response
      }

      const errorResponse: DashboardResponse = {
        totalPipelines: 0,
        runningPipelines: 0,
        pendingBuilds: 0,
        agentMetrics: { averageWaitTime: 0, p95WaitTime: 0, p99WaitTime: 0 },
        failingPipelines: [],
        error:
          "Unable to load dashboard data. This could be due to: 1) Missing BUILDKITE_API_KEY environment variable, 2) Invalid API key, or 3) Network connectivity issues. Please check your configuration and try again.",
      }

      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }
  },
}
