/// <reference path="../types/webawesome.d.ts" />
import { useEffect, useState } from "preact/hooks"
import { useLocalization } from "~/utils/localization-context.tsx"
import { buildkiteClient, GET_PIPELINE_BUILDS } from "~/utils/buildkite-client.ts"
import { formatTimeAgo, getBadgeVariant, getStatusIcon } from "~/utils/formatters.ts"

interface BuildHistoryTooltipProps {
  pipelineSlug: string
  children: React.ReactNode
}

interface BuildInfo {
  number: number
  state: string
  createdAt: string
  message?: string
  branch?: string
}

export default function BuildHistoryTooltip({ pipelineSlug, children }: BuildHistoryTooltipProps) {
  const { t } = useLocalization()
  const [builds, setBuilds] = useState<BuildInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  const fetchBuildHistory = async () => {
    if (builds.length > 0) return // Already fetched

    setIsLoading(true)
    try {
      const fullPipelineSlug = `divvun/${pipelineSlug}`
      const result = await buildkiteClient.query(GET_PIPELINE_BUILDS, {
        pipelineSlug: fullPipelineSlug,
        first: 5, // Get last 5 builds
      }).toPromise()

      if (result.data?.pipeline?.builds?.edges) {
        const buildData = result.data.pipeline.builds.edges
          .map((edge) => edge.node)
          .map((build) => ({
            number: build.number,
            state: build.state,
            createdAt: build.createdAt,
            message: build.message,
            branch: build.branch,
          }))
        setBuilds(buildData)
      }
    } catch (error) {
      console.error("Failed to fetch build history:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleMouseEnter = () => {
    setIsVisible(true)
    fetchBuildHistory()
  }

  const handleMouseLeave = () => {
    setIsVisible(false)
  }

  return (
    <div
      class="build-history-tooltip-container"
      style="position: relative; display: inline-block; width: 100%"
    >
      {children}

      {false && isVisible && (
        <div
          class="build-history-tooltip"
          style={{
            position: "absolute",
            top: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            marginTop: "8px",
            padding: "var(--wa-space-s)",
            background: "var(--wa-color-surface-elevated)",
            border: "1px solid var(--wa-color-border-subtle)",
            borderRadius: "var(--wa-border-radius-s)",
            boxShadow: "var(--wa-shadow-l)",
            minWidth: "300px",
            maxWidth: "400px",
          }}
        >
          <div class="wa-stack wa-gap-xs">
            <div class="wa-caption-s wa-color-text-quiet">{t("recent-builds-title")}</div>

            {isLoading
              ? (
                <div class="wa-cluster wa-gap-xs wa-align-items-center">
                  <wa-icon name="spinner" style="animation: spin 1s linear infinite; font-size: 0.8rem" />
                  <span class="wa-caption-xs">{t("loading-ellipsis")}</span>
                </div>
              )
              : builds.length > 0
              ? (
                <div class="wa-stack wa-gap-2xs">
                  {builds.map((build) => (
                    <div
                      key={build.number}
                      class="wa-flank wa-gap-xs"
                      style="padding: var(--wa-space-2xs); border-radius: var(--wa-border-radius-xs); background: var(--wa-color-surface-subtle)"
                    >
                      <div class="wa-cluster wa-gap-xs wa-align-items-center">
                        <wa-icon
                          name={getStatusIcon(build.state)}
                          style={`color: var(--wa-color-${getBadgeVariant(build.state)}-fill-loud); font-size: 0.8rem`}
                        />
                        <span class="wa-caption-xs wa-color-text-loud">#{build.number}</span>
                        <wa-badge variant={getBadgeVariant(build.state)} size="small">
                          {build.state}
                        </wa-badge>
                      </div>
                      <div class="wa-stack wa-gap-3xs" style="flex: 1; min-width: 0">
                        {build.message && (
                          <div
                            class="wa-caption-xs"
                            style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap"
                          >
                            {build.message}
                          </div>
                        )}
                        <div class="wa-cluster wa-gap-s">
                          {build.branch && (
                            <div class="wa-caption-xs wa-color-text-quiet">
                              <wa-icon name="code-branch" style="margin-right: 2px; font-size: 0.7rem" />
                              {build.branch}
                            </div>
                          )}
                          <div class="wa-caption-xs wa-color-text-quiet">
                            {formatTimeAgo(build.createdAt)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
              : <div class="wa-caption-xs wa-color-text-quiet">{t("no-recent-builds")}</div>}
          </div>

          {/* Tooltip arrow */}
          <div
            style={{
              position: "absolute",
              top: "-6px",
              left: "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderBottom: "6px solid var(--wa-color-border-subtle)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "-5px",
              left: "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderBottom: "5px solid var(--wa-color-surface-elevated)",
            }}
          />
        </div>
      )}

      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  )
}
