/// <reference path="../types/webawesome.d.ts" />
import { Context, page } from "fresh"
import Layout from "~/components/Layout.tsx"
import DashboardContent from "~/islands/DashboardContent.tsx"
import { type AgentMetrics, type FailingPipeline, fetchAgentMetrics, fetchQueueStatus } from "~/utils/buildkite-data.ts"
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

      // Set the page title
      ctx.state.title = ctx.state.t("dashboard-title")

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

      // Set the page title
      ctx.state.title = ctx.state.t("dashboard-title")

      return page(
        {
          session: ctx.state.session,
          totalPipelines: 0,
          runningPipelines: 0,
          pendingBuilds: 0,
          agentMetrics: { averageWaitTime: 0, p95WaitTime: 0, p99WaitTime: 0 },
          failingPipelines: [],
          error: ctx.state.t("dashboard-load-error"),
        } satisfies HomeProps,
      )
    }
  },
}

export default function Home(props: { data: HomeProps; state: AppState }) {
  const {
    session,
    totalPipelines,
    runningPipelines,
    pendingBuilds,
    agentMetrics,
    failingPipelines,
    error,
  } = props.data

  const breadcrumbs = undefined

  return (
    <Layout
      title={props.state.t("dashboard-title")}
      currentPath="/"
      session={session}
      breadcrumbs={breadcrumbs}
      t={props.state.t}
      state={props.state}
    >
      <div class="wa-stack wa-gap-l" style="padding: var(--wa-space-l) 0">
        <header>
          <h1 class="wa-heading-l">{props.state.t("dashboard-title")}</h1>
          <p class="wa-body-m wa-color-text-quiet">
            {props.state.t("dashboard-description")}
          </p>
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
