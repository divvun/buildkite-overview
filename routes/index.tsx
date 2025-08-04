/// <reference path="../types/webawesome.d.ts" />
import { Context, page } from "fresh"
import Layout from "~/components/Layout.tsx"
import { type AppState } from "~/utils/middleware.ts"
import { type SessionData } from "~/utils/session.ts"

// Mock data for testing
const mockBuilds = [
  { name: "kbdgen", status: "passed", duration: "2m 34s", lastRun: "2 hours ago", repo: "divvun/kbdgen" },
  { name: "pahkat", status: "failed", duration: "1m 12s", lastRun: "4 hours ago", repo: "divvun/pahkat" },
  { name: "divvun-manager", status: "running", duration: "3m 45s", lastRun: "now", repo: "divvun/divvun-manager" },
  { name: "giella-core", status: "passed", duration: "5m 21s", lastRun: "1 day ago", repo: "giellalt/giella-core" },
  { name: "lang-sme", status: "passed", duration: "12m 03s", lastRun: "6 hours ago", repo: "giellalt/lang-sme" },
]

function getBadgeVariant(status: string) {
  switch (status) {
    case "passed": return "success"
    case "failed": return "danger" 
    case "running": return "warning"
    default: return "neutral"
  }
}

interface HomeProps {
  session?: SessionData | null
}

export const handler = {
  GET(ctx: Context<AppState>) {
    return page({ session: ctx.state.session } satisfies HomeProps)
  },
}

export default function Home(props: { data: HomeProps, state: AppState }) {
  const session = props.data.session
  
  return (
    <Layout title="Build Overview" currentPath="/" session={session}>
      <div class="wa-stack wa-gap-l" style="padding: var(--wa-space-l)">
        <header>
          <h1 class="wa-heading-l">Build Overview</h1>
          <p class="wa-body-m wa-color-text-quiet">
            Monitor the status of all Divvun project builds across GitHub organizations
          </p>
        </header>

        <div class="wa-grid wa-gap-m" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))">
          <wa-card>
            <div class="wa-stack wa-gap-xs">
              <div class="wa-flank">
                <span class="wa-heading-s">Total Pipelines</span>
                <wa-badge variant="brand">156</wa-badge>
              </div>
              <div class="wa-caption-m wa-color-text-quiet">Across 4 organizations</div>
            </div>
          </wa-card>

          <wa-card>
            <div class="wa-stack wa-gap-xs">
              <div class="wa-flank">
                <span class="wa-heading-s">Active Builds</span>
                <wa-badge variant="warning">3</wa-badge>
              </div>
              <div class="wa-caption-m wa-color-text-quiet">Currently running</div>
            </div>
          </wa-card>

          <wa-card>
            <div class="wa-stack wa-gap-xs">
              <div class="wa-flank">
                <span class="wa-heading-s">Success Rate</span>
                <wa-badge variant="success">94%</wa-badge>
              </div>
              <div class="wa-caption-m wa-color-text-quiet">Last 24 hours</div>
            </div>
          </wa-card>
        </div>

        <section>
          <h2 class="wa-heading-m">Recent Builds</h2>
          <wa-card>
            <div class="wa-stack wa-gap-s">
              {mockBuilds.map((build) => (
                <div key={build.name} class="wa-flank wa-gap-m" style="padding: var(--wa-space-s)">
                  <div class="wa-stack wa-gap-3xs">
                    <div class="wa-flank">
                      <span class="wa-heading-s">{build.name}</span>
                      <wa-badge variant={getBadgeVariant(build.status)}>
                        {build.status}
                      </wa-badge>
                    </div>
                    <div class="wa-caption-s wa-color-text-quiet">{build.repo}</div>
                  </div>
                  <div class="wa-stack wa-gap-3xs wa-align-items-end">
                    <div class="wa-caption-s">{build.duration}</div>
                    <div class="wa-caption-xs wa-color-text-quiet">{build.lastRun}</div>
                  </div>
                </div>
              ))}
            </div>
          </wa-card>
        </section>
      </div>
    </Layout>
  )
}
