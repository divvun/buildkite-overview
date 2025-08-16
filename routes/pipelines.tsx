import { Context, page } from "fresh"
import Layout from "~/components/Layout.tsx"
import AutoRefresh from "~/islands/AutoRefresh.tsx"
import PipelineFilters from "~/islands/PipelineFilters.tsx"
import PipelinesContent from "~/islands/PipelinesContent.tsx"
import { type AppPipeline, fetchAllPipelines } from "~/utils/buildkite-data.ts"
import { AUTO_REFRESH_INTERVAL_SECONDS } from "~/utils/constants.ts"
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
          <AutoRefresh enabled={!!session} intervalSeconds={AUTO_REFRESH_INTERVAL_SECONDS} />
        </header>

        <PipelineFilters
          initialSearch={searchQuery}
          initialStatus={statusFilter}
        />

        <PipelinesContent
          initialData={{
            pipelines,
            statusFilter,
            searchQuery,
            error,
          }}
        />
      </div>
    </Layout>
  )
}
