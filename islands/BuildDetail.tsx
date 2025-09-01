import { useEffect, useState } from "preact/hooks"
import BuildJobs from "~/islands/BuildJobs.tsx"
import { type BuildkiteBuild, type BuildkiteJob } from "~/types/buildkite.ts"
import {
  formatDuration,
  formatTimeAgo,
  getBadgeVariant,
  getGitHubBranchUrl,
  getGitHubCommitUrl,
  getStatusIcon,
  getTranslatedStatus,
  isBuildFinished,
  isRunningStatus,
} from "~/utils/formatters.ts"
import { useLocalization } from "~/utils/localization-context.tsx"

interface BuildDetailProps {
  pipelineSlug: string
  buildNumber: number
  initialBuild: BuildkiteBuild
  initialJobs: BuildkiteJob[]
  repositoryName?: string
}

export default function BuildDetail(
  { pipelineSlug, buildNumber, initialBuild, initialJobs, repositoryName }: BuildDetailProps,
) {
  const { t, locale } = useLocalization()
  const [build, setBuild] = useState<BuildkiteBuild>(initialBuild)
  const [jobs, setJobs] = useState<BuildkiteJob[]>(initialJobs)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>("")

  // Check if the build is finished and shouldn't refresh
  const buildFinished = isBuildFinished(build.state)

  useEffect(() => {
    // Set up auto-refresh listener only if build is not finished
    if (buildFinished) {
      console.log(`Build #${buildNumber} is finished (${build.state}), not setting up auto-refresh`)
      return
    }

    console.log(`Build #${buildNumber} is not finished (${build.state}), setting up auto-refresh`)

    const handleRefresh = () => {
      console.log(`Auto-refresh triggered for build #${buildNumber}`)
      // Re-check if build is finished before refreshing
      if (!isBuildFinished(build.state)) {
        fetchBuildData()
      }
    }

    // Listen for refresh events from AutoRefresh component
    globalThis.addEventListener("autorefresh", handleRefresh)

    return () => {
      globalThis.removeEventListener("autorefresh", handleRefresh)
    }
  }, [buildFinished, build.state, buildNumber])

  const fetchBuildData = async () => {
    try {
      setLoading(true)
      setError("")

      const response = await fetch(`/api/pipelines/${pipelineSlug}/builds/${buildNumber}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()
      setBuild(data.build)
      setJobs(data.jobs)

      console.log(`Refreshed build #${buildNumber}, state: ${data.build.state}`)
    } catch (err) {
      console.error("Error refreshing build data:", err)
      setError(err instanceof Error ? err.message : "Failed to refresh build data")
    } finally {
      setLoading(false)
    }
  }

  const breadcrumbs = [
    { label: t("pipelines-breadcrumb"), href: "/pipelines" },
    { label: build.pipeline.name, href: `/pipelines/${pipelineSlug}` },
    { label: t("build-number", { number: build.number }) },
  ]

  return (
    <div class="wa-stack wa-gap-l" style="padding: var(--wa-space-l) 0">
      {error && (
        <wa-callout variant="warning" size="small">
          <wa-icon slot="icon" name="triangle-exclamation" />
          {t("refresh-error")}: {error}
        </wa-callout>
      )}

      <header class="wa-stack wa-gap-s">
        <div class="wa-stack wa-gap-s">
          <div class="wa-flank wa-gap-s">
            {loading && (
              <wa-icon
                name="spinner"
                style="font-size: 1rem; color: var(--wa-color-warning-fill-loud)"
              />
            )}
            {isRunningStatus(build.state)
              ? (
                <wa-spinner style="color: var(--wa-color-warning-fill-loud); font-size: 1.5rem">
                </wa-spinner>
              )
              : (
                <wa-icon
                  name={getStatusIcon(build.state)}
                  style={`color: var(--wa-color-${getBadgeVariant(build.state)}-fill-loud); font-size: 1.5rem` as any}
                >
                </wa-icon>
              )}
            <h1 class="wa-heading-l">{t("build-number", { number: build.number })}</h1>
            <wa-badge variant={getBadgeVariant(build.state)}>
              {getTranslatedStatus(build.state, t)}
            </wa-badge>
          </div>

          <div class="wa-cluster wa-gap-l">
            <div class="wa-caption-m wa-color-text-quiet">
              {t("duration-label")}: {formatDuration(build.startedAt, build.finishedAt, locale)}
            </div>
            <div class="wa-caption-m wa-color-text-quiet">
              {t("started-label-colon")}:{" "}
              {build.startedAt ? formatTimeAgo(build.startedAt, locale, t) : t("not-started")}
            </div>
          </div>
        </div>

        {build.message && (
          <>
            <wa-divider></wa-divider>
            <div class="wa-stack wa-gap-xs">
              <div class="wa-body-m">{build.message}</div>
              <div class="wa-cluster wa-gap-l">
                {build.branch && (
                  <div class="wa-caption-s wa-color-text-quiet">
                    <wa-icon name="code-branch" style="margin-right: var(--wa-space-3xs); vertical-align: middle">
                    </wa-icon>
                    {repositoryName
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
                        build.branch
                      )}
                  </div>
                )}
                {build.commit && (
                  <div class="wa-caption-s wa-color-text-quiet">
                    <wa-icon name="code-commit" style="margin-right: var(--wa-space-3xs); vertical-align: middle">
                    </wa-icon>
                    {repositoryName
                      ? (
                        <a
                          href={getGitHubCommitUrl(repositoryName, build.commit)}
                          target="_blank"
                          rel="noopener noreferrer"
                          class="github-link"
                        >
                          {build.commit.substring(0, 8)}
                        </a>
                      )
                      : (
                        build.commit.substring(0, 8)
                      )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </header>

      <wa-divider></wa-divider>

      <section>
        <h2 class="wa-heading-m">{t("jobs-heading")}</h2>
        <BuildJobs
          buildId={build.id}
          buildNumber={build.number}
          pipelineSlug={pipelineSlug}
          initialJobs={jobs}
          refreshTrigger={build.state} // Pass build state to trigger refresh in BuildJobs
        />
      </section>
    </div>
  )
}
