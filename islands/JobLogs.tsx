import { useEffect, useState } from "preact/hooks"

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
  const [logData, setLogData] = useState<LogData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>("")
  const [expanded, setExpanded] = useState(true)
  const [showTimestamps, setShowTimestamps] = useState(false)
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
      setError("Missing build number or pipeline slug")
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
        setError(data.error || `Failed to fetch logs: ${response.status}`)
        return
      }

      setLogData(data)
    } catch (err) {
      console.error("Error fetching logs:", err)
      setError(
        "Unable to load job logs. The logs may not be available yet, or there may be a temporary issue accessing them. Please try again in a moment.",
      )
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

  interface AnsiSegment {
    text: string
    styles: Set<string>
  }

  type AnsiState = {
    color: string | null
    bgColor: string | null
    bold: boolean
    dim: boolean
    italic: boolean
    underline: boolean
    reverse: boolean
    strikethrough: boolean
  }

  const parseAnsiToPreact = (text: string, initialState?: AnsiState): { elements: any[]; finalState: AnsiState } => {
    if (!text) return { elements: [], finalState: initialState || createDefaultAnsiState() }

    // ANSI color and style mappings
    const colorMap: Record<number, string> = {
      // Standard colors
      30: "black",
      31: "red",
      32: "green",
      33: "yellow",
      34: "blue",
      35: "magenta",
      36: "cyan",
      37: "white",
      // Bright colors
      90: "bright-black",
      91: "bright-red",
      92: "bright-green",
      93: "bright-yellow",
      94: "bright-blue",
      95: "bright-magenta",
      96: "bright-cyan",
      97: "bright-white",
      // Background colors (we'll prefix with 'bg-')
      40: "bg-black",
      41: "bg-red",
      42: "bg-green",
      43: "bg-yellow",
      44: "bg-blue",
      45: "bg-magenta",
      46: "bg-cyan",
      47: "bg-white",
      100: "bg-bright-black",
      101: "bg-bright-red",
      102: "bg-bright-green",
      103: "bg-bright-yellow",
      104: "bg-bright-blue",
      105: "bg-bright-magenta",
      106: "bg-bright-cyan",
      107: "bg-bright-white",
    }

    const styleMap: Record<number, string> = {
      1: "bold",
      2: "dim",
      3: "italic",
      4: "underline",
      7: "reverse",
      9: "strikethrough",
    }

    function createDefaultAnsiState(): AnsiState {
      return {
        color: null,
        bgColor: null,
        bold: false,
        dim: false,
        italic: false,
        underline: false,
        reverse: false,
        strikethrough: false,
      }
    }

    // Start with initial state (from previous lines)
    let currentState = initialState ? { ...initialState } : createDefaultAnsiState()

    const segments: AnsiSegment[] = []
    let currentText = ""

    // ANSI escape sequence pattern
    const ansiPattern = /\x1b\[([0-9;]*)m/g
    let lastIndex = 0
    let match

    while ((match = ansiPattern.exec(text)) !== null) {
      // Add text before this escape sequence
      if (match.index > lastIndex) {
        currentText += text.slice(lastIndex, match.index)
      }

      // If we have accumulated text, create a segment with current state
      if (currentText) {
        const styles = new Set<string>()
        if (currentState.color) styles.add(currentState.color)
        if (currentState.bgColor) styles.add(currentState.bgColor)
        if (currentState.bold) styles.add("bold")
        if (currentState.dim) styles.add("dim")
        if (currentState.italic) styles.add("italic")
        if (currentState.underline) styles.add("underline")
        if (currentState.reverse) styles.add("reverse")
        if (currentState.strikethrough) styles.add("strikethrough")

        segments.push({
          text: currentText,
          styles,
        })
        currentText = ""
      }

      // Parse the ANSI codes and update state
      const codes = match[1] ? match[1].split(";").map(Number) : [0]

      for (const code of codes) {
        if (code === 0) {
          // Reset all styles
          currentState = createDefaultAnsiState()
        } else if (colorMap[code]) {
          if (code >= 40 && code <= 47 || code >= 100 && code <= 107) {
            // Background color
            currentState.bgColor = colorMap[code]
          } else {
            // Foreground color
            currentState.color = colorMap[code]
          }
        } else if (styleMap[code]) {
          switch (code) {
            case 1:
              currentState.bold = true
              break
            case 2:
              currentState.dim = true
              break
            case 3:
              currentState.italic = true
              break
            case 4:
              currentState.underline = true
              break
            case 7:
              currentState.reverse = true
              break
            case 9:
              currentState.strikethrough = true
              break
          }
        }
      }

      lastIndex = match.index + match[0].length
    }

    // Add remaining text with final state
    if (lastIndex < text.length) {
      currentText += text.slice(lastIndex)
    }

    if (currentText) {
      const styles = new Set<string>()
      if (currentState.color) styles.add(currentState.color)
      if (currentState.bgColor) styles.add(currentState.bgColor)
      if (currentState.bold) styles.add("bold")
      if (currentState.dim) styles.add("dim")
      if (currentState.italic) styles.add("italic")
      if (currentState.underline) styles.add("underline")
      if (currentState.reverse) styles.add("reverse")
      if (currentState.strikethrough) styles.add("strikethrough")

      segments.push({
        text: currentText,
        styles,
      })
    }

    // Convert segments to Preact elements
    const elements = segments.map((segment, index) => {
      if (segment.styles.size === 0) {
        return segment.text
      }

      const classNames = Array.from(segment.styles).map((style) => `ansi-${style}`).join(" ")
      return (
        <span key={index} className={classNames}>
          {segment.text}
        </span>
      )
    })

    return { elements, finalState: currentState }
  }

  const parseLogContent = (rawLog: string) => {
    const logicalLines: Array<{
      timestamp: string
      content: string
      groupMarker?: string
      isGroup: boolean
      lineNumber: number
    }> = []

    let lineNumber = 1
    let position = 0

    // Process the raw log character by character, building logical lines
    while (position < rawLog.length) {
      const currentLine = { content: "", timestamp: "" }
      let foundTimestamp = false

      // Look for the start of a new logical line (timestamp at beginning or after newline)
      const timestampMatch = rawLog.substring(position).match(/^\x1b_bk;t=(\d+)\x07/)
      if (timestampMatch) {
        currentLine.timestamp = timestampMatch[1]
        position += timestampMatch[0].length
        foundTimestamp = true
      }

      // Collect content until we hit a newline or end of file
      let lineContent = ""
      while (position < rawLog.length && rawLog[position] !== "\n") {
        const char = rawLog[position]

        // Check for timestamp in the middle/end of content
        const midTimestampMatch = rawLog.substring(position).match(/^\x1b_bk;t=(\d+)\x07/)
        if (midTimestampMatch) {
          // This is a timestamp update for the current line, not a new line
          currentLine.timestamp = midTimestampMatch[1]
          position += midTimestampMatch[0].length
          continue
        }

        // Check for [K (erase) sequence
        const eraseMatch = rawLog.substring(position).match(/^\x1b\[K/)
        if (eraseMatch) {
          // Erase the current content and start fresh
          lineContent = ""
          position += eraseMatch[0].length
          continue
        }

        // Regular character
        lineContent += char
        position++
      }

      // Skip the newline if we hit one
      if (position < rawLog.length && rawLog[position] === "\n") {
        position++
      }

      // Clean up the content
      lineContent = lineContent.replace(/[\r]+$/, "").trim()

      // Skip empty lines without timestamps
      if (!lineContent && !foundTimestamp) {
        continue
      }

      // Skip lines that are just whitespace
      if (!lineContent.trim()) {
        continue
      }

      currentLine.content = lineContent

      // Debug logging to see what we're getting
      if (lineContent.includes("~~~") || lineContent.includes("---") || lineContent.includes("+++")) {
        console.log("Raw content with group marker:", JSON.stringify(lineContent))
      }

      // Check for group markers at start of content
      const groupMatch = lineContent.match(/^(---|\\+\\+\\+|~~~|\\^\\^\\^ \\+\\+\\+)\s*(.*)$/)

      if (groupMatch) {
        console.log("Group detected:", groupMatch[1], "name:", groupMatch[2])
        logicalLines.push({
          timestamp: currentLine.timestamp,
          groupMarker: groupMatch[1],
          content: groupMatch[2].trim(),
          isGroup: true,
          lineNumber: lineNumber++,
        })
      } else {
        // Regular content line
        logicalLines.push({
          timestamp: currentLine.timestamp,
          content: lineContent,
          isGroup: false,
          lineNumber: lineNumber++,
        })
      }
    }

    return logicalLines
  }

  const processLogsIntoGroups = (logContent: string) => {
    const logicalLines = parseLogContent(logContent)

    const groups: Array<{
      id: number
      type: "collapsed" | "expanded" | "muted" | "ungrouped"
      name: string
      nameElements: any[]
      lines: Array<{ timestamp: string; contentElements: any[]; lineNumber: number }>
      initiallyCollapsed?: boolean
      openPrevious?: boolean
    }> = []

    let currentGroup: typeof groups[0] | null = null
    let groupIdCounter = 0
    let ansiState: AnsiState = {
      color: null,
      bgColor: null,
      bold: false,
      dim: false,
      italic: false,
      underline: false,
      reverse: false,
      strikethrough: false,
    }

    logicalLines.forEach((line) => {
      if (line.isGroup) {
        if (line.groupMarker === "^^^ +++" && groups.length > 0) {
          // Mark previous group to be opened
          const lastGroup = groups[groups.length - 1]
          lastGroup.openPrevious = true
        } else {
          // Create new group
          const groupType = line.groupMarker === "---"
            ? "collapsed"
            : line.groupMarker === "+++"
            ? "expanded"
            : line.groupMarker === "~~~"
            ? "muted"
            : "expanded"

          // Parse group name with ANSI
          const { elements: nameElements, finalState } = parseAnsiToPreact(line.content, ansiState)
          ansiState = finalState

          currentGroup = {
            id: groupIdCounter++,
            type: groupType,
            name: line.content,
            nameElements,
            lines: [],
            initiallyCollapsed: groupType === "collapsed" || groupType === "muted",
          }
          groups.push(currentGroup)
        }
      } else {
        const ts = new Date(parseInt(line.timestamp))

        // Parse content with ANSI state
        const { elements: contentElements, finalState } = parseAnsiToPreact(line.content, ansiState)
        ansiState = finalState

        const logLine = {
          timestamp: ts.toLocaleString("en-US", { hour12: false }),
          contentElements,
          lineNumber: line.lineNumber,
        }

        if (currentGroup) {
          currentGroup.lines.push(logLine)
        } else {
          // Create ungrouped section
          if (groups.length === 0 || groups[groups.length - 1].type !== "ungrouped") {
            currentGroup = {
              id: groupIdCounter++,
              type: "ungrouped",
              name: "",
              nameElements: [],
              lines: [],
              initiallyCollapsed: false,
            }
            groups.push(currentGroup)
          }
          groups[groups.length - 1].lines.push(logLine)
        }
      }
    })

    return groups
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
        {`
        /* Dark terminal theme - ANSI color classes for log display */
        .ansi-black { color: #000000; }
        .ansi-red { color: #ff5555; }
        .ansi-green { color: #50fa7b; }
        .ansi-yellow { color: #f1fa8c; }
        .ansi-blue { color: #6272a4; }
        .ansi-magenta { color: #ff79c6; }
        .ansi-cyan { color: #8be9fd; }
        .ansi-white { color: #f8f8f2; }
        
        .ansi-bright-black { color: #6272a4; }
        .ansi-bright-red { color: #ff6e6e; }
        .ansi-bright-green { color: #69ff94; }
        .ansi-bright-yellow { color: #ffffa5; }
        .ansi-bright-blue { color: #79c0ff; }
        .ansi-bright-magenta { color: #d2a8ff; }
        .ansi-bright-cyan { color: #a4ffff; }
        .ansi-bright-white { color: #ffffff; }
        
        .ansi-bg-black { background-color: #000000; }
        .ansi-bg-red { background-color: #ff5555; }
        .ansi-bg-green { background-color: #50fa7b; }
        .ansi-bg-yellow { background-color: #f1fa8c; }
        .ansi-bg-blue { background-color: #6272a4; }
        .ansi-bg-magenta { background-color: #ff79c6; }
        .ansi-bg-cyan { background-color: #8be9fd; }
        .ansi-bg-white { background-color: #f8f8f2; }
        
        .ansi-bg-bright-black { background-color: #6272a4; }
        .ansi-bg-bright-red { background-color: #ff6e6e; }
        .ansi-bg-bright-green { background-color: #69ff94; }
        .ansi-bg-bright-yellow { background-color: #ffffa5; }
        .ansi-bg-bright-blue { background-color: #79c0ff; }
        .ansi-bg-bright-magenta { background-color: #d2a8ff; }
        .ansi-bg-bright-cyan { background-color: #a4ffff; }
        .ansi-bg-bright-white { background-color: #ffffff; }
        
        .ansi-bold { font-weight: bold; }
        .ansi-dim { opacity: 0.7; }
        .ansi-italic { font-style: italic; }
        .ansi-underline { text-decoration: underline; }
        .ansi-strikethrough { text-decoration: line-through; }
        .ansi-reverse { 
          filter: invert(1);
          border-radius: 2px;
        }
      `}
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
              <p class="wa-caption-s wa-color-text-quiet">Loading logs...</p>
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
                  Job Logs ({Math.ceil(logData.content.length / 1024)} KB)
                </div>
                <div class="wa-cluster wa-gap-xs">
                  <wa-button
                    size="small"
                    appearance="plain"
                    onClick={() => setShowTimestamps(!showTimestamps)}
                  >
                    <wa-icon slot="prefix" name="clock" />
                    {showTimestamps ? "Hide" : "Show"} Timestamps
                  </wa-button>
                  <wa-button size="small" appearance="plain">
                    <wa-icon slot="prefix" name="copy" />
                    Copy
                  </wa-button>
                  <wa-button
                    size="small"
                    appearance="plain"
                    onClick={() => downloadLogs()}
                  >
                    <wa-icon slot="prefix" name="download" />
                    Download
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
                              colSpan={showTimestamps ? 3 : 2}
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
                                  {group.nameElements}
                                  {group.type === "muted" && (
                                    <span style="color: var(--wa-color-text-quiet); margin-left: 8px; font-size: 0.8em;">
                                      (muted)
                                    </span>
                                  )}
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
                                {logLine.contentElements}
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
              <p class="wa-caption-s wa-color-text-quiet">No logs available for this job</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
