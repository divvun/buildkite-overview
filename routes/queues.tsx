/// <reference path="../types/webawesome.d.ts" />
import { Context, page } from "fresh"
import EmptyState from "~/components/EmptyState.tsx"
import Layout from "~/components/Layout.tsx"
import AutoRefresh from "~/islands/AutoRefresh.tsx"
import { fetchQueueStatus, type QueueBuild, type QueueJob, type QueueStatus } from "~/utils/buildkite-data.ts"
import { type AppState } from "~/utils/middleware.ts"
import { requireDivvunOrgAccess, type SessionData } from "~/utils/session.ts"

interface QueuesProps {
  session: SessionData
  queueStatus: QueueStatus[]
  error?: string
}

export const handler = {
  async GET(ctx: Context<AppState>) {
    try {
      // Require authentication and divvun organization membership
      const session = requireDivvunOrgAccess(ctx.req)

      try {
        console.log("Fetching queue status data...")

        // Fetch queue status
        const queueStatus = await fetchQueueStatus()

        console.log(`Found ${queueStatus.length} queues`)

        return page(
          {
            session,
            queueStatus,
          } satisfies QueuesProps,
        )
      } catch (error) {
        console.error("Error fetching queue status:", error)

        return page(
          {
            session,
            queueStatus: [],
            error:
              "Unable to fetch queue status. This may be a temporary network issue or API rate limiting. Please wait a moment and try again.",
          } satisfies QueuesProps,
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

export default function Queues(props: { data: QueuesProps; state: AppState }) {
  const { session, queueStatus, error } = props.data

  const breadcrumbs = [
    { label: "Queues" },
  ]

  // Calculate summary statistics
  const totalQueues = queueStatus.length
  const totalRunningJobs = queueStatus.reduce((sum, queue) => sum + queue.runningJobs.length, 0)
  const totalQueuedJobs = queueStatus.reduce((sum, queue) => sum + queue.scheduledJobs.length, 0)
  const totalAvailableAgents = queueStatus.reduce((sum, queue) => sum + queue.availableAgents, 0)

  return (
    <Layout
      title="Queue Management"
      currentPath="/queues"
      session={session}
      breadcrumbs={breadcrumbs}
    >
      <div class="wa-stack wa-gap-l" style="padding: var(--wa-space-l) 0">
        <header>
          <h1 class="wa-heading-l">Queue Management</h1>
          <p class="wa-body-m wa-color-text-quiet">
            Monitor build queues, workload distribution, and agent availability
          </p>
        </header>

        <div class="wa-flank">
          <div class="wa-cluster wa-gap-m">
            <div class="wa-stack wa-gap-3xs">
              <div class="wa-body-s wa-color-text-quiet">Active Queues</div>
              <div class="wa-heading-s">{totalQueues}</div>
            </div>
            <div class="wa-stack wa-gap-3xs">
              <div class="wa-body-s wa-color-text-quiet">Running Jobs</div>
              <div class="wa-heading-s">{totalRunningJobs}</div>
            </div>
            <div class="wa-stack wa-gap-3xs">
              <div class="wa-body-s wa-color-text-quiet">Queued Jobs</div>
              <div class="wa-heading-s">{totalQueuedJobs}</div>
            </div>
            <div class="wa-stack wa-gap-3xs">
              <div class="wa-body-s wa-color-text-quiet">Available Agents</div>
              <div class="wa-heading-s">{totalAvailableAgents}</div>
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

        {/* Queue Overview */}
        <wa-card>
          <div style="padding: var(--wa-space-m)">
            <h3 class="wa-heading-s" style="margin-bottom: var(--wa-space-s)">Queue Overview</h3>
            {queueStatus.length > 0
              ? (
                <div class="wa-grid wa-gap-s" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))">
                  {queueStatus.map((queue) => (
                    <div key={queue.queueKey} class="wa-stack wa-gap-3xs">
                      <div class="wa-flank wa-gap-s">
                        <span class="wa-body-s wa-font-weight-semibold">
                          {queue.queueKey === "default" ? "Default" : queue.queueKey}
                        </span>
                        <wa-badge variant={queue.availableAgents > 0 ? "success" : "warning"}>
                          {queue.availableAgents}/{queue.connectedAgents} available
                        </wa-badge>
                      </div>
                      <div class="wa-cluster wa-gap-s">
                        {queue.runningJobs.length > 0 && (
                          <span class="wa-caption-s wa-color-text-quiet">
                            🏃 {queue.runningJobs.length} running
                          </span>
                        )}
                        {queue.scheduledJobs.length > 0 && (
                          <span class="wa-caption-s wa-color-text-quiet">
                            ⏳ {queue.scheduledJobs.length} queued
                          </span>
                        )}
                        {queue.runningJobs.length === 0 && queue.scheduledJobs.length === 0 && (
                          <span class="wa-caption-s wa-color-text-quiet">
                            💤 idle
                          </span>
                        )}
                      </div>
                      {queue.scheduledJobs.length > 0 && (
                        <div class="wa-caption-xs wa-color-text-quiet">
                          Next: {queue.scheduledJobs.slice(0, 2).map((job: QueueJob) => job.pipelineName).join(", ")}
                          {queue.scheduledJobs.length > 2 && ` +${queue.scheduledJobs.length - 2} more`}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
              : (
                <div class="wa-stack wa-gap-s">
                  <div class="wa-flank wa-gap-s">
                    <span class="wa-body-s wa-color-text-quiet">💤 All queues are idle</span>
                    <wa-badge variant="success">No builds pending</wa-badge>
                  </div>
                  <p class="wa-caption-s wa-color-text-quiet">
                    No builds are currently scheduled or running across any queues
                  </p>
                </div>
              )}
          </div>
        </wa-card>

        {/* Queue Details */}
        {queueStatus.length > 0 && (
          <wa-card>
            <div style="padding: var(--wa-space-m)">
              <h3 class="wa-heading-s" style="margin-bottom: var(--wa-space-s)">Queue Details</h3>
              <div class="wa-stack wa-gap-m">
                {queueStatus
                  .filter((queue) => queue.scheduledJobs.length > 0)
                  .map((queue) => (
                    <wa-details
                      key={queue.queueKey}
                      summary={`📋 ${queue.queueKey} queue (${queue.scheduledBuilds.length} builds, ${queue.scheduledJobs.length} jobs waiting)`}
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
                                    Build #{build.buildNumber} - {build.pipelineName}
                                  </span>
                                  <span class="wa-caption-s wa-color-text-quiet">
                                    {build.repo && `${build.repo} • `}
                                    Scheduled: {new Date(build.scheduledAt).toLocaleString()}
                                  </span>
                                </div>
                                <div class="wa-cluster wa-gap-s">
                                  <wa-badge variant="warning">
                                    {build.jobs.length} job{build.jobs.length !== 1 ? "s" : ""}
                                  </wa-badge>
                                  <a href={build.buildUrl} target="_blank" rel="noopener" class="wa-caption-s">
                                    View build ↗
                                  </a>
                                </div>
                              </div>
                              {build.jobs.length > 0 && (
                                <div class="wa-stack wa-gap-3xs">
                                  <span class="wa-caption-s wa-color-text-quiet wa-font-weight-semibold">
                                    Jobs in this build:
                                  </span>
                                  <div class="wa-stack wa-gap-2xs">
                                    {build.jobs.map((job: QueueJob) => (
                                      <div
                                        key={job.id}
                                        class="wa-flank wa-gap-s"
                                        style="padding: var(--wa-space-s); background: var(--wa-color-neutral-fill); border-radius: var(--wa-border-radius-xs)"
                                      >
                                        <span class="wa-caption-s">
                                          Job #{job.id.slice(-8)} •{" "}
                                          {job.agentQueryRules?.join(", ") || "No specific requirements"}
                                        </span>
                                        <a
                                          href={`/pipelines/${job.pipelineSlug}/builds/${job.buildNumber}`}
                                          class="wa-caption-xs"
                                        >
                                          View build →
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
                  title="No queued builds! 🎉"
                  description="All queues are clear. Check back later for new activity."
                  variant="success"
                  maxWidth="600px"
                />
              )}
            </div>
          </wa-card>
        )}

        {queueStatus.length === 0 && !error && (
          <EmptyState
            icon="loader"
            title="Loading queue data..."
            description="Gathering information about build queues and agent availability."
            variant="neutral"
            maxWidth="600px"
          />
        )}
      </div>
    </Layout>
  )
}
