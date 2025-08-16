/// <reference path="../types/webawesome.d.ts" />
import { Context, page } from "fresh"
import Layout from "~/components/Layout.tsx"
import AgentsContent from "~/islands/AgentsContent.tsx"
import AutoRefresh from "~/islands/AutoRefresh.tsx"
import { type AppAgent, fetchAllAgents } from "~/utils/buildkite-data.ts"
import { AUTO_REFRESH_INTERVAL_SECONDS } from "~/utils/constants.ts"
import { type AppState } from "~/utils/middleware.ts"
import { requireDivvunOrgAccess, type SessionData } from "~/utils/session.ts"

interface AgentsProps {
  session: SessionData
  agents: AppAgent[]
  orgFilter?: string
  error?: string
}

export const handler = {
  async GET(ctx: Context<AppState>) {
    try {
      // Require authentication and divvun organization membership
      const session = requireDivvunOrgAccess(ctx.req)
      const url = new URL(ctx.req.url)
      const rawOrgFilter = url.searchParams.get("org")

      // Validate and sanitize org filter - must be alphanumeric with dashes/underscores only
      const orgFilter = rawOrgFilter?.match(/^[a-zA-Z0-9_-]+$/) ? rawOrgFilter : undefined

      try {
        console.log("Fetching agents data...")

        const allAgents = await fetchAllAgents()

        // Filter by organization if specified
        let filteredAgents = allAgents
        if (orgFilter) {
          filteredAgents = allAgents.filter((agent) => agent.organization === orgFilter)
        }

        console.log(`Found ${filteredAgents.length} agents`)

        return page(
          {
            session,
            agents: filteredAgents,
            orgFilter,
          } satisfies AgentsProps,
        )
      } catch (error) {
        console.error("Error fetching agents data:", error)

        return page(
          {
            session,
            agents: [],
            orgFilter,
            error:
              "Unable to load agent information. Ensure your Buildkite API token has agent read permissions and try refreshing the page. If the issue persists, check the browser console for more details.",
          } satisfies AgentsProps,
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

export default function Agents(props: { data: AgentsProps; state: AppState }) {
  const { session, agents, orgFilter, error } = props.data

  const breadcrumbs = [
    { label: "Agents" },
  ]

  return (
    <Layout
      title="Buildkite Agents"
      currentPath="/agents"
      session={session}
      breadcrumbs={breadcrumbs}
    >
      <div class="wa-stack wa-gap-l" style="padding: var(--wa-space-l) 0">
        <header>
          <h1 class="wa-heading-l">Buildkite Agents</h1>
          <p class="wa-body-m wa-color-text-quiet">
            View all agents across organizations and their current status
          </p>
        </header>

        <div class="wa-flank">
          <div></div>
          <AutoRefresh enabled intervalSeconds={AUTO_REFRESH_INTERVAL_SECONDS} />
        </div>

        <AgentsContent
          initialData={{
            agents,
            orgFilter,
            error,
          }}
        />
      </div>
    </Layout>
  )
}
