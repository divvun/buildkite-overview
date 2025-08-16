/// <reference path="../types/webawesome.d.ts" />
import { useCallback, useEffect, useState } from "preact/hooks"
import BuildHistoryTooltip from "~/components/BuildHistoryTooltip.tsx"
import EmptyState from "~/components/EmptyState.tsx"
import SkeletonLoader from "~/components/SkeletonLoader.tsx"
import { type AgentMetrics, type BuildHistoryItem, type FailingPipeline } from "~/utils/buildkite-data.ts"
import { formatDurationSeconds, formatFailingSince } from "~/utils/formatters.ts"
import { type SessionData } from "~/utils/session.ts"

interface DashboardData {
  totalPipelines: number
  runningPipelines: number
  pendingBuilds: number
  agentMetrics: AgentMetrics
  failingPipelines: FailingPipeline[]
  error?: string
}

interface DashboardContentProps {
  session?: SessionData | null
}

export default function DashboardContent({ session }: DashboardContentProps) {
  // Pure client-side state - no initial data from server
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/dashboard")
      if (response.ok) {
        const newData = await response.json()
        setData(newData)
      } else {
        console.error("Failed to fetch dashboard data:", response.status)
      }
    } catch (err) {
      console.error("Error fetching dashboard data:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch data on mount
  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    const handleRefresh = () => {
      fetchData()
    }

    // Listen for refresh events from AutoRefresh component
    globalThis.addEventListener("autorefresh", handleRefresh)

    return () => {
      globalThis.removeEventListener("autorefresh", handleRefresh)
    }
  }, [fetchData])

  // Show loading state initially
  if (!data && isLoading) {
    return (
      <div class="wa-stack wa-gap-l">
        <div
          class="wa-gap-m status-cards"
          style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--wa-space-m)"
        >
          <SkeletonLoader height="80px" />
          <SkeletonLoader height="80px" />
          <SkeletonLoader height="80px" />
        </div>
        <div class="wa-stack wa-gap-s">
          <SkeletonLoader height="40px" width="200px" />
          <SkeletonLoader height="100px" />
          <SkeletonLoader height="100px" />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <wa-callout variant="danger">
        <wa-icon slot="icon" name="triangle-exclamation"></wa-icon>
        Failed to load dashboard data
      </wa-callout>
    )
  }

  const { totalPipelines, runningPipelines, pendingBuilds, agentMetrics, failingPipelines, error } = data

  return (
    <>
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
        <a
          href="/pipelines"
          style="text-decoration: none; color: inherit"
          aria-label={`View all ${totalPipelines} pipelines`}
        >
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
            <a
              href="/agents"
              style="text-decoration: none; color: inherit"
              aria-label={`View agents, current average wait time: ${
                formatDurationSeconds(agentMetrics.averageWaitTime)
              }`}
            >
              <wa-card class="clickable-card">
                <div class="wa-stack wa-gap-xs">
                  <div class="wa-flank">
                    <span class="wa-heading-s">Average Wait Time</span>
                    <wa-badge variant="neutral">{formatDurationSeconds(agentMetrics.averageWaitTime)}</wa-badge>
                  </div>
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
              </div>
            </wa-card>
          )}

        {session
          ? (
            <a
              href="/queues"
              style="text-decoration: none; color: inherit"
              aria-label={`View queues, ${pendingBuilds} pending builds`}
            >
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
              </div>
            </wa-card>
          )}
      </div>

      {/* Failing Pipelines Section */}
      <section aria-labelledby="failing-pipelines-heading">
        <div class="wa-stack wa-gap-s">
          <h2 id="failing-pipelines-heading" class="wa-heading-m">Failing Pipelines</h2>
          <p class="wa-body-s wa-color-text-quiet">
            Shows pipelines currently in failing state, reverse chronological order
          </p>
        </div>

        {failingPipelines.length > 0
          ? (
            <div class="wa-stack wa-gap-s" style="margin-top: var(--wa-space-m)">
              {failingPipelines.map((pipeline: FailingPipeline) => (
                <BuildHistoryTooltip key={pipeline.id} pipelineSlug={pipeline.slug}>
                  <wa-card class="clickable-card">
                    <a
                      href={`/pipelines/${pipeline.slug}`}
                      style="text-decoration: none; color: inherit; display: block"
                      aria-label={`View details for failing pipeline: ${pipeline.name}`}
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
                </BuildHistoryTooltip>
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

      {isLoading && (
        <div style="position: fixed; top: 10px; right: 10px; z-index: 1000; background: var(--wa-color-brand-fill-loud); color: white; padding: var(--wa-space-xs) var(--wa-space-s); border-radius: var(--wa-border-radius-s); font-size: var(--wa-font-size-caption-s)">
          Refreshing...
        </div>
      )}
    </>
  )
}
