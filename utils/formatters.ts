/**
 * Centralized formatting utilities for consistent display across the application
 */

// Status mapping from various formats to standardized lowercase format
export const BUILD_STATUS_MAP: Record<string, string> = {
  // Buildkite API uppercase formats
  "PASSED": "passed",
  "FAILED": "failed",
  "CANCELED": "cancelled",
  "WAITING_FAILED": "failed",
  "RUNNING": "running",
  "CREATING": "running",
  "SCHEDULED": "scheduled",
  "WAITING": "waiting",
  "BLOCKED": "blocked",
  "CANCELING": "cancelled",
  "SKIPPED": "passed",
  "NOT_RUN": "neutral",
  // Already normalized formats
  "passed": "passed",
  "failed": "failed",
  "running": "running",
  "cancelled": "cancelled",
  "blocked": "blocked",
  "waiting": "waiting",
  "scheduled": "scheduled",
  "neutral": "neutral",
  "unknown": "unknown",
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
    case "cancelled":
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
      return "spinner"
    case "blocked":
      return "circle-pause" // Paused/blocked state
    case "waiting":
      return "clock" // Waiting for something
    case "scheduled":
      return "calendar" // Scheduled to run
    case "cancelled":
      return "circle-stop"
    default:
      return "circle"
  }
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
export function formatDuration(startedAt?: string, finishedAt?: string): string {
  if (!startedAt) return "0s"

  const start = new Date(startedAt)
  const end = finishedAt ? new Date(finishedAt) : new Date()
  const durationMs = Math.max(0, end.getTime() - start.getTime())

  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const mins = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const secs = Math.floor((durationMs % (1000 * 60)) / 1000)

  if (hours > 0) return `${hours}h ${mins}m ${secs}s`
  if (mins > 0) return `${mins}m ${secs}s`
  return `${secs}s`
}

export function formatDurationSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

export function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return "now"
  if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? "s" : ""} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`
  return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`
}

export function formatFailingSince(date: Date | string): string {
  const now = new Date()
  const dateObj = typeof date === "string" ? new Date(date) : date
  const diffMs = now.getTime() - dateObj.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`
  }
  return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`
}

export function formatLastSeen(date?: Date): string {
  if (!date) return "Never"

  // Ensure we have a valid Date object
  let validDate: Date
  if (date instanceof Date) {
    validDate = date
  } else {
    // Try to convert string to Date
    validDate = new Date(date as any)
  }

  // Check if the date is valid
  if (isNaN(validDate.getTime())) {
    return "Unknown"
  }

  const now = new Date()
  const diffMs = now.getTime() - validDate.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return "now"
  if (diffMins < 60) return `${diffMins} min ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
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
