import { useEffect, useState } from "preact/hooks"

interface AutoRefreshProps {
  enabled?: boolean
  intervalSeconds?: number
}

export default function AutoRefresh({ enabled = false, intervalSeconds = 30 }: AutoRefreshProps) {
  const [isEnabled, setIsEnabled] = useState(enabled)
  const [countdown, setCountdown] = useState(intervalSeconds)

  console.log("AutoRefresh: Component rendered with enabled:", enabled, "isEnabled:", isEnabled, "intervalSeconds:", intervalSeconds)

  useEffect(() => {
    console.log("AutoRefresh: useEffect triggered with isEnabled:", isEnabled, "intervalSeconds:", intervalSeconds)
    let interval: number | undefined

    if (isEnabled) {
      console.log("AutoRefresh: Starting interval timer")
      // Reset countdown when enabled
      setCountdown(intervalSeconds)

      interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            // Dispatch a custom event that islands can listen to
            console.log("AutoRefresh: Dispatching autorefresh event")
            globalThis.dispatchEvent(new CustomEvent("autorefresh"))
            return intervalSeconds
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => {
      console.log("AutoRefresh: Cleanup - clearing interval")
      if (interval) clearInterval(interval)
    }
  }, [isEnabled, intervalSeconds])

  return (
    <div class="wa-stack wa-gap-2xs wa-align-items-end">
      <wa-button
        variant={isEnabled ? "brand" : "neutral"}
        appearance="outlined"
        size="small"
        onClick={() => setIsEnabled(!isEnabled)}
        title={`Auto-refresh ${isEnabled ? "ON" : "OFF"}`}
      >
        {isEnabled
          ? (
            <div class="wa-caption-xs wa-color-text-quiet" style="white-space: nowrap">
              {countdown}s
            </div>
          )
          : <wa-icon name="sync" />}
      </wa-button>
    </div>
  )
}
