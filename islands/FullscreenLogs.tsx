import { useEffect, useState } from "preact/hooks"
import { useLocalization } from "~/utils/localization-context.tsx"
import { ANSI_CSS, processLogsIntoGroups, segmentsToElements } from "~/utils/log-processing.tsx"

interface LogData {
  url?: string
  content?: string
  contentType?: string
  error?: string
}

interface FullscreenLogsProps {
  jobId: string
  buildNumber: string
  pipelineSlug: string
  initialLogData?: LogData
  initialProcessedGroups?: ReturnType<typeof processLogsIntoGroups>
  initialError?: string
  jobCommand?: string
}

const MAX_VISIBLE_LINES = 250

export default function FullscreenLogs({
  jobId,
  buildNumber,
  pipelineSlug,
  initialLogData,
  initialProcessedGroups,
  initialError,
  jobCommand,
}: FullscreenLogsProps) {
  const { t } = useLocalization()

  const [logData, _setLogData] = useState<LogData | null>(initialLogData || null)
  const [error, _setError] = useState<string>(initialError || "")
  const [showTimestamps, setShowTimestamps] = useState(false)
  const [showLineNumbers, setShowLineNumbers] = useState(true)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set())
  const [visibleLinesPerGroup, setVisibleLinesPerGroup] = useState<Map<number, number>>(new Map())
  const [processedGroups, _setProcessedGroups] = useState<ReturnType<typeof processLogsIntoGroups>>(
    initialProcessedGroups || [],
  )

  useEffect(() => {
    // Initialize collapsed state and visible lines from processed groups
    if (processedGroups.length > 0) {
      const initialCollapsed = new Set<number>()
      const initialVisibleLines = new Map<number, number>()

      processedGroups.forEach((group) => {
        if (group.initiallyCollapsed && !group.openPrevious) {
          initialCollapsed.add(group.id)
        }
        // For groups with > MAX_VISIBLE_LINES lines, initially show only MAX_VISIBLE_LINES
        if (group.lines.length > MAX_VISIBLE_LINES) {
          initialVisibleLines.set(group.id, MAX_VISIBLE_LINES)
        }
      })

      setCollapsedGroups(initialCollapsed)
      setVisibleLinesPerGroup(initialVisibleLines)
    }
  }, [processedGroups])

  useEffect(() => {
    // Handle ESC key to close window/tab
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        globalThis.close()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

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
    a.setAttribute("style", "display: none")
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

  const showMoreLines = (groupId: number) => {
    setVisibleLinesPerGroup((prev) => {
      const newMap = new Map(prev)
      const currentVisible = newMap.get(groupId) || MAX_VISIBLE_LINES
      newMap.set(groupId, currentVisible + MAX_VISIBLE_LINES)
      return newMap
    })
  }

  const showAllLines = (groupId: number) => {
    setVisibleLinesPerGroup((prev) => {
      const newMap = new Map(prev)
      newMap.delete(groupId) // Remove the limit, show all lines
      return newMap
    })
  }

  return (
    <div class="fullscreen-container">
      <style>
        {`
          .fullscreen-container {
            height: 100vh;
            display: flex;
            flex-direction: column;
          }
          
          .toolbar {
            background: #161b22;
            border-bottom: 1px solid #30363d;
            padding: 8px 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-shrink: 0;
          }
          
          .toolbar-left {
            color: #7d8590;
            font-size: 0.85rem;
          }
          
          .toolbar-right {
            --wa-space-s: 0.25rem;
          }
          
          .log-content {
            flex: 1;
            overflow-y: auto;
            background: #0d1117;
          }
          
          .log-table {
            width: 100%;
            border-collapse: collapse;
            font-family: ui-monospace, 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
            font-size: 0.875rem;
            line-height: 1.4;
          }
          
          .log-line-number {
            width: 60px;
            text-align: right;
            color: #7d8590;
            padding: 2px 10px 2px 2px;
            user-select: none;
            vertical-align: top;
            border-right: 1px solid #30363d;
            background: #161b22;
            font-size: 0.8rem;
          }
          
          .log-timestamp {
            width: 160px;
            color: #7d8590;
            padding: 2px 10px;
            user-select: none;
            vertical-align: top;
            border-right: 1px solid #30363d;
            background: #0d1117;
            font-size: 0.8rem;
            white-space: nowrap;
          }
          
          .log-content-cell {
            padding: 2px 8px;
            white-space: pre-wrap;
            word-break: break-all;
            vertical-align: top;
            background: #0d1117;
            color: #f8f8f2;
          }
          
          .group-header {
            padding: 4px 8px;
            background: #161b22;
            border-bottom: 1px solid #30363d;
            cursor: pointer;
            user-select: none;
            font-weight: 500;
            color: #f8f8f2;
          }
          
          .group-header-content {
            display: flex;
            align-items: center;
            gap: 8px;
            width: 100%;
          }
          
          .group-header:hover {
            background: #21262d;
          }
          
          .chevron {
            transition: transform 0.1s ease;
          }
          
          .chevron.expanded {
            transform: rotate(90deg);
          }
          
          .muted {
            opacity: 0.7;
          }
          
          .error {
            background: #21262d;
            border: 1px solid #f85149;
            color: #f85149;
            padding: 16px;
            margin: 16px;
            border-radius: 6px;
          }
          
          .show-more-row {
            background: #0d1117;
          }
          
          .show-more-cell {
            padding: 12px 8px;
            text-align: center;
            background: #0d1117;
            border-top: 1px solid #30363d;
          }
          
          .show-more-buttons {
            display: flex;
            gap: 8px;
            justify-content: center;
            align-items: center;
            --wa-space-s: 0.25rem;
          }
          
          /* Responsive styles for mobile and tablet */
          @media (max-width: 768px) {
            .toolbar {
              padding: 6px 12px;
            }
            
            .toolbar-left {
              font-size: 0.8rem;
            }
            
            .toolbar-right {
              --wa-space-s: 0.2rem;
            }
            
            .log-table {
              font-size: 0.8rem;
            }
            
            .log-line-number {
              font-size: 0.75rem;
              width: 50px;
              padding: 2px 8px 2px 2px;
            }
            
            .log-timestamp {
              font-size: 0.75rem;
              width: 140px;
            }
          }
          
          @media (max-width: 640px) {
            .toolbar {
              flex-wrap: wrap;
              gap: 8px;
              padding: 8px;
            }
            
            .toolbar-left {
              font-size: 0.75rem;
              flex: 1 1 100%;
              margin-bottom: 4px;
            }
            
            .toolbar-right {
              --wa-space-s: 0.15rem;
              flex: 1 1 100%;
              justify-content: flex-end;
            }
            
            .log-table {
              font-size: 0.75rem;
            }
            
            .log-line-number {
              font-size: 0.7rem;
              width: 40px;
              padding: 1px 6px 1px 1px;
            }
            
            .log-timestamp {
              font-size: 0.7rem;
              width: 120px;
            }
            
            .log-content-cell {
              padding: 1px 6px;
            }
            
            .show-more-buttons {
              flex-direction: column;
              gap: 6px;
              --wa-space-s: 0.15rem;
            }
          }
          
          @media (max-width: 480px) {
            .toolbar-left {
              font-size: 0.7rem;
            }
            
            .toolbar-right {
              --wa-space-s: 0.1rem;
            }
            
            .log-line-number {
              width: 35px;
            }
            
            .log-timestamp {
              display: none;
            }
            
            .log-table {
              font-size: 0.7rem;
            }
            
            .show-more-cell {
              padding: 8px 4px;
            }
            
            .show-more-buttons {
              gap: 4px;
              --wa-space-s: 0.1rem;
            }
          }
          
          ${ANSI_CSS}
        `}
      </style>

      <div class="toolbar">
        <div class="toolbar-left">
          {jobCommand || t("job-logs")} - {pipelineSlug}#{buildNumber}
          {logData?.content && ` (${Math.ceil(logData.content.length / 1024)} kB)`}
        </div>
        <div class="toolbar-right wa-cluster">
          {logData?.url && (
            <wa-button variant="neutral" appearance="outlined" href={logData.url} target="_blank">
              <wa-icon name="arrow-up-right-from-square" label={t("view-raw")}></wa-icon>
            </wa-button>
          )}
          <wa-button
            size="small"
            variant="neutral"
            appearance="outlined"
            onClick={() => setShowTimestamps(!showTimestamps)}
          >
            <wa-icon name="clock" label={showTimestamps ? t("hide-timestamps") : t("show-timestamps")}></wa-icon>
          </wa-button>
          <wa-button
            size="small"
            variant="neutral"
            appearance="outlined"
            onClick={() => setShowLineNumbers(!showLineNumbers)}
          >
            <wa-icon name="hashtag" label={showLineNumbers ? t("hide-line-numbers") : t("show-line-numbers")}></wa-icon>
          </wa-button>
          <wa-button
            size="small"
            variant="neutral"
            appearance="outlined"
            onClick={() => downloadLogs()}
          >
            <wa-icon name="download" label={t("download")}></wa-icon>
          </wa-button>
          <wa-button
            size="small"
            variant="neutral"
            appearance="outlined"
            onClick={() => globalThis.close()}
          >
            <wa-icon name="xmark" label={t("close")}></wa-icon>
          </wa-button>
        </div>
      </div>

      <div class="log-content">
        {error && (
          <div class="error">
            {error}
            {logData?.url && (
              <div style="margin-top: 8px">
                You can view the logs directly in{" "}
                <a href={logData.url} target="_blank" rel="noopener noreferrer" style="color: inherit">
                  Buildkite ↗
                </a>
              </div>
            )}
          </div>
        )}

        {processedGroups.length > 0 && (
          <table class="log-table">
            <tbody>
              {processedGroups.map((group) => {
                // Determine if collapsed either from state or initial server state
                const isCollapsed = collapsedGroups.has(group.id) ||
                  (collapsedGroups.size === 0 && group.initiallyCollapsed && !group.openPrevious)
                const groupStyle = group.type === "muted" ? "muted" : ""

                const rows = []

                // Add group header row if group has a name
                if (group.name) {
                  rows.push(
                    <tr key={`header-${group.id}`}>
                      <td
                        colSpan={(showLineNumbers ? 1 : 0) + (showTimestamps ? 1 : 0) + 1}
                        class={`group-header ${groupStyle}`}
                        onClick={() => toggleGroup(group.id)}
                      >
                        <div class="group-header-content" style="font-weight: bold">
                          <wa-icon
                            name="chevron-right"
                            class={`chevron ${isCollapsed ? "" : "expanded"}`}
                          >
                          </wa-icon>
                          <span>
                            {segmentsToElements(group.nameSegments)}
                          </span>
                        </div>
                      </td>
                    </tr>,
                  )
                }

                // Determine how many lines to show for this group
                const maxVisibleLines = visibleLinesPerGroup.get(group.id)
                const linesToShow = maxVisibleLines ? group.lines.slice(0, maxVisibleLines) : group.lines
                const hasMoreLines = maxVisibleLines && group.lines.length > maxVisibleLines
                const remainingLines = hasMoreLines ? group.lines.length - maxVisibleLines : 0

                // Always render visible content rows, but use CSS to hide when collapsed
                linesToShow.forEach((logLine, lineIndex) => {
                  rows.push(
                    <tr
                      key={`${group.id}-${lineIndex}`}
                      class={groupStyle}
                      style={{ display: isCollapsed ? "none" : "table-row" }}
                    >
                      {showLineNumbers && (
                        <td class="log-line-number">
                          {logLine.lineNumber}
                        </td>
                      )}
                      {showTimestamps && (
                        <td class="log-timestamp">
                          {logLine.timestamp}
                        </td>
                      )}
                      <td class="log-content-cell">
                        {segmentsToElements(logLine.contentSegments)}
                      </td>
                    </tr>,
                  )
                })

                // Add "Show More" button if there are more lines to show
                if (hasMoreLines && !isCollapsed) {
                  rows.push(
                    <tr key={`show-more-${group.id}`} class="show-more-row">
                      <td
                        colSpan={(showLineNumbers ? 1 : 0) + (showTimestamps ? 1 : 0) + 1}
                        class="show-more-cell"
                      >
                        <div class="show-more-buttons">
                          <wa-button
                            size="small"
                            variant="neutral"
                            appearance="outlined"
                            onClick={() => showMoreLines(group.id)}
                          >
                            Show {Math.min(MAX_VISIBLE_LINES, remainingLines)} more lines ({remainingLines} remaining)
                          </wa-button>
                          {remainingLines > MAX_VISIBLE_LINES && (
                            <wa-button
                              size="small"
                              variant="neutral"
                              appearance="outlined"
                              onClick={() => showAllLines(group.id)}
                            >
                              Show all {remainingLines} remaining
                            </wa-button>
                          )}
                        </div>
                      </td>
                    </tr>,
                  )
                }

                return rows
              })}
            </tbody>
          </table>
        )}

        {processedGroups.length === 0 && !error && (
          <div style="display: flex; align-items: center; justify-content: center; height: 200px; color: #7d8590;">
            <div>{t("no-logs-available")}</div>
          </div>
        )}
      </div>
    </div>
  )
}
