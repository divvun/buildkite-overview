/// <reference path="../types/webawesome.d.ts" />
import { Context, page } from "fresh"
import EmptyState from "~/components/EmptyState.tsx"
import Layout from "~/components/Layout.tsx"
import AutoRefresh from "~/islands/AutoRefresh.tsx"
import {
  type AgentMetrics,
  type BuildHistoryItem,
  type FailingPipeline,
  fetchAgentMetrics,
  fetchQueueStatus,
} from "~/utils/buildkite-data.ts"
import { formatDurationSeconds, formatFailingSince } from "~/utils/formatters.ts"
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
          <AutoRefresh enabled={!!session} intervalSeconds={60} />
        </header>

        {error && (
          <wa-callout variant="danger">
            <wa-icon slot="icon" name="triangle-exclamation"></wa-icon>
            {error}
          </wa-callout>
        )}

        {/* Three Status Cards */}
        <div
          class="wa-gap-m status-cards"
          style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--wa-space-m)"
        >
          <a href="/pipelines" style="text-decoration: none; color: inherit">
            <wa-card class="clickable-card">
              <div class="wa-stack wa-gap-xs">
                <div class="wa-flank">
                  <span class="wa-heading-s">Total Pipelines</span>
                  <wa-badge variant="brand">{totalPipelines}</wa-badge>
                </div>
              </div>
            </wa-card>
          </a>

          {session
            ? (
              <a href="/agents" style="text-decoration: none; color: inherit">
                <wa-card class="clickable-card">
                  <div class="wa-stack wa-gap-xs">
                    <div class="wa-flank">
                      <span class="wa-heading-s">Average Wait Time</span>
                      <wa-badge variant="neutral">{formatDurationSeconds(agentMetrics.averageWaitTime)}</wa-badge>
                    </div>
                    {
                      /* <div class="wa-caption-m wa-color-text-quiet">
                      P95: {formatDurationSeconds(agentMetrics.p95WaitTime)} • P99:{" "}
                      {formatDurationSeconds(agentMetrics.p99WaitTime)}
                    </div> */
                    }
                  </div>
                </wa-card>
              </a>
            )
            : (
              <wa-card class="non-clickable">
                <div class="wa-stack wa-gap-xs">
                  <div class="wa-flank">
                    <span class="wa-heading-s">Average Wait Time</span>
                    <wa-badge variant="neutral" style="text-transform: none">
                      {formatDurationSeconds(agentMetrics.averageWaitTime)}
                    </wa-badge>
                  </div>
                  {
                    /* <div class="wa-caption-m wa-color-text-quiet">
                    P95: {formatDurationSeconds(agentMetrics.p95WaitTime)} • P99:{" "}
                    {formatDurationSeconds(agentMetrics.p99WaitTime)}
                  </div> */
                  }
                </div>
              </wa-card>
            )}

          {session
            ? (
              <a href="/queues" style="text-decoration: none; color: inherit">
                <wa-card class="clickable-card">
                  <div class="wa-stack wa-gap-xs">
                    <div class="wa-flank">
                      <span class="wa-heading-s">Pending Builds</span>
                      <wa-badge variant={pendingBuilds > 0 ? "warning" : "neutral"}>{pendingBuilds}</wa-badge>
                    </div>
                  </div>
                </wa-card>
              </a>
            )
            : (
              <wa-card class="non-clickable">
                <div class="wa-stack wa-gap-xs">
                  <div class="wa-flank">
                    <span class="wa-heading-s">Running Pipelines</span>
                    <wa-badge variant={runningPipelines > 0 ? "warning" : "neutral"}>{runningPipelines}</wa-badge>
                  </div>
                  {/* <div class="wa-caption-m wa-color-text-quiet">With active builds</div> */}
                </div>
              </wa-card>
            )}
        </div>

        {/* Failing Pipelines Section */}
        <section>
          <div class="wa-stack wa-gap-s">
            <h2 class="wa-heading-m">Failing Pipelines</h2>
            <p class="wa-body-s wa-color-text-quiet">
              Shows pipelines currently in failing state, reverse chronological order
            </p>
          </div>

          {failingPipelines.length > 0
            ? (
              <div class="wa-stack wa-gap-s" style="margin-top: var(--wa-space-m)">
                {failingPipelines.map((pipeline: FailingPipeline) => (
                  <wa-card key={pipeline.id} class="clickable-card">
                    <a
                      href={`/pipelines/${pipeline.slug}`}
                      style="text-decoration: none; color: inherit; display: block"
                    >
                      <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--wa-space-s); gap: var(--wa-space-m)">
                        <div class="wa-stack wa-gap-3xs" style="min-width: 0; flex: 1">
                          <span
                            class="wa-heading-s"
                            style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap"
                          >
                            {pipeline.name}
                          </span>
                          <div class="wa-caption-s wa-color-text-quiet">
                            failing since {formatFailingSince(pipeline.failingSince)}
                          </div>
                        </div>

                        <div style="display: flex; align-items: center; gap: var(--wa-space-s)">
                          <div style="display: flex; gap: 2px">
                            {pipeline.last10Builds.toReversed().map((build: BuildHistoryItem, index: number) => (
                              <div
                                key={`${pipeline.id}-build-${index}`}
                                style={`width: 10px; height: 20px; border-radius: 2px; background-color: ${
                                  build.status === "passed"
                                    ? "var(--wa-color-success-fill-loud)"
                                    : build.status === "failed"
                                    ? "var(--wa-color-danger-fill-loud)"
                                    : build.status === "running"
                                    ? "var(--wa-color-warning-fill-loud)"
                                    : "var(--wa-color-neutral-fill-loud)"
                                }`}
                                title={`Build #${build.buildNumber}: ${build.status}`}
                              >
                              </div>
                            ))}
                          </div>
                          <wa-badge variant="danger">
                            <wa-icon slot="prefix" name="triangle-exclamation"></wa-icon>
                            FAILED
                          </wa-badge>
                        </div>
                      </div>
                    </a>
                  </wa-card>
                ))}
              </div>
            )
            : (
              <div style="margin-top: var(--wa-space-m)">
                <EmptyState
                  icon="check-circle"
                  title="No failing pipelines! 🎉"
                  description="All pipelines are currently healthy."
                  variant="success"
                />
              </div>
            )}
        </section>
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
