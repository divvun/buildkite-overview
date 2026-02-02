/// <reference path="../../types/webawesome.d.ts" />
import { Context, page } from "fresh"
import Layout from "~/components/Layout.tsx"
import BuildHistory from "~/islands/BuildHistory.tsx"
import CancelQueuedBuilds from "~/islands/CancelQueuedBuilds.tsx"
import { type AppState } from "~/server/middleware.ts"
import { requireAdmin } from "~/server/session.ts"
import type { SessionData } from "~/types/session.ts"
import type { BuildkiteBuildRest } from "~/server/buildkite-client.ts"

interface BuildHistoryProps {
  session: SessionData
  initialBuilds: BuildkiteBuildRest[]
  error?: string
}

export const handler = {
  async GET(ctx: Context<AppState>) {
    try {
      // Require authentication and admin role
      const session = await requireAdmin(ctx.req)

      // Set the page title
      ctx.state.title = "Build History"

      // Return page with empty initial builds - the island will fetch them
      return page(
        {
          session,
          initialBuilds: [],
        } satisfies BuildHistoryProps,
      )
    } catch (error) {
      // Handle authentication errors (thrown as Response objects)
      if (error instanceof Response) {
        return error // Return the redirect response
      }
      throw error // Re-throw actual errors
    }
  },
}

export default function BuildsPage(props: { data: BuildHistoryProps; state: AppState }) {
  const { session, initialBuilds, error } = props.data

  const breadcrumbs = [
    { label: "Admin" },
    { label: "Build History" },
  ]

  return (
    <Layout
      title="Build History"
      currentPath="/admin/builds"
      session={session}
      breadcrumbs={breadcrumbs}
      t={props.state.t}
      state={props.state}
    >
      <div class="wa-stack wa-gap-l" style="padding: var(--wa-space-l) 0">
        <header>
          <h1 class="wa-heading-l">Build History</h1>
          <p class="wa-body-m wa-color-text-quiet">
            View the last 50 completed builds across all pipelines in chronological order (newest first).
          </p>
        </header>

        <CancelQueuedBuilds />

        <BuildHistory initialBuilds={initialBuilds} />
      </div>
    </Layout>
  )
}
