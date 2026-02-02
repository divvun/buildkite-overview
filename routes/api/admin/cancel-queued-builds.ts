import { Context } from "fresh"
import type { AppState } from "~/server/middleware.ts"
import {
  type BuildkiteBuildRest,
  CANCEL_BUILD_MUTATION,
  fetchRunningBuildsRest,
  fetchScheduledBuilds,
  getBuildkiteClient,
  restIdToGraphqlId,
} from "~/server/buildkite-client.ts"
import { userHasPermission } from "~/server/session.ts"

const LONG_RUNNING_THRESHOLD_HOURS = 3

interface QueuedBuildsResponse {
  builds: BuildkiteBuildRest[]
  longRunningBuilds: BuildkiteBuildRest[]
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
        longRunningBuilds: [],
        error: "Insufficient permissions to view queued builds",
      }

      return new Response(JSON.stringify(errorResponse), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })
    }

    try {
      console.log("[/api/admin/cancel-queued-builds] GET: Fetching queued and long-running builds...")

      // Fetch scheduled builds and running builds in parallel
      const [scheduledBuilds, runningBuilds] = await Promise.all([
        fetchScheduledBuilds(),
        fetchRunningBuildsRest(),
      ])

      // Filter running builds to only include long-running ones (> threshold hours)
      const thresholdMs = LONG_RUNNING_THRESHOLD_HOURS * 60 * 60 * 1000
      const now = Date.now()
      const longRunningBuilds = runningBuilds.filter((build) => {
        const startTime = build.started_at || build.created_at
        if (!startTime) return false
        const runningMs = now - new Date(startTime).getTime()
        return runningMs > thresholdMs
      })

      console.log(
        `[/api/admin/cancel-queued-builds] GET: Found ${scheduledBuilds.length} queued, ${longRunningBuilds.length} long-running builds`,
      )

      const response: QueuedBuildsResponse = {
        builds: scheduledBuilds,
        longRunningBuilds,
      }

      return new Response(JSON.stringify(response), {
        headers: { "Content-Type": "application/json" },
      })
    } catch (error) {
      console.error("[/api/admin/cancel-queued-builds] GET: Error fetching builds:")
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
        longRunningBuilds: [],
        error: `Unable to load builds: ${error instanceof Error ? error.message : String(error)}`,
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
      // Parse request body to get target
      let target: "queued" | "long-running" | "all" = "all"
      try {
        const body = await ctx.req.json()
        if (body.target && ["queued", "long-running", "all"].includes(body.target)) {
          target = body.target
        }
      } catch {
        // No body or invalid JSON - default to "all"
      }

      console.log(`[/api/admin/cancel-queued-builds] POST: Cancelling builds (target: ${target})...`)

      // Fetch builds based on target
      const [scheduledBuilds, runningBuilds] = await Promise.all([
        fetchScheduledBuilds(),
        fetchRunningBuildsRest(),
      ])

      // Filter running builds to only include long-running ones
      const thresholdMs = LONG_RUNNING_THRESHOLD_HOURS * 60 * 60 * 1000
      const now = Date.now()
      const longRunningBuilds = runningBuilds.filter((build) => {
        const startTime = build.started_at || build.created_at
        if (!startTime) return false
        const runningMs = now - new Date(startTime).getTime()
        return runningMs > thresholdMs
      })

      // Determine which builds to cancel
      let buildsToCancel: BuildkiteBuildRest[] = []
      if (target === "queued") {
        buildsToCancel = scheduledBuilds
      } else if (target === "long-running") {
        buildsToCancel = longRunningBuilds
      } else {
        buildsToCancel = [...scheduledBuilds, ...longRunningBuilds]
      }

      console.log(
        `[/api/admin/cancel-queued-builds] POST: Found ${buildsToCancel.length} builds to cancel (${scheduledBuilds.length} queued, ${longRunningBuilds.length} long-running)`,
      )

      if (buildsToCancel.length === 0) {
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

      for (const build of buildsToCancel) {
        try {
          // Convert REST API UUID to GraphQL node ID
          const graphqlId = restIdToGraphqlId(build.id, "Build")
          console.log(`[/api/admin/cancel-queued-builds] POST: Converting ID ${build.id} -> ${graphqlId}`)

          const result = await client.mutation(CANCEL_BUILD_MUTATION, {
            input: { id: graphqlId },
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
        totalQueued: buildsToCancel.length,
        cancelled,
        failed,
        results,
      }

      return new Response(JSON.stringify(response), {
        headers: { "Content-Type": "application/json" },
      })
    } catch (error) {
      console.error("[/api/admin/cancel-queued-builds] POST: Error cancelling builds:")
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
