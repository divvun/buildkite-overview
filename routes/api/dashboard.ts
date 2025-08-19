import { Context } from "fresh"
import { type AgentMetrics, type FailingPipeline, fetchAgentMetrics, fetchQueueStatus } from "~/utils/buildkite-data.ts"
import { type AppState, filterPipelinesForUser } from "~/utils/middleware.ts"
import { fetchDashboardData } from "~/utils/pipeline-data-service.ts"

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
      console.log("API: Fetching dashboard data...")

      // Fetch all dashboard data with a single API call (uses caching)
      const [dashboardData, agentMetrics, queueStatus] = await Promise.all([
        fetchDashboardData(),
        fetchAgentMetrics(),
        fetchQueueStatus(),
      ])

      // Filter pipelines based on user access
      const visiblePipelines = filterPipelinesForUser(dashboardData.pipelines, ctx.state.session)
      const visibleFailingPipelines = filterPipelinesForUser(dashboardData.failingPipelines, ctx.state.session)

      // Calculate metrics from visible pipelines
      const runningPipelines = visiblePipelines.filter((p) => p.status === "running").length

      // Calculate total pending builds
      const pendingBuilds = queueStatus.reduce((total, queue) => total + queue.scheduledJobs.length, 0)

      console.log(
        `API Dashboard stats: ${visiblePipelines.length} visible pipelines (${dashboardData.pipelines.length} total), ${visibleFailingPipelines.length} failing, ${runningPipelines} running`,
      )

      const response: DashboardResponse = {
        totalPipelines: visiblePipelines.length,
        runningPipelines: runningPipelines,
        pendingBuilds,
        agentMetrics,
        failingPipelines: visibleFailingPipelines,
      }

      return new Response(JSON.stringify(response), {
        headers: { "Content-Type": "application/json" },
      })
    } catch (error) {
      console.error("API Error fetching dashboard data:", error)

      // Handle response errors
      if (error instanceof Response) {
        return error
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
