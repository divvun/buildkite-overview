/**
 * Centralized formatting utilities for consistent display across the application
 */

// Status mapping from various formats to standardized lowercase format
export const BUILD_STATUS_MAP: Record<string, string> = {
  // Buildkite API uppercase formats
  "PASSED": "passed",
  "FAILED": "failed",
  "CANCELED": "canceled",
  "WAITING_FAILED": "failed",
  "RUNNING": "running",
  "CREATING": "running",
  "SCHEDULED": "scheduled",
  "WAITING": "waiting",
  "BLOCKED": "blocked",
  "CANCELING": "canceled",
  "SKIPPED": "passed",
  "NOT_RUN": "neutral",
  // Already normalized formats
  "passed": "passed",
  "failed": "failed",
  "running": "running",
  "canceled": "canceled",
  "blocked": "blocked",
  "waiting": "waiting",
  "scheduled": "scheduled",
  "neutral": "neutral",
  "unknown": "unknown",
}

/**
 * Checks if a build is in a finished/terminal state and should not be refreshed
 */
export function isBuildFinished(state: string): boolean {
  const finishedStates = [
    "PASSED",
    "FAILED",
    "CANCELED",
    "WAITING_FAILED",
    "NOT_RUN",
    "SKIPPED",
  ]
  return finishedStates.includes(state)
}

export function normalizeStatus(status: string): string {
  return BUILD_STATUS_MAP[status] || "unknown"
}

export function getBadgeVariant(status: string): "brand" | "neutral" | "success" | "warning" | "danger" {
  const normalizedStatus = normalizeStatus(status)
  switch (normalizedStatus) {
    case "passed":
      return "success"
    case "failed":
      return "danger"
    case "running":
      return "warning"
    case "blocked":
      return "brand" // Distinct from running - something needs attention but not failed
    case "waiting":
    case "scheduled":
      return "warning" // Something will happen soon
    case "canceled":
      return "neutral"
    default:
      return "neutral"
  }
}

export function getStatusIcon(status: string): string {
  const normalizedStatus = normalizeStatus(status)
  switch (normalizedStatus) {
    case "passed":
      return "circle-check"
    case "failed":
      return "circle-xmark"
    case "running":
      return "spinner" // Note: Use isRunningStatus() to render wa-spinner instead
    case "blocked":
      return "circle-pause" // Paused/blocked state
    case "waiting":
      return "clock" // Waiting for something
    case "scheduled":
      return "calendar" // Scheduled to run
    case "canceled":
      return "circle-stop"
    default:
      return "circle"
  }
}

/**
 * Helper function to check if status should use animated spinner
 */
export function isRunningStatus(status: string): boolean {
  return normalizeStatus(status) === "running"
}

/**
 * GitHub URL helper functions
 */
export function getGitHubRepoUrl(repo: string): string {
  if (!repo || repo === "unknown") return "#"
  return `https://github.com/${repo}`
}

export function getGitHubBranchUrl(repo: string, branch: string): string {
  if (!repo || repo === "unknown" || !branch) return "#"
  return `https://github.com/${repo}/tree/${encodeURIComponent(branch)}`
}

export function getGitHubCommitUrl(repo: string, commit: string): string {
  if (!repo || repo === "unknown" || !commit) return "#"
  return `https://github.com/${repo}/commit/${commit}`
}

export function getHealthBorderStyle(status: string): string {
  const normalizedStatus = normalizeStatus(status)
  switch (normalizedStatus) {
    case "passed":
      return "border-top: 4px solid var(--wa-color-success-fill-loud)"
    case "failed":
      return "border-top: 4px solid var(--wa-color-danger-fill-loud)"
    case "running":
      return "border-top: 4px solid var(--wa-color-warning-fill-loud)"
    default:
      return "border-top: 4px solid var(--wa-color-neutral-fill-loud)"
  }
}

// Agent connection status helpers
export function getConnectionIcon(state: string): string {
  switch (state) {
    case "connected":
      return "circle-check"
    case "disconnected":
      return "circle-xmark"
    case "lost":
      return "triangle-exclamation"
    default:
      return "circle"
  }
}

export function getConnectionVariant(state: string): "brand" | "neutral" | "success" | "warning" | "danger" {
  switch (state) {
    case "connected":
      return "success"
    case "disconnected":
      return "neutral"
    case "lost":
      return "danger"
    default:
      return "neutral"
  }
}

// Time formatting utilities
export function formatDuration(startedAt?: string, finishedAt?: string, locale: string = "en"): string {
  if (!startedAt) return "0s"

  const start = new Date(startedAt)
  const end = finishedAt ? new Date(finishedAt) : new Date()
  const durationMs = Math.max(0, end.getTime() - start.getTime())

  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const mins = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const secs = Math.floor((durationMs % (1000 * 60)) / 1000)

  try {
    // Use Intl.DurationFormat when it becomes available, for now use abbreviated format
    const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })

    if (hours > 0) {
      return `${formatter.format(hours)}h ${formatter.format(mins)}m ${formatter.format(secs)}s`
    }
    if (mins > 0) {
      return `${formatter.format(mins)}m ${formatter.format(secs)}s`
    }
    return `${formatter.format(secs)}s`
  } catch (_error) {
    // Fallback to simple format
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`
    if (mins > 0) return `${mins}m ${secs}s`
    return `${secs}s`
  }
}

export function formatDurationSeconds(seconds: number, locale: string = "en"): string {
  try {
    const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })

    if (seconds < 60) {
      return `${formatter.format(seconds)}s`
    }

    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) {
      return `${formatter.format(minutes)}m ${formatter.format(seconds % 60)}s`
    }

    const hours = Math.floor(minutes / 60)
    return `${formatter.format(hours)}h ${formatter.format(minutes % 60)}m`
  } catch (_error) {
    // Fallback to simple format
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ${minutes % 60}m`
  }
}

export function formatTimeAgo(
  dateStr: string,
  locale: string = "en",
  t?: (key: string, values?: Record<string, any>) => string,
): string {
  const date = new Date(dateStr)

  // Check if the date is valid
  if (isNaN(date.getTime())) {
    return t?.("time-unknown") || "Unknown"
  }

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return t?.("time-now") || "now"

  // Prefer Fluent translations when available
  if (t) {
    if (diffDays > 0) {
      return t("time-days-ago", { count: diffDays })
    } else if (diffHours > 0) {
      return t("time-hours-ago", { count: diffHours })
    } else {
      return t("time-minutes-ago", { count: diffMins })
    }
  }

  // Fallback to Intl.RelativeTimeFormat when no translation function
  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "always", style: "short" })

    if (diffDays > 0) {
      return rtf.format(-diffDays, "day")
    } else if (diffHours > 0) {
      return rtf.format(-diffHours, "hour")
    } else {
      return rtf.format(-diffMins, "minute")
    }
  } catch (_error) {
    // Final fallback to hardcoded English
    if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? "s" : ""} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`
    return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`
  }
}

export function formatFailingSince(
  date: Date | string,
  locale: string = "en",
  t?: (key: string, values?: Record<string, any>) => string,
): string {
  const now = new Date()
  const dateObj = typeof date === "string" ? new Date(date) : date

  // Check if the date is valid
  if (isNaN(dateObj.getTime())) {
    return t?.("time-unknown") || "Unknown"
  }

  const diffMs = now.getTime() - dateObj.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  // Prefer Fluent translations when available
  if (t) {
    if (diffDays > 0) {
      return t("time-days-ago", { count: diffDays })
    } else {
      return t("time-hours-ago", { count: diffHours })
    }
  }

  // Fallback to Intl.RelativeTimeFormat when no translation function
  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "always", style: "short" })

    if (diffDays > 0) {
      return rtf.format(-diffDays, "day")
    } else {
      return rtf.format(-diffHours, "hour")
    }
  } catch (_error) {
    // Final fallback to hardcoded English
    if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`
    }
    return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`
  }
}

export function formatLastSeen(
  date?: Date,
  locale: string = "en",
  t?: (key: string, values?: Record<string, any>) => string,
): string {
  if (!date) return t?.("time-never") || "Never"

  // Ensure we have a valid Date object
  let validDate: Date
  if (date instanceof Date) {
    validDate = date
  } else {
    // Try to convert string to Date
    validDate = new Date(date as unknown as string)
  }

  // Check if the date is valid
  if (isNaN(validDate.getTime())) {
    return t?.("time-unknown") || "Unknown"
  }

  const now = new Date()
  const diffMs = now.getTime() - validDate.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return t?.("time-now") || "now"

  // Prefer Fluent translations when available
  if (t) {
    if (diffDays > 0) {
      return t("time-days-ago", { count: diffDays })
    } else if (diffHours > 0) {
      return t("time-hours-ago", { count: diffHours })
    } else {
      return t("time-minutes-ago", { count: diffMins })
    }
  }

  // Fallback to Intl.RelativeTimeFormat when no translation function
  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "always", style: "short" })

    if (diffDays > 0) {
      return rtf.format(-diffDays, "day")
    } else if (diffHours > 0) {
      return rtf.format(-diffHours, "hour")
    } else {
      return rtf.format(-diffMins, "minute")
    }
  } catch (_error) {
    // Final fallback to hardcoded English
    if (diffMins < 60) return `${diffMins} min ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }
}

// Buildkite organization(s) - these are the actual Buildkite orgs we fetch pipelines from
export const ORGANIZATIONS = ["divvun"] as const
export type Organization = typeof ORGANIZATIONS[number]

export function isValidOrganization(org: string): org is Organization {
  return ORGANIZATIONS.includes(org as Organization)
}

// Translation helper for build status strings
export function getTranslatedStatus(status: string, t: (key: string) => string): string {
  // Try to translate the status using the status-{STATUS} key pattern
  const translationKey = `status-${status}`
  const translation = t(translationKey)

  // If translation is the same as the key, it means no translation was found
  // Fall back to the original status
  return translation === translationKey ? status : translation
}
