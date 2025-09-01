/// <reference path="../types/webawesome.d.ts" />
import { Context, page } from "fresh"
import Layout from "~/components/Layout.tsx"
import DashboardContent from "~/islands/DashboardContent.tsx"
import { fetchAgentMetrics, fetchQueueStatus } from "~/server/buildkite-data.ts"
import type { AgentMetrics, FailingPipeline } from "~/types/app.ts"
import { type AppState, filterPipelinesForUser } from "~/server/middleware.ts"
import { fetchDashboardData } from "~/server/pipeline-data-service.ts"
import type { SessionData } from "~/types/session.ts"

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

      // Filter pipelines based on user access
      const visiblePipelines = filterPipelinesForUser(dashboardData.pipelines, ctx.state.session)
      const visibleFailingPipelines = filterPipelinesForUser(dashboardData.failingPipelines, ctx.state.session)

      // Calculate metrics from visible pipelines
      const runningPipelines = visiblePipelines.filter((p) => p.status === "running").length

      // Calculate total pending builds
      const pendingBuilds = queueStatus.reduce((total, queue) => total + queue.scheduledJobs.length, 0)

      console.log(
        `Dashboard stats: ${visiblePipelines.length} visible pipelines (${dashboardData.pipelines.length} total), ${visibleFailingPipelines.length} failing, ${runningPipelines} running`,
      )

      // Set the page title
      ctx.state.title = ctx.state.t("dashboard-title")

      return page(
        {
          session: ctx.state.session,
          totalPipelines: visiblePipelines.length,
          runningPipelines: runningPipelines,
          pendingBuilds,
          agentMetrics,
          failingPipelines: visibleFailingPipelines,
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
      <div class="wa-stack wa-gap-l dashboard-container">
        <header class="dashboard-header">
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
