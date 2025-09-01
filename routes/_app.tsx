import type { PageProps } from "fresh"
import AutoRefresh from "~/islands/AutoRefresh.tsx"
import type { AppState } from "~/server/middleware.ts"
import { AUTO_REFRESH_INTERVAL_SECONDS } from "~/utils/constants.ts"

export default function App({ Component, state }: PageProps<unknown, AppState>) {
  return (
    <html lang={state?.locale || "en"} class="wa-cloak wa-theme-awesome">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{state?.title || state?.t?.("default-app-title") || "Buildkite Overview"}</title>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=JetBrains+Mono:wght@400&family=Noto+Sans+Hebrew:wght@100..900&family=Noto+Sans:ital,wght@0,100..900;1,100..900&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/libraries/webawesome/styles/webawesome.css" />
        <script type="module">
          {`
          import { registerIconLibrary, unregisterIconLibrary, setDefaultIconFamily } from '/libraries/webawesome/webawesome.js';
          
          // Remove FontAwesome default library and register Boxicons as default
          unregisterIconLibrary('default');
          registerIconLibrary('default', {
            resolver: name => {
              // Handle GitHub logo specifically
              if (name === 'github') {
                return '/libraries/boxicons/svg/logos/bxl-github.svg';
              }
              // Map some common icon names
              if (name === 'bars') {
                name = 'menu';
              }
              if (name === 'arrow-rotate-right') {
                name = 'refresh';
              }
              console.log('Resolving icon:', name);
              return \`/libraries/boxicons/svg/regular/bx-\${name}.svg\`
            }
          });
          setDefaultIconFamily('default');
        `}
        </script>
        <link rel="stylesheet" href="/libraries/webawesome/styles/themes/awesome.css" />
        <link rel="stylesheet" href="/styles.css" />
        <script type="module" src="/libraries/webawesome/webawesome.loader.js"></script>
        <script type="module">
          {`
          import { allDefined } from '/libraries/webawesome/webawesome.js';
          
          await allDefined();
        `}
        </script>
      </head>
      <body>
        <AutoRefresh intervalSeconds={AUTO_REFRESH_INTERVAL_SECONDS} />
        <Component />
      </body>
    </html>
  )
}
