import { useEffect, useState } from "preact/hooks"
import { type BuildkiteBuild } from "~/utils/buildkite-client.ts"
import { formatDuration, formatTimeAgo, getBadgeVariant, getStatusIcon } from "~/utils/formatters.ts"

interface PipelineBuildsProps {
  pipelineSlug: string
  initialBuilds?: BuildkiteBuild[]
}

export default function PipelineBuilds({ pipelineSlug, initialBuilds = [] }: PipelineBuildsProps) {
  const [builds, setBuilds] = useState<BuildkiteBuild[]>(initialBuilds)
  const [loading, setLoading] = useState(false) // Don't load if we have initial builds
  const [error, setError] = useState<string>("")
  const [expandedBuild, setExpandedBuild] = useState<string | null>(null)
  const [buildJobs, setBuildJobs] = useState<Record<string, any[]>>({})

  console.log("PipelineBuilds mounted with", initialBuilds.length, "initial builds")

  useEffect(() => {
    // Only fetch if we don't have initial builds
    if (initialBuilds.length === 0) {
      console.log("No initial builds provided, fetching from API...")
      fetchBuilds()
    }
  }, [pipelineSlug])

  const fetchBuilds = async () => {
    try {
      setLoading(true)
      setError("")

      console.log(`Fetching builds for pipeline: ${pipelineSlug}`)
      const response = await fetch(`/api/pipelines/${pipelineSlug}/builds?limit=20`)
      console.log(`API response status: ${response.status}`)

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`API error: ${response.status} - ${errorText}`)
        const statusText = response.status === 404
          ? "Pipeline not found"
          : response.status === 403
          ? "Access denied"
          : `HTTP ${response.status}`
        throw new Error(`Unable to load builds: ${statusText}`)
      }

      const data = await response.json()
      console.log(`Received ${data.length} builds:`, data.map((b) => `#${b.number}`))
      setBuilds(data)
    } catch (err) {
      console.error("Error fetching builds:", err)
      setError("Unable to load build history. Please refresh the page or check your connection.")
    } finally {
      setLoading(false)
    }
  }

  const fetchJobsForBuild = async (buildId: string) => {
    if (buildJobs[buildId]) return // Already fetched

    try {
      const response = await fetch(`/api/builds/${buildId}/jobs`)
      if (response.ok) {
        const jobs = await response.json()
        setBuildJobs((prev) => ({ ...prev, [buildId]: jobs }))
      }
    } catch (err) {
      console.error("Error fetching jobs for build:", buildId, err)
    }
  }

  const handleBuildClick = (buildId: string) => {
    if (expandedBuild === buildId) {
      setExpandedBuild(null)
    } else {
      setExpandedBuild(buildId)
      fetchJobsForBuild(buildId)
    }
  }

  if (loading) {
    return (
      <wa-card>
        <div class="wa-stack wa-gap-s wa-align-items-center" style="padding: var(--wa-space-l)">
          <wa-icon name="spinner" style="font-size: 2rem; color: var(--wa-color-brand-fill-loud)" />
          <p class="wa-body-m wa-color-text-quiet">Loading builds for {pipelineSlug}...</p>
          <p class="wa-caption-s wa-color-text-quiet">
            If this persists, check: /api/pipelines/{pipelineSlug}/builds
          </p>
        </div>
      </wa-card>
    )
  }

  if (error) {
    return (
      <wa-card>
        <wa-callout variant="danger">
          <wa-icon slot="icon" name="triangle-exclamation" />
          <div class="wa-stack wa-gap-xs">
            <div>Error: {error}</div>
            <div class="wa-caption-s">Pipeline: {pipelineSlug}</div>
            <div class="wa-caption-s">Endpoint: /api/pipelines/{pipelineSlug}/builds</div>
          </div>
        </wa-callout>
      </wa-card>
    )
  }

  if (builds.length === 0) {
    return (
      <wa-card>
        <div class="wa-stack wa-gap-s wa-align-items-center" style="padding: var(--wa-space-l)">
          <wa-icon name="inbox" style="font-size: 2rem; color: var(--wa-color-neutral-fill-loud)" />
          <p class="wa-body-m wa-color-text-quiet">No builds found for this pipeline</p>
        </div>
      </wa-card>
    )
  }

  return (
    <div class="wa-stack wa-gap-s">
      {builds.map((build) => (
        <wa-card key={build.id} class="build-card">
          <div class="wa-stack wa-gap-s">
            <div
              class="wa-flank wa-gap-m build-header"
              style="padding: var(--wa-space-s)"
            >
              <div class="wa-stack wa-gap-3xs">
                <div class="wa-flank wa-gap-xs">
                  <wa-icon
                    name={getStatusIcon(build.state)}
                    style={`color: var(--wa-color-${getBadgeVariant(build.state)}-fill-loud)` as any}
                  />
                  <a
                    href={`/pipelines/${pipelineSlug}/builds/${build.number}`}
                    style="text-decoration: none; color: inherit"
                  >
                    <span class="wa-heading-s">#{build.number}</span>
                  </a>
                  <wa-badge variant={getBadgeVariant(build.state)}>
                    {build.state}
                  </wa-badge>
                </div>
                <div class="wa-caption-s wa-color-text-quiet">
                  {build.message || "No commit message"}
                </div>
                <div class="wa-cluster wa-gap-s">
                  <div class="wa-caption-xs wa-color-text-quiet">
                    <wa-icon name="code-branch" style="margin-right: var(--wa-space-3xs)" />
                    {build.branch || "unknown"}
                  </div>
                </div>
              </div>

              <div class="wa-stack wa-gap-3xs wa-align-items-end">
                <div class="wa-caption-s">
                  {formatDuration(build.startedAt, build.finishedAt)}
                </div>
                <div class="wa-caption-xs wa-color-text-quiet">
                  {formatTimeAgo(build.startedAt || build.createdAt)}
                </div>
                <div class="wa-cluster wa-gap-xs">
                  <wa-button size="small" appearance="outlined">
                    <wa-icon slot="prefix" name="eye"></wa-icon>
                    <a
                      href={`/pipelines/${pipelineSlug}/builds/${build.number}`}
                      style="text-decoration: none; color: inherit"
                    >
                      Details
                    </a>
                  </wa-button>
                  <wa-button
                    size="small"
                    appearance="plain"
                    onClick={() => handleBuildClick(build.id)}
                  >
                    <wa-icon
                      name={expandedBuild === build.id ? "chevron-up" : "chevron-down"}
                    />
                  </wa-button>
                </div>
              </div>
            </div>

            {expandedBuild === build.id && (
              <div style="border-top: 1px solid var(--wa-color-border-subtle); padding: var(--wa-space-s)">
                <div class="wa-stack wa-gap-s">
                  <div class="wa-flank">
                    <h4 class="wa-heading-xs">Jobs</h4>
                    {build.url && (
                      <wa-button size="small" appearance="outlined">
                        <wa-icon slot="prefix" name="arrow-up-right-from-square" />
                        <a href={build.url} target="_blank" style="text-decoration: none; color: inherit">
                          View in Buildkite
                        </a>
                      </wa-button>
                    )}
                  </div>

                  {buildJobs[build.id]
                    ? (
                      <div class="wa-stack wa-gap-xs">
                        {buildJobs[build.id].map((job: any) => (
                          <div
                            key={job.id}
                            class="wa-flank wa-gap-s"
                            style="padding: var(--wa-space-xs); border: 1px solid var(--wa-color-border-subtle); border-radius: var(--wa-border-radius-m)"
                          >
                            <div class="wa-stack wa-gap-3xs">
                              <div class="wa-flank wa-gap-xs">
                                <wa-icon
                                  name={getStatusIcon(job.state)}
                                  style={`color: var(--wa-color-${getBadgeVariant(job.state)}-fill-loud)` as any}
                                />
                                <span class="wa-body-s">
                                  {job.step?.label || job.name || job.command || `${job.type} job`}
                                </span>
                                <wa-badge variant={getBadgeVariant(job.state)}>
                                  {job.state}
                                </wa-badge>
                              </div>
                              {job.exitStatus !== undefined && job.exitStatus !== null && (
                                <div class="wa-caption-xs wa-color-text-quiet">
                                  Exit code: {job.exitStatus}
                                </div>
                              )}
                            </div>

                            <div class="wa-cluster wa-gap-xs">
                              <div class="wa-caption-xs">
                                {formatDuration(job.startedAt, job.finishedAt)}
                              </div>
                              {job.url && (
                                <wa-button size="small" appearance="plain">
                                  <wa-icon slot="prefix" name="file-lines" />
                                  <a href={job.url} target="_blank" style="text-decoration: none; color: inherit">
                                    Logs
                                  </a>
                                </wa-button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                    : (
                      <div class="wa-stack wa-gap-s wa-align-items-center" style="padding: var(--wa-space-m)">
                        <wa-icon name="spinner" style="color: var(--wa-color-brand-fill-loud)" />
                        <p class="wa-caption-s wa-color-text-quiet">Loading jobs...</p>
                      </div>
                    )}
                </div>
              </div>
            )}
          </div>
        </wa-card>
      ))}
    </div>
  )
}
