import { define } from "~/utils.ts"
import Layout from "~/components/Layout.tsx"

// Mock pipeline data for testing
const mockPipelines = [
  { 
    id: "1", 
    name: "kbdgen", 
    repo: "divvun/kbdgen", 
    status: "passed", 
    lastBuild: "2 hours ago",
    tags: ["keyboard", "generator", "core"],
    builds: { total: 42, passed: 38, failed: 4 }
  },
  { 
    id: "2", 
    name: "pahkat", 
    repo: "divvun/pahkat", 
    status: "failed", 
    lastBuild: "4 hours ago",
    tags: ["package-manager", "installer"],
    builds: { total: 128, passed: 115, failed: 13 }
  },
  { 
    id: "3", 
    name: "divvun-manager", 
    repo: "divvun/divvun-manager", 
    status: "running", 
    lastBuild: "now",
    tags: ["gui", "manager", "desktop"],
    builds: { total: 89, passed: 82, failed: 7 }
  },
  { 
    id: "4", 
    name: "giella-core", 
    repo: "giellalt/giella-core", 
    status: "passed", 
    lastBuild: "1 day ago",
    tags: ["linguistics", "core", "fst"],
    builds: { total: 234, passed: 220, failed: 14 }
  },
  { 
    id: "5", 
    name: "lang-sme", 
    repo: "giellalt/lang-sme", 
    status: "passed", 
    lastBuild: "6 hours ago",
    tags: ["language", "sami", "fst"],
    builds: { total: 156, passed: 145, failed: 11 }
  }
]

function getBadgeVariant(status: string) {
  switch (status) {
    case "passed": return "success"
    case "failed": return "danger" 
    case "running": return "warning"
    default: return "neutral"
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "passed": return "circle-check"
    case "failed": return "circle-xmark" 
    case "running": return "spinner"
    default: return "circle"
  }
}

export default define.page(function Pipelines() {
  return (
    <Layout title="All Pipelines" currentPath="/pipelines">
      <div class="wa-stack wa-gap-l" style="padding: var(--wa-space-l)">
        <header class="wa-flank">
          <div>
            <h1 class="wa-heading-l">All Pipelines</h1>
            <p class="wa-body-m wa-color-text-quiet">
              Manage and monitor all Buildkite pipelines across organizations
            </p>
          </div>
          <div class="wa-cluster wa-gap-s">
            <wa-button variant="brand" appearance="outlined">
              <wa-icon slot="prefix" name="plus"></wa-icon>
              Create Pipeline
            </wa-button>
            <wa-button variant="brand">
              <wa-icon slot="prefix" name="arrow-rotate-right"></wa-icon>
              Sync All
            </wa-button>
          </div>
        </header>

        <div class="wa-cluster wa-gap-m">
          <wa-input placeholder="Filter pipelines..." style="min-width: 300px">
            <wa-icon slot="prefix" name="magnifying-glass"></wa-icon>
          </wa-input>
          <wa-select placeholder="Organization">
            <wa-option value="">All Organizations</wa-option>
            <wa-option value="divvun">divvun</wa-option>
            <wa-option value="giellalt">giellalt</wa-option>
            <wa-option value="necessary-nu">necessary-nu</wa-option>
            <wa-option value="bbqsrc">bbqsrc</wa-option>
          </wa-select>
          <wa-select placeholder="Status">
            <wa-option value="">All Status</wa-option>
            <wa-option value="passed">Passed</wa-option>
            <wa-option value="failed">Failed</wa-option>
            <wa-option value="running">Running</wa-option>
          </wa-select>
        </div>

        <div class="wa-grid wa-gap-m">
          {mockPipelines.map((pipeline) => (
            <wa-card key={pipeline.id}>
              <div class="wa-stack wa-gap-s">
                <div class="wa-flank">
                  <div class="wa-stack wa-gap-3xs">
                    <div class="wa-flank wa-gap-xs">
                      <wa-icon name={getStatusIcon(pipeline.status)} 
                               style={`color: var(--wa-color-${getBadgeVariant(pipeline.status)}-fill-loud)`}>
                      </wa-icon>
                      <span class="wa-heading-s">{pipeline.name}</span>
                    </div>
                    <div class="wa-caption-s wa-color-text-quiet">{pipeline.repo}</div>
                  </div>
                  <wa-badge variant={getBadgeVariant(pipeline.status)}>
                    {pipeline.status}
                  </wa-badge>
                </div>

                <div class="wa-cluster wa-gap-xs" style="flex-wrap: wrap">
                  {pipeline.tags.map((tag) => (
                    <wa-tag key={tag} size="small">{tag}</wa-tag>
                  ))}
                </div>

                <wa-divider></wa-divider>

                <div class="wa-flank">
                  <div class="wa-stack wa-gap-3xs">
                    <div class="wa-caption-s">Build Stats</div>
                    <div class="wa-cluster wa-gap-s">
                      <span class="wa-caption-xs">
                        <wa-badge variant="success" size="small">{pipeline.builds.passed}</wa-badge> passed
                      </span>
                      <span class="wa-caption-xs">
                        <wa-badge variant="danger" size="small">{pipeline.builds.failed}</wa-badge> failed
                      </span>
                    </div>
                  </div>
                  <div class="wa-stack wa-gap-3xs wa-align-items-end">
                    <div class="wa-caption-s">Last Build</div>
                    <div class="wa-caption-xs wa-color-text-quiet">{pipeline.lastBuild}</div>
                  </div>
                </div>
              </div>
            </wa-card>
          ))}
        </div>
      </div>    
    </Layout>
  )
})