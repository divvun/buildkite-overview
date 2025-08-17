import { useEffect, useState } from "preact/hooks"

// Cache for loaded locales to avoid re-fetching
const localeCache = new Map<string, Record<string, string>>()

/**
 * Hook to access localization in islands (client-side components)
 * Reads the locale from the HTML lang attribute set by the server
 */
export function useLocalization() {
  const [messages, setMessages] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Read locale from HTML element - server's decision is final
  const locale = typeof document !== "undefined" ? document.documentElement.lang || "en" : "en"

  useEffect(() => {
    // Check if we already have cached messages for this locale
    const cached = localeCache.get(locale)
    if (cached) {
      setMessages(cached)
      setLoading(false)
      return
    }

    // Fetch from API
    fetch(`/api/locales/${locale}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch locale ${locale}: ${res.status}`)
        }
        return res.json()
      })
      .then((data) => {
        if (data.messages) {
          localeCache.set(locale, data.messages)
          setMessages(data.messages)
          setError(null)
        } else {
          throw new Error("Invalid locale data format")
        }
        setLoading(false)
      })
      .catch((err) => {
        console.error("Error loading locale:", err)
        setError(err.message)
        setLoading(false)

        // Fallback to empty messages so components can still render
        setMessages({})
      })
  }, [locale])

  const t = (id: string, args?: Record<string, unknown>): string => {
    let message = messages[id]
    if (!message) {
      // In development, warn about missing translations
      if (typeof Deno === "undefined") { // Only in browser
        console.warn(`Missing translation for key: ${id}`)
      }
      return id // Return the key as fallback
    }

    // Simple parameter substitution for client-side
    if (args) {
      message = message.replace(/\{\$(\w+)\}/g, (match, key) => {
        return args[key]?.toString() || match
      })

      // Handle pluralization (basic implementation)
      const pluralMatch = message.match(/\{\$(\w+) ->\s*\[one\] ([^\n]*)\s*\*\[other\] ([^\n]*)\s*\}/)
      if (pluralMatch) {
        const [, countKey, oneForm, otherForm] = pluralMatch
        const count = Number(args[countKey])
        message = count === 1 ? oneForm : otherForm
        message = message.replace(`{$${countKey}}`, count.toString())
      }
    }

    return message
  }

  return { locale, t, loading, error }
}
