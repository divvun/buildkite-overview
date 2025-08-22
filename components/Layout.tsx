import type { ComponentChildren } from "preact"
import LanguageSelector from "~/islands/LanguageSelector.tsx"
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
  t?: (id: string, args?: Record<string, unknown>) => string
  state?: { locale?: string }
}

export default function Layout(
  {
    children,
    title: _title,
    currentPath,
    session,
    breadcrumbs,
    t,
    state,
  }: LayoutProps,
) {
  // Use provided t function or create a fallback that returns the key
  const translate = t || ((id: string) => id)
  const content = (
    <wa-page mobile-breakpoint="768">
      <nav slot="navigation" aria-label={translate("primary-navigation")}>
        <div class="wa-stack wa-gap-s navigation-content">
          {/* Navigation Links */}
          <div class="wa-stack wa-gap-xs">
            <a href="/" class={currentPath === "/" ? "active" : ""} aria-label={translate("dashboard-overview")}>
              <wa-icon slot="prefix" name="chart-line"></wa-icon>
              {translate("nav-overview")}
            </a>
            <a
              href="/pipelines"
              class={currentPath === "/pipelines" || currentPath?.startsWith("/pipelines/") ? "active" : ""}
              aria-label={translate("view-all-pipelines")}
            >
              <wa-icon slot="prefix" name="layer-group"></wa-icon>
              {translate("nav-pipelines")}
            </a>
            {session && (
              <>
                <a
                  href="/agents"
                  class={currentPath === "/agents" ? "active" : ""}
                  aria-label={translate("view-build-agents")}
                >
                  <wa-icon slot="prefix" name="robot"></wa-icon>
                  {translate("nav-agents")}
                </a>
                <a
                  href="/queues"
                  class={currentPath === "/queues" ? "active" : ""}
                  aria-label={translate("view-build-queues")}
                >
                  <wa-icon slot="prefix" name="list"></wa-icon>
                  {translate("nav-queues")}
                </a>
              </>
            )}
          </div>

          {/* Mobile-only Language and User controls */}
          <div class="mobile-nav-controls">
            <wa-divider></wa-divider>
            <div class="wa-stack wa-gap-xs">
              <div class="nav-control-item">
                <wa-icon name="globe"></wa-icon>
                <LanguageSelector currentLocale={state?.locale || "en"} />
              </div>

              {session
                ? (
                  <div class="nav-control-item">
                    <wa-icon name="user"></wa-icon>
                    <wa-dropdown>
                      <wa-button
                        slot="trigger"
                        size="small"
                        appearance="plain"
                        with-caret
                        aria-label={translate("user-menu-aria", { user: session.user.name || session.user.login })}
                      >
                        {session.user.name || session.user.login}
                      </wa-button>

                      <wa-dropdown-item>
                        <wa-icon slot="icon" name="user"></wa-icon>
                        <a
                          href={`https://github.com/${session.user.login}`}
                          target="_blank"
                          rel="noopener"
                          style="text-decoration: none; color: inherit; display: flex; align-items: center; gap: var(--wa-space-xs)"
                        >
                          {translate("view-github-profile")}
                          <wa-icon name="arrow-up-right-from-square" style="font-size: 0.75em"></wa-icon>
                        </a>
                      </wa-dropdown-item>
                      <wa-divider></wa-divider>
                      <wa-dropdown-item>
                        <wa-icon slot="icon" name="arrow-right-from-bracket"></wa-icon>
                        <a href="/auth/logout" style="text-decoration: none; color: inherit">
                          {translate("logout")}
                        </a>
                      </wa-dropdown-item>
                    </wa-dropdown>
                  </div>
                )
                : (
                  <div class="nav-control-item">
                    <wa-icon name="github"></wa-icon>
                    <a href="/auth/login" style="text-decoration: none; color: inherit">
                      {translate("login")}
                    </a>
                  </div>
                )}
            </div>
          </div>
        </div>
      </nav>

      <header slot="header">
        <div class="wa-cluster">
          <wa-icon
            name="building"
            style="color: var(--wa-color-brand-fill-loud); font-size: 1.5em"
            aria-label={translate("buildkite-logo")}
          >
          </wa-icon>
          <span class="wa-heading-s">{translate("app-title")}</span>
          <a
            href="/"
            class={`wa-desktop-only ${currentPath === "/" ? "active" : ""}`}
            aria-label={translate("dashboard-overview")}
          >
            {translate("nav-overview")}
          </a>
          <a
            href="/pipelines"
            class={`wa-desktop-only ${
              currentPath === "/pipelines" || currentPath?.startsWith("/pipelines/") ? "active" : ""
            }`}
            aria-label={translate("view-all-pipelines")}
          >
            {translate("nav-pipelines")}
          </a>
          {session && (
            <>
              <a
                href="/agents"
                class={`wa-desktop-only ${currentPath === "/agents" ? "active" : ""}`}
                aria-label={translate("view-build-agents")}
              >
                {translate("nav-agents")}
              </a>
              <a
                href="/queues"
                class={`wa-desktop-only ${currentPath === "/queues" ? "active" : ""}`}
                aria-label={translate("view-build-queues")}
              >
                {translate("nav-queues")}
              </a>
            </>
          )}
        </div>
        <div class="wa-cluster wa-gap-xs desktop-header-actions">
          <LanguageSelector currentLocale={state?.locale || "en"} />
          {session
            ? (
              <wa-dropdown>
                <wa-button
                  slot="trigger"
                  size="small"
                  appearance="plain"
                  with-caret
                  aria-label={translate("user-menu-aria", { user: session.user.name || session.user.login })}
                >
                  <img
                    src={session.user.avatar_url}
                    alt={translate("profile-picture-alt", { user: session.user.name || session.user.login })}
                    style="width: 24px; height: 24px; border-radius: 50%; margin-right: var(--wa-space-xs)"
                  />
                </wa-button>

                <wa-dropdown-item>
                  <wa-icon slot="icon" name="user"></wa-icon>
                  <a
                    href={`https://github.com/${session.user.login}`}
                    target="_blank"
                    rel="noopener"
                    style="text-decoration: none; color: inherit; display: flex; align-items: center; gap: var(--wa-space-xs)"
                  >
                    {translate("view-github-profile")}
                    <wa-icon name="arrow-up-right-from-square" style="font-size: 0.75em"></wa-icon>
                  </a>
                </wa-dropdown-item>
                <wa-divider></wa-divider>
                <wa-dropdown-item>
                  <wa-icon slot="icon" name="arrow-right-from-bracket"></wa-icon>
                  <a href="/auth/logout" style="text-decoration: none; color: inherit">
                    {translate("logout")}
                  </a>
                </wa-dropdown-item>
              </wa-dropdown>
            )
            : (
              <wa-button size="small" variant="brand" appearance="outlined">
                <wa-icon slot="prefix" name="github"></wa-icon>
                <a
                  href="/auth/login"
                  style="text-decoration: none; color: inherit"
                  aria-label={translate("sign-in-github")}
                >
                  {translate("login")}
                </a>
              </wa-button>
            )}
        </div>
      </header>

      <nav slot="subheader" aria-label={translate("secondary-navigation")}>
        <div class="wa-cluster" style="flex-wrap: nowrap">
          {breadcrumbs && breadcrumbs.length > 0 && (
            <wa-breadcrumb style="font-size: var(--wa-font-size-s)" aria-label={translate("breadcrumb-navigation")}>
              <wa-breadcrumb-item>
                <a href="/" title={translate("home")} aria-label={translate("go-to-homepage")}>
                  <wa-icon name="home"></wa-icon>
                </a>
              </wa-breadcrumb-item>
              {breadcrumbs.map((crumb, index) => (
                <wa-breadcrumb-item key={index}>
                  {crumb.href
                    ? (
                      <a href={crumb.href} aria-label={translate("go-to-breadcrumb-aria", { label: crumb.label })}>
                        {crumb.label}
                      </a>
                    )
                    : <span aria-current="page">{crumb.label}</span>}
                </wa-breadcrumb-item>
              ))}
            </wa-breadcrumb>
          )}
        </div>
      </nav>

      <main role="main" aria-label={translate("main-content")}>
        <div class="main-container">
          {children}
        </div>
      </main>

      <footer slot="footer" class="wa-grid wa-gap-xl">
        <div class="wa-cluster" style="flex-wrap: nowrap">
          <wa-icon name="building" style="font-size: 1.5em"></wa-icon>
          <span class="wa-heading-s">{translate("divvun-buildkite-overview")}</span>
        </div>
        <div class="wa-stack">
          <h3 class="wa-heading-xs">{translate("resources")}</h3>
          <a href="https://buildkite.com/divvun" target="_blank" rel="noopener" class="wa-cluster wa-gap-xs">
            {translate("buildkite-dashboard")}
            <wa-icon name="arrow-up-right-from-square" style="font-size: 0.75em"></wa-icon>
          </a>
          <a href="https://github.com/divvun" target="_blank" rel="noopener" class="wa-cluster wa-gap-xs">
            {translate("github-divvun")}
            <wa-icon name="arrow-up-right-from-square" style="font-size: 0.75em"></wa-icon>
          </a>
          <a href="https://github.com/giellalt" target="_blank" rel="noopener" class="wa-cluster wa-gap-xs">
            {translate("github-giellalt")}
            <wa-icon name="arrow-up-right-from-square" style="font-size: 0.75em"></wa-icon>
          </a>
        </div>
      </footer>
    </wa-page>
  )

  return content
}
