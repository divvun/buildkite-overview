import { useEffect, useState } from "preact/hooks"

interface AutoRefreshProps {
  intervalSeconds?: number
}

export default function AutoRefresh({ intervalSeconds = 5 }: AutoRefreshProps) {
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
    let countdown = effectiveInterval

    const interval = setInterval(() => {
      countdown--
      if (countdown <= 0) {
        // Dispatch a custom event that islands can listen to
        globalThis.dispatchEvent(new CustomEvent("autorefresh"))
        countdown = effectiveInterval
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [effectiveInterval])

  // Return null since this component has no UI
  return null
}
