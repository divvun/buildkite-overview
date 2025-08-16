/// <reference path="../types/webawesome.d.ts" />
import { Context, page } from "fresh"
import EmptyState from "~/components/EmptyState.tsx"
import Layout from "~/components/Layout.tsx"
import AutoRefresh from "~/islands/AutoRefresh.tsx"
import { type AppAgent, fetchAllAgents } from "~/utils/buildkite-data.ts"
import { formatDuration, formatLastSeen, getConnectionIcon, getConnectionVariant } from "~/utils/formatters.ts"
import { type AppState } from "~/utils/middleware.ts"
import { requireDivvunOrgAccess, type SessionData } from "~/utils/session.ts"

interface AgentsProps {
  session: SessionData
  agents: AppAgent[]
  orgFilter?: string
  error?: string
}

export const handler = {
  async GET(ctx: Context<AppState>) {
    try {
      // Require authentication and divvun organization membership
      const session = requireDivvunOrgAccess(ctx.req)
      const url = new URL(ctx.req.url)
      const rawOrgFilter = url.searchParams.get("org")

      // Validate and sanitize org filter - must be alphanumeric with dashes/underscores only
      const orgFilter = rawOrgFilter?.match(/^[a-zA-Z0-9_-]+$/) ? rawOrgFilter : undefined

      try {
        console.log("Fetching agents data...")

        const allAgents = await fetchAllAgents()

        // Filter by organization if specified
        let filteredAgents = allAgents
        if (orgFilter) {
          filteredAgents = allAgents.filter((agent) => agent.organization === orgFilter)
        }

        console.log(`Found ${filteredAgents.length} agents`)

        return page(
          {
            session,
            agents: filteredAgents,
            orgFilter,
          } satisfies AgentsProps,
        )
      } catch (error) {
        console.error("Error fetching agents data:", error)

        return page(
          {
            session,
            agents: [],
            orgFilter,
            error:
              "Unable to load agent information. Ensure your Buildkite API token has agent read permissions and try refreshing the page. If the issue persists, check the browser console for more details.",
          } satisfies AgentsProps,
        )
      }
    } catch (error) {
      // Handle authentication errors (thrown as Response objects)
      if (error instanceof Response) {
        return error // Return the redirect response
      }
      throw error // Re-throw actual errors
    }
  },
}

export default function Agents(props: { data: AgentsProps; state: AppState }) {
  const { session, agents, orgFilter, error } = props.data

  const breadcrumbs = [
    { label: "Agents" },
  ]

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
    <Layout
      title="Buildkite Agents"
      currentPath="/agents"
      session={session}
      breadcrumbs={breadcrumbs}
    >
      <div class="wa-stack wa-gap-l" style="padding: var(--wa-space-l) 0">
        <header>
          <h1 class="wa-heading-l">Buildkite Agents</h1>
          <p class="wa-body-m wa-color-text-quiet">
            View all agents across organizations and their current status
          </p>
        </header>

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
          <AutoRefresh enabled intervalSeconds={30} />
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
                                      {agent.queueKey && agent.queueKey !== queueKey
                                        ? ` • Queue: ${agent.queueKey}`
                                        : ""}
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
      </div>
    </Layout>
  )
}
