/// <reference path="../types/webawesome.d.ts" />
import { Context, page } from "fresh"
import Layout from "~/components/Layout.tsx"
import AutoRefresh from "~/islands/AutoRefresh.tsx"
import { type AppState } from "~/utils/middleware.ts"
import { type SessionData } from "~/utils/session.ts"
import {
  type AgentMetrics,
  type AppBuild,
  type BuildHistoryItem,
  type FailingPipeline,
  fetchAgentMetrics,
  fetchAllPipelines,
  fetchFailingPipelines,
  fetchRecentBuilds,
} from "~/utils/buildkite-data.ts"
import { formatDurationSeconds, formatFailingSince, normalizeStatus } from "~/utils/formatters.ts"
import EmptyState from "~/components/EmptyState.tsx"

interface HomeProps {
  session?: SessionData | null
  totalPipelines: number
  runningPipelines: number
  agentMetrics: AgentMetrics
  failingPipelines: FailingPipeline[]
  error?: string
}

export const handler = {
  async GET(ctx: Context<AppState>) {
    try {
      console.log("Fetching dashboard data...")

      // Fetch all required data in parallel
      const [allPipelines, failingPipelines, agentMetrics, allRecentBuilds] = await Promise.all([
        fetchAllPipelines(),
        fetchFailingPipelines(),
        fetchAgentMetrics(),
        fetchRecentBuilds(50), // Keep for running pipelines count
      ])

      // Calculate dashboard statistics
      const totalPipelines = allPipelines.length

      // Count unique pipelines with running builds, not just running builds
      const runningBuildPipelineSlugs = new Set(
        allRecentBuilds
          .filter((build: AppBuild) => normalizeStatus(build.status) === "running")
          .map((build: AppBuild) => build.pipelineSlug)
          .filter(Boolean),
      )
      const runningPipelines = runningBuildPipelineSlugs.size

      console.log(
        `Dashboard stats: ${totalPipelines} total pipelines, ${failingPipelines.length} failing, ${runningPipelines} pipelines with running builds`,
      )

      return page(
        {
          session: ctx.state.session,
          totalPipelines,
          runningPipelines,
          agentMetrics,
          failingPipelines,
        } satisfies HomeProps,
      )
    } catch (error) {
      console.error("Error fetching dashboard data:", error)

      return page(
        {
          session: ctx.state.session,
          totalPipelines: 0,
          runningPipelines: 0,
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
  const { session, totalPipelines, runningPipelines, agentMetrics, failingPipelines, error } = props.data

  const breadcrumbs = [
    { label: "Overview" },
  ]

  return (
    <Layout
      title="Build Overview"
      currentPath="/"
      session={session}
      breadcrumbs={breadcrumbs}
    >
      <div class="wa-stack wa-gap-l" style="padding: var(--wa-space-l) 0">
        <header>
          <h1 class="wa-heading-l">Build Overview</h1>
          <p class="wa-body-m wa-color-text-quiet">
            Monitor the status of all Divvun project builds across GitHub organizations
          </p>
        </header>

        <div class="wa-flank" style="max-width: 1000px">
          <div></div>
          <AutoRefresh enabled={!!session} intervalSeconds={60} />
        </div>

        {error && (
          <wa-callout variant="danger">
            <wa-icon slot="icon" name="triangle-exclamation"></wa-icon>
            {error}
          </wa-callout>
        )}

        {/* Three Status Cards */}
        <div
          class="wa-gap-m status-cards"
          style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--wa-space-m); max-width: 900px"
        >
          <a href="/pipelines" style="text-decoration: none; color: inherit">
            <wa-card class="clickable-card">
              <div class="wa-stack wa-gap-xs">
                <div class="wa-flank">
                  <span class="wa-heading-s">Total Pipelines</span>
                  <wa-badge variant="brand">{totalPipelines}</wa-badge>
                </div>
                <div class="wa-caption-m wa-color-text-quiet">Across 4 organizations</div>
              </div>
            </wa-card>
          </a>

          <a href="/agents" style="text-decoration: none; color: inherit">
            <wa-card class="clickable-card">
              <div class="wa-stack wa-gap-xs">
                <div class="wa-flank">
                  <span class="wa-heading-s">Average Wait Time</span>
                  <wa-badge variant="neutral">{formatDurationSeconds(agentMetrics.averageWaitTime)}</wa-badge>
                </div>
                <div class="wa-caption-m wa-color-text-quiet">
                  P95: {formatDurationSeconds(agentMetrics.p95WaitTime)} • P99:{" "}
                  {formatDurationSeconds(agentMetrics.p99WaitTime)}
                </div>
              </div>
            </wa-card>
          </a>

          <a href="/running" style="text-decoration: none; color: inherit">
            <wa-card class="clickable-card">
              <div class="wa-stack wa-gap-xs">
                <div class="wa-flank">
                  <span class="wa-heading-s">Running Pipelines</span>
                  <wa-badge variant={runningPipelines > 0 ? "warning" : "neutral"}>{runningPipelines}</wa-badge>
                </div>
                <div class="wa-caption-m wa-color-text-quiet">With active builds</div>
              </div>
            </wa-card>
          </a>
        </div>

        {/* Failing Pipelines Section */}
        <section style="max-width: 900px">
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
                      <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--wa-space-m)">
                        <div class="wa-stack wa-gap-3xs">
                          <div class="wa-flank wa-gap-s">
                            <span class="wa-heading-s">{pipeline.name}</span>
                            <wa-badge variant="danger">
                              <wa-icon slot="prefix" name="triangle-exclamation"></wa-icon>
                              Failed
                            </wa-badge>
                          </div>
                          <div class="wa-caption-s wa-color-text-quiet">
                            failing since {formatFailingSince(pipeline.failingSince)}
                          </div>
                        </div>

                        <div style="display: flex; gap: 2px; min-width: 120px">
                          {pipeline.last10Builds.map((build: BuildHistoryItem, index: number) => (
                            <div
                              key={`${pipeline.id}-build-${index}`}
                              style={`width: 10px; height: 20px; border-radius: 2px; background-color: ${
                                build.status === "success"
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
