import { Context, page } from "fresh"
import Layout from "~/components/Layout.tsx"
import { type AppState } from "~/utils/middleware.ts"
import { requireAuth, type SessionData } from "~/utils/session.ts"

interface SettingsProps {
  session: SessionData
}

export const handler = {
  GET(ctx: Context<AppState>) {
    // Settings requires authentication
    const session = requireAuth(ctx.req)
    
    return page({ session } satisfies SettingsProps)
  },
}

export default function Settings({ session }: SettingsProps) {
  return (
    <Layout title="Settings" currentPath="/settings" session={session}>
      <div class="wa-stack wa-gap-l" style="padding: var(--wa-space-l)">
        <header>
          <h1 class="wa-heading-l">Settings</h1>
          <p class="wa-body-m wa-color-text-quiet">
            Configure your Buildkite overview dashboard and integrations
          </p>
        </header>

        <div class="wa-grid wa-gap-l" style="grid-template-columns: 1fr 2fr; align-items: start">
          <nav class="wa-stack wa-gap-s">
            <wa-card>
              <div class="wa-stack wa-gap-s">
                <h3 class="wa-heading-s">Categories</h3>
                <div class="wa-stack wa-gap-xs">
                  <a href="#general" class="wa-flank active">
                    <wa-icon name="gear"></wa-icon>
                    <span>General</span>
                  </a>
                  <a href="#auth" class="wa-flank">
                    <wa-icon name="shield-check"></wa-icon>
                    <span>Authentication</span>
                  </a>
                  <a href="#notifications" class="wa-flank">
                    <wa-icon name="bell"></wa-icon>
                    <span>Notifications</span>
                  </a>
                  <a href="#webhooks" class="wa-flank">
                    <wa-icon name="webhook"></wa-icon>
                    <span>Webhooks</span>
                  </a>
                  <a href="#sync" class="wa-flank">
                    <wa-icon name="arrow-rotate-right"></wa-icon>
                    <span>Sync Settings</span>
                  </a>
                </div>
              </div>
            </wa-card>
          </nav>

          <div class="wa-stack wa-gap-l">
            <wa-card>
              <div class="wa-stack wa-gap-m">
                <h2 class="wa-heading-m">General Settings</h2>
                
                <div class="wa-stack wa-gap-s">
                  <label class="wa-stack wa-gap-xs">
                    <span class="wa-body-s">Dashboard Title</span>
                    <wa-input value="Divvun Buildkite Overview" placeholder="Enter dashboard title">
                    </wa-input>
                  </label>

                  <label class="wa-stack wa-gap-xs">
                    <span class="wa-body-s">Refresh Interval</span>
                    <wa-select value="30">
                      <wa-option value="10">10 seconds</wa-option>
                      <wa-option value="30">30 seconds</wa-option>
                      <wa-option value="60">1 minute</wa-option>
                      <wa-option value="300">5 minutes</wa-option>
                    </wa-select>
                  </label>

                  <label class="wa-cluster wa-gap-s">
                    <wa-switch checked></wa-switch>
                    <div class="wa-stack wa-gap-3xs">
                      <span class="wa-body-s">Auto-refresh builds</span>
                      <span class="wa-caption-s wa-color-text-quiet">
                        Automatically refresh build status at the specified interval
                      </span>
                    </div>
                  </label>

                  <label class="wa-cluster wa-gap-s">
                    <wa-switch></wa-switch>
                    <div class="wa-stack wa-gap-3xs">
                      <span class="wa-body-s">Show build duration</span>
                      <span class="wa-caption-s wa-color-text-quiet">
                        Display build duration in pipeline cards
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </wa-card>

            <wa-card>
              <div class="wa-stack wa-gap-m">
                <h2 class="wa-heading-m">GitHub Organizations</h2>
                <p class="wa-body-s wa-color-text-quiet">
                  Configure which GitHub organizations to monitor for repositories
                </p>
                
                <div class="wa-stack wa-gap-s">
                  {["divvun", "giellalt", "necessary-nu", "bbqsrc"].map((org) => (
                    <div key={org} class="wa-flank">
                      <div class="wa-cluster wa-gap-s">
                        <wa-switch checked={org === "divvun" || org === "giellalt"}></wa-switch>
                        <div class="wa-stack wa-gap-3xs">
                          <span class="wa-body-s">{org}</span>
                          <span class="wa-caption-s wa-color-text-quiet">
                            https://github.com/{org}
                          </span>
                        </div>
                      </div>
                      <wa-button size="small" appearance="outlined">
                        <wa-icon name="gear"></wa-icon>
                      </wa-button>
                    </div>
                  ))}
                </div>

                <wa-button variant="brand" appearance="outlined">
                  <wa-icon slot="prefix" name="plus"></wa-icon>
                  Add Organization
                </wa-button>
              </div>
            </wa-card>

            <wa-card>
              <div class="wa-stack wa-gap-m">
                <h2 class="wa-heading-m">Buildkite Integration</h2>
                
                <div class="wa-stack wa-gap-s">
                  <label class="wa-stack wa-gap-xs">
                    <span class="wa-body-s">API Token</span>
                    <wa-input type="password" placeholder="Enter your Buildkite API token">
                      <wa-icon slot="prefix" name="key"></wa-icon>
                    </wa-input>
                    <span class="wa-caption-s wa-color-text-quiet">
                      Required for accessing private repositories and creating pipelines
                    </span>
                  </label>

                  <label class="wa-stack wa-gap-xs">
                    <span class="wa-body-s">Organization Slug</span>
                    <wa-input value="divvun" placeholder="Enter Buildkite organization slug">
                    </wa-input>
                  </label>

                  <div class="wa-cluster wa-gap-s">
                    <wa-button variant="brand">Test Connection</wa-button>
                    <wa-button appearance="outlined">Save Settings</wa-button>
                  </div>
                </div>
              </div>
            </wa-card>
          </div>
        </div>
      </div>
    </Layout>
  )
}