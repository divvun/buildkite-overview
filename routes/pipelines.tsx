import { Context, page } from "fresh"
import EmptyState from "~/components/EmptyState.tsx"
import Layout from "~/components/Layout.tsx"
import PipelineFilters from "~/islands/PipelineFilters.tsx"
import { type AppPipeline, fetchAllPipelines } from "~/utils/buildkite-data.ts"
import { getBadgeVariant, getHealthBorderStyle, getStatusIcon } from "~/utils/formatters.ts"
import { type AppState, filterPipelinesForUser } from "~/utils/middleware.ts"
import { type SessionData } from "~/utils/session.ts"

interface PipelinesProps {
  session?: SessionData | null
  pipelines: AppPipeline[]
  statusFilter?: string
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
      const searchQuery = url.searchParams.get("search") || ""

      // Fetch real pipeline data from Buildkite (already enriched with GitHub data)
      const pipelines = await fetchAllPipelines()

      // Filter pipelines based on user access
      let visiblePipelines = filterPipelinesForUser(pipelines, ctx.state.session)

      // Apply status filter
      if (statusFilter) {
        visiblePipelines = visiblePipelines.filter((p) => p.status === statusFilter)
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
        `Returning ${visiblePipelines.length} visible pipelines (filtered by status: ${
          statusFilter || "none"
        }, search: ${searchQuery || "none"})`,
      )

      return page(
        {
          session: ctx.state.session,
          pipelines: visiblePipelines,
          statusFilter,
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
          searchQuery: "",
          error:
            "Unable to load pipelines from Buildkite. This usually indicates an authentication issue. Please verify your BUILDKITE_API_KEY environment variable is set correctly and has the necessary permissions.",
        } satisfies PipelinesProps,
      )
    }
  },
}

export default function Pipelines(props: { data: PipelinesProps }) {
  const { session, pipelines = [], statusFilter = "", searchQuery = "", error } = props.data

  const breadcrumbs = [
    { label: "Pipelines" },
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
        </header>

        {error && (
          <wa-callout variant="danger">
            <wa-icon slot="icon" name="triangle-exclamation"></wa-icon>
            {error}
          </wa-callout>
        )}

        <PipelineFilters
          initialSearch={searchQuery}
          initialStatus={statusFilter}
        />

        <div
          class="wa-gap-m"
          style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--wa-space-m)"
        >
          {pipelines.length === 0 && !error
            ? (
              <EmptyState
                icon="folder-open"
                title="No pipelines found"
                description={searchQuery || statusFilter
                  ? `No pipelines match your current filters. Try adjusting your search or filters.`
                  : `No Buildkite pipelines found. Check your API configuration or create your first pipeline.`}
                variant="neutral"
              >
                {(searchQuery || statusFilter) && (
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
