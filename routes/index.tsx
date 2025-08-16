/// <reference path="../types/webawesome.d.ts" />
import { Context, page } from "fresh"
import Layout from "~/components/Layout.tsx"
import AutoRefresh from "~/islands/AutoRefresh.tsx"
import DashboardContent from "~/islands/DashboardContent.tsx"
import { type AgentMetrics, type FailingPipeline, fetchAgentMetrics, fetchQueueStatus } from "~/utils/buildkite-data.ts"
import { AUTO_REFRESH_INTERVAL_SECONDS } from "~/utils/constants.ts"
import { type AppState } from "~/utils/middleware.ts"
import { fetchDashboardData } from "~/utils/pipeline-data-service.ts"
import { type SessionData } from "~/utils/session.ts"

interface HomeProps {
  session?: SessionData | null
  totalPipelines: number
  runningPipelines: number
  pendingBuilds: number
  agentMetrics: AgentMetrics
  failingPipelines: FailingPipeline[]
  error?: string
}

export const handler = {
  async GET(ctx: Context<AppState>) {
    try {
      console.log("Fetching dashboard data...")

      // Fetch all dashboard data with a single API call (uses caching)
      const [dashboardData, agentMetrics, queueStatus] = await Promise.all([
        fetchDashboardData(),
        fetchAgentMetrics(),
        fetchQueueStatus(),
      ])

      // Calculate total pending builds
      const pendingBuilds = queueStatus.reduce((total, queue) => total + queue.scheduledJobs.length, 0)

      console.log(
        `Dashboard stats: ${dashboardData.pipelines.length} total pipelines, ${dashboardData.failingPipelines.length} failing, ${dashboardData.runningPipelinesCount} pipelines with running builds`,
      )

      return page(
        {
          session: ctx.state.session,
          totalPipelines: dashboardData.pipelines.length,
          runningPipelines: dashboardData.runningPipelinesCount,
          pendingBuilds,
          agentMetrics,
          failingPipelines: dashboardData.failingPipelines,
        } satisfies HomeProps,
      )
    } catch (error) {
      console.error("Error fetching dashboard data:", error)

      return page(
        {
          session: ctx.state.session,
          totalPipelines: 0,
          runningPipelines: 0,
          pendingBuilds: 0,
          agentMetrics: { averageWaitTime: 0, p95WaitTime: 0, p99WaitTime: 0 },
          failingPipelines: [],
          error:
            "Unable to load dashboard data. This could be due to: 1) Missing BUILDKITE_API_KEY environment variable, 2) Invalid API key, or 3) Network connectivity issues. Please check your configuration and try again.",
        } satisfies HomeProps,
      )
    }
  },
}

export default function Home(props: { data: HomeProps; state: AppState }) {
  const { session, totalPipelines, runningPipelines, pendingBuilds, agentMetrics, failingPipelines, error } = props.data

  const breadcrumbs = undefined

  return (
    <Layout
      title="Build Overview"
      currentPath="/"
      session={session}
      breadcrumbs={breadcrumbs}
    >
      <div class="wa-stack wa-gap-l" style="padding: var(--wa-space-l) 0">
        <header style="display: flex; justify-content: space-between; align-items: flex-start; gap: var(--wa-space-m)">
          <div>
            <h1 class="wa-heading-l">Build Overview</h1>
            <p class="wa-body-m wa-color-text-quiet">
              Monitor the status of all Divvun project builds across GitHub organizations
            </p>
          </div>
          <AutoRefresh
            enabled
            intervalSeconds={AUTO_REFRESH_INTERVAL_SECONDS}
          />
        </header>

        <DashboardContent
          session={session}
        />
      </div>

      <style>
        {`
        @media (max-width: 640px) {
          .status-cards {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 480px) {
          .status-cards {
            grid-template-columns: 1fr !important;
            gap: var(--wa-space-s) !important;
          }
        }
      `}
      </style>
    </Layout>
  )
}
