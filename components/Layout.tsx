import type { ComponentChildren } from "preact"
import type { SessionData } from "~/utils/session.ts"

interface BreadcrumbItem {
  label: string
  href?: string
}

interface LayoutProps {
  children: ComponentChildren
  title?: string
  currentPath?: string
  session?: SessionData | null
  breadcrumbs?: BreadcrumbItem[]
}

export default function Layout(
  { children, title = "Buildkite Overview", currentPath, session, breadcrumbs }: LayoutProps,
) {
  return (
    <wa-page mobile-breakpoint="768">
      <header slot="header" class="wa-split">
        <div class="wa-cluster">
          <wa-icon name="building" style={"color: var(--wa-color-brand-fill-loud); font-size: 1.5em" as any}></wa-icon>
          <span class="wa-heading-s wa-desktop-only">Divvun Buildkite</span>
          <a href="/" class={currentPath === "/" ? "active" : ""}>Overview</a>
          <a
            href="/pipelines"
            class={currentPath === "/pipelines" || currentPath?.startsWith("/pipelines/") ? "active" : ""}
          >
            Pipelines
          </a>
          <a href="/agents" class={currentPath === "/agents" ? "active" : ""}>Agents</a>
          <a href="/running" class={currentPath === "/running" ? "active" : ""}>Running</a>
        </div>
        <div class="wa-cluster wa-gap-xs">
          {session
            ? (
              <wa-dropdown>
                <wa-button
                  slot="trigger"
                  size="small"
                  appearance="plain"
                  style="max-width: 200px; display: flex; align-items: center; gap: var(--wa-space-xs)"
                >
                  <img
                    src={session.user.avatar_url}
                    alt={session.user.name || session.user.login}
                    style="width: 24px; height: 24px; border-radius: 50%"
                  />
                  <span
                    class="wa-desktop-only"
                    style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 120px"
                  >
                    {session.user.name || session.user.login}
                  </span>
                  <wa-icon name="chevron-down"></wa-icon>
                </wa-button>
                <wa-dropdown-item>
                  <wa-icon slot="prefix" name="user"></wa-icon>
                  <a
                    href={`https://github.com/${session.user.login}`}
                    target="_blank"
                    rel="noopener"
                    style="text-decoration: none; color: inherit"
                    class="wa-cluster wa-gap-xs"
                  >
                    View GitHub Profile
                    <wa-icon name="arrow-up-right-from-square" style="font-size: 0.75em"></wa-icon>
                  </a>
                </wa-dropdown-item>
                <wa-divider></wa-divider>
                <wa-dropdown-item>
                  <form method="POST" action="/auth/logout" style="width: 100%">
                    <button
                      type="submit"
                      style="background: none; border: none; width: 100%; text-align: left; padding: 0"
                    >
                      <wa-icon slot="prefix" name="arrow-right-from-bracket"></wa-icon>
                      Sign Out
                    </button>
                  </form>
                </wa-dropdown-item>
              </wa-dropdown>
            )
            : (
              <wa-button size="small" variant="brand" appearance="outlined">
                <wa-icon slot="prefix" name="github"></wa-icon>
                <a href="/auth/login" style="text-decoration: none; color: inherit">
                  Sign In
                </a>
              </wa-button>
            )}
        </div>
      </header>

      <nav slot="subheader">
        <div class="wa-cluster" style="flex-wrap: nowrap">
          <wa-button data-toggle-nav appearance="plain" size="small">
            <wa-icon name="bars" label="Menu"></wa-icon>
          </wa-button>
          {breadcrumbs && breadcrumbs.length > 0 && (
            <wa-breadcrumb style={"font-size: var(--wa-font-size-s)" as any}>
              <wa-breadcrumb-item>
                <a href="/" title="Home">
                  <wa-icon name="home"></wa-icon>
                </a>
              </wa-breadcrumb-item>
              {breadcrumbs.map((crumb, index) => (
                <wa-breadcrumb-item key={index}>
                  {crumb.href ? <a href={crumb.href}>{crumb.label}</a> : (
                    crumb.label
                  )}
                </wa-breadcrumb-item>
              ))}
            </wa-breadcrumb>
          )}
        </div>
      </nav>

      <main>
        <div class="main-container" style="max-width: 1400px; margin: 0 auto; padding: 0 var(--wa-space-m)">
          {children}
        </div>
      </main>

      <footer slot="footer" class="wa-grid wa-gap-xl">
        <div class="wa-cluster" style="flex-wrap: nowrap">
          <wa-icon name="building" style={"font-size: 1.5em" as any}></wa-icon>
          <span class="wa-heading-s">Divvun Buildkite Overview</span>
        </div>
        <div class="wa-stack">
          <h3 class="wa-heading-xs">Resources</h3>
          <a href="https://buildkite.com/divvun" target="_blank" rel="noopener" class="wa-cluster wa-gap-xs">
            Buildkite Dashboard
            <wa-icon name="arrow-up-right-from-square" style="font-size: 0.75em"></wa-icon>
          </a>
          <a href="https://github.com/divvun" target="_blank" rel="noopener" class="wa-cluster wa-gap-xs">
            GitHub - divvun
            <wa-icon name="arrow-up-right-from-square" style="font-size: 0.75em"></wa-icon>
          </a>
          <a href="https://github.com/giellalt" target="_blank" rel="noopener" class="wa-cluster wa-gap-xs">
            GitHub - giellalt
            <wa-icon name="arrow-up-right-from-square" style="font-size: 0.75em"></wa-icon>
          </a>
        </div>
      </footer>
    </wa-page>
  )
}
