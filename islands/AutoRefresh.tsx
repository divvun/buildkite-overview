import { useEffect, useState } from "preact/hooks"

interface AutoRefreshProps {
  enabled?: boolean
  intervalSeconds?: number
}

export default function AutoRefresh({ enabled = false, intervalSeconds = 30 }: AutoRefreshProps) {
  const [isEnabled, setIsEnabled] = useState(enabled)
  const [countdown, setCountdown] = useState(intervalSeconds)

  useEffect(() => {
    let interval: number | undefined

    if (isEnabled) {
      // Reset countdown when enabled
      setCountdown(intervalSeconds)

      interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            // Refresh the page
            globalThis.location.reload()
            return intervalSeconds
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => {
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
        <wa-icon
          name={isEnabled ? "sync" : "sync-disabled"}
        />
      </wa-button>

      {isEnabled && (
        <div class="wa-caption-xs wa-color-text-quiet" style="white-space: nowrap">
          {countdown}s
        </div>
      )}
    </div>
  )
}
