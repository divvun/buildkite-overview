import { useEffect, useState } from "preact/hooks"
import { useLocalization } from "~/utils/localization-context.tsx"
import { ANSI_CSS, processLogsIntoGroups, segmentsToElements } from "~/utils/log-processing.tsx"

interface JobLogsProps {
  jobId: string
  buildNumber: number | null
  pipelineSlug: string | null
}

interface LogData {
  url?: string
  content?: string
  contentType?: string
  error?: string
}

export default function JobLogs({ jobId, buildNumber, pipelineSlug }: JobLogsProps) {
  const { t } = useLocalization()
  const [logData, setLogData] = useState<LogData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>("")
  const [expanded, setExpanded] = useState(true)
  const [showTimestamps, setShowTimestamps] = useState(false)
  const [showLineNumbers, setShowLineNumbers] = useState(true)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set())
  const [processedGroups, setProcessedGroups] = useState<ReturnType<typeof processLogsIntoGroups>>([])

  useEffect(() => {
    if (logData?.content) {
      const groups = processLogsIntoGroups(logData.content)
      setProcessedGroups(groups)

      // Initialize collapsed state
      const initialCollapsed = new Set<number>()
      groups.forEach((group) => {
        if (group.initiallyCollapsed && !group.openPrevious) {
          initialCollapsed.add(group.id)
        }
      })
      setCollapsedGroups(initialCollapsed)
    }
  }, [logData?.content])

  useEffect(() => {
    // Auto-fetch logs when component mounts
    if (jobId && buildNumber && pipelineSlug) {
      fetchLogs()
    }
  }, [jobId, buildNumber, pipelineSlug])

  const fetchLogs = async () => {
    if (!buildNumber || !pipelineSlug) {
      setError(t("missing-build-info"))
      return
    }

    try {
      setLoading(true)
      setError("")

      const params = new URLSearchParams({
        build: buildNumber.toString(),
        pipeline: pipelineSlug,
      })

      const response = await fetch(`/api/jobs/${jobId}/logs?${params}`)
      const data = await response.json()

      if (!response.ok || data.error) {
        setError(data.error || t("failed-to-fetch-logs"))
        return
      }

      setLogData(data)
    } catch (err) {
      console.error("Error fetching logs:", err)
      setError(t("error-fetching-logs"))
    } finally {
      setLoading(false)
    }
  }

  const downloadLogs = () => {
    if (!logData?.content) return

    // Create filename with job context
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-")
    const filename = pipelineSlug && buildNumber
      ? `${pipelineSlug}-build-${buildNumber}-job-${jobId.slice(-8)}-${timestamp}.txt`
      : `buildkite-job-logs-${timestamp}.txt`

    // Create blob and download
    const blob = new Blob([logData.content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)

    const a = document.createElement("a")
    a.href = url
    a.download = filename
    if (a.style instanceof CSSStyleDeclaration) {
      a.style.display = "none"
    }
    document.body.appendChild(a)
    a.click()

    // Cleanup
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const toggleGroup = (groupId: number) => {
    setCollapsedGroups((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(groupId)) {
        newSet.delete(groupId)
      } else {
        newSet.add(groupId)
      }
      return newSet
    })
  }

  return (
    <div class="wa-stack wa-gap-xs">
      <style>
        {ANSI_CSS}
      </style>
      <div class="wa-flank">
        {logData?.url && (
          <wa-button size="small" appearance="plain">
            <wa-icon slot="prefix" name="arrow-up-right-from-square" />
            <a href={logData.url} target="_blank" style="text-decoration: none; color: inherit">
              View Raw
            </a>
          </wa-button>
        )}
      </div>

      {expanded && (
        <div
          class="log-container"
          style="border: 1px solid var(--wa-color-border-subtle); border-radius: var(--wa-border-radius-s); background: var(--wa-color-neutral-fill-subtle)"
        >
          {loading && (
            <div class="wa-stack wa-gap-s wa-align-items-center" style="padding: var(--wa-space-m)">
              <wa-icon name="spinner" style="color: var(--wa-color-brand-fill-loud)" />
              <p class="wa-caption-s wa-color-text-quiet">{t("loading-logs")}</p>
            </div>
          )}

          {error && (
            <div style="padding: var(--wa-space-s)">
              <wa-callout variant="warning" size="small">
                <wa-icon slot="icon" name="triangle-exclamation" />
                {error}
                {logData?.url && (
                  <div>
                    You can view the logs directly in{" "}
                    <a href={logData.url} target="_blank" rel="noopener noreferrer" class="wa-cluster wa-gap-xs">
                      Buildkite
                      <wa-icon name="arrow-up-right-from-square" style="font-size: 0.75em"></wa-icon>
                    </a>
                  </div>
                )}
              </wa-callout>
            </div>
          )}

          {logData?.content && !loading && (
            <div class="wa-stack wa-gap-xs">
              <div
                class="wa-flank wa-gap-s"
                style="padding: var(--wa-space-xs) var(--wa-space-s); border-bottom: 1px solid var(--wa-color-border-subtle); background: var(--wa-color-neutral-fill-quiet)"
              >
                <div class="wa-caption-xs wa-color-text-quiet">
                  {t("job-logs-size", { size: Math.ceil(logData.content.length / 1024) })}
                </div>
                <div class="wa-cluster wa-gap-xs">
                  <wa-button
                    size="small"
                    appearance="plain"
                    onClick={() => setShowTimestamps(!showTimestamps)}
                  >
                    <wa-icon slot="prefix" name="clock" />
                    {showTimestamps ? t("hide-timestamps") : t("show-timestamps")} {t("timestamps")}
                  </wa-button>
                  <wa-button
                    size="small"
                    appearance="plain"
                    onClick={() => setShowLineNumbers(!showLineNumbers)}
                  >
                    <wa-icon slot="prefix" name="list-ol" />
                    {showLineNumbers ? t("hide-line-numbers") : t("show-line-numbers")}
                  </wa-button>
                  <wa-button size="small" appearance="plain">
                    <wa-icon slot="prefix" name="copy" />
                    {t("copy")}
                  </wa-button>
                  <wa-button
                    size="small"
                    appearance="plain"
                    onClick={() => downloadLogs()}
                  >
                    <wa-icon slot="prefix" name="download" />
                    {t("download")}
                  </wa-button>
                  <wa-button
                    size="small"
                    appearance="plain"
                    onClick={() => {
                      const fullscreenUrl = `/pipelines/${pipelineSlug}/builds/${buildNumber}/jobs/${jobId}/logs`
                      window.open(fullscreenUrl, "_blank", "width=1200,height=800")
                    }}
                  >
                    <wa-icon slot="prefix" name="expand" />
                    {t("expand")}
                  </wa-button>
                </div>
              </div>

              <div
                class="log-table-container"
                style="
                  max-height: 400px;
                  overflow-y: auto;
                  background: #0d1117;
                  border: 1px solid #30363d;
                "
              >
                <table
                  class="log-table"
                  style="
                    width: 100%;
                    border-collapse: collapse;
                    font-family: ui-monospace, 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
                    font-size: 0.875rem;
                    line-height: 1.4;
                    background: #0d1117;
                    color: #f8f8f2;
                  "
                >
                  <tbody>
                    {processedGroups.map((group) => {
                      const isCollapsed = collapsedGroups.has(group.id)
                      const groupStyle = group.type === "muted" ? { opacity: 0.7 } : {}

                      const rows = []

                      // Add group header row if group has a name
                      if (group.name) {
                        rows.push(
                          <tr key={`header-${group.id}`}>
                            <td
                              colSpan={(showLineNumbers ? 1 : 0) + (showTimestamps ? 1 : 0) + 1}
                              style="
                                padding: 4px 8px;
                                background: #161b22;
                                border-bottom: 1px solid #30363d;
                                cursor: pointer;
                                user-select: none;
                                font-weight: 500;
                                color: #f8f8f2;
                              "
                              onClick={() => toggleGroup(group.id)}
                            >
                              <div class="wa-flank wa-gap-xs" style={groupStyle}>
                                <wa-icon
                                  name={isCollapsed ? "chevron-right" : "chevron-down"}
                                  style="color: var(--wa-color-text-quiet)"
                                />
                                <span>
                                  {segmentsToElements(group.nameSegments)}
                                </span>
                              </div>
                            </td>
                          </tr>,
                        )
                      }

                      // Add content rows if not collapsed
                      if (!isCollapsed) {
                        group.lines.forEach((logLine, lineIndex) => {
                          rows.push(
                            <tr key={`${group.id}-${lineIndex}`} style={groupStyle}>
                              {showLineNumbers && (
                                <td
                                  class="log-line-number"
                                  style="
                                    width: 60px;
                                    text-align: right;
                                    color: #7d8590;
                                    padding: 2px 10px 2px 2px;
                                    user-select: none;
                                    vertical-align: top;
                                    border-right: 1px solid #30363d;
                                    background: #161b22;
                                    font-size: 0.8rem;
                                  "
                                >
                                  {logLine.lineNumber}
                                </td>
                              )}
                              {showTimestamps && (
                                <td
                                  class="log-timestamp"
                                  style="
                                    width: 160px;
                                    color: #7d8590;
                                    padding: 2px 10px;
                                    user-select: none;
                                    vertical-align: top;
                                    border-right: 1px solid #30363d;
                                    background: #0d1117;
                                    font-size: 0.8rem;
                                    white-space: nowrap;
                                  "
                                >
                                  {logLine.timestamp}
                                </td>
                              )}
                              <td
                                class="log-content"
                                style="
                                  padding: 2px 8px;
                                  white-space: pre-wrap;
                                  word-break: break-all;
                                  vertical-align: top;
                                  background: #0d1117;
                                  color: #f8f8f2;
                                "
                              >
                                {segmentsToElements(logLine.contentSegments)}
                              </td>
                            </tr>,
                          )
                        })
                      }

                      return rows
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!logData?.content && !loading && !error && (
            <div class="wa-stack wa-gap-s wa-align-items-center" style="padding: var(--wa-space-m)">
              <wa-icon name="file-lines" style="font-size: 1.5rem; color: var(--wa-color-neutral-fill-loud)" />
              <p class="wa-caption-s wa-color-text-quiet">{t("no-logs-available")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
