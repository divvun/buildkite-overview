import { FluentBundle, FluentResource } from "@fluent/bundle"
import { negotiateLanguages } from "@fluent/langneg"

// Automatically detect supported locales from filesystem
function detectSupportedLocales(): string[] {
  try {
    const localesDir = "./locales"
    const entries = Array.from(Deno.readDirSync(localesDir))
    return entries
      .filter((entry) => entry.isDirectory)
      .map((entry) => entry.name)
      .sort()
  } catch {
    // Fallback if directory doesn't exist or can't be read
    return ["en"]
  }
}

export const SUPPORTED_LOCALES = detectSupportedLocales()
export const DEFAULT_LOCALE = "en" as const

export type SupportedLocale = string

// Cache for loaded .ftl files
const ftlCache = new Map<string, string>()

// Cache for FluentBundles
const bundleCache = new Map<string, FluentBundle>()

/**
 * Load an .ftl file from the locales directory
 */
async function loadFtlFile(locale: SupportedLocale, filename: string): Promise<string> {
  const cacheKey = `${locale}/${filename}`

  if (ftlCache.has(cacheKey)) {
    return ftlCache.get(cacheKey)!
  }

  try {
    const path = `./locales/${locale}/${filename}.ftl`
    const content = await Deno.readTextFile(path)
    ftlCache.set(cacheKey, content)
    return content
  } catch (error) {
    console.warn(`Failed to load ${cacheKey}:`, error)

    // Fallback to English if available
    if (locale !== DEFAULT_LOCALE) {
      try {
        const fallbackPath = `./locales/${DEFAULT_LOCALE}/${filename}.ftl`
        const fallbackContent = await Deno.readTextFile(fallbackPath)
        return fallbackContent
      } catch (fallbackError) {
        console.warn(`Failed to load fallback ${DEFAULT_LOCALE}/${filename}:`, fallbackError)
      }
    }

    return ""
  }
}

/**
 * Create a FluentBundle for the given locale
 */
async function createFluentBundle(locale: SupportedLocale): Promise<FluentBundle> {
  if (bundleCache.has(locale)) {
    return bundleCache.get(locale)!
  }

  const bundle = new FluentBundle(locale, {
    useIsolating: false, // Disable bidi isolation characters for cleaner output
  })

  // Load all .ftl files for this locale
  const ftlFiles = ["main", "dashboard", "pipelines", "agents", "queues", "errors"]

  for (const filename of ftlFiles) {
    const ftlContent = await loadFtlFile(locale, filename)
    if (ftlContent) {
      const resource = new FluentResource(ftlContent)
      bundle.addResource(resource)
    }
  }

  bundleCache.set(locale, bundle)
  return bundle
}

/**
 * Parse Accept-Language header and negotiate the best locale
 */
export function negotiateLocale(acceptLanguageHeader?: string): SupportedLocale {
  if (!acceptLanguageHeader) {
    return DEFAULT_LOCALE
  }

  // Parse Accept-Language header into requested locales
  const requestedLocales = acceptLanguageHeader
    .split(",")
    .map((lang) => lang.split(";")[0].trim().toLowerCase())
    .filter(Boolean)

  // Use Fluent's language negotiation
  const supportedLocales = [...SUPPORTED_LOCALES]
  const negotiated = negotiateLanguages(
    requestedLocales,
    supportedLocales,
    { defaultLocale: DEFAULT_LOCALE },
  )

  return (negotiated[0] as SupportedLocale) || DEFAULT_LOCALE
}

/**
 * Get a FluentBundle for the given locale with fallback chain
 */
export async function getLocalizationBundle(locale: SupportedLocale): Promise<FluentBundle> {
  try {
    return await createFluentBundle(locale)
  } catch (error) {
    console.warn(`Failed to create bundle for ${locale}, falling back to ${DEFAULT_LOCALE}:`, error)
    return await createFluentBundle(DEFAULT_LOCALE)
  }
}

/**
 * Create a translation function for the given bundle
 */
export function createTranslationFunction(bundle: FluentBundle) {
  return function t(id: string, args?: Record<string, unknown>): string {
    const message = bundle.getMessage(id)
    if (!message || !message.value) {
      console.warn(`Missing translation for key: ${id}`)
      return id // Return the key as fallback
    }

    const formatted = bundle.formatPattern(message.value, args)
    return formatted
  }
}

/**
 * Extract all translations from a FluentBundle for client-side use
 */
export function extractTranslations(bundle: FluentBundle): Record<string, string> {
  const translations: Record<string, string> = {}

  for (const [id, message] of bundle._messages) {
    if (message.value) {
      translations[id] = message.value
    }
  }

  return translations
}

/**
 * Clear all caches (useful for development)
 */
export function clearLocalizationCache(): void {
  ftlCache.clear()
  bundleCache.clear()
}
