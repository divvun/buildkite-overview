import { useEffect, useState } from "preact/hooks"

interface AutoRefreshProps {
  enabled?: boolean
  intervalSeconds?: number
}

export default function AutoRefresh({ enabled = false, intervalSeconds = 5 }: AutoRefreshProps) {
  const [isEnabled, setIsEnabled] = useState(enabled)
  const [countdown, setCountdown] = useState(intervalSeconds)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isTabFocused, setIsTabFocused] = useState(true)

  // Use provided interval when tab is focused, 30 seconds when unfocused
  const effectiveInterval = isTabFocused ? intervalSeconds : 30

  // Track tab visibility/focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabFocused(!document.hidden)
    }

    const handleFocus = () => setIsTabFocused(true)
    const handleBlur = () => setIsTabFocused(false)

    document.addEventListener("visibilitychange", handleVisibilityChange)
    globalThis.addEventListener("focus", handleFocus)
    globalThis.addEventListener("blur", handleBlur)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      globalThis.removeEventListener("focus", handleFocus)
      globalThis.removeEventListener("blur", handleBlur)
    }
  }, [])

  useEffect(() => {
    let interval: number | undefined

    if (isEnabled) {
      // Reset countdown to current interval when starting
      setCountdown(effectiveInterval)

      interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            // Dispatch a custom event that islands can listen to
            setIsRefreshing(true)
            globalThis.dispatchEvent(new CustomEvent("autorefresh"))

            // Clear refresh indicator after 2 seconds
            setTimeout(() => setIsRefreshing(false), 2000)

            return effectiveInterval
          }
          return prev - 1
        })
      }, 1000)
    } else {
      // Reset countdown when disabled
      setCountdown(effectiveInterval)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isEnabled, effectiveInterval])

  const getButtonContent = () => {
    if (!isEnabled) {
      return <wa-icon name="sync" />
    }

    if (isRefreshing) {
      return (
        <div class="wa-cluster wa-gap-3xs wa-align-items-center">
          <wa-icon name="spinner" style="animation: spin 1s linear infinite" />
          <span class="wa-caption-xs">Refreshing...</span>
        </div>
      )
    }

    return (
      <div class="wa-caption-xs" style="white-space: nowrap">
        {!isTabFocused && <span style="color: var(--wa-color-neutral-text-loud); margin-right: 4px">💤</span>}
        {countdown}s
      </div>
    )
  }

  const getButtonTitle = () => {
    if (!isEnabled) return "Enable auto-refresh"
    if (isRefreshing) return "Refreshing data..."
    if (!isTabFocused) return `Auto-refresh ON (background mode: every ${effectiveInterval}s)`
    return `Auto-refresh ON (every ${effectiveInterval}s)`
  }

  return (
    <div class="wa-stack wa-gap-2xs wa-align-items-end">
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
      <wa-button
        variant={isEnabled ? "brand" : "neutral"}
        appearance="outlined"
        size="small"
        onClick={() => setIsEnabled(!isEnabled)}
        title={getButtonTitle()}
        aria-label={isEnabled ? "Disable auto-refresh" : "Enable auto-refresh"}
        aria-pressed={isEnabled}
      >
        {getButtonContent()}
      </wa-button>
    </div>
  )
}
