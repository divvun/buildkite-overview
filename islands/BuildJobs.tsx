import { useEffect, useState } from "preact/hooks"
import JobLogs from "~/islands/JobLogs.tsx"
import { type BuildkiteJob } from "~/utils/buildkite-client.ts"
import { getBadgeVariant } from "~/utils/formatters.ts"

interface BuildJobsProps {
  buildId: string
  buildNumber?: number | null
  pipelineSlug?: string | null
  initialJobs?: BuildkiteJob[]
}

function getJobBadgeVariant(status: string, passed?: boolean): string {
  if (passed === false) {
    return "danger" // If the job didn't pass, always show as danger
  }
  return getBadgeVariant(status)
}

function getJobStatusIcon(status: string, passed: boolean) {
  if (!passed) {
    return "✗"
  }

  switch (status) {
    case "PASSED":
    case "FINISHED":
      return "✓"
    case "FAILED":
    case "CANCELED":
    case "WAITING_FAILED":
      return "✗"
    case "RUNNING":
    case "SCHEDULED":
    case "CREATING":
    case "WAITING":
    case "BLOCKED":
    case "CANCELING":
      return "◐"
    default:
      return "○"
  }
}

function getJobTitle(job: BuildkiteJob): string | null {
  // For now, return null until we figure out the correct GraphQL field for job labels
  // The Buildkite GraphQL API doesn't expose step labels in a straightforward way
  // return null
  return job.label ?? job.command ?? null
}

function getJobCommand(job: BuildkiteJob): string | null {
  // Return the command as subtitle
  return job.command || null
}

function formatJobTiming(job: BuildkiteJob): string {
  const duration = formatDuration(job.startedAt, job.finishedAt)
  const timeAgo = job.startedAt ? formatTimeAgo(job.startedAt) : "Not started"

  if (job.startedAt && job.finishedAt) {
    return `Ran in ${duration}`
  } else if (job.startedAt) {
    return `Running for ${duration}`
  } else {
    return "Not started"
  }
}

function formatDuration(startedAt?: string, finishedAt?: string) {
  if (!startedAt) return "Not started"

  const start = new Date(startedAt)
  const end = finishedAt ? new Date(finishedAt) : new Date()
  const durationMs = end.getTime() - start.getTime()

  if (durationMs < 0) return "0s"

  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const mins = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const secs = Math.floor((durationMs % (1000 * 60)) / 1000)

  if (hours > 0) return `${hours}h ${mins}m ${secs}s`
  if (mins > 0) return `${mins}m ${secs}s`
  return `${secs}s`
}

function formatTimeAgo(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return "now"
  if (diffMins < 60) return `${diffMins} minutes ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`
  return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`
}

export default function BuildJobs(
  { buildId, buildNumber: initialBuildNumber, pipelineSlug: initialPipelineSlug, initialJobs = [] }: BuildJobsProps,
) {
  const [jobs, setJobs] = useState<BuildkiteJob[]>(initialJobs)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>("")
  const [expandedJob, setExpandedJob] = useState<string | null>(null)
  const [buildNumber, setBuildNumber] = useState<number | null>(initialBuildNumber || null)
  const [pipelineSlug, setPipelineSlug] = useState<string | null>(initialPipelineSlug || null)

  useEffect(() => {
    // Only fetch if we don't have initial jobs
    if (initialJobs.length === 0) {
      console.log("No initial jobs provided, fetching from API...")
      fetchJobs()
    }
  }, [buildId])

  const fetchJobs = async () => {
    try {
      setLoading(true)
      setError("")

      const response = await fetch(`/api/builds/${buildId}/jobs`)
      if (!response.ok) {
        const statusText = response.status === 404
          ? "Build not found"
          : response.status === 403
          ? "Insufficient permissions"
          : `HTTP ${response.status}`
        throw new Error(`Unable to load jobs: ${statusText}`)
      }

      const data = await response.json()
      setJobs(data.jobs)
      console.log(data.jobs)
      setBuildNumber(data.buildNumber)
      setPipelineSlug(data.pipelineSlug)
    } catch (err) {
      console.error("Error fetching jobs:", err)
      setError(
        "Unable to load job information. This may be due to insufficient permissions or a temporary API issue. Please try again.",
      )
    } finally {
      setLoading(false)
    }
  }

  const handleJobClick = (jobId: string) => {
    if (expandedJob === jobId) {
      setExpandedJob(null)
    } else {
      setExpandedJob(jobId)
    }
  }

  if (loading) {
    return (
      <wa-card>
        <div class="wa-stack wa-gap-s wa-align-items-center" style="padding: var(--wa-space-l)">
          <wa-icon name="spinner" style="font-size: 2rem; color: var(--wa-color-brand-fill-loud)" />
          <p class="wa-body-m wa-color-text-quiet">Loading jobs...</p>
        </div>
      </wa-card>
    )
  }

  if (error) {
    return (
      <wa-card>
        <wa-callout variant="danger">
          <wa-icon slot="icon" name="triangle-exclamation" />
          {error}
        </wa-callout>
      </wa-card>
    )
  }

  if (jobs.length === 0) {
    return (
      <wa-card>
        <div class="wa-stack wa-gap-s wa-align-items-center" style="padding: var(--wa-space-l)">
          <wa-icon name="inbox" style="font-size: 2rem; color: var(--wa-color-neutral-fill-loud)" />
          <p class="wa-body-m wa-color-text-quiet">No jobs found for this build</p>
        </div>
      </wa-card>
    )
  }

  return (
    <div class="wa-stack wa-gap-s">
      {jobs.toSorted((a, b) => {
        // Sort by startedAt time (most recent first)
        if (!a.startedAt && !b.startedAt) {
          return 0
        }
        if (!a.startedAt) {
          return 1
        }
        if (!b.startedAt) {
          return -1
        }

        return new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
      }).map((job) => {
        const jobKey = job.uuid || job.id
        return (
          <wa-card key={jobKey} class="clickable-card">
            <div
              style="display: flex; align-items: center; gap: var(--wa-space-s); padding: 0; cursor: pointer"
              onClick={() => handleJobClick(jobKey)}
            >
              <span style="width: 1rem; text-align: center;">
                <span
                  style={`font-size: 1rem; color: ${
                    ["PASSED", "FINISHED"].includes(job.state) && job.passed
                      ? "var(--wa-color-success-fill-loud)"
                      : ["FAILED", "CANCELED", "WAITING_FAILED"].includes(job.state) || !job.passed
                      ? "var(--wa-color-danger-fill-loud)"
                      : ["RUNNING", "SCHEDULED", "CREATING", "WAITING", "BLOCKED", "CANCELING"].includes(job.state)
                      ? "var(--wa-color-warning-fill-loud)"
                      : "var(--wa-color-text-quiet)"
                  }`}
                >
                  {getJobStatusIcon(job.state, job.passed ?? false)}
                </span>
              </span>

              <div style="flex: 1; display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; flex-direction: column; gap: var(--wa-space-3xs)">
                  {getJobTitle(job)
                    ? (
                      <>
                        <span class="wa-body-s">
                          {getJobTitle(job)}
                        </span>
                        {getJobCommand(job) && (
                          <span class="wa-caption-xs wa-color-text-quiet" style="font-family: monospace">
                            {getJobCommand(job)!.length > 60
                              ? `${getJobCommand(job)!.substring(0, 60)}...`
                              : getJobCommand(job)}
                          </span>
                        )}
                      </>
                    )
                    : getJobCommand(job)
                    ? (
                      <span class="wa-body-s" style="font-family: monospace">
                        {getJobCommand(job)}
                      </span>
                    )
                    : (
                      <span class="wa-body-s">
                        Job
                      </span>
                    )}
                </div>

                <div style="display: flex; align-items: center; gap: var(--wa-space-m)">
                  <span class="wa-caption-s wa-color-text-quiet">
                    {formatJobTiming(job)}
                  </span>
                  <span
                    style={`transform: ${
                      expandedJob === jobKey ? "rotate(90deg)" : "rotate(0deg)"
                    }; transition: transform 0.2s; font-size: 0.75rem; color: var(--wa-color-text-quiet)`}
                  >
                    ▶
                  </span>
                </div>
              </div>
            </div>

            {expandedJob === jobKey && (
              <div style="border-top: 1px solid var(--wa-color-border-subtle); background: var(--wa-color-neutral-fill-subtle)">
                <div class="wa-stack wa-gap-s" style="padding: var(--wa-space-m)">
                  <div class="wa-grid wa-gap-s" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))">
                    <div class="wa-stack wa-gap-3xs">
                      <div class="wa-caption-xs wa-color-text-quiet">Started</div>
                      <div class="wa-caption-s">
                        {job.startedAt ? new Date(job.startedAt).toLocaleString() : "Not started"}
                      </div>
                    </div>

                    <div class="wa-stack wa-gap-3xs">
                      <div class="wa-caption-xs wa-color-text-quiet">Finished</div>
                      <div class="wa-caption-s">
                        {job.finishedAt ? new Date(job.finishedAt).toLocaleString() : "Not finished"}
                      </div>
                    </div>

                    <div class="wa-stack wa-gap-3xs">
                      <div class="wa-caption-xs wa-color-text-quiet">Duration</div>
                      <div class="wa-caption-s">
                        {formatDuration(job.startedAt, job.finishedAt)}
                      </div>
                    </div>

                    {job.exitStatus !== undefined && job.exitStatus !== null && (
                      <div class="wa-stack wa-gap-3xs">
                        <div class="wa-caption-xs wa-color-text-quiet">Exit Status</div>
                        <div class="wa-caption-s">
                          <span
                            style={job.exitStatus === 0
                              ? "color: var(--wa-color-success-text-loud); font-weight: 600"
                              : "color: var(--wa-color-danger-text-loud); font-weight: 600"}
                          >
                            {job.exitStatus}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {
                    /* {job.command && (
                    <div class="wa-stack wa-gap-xs">
                      <div class="wa-caption-xs wa-color-text-quiet">Command</div>
                      <div
                        class="wa-caption-s"
                        style="font-family: monospace; background: white; padding: var(--wa-space-s); border-radius: var(--wa-border-radius-s); white-space: pre-wrap; border: 1px solid var(--wa-color-border-subtle)"
                      >
                        {job.command}
                      </div>
                    </div>
                  )} */
                  }

                  <div class="wa-stack wa-gap-xs">
                    <h5 class="wa-heading-xs">Job Logs</h5>
                    <JobLogs
                      jobId={job.uuid || job.id}
                      buildNumber={buildNumber}
                      pipelineSlug={pipelineSlug}
                    />
                  </div>
                </div>
              </div>
            )}
          </wa-card>
        )
      })}
    </div>
  )
}
