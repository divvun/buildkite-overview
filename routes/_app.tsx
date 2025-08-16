import type { PageProps } from "fresh"

export default function App({ Component }: PageProps) {
  return (
    <html class="wa-cloak wa-theme-awesome">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>buildkite-overview</title>
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
        <Component />
      </body>
    </html>
  )
}
