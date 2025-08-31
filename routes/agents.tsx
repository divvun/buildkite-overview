/// <reference path="../types/webawesome.d.ts" />
import { Context, page } from "fresh"
import Layout from "~/components/Layout.tsx"
import AgentsContent from "~/islands/AgentsContent.tsx"
import { type AppAgent, fetchAllAgents } from "~/utils/buildkite-data.ts"
import { type AppState } from "~/utils/middleware.ts"
import { requireMember, type SessionData } from "~/utils/session.ts"

interface AgentsProps {
  session: SessionData
  agents: AppAgent[]
  orgFilter?: string
  error?: string
}

export const handler = {
  async GET(ctx: Context<AppState>) {
    try {
      // Require authentication and member role (can view queues and agents)
      const session = await requireMember(ctx.req)
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

        // Set the page title
        ctx.state.title = ctx.state.t("agents-title")

        return page(
          {
            session,
            agents: filteredAgents,
            orgFilter,
          } satisfies AgentsProps,
        )
      } catch (error) {
        console.error("Error fetching agents data:", error)

        // Set the page title
        ctx.state.title = ctx.state.t("agents-title")

        return page(
          {
            session,
            agents: [],
            orgFilter,
            error: ctx.state.t("agents-load-failed"),
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
    { label: props.state.t("agents-breadcrumb") },
  ]

  return (
    <Layout
      title={props.state.t("agents-title")}
      currentPath="/agents"
      session={session}
      breadcrumbs={breadcrumbs}
      t={props.state.t}
      state={props.state}
    >
      <div class="wa-stack wa-gap-l" style="padding: var(--wa-space-l) 0">
        <header>
          <h1 class="wa-heading-l">{props.state.t("agents-title")}</h1>
          <p class="wa-body-m wa-color-text-quiet">
            {props.state.t("agents-description")}
          </p>
        </header>

        <AgentsContent
          orgFilter={orgFilter}
        />
      </div>
    </Layout>
  )
}
