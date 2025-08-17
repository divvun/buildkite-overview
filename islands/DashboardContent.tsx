/// <reference path="../types/webawesome.d.ts" />
import { useCallback, useEffect, useState } from "preact/hooks"
import { useLocalization } from "~/utils/localization-context.tsx"
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
  const { t } = useLocalization()
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
        {t("failed-to-load-dashboard")}
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
          aria-label={t("view-all-pipelines-aria", { count: totalPipelines })}
        >
          <wa-card class="clickable-card">
            <div class="wa-stack wa-gap-xs">
              <div class="wa-stack wa-gap-2xs">
                <span class="wa-heading-s">{t("stats-total-pipelines")}</span>
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
              aria-label={t("view-agents-wait-time-aria", {
                waitTime: formatDurationSeconds(agentMetrics.averageWaitTime),
              })}
            >
              <wa-card class="clickable-card">
                <div class="wa-stack wa-gap-xs">
                  <div class="wa-stack wa-gap-2xs">
                    <span class="wa-heading-s">{t("average-wait-time")}</span>
                    <wa-badge variant="neutral">{formatDurationSeconds(agentMetrics.averageWaitTime)}</wa-badge>
                  </div>
                </div>
              </wa-card>
            </a>
          )
          : (
            <wa-card class="non-clickable">
              <div class="wa-stack wa-gap-xs">
                <div class="wa-stack wa-gap-2xs">
                  <span class="wa-heading-s">{t("average-wait-time")}</span>
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
              aria-label={t("view-queues-pending-aria", { count: pendingBuilds })}
            >
              <wa-card class="clickable-card">
                <div class="wa-stack wa-gap-xs">
                  <div class="wa-stack wa-gap-2xs">
                    <span class="wa-heading-s">{t("stats-pending-builds")}</span>
                    <wa-badge variant={pendingBuilds > 0 ? "warning" : "neutral"}>{pendingBuilds}</wa-badge>
                  </div>
                </div>
              </wa-card>
            </a>
          )
          : (
            <wa-card class="non-clickable">
              <div class="wa-stack wa-gap-xs">
                <div class="wa-stack wa-gap-2xs">
                  <span class="wa-heading-s">{t("stats-running-pipelines")}</span>
                  <wa-badge variant={runningPipelines > 0 ? "warning" : "neutral"}>{runningPipelines}</wa-badge>
                </div>
              </div>
            </wa-card>
          )}
      </div>

      {/* Failing Pipelines Section */}
      <section aria-labelledby="failing-pipelines-heading">
        <div class="wa-stack wa-gap-s">
          <h2 id="failing-pipelines-heading" class="wa-heading-m">{t("failing-pipelines-title")}</h2>
          <p class="wa-body-s wa-color-text-quiet">
            {t("failing-pipelines-description")}
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
                      aria-label={t("view-failing-pipeline-aria", { name: pipeline.name })}
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
                            {t("failing-since", { time: formatFailingSince(pipeline.failingSince) })}
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
                                title={t("build-status-title", { number: build.buildNumber, status: build.status })}
                              >
                              </div>
                            ))}
                          </div>
                          <wa-badge variant="danger">
                            <wa-icon slot="prefix" name="triangle-exclamation"></wa-icon>
                            {t("failed-status")}
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
                title={t("no-failing-pipelines-title")}
                description={t("no-failing-pipelines-desc")}
                variant="success"
              />
            </div>
          )}
      </section>

      {isLoading && (
        <div style="position: fixed; top: 10px; right: 10px; z-index: 1000; background: var(--wa-color-brand-fill-loud); color: white; padding: var(--wa-space-xs) var(--wa-space-s); border-radius: var(--wa-border-radius-s); font-size: var(--wa-font-size-caption-s)">
          {t("refreshing-ellipsis")}
        </div>
      )}
    </>
  )
}
