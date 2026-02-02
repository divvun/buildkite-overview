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

export default function CancelQueuedBuilds() {
  const { t } = useLocalization()
  const [builds, setBuilds] = useState<BuildkiteBuildRest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>("")
  const [showConfirm, setShowConfirm] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelResult, setCancelResult] = useState<CancelAllResponse | null>(null)

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
    } catch (err) {
      console.error("Error fetching queued builds:", err)
      setError("Unable to load queued builds. Please try again later.")
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

  if (loading) {
    return (
      <wa-card>
        <div class="wa-stack wa-gap-s wa-align-items-center" style="padding: var(--wa-space-l)">
          <wa-spinner style="font-size: 2rem; color: var(--wa-color-brand-fill-loud)" />
          <p class="wa-body-m wa-color-text-quiet">Loading queued builds...</p>
        </div>
      </wa-card>
    )
  }

  return (
    <wa-card>
      <div class="wa-stack wa-gap-m" style="padding: var(--wa-space-m)">
        <div class="wa-flank wa-gap-m">
          <div class="wa-stack wa-gap-xs" style="flex: 1">
            <h2 class="wa-heading-m">Cancel Queued Builds</h2>
            <p class="wa-body-s wa-color-text-quiet">
              {builds.length === 0
                ? "No builds are currently queued."
                : `${builds.length} build${builds.length === 1 ? " is" : "s are"} currently queued.`}
            </p>
          </div>

          {builds.length > 0 && (
            <wa-button
              variant="danger"
              appearance="filled"
              disabled={cancelling}
              onClick={() => setShowConfirm(true)}
            >
              <wa-icon
                slot="prefix"
                name={cancelling ? "spinner" : "x-circle"}
                style={cancelling ? "animation: spin 1s linear infinite;" : ""}
              />
              {cancelling ? "Cancelling..." : "Cancel All Queued"}
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
            <h3 class="wa-heading-s">Queued Builds</h3>
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

        {showConfirm && (
          <wa-dialog open header="Confirm Cancellation" onWaHide={() => setShowConfirm(false)}>
            <div class="wa-stack wa-gap-m">
              <p class="wa-body-m">
                Are you sure you want to cancel all {builds.length} queued build{builds.length === 1 ? "" : "s"}?
              </p>
              <p class="wa-body-s wa-color-text-quiet">
                This action cannot be undone. All scheduled builds will be cancelled immediately.
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
                {cancelling ? "Cancelling..." : "Yes, Cancel All"}
              </wa-button>
            </div>
          </wa-dialog>
        )}
      </div>
    </wa-card>
  )
}
