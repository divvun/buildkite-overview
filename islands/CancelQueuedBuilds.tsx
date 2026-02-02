import { useEffect, useState } from "preact/hooks"
import type { BuildkiteBuildRest } from "~/server/buildkite-client.ts"
import { useLocalization } from "~/utils/localization-context.tsx"

interface CancelResult {
  buildId: string
  buildNumber: number
  pipelineName: string
  pipelineSlug: string
  success: boolean
  error?: string
}

interface CancelAllResponse {
  totalQueued: number
  cancelled: number
  failed: number
  results: CancelResult[]
  error?: string
}

function formatDuration(startTime: string): string {
  const start = new Date(startTime).getTime()
  const now = Date.now()
  const ms = now - start

  const hours = Math.floor(ms / (1000 * 60 * 60))
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

export default function CancelQueuedBuilds() {
  const { t } = useLocalization()
  const [builds, setBuilds] = useState<BuildkiteBuildRest[]>([])
  const [longRunningBuilds, setLongRunningBuilds] = useState<BuildkiteBuildRest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>("")
  const [showConfirm, setShowConfirm] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelResult, setCancelResult] = useState<CancelAllResponse | null>(null)
  const [cancelTarget, setCancelTarget] = useState<"queued" | "long-running" | "all">("all")

  useEffect(() => {
    fetchQueuedBuilds()
  }, [])

  const fetchQueuedBuilds = async () => {
    try {
      setLoading(true)
      setError("")

      const response = await fetch("/api/admin/cancel-queued-builds")

      if (response.status === 401) {
        window.location.href = "/auth/login"
        return
      }

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const data = await response.json()
      setBuilds(data.builds || [])
      setLongRunningBuilds(data.longRunningBuilds || [])
    } catch (err) {
      console.error("Error fetching queued builds:", err)
      setError("Unable to load builds. Please try again later.")
    } finally {
      setLoading(false)
    }
  }

  const handleCancelAll = async () => {
    setCancelling(true)
    setError("")
    setCancelResult(null)

    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content")

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      }

      if (csrfToken) {
        headers["X-CSRF-Token"] = csrfToken
      }

      const response = await fetch("/api/admin/cancel-queued-builds", {
        method: "POST",
        headers,
        body: JSON.stringify({ target: cancelTarget }),
      })

      if (response.status === 401) {
        window.location.href = "/auth/login"
        return
      }

      const data: CancelAllResponse = await response.json()

      if (!response.ok || data.error) {
        setError(data.error || "Failed to cancel builds")
        return
      }

      setCancelResult(data)
      setShowConfirm(false)

      // Refresh the list after cancellation
      await fetchQueuedBuilds()
    } catch (err) {
      console.error("Error cancelling builds:", err)
      setError("Error cancelling builds. Please try again.")
    } finally {
      setCancelling(false)
    }
  }

  const totalBuilds = builds.length + longRunningBuilds.length

  if (loading) {
    return (
      <wa-card>
        <div class="wa-stack wa-gap-s wa-align-items-center" style="padding: var(--wa-space-l)">
          <wa-spinner style="font-size: 2rem; color: var(--wa-color-brand-fill-loud)" />
          <p class="wa-body-m wa-color-text-quiet">Loading builds...</p>
        </div>
      </wa-card>
    )
  }

  return (
    <wa-card>
      <div class="wa-stack wa-gap-m" style="padding: var(--wa-space-m)">
        <div class="wa-flank wa-gap-m">
          <div class="wa-stack wa-gap-xs" style="flex: 1">
            <h2 class="wa-heading-m">Cancel Builds</h2>
            <p class="wa-body-s wa-color-text-quiet">
              {totalBuilds === 0
                ? "No builds to cancel."
                : `${builds.length} queued, ${longRunningBuilds.length} long-running (>3h)`}
            </p>
          </div>

          {totalBuilds > 0 && (
            <wa-button
              variant="danger"
              appearance="filled"
              disabled={cancelling}
              onClick={() => {
                setCancelTarget("all")
                setShowConfirm(true)
              }}
            >
              <wa-icon
                slot="prefix"
                name={cancelling ? "spinner" : "x-circle"}
                style={cancelling ? "animation: spin 1s linear infinite;" : ""}
              />
              {cancelling ? "Cancelling..." : `Cancel All (${totalBuilds})`}
            </wa-button>
          )}
        </div>

        {error && (
          <wa-callout variant="danger">
            <wa-icon slot="icon" name="error" />
            {error}
          </wa-callout>
        )}

        {cancelResult && (
          <wa-callout variant={cancelResult.failed > 0 ? "warning" : "positive"}>
            <wa-icon slot="icon" name={cancelResult.failed > 0 ? "warning" : "check-circle"} />
            <div class="wa-stack wa-gap-xs">
              <div>
                Cancelled {cancelResult.cancelled} of {cancelResult.totalQueued} builds
                {cancelResult.failed > 0 && ` (${cancelResult.failed} failed)`}
              </div>
              {cancelResult.failed > 0 && (
                <div class="wa-caption-s">
                  {cancelResult.results
                    .filter((r) => !r.success)
                    .map((r) => (
                      <div key={r.buildId}>
                        {r.pipelineName} #{r.buildNumber}: {r.error}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </wa-callout>
        )}

        {builds.length > 0 && (
          <div class="wa-stack wa-gap-xs">
            <div class="wa-flank wa-gap-s">
              <h3 class="wa-heading-s">Queued Builds ({builds.length})</h3>
              <wa-button
                variant="danger"
                appearance="outlined"
                size="small"
                onClick={() => {
                  setCancelTarget("queued")
                  setShowConfirm(true)
                }}
              >
                Cancel Queued
              </wa-button>
            </div>
            <div class="wa-stack wa-gap-2xs">
              {builds.map((build) => (
                <div
                  key={build.id}
                  class="wa-flank wa-gap-s"
                  style="padding: var(--wa-space-xs); background: var(--wa-color-neutral-surface-quiet); border-radius: var(--wa-border-radius-m)"
                >
                  <div class="wa-stack wa-gap-3xs" style="flex: 1">
                    <div class="wa-body-s">
                      <a
                        href={`/pipelines/${build.pipeline.slug}/builds/${build.number}`}
                        class="wa-link"
                      >
                        {build.pipeline.name} #{build.number}
                      </a>
                    </div>
                    <div class="wa-caption-xs wa-color-text-quiet">
                      <wa-icon name="git-branch" style="margin-right: var(--wa-space-3xs); vertical-align: middle" />
                      {build.branch || "unknown"}
                    </div>
                  </div>
                  <wa-badge variant="warning">scheduled</wa-badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {longRunningBuilds.length > 0 && (
          <div class="wa-stack wa-gap-xs">
            <div class="wa-flank wa-gap-s">
              <h3 class="wa-heading-s">Long-Running Builds ({longRunningBuilds.length})</h3>
              <wa-button
                variant="danger"
                appearance="outlined"
                size="small"
                onClick={() => {
                  setCancelTarget("long-running")
                  setShowConfirm(true)
                }}
              >
                Cancel Long-Running
              </wa-button>
            </div>
            <p class="wa-caption-s wa-color-text-quiet">
              Builds running for more than 3 hours
            </p>
            <div class="wa-stack wa-gap-2xs">
              {longRunningBuilds.map((build) => (
                <div
                  key={build.id}
                  class="wa-flank wa-gap-s"
                  style="padding: var(--wa-space-xs); background: var(--wa-color-warning-surface-quiet); border-radius: var(--wa-border-radius-m)"
                >
                  <div class="wa-stack wa-gap-3xs" style="flex: 1">
                    <div class="wa-body-s">
                      <a
                        href={`/pipelines/${build.pipeline.slug}/builds/${build.number}`}
                        class="wa-link"
                      >
                        {build.pipeline.name} #{build.number}
                      </a>
                    </div>
                    <div class="wa-caption-xs wa-color-text-quiet">
                      <wa-icon name="git-branch" style="margin-right: var(--wa-space-3xs); vertical-align: middle" />
                      {build.branch || "unknown"}
                      {build.started_at && (
                        <>
                          {" · "}
                          <wa-icon name="clock" style="margin-right: var(--wa-space-3xs); vertical-align: middle" />
                          Running for {formatDuration(build.started_at)}
                        </>
                      )}
                    </div>
                  </div>
                  <wa-badge variant="danger">running</wa-badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {showConfirm && (
          <wa-dialog open header="Confirm Cancellation" onWaHide={() => setShowConfirm(false)}>
            <div class="wa-stack wa-gap-m">
              <p class="wa-body-m">
                {cancelTarget === "all" && <>Are you sure you want to cancel all {totalBuilds} builds?</>}
                {cancelTarget === "queued" && <>Are you sure you want to cancel all {builds.length} queued builds?</>}
                {cancelTarget === "long-running" && (
                  <>Are you sure you want to cancel all {longRunningBuilds.length} long-running builds?</>
                )}
              </p>
              <p class="wa-body-s wa-color-text-quiet">
                This action cannot be undone.
              </p>
            </div>
            <div slot="footer" class="wa-cluster wa-gap-s wa-justify-content-end">
              <wa-button
                variant="neutral"
                appearance="outlined"
                onClick={() => setShowConfirm(false)}
              >
                Cancel
              </wa-button>
              <wa-button
                variant="danger"
                appearance="filled"
                onClick={handleCancelAll}
                disabled={cancelling}
              >
                <wa-icon
                  slot="prefix"
                  name={cancelling ? "spinner" : "x-circle"}
                  style={cancelling ? "animation: spin 1s linear infinite;" : ""}
                />
                {cancelling ? "Cancelling..." : "Yes, Cancel"}
              </wa-button>
            </div>
          </wa-dialog>
        )}
      </div>
    </wa-card>
  )
}
