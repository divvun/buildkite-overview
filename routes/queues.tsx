/// <reference path="../types/webawesome.d.ts" />
import { Context, page } from "fresh"
import Layout from "~/components/Layout.tsx"
import AutoRefresh from "~/islands/AutoRefresh.tsx"
import QueuesContent from "~/islands/QueuesContent.tsx"
import { fetchQueueStatus, type QueueStatus } from "~/utils/buildkite-data.ts"
import { AUTO_REFRESH_INTERVAL_SECONDS } from "~/utils/constants.ts"
import { type AppState } from "~/utils/middleware.ts"
import { requireDivvunOrgAccess, type SessionData } from "~/utils/session.ts"

interface QueuesProps {
  session: SessionData
  queueStatus: QueueStatus[]
  error?: string
}

export const handler = {
  async GET(ctx: Context<AppState>) {
    try {
      // Require authentication and divvun organization membership
      const session = requireDivvunOrgAccess(ctx.req)

      try {
        console.log("Fetching queue status data...")

        // Fetch queue status
        const queueStatus = await fetchQueueStatus()

        console.log(`Found ${queueStatus.length} queues`)

        return page(
          {
            session,
            queueStatus,
          } satisfies QueuesProps,
        )
      } catch (error) {
        console.error("Error fetching queue status:", error)

        return page(
          {
            session,
            queueStatus: [],
            error:
              "Unable to fetch queue status. This may be a temporary network issue or API rate limiting. Please wait a moment and try again.",
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
    { label: "Queues" },
  ]

  return (
    <Layout
      title="Queue Management"
      currentPath="/queues"
      session={session}
      breadcrumbs={breadcrumbs}
    >
      <div class="wa-stack wa-gap-l" style="padding: var(--wa-space-l) 0">
        <header>
          <h1 class="wa-heading-l">Queue Management</h1>
          <p class="wa-body-m wa-color-text-quiet">
            Monitor build queues, workload distribution, and agent availability
          </p>
        </header>

        <div class="wa-flank">
          <div></div>
          <AutoRefresh enabled intervalSeconds={AUTO_REFRESH_INTERVAL_SECONDS} />
        </div>

        <QueuesContent
          initialData={{
            queueStatus,
            error,
          }}
        />
      </div>
    </Layout>
  )
}
