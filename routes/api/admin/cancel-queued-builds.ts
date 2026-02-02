import { Context } from "fresh"
import type { AppState } from "~/server/middleware.ts"
import {
  type BuildkiteBuildRest,
  CANCEL_BUILD_MUTATION,
  fetchScheduledBuilds,
  getBuildkiteClient,
} from "~/server/buildkite-client.ts"
import { userHasPermission } from "~/server/session.ts"

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

export const handler = {
  async GET(ctx: Context<AppState>): Promise<Response> {
    // Check if user has admin features permission
    if (!userHasPermission(ctx.state.session ?? null, "canAccessAdminFeatures")) {
      const errorResponse: QueuedBuildsResponse = {
        builds: [],
        error: "Insufficient permissions to view queued builds",
      }

      return new Response(JSON.stringify(errorResponse), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })
    }

    try {
      console.log("[/api/admin/cancel-queued-builds] GET: Fetching queued builds for preview...")

      const builds = await fetchScheduledBuilds()

      console.log(`[/api/admin/cancel-queued-builds] GET: Found ${builds.length} queued builds`)

      const response: QueuedBuildsResponse = {
        builds,
      }

      return new Response(JSON.stringify(response), {
        headers: { "Content-Type": "application/json" },
      })
    } catch (error) {
      console.error("[/api/admin/cancel-queued-builds] GET: Error fetching queued builds:")
      console.error("[/api/admin/cancel-queued-builds] GET: Error type:", error?.constructor?.name)
      console.error(
        "[/api/admin/cancel-queued-builds] GET: Error message:",
        error instanceof Error ? error.message : String(error),
      )
      if (error instanceof Error && error.stack) {
        console.error("[/api/admin/cancel-queued-builds] GET: Stack trace:", error.stack)
      }

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

  async POST(ctx: Context<AppState>): Promise<Response> {
    // Check if user has admin features permission
    if (!userHasPermission(ctx.state.session ?? null, "canAccessAdminFeatures")) {
      const errorResponse: CancelAllResponse = {
        totalQueued: 0,
        cancelled: 0,
        failed: 0,
        results: [],
        error: "Insufficient permissions to cancel builds",
      }

      return new Response(JSON.stringify(errorResponse), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })
    }

    try {
      console.log("[/api/admin/cancel-queued-builds] POST: Cancelling all queued builds...")

      const builds = await fetchScheduledBuilds()

      console.log(`[/api/admin/cancel-queued-builds] POST: Found ${builds.length} queued builds to cancel`)

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
            console.error(
              `[/api/admin/cancel-queued-builds] POST: Failed to cancel build ${build.number}:`,
              result.error,
            )
            results.push({
              buildId: build.id,
              buildNumber: build.number,
              pipelineName: build.pipeline.name,
              pipelineSlug: build.pipeline.slug,
              success: false,
              error: result.error.message || "Unknown error",
            })
          } else {
            console.log(
              `[/api/admin/cancel-queued-builds] POST: Cancelled build ${build.pipeline.name} #${build.number}`,
            )
            results.push({
              buildId: build.id,
              buildNumber: build.number,
              pipelineName: build.pipeline.name,
              pipelineSlug: build.pipeline.slug,
              success: true,
            })
          }
        } catch (err) {
          console.error(`[/api/admin/cancel-queued-builds] POST: Error cancelling build ${build.number}:`, err)
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

      console.log(`[/api/admin/cancel-queued-builds] POST: Cancelled ${cancelled} builds, ${failed} failed`)

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
      console.error("[/api/admin/cancel-queued-builds] POST: Error cancelling queued builds:")
      console.error("[/api/admin/cancel-queued-builds] POST: Error type:", error?.constructor?.name)
      console.error(
        "[/api/admin/cancel-queued-builds] POST: Error message:",
        error instanceof Error ? error.message : String(error),
      )
      if (error instanceof Error && error.stack) {
        console.error("[/api/admin/cancel-queued-builds] POST: Stack trace:", error.stack)
      }

      if (error instanceof Response) {
        return error
      }

      const errorResponse: CancelAllResponse = {
        totalQueued: 0,
        cancelled: 0,
        failed: 0,
        results: [],
        error: `Unable to cancel queued builds: ${error instanceof Error ? error.message : String(error)}`,
      }

      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }
  },
}
