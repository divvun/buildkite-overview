import { Context, page } from "fresh"
import Layout from "~/components/Layout.tsx"
import { type AppState, filterPipelinesForUser } from "~/utils/middleware.ts"
import { type SessionData } from "~/utils/session.ts"
import { type AppPipeline, enrichPipelinesWithGitHubData, fetchAllPipelines } from "~/utils/buildkite-data.ts"
import { getBadgeVariant, getHealthBorderStyle, getOrgFromPipelineSlug, getStatusIcon } from "~/utils/formatters.ts"
import EmptyState from "~/components/EmptyState.tsx"

interface PipelinesProps {
  session?: SessionData | null
  pipelines: AppPipeline[]
  statusFilter?: string
  orgFilter?: string
  searchQuery?: string
  error?: string
}

export const handler = {
  async GET(ctx: Context<AppState>) {
    try {
      console.log("Fetching all pipelines from Buildkite API...")

      // Get filter parameters from URL
      const url = new URL(ctx.req.url)
      const statusFilter = url.searchParams.get("status") || ""
      const orgFilter = url.searchParams.get("org") || ""
      const searchQuery = url.searchParams.get("search") || ""

      // Fetch real pipeline data from Buildkite
      let pipelines = await fetchAllPipelines()

      // Enrich with GitHub repository data if user is authenticated
      if (ctx.state.session) {
        console.log("Enriching pipelines with GitHub data...")
        pipelines = await enrichPipelinesWithGitHubData(pipelines, ctx.state.session)
      }

      // Filter pipelines based on user access
      let visiblePipelines = filterPipelinesForUser(pipelines, ctx.state.session)

      // Apply status filter
      if (statusFilter) {
        visiblePipelines = visiblePipelines.filter((p) => p.status === statusFilter)
      }

      // Apply organization filter
      if (orgFilter) {
        visiblePipelines = visiblePipelines.filter((p) => {
          const orgFromSlug = getOrgFromPipelineSlug(p.slug)
          return orgFromSlug === orgFilter
        })
      }

      // Apply search filter
      if (searchQuery) {
        visiblePipelines = visiblePipelines.filter((p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.repo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
        )
      }

      console.log(
        `Returning ${visiblePipelines.length} visible pipelines (filtered by status: ${statusFilter || "none"}, org: ${
          orgFilter || "none"
        }, search: ${searchQuery || "none"})`,
      )

      return page(
        {
          session: ctx.state.session,
          pipelines: visiblePipelines,
          statusFilter,
          orgFilter,
          searchQuery,
        } satisfies PipelinesProps,
      )
    } catch (error) {
      console.error("Error fetching pipelines:", error)

      return page(
        {
          session: ctx.state.session,
          pipelines: [],
          statusFilter: "",
          orgFilter: "",
          searchQuery: "",
          error:
            "Unable to load pipelines from Buildkite. This usually indicates an authentication issue. Please verify your BUILDKITE_API_KEY environment variable is set correctly and has the necessary permissions.",
        } satisfies PipelinesProps,
      )
    }
  },
}

export default function Pipelines(props: { data: PipelinesProps }) {
  const { session, pipelines = [], statusFilter = "", orgFilter = "", searchQuery = "", error } = props.data

  const breadcrumbs = [
    { label: "All Pipelines" },
  ]

  return (
    <Layout
      title="All Pipelines"
      currentPath="/pipelines"
      session={session}
      breadcrumbs={breadcrumbs}
    >
      <div class="wa-stack wa-gap-l" style="padding: var(--wa-space-l) 0">
        <header class="wa-flank">
          <div>
            <h1 class="wa-heading-l">All Pipelines</h1>
            <p class="wa-body-m wa-color-text-quiet">
              Manage and monitor all Buildkite pipelines across organizations
            </p>
          </div>
          <div class="wa-cluster wa-gap-s">
            <wa-button
              variant="brand"
              appearance="outlined"
              disabled
              title="Feature coming soon - create pipelines directly from GitHub repos"
            >
              <wa-icon slot="prefix" name="plus"></wa-icon>
              Create Pipeline
            </wa-button>
            <wa-button
              variant="brand"
              disabled
              title="Feature coming soon - sync all pipeline configurations with GitHub"
            >
              <wa-icon slot="prefix" name="arrow-rotate-right"></wa-icon>
              Sync All
            </wa-button>
          </div>
        </header>

        {error && (
          <wa-callout variant="danger">
            <wa-icon slot="icon" name="triangle-exclamation"></wa-icon>
            {error}
          </wa-callout>
        )}

        <div class="wa-cluster wa-gap-m">
          <form
            method="GET"
            style="display: contents"
            onSubmit={(e) => {
              e.preventDefault()
              const formData = new FormData(e.currentTarget)
              const search = formData.get("search") as string
              const url = new URL(window.location.href)
              if (search.trim()) {
                url.searchParams.set("search", search.trim())
              } else {
                url.searchParams.delete("search")
              }
              window.location.href = url.toString()
            }}
          >
            <wa-input
              name="search"
              placeholder="Filter pipelines..."
              style={"min-width: 300px" as any}
              value={searchQuery}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.form?.requestSubmit()
                }
              }}
            >
              <wa-icon slot="prefix" name="magnifying-glass"></wa-icon>
            </wa-input>
          </form>
          <wa-select
            placeholder="Organization"
            value={orgFilter}
            onWa-change={(e: any) => {
              const url = new URL(window.location.href)
              if (e.target.value) {
                url.searchParams.set("org", e.target.value)
              } else {
                url.searchParams.delete("org")
              }
              window.location.href = url.toString()
            }}
          >
            <wa-option value="">All Organizations</wa-option>
            <wa-option value="divvun">divvun</wa-option>
            <wa-option value="giellalt">giellalt</wa-option>
            <wa-option value="necessary-nu">necessary-nu</wa-option>
            <wa-option value="bbqsrc">bbqsrc</wa-option>
          </wa-select>
          <wa-select
            placeholder="Status"
            value={statusFilter}
            onWa-change={(e: any) => {
              const url = new URL(window.location.href)
              if (e.target.value) {
                url.searchParams.set("status", e.target.value)
              } else {
                url.searchParams.delete("status")
              }
              window.location.href = url.toString()
            }}
          >
            <wa-option value="">All Status</wa-option>
            <wa-option value="passed">Passed</wa-option>
            <wa-option value="failed">Failed</wa-option>
            <wa-option value="running">Running</wa-option>
          </wa-select>
        </div>

        <div
          class="wa-gap-m"
          style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--wa-space-m)"
        >
          {pipelines.length === 0 && !error
            ? (
              <EmptyState
                icon="folder-open"
                title="No pipelines found"
                description={searchQuery || statusFilter || orgFilter
                  ? `No pipelines match your current filters. Try adjusting your search or filters.`
                  : `No Buildkite pipelines found. Check your API configuration or create your first pipeline.`}
                variant="neutral"
              >
                {(searchQuery || statusFilter || orgFilter) && (
                  <wa-button appearance="outlined">
                    <a href="/pipelines" style="text-decoration: none; color: inherit">
                      Clear all filters
                    </a>
                  </wa-button>
                )}
              </EmptyState>
            )
            : pipelines.map((pipeline) => (
              <wa-card key={pipeline.id} class="clickable-card" style={getHealthBorderStyle(pipeline.status)}>
                <a
                  href={`/pipelines/${pipeline.slug}`}
                  style="text-decoration: none; color: inherit; display: block"
                >
                  <div class="wa-stack wa-gap-s">
                    <div class="wa-flank">
                      <div class="wa-stack wa-gap-3xs">
                        <div class="wa-flank wa-gap-xs">
                          <wa-icon
                            name={getStatusIcon(pipeline.status)}
                            style={`color: var(--wa-color-${getBadgeVariant(pipeline.status)}-fill-loud)` as any}
                          >
                          </wa-icon>
                          <span class="wa-heading-s">{pipeline.name}</span>
                        </div>
                        <div class="wa-caption-s wa-color-text-quiet">{pipeline.repo || "No repository"}</div>
                      </div>
                      <wa-badge variant={getBadgeVariant(pipeline.status)}>
                        {pipeline.status}
                      </wa-badge>
                    </div>

                    <div class="wa-cluster wa-gap-xs" style="flex-wrap: wrap">
                      {pipeline.tags.map((tag) => <wa-tag key={tag}>{tag}</wa-tag>)}
                    </div>

                    <wa-divider></wa-divider>

                    <div class="wa-flank">
                      <div class="wa-stack wa-gap-3xs">
                        <div class="wa-caption-s">Build Stats</div>
                        <div class="wa-cluster wa-gap-s">
                          <span class="wa-caption-xs">
                            <wa-badge variant="success">{pipeline.builds.passed}</wa-badge> passed
                          </span>
                          <span class="wa-caption-xs">
                            <wa-badge variant="danger">{pipeline.builds.failed}</wa-badge> failed
                          </span>
                        </div>
                      </div>
                      <div class="wa-stack wa-gap-3xs wa-align-items-end">
                        <div class="wa-caption-s">Last Build</div>
                        <div class="wa-caption-xs wa-color-text-quiet">{pipeline.lastBuild}</div>
                      </div>
                    </div>
                  </div>
                </a>
              </wa-card>
            ))}
        </div>
      </div>
    </Layout>
  )
}
