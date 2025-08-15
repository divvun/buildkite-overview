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
            window.location.reload()
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
    <div class="wa-flank wa-gap-s">
      <wa-button
        variant={isEnabled ? "success" : "neutral"}
        appearance="outlined"
        size="small"
        onClick={() => setIsEnabled(!isEnabled)}
      >
        <wa-icon
          slot="prefix"
          name={isEnabled ? "pause" : "play"}
        />
        Auto-refresh {isEnabled ? "ON" : "OFF"}
      </wa-button>

      {isEnabled && (
        <div class="wa-caption-s wa-color-text-quiet">
          Refreshing in {countdown}s
        </div>
      )}
    </div>
  )
}
