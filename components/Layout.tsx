import type { ComponentChildren } from "preact"

interface LayoutProps {
  children: ComponentChildren
  title?: string
  currentPath?: string
}

export default function Layout({ children, title = "Buildkite Overview", currentPath }: LayoutProps) {
  return (
    <wa-page mobile-breakpoint="768">
      <header slot="header" class="wa-split">
        <div class="wa-cluster">
          <wa-icon name="building" style="color: var(--wa-color-brand-fill-loud); font-size: 1.5em"></wa-icon>
          <span class="wa-heading-s wa-desktop-only">Divvun Buildkite</span>
          <a href="/" class={currentPath === "/" ? "active" : ""}>Overview</a>
          <a href="/pipelines" class={currentPath === "/pipelines" ? "active" : ""}>Pipelines</a>
          <a href="/settings" class={currentPath === "/settings" ? "active" : ""}>Settings</a>
        </div>
        <div class="wa-cluster wa-gap-xs">
          <wa-button size="small" variant="brand" appearance="outlined">
            <wa-icon slot="prefix" name="github"></wa-icon>
            Sign In
          </wa-button>
        </div>
      </header>

      <nav slot="subheader">
        <div class="wa-cluster" style="flex-wrap: nowrap">
          <wa-button data-toggle-nav appearance="plain" size="small">
            <wa-icon name="bars" label="Menu"></wa-icon>
          </wa-button>
          <wa-breadcrumb style="font-size: var(--wa-font-size-s)">
            <wa-breadcrumb-item>Divvun</wa-breadcrumb-item>
            <wa-breadcrumb-item>{title}</wa-breadcrumb-item>
          </wa-breadcrumb>
        </div>
        <wa-input 
          class="wa-desktop-only" 
          placeholder="Search pipelines..." 
          size="small" 
          style="max-inline-size: 16rem"
        >
          <wa-icon slot="prefix" name="magnifying-glass"></wa-icon>
        </wa-input>
      </nav>

      <nav slot="navigation">
        <div class="wa-stack wa-gap-xs">
          <a href="/" class={currentPath === "/" ? "active" : ""}>
            <wa-icon name="chart-line"></wa-icon>
            <span>Build Overview</span>
          </a>
          <a href="/pipelines" class={currentPath === "/pipelines" ? "active" : ""}>
            <wa-icon name="sitemap"></wa-icon>
            <span>All Pipelines</span>
          </a>
          <wa-divider></wa-divider>
          <h3 class="wa-heading-xs">Organizations</h3>
          <a href="/orgs/divvun">
            <wa-icon name="folder"></wa-icon>
            <span>divvun</span>
          </a>
          <a href="/orgs/giellalt">
            <wa-icon name="folder"></wa-icon>
            <span>giellalt</span>
          </a>
          <a href="/orgs/necessary-nu">
            <wa-icon name="folder"></wa-icon>
            <span>necessary-nu</span>
          </a>
          <a href="/orgs/bbqsrc">
            <wa-icon name="folder"></wa-icon>
            <span>bbqsrc</span>
          </a>
        </div>
      </nav>

      <nav slot="navigation-footer">
        <a href="/settings" class="wa-flank">
          <wa-icon name="gear"></wa-icon>
          <span>Settings</span>
        </a>
        <a href="/help" class="wa-flank">
          <wa-icon name="circle-question"></wa-icon>
          <span>Help</span>
        </a>
      </nav>

      <main>
        {children}
      </main>

      <footer slot="footer" class="wa-grid wa-gap-xl">
        <div class="wa-cluster" style="flex-wrap: nowrap">
          <wa-icon name="building" style="font-size: 1.5em"></wa-icon>
          <span class="wa-heading-s">Divvun Buildkite Overview</span>
        </div>
        <div class="wa-stack">
          <h3 class="wa-heading-xs">Resources</h3>
          <a href="https://buildkite.com/divvun" target="_blank" rel="noopener">Buildkite Dashboard</a>
          <a href="https://github.com/divvun" target="_blank" rel="noopener">GitHub - divvun</a>
          <a href="https://github.com/giellalt" target="_blank" rel="noopener">GitHub - giellalt</a>
        </div>
        <div class="wa-stack">
          <h3 class="wa-heading-xs">Tools</h3>
          <a href="/api/webhooks">Webhook Config</a>
          <a href="/api/sync">Sync Pipelines</a>
          <a href="/api/health">API Health</a>
        </div>
      </footer>
    </wa-page>
  )
}