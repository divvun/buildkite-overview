/// <reference path="../types/webawesome.d.ts" />
import { useCallback, useEffect, useState } from "preact/hooks"
import EmptyState from "~/components/EmptyState.tsx"
import SkeletonLoader from "~/components/SkeletonLoader.tsx"
import { type AppAgent } from "~/utils/buildkite-data.ts"
import { formatDuration, formatLastSeen, getConnectionIcon, getConnectionVariant } from "~/utils/formatters.ts"
import { useLocalization } from "~/utils/localization-context.tsx"

interface AgentsData {
  agents: AppAgent[]
  orgFilter?: string
  error?: string
}

interface AgentsContentProps {
  orgFilter?: string
}

export default function AgentsContent({ orgFilter }: AgentsContentProps) {
  const { t, locale } = useLocalization()
  const [data, setData] = useState<AgentsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      const url = new URL("/api/agents", globalThis.location.origin)
      if (orgFilter) {
        url.searchParams.set("org", orgFilter)
      }

      const response = await fetch(url.toString())
      if (response.ok) {
        const newData = await response.json()
        setData(newData)
      } else {
        console.error("Failed to fetch agents data:", response.status)
      }
    } catch (error) {
      console.error("Error fetching agents data:", error)
    } finally {
      setIsLoading(false)
    }
  }, [orgFilter])

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
        <SkeletonLoader height="200px" />
        <SkeletonLoader height="200px" />
      </div>
    )
  }

  if (!data) {
    return (
      <wa-callout variant="danger">
        <wa-icon slot="icon" name="triangle-exclamation"></wa-icon>
        {t("failed-to-load-agents")}
      </wa-callout>
    )
  }

  const { agents, error } = data

  // Group agents by queue
  const agentsByQueue = agents.reduce((acc, agent) => {
    const queueKey = agent.queueKey || "unassigned"
    if (!acc[queueKey]) {
      acc[queueKey] = []
    }
    acc[queueKey].push(agent)
    return acc
  }, {} as Record<string, AppAgent[]>)

  const queues = Object.keys(agentsByQueue).sort()

  // Also group agents by organization for fallback display
  const agentsByOrg = agents.reduce((acc, agent) => {
    if (!acc[agent.organization]) {
      acc[agent.organization] = []
    }
    acc[agent.organization].push(agent)
    return acc
  }, {} as Record<string, AppAgent[]>)

  const organizations = Object.keys(agentsByOrg).sort()
  const connectedAgents = agents.filter((agent) => agent.connectionState === "connected").length
  const runningJobs = agents.filter((agent) => agent.isRunningJob).length
  const pendingJobs = 0 // Queue information moved to dedicated Queues page

  return (
    <>
      <div class="wa-flank">
        <div class="wa-cluster wa-gap-m">
          <div class="wa-stack wa-gap-3xs">
            <div class="wa-body-s wa-color-text-quiet">{t("total-agents")}</div>
            <div class="wa-heading-s">{agents.length}</div>
          </div>
          <div class="wa-stack wa-gap-3xs">
            <div class="wa-body-s wa-color-text-quiet">{t("connected")}</div>
            <div class="wa-heading-s">{connectedAgents}</div>
          </div>
          <div class="wa-stack wa-gap-3xs">
            <div class="wa-body-s wa-color-text-quiet">{t("running-jobs")}</div>
            <div class="wa-heading-s">{runningJobs}</div>
          </div>
          <div class="wa-stack wa-gap-3xs">
            <div class="wa-body-s wa-color-text-quiet">{t("pending-jobs")}</div>
            <div class="wa-heading-s">{pendingJobs}</div>
          </div>
        </div>
      </div>

      {error && (
        <wa-callout variant="danger">
          <wa-icon slot="icon" name="triangle-exclamation"></wa-icon>
          {error}
        </wa-callout>
      )}

      {/* Queue Filter */}
      {queues.length > 1 && (
        <div class="wa-cluster wa-gap-s" style="flex-wrap: wrap">
          <span class="wa-body-s">{t("queue-label")}</span>
          <a
            href="/agents"
            class={`wa-button ${!orgFilter ? "wa-button-primary" : "wa-button-secondary"}`}
            style="text-decoration: none"
          >
            {t("all-agents")} ({agents.length})
          </a>
          {queues.map((queue) => (
            <a
              key={queue}
              href={`/agents?queue=${queue}`}
              class={`wa-button ${orgFilter === queue ? "wa-button-primary" : "wa-button-secondary"}`}
              style="text-decoration: none"
            >
              {queue === "unassigned" ? t("unassigned-agents") : queue} ({agentsByQueue[queue].length})
            </a>
          ))}
        </div>
      )}

      {agents.length === 0
        ? (
          <EmptyState
            icon="server"
            title={t("no-agents")}
            description={orgFilter ? t("no-agents-for-queue", { queue: orgFilter }) : t("no-agents-all-queues")}
            variant="neutral"
            maxWidth="900px"
          />
        )
        : (
          <div class="wa-stack wa-gap-l">
            {queues.map((queueKey) => {
              // Queue info moved to dedicated Queues page
              return (
                <div key={queueKey} class="wa-stack wa-gap-m">
                  <div class="wa-flank">
                    <div class="wa-stack wa-gap-3xs">
                      <h2 class="wa-heading-m">
                        {queueKey === "unassigned" ? t("unassigned-agents") : `${t("queue-prefix")} ${queueKey}`}
                      </h2>
                    </div>
                    <wa-badge variant="neutral">
                      {agentsByQueue[queueKey].length === 1
                        ? t("agent-count", { count: agentsByQueue[queueKey].length })
                        : t("agent-count-plural", { count: agentsByQueue[queueKey].length })}
                    </wa-badge>
                  </div>

                  <div class="wa-stack wa-gap-s">
                    {agentsByQueue[queueKey].map((agent) => (
                      <wa-card key={agent.id}>
                        <div style="padding: var(--wa-space-m)">
                          <div class="wa-flank wa-gap-m">
                            <div class="wa-stack wa-gap-s">
                              <div class="wa-flank wa-gap-s">
                                <div class="wa-stack wa-gap-3xs">
                                  <h3 class="wa-heading-s">{agent.name}</h3>
                                  <div class="wa-caption-s wa-color-text-quiet">
                                    {agent.hostname ? `${agent.hostname} • ` : ""}
                                    {agent.organization}
                                    {agent.queueKey && agent.queueKey !== queueKey ? ` • Queue: ${agent.queueKey}` : ""}
                                  </div>
                                </div>
                                <wa-badge variant={getConnectionVariant(agent.connectionState)}>
                                  <wa-icon slot="prefix" name={getConnectionIcon(agent.connectionState)}></wa-icon>
                                  {t(`connection-${agent.connectionState}`)}
                                </wa-badge>
                              </div>

                              {agent.isRunningJob && agent.currentJob && (
                                <div style="background: var(--wa-color-warning-fill-subtle); padding: var(--wa-space-s); border-radius: var(--wa-border-radius-s); border-left: 4px solid var(--wa-color-warning-fill-loud)">
                                  <div class="wa-stack wa-gap-3xs">
                                    <div class="wa-flank wa-gap-s">
                                      <span class="wa-body-s wa-color-text-loud">
                                        {t("running-label")} {agent.currentJob.pipelineName}
                                      </span>
                                      <wa-badge variant="warning">
                                        {t("build-number", { number: agent.currentJob.buildNumber })}
                                      </wa-badge>
                                    </div>
                                    <div class="wa-caption-s wa-color-text-quiet">
                                      {t("duration-label")}
                                      {agent.currentJob.duration ||
                                        formatDuration(agent.currentJob.startedAt, undefined, locale)}
                                      {agent.currentJob.url && (
                                        <>
                                          {" • "}
                                          <a
                                            href={`/pipelines/${agent.currentJob.pipelineSlug}/builds/${agent.currentJob.buildNumber}`}
                                            class="wa-cluster wa-gap-xs"
                                          >
                                            {t("view-build")}
                                            <wa-icon name="arrow-right" style="font-size: 0.75em">
                                            </wa-icon>
                                          </a>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            <div class="wa-stack wa-gap-3xs wa-align-items-end">
                              {agent.version && (
                                <div class="wa-caption-s wa-color-text-quiet">
                                  v{agent.version}
                                </div>
                              )}
                              {agent.operatingSystem && (
                                <div class="wa-caption-s wa-color-text-quiet">
                                  {agent.operatingSystem}
                                </div>
                              )}
                              {agent.metadata && agent.metadata.length > 0 && (
                                <div class="wa-caption-s wa-color-text-quiet">
                                  {agent.metadata.map((meta, index) => (
                                    <div key={`${agent.id}-meta-${index}`} class="metadata-item">
                                      <span class="metadata-key">{meta.key}:</span> {meta.value}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </wa-card>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
    </>
  )
}
