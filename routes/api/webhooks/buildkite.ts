import { Context, RouteHandler } from "fresh"
import { getCacheManager } from "~/server/cache/cache-manager.ts"
import { type AppState } from "~/server/middleware.ts"
import { getBuildkiteWebhookToken } from "~/server/config.ts"

interface BuildkiteWebhookEvent {
  event: string
  build?: {
    id: string
    number: number
    state: string
    pipeline?: {
      slug: string
      name: string
    }
    creator?: {
      name: string
    }
    started_at?: string
    finished_at?: string
    commit?: string
    branch?: string
    message?: string
  }
  job?: {
    id: string
    state: string
    name?: string
    type: string
    started_at?: string
    finished_at?: string
    build?: {
      number: number
      pipeline?: {
        slug: string
        name: string
      }
    }
  }
  agent?: {
    id: string
    name: string
    hostname: string
    connection_state: string
    connected_at?: string
    disconnected_at?: string
  }
  pipeline?: {
    id: string
    slug: string
    name: string
  }
  sender?: {
    name: string
  }
}

export const handler: RouteHandler<unknown, AppState> = {
  async POST(ctx: Context<AppState>) {
    try {
      // Get the webhook token from config
      const expectedToken = getBuildkiteWebhookToken()
      if (!expectedToken) {
        console.warn("⚠️ BUILDKITE_WEBHOOK_TOKEN not configured, webhook authentication disabled")
      }

      // Verify webhook token if configured
      if (expectedToken) {
        const receivedToken = ctx.req.headers.get("X-Buildkite-Token")
        if (receivedToken !== expectedToken) {
          console.error("❌ Invalid webhook token received")
          return new Response("Unauthorized", { status: 401 })
        }
      }

      // Parse the webhook payload
      const payload: BuildkiteWebhookEvent = await ctx.req.json()
      console.log(`📥 Received Buildkite webhook: ${payload.event}`)

      // Get cache manager instance
      const cacheManager = getCacheManager()

      // Handle different event types
      switch (payload.event) {
        case "build.scheduled":
          if (payload.build) {
            const pipelineSlug = payload.build.pipeline?.slug || payload.pipeline?.slug
            console.log(`📅 Build scheduled: ${pipelineSlug}#${payload.build.number}`)
            await handleBuildScheduled(cacheManager, payload.build, pipelineSlug)
          }
          break

        case "build.started":
          if (payload.build) {
            const pipelineSlug = payload.build.pipeline?.slug || payload.pipeline?.slug
            console.log(`🚀 Build started: ${pipelineSlug}#${payload.build.number}`)
            await handleBuildStarted(cacheManager, payload.build, pipelineSlug)
          }
          break

        case "build.running":
          if (payload.build) {
            const pipelineSlug = payload.build.pipeline?.slug || payload.pipeline?.slug
            console.log(`🏃 Build running: ${pipelineSlug}#${payload.build.number}`)
            await handleBuildRunning(cacheManager, payload.build, pipelineSlug)
          }
          break

        case "build.finished":
          if (payload.build) {
            const pipelineSlug = payload.build.pipeline?.slug || payload.pipeline?.slug
            console.log(`✅ Build finished: ${pipelineSlug}#${payload.build.number} - ${payload.build.state}`)
            await handleBuildFinished(cacheManager, payload.build, pipelineSlug)
          }
          break

        case "job.scheduled":
          if (payload.job) {
            const pipelineSlug = payload.pipeline?.slug
            const buildNumber = payload.build?.number
            console.log(`📅 Job scheduled: ${payload.job.name || payload.job.id} in pipeline ${pipelineSlug}`)
            await handleJobScheduled(cacheManager, payload.job, pipelineSlug, buildNumber)
          }
          break

        case "job.started":
          if (payload.job) {
            const pipelineSlug = payload.pipeline?.slug
            const buildNumber = payload.build?.number
            console.log(`🔧 Job started: ${payload.job.name || payload.job.id} in pipeline ${pipelineSlug}`)
            await handleJobStarted(cacheManager, payload.job, pipelineSlug, buildNumber)
          }
          break

        case "job.finished":
          if (payload.job) {
            const pipelineSlug = payload.pipeline?.slug
            const buildNumber = payload.build?.number
            console.log(`🏁 Job finished: ${payload.job.name || payload.job.id} - ${payload.job.state}`)
            await handleJobFinished(cacheManager, payload.job, pipelineSlug, buildNumber)
          }
          break

        case "agent.connected":
          if (payload.agent) {
            console.log(`🔌 Agent connected: ${payload.agent.name}`)
            await handleAgentConnected(cacheManager, payload.agent)
          }
          break

        case "agent.disconnected":
          if (payload.agent) {
            console.log(`🔌 Agent disconnected: ${payload.agent.name}`)
            await handleAgentDisconnected(cacheManager, payload.agent)
          }
          break

        case "ping":
          console.log("🏓 Webhook ping received")
          break

        default:
          console.log(`📋 Unhandled webhook event: ${payload.event}`)
      }

      return new Response("OK", { status: 200 })
    } catch (error) {
      console.error("❌ Error processing webhook:", error)
      return new Response("Internal Server Error", { status: 500 })
    }
  },
}

// Event handlers
async function handleBuildScheduled(cacheManager: any, build: any, pipelineSlug?: string) {
  if (!pipelineSlug) {
    console.warn("No pipeline slug available for build.scheduled event")
    return
  }
  try {
    await cacheManager.cacheBuild(pipelineSlug, build.number, build)
  } catch (error) {
    console.error("Error caching build:", error)
  }
}

async function handleBuildStarted(cacheManager: any, build: any, pipelineSlug?: string) {
  if (!pipelineSlug) {
    console.warn("No pipeline slug available for build.started event")
    return
  }
  try {
    await cacheManager.cacheBuild(pipelineSlug, build.number, build)
  } catch (error) {
    console.error("Error caching build:", error)
  }
}

async function handleBuildRunning(cacheManager: any, build: any, pipelineSlug?: string) {
  if (!pipelineSlug) {
    console.warn("No pipeline slug available for build.running event")
    return
  }
  try {
    await cacheManager.cacheBuild(pipelineSlug, build.number, build)
  } catch (error) {
    console.error("Error caching build:", error)
  }
}

async function handleBuildFinished(cacheManager: any, build: any, pipelineSlug?: string) {
  if (!pipelineSlug) {
    console.warn("No pipeline slug available for build.finished event")
    return
  }
  try {
    // Cache the finished build data (will be cached for 24h since it's immutable)
    await cacheManager.cacheBuild(pipelineSlug, build.number, build)
    // Fetch fresh pipeline status + jobs and update SQLite cache
    await cacheManager.refreshSinglePipeline(pipelineSlug)
  } catch (error) {
    console.error("Error handling build finished:", error)
  }
}

async function handleJobScheduled(cacheManager: any, job: any, pipelineSlug?: string, buildNumber?: number) {
  if (!pipelineSlug || !buildNumber) {
    console.warn("No pipeline slug or build number available for job.scheduled event")
    return
  }
  try {
    // Cache the job data
    await cacheManager.cacheJob(pipelineSlug, buildNumber, job.id, job)
    await cacheManager.updateJobStatus(job.id, "scheduled", pipelineSlug, buildNumber)
  } catch (error) {
    console.error("Error updating job status:", error)
  }
}

async function handleJobStarted(cacheManager: any, job: any, pipelineSlug?: string, buildNumber?: number) {
  if (!pipelineSlug || !buildNumber) {
    console.warn("No pipeline slug or build number available for job.started event")
    return
  }
  try {
    // Cache the updated job data
    await cacheManager.cacheJob(pipelineSlug, buildNumber, job.id, job)
    await cacheManager.updateJobStatus(job.id, "started", pipelineSlug, buildNumber)
  } catch (error) {
    console.error("Error updating job status:", error)
  }
}

async function handleJobFinished(cacheManager: any, job: any, pipelineSlug?: string, buildNumber?: number) {
  if (!pipelineSlug || !buildNumber) {
    console.warn("No pipeline slug or build number available for job.finished event")
    return
  }
  try {
    // Cache the finished job data (will be cached for 24h since it's immutable)
    await cacheManager.cacheJob(pipelineSlug, buildNumber, job.id, job)
    await cacheManager.updateJobStatus(job.id, job.state, pipelineSlug, buildNumber)
  } catch (error) {
    console.error("Error updating job status:", error)
  }
}

async function handleAgentConnected(_cacheManager: any, _agent: any) {
  // Agent data is refreshed by the background poller
}

async function handleAgentDisconnected(_cacheManager: any, _agent: any) {
  // Agent data is refreshed by the background poller
}
