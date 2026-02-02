import { Context } from "fresh"
import type { AppState } from "~/server/middleware.ts"
import { requireAdminFeatures } from "~/server/middleware.ts"
import {
  type BuildkiteBuildRest,
  CANCEL_BUILD_MUTATION,
  fetchScheduledBuilds,
  getBuildkiteClient,
} from "~/server/buildkite-client.ts"

interface QueuedBuildsResponse {
  builds: BuildkiteBuildRest[]
  error?: string
}

interface CancelResult {
  buildId: string
  buildNumber: number
  pipelineName: string
  pipelineSlug: string
  success: boolean
  error?: string
}

interface CancelAllResponse {
  totalQueued: number
  cancelled: number
  failed: number
  results: CancelResult[]
  error?: string
}

export const handler = [
  requireAdminFeatures,
  {
    async GET(_ctx: Context<AppState>): Promise<Response> {
      try {
        console.log("[cancel-queued-builds] GET: Fetching queued builds for preview...")

        const builds = await fetchScheduledBuilds()

        console.log(`[cancel-queued-builds] GET: Found ${builds.length} queued builds`)

        const response: QueuedBuildsResponse = {
          builds,
        }

        return new Response(JSON.stringify(response), {
          headers: { "Content-Type": "application/json" },
        })
      } catch (error) {
        console.error("[cancel-queued-builds] GET: Error fetching queued builds:")
        console.error("[cancel-queued-builds] GET: Error type:", error?.constructor?.name)
        console.error("[cancel-queued-builds] GET: Error message:", error instanceof Error ? error.message : String(error))
        console.error("[cancel-queued-builds] GET: Error stack:", error instanceof Error ? error.stack : "N/A")

        if (error instanceof Response) {
          return error
        }

        const errorResponse: QueuedBuildsResponse = {
          builds: [],
          error: `Unable to load queued builds: ${error instanceof Error ? error.message : String(error)}`,
        }

        return new Response(JSON.stringify(errorResponse), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        })
      }
    },

    async POST(_ctx: Context<AppState>): Promise<Response> {
      try {
        console.log("API: Cancelling all queued builds...")

        const builds = await fetchScheduledBuilds()

        console.log(`API: Found ${builds.length} queued builds to cancel`)

        if (builds.length === 0) {
          const response: CancelAllResponse = {
            totalQueued: 0,
            cancelled: 0,
            failed: 0,
            results: [],
          }

          return new Response(JSON.stringify(response), {
            headers: { "Content-Type": "application/json" },
          })
        }

        const client = getBuildkiteClient()
        const results: CancelResult[] = []

        for (const build of builds) {
          try {
            const result = await client.mutation(CANCEL_BUILD_MUTATION, {
              input: { id: build.id },
            })

            if (result.error) {
              console.error(`Failed to cancel build ${build.number}:`, result.error)
              results.push({
                buildId: build.id,
                buildNumber: build.number,
                pipelineName: build.pipeline.name,
                pipelineSlug: build.pipeline.slug,
                success: false,
                error: result.error.message || "Unknown error",
              })
            } else {
              console.log(`Cancelled build ${build.pipeline.name} #${build.number}`)
              results.push({
                buildId: build.id,
                buildNumber: build.number,
                pipelineName: build.pipeline.name,
                pipelineSlug: build.pipeline.slug,
                success: true,
              })
            }
          } catch (err) {
            console.error(`Error cancelling build ${build.number}:`, err)
            results.push({
              buildId: build.id,
              buildNumber: build.number,
              pipelineName: build.pipeline.name,
              pipelineSlug: build.pipeline.slug,
              success: false,
              error: err instanceof Error ? err.message : "Unknown error",
            })
          }
        }

        const cancelled = results.filter((r) => r.success).length
        const failed = results.filter((r) => !r.success).length

        console.log(`API: Cancelled ${cancelled} builds, ${failed} failed`)

        const response: CancelAllResponse = {
          totalQueued: builds.length,
          cancelled,
          failed,
          results,
        }

        return new Response(JSON.stringify(response), {
          headers: { "Content-Type": "application/json" },
        })
      } catch (error) {
        console.error("API Error cancelling queued builds:", error)

        if (error instanceof Response) {
          return error
        }

        const errorResponse: CancelAllResponse = {
          totalQueued: 0,
          cancelled: 0,
          failed: 0,
          results: [],
          error: "Unable to cancel queued builds. Please check your configuration and try again.",
        }

        return new Response(JSON.stringify(errorResponse), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        })
      }
    },
  },
]
