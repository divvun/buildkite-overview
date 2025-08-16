import { getCacheManager } from "./cache/cache-manager.ts"

export interface PollingConfig {
  pipelineRefreshIntervalMs: number
  agentRefreshIntervalMs: number
  enabled: boolean
}

export class BackgroundPoller {
  private pipelineIntervalId?: number
  private agentIntervalId?: number
  private config: PollingConfig
  private isRunning = false

  constructor(config: PollingConfig = {
    pipelineRefreshIntervalMs: 30 * 60 * 1000, // 30 minutes (webhooks handle real-time updates)
    agentRefreshIntervalMs: 45 * 60 * 1000, // 45 minutes (webhooks handle real-time updates)
    enabled: true,
  }) {
    this.config = config
  }

  start(): void {
    if (!this.config.enabled || this.isRunning) {
      return
    }

    this.isRunning = true
    console.log("🔄 Starting background polling service...")
    console.log(`  - Pipeline data refresh: every ${this.config.pipelineRefreshIntervalMs / 1000}s`)
    console.log(`  - Agent data refresh: every ${this.config.agentRefreshIntervalMs / 1000}s`)

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
    }, this.config.pipelineRefreshIntervalMs)

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
    }, this.config.agentRefreshIntervalMs)

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
    // Get config from environment variables
    const config: PollingConfig = {
      pipelineRefreshIntervalMs: parseInt(Deno.env.get("PIPELINE_POLL_INTERVAL_MS") || "120000"), // 2 min default
      agentRefreshIntervalMs: parseInt(Deno.env.get("AGENT_POLL_INTERVAL_MS") || "300000"), // 5 min default
      enabled: Deno.env.get("BACKGROUND_POLLING_ENABLED") !== "false", // Enabled by default
    }

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
