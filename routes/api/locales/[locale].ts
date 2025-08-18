import { SUPPORTED_LOCALES, type SupportedLocale } from "~/utils/localization.ts"

export const handler = async (ctx: any) => {
  try {
    const requestedLocale = ctx.params.locale as string

    // Validate the requested locale
    const locale: SupportedLocale = SUPPORTED_LOCALES.includes(requestedLocale as SupportedLocale)
      ? requestedLocale as SupportedLocale
      : "en"

    // Read all .ftl files for this locale
    const ftlFiles = ["main", "dashboard", "pipelines", "agents", "queues", "errors"]
    const messages: Record<string, string> = {}

    for (const filename of ftlFiles) {
      try {
        const path = `./locales/${locale}/${filename}.ftl`
        const content = await Deno.readTextFile(path)

        // Parse .ftl content to extract key-value pairs
        const lines = content.split("\n")
        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
            const [key, ...valueParts] = trimmed.split("=")
            const value = valueParts.join("=").trim()
            if (key && value) {
              messages[key.trim()] = value
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to load ${locale}/${filename}.ftl:`, error)

        // Fallback to English if available and locale is not English
        if (locale !== "en") {
          try {
            const fallbackPath = `./locales/en/${filename}.ftl`
            const fallbackContent = await Deno.readTextFile(fallbackPath)

            const lines = fallbackContent.split("\n")
            for (const line of lines) {
              const trimmed = line.trim()
              if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
                const [key, ...valueParts] = trimmed.split("=")
                const value = valueParts.join("=").trim()
                if (key && value && !messages[key.trim()]) {
                  messages[key.trim()] = value
                }
              }
            }
          } catch (fallbackError) {
            console.warn(`Failed to load fallback en/${filename}.ftl:`, fallbackError)
          }
        }
      }
    }

    // Return the locale bundle
    const response = {
      locale,
      messages,
      timestamp: Date.now(),
    }

    return new Response(JSON.stringify(response), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300", // Cache for 5 minutes
        "Content-Language": locale,
      },
    })
  } catch (error) {
    console.error("Error serving locale:", error)

    return new Response(
      JSON.stringify({
        error: "Failed to load locale",
        locale: "en",
        messages: {},
        timestamp: Date.now(),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    )
  }
}
