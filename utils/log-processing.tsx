// deno-lint-ignore-file no-control-regex

// Pre-compiled regex patterns for performance
const TIMESTAMP_REGEX = /^\x1b_bk;t=(\d+)\x07/
const ANSI_ESCAPE_REGEX = /^\x1b\[([0-9;?]*)([A-Za-z])/
// Removed Set - using direct char comparisons for better performance

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

// Line element with character and optional ANSI sequences (stored raw for lazy processing)
type LineElement = {
  char: string // The character at this position (empty string for padding)
  ansiRaw?: string // Optional raw ANSI sequences - not parsed until needed for display
}

interface TerminalState {
  lines: Array<Array<LineElement>> // Array of line contents (mixed arrays of characters and ANSI objects)
  lineTimestamps: string[] // Timestamp for when each line was last modified
  ansiStates: AnsiState[] // ANSI color/style state for each line
  dirtyLines: Set<number> // Track which lines need metadata updates
  cursorRow: number // Current row (0-based)
  cursorCol: number // Current column (0-based)
  currentTimestamp: string // Most recent timestamp seen
  currentAnsiState: AnsiState // Current ANSI formatting state
  savedCursor?: { // For save/restore cursor operations
    row: number
    col: number
  }
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

function initializeTerminalState(): TerminalState {
  return {
    lines: [],
    lineTimestamps: [],
    ansiStates: [],
    dirtyLines: new Set(),
    cursorRow: 0,
    cursorCol: 0,
    currentTimestamp: "",
    currentAnsiState: createDefaultAnsiState(),
  }
}

function ensureBufferSize(state: TerminalState, minRows: number) {
  while (state.lines.length <= minRows) {
    state.lines.push([]) // Array of LineElement objects
    state.lineTimestamps.push(state.currentTimestamp)
    state.ansiStates.push({ ...state.currentAnsiState })
  }
}

function writeCharToBuffer(state: TerminalState, char: string) {
  // Ensure we have enough lines
  ensureBufferSize(state, state.cursorRow)

  // Get current line - now direct O(1) access!
  const line = state.lines[state.cursorRow]

  // Pad line with empty elements if needed to reach the cursor position
  while (line.length <= state.cursorCol) {
    line.push({ char: "" }) // Empty element for padding
  }

  // Write character directly to cursor position - O(1) operation!
  const existingElement = line[state.cursorCol] || { char: "" }
  line[state.cursorCol] = {
    char,
    ansiRaw: existingElement.ansiRaw, // Preserve any existing raw ANSI sequences
  }

  // Mark line as dirty for batch metadata update
  state.dirtyLines.add(state.cursorRow)

  // Advance cursor
  state.cursorCol++
}

function writeAnsiSequenceToBuffer(state: TerminalState, sequence: string) {
  // Store ANSI sequence to be attached to the next character written
  // or attach it to the current position if there's already a character there
  ensureBufferSize(state, state.cursorRow)

  const line = state.lines[state.cursorRow]

  // Ensure cursor position exists
  while (line.length <= state.cursorCol) {
    line.push({ char: "" })
  }

  // Attach raw ANSI sequence to the current cursor position (lazy processing)
  const existingElement = line[state.cursorCol] || { char: "" }
  line[state.cursorCol] = {
    char: existingElement.char,
    ansiRaw: (existingElement.ansiRaw || "") + sequence, // Concatenate raw ANSI sequences
  }

  // Mark line as dirty
  state.dirtyLines.add(state.cursorRow)

  // Don't advance cursor - ANSI sequences don't take up visual space
}

function moveCursor(state: TerminalState, deltaRow: number, deltaCol: number) {
  state.cursorRow = Math.max(0, state.cursorRow + deltaRow)
  state.cursorCol = Math.max(0, state.cursorCol + deltaCol)
}

function setCursor(state: TerminalState, row: number, col: number) {
  state.cursorRow = Math.max(0, row)
  state.cursorCol = Math.max(0, col)
}

function handleCursorMovement(state: TerminalState, params: number[], command: string) {
  const count = params[0] || 1 // Default to 1 if no parameter given

  switch (command) {
    case "A": // Cursor up
      moveCursor(state, -count, 0)
      break
    case "B": // Cursor down
      moveCursor(state, count, 0)
      break
    case "C": // Cursor forward/right
      moveCursor(state, 0, count)
      break
    case "D": // Cursor back/left
      moveCursor(state, 0, -count)
      break
    case "E": // Cursor next line (beginning of line n lines down)
      moveCursor(state, count, 0)
      state.cursorCol = 0
      break
    case "F": // Cursor previous line (beginning of line n lines up)
      moveCursor(state, -count, 0)
      state.cursorCol = 0
      break
    case "G": // Cursor horizontal absolute (column n)
      state.cursorCol = Math.max(0, count - 1) // 1-based to 0-based
      break
    case "H": // Cursor position (row n, column m)
    case "f": { // Same as H
      const row = params[0] || 1
      const col = params[1] || 1
      setCursor(state, row - 1, col - 1) // 1-based to 0-based
      break
    }
  }
}

function handleEraseSequence(state: TerminalState, params: number[], command: string) {
  const param = params[0] || 0 // Default to 0 if no parameter given

  switch (command) {
    case "K": {
      // Erase in line - now with direct O(1) access
      ensureBufferSize(state, state.cursorRow)
      const line = state.lines[state.cursorRow]

      if (param === 0) {
        // Erase from cursor to end of line
        line.splice(state.cursorCol)
      } else if (param === 1) {
        // Erase from beginning of line to cursor - replace with empty characters
        for (let i = 0; i < state.cursorCol; i++) {
          if (line[i]) {
            line[i] = { char: "", ansiRaw: line[i].ansiRaw } // Keep raw ANSI, clear character
          }
        }
      } else if (param === 2) {
        // Erase entire line
        line.length = 0
      }

      // Mark line as dirty for batch metadata update
      state.dirtyLines.add(state.cursorRow)
      break
    }

    case "J": {
      if (param === 0) {
        // Erase from cursor to end of screen
        ensureBufferSize(state, state.cursorRow)
        // Clear current line from cursor to end
        handleEraseSequence(state, [0], "K")
        // Clear all lines after current
        state.lines.splice(state.cursorRow + 1)
        state.lineTimestamps.splice(state.cursorRow + 1)
        state.ansiStates.splice(state.cursorRow + 1)
      } else if (param === 1) {
        // Erase from beginning of screen to cursor
        for (let i = 0; i < state.cursorRow; i++) {
          state.lines[i].length = 0 // Clear mixed array
          state.dirtyLines.add(i)
        }
        // Clear current line from beginning to cursor
        handleEraseSequence(state, [1], "K")
      } else if (param === 2) {
        // Erase entire screen
        state.lines = []
        state.lineTimestamps = []
        state.ansiStates = []
        state.dirtyLines.clear()
        state.cursorRow = 0
        state.cursorCol = 0
      }
      break
    }
  }
}

function handleCursorSaveRestore(state: TerminalState, command: string) {
  switch (command) {
    case "s": // Save cursor position
      state.savedCursor = {
        row: state.cursorRow,
        col: state.cursorCol,
      }
      break
    case "u": // Restore cursor position
      if (state.savedCursor) {
        setCursor(state, state.savedCursor.row, state.savedCursor.col)
      }
      break
  }
}

function handleSpecialChar(state: TerminalState, char: string) {
  switch (char) {
    case "\n": // Line feed
      state.cursorRow++
      state.cursorCol = 0
      break
    case "\r": // Carriage return
      state.cursorCol = 0
      break
    case "\t": // Tab
      // Move to next tab stop (every 8 columns)
      state.cursorCol = Math.floor((state.cursorCol + 8) / 8) * 8
      break
    case "\b": // Backspace
      state.cursorCol = Math.max(0, state.cursorCol - 1)
      break
    default:
      // Regular printable character
      writeCharToBuffer(state, char)
      break
  }
}

function batchUpdateMetadata(state: TerminalState) {
  // Update metadata for all dirty lines in one batch
  for (const lineIndex of state.dirtyLines) {
    if (lineIndex < state.lineTimestamps.length) {
      state.lineTimestamps[lineIndex] = state.currentTimestamp
      state.ansiStates[lineIndex] = { ...state.currentAnsiState }
    }
  }
  state.dirtyLines.clear()
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
  const state = initializeTerminalState()
  let position = 0

  while (position < rawLog.length) {
    // Check for Buildkite timestamp marker using substring (for correctness)
    if (rawLog.charCodeAt(position) === 27 && rawLog.charCodeAt(position + 1) === 95) { // \x1b_
      const timestampMatch = rawLog.substring(position).match(TIMESTAMP_REGEX)
      if (timestampMatch) {
        state.currentTimestamp = timestampMatch[1]
        position += timestampMatch[0].length
        continue
      }
    }

    // Check for ANSI escape sequences using substring (for correctness)
    if (rawLog.charCodeAt(position) === 27 && rawLog.charCodeAt(position + 1) === 91) { // \x1b[
      const escapeMatch = rawLog.substring(position).match(ANSI_ESCAPE_REGEX)
      if (escapeMatch) {
        const paramStr = escapeMatch[1]
        const command = escapeMatch[2]

        // Parse parameters, handling both numbers and ? prefixes for terminal modes
        let params: number[] = []
        if (paramStr) {
          if (paramStr.charCodeAt(0) === 63) { // '?' character
            // Terminal mode sequence like ?25h or ?25l - just ignore these
            position += escapeMatch[0].length
            continue
          } else {
            params = paramStr.split(";").map((p) => parseInt(p) || 0)
          }
        }

        // Handle different ANSI command types - use charCode for performance
        const commandCode = command.charCodeAt(0)
        if ((commandCode >= 65 && commandCode <= 72) || commandCode === 102) { // A-H, f
          // Cursor movement sequences
          handleCursorMovement(state, params, command)
        } else if (commandCode === 75 || commandCode === 74) { // K, J
          // Erase sequences
          handleEraseSequence(state, params, command)
        } else if (commandCode === 115 || commandCode === 117) { // s, u
          // Save/restore cursor
          handleCursorSaveRestore(state, command)
        } else if (commandCode === 109) { // m
          // Color/style sequences - update ANSI state AND preserve in buffer
          updateAnsiState(state, params)
          writeAnsiSequenceToBuffer(state, escapeMatch[0])
        }

        position += escapeMatch[0].length
        continue
      }
    }

    // Handle regular characters and special control characters
    const char = rawLog[position]

    // Direct character comparisons (simpler than charCode or Set.has())
    if (char === "\n" || char === "\r" || char === "\t" || char === "\b") {
      handleSpecialChar(state, char)
    } else {
      // Regular printable character
      writeCharToBuffer(state, char)
    }

    position++

    // Batch update metadata every 1000 characters for efficiency
    if (position % 1000 === 0) {
      batchUpdateMetadata(state)
    }
  }

  // Final metadata update and convert to logical lines
  batchUpdateMetadata(state)
  return convertBufferToLogicalLines(state)
}

function updateAnsiState(state: TerminalState, codes: number[]) {
  for (const code of codes) {
    if (code === 0) {
      // Reset all styles
      state.currentAnsiState = createDefaultAnsiState()
    } else if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) {
      // Foreground colors
      const colorMap: Record<number, string> = {
        30: "black",
        31: "red",
        32: "green",
        33: "yellow",
        34: "blue",
        35: "magenta",
        36: "cyan",
        37: "white",
        90: "bright-black",
        91: "bright-red",
        92: "bright-green",
        93: "bright-yellow",
        94: "bright-blue",
        95: "bright-magenta",
        96: "bright-cyan",
        97: "bright-white",
      }
      state.currentAnsiState.color = colorMap[code] || null
    } else if ((code >= 40 && code <= 47) || (code >= 100 && code <= 107)) {
      // Background colors
      const bgColorMap: Record<number, string> = {
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
      state.currentAnsiState.bgColor = bgColorMap[code] || null
    } else {
      // Style codes
      switch (code) {
        case 1:
          state.currentAnsiState.bold = true
          break
        case 2:
          state.currentAnsiState.dim = true
          break
        case 3:
          state.currentAnsiState.italic = true
          break
        case 4:
          state.currentAnsiState.underline = true
          break
        case 7:
          state.currentAnsiState.reverse = true
          break
        case 9:
          state.currentAnsiState.strikethrough = true
          break
      }
    }
  }
}

function convertBufferToLogicalLines(state: TerminalState) {
  const logicalLines: Array<{
    timestamp: string
    content: string
    groupMarker?: string
    isGroup: boolean
    lineNumber: number
  }> = []

  let lineNumber = 1

  for (let i = 0; i < state.lines.length; i++) {
    // Convert element array to string with direct iteration - much faster!
    const lineElements = state.lines[i]
    let content = ""

    for (const element of lineElements) {
      // Each element has both char and raw ANSI - concatenate in correct order
      if (element.ansiRaw) {
        content += element.ansiRaw // Raw ANSI sequences first (lazy processing - not parsed yet)
      }
      content += element.char // Then the character (may be empty string)
    }

    // Trim trailing whitespace efficiently
    while (content.length > 0 && /\s/.test(content[content.length - 1])) {
      content = content.slice(0, -1)
    }

    const timestamp = state.lineTimestamps[i] || ""

    // Skip completely empty lines
    if (!content && !timestamp) {
      continue
    }

    // Check for group markers at start of content
    const groupMatch = content.match(/^(---|\\+\\+\\+|~~~|\\^\\^\\^ \\+\\+\\+)\s*(.*)$/)

    if (groupMatch) {
      logicalLines.push({
        timestamp,
        groupMarker: groupMatch[1],
        content: groupMatch[2],
        isGroup: true,
        lineNumber: lineNumber++,
      })
    } else {
      // Regular content line
      logicalLines.push({
        timestamp,
        content,
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
