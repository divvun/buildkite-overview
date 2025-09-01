import { Context } from "fresh"
import { fetchAllAgents } from "~/server/buildkite-data.ts"
import type { AppAgent } from "~/types/app.ts"
import { type AppState } from "~/server/middleware.ts"
import { userHasPermission } from "~/server/session.ts"

interface AgentsResponse {
  agents: AppAgent[]
  orgFilter?: string
  error?: string
}

export const handler = {
  async GET(ctx: Context<AppState>): Promise<Response> {
    // Check if user has permission to manage agents
    if (!userHasPermission(ctx.state.session ?? null, "canManageAgents")) {
      const errorResponse: AgentsResponse = {
        agents: [],
        error: "Insufficient permissions to view agents",
      }

      return new Response(JSON.stringify(errorResponse), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })
    }

    try {
      const url = new URL(ctx.req.url)
      const rawOrgFilter = url.searchParams.get("org")

      // Validate and sanitize org filter - must be alphanumeric with dashes/underscores only
      const orgFilter = rawOrgFilter?.match(/^[a-zA-Z0-9_-]+$/) ? rawOrgFilter : undefined

      try {
        console.log("API: Fetching agents data...")

        const allAgents = await fetchAllAgents()

        // Filter by organization if specified
        let filteredAgents = allAgents
        if (orgFilter) {
          filteredAgents = allAgents.filter((agent) => agent.organization === orgFilter)
        }

        console.log(`API: Found ${filteredAgents.length} agents`)

        const response: AgentsResponse = {
          agents: filteredAgents,
          orgFilter,
        }

        return new Response(JSON.stringify(response), {
          headers: { "Content-Type": "application/json" },
        })
      } catch (error) {
        console.error("API Error fetching agents data:", error)

        const errorResponse: AgentsResponse = {
          agents: [],
          orgFilter,
          error:
            "Unable to load agent information. Ensure your Buildkite API token has agent read permissions and try refreshing the page. If the issue persists, check the browser console for more details.",
        }

        return new Response(JSON.stringify(errorResponse), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        })
      }
    } catch (error) {
      console.error("API Error fetching agents:", error)

      const errorResponse: AgentsResponse = {
        agents: [],
        error: "Failed to fetch agents data",
      }

      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }
  },
}
