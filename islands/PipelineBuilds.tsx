import { useEffect, useState } from "preact/hooks"
import { type BuildkiteBuild } from "~/utils/buildkite-client.ts"
import {
  formatDuration,
  formatTimeAgo,
  getBadgeVariant,
  getGitHubBranchUrl,
  getStatusIcon,
  isRunningStatus,
} from "~/utils/formatters.ts"
import { useLocalization } from "~/utils/localization-context.tsx"

interface PipelineBuildsProps {
  pipelineSlug: string
  initialBuilds?: BuildkiteBuild[]
  repositoryName?: string
}

export default function PipelineBuilds({ pipelineSlug, initialBuilds = [], repositoryName }: PipelineBuildsProps) {
  const { t, locale } = useLocalization()
  const [builds, setBuilds] = useState<BuildkiteBuild[]>(initialBuilds)
  const [loading, setLoading] = useState(false) // Don't load if we have initial builds
  const [error, setError] = useState<string>("")

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
          ? t("pipeline-not-found")
          : response.status === 403
          ? t("access-denied")
          : `HTTP ${response.status}`
        throw new Error(t("unable-to-load-builds", { error: statusText }))
      }

      const data = await response.json()
      console.log(`Received ${data.length} builds:`, data.map((b: { number: number }) => `#${b.number}`))
      setBuilds(data)
    } catch (err) {
      console.error("Error fetching builds:", err)
      setError(t("unable-to-load-build-history"))
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <wa-card>
        <div class="wa-stack wa-gap-s wa-align-items-center" style="padding: var(--wa-space-l)">
          <wa-icon name="spinner" style="font-size: 2rem; color: var(--wa-color-brand-fill-loud)" />
          <p class="wa-body-m wa-color-text-quiet">{t("loading-builds", { pipeline: pipelineSlug })}</p>
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
            <div>{t("error-label")} {error}</div>
            <div class="wa-caption-s">{t("pipeline-label")} {pipelineSlug}</div>
            <div class="wa-caption-s">{t("endpoint-label")} /api/pipelines/{pipelineSlug}/builds</div>
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
          <p class="wa-body-m wa-color-text-quiet">{t("no-builds-found")}</p>
        </div>
      </wa-card>
    )
  }

  return (
    <div class="wa-stack wa-gap-s">
      {builds.map((build) => (
        <wa-card key={build.id} class="clickable-card">
          <a
            href={`/pipelines/${pipelineSlug}/builds/${build.number}`}
            style="text-decoration: none; color: inherit; display: block"
          >
            <div
              class="wa-flank wa-gap-m"
              style="padding: var(--wa-space-s)"
            >
              <div class="wa-stack wa-gap-3xs">
                <div class="wa-flank wa-gap-xs" style="margin-bottom: 0.5rem">
                  {isRunningStatus(build.state)
                    ? <wa-spinner style="color: var(--wa-color-warning-fill-loud)" />
                    : (
                      <wa-icon
                        name={getStatusIcon(build.state)}
                        style={`color: var(--wa-color-${getBadgeVariant(build.state)}-fill-loud)`}
                      />
                    )}
                  <span class="wa-heading-s">#{build.number}</span>
                </div>
                <div class="wa-caption-s wa-color-text-quiet">
                  {build.message || t("no-commit-message")}
                </div>
                <div class="wa-cluster wa-gap-s">
                  <div class="wa-caption-xs wa-color-text-quiet">
                    <wa-icon name="code-branch" style="margin-right: var(--wa-space-3xs); vertical-align: middle" />
                    {repositoryName && build.branch
                      ? (
                        <a
                          href={getGitHubBranchUrl(repositoryName, build.branch)}
                          target="_blank"
                          rel="noopener noreferrer"
                          class="github-link"
                        >
                          {build.branch}
                        </a>
                      )
                      : (
                        build.branch || "unknown"
                      )}
                  </div>
                </div>
              </div>

              <div class="wa-stack wa-gap-3xs wa-align-items-end">
                <wa-badge style="margin-bottom: 0.5rem" variant={getBadgeVariant(build.state)}>
                  {build.state}
                </wa-badge>
                <div class="wa-caption-s">
                  {formatDuration(build.startedAt, build.finishedAt, locale)}
                </div>
                <div class="wa-caption-xs wa-color-text-quiet">
                  {formatTimeAgo(build.startedAt || build.createdAt, locale, t)}
                </div>
              </div>
            </div>
          </a>
        </wa-card>
      ))}
    </div>
  )
}
