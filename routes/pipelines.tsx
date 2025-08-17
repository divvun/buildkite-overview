import { Context, page } from "fresh"
import Layout from "~/components/Layout.tsx"
import PipelineFilters from "~/islands/PipelineFilters.tsx"
import PipelinesContent from "~/islands/PipelinesContent.tsx"
import { type AppPipeline, fetchAllPipelines } from "~/utils/buildkite-data.ts"
import { type AppState, filterPipelinesForUser } from "~/utils/middleware.ts"
import { type SessionData } from "~/utils/session.ts"

interface PipelinesProps {
  session?: SessionData | null
  pipelines: AppPipeline[]
  statusFilter?: string
  searchQuery?: string
  runningPipelines?: number
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

      // Count running pipelines for auto-refresh optimization
      const runningCount = visiblePipelines.filter((p) => p.status === "running").length

      console.log(
        `Returning ${visiblePipelines.length} visible pipelines (filtered by status: ${
          statusFilter || "none"
        }, search: ${searchQuery || "none"}), ${runningCount} running`,
      )

      // Set the page title
      ctx.state.title = ctx.state.t("pipelines-title")

      return page(
        {
          session: ctx.state.session,
          pipelines: visiblePipelines,
          statusFilter,
          searchQuery,
          runningPipelines: runningCount,
        } satisfies PipelinesProps,
      )
    } catch (error) {
      console.error("Error fetching pipelines:", error)

      // Set the page title
      ctx.state.title = ctx.state.t("pipelines-title")

      return page(
        {
          session: ctx.state.session,
          pipelines: [],
          statusFilter: "",
          searchQuery: "",
          runningPipelines: 0,
          error: ctx.state.t("pipeline-load-error"),
        } satisfies PipelinesProps,
      )
    }
  },
}

export default function Pipelines(props: { data: PipelinesProps; state: AppState }) {
  const { session, pipelines = [], statusFilter = "", searchQuery = "", runningPipelines = 0, error } = props.data

  const breadcrumbs = [
    { label: props.state.t("pipelines-breadcrumb") },
  ]

  return (
    <Layout
      title={props.state.t("pipelines-title")}
      currentPath="/pipelines"
      session={session}
      breadcrumbs={breadcrumbs}
      t={props.state.t}
      state={props.state}
    >
      <div class="wa-stack wa-gap-l" style="padding: var(--wa-space-l) 0">
        <header>
          <h1 class="wa-heading-l">{props.state.t("pipelines-title")}</h1>
          <p class="wa-body-m wa-color-text-quiet">
            {props.state.t("pipelines-description")}
          </p>
        </header>

        <PipelineFilters
          initialSearch={searchQuery}
          initialStatus={statusFilter}
        />

        <PipelinesContent
          statusFilter={statusFilter}
          searchQuery={searchQuery}
        />
      </div>
    </Layout>
  )
}
