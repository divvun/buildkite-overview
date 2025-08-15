/// <reference path="../types/webawesome.d.ts" />
import { Context, page } from "fresh"
import Layout from "~/components/Layout.tsx"
import AutoRefresh from "~/islands/AutoRefresh.tsx"
import { type AppState } from "~/utils/middleware.ts"
import { requireDivvunOrgAccess, type SessionData } from "~/utils/session.ts"
import { type AppBuild, fetchRunningBuilds } from "~/utils/buildkite-data.ts"
import { formatDuration, formatTimeAgo, getOrgFromRepo } from "~/utils/formatters.ts"
import EmptyState from "~/components/EmptyState.tsx"

interface RunningProps {
  session: SessionData
  runningBuilds: AppBuild[]
  orgFilter?: string
  error?: string
}

export const handler = {
  async GET(ctx: Context<AppState>) {
    // Require authentication and divvun organization membership
    const session = requireDivvunOrgAccess(ctx.req)
    const url = new URL(ctx.req.url)
    const rawOrgFilter = url.searchParams.get("org")

    // Validate and sanitize org filter - must be alphanumeric with dashes/underscores only
    const orgFilter = rawOrgFilter?.match(/^[a-zA-Z0-9_-]+$/) ? rawOrgFilter : undefined

    try {
      console.log("Fetching running builds data...")

      let runningBuilds = await fetchRunningBuilds()

      // Filter by organization if specified
      if (orgFilter) {
        runningBuilds = runningBuilds.filter((build) => getOrgFromRepo(build.repo) === orgFilter)
      }

      // Sort by most recently started
      runningBuilds.sort((a, b) => {
        if (a.lastRun === "now" && b.lastRun !== "now") return -1
        if (b.lastRun === "now" && a.lastRun !== "now") return 1
        return 0
      })

      console.log(`Found ${runningBuilds.length} running builds`)

      return page(
        {
          session,
          runningBuilds,
          orgFilter,
        } satisfies RunningProps,
      )
    } catch (error) {
      console.error("Error fetching running builds data:", error)

      return page(
        {
          session,
          runningBuilds: [],
          orgFilter,
          error:
            "Unable to fetch currently running builds. This may be a temporary network issue or API rate limiting. Please wait a moment and try again.",
        } satisfies RunningProps,
      )
    }
  },
}

export default function Running(props: { data: RunningProps; state: AppState }) {
  const { session, runningBuilds, orgFilter, error } = props.data

  const breadcrumbs = [
    { label: "Overview", href: "/" },
    { label: "Running Builds" },
  ]

  // Group builds by organization
  const buildsByOrg = runningBuilds.reduce((acc, build) => {
    const org = getOrgFromRepo(build.repo)
    if (!acc[org]) {
      acc[org] = []
    }
    acc[org].push(build)
    return acc
  }, {} as Record<string, AppBuild[]>)

  const organizations = Object.keys(buildsByOrg).sort()

  return (
    <Layout
      title="Running Builds"
      currentPath="/running"
      session={session}
      breadcrumbs={breadcrumbs}
    >
      <div class="wa-stack wa-gap-l" style="padding: var(--wa-space-l) 0">
        <header>
          <h1 class="wa-heading-l">Running Builds</h1>
          <p class="wa-body-m wa-color-text-quiet">
            View all currently running builds across all pipelines
          </p>
        </header>

        <div class="wa-flank" style="max-width: 1000px">
          <div class="wa-cluster wa-gap-m">
            <div class="wa-stack wa-gap-3xs">
              <div class="wa-body-s wa-color-text-quiet">Running Builds</div>
              <div class="wa-heading-s">{runningBuilds.length}</div>
            </div>
            <div class="wa-stack wa-gap-3xs">
              <div class="wa-body-s wa-color-text-quiet">Organizations</div>
              <div class="wa-heading-s">{organizations.length}</div>
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

        {/* Organization Filter */}
        {organizations.length > 1 && (
          <div class="wa-cluster wa-gap-s">
            <span class="wa-body-s">Organization:</span>
            <a
              href="/running"
              class={`wa-button ${!orgFilter ? "wa-button-primary" : "wa-button-secondary"}`}
              style="text-decoration: none"
            >
              All ({runningBuilds.length})
            </a>
            {organizations.map((org) => (
              <a
                key={org}
                href={`/running?org=${org}`}
                class={`wa-button ${orgFilter === org ? "wa-button-primary" : "wa-button-secondary"}`}
                style="text-decoration: none"
              >
                {org} ({buildsByOrg[org].length})
              </a>
            ))}
          </div>
        )}

        {runningBuilds.length === 0 && !error
          ? (
            <EmptyState
              icon="check-circle"
              title="No running builds! 🎉"
              description={orgFilter
                ? `No running builds found for organization "${orgFilter}"`
                : "All builds have completed. Check back later for new activity."}
              variant="success"
              maxWidth="900px"
            />
          )
          : error
          ? (
            <div class="wa-stack wa-gap-s" style="max-width: 900px">
              {[1, 2, 3].map((i) => (
                <wa-card key={`skeleton-${i}`}>
                  <div style="padding: var(--wa-space-m)">
                    <div class="wa-flank wa-gap-m">
                      <div class="wa-stack wa-gap-3xs">
                        <div class="wa-flank wa-gap-s">
                          <div style="width: 200px; height: 20px; background: var(--wa-color-neutral-fill-subtle); border-radius: 4px; animation: pulse 1.5s ease-in-out infinite;">
                          </div>
                          <div style="width: 80px; height: 24px; background: var(--wa-color-neutral-fill-subtle); border-radius: 12px; animation: pulse 1.5s ease-in-out infinite;">
                          </div>
                        </div>
                        <div class="wa-cluster wa-gap-s">
                          <div style="width: 80px; height: 16px; background: var(--wa-color-neutral-fill-subtle); border-radius: 4px; animation: pulse 1.5s ease-in-out infinite;">
                          </div>
                          <div style="width: 120px; height: 16px; background: var(--wa-color-neutral-fill-subtle); border-radius: 4px; animation: pulse 1.5s ease-in-out infinite;">
                          </div>
                          <div style="width: 100px; height: 16px; background: var(--wa-color-neutral-fill-subtle); border-radius: 4px; animation: pulse 1.5s ease-in-out infinite;">
                          </div>
                        </div>
                      </div>
                      <div class="wa-stack wa-gap-3xs wa-align-items-end">
                        <div style="width: 60px; height: 16px; background: var(--wa-color-neutral-fill-subtle); border-radius: 4px; animation: pulse 1.5s ease-in-out infinite;">
                        </div>
                        <div style="width: 80px; height: 14px; background: var(--wa-color-neutral-fill-subtle); border-radius: 4px; animation: pulse 1.5s ease-in-out infinite;">
                        </div>
                      </div>
                    </div>
                  </div>
                </wa-card>
              ))}
            </div>
          )
          : (
            <div class="wa-stack wa-gap-s" style="max-width: 900px">
              {runningBuilds.map((build) => (
                <wa-card key={`${build.name}-${build.number || "unknown"}`}>
                  <div style="padding: var(--wa-space-m); border-left: 4px solid var(--wa-color-warning-fill-loud)">
                    <div class="wa-flank wa-gap-m">
                      <div class="wa-stack wa-gap-3xs">
                        <div class="wa-flank wa-gap-s">
                          <h3 class="wa-heading-s">
                            <a
                              href={build.url}
                              target="_blank"
                              rel="noopener"
                              style="text-decoration: none; color: inherit"
                              class="wa-cluster wa-gap-xs"
                            >
                              {build.name}
                              <wa-icon
                                name="arrow-up-right-from-square"
                                style="font-size: 0.75em; color: var(--wa-color-text-quiet)"
                              >
                              </wa-icon>
                            </a>
                          </h3>
                          <wa-badge variant="warning">
                            <wa-icon slot="prefix" name="spinner"></wa-icon>
                            Running
                          </wa-badge>
                        </div>

                        <div class="wa-cluster wa-gap-s">
                          {build.number && (
                            <span class="wa-caption-s wa-color-text-quiet">
                              Build #{build.number}
                            </span>
                          )}
                          <span class="wa-caption-s wa-color-text-quiet">
                            {build.repo}
                          </span>
                          <span class="wa-caption-s wa-color-text-quiet">
                            Started {formatTimeAgo(build.lastRun)}
                          </span>
                        </div>
                      </div>

                      <div class="wa-stack wa-gap-3xs wa-align-items-end">
                        <div class="wa-body-s">
                          {formatDuration(build.duration)}
                        </div>
                        <div class="wa-caption-s wa-color-text-quiet">
                          {getOrgFromRepo(build.repo)}
                        </div>
                      </div>
                    </div>

                    {/* Progress indicator */}
                    <div style="margin-top: var(--wa-space-s)">
                      <div style="width: 100%; height: 4px; background: var(--wa-color-neutral-fill-subtle); border-radius: 2px; overflow: hidden">
                        <div style="width: 100%; height: 100%; background: linear-gradient(90deg, var(--wa-color-warning-fill-loud) 0%, var(--wa-color-warning-fill-loud) 50%, transparent 50%); background-size: 20px 100%; animation: progress 2s linear infinite">
                        </div>
                      </div>
                    </div>
                  </div>
                </wa-card>
              ))}
            </div>
          )}
      </div>

      <style>
        {`
        @keyframes progress {
          0% { background-position: 0 0; }
          100% { background-position: 20px 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}
      </style>
    </Layout>
  )
}
