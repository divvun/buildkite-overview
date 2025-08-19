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
    const ftlContent: Record<string, string> = {}

    for (const filename of ftlFiles) {
      try {
        const path = `./locales/${locale}/${filename}.ftl`
        const content = await Deno.readTextFile(path)
        ftlContent[filename] = content
      } catch (error) {
        console.warn(`Failed to load ${locale}/${filename}.ftl:`, error)

        // Fallback to English if available and locale is not English
        if (locale !== "en") {
          try {
            const fallbackPath = `./locales/en/${filename}.ftl`
            const fallbackContent = await Deno.readTextFile(fallbackPath)
            ftlContent[filename] = fallbackContent
          } catch (fallbackError) {
            console.warn(`Failed to load fallback en/${filename}.ftl:`, fallbackError)
            // If both fail, just skip this file
          }
        }
      }
    }

    // Return the raw FTL content for client-side processing
    const response = {
      locale,
      ftlContent,
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
        ftlContent: {},
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
