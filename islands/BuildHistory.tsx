import { useEffect, useState } from "preact/hooks"
import type { BuildkiteBuildRest } from "~/server/buildkite-client.ts"
import {
  formatDuration,
  formatTimeAgo,
  getBadgeVariant,
  getGitHubBranchUrl,
  getStatusIcon,
  isRunningStatus,
} from "~/utils/formatters.ts"
import { useLocalization } from "~/utils/localization-context.tsx"

interface BuildHistoryProps {
  initialBuilds?: BuildkiteBuildRest[]
}

export default function BuildHistory({ initialBuilds = [] }: BuildHistoryProps) {
  const { t, locale } = useLocalization()
  const [builds, setBuilds] = useState<BuildkiteBuildRest[]>(initialBuilds)
  const [loading, setLoading] = useState(true) // Start with loading since we fetch on mount
  const [error, setError] = useState<string>("")

  console.log("BuildHistory mounted with", initialBuilds.length, "initial builds")

  useEffect(() => {
    console.log("Fetching build history from API...")
    fetchBuilds()
  }, [])

  const fetchBuilds = async () => {
    try {
      setLoading(true)
      setError("")

      console.log("Fetching build history...")
      const response = await fetch("/api/admin/builds?limit=50")
      console.log(`API response status: ${response.status}`)

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`API error: ${response.status} - ${errorText}`)
        const statusText = response.status === 404
          ? "Not found"
          : response.status === 403
          ? "Access denied"
          : `HTTP ${response.status}`
        throw new Error(`Unable to load build history: ${statusText}`)
      }

      const data = await response.json()
      console.log(`Received ${data.builds?.length || 0} builds`)
      setBuilds(data.builds || [])
    } catch (err) {
      console.error("Error fetching build history:", err)
      setError("Unable to load build history. Please try again later.")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <wa-card>
        <div class="wa-stack wa-gap-s wa-align-items-center" style="padding: var(--wa-space-l)">
          <wa-spinner style="font-size: 2rem; color: var(--wa-color-brand-fill-loud)" />
          <p class="wa-body-m wa-color-text-quiet">Loading build history...</p>
        </div>
      </wa-card>
    )
  }

  if (error) {
    return (
      <wa-card>
        <wa-callout variant="danger">
          <wa-icon slot="icon" name="error" />
          <div class="wa-stack wa-gap-xs">
            <div>Error: {error}</div>
            <div class="wa-caption-s">Endpoint: /api/admin/builds</div>
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
          <p class="wa-body-m wa-color-text-quiet">No completed builds found</p>
        </div>
      </wa-card>
    )
  }

  return (
    <div class="wa-stack wa-gap-s">
      {builds.map((build) => {
        const repoUrl = build.pipeline.repository?.url
        const repositoryName = repoUrl
          ? repoUrl.replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "")
          : undefined

        return (
          <wa-card key={build.id} class="clickable-card">
            <a
              href={`/pipelines/${build.pipeline.slug}/builds/${build.number}`}
              style="text-decoration: none; color: inherit; display: block"
            >
              <div
                class="wa-flank wa-gap-m"
                style="padding: var(--wa-space-s)"
              >
                <div class="wa-stack wa-gap-3xs" style="flex: 1">
                  <div class="wa-flank wa-gap-xs" style="margin-bottom: 0.5rem">
                    {isRunningStatus(build.state)
                      ? <wa-spinner style="color: var(--wa-color-warning-fill-loud)" />
                      : (
                        <wa-icon
                          name={getStatusIcon(build.state)}
                          style={`color: var(--wa-color-${getBadgeVariant(build.state)}-fill-loud)`}
                        />
                      )}
                    <span class="wa-heading-s">{build.pipeline.name} #{build.number}</span>
                  </div>
                  <div class="wa-caption-s wa-color-text-quiet">
                    {build.message || "No commit message"}
                  </div>
                  <div class="wa-cluster wa-gap-s">
                    <div class="wa-caption-xs wa-color-text-quiet">
                      <wa-icon name="git-branch" style="margin-right: var(--wa-space-3xs); vertical-align: middle" />
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
                    {formatDuration(build.started_at, build.finished_at, locale)}
                  </div>
                  <div class="wa-caption-xs wa-color-text-quiet">
                    {formatTimeAgo(build.finished_at || build.created_at, locale, t)}
                  </div>
                </div>
              </div>
            </a>
          </wa-card>
        )
      })}
    </div>
  )
}
