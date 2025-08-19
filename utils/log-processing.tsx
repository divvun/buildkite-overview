export interface AnsiSegment {
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

export const parseAnsiToPreact = (
  text: string,
  initialState?: AnsiState,
): { segments: AnsiSegment[]; finalState: AnsiState } => {
  if (!text) return { segments: [], finalState: initialState || createDefaultAnsiState() }

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

  // Return segments data for rendering
  return { segments, finalState: currentState }
}

export const parseLogContent = (rawLog: string) => {
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

    // Check for group markers at start of content
    const groupMatch = lineContent.match(/^(---|\\+\\+\\+|~~~|\\^\\^\\^ \\+\\+\\+)\s*(.*)$/)

    if (groupMatch) {
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

export const processLogsIntoGroups = (logContent: string) => {
  const logicalLines = parseLogContent(logContent)

  const groups: Array<{
    id: number
    type: "collapsed" | "expanded" | "muted" | "ungrouped"
    name: string
    nameSegments: AnsiSegment[]
    lines: Array<{ timestamp: string; contentSegments: AnsiSegment[]; lineNumber: number }>
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
        const { segments: nameSegments, finalState } = parseAnsiToPreact(line.content, ansiState)
        ansiState = finalState

        currentGroup = {
          id: groupIdCounter++,
          type: groupType,
          name: line.content,
          nameSegments,
          lines: [],
          initiallyCollapsed: groupType === "collapsed" || groupType === "muted",
        }
        groups.push(currentGroup)
      }
    } else {
      const ts = new Date(parseInt(line.timestamp))

      // Parse content with ANSI state
      const { segments: contentSegments, finalState } = parseAnsiToPreact(line.content, ansiState)
      ansiState = finalState

      const logLine = {
        timestamp: ts.toLocaleString("en-US", { hour12: false }),
        contentSegments,
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
            nameSegments: [],
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

export function segmentsToElements(segments: AnsiSegment[]) {
  return segments.map((segment, index) => {
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

export const ANSI_CSS = `
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
`
