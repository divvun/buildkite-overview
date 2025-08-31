/// <reference path="../types/webawesome.d.ts" />
import { Context, page } from "fresh"
import Layout from "~/components/Layout.tsx"
import QueuesContent from "~/islands/QueuesContent.tsx"
import { fetchQueueStatus, type QueueStatus } from "~/utils/buildkite-data.ts"
import { type AppState } from "~/utils/middleware.ts"
import { requireMember, type SessionData } from "~/utils/session.ts"

interface QueuesProps {
  session: SessionData
  queueStatus: QueueStatus[]
  error?: string
}

export const handler = {
  async GET(ctx: Context<AppState>) {
    try {
      // Require authentication and member role (includes access to agents/queues)
      const session = await requireMember(ctx.req)

      try {
        console.log("Fetching queue status data...")

        // Fetch queue status
        const queueStatus = await fetchQueueStatus()

        console.log(`Found ${queueStatus.length} queues`)

        // Set the page title
        ctx.state.title = ctx.state.t("queues-title")

        return page(
          {
            session,
            queueStatus,
          } satisfies QueuesProps,
        )
      } catch (error) {
        console.error("Error fetching queue status:", error)

        // Set the page title
        ctx.state.title = ctx.state.t("queues-title")

        return page(
          {
            session,
            queueStatus: [],
            error: ctx.state.t("queues-load-failed"),
          } satisfies QueuesProps,
        )
      }
    } catch (error) {
      // Handle authentication errors (thrown as Response objects)
      if (error instanceof Response) {
        return error // Return the redirect response
      }
      throw error // Re-throw actual errors
    }
  },
}

export default function Queues(props: { data: QueuesProps; state: AppState }) {
  const { session, queueStatus, error } = props.data

  const breadcrumbs = [
    { label: props.state.t("queues-breadcrumb") },
  ]

  return (
    <Layout
      title={props.state.t("queues-title")}
      currentPath="/queues"
      session={session}
      breadcrumbs={breadcrumbs}
      t={props.state.t}
      state={props.state}
    >
      <div class="wa-stack wa-gap-l" style="padding: var(--wa-space-l) 0">
        <header>
          <h1 class="wa-heading-l">{props.state.t("queues-title")}</h1>
          <p class="wa-body-m wa-color-text-quiet">
            {props.state.t("queues-description")}
          </p>
        </header>

        <QueuesContent />
      </div>
    </Layout>
  )
}
