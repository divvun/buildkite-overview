import { useState } from "preact/hooks"
import { useLocalization } from "~/utils/localization-context.tsx"

interface NewBuildButtonProps {
  pipelineSlug: string
}

export default function NewBuildButton({ pipelineSlug }: NewBuildButtonProps) {
  const { t } = useLocalization()
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string>("")

  const handleCreateBuild = async () => {
    setIsCreating(true)
    setError("")

    try {
      // Get CSRF token from meta tag
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content")

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      }

      if (csrfToken) {
        headers["X-CSRF-Token"] = csrfToken
      }

      const response = await fetch(`/api/pipelines/${pipelineSlug}/builds/create`, {
        method: "POST",
        headers,
      })

      const data = await response.json()

      if (response.status === 401) {
        // Redirect to login
        window.location.href = "/auth/login"
        return
      }

      if (!response.ok || data.error) {
        setError(data.error || data.message || t("failed-to-create-build"))
        return
      }

      if (data.success && data.build) {
        // Redirect to the new build
        const buildUrl = `/pipelines/${pipelineSlug}/builds/${data.build.number}`
        window.location.href = buildUrl
      } else {
        setError(t("failed-to-create-build"))
      }
    } catch (err) {
      console.error("Error creating build:", err)
      setError(t("error-creating-build"))
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div class="wa-stack wa-gap-xs">
      <div class="wa-cluster wa-gap-s">
        <wa-button
          variant="brand"
          appearance="outlined"
          disabled={isCreating}
          onClick={handleCreateBuild}
        >
          <wa-icon
            slot="prefix"
            name={isCreating ? "spinner" : "play"}
            style={isCreating ? "animation: spin 1s linear infinite;" : ""}
          />
          {isCreating ? t("creating-build") : t("new-build")}
        </wa-button>
      </div>

      {error && (
        <wa-callout variant="warning" size="small">
          <wa-icon slot="icon" name="error" />
          {error}
        </wa-callout>
      )}
    </div>
  )
}
