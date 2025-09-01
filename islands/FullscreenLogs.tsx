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
  initialProcessedGroups?: ReturnType<typeof processLogsIntoGroups>["groups"]
  initialFocusGroupId?: number | null
  initialFocusLineNumber?: number | null
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
  initialFocusGroupId,
  initialFocusLineNumber,
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
  const [visibleLinesOffset, setVisibleLinesOffset] = useState<Map<number, number>>(new Map())
  const [processedGroups, _setProcessedGroups] = useState<ReturnType<typeof processLogsIntoGroups>["groups"]>(
    initialProcessedGroups || [],
  )
  const [focusGroupId] = useState<number | null>(initialFocusGroupId || null)
  const [focusLineNumber] = useState<number | null>(initialFocusLineNumber || null)

  // Auto-scroll to focused warning line after render (fallback to group if no specific line)
  useEffect(() => {
    if (processedGroups.length > 0) {
      setTimeout(() => {
        let targetElement = null

        // First try to scroll to specific warning line
        if (focusLineNumber !== null) {
          targetElement = document.querySelector(`[data-warning-line="${focusLineNumber}"]`)
        }

        // Fallback to group header if no specific line found
        if (!targetElement && focusGroupId !== null) {
          targetElement = document.querySelector(`[data-group-id="${focusGroupId}"]`)
        }

        if (targetElement) {
          targetElement.scrollIntoView({
            behavior: "smooth",
            block: "center",
          })
        }
      }, 100) // Small delay to ensure rendering is complete
    }
  }, [focusLineNumber, focusGroupId, processedGroups])

  useEffect(() => {
    // Initialize collapsed state and visible lines from processed groups
    if (processedGroups.length > 0) {
      const initialCollapsed = new Set<number>()
      const initialVisibleLines = new Map<number, number>()
      const initialVisibleOffsets = new Map<number, number>()

      processedGroups.forEach((group) => {
        if (group.initiallyCollapsed && !group.openPrevious) {
          initialCollapsed.add(group.id)
        }

        // For groups with > MAX_VISIBLE_LINES lines, check if we need to adjust window for warning line
        if (group.lines.length > MAX_VISIBLE_LINES) {
          // Check if this group contains the warning line
          const warningLineIndex = group.lines.findIndex((line) => line.hasWarningMarker)

          if (warningLineIndex !== -1) {
            // Warning line found in this group - calculate smart window
            const contextBefore = 100 // Show 100 lines before the warning

            // Calculate start index for the window
            const startIndex = Math.max(0, warningLineIndex - contextBefore)
            const endIndex = Math.min(group.lines.length, startIndex + MAX_VISIBLE_LINES)

            // Adjust start if we hit the end boundary
            const adjustedStart = Math.max(0, endIndex - MAX_VISIBLE_LINES)
            const actualCount = Math.min(MAX_VISIBLE_LINES, group.lines.length - adjustedStart)

            // Set custom visible range for this group
            initialVisibleLines.set(group.id, actualCount)
            initialVisibleOffsets.set(group.id, adjustedStart)

            console.log(
              `Group ${group.id} has warning line at index ${warningLineIndex}, showing lines ${adjustedStart}-${
                adjustedStart + actualCount - 1
              }`,
            )
          } else {
            // No warning line, use standard window
            initialVisibleLines.set(group.id, MAX_VISIBLE_LINES)
            initialVisibleOffsets.set(group.id, 0)
          }
        }
      })

      setCollapsedGroups(initialCollapsed)
      setVisibleLinesPerGroup(initialVisibleLines)
      setVisibleLinesOffset(initialVisibleOffsets)
    }
  }, [processedGroups, focusLineNumber])

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

  const showPreviousLines = (groupId: number) => {
    const currentOffset = visibleLinesOffset.get(groupId) || 0
    const newOffset = Math.max(0, currentOffset - MAX_VISIBLE_LINES)

    setVisibleLinesOffset((prev) => {
      const newMap = new Map(prev)
      newMap.set(groupId, newOffset)
      return newMap
    })

    // Ensure we show at least MAX_VISIBLE_LINES
    setVisibleLinesPerGroup((prev) => {
      const newMap = new Map(prev)
      newMap.set(groupId, MAX_VISIBLE_LINES)
      return newMap
    })
  }

  const showNextLines = (groupId: number) => {
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
    setVisibleLinesOffset((prev) => {
      const newMap = new Map(prev)
      newMap.delete(groupId) // Remove the offset, show from beginning
      return newMap
    })
  }

  return (
    <div class="fullscreen-container">
      <style>
        {`
          .fullscreen-container {
            /* Use calc to account for safe area insets */
            height: calc(100vh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
            height: calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)); /* Dynamic viewport height for mobile browsers that support it */
            display: flex;
            flex-direction: column;
            /* Add safe area padding to prevent content from being cut off */
            padding-top: env(safe-area-inset-top, 0px);
            padding-left: env(safe-area-inset-left, 0px);
            padding-right: env(safe-area-inset-right, 0px);
            padding-bottom: env(safe-area-inset-bottom, 0px);
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
          
          /* Fix button contrast for better readability on dark background */
          wa-button[variant="neutral"][appearance="outlined"] {
            --wa-color-neutral-border: #6e7681 !important;
            --wa-color-neutral-text: #f0f6fc !important;
            color: #f0f6fc !important;
          }
          
          wa-button[variant="neutral"][appearance="outlined"]:hover {
            --wa-color-neutral-border: #f0f6fc !important;
            --wa-color-neutral-text: #24292f !important;
            color: #24292f !important;
            background-color: #f0f6fc !important;
          }
          
          /* Ensure icons in buttons also have proper contrast */
          wa-button[variant="neutral"][appearance="outlined"] wa-icon {
            color: #f0f6fc !important;
          }
          
          wa-button[variant="neutral"][appearance="outlined"]:hover wa-icon {
            color: #24292f !important;
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
              <wa-icon name="link-external" label={t("view-raw")}></wa-icon>
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
            <wa-icon name="x" label={t("close")}></wa-icon>
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
                    <tr
                      key={`header-${group.id}`}
                      data-group-id={group.id}
                    >
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

                // Determine how many lines to show for this group and from which offset
                const maxVisibleLines = visibleLinesPerGroup.get(group.id)
                const offset = visibleLinesOffset.get(group.id) || 0
                const linesToShow = maxVisibleLines ? group.lines.slice(offset, offset + maxVisibleLines) : group.lines
                const hasMoreLines = maxVisibleLines && (offset + maxVisibleLines < group.lines.length)
                const remainingLines = hasMoreLines ? group.lines.length - (offset + maxVisibleLines) : 0
                const hiddenLinesAtStart = offset

                // Add "Show Previous" button at the TOP if there are hidden lines at the start
                if (hiddenLinesAtStart > 0 && !isCollapsed) {
                  rows.push(
                    <tr key={`show-previous-${group.id}`} class="show-more-row">
                      <td
                        colSpan={(showLineNumbers ? 1 : 0) + (showTimestamps ? 1 : 0) + 1}
                        class="show-more-cell"
                      >
                        <div class="show-more-buttons">
                          <wa-button
                            size="small"
                            variant="neutral"
                            appearance="outlined"
                            onClick={() => showPreviousLines(group.id)}
                          >
                            ↑ Show previous {Math.min(MAX_VISIBLE_LINES, hiddenLinesAtStart)} lines
                          </wa-button>
                        </div>
                      </td>
                    </tr>,
                  )
                }

                // Always render visible content rows, but use CSS to hide when collapsed
                linesToShow.forEach((logLine, lineIndex) => {
                  rows.push(
                    <tr
                      key={`${group.id}-${lineIndex}`}
                      class={groupStyle}
                      style={{ display: isCollapsed ? "none" : "table-row" }}
                      {...(logLine.hasWarningMarker ? { "data-warning-line": logLine.lineNumber } : {})}
                    >
                      {showLineNumbers && (
                        <td
                          class="log-line-number"
                          style={`color: ${
                            logLine.hasWarningMarker ? "var(--wa-color-warning-fill-loud)" : "#7d8590"
                          };`}
                        >
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

                // Add "Show More" button at the BOTTOM if there are more lines to show
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
                            onClick={() => showNextLines(group.id)}
                          >
                            Show next {Math.min(MAX_VISIBLE_LINES, remainingLines)} lines ↓
                          </wa-button>
                          <wa-button
                            size="small"
                            variant="neutral"
                            appearance="outlined"
                            onClick={() => showAllLines(group.id)}
                          >
                            Show all {group.lines.length} lines
                          </wa-button>
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
