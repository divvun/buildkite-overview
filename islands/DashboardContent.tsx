/// <reference path="../types/webawesome.d.ts" />
import { useCallback, useEffect, useState } from "preact/hooks"
import BuildHistoryTooltip from "~/components/BuildHistoryTooltip.tsx"
import EmptyState from "~/components/EmptyState.tsx"
import SkeletonLoader from "~/components/SkeletonLoader.tsx"
import { type AgentMetrics, type BuildHistoryItem, type FailingPipeline } from "~/utils/buildkite-data.ts"
import { formatDurationSeconds, formatFailingSince } from "~/utils/formatters.ts"
import { useLocalization } from "~/utils/localization-context.tsx"
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
  const { t, locale } = useLocalization()
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
        <div class="status-cards status-cards-loading">
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
      <div class="status-cards">
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
                waitTime: formatDurationSeconds(agentMetrics.averageWaitTime, locale),
              })}
            >
              <wa-card class="clickable-card">
                <div class="wa-stack wa-gap-xs">
                  <div class="wa-stack wa-gap-2xs">
                    <span class="wa-heading-s">{t("average-wait-time")}</span>
                    <wa-badge variant="neutral">{formatDurationSeconds(agentMetrics.averageWaitTime, locale)}</wa-badge>
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
                    {formatDurationSeconds(agentMetrics.averageWaitTime, locale)}
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
                      <div class="failing-pipeline-card-content">
                        <div class="failing-pipeline-info">
                          <span class="failing-pipeline-name">
                            {pipeline.name}
                          </span>
                          <div class="wa-caption-s wa-color-text-quiet">
                            {t("failing-since", { time: formatFailingSince(pipeline.failingSince, locale, t) })}
                          </div>
                        </div>

                        <div class="failing-pipeline-status">
                          <div class="build-history-bars">
                            {pipeline.last10Builds.toReversed().map((build: BuildHistoryItem, index: number) => (
                              <div
                                key={`${pipeline.id}-build-${index}`}
                                class="build-bar"
                                style={`background-color: ${
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
                            <span class="failed-badge-text">{t("failed-status")}</span>
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
    </>
  )
}
