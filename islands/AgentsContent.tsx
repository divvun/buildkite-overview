/// <reference path="../types/webawesome.d.ts" />
import { useCallback, useEffect, useState } from "preact/hooks"
import EmptyState from "~/components/EmptyState.tsx"
import SkeletonLoader from "~/components/SkeletonLoader.tsx"
import { type AppAgent } from "~/utils/buildkite-data.ts"
import { formatDuration, formatLastSeen, getConnectionIcon, getConnectionVariant } from "~/utils/formatters.ts"

interface AgentsData {
  agents: AppAgent[]
  orgFilter?: string
  error?: string
}

interface AgentsContentProps {
  orgFilter?: string
}

export default function AgentsContent({ orgFilter }: AgentsContentProps) {
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
        Failed to load agents data
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
            <div class="wa-body-s wa-color-text-quiet">Total Agents</div>
            <div class="wa-heading-s">{agents.length}</div>
          </div>
          <div class="wa-stack wa-gap-3xs">
            <div class="wa-body-s wa-color-text-quiet">Connected</div>
            <div class="wa-heading-s">{connectedAgents}</div>
          </div>
          <div class="wa-stack wa-gap-3xs">
            <div class="wa-body-s wa-color-text-quiet">Running Jobs</div>
            <div class="wa-heading-s">{runningJobs}</div>
          </div>
          <div class="wa-stack wa-gap-3xs">
            <div class="wa-body-s wa-color-text-quiet">Pending Jobs</div>
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
          <span class="wa-body-s">Queue:</span>
          <a
            href="/agents"
            class={`wa-button ${!orgFilter ? "wa-button-primary" : "wa-button-secondary"}`}
            style="text-decoration: none"
          >
            All ({agents.length})
          </a>
          {queues.map((queue) => (
            <a
              key={queue}
              href={`/agents?queue=${queue}`}
              class={`wa-button ${orgFilter === queue ? "wa-button-primary" : "wa-button-secondary"}`}
              style="text-decoration: none"
            >
              {queue === "unassigned" ? "Unassigned" : queue} ({agentsByQueue[queue].length})
            </a>
          ))}
        </div>
      )}

      {agents.length === 0
        ? (
          <EmptyState
            icon="server"
            title="No agents found"
            description={orgFilter ? `No agents found for queue "${orgFilter}"` : "No agents found across all queues"}
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
                        {queueKey === "unassigned" ? "Unassigned Agents" : `Queue: ${queueKey}`}
                      </h2>
                    </div>
                    <wa-badge variant="neutral">
                      {agentsByQueue[queueKey].length} agent{agentsByQueue[queueKey].length !== 1 ? "s" : ""}
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
                                    {agent.ipAddress ? ` • ${agent.ipAddress}` : ""}
                                    {agent.queueKey && agent.queueKey !== queueKey ? ` • Queue: ${agent.queueKey}` : ""}
                                  </div>
                                </div>
                                <wa-badge variant={getConnectionVariant(agent.connectionState)}>
                                  <wa-icon slot="prefix" name={getConnectionIcon(agent.connectionState)}></wa-icon>
                                  {agent.connectionState}
                                </wa-badge>
                              </div>

                              {agent.isRunningJob && agent.currentJob && (
                                <div style="background: var(--wa-color-warning-fill-subtle); padding: var(--wa-space-s); border-radius: var(--wa-border-radius-s); border-left: 4px solid var(--wa-color-warning-fill-loud)">
                                  <div class="wa-stack wa-gap-3xs">
                                    <div class="wa-flank wa-gap-s">
                                      <span class="wa-body-s wa-color-text-loud">
                                        Running: {agent.currentJob.pipelineName}
                                      </span>
                                      <wa-badge variant="warning">
                                        Build #{agent.currentJob.buildNumber}
                                      </wa-badge>
                                    </div>
                                    <div class="wa-caption-s wa-color-text-quiet">
                                      Duration:{" "}
                                      {agent.currentJob.duration || formatDuration(agent.currentJob.startedAt)}
                                      {agent.currentJob.url && (
                                        <>
                                          {" • "}
                                          <a
                                            href={`/pipelines/${agent.currentJob.pipelineSlug}/builds/${agent.currentJob.buildNumber}`}
                                            class="wa-cluster wa-gap-xs"
                                          >
                                            View build
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
                              <div class="wa-caption-s wa-color-text-quiet">
                                Last seen: {formatLastSeen(agent.lastSeen)}
                              </div>
                            </div>
                          </div>

                          {agent.metadata && agent.metadata.length > 0 && (
                            <details style="margin-top: var(--wa-space-s)">
                              <summary class="wa-caption-s wa-color-text-quiet" style="cursor: pointer">
                                Metadata ({agent.metadata.length} items)
                              </summary>
                              <div
                                class="wa-grid wa-gap-3xs"
                                style="grid-template-columns: auto 1fr; margin-top: var(--wa-space-3xs)"
                              >
                                {agent.metadata.map((meta, index) => (
                                  <div key={`${agent.id}-meta-${index}`} style="display: contents">
                                    <div class="wa-caption-xs wa-color-text-quiet">{meta.key}:</div>
                                    <div class="wa-caption-xs">{meta.value}</div>
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
                      </wa-card>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

      {isLoading && (
        <div style="position: fixed; top: 10px; right: 10px; z-index: 1000; background: var(--wa-color-brand-fill-loud); color: white; padding: var(--wa-space-xs) var(--wa-space-s); border-radius: var(--wa-border-radius-s); font-size: var(--wa-font-size-caption-s)">
          Refreshing...
        </div>
      )}
    </>
  )
}
