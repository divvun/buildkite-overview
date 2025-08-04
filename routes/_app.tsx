import type { PageProps } from "fresh"

export default function App({ Component }: PageProps) {
  return (
    <html class="wa-cloak">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>buildkite-overview</title>
        <link rel="stylesheet" href="/webawesome/styles/webawesome.css" />
        <link rel="stylesheet" href="/styles.css" />
        <script type="module" src="/webawesome/webawesome.loader.js"></script>
      </head>
      <body>
        <Component />
      </body>
    </html>
  )
}
