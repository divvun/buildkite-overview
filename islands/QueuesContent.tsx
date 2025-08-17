/// <reference path="../types/webawesome.d.ts" />
import { useCallback, useEffect, useState } from "preact/hooks"
import { useLocalization } from "~/utils/localization-context.tsx"
import EmptyState from "~/components/EmptyState.tsx"
import SkeletonLoader from "~/components/SkeletonLoader.tsx"
import { type QueueBuild, type QueueJob, type QueueStatus } from "~/utils/buildkite-data.ts"

interface QueuesData {
  queueStatus: QueueStatus[]
  error?: string
}

interface QueuesContentProps {
}

export default function QueuesContent({}: QueuesContentProps) {
  const { t } = useLocalization()
  const [data, setData] = useState<QueuesData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/queues")
      if (response.ok) {
        const newData = await response.json()
        setData(newData)
        setHasInitiallyLoaded(true)
      } else {
        console.error("Failed to fetch queues data:", response.status)
      }
    } catch (error) {
      console.error("Error fetching queues data:", error)
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
        <SkeletonLoader height="40px" width="200px" />
        <SkeletonLoader height="120px" />
        <SkeletonLoader height="120px" />
      </div>
    )
  }

  if (!data) {
    return (
      <wa-callout variant="danger">
        <wa-icon slot="icon" name="triangle-exclamation"></wa-icon>
        {t("failed-to-load-queues")}
      </wa-callout>
    )
  }

  const { queueStatus, error } = data

  // Calculate summary statistics
  const totalQueues = queueStatus.length
  const totalRunningJobs = queueStatus.reduce((sum, queue) => sum + queue.runningJobs.length, 0)
  const totalQueuedJobs = queueStatus.reduce((sum, queue) => sum + queue.scheduledJobs.length, 0)
  const totalAvailableAgents = queueStatus.reduce((sum, queue) => sum + queue.availableAgents, 0)

  return (
    <>
      <div class="wa-flank">
        <div class="wa-cluster wa-gap-m">
          <div class="wa-stack wa-gap-3xs">
            <div class="wa-body-s wa-color-text-quiet">{t("active-queues")}</div>
            <div class="wa-heading-s">{totalQueues}</div>
          </div>
          <div class="wa-stack wa-gap-3xs">
            <div class="wa-body-s wa-color-text-quiet">{t("running-jobs")}</div>
            <div class="wa-heading-s">{totalRunningJobs}</div>
          </div>
          <div class="wa-stack wa-gap-3xs">
            <div class="wa-body-s wa-color-text-quiet">{t("queued-jobs")}</div>
            <div class="wa-heading-s">{totalQueuedJobs}</div>
          </div>
          <div class="wa-stack wa-gap-3xs">
            <div class="wa-body-s wa-color-text-quiet">{t("available-agents")}</div>
            <div class="wa-heading-s">{totalAvailableAgents}</div>
          </div>
        </div>
      </div>

      {error && (
        <wa-callout variant="danger">
          <wa-icon slot="icon" name="triangle-exclamation"></wa-icon>
          {error}
        </wa-callout>
      )}

      {/* Queue Overview */}
      <wa-card>
        <div style="padding: var(--wa-space-m)">
          <h3 class="wa-heading-s" style="margin-bottom: var(--wa-space-s)">{t("queue-overview")}</h3>
          {queueStatus.length > 0
            ? (
              <div class="wa-grid wa-gap-s" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))">
                {queueStatus.map((queue) => (
                  <div key={queue.queueKey} class="wa-stack wa-gap-3xs">
                    <div class="wa-flank wa-gap-s">
                      <span class="wa-body-s wa-font-weight-semibold">
                        {queue.queueKey === "default" ? t("default-queue") : queue.queueKey}
                      </span>
                      <wa-badge variant={queue.availableAgents > 0 ? "success" : "warning"}>
                        {t("available-agents-ratio", {
                          available: queue.availableAgents,
                          total: queue.connectedAgents,
                        })}
                      </wa-badge>
                    </div>
                    <div class="wa-cluster wa-gap-s">
                      {queue.runningJobs.length > 0 && (
                        <span class="wa-caption-s wa-color-text-quiet">
                          {t("running-count", { count: queue.runningJobs.length })}
                        </span>
                      )}
                      {queue.scheduledJobs.length > 0 && (
                        <span class="wa-caption-s wa-color-text-quiet">
                          {t("queued-count", { count: queue.scheduledJobs.length })}
                        </span>
                      )}
                      {queue.runningJobs.length === 0 && queue.scheduledJobs.length === 0 && (
                        <span class="wa-caption-s wa-color-text-quiet">
                          {t("idle-status")}
                        </span>
                      )}
                    </div>
                    {queue.scheduledJobs.length > 0 && (
                      <div class="wa-caption-xs wa-color-text-quiet">
                        {t("next-label", {
                          jobs: queue.scheduledJobs.slice(0, 2).map((job: QueueJob) => job.pipelineName).join(", "),
                        })}
                        {queue.scheduledJobs.length > 2 &&
                          ` ${t("more-builds", { count: queue.scheduledJobs.length - 2 })}`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
            : (
              <div class="wa-stack wa-gap-s">
                <div class="wa-flank wa-gap-s">
                  <span class="wa-body-s wa-color-text-quiet">{t("queues-idle-status")}</span>
                  <wa-badge variant="success">{t("no-builds-pending")}</wa-badge>
                </div>
                <p class="wa-caption-s wa-color-text-quiet">
                  {t("all-queues-idle-description")}
                </p>
              </div>
            )}
        </div>
      </wa-card>

      {/* Queue Details */}
      {queueStatus.length > 0 && (
        <wa-card>
          <div style="padding: var(--wa-space-m)">
            <h3 class="wa-heading-s" style="margin-bottom: var(--wa-space-s)">{t("queue-details")}</h3>
            <div class="wa-stack wa-gap-m">
              {queueStatus
                .filter((queue) => queue.scheduledJobs.length > 0)
                .map((queue) => (
                  <wa-details
                    key={queue.queueKey}
                    summary={t("queue-summary", {
                      queue: queue.queueKey,
                      builds: queue.scheduledBuilds.length,
                      jobs: queue.scheduledJobs.length,
                    })}
                  >
                    <div style="margin-top: var(--wa-space-s)">
                      <div class="wa-stack wa-gap-m">
                        {queue.scheduledBuilds.map((build: QueueBuild) => (
                          <div
                            key={build.buildId}
                            class="wa-stack wa-gap-s"
                            style="padding: var(--wa-space-m); background: var(--wa-color-neutral-fill-subtle); border-radius: var(--wa-border-radius-s); border-left: 3px solid var(--wa-color-warning-fill-loud)"
                          >
                            <div class="wa-flank wa-gap-s">
                              <div class="wa-stack wa-gap-3xs">
                                <span class="wa-body-s wa-font-weight-semibold">
                                  {t("build-number", { number: build.buildNumber })} - {build.pipelineName}
                                </span>
                                <span class="wa-caption-s wa-color-text-quiet">
                                  {build.repo && `${build.repo} • `}
                                  {t("scheduled-label")} {new Date(build.scheduledAt).toLocaleString()}
                                </span>
                              </div>
                              <div class="wa-cluster wa-gap-s">
                                <wa-badge variant="warning">
                                  {t("job-count", { count: build.jobs.length })}
                                </wa-badge>
                                <a href={build.buildUrl} target="_blank" rel="noopener" class="wa-caption-s">
                                  {t("view-build-external")}
                                </a>
                              </div>
                            </div>
                            {build.jobs.length > 0 && (
                              <div class="wa-stack wa-gap-3xs">
                                <span class="wa-caption-s wa-color-text-quiet wa-font-weight-semibold">
                                  {t("jobs-in-build")}
                                </span>
                                <div class="wa-stack wa-gap-2xs">
                                  {build.jobs.map((job: QueueJob) => (
                                    <div
                                      key={job.id}
                                      class="wa-flank wa-gap-s"
                                      style="padding: var(--wa-space-s); background: var(--wa-color-neutral-fill); border-radius: var(--wa-border-radius-xs)"
                                    >
                                      <span class="wa-caption-s">
                                        {t("job-number", { id: job.id.slice(-8) })} •{" "}
                                        {job.agentQueryRules?.join(", ") || t("no-requirements")}
                                      </span>
                                      <a
                                        href={`/pipelines/${job.pipelineSlug}/builds/${job.buildNumber}`}
                                        class="wa-caption-xs"
                                      >
                                        {t("view-build-details")}
                                      </a>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </wa-details>
                ))}
            </div>

            {queueStatus.filter((queue) => queue.scheduledJobs.length > 0).length === 0 && (
              <EmptyState
                icon="check-circle"
                title={t("no-queued-builds-title")}
                description={t("no-queued-builds-desc")}
                variant="success"
                maxWidth="600px"
              />
            )}
          </div>
        </wa-card>
      )}

      {/* Show loading state only when initially loading */}
      {queueStatus.length === 0 && !error && !hasInitiallyLoaded && (
        <EmptyState
          icon="loader"
          title={t("loading-queue-data-title")}
          description={t("loading-queue-data-desc")}
          variant="neutral"
          maxWidth="600px"
        />
      )}

      {/* Show empty state when data is loaded but no queues exist */}
      {queueStatus.length === 0 && !error && hasInitiallyLoaded && (
        <EmptyState
          icon="calendar-check"
          title={t("all-quiet-title")}
          description={t("all-quiet-desc")}
          variant="success"
          maxWidth="600px"
        />
      )}

      {isLoading && (
        <div style="position: fixed; top: 10px; right: 10px; z-index: 1000; background: var(--wa-color-brand-fill-loud); color: white; padding: var(--wa-space-xs) var(--wa-space-s); border-radius: var(--wa-border-radius-s); font-size: var(--wa-font-size-caption-s)">
          {t("refreshing")}
        </div>
      )}
    </>
  )
}
