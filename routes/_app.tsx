import type { PageProps } from "fresh"
import AutoRefresh from "~/islands/AutoRefresh.tsx"
import { AUTO_REFRESH_INTERVAL_SECONDS } from "~/utils/constants.ts"
import type { AppState } from "~/utils/middleware.ts"

export default function App({ Component, state }: PageProps<unknown, AppState>) {
  return (
    <html lang={state?.locale || "en"} class="wa-cloak wa-theme-awesome">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{state?.title || state?.t?.("default-app-title") || "Buildkite Overview"}</title>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Noto+Sans+Hebrew:wght@100..900&family=Noto+Sans:ital,wght@0,100..900;1,100..900&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/webawesome/styles/webawesome.css" />
        <link rel="stylesheet" href="/webawesome/styles/themes/awesome.css" />
        <link rel="stylesheet" href="/styles.css" />
        <script type="module" src="/webawesome/webawesome.loader.js"></script>
      </head>
      <body>
        <AutoRefresh intervalSeconds={AUTO_REFRESH_INTERVAL_SECONDS} />
        <Component />
      </body>
    </html>
  )
}
