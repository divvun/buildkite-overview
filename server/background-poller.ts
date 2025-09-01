import { getCacheManager } from "./cache/cache-manager.ts"
import { getPollingConfig } from "./config.ts"

export interface PollingConfig {
  pipelineIntervalMs: number
  agentIntervalMs: number
  enabled: boolean
}

export class BackgroundPoller {
  private pipelineIntervalId?: number
  private agentIntervalId?: number
  private config: PollingConfig
  private isRunning = false

  constructor(config: PollingConfig = {
    pipelineIntervalMs: 30 * 60 * 1000, // 30 minutes (webhooks handle real-time updates)
    agentIntervalMs: 45 * 60 * 1000, // 45 minutes (webhooks handle real-time updates)
    enabled: true,
  }) {
    // Safeguard against invalid intervals that could break everything
    const MIN_INTERVAL_MS = 30 * 1000 // Minimum 30 seconds
    const DEFAULT_PIPELINE_INTERVAL_MS = 2 * 60 * 1000 // 2 minutes
    const DEFAULT_AGENT_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

    this.config = {
      enabled: config.enabled,
      pipelineIntervalMs: config.pipelineIntervalMs > 0
        ? Math.max(config.pipelineIntervalMs, MIN_INTERVAL_MS)
        : DEFAULT_PIPELINE_INTERVAL_MS,
      agentIntervalMs: config.agentIntervalMs > 0
        ? Math.max(config.agentIntervalMs, MIN_INTERVAL_MS)
        : DEFAULT_AGENT_INTERVAL_MS,
    }
  }

  start(): void {
    if (!this.config.enabled || this.isRunning) {
      return
    }

    this.isRunning = true
    console.log("🔄 Starting background polling service...")
    console.log(`  - Pipeline data refresh: every ${this.config.pipelineIntervalMs / 1000}s`)
    console.log(`  - Agent data refresh: every ${this.config.agentIntervalMs / 1000}s`)

    // Start pipeline data polling
    this.pipelineIntervalId = setInterval(async () => {
      try {
        console.log("🔄 Background poll: Refreshing pipeline data...")
        const startTime = Date.now()
        await getCacheManager().getPipelines()
        const duration = Date.now() - startTime
        console.log(`✅ Pipeline data refreshed in ${duration}ms`)
      } catch (error) {
        console.error("❌ Error refreshing pipeline data in background:", error)

        // Check if this is a rate limit error
        if (error && typeof error === "object" && "graphQLErrors" in error) {
          const graphQLErrors = (error as any).graphQLErrors || []
          const rateLimitError = graphQLErrors.find((e: any) =>
            e.message?.includes("exceeded the limit") || e.message?.includes("rate limit")
          )

          if (rateLimitError) {
            const retryMatch = rateLimitError.message?.match(/try again in (\d+) seconds/)
            const retryAfter = retryMatch ? parseInt(retryMatch[1]) : 600 // Default to 10 minutes
            console.log(`🚦 Background polling hit rate limit, backing off for ${retryAfter} seconds`)
          }
        }
      }
    }, this.config.pipelineIntervalMs)

    // Start agent data polling
    this.agentIntervalId = setInterval(async () => {
      try {
        console.log("🔄 Background poll: Refreshing agent data...")
        const startTime = Date.now()
        await getCacheManager().getAgents()
        const duration = Date.now() - startTime
        console.log(`✅ Agent data refreshed in ${duration}ms`)
      } catch (error) {
        console.error("❌ Error refreshing agent data in background:", error)

        // Check if this is a rate limit error
        if (error && typeof error === "object" && "graphQLErrors" in error) {
          const graphQLErrors = (error as any).graphQLErrors || []
          const rateLimitError = graphQLErrors.find((e: any) =>
            e.message?.includes("exceeded the limit") || e.message?.includes("rate limit")
          )

          if (rateLimitError) {
            const retryMatch = rateLimitError.message?.match(/try again in (\d+) seconds/)
            const retryAfter = retryMatch ? parseInt(retryMatch[1]) : 600 // Default to 10 minutes
            console.log(`🚦 Background polling hit rate limit, backing off for ${retryAfter} seconds`)
          }
        }
      }
    }, this.config.agentIntervalMs)

    // Perform initial refresh after a short delay
    setTimeout(async () => {
      try {
        console.log("🔄 Performing initial background data refresh...")
        await Promise.all([
          getCacheManager().getPipelines(),
          getCacheManager().getAgents(),
        ])
        console.log("✅ Initial background data refresh completed")
      } catch (error) {
        console.error("❌ Error in initial background refresh:", error)
      }
    }, 5000) // 5 second delay to let the app start up
  }

  stop(): void {
    if (!this.isRunning) {
      return
    }

    console.log("🛑 Stopping background polling service...")

    if (this.pipelineIntervalId) {
      clearInterval(this.pipelineIntervalId)
      this.pipelineIntervalId = undefined
    }

    if (this.agentIntervalId) {
      clearInterval(this.agentIntervalId)
      this.agentIntervalId = undefined
    }

    this.isRunning = false
    console.log("✅ Background polling service stopped")
  }

  updateConfig(newConfig: Partial<PollingConfig>): void {
    const wasRunning = this.isRunning

    if (wasRunning) {
      this.stop()
    }

    this.config = { ...this.config, ...newConfig }

    if (wasRunning && this.config.enabled) {
      this.start()
    }
  }

  getStatus(): { isRunning: boolean; config: PollingConfig } {
    return {
      isRunning: this.isRunning,
      config: { ...this.config },
    }
  }

  // Method to trigger manual refresh (useful for webhooks later)
  async refreshNow(): Promise<void> {
    console.log("🔄 Manual refresh triggered...")
    const startTime = Date.now()

    try {
      await Promise.all([
        getCacheManager().getPipelines(),
        getCacheManager().getAgents(),
      ])
      const duration = Date.now() - startTime
      console.log(`✅ Manual refresh completed in ${duration}ms`)
    } catch (error) {
      console.error("❌ Error in manual refresh:", error)
      throw error
    }
  }
}

// Singleton instance
let backgroundPollerInstance: BackgroundPoller | null = null

export function getBackgroundPoller(): BackgroundPoller {
  if (!backgroundPollerInstance) {
    // Get config from centralized config system
    const config = getPollingConfig()

    backgroundPollerInstance = new BackgroundPoller(config)
  }
  return backgroundPollerInstance
}

// Clean shutdown handler for Deno
if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("unload", () => {
    backgroundPollerInstance?.stop()
  })
}
