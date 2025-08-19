import { useEffect, useState } from "preact/hooks"
import { FluentBundle, FluentResource } from "@fluent/bundle"

// Cache for loaded FluentBundles to avoid re-processing
const bundleCache = new Map<string, FluentBundle>()

/**
 * Hook to access localization in islands (client-side components)
 * Reads the locale from the HTML lang attribute set by the server
 */
export function useLocalization() {
  const [bundle, setBundle] = useState<FluentBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Read locale from HTML element - server's decision is final
  const locale = typeof document !== "undefined" ? document.documentElement.lang || "en" : "en"

  useEffect(() => {
    // Check if we already have cached bundle for this locale
    const cached = bundleCache.get(locale)
    if (cached) {
      setBundle(cached)
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
        if (data.ftlContent) {
          // Create FluentBundle and add all resources
          const fluentBundle = new FluentBundle(locale, { useIsolating: false })

          for (const [filename, content] of Object.entries(data.ftlContent)) {
            try {
              const resource = new FluentResource(content as string)
              fluentBundle.addResource(resource)
            } catch (err) {
              console.warn(`Failed to parse FTL resource ${filename}:`, err)
            }
          }

          bundleCache.set(locale, fluentBundle)
          setBundle(fluentBundle)
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

        // Fallback to null bundle so components can still render
        setBundle(null)
      })
  }, [locale])

  const t = (id: string, args?: Record<string, unknown>): string => {
    if (!bundle) {
      return id // Return the key as fallback if no bundle
    }

    const message = bundle.getMessage(id)
    if (!message || !message.value) {
      // In development, warn about missing translations
      if (typeof Deno === "undefined") { // Only in browser
        console.warn(`Missing translation for key: ${id}`)
      }
      return id // Return the key as fallback
    }

    // Convert args to FluentVariable types
    let fluentArgs: Record<string, string | number | Date> | null = null
    if (args) {
      fluentArgs = {}
      for (const [key, value] of Object.entries(args)) {
        if (typeof value === "string" || value instanceof Date) {
          fluentArgs[key] = value
        } else if (typeof value === "number") {
          fluentArgs[key] = isNaN(value) ? 0 : value // Convert NaN to 0
        } else if (value != null) {
          fluentArgs[key] = String(value)
        }
      }
    }

    try {
      return bundle.formatPattern(message.value, fluentArgs)
    } catch (err) {
      console.warn(`Error formatting message ${id}:`, err)
      return id // Return the key as fallback
    }
  }

  return { locale, t, loading, error }
}
