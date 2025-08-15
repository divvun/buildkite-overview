/**
 * Centralized formatting utilities for consistent display across the application
 */

// Status mapping from various formats to standardized lowercase format
export const BUILD_STATUS_MAP: Record<string, string> = {
  // Buildkite API uppercase formats
  "PASSED": "passed",
  "FAILED": "failed",
  "CANCELED": "failed",
  "WAITING_FAILED": "failed",
  "RUNNING": "running",
  "SCHEDULED": "running",
  "CREATING": "running",
  "WAITING": "running",
  "BLOCKED": "running",
  "CANCELING": "running",
  "SKIPPED": "passed",
  "NOT_RUN": "neutral",
  // Already normalized formats
  "passed": "passed",
  "failed": "failed",
  "running": "running",
  "neutral": "neutral",
}

export function normalizeStatus(status: string): string {
  return BUILD_STATUS_MAP[status] || "unknown"
}

export function getBadgeVariant(status: string): string {
  const normalizedStatus = normalizeStatus(status)
  switch (normalizedStatus) {
    case "passed":
      return "success"
    case "failed":
      return "danger"
    case "running":
      return "warning"
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
    default:
      return "circle"
  }
}

export function getHealthBorderStyle(status: string): string {
  const normalizedStatus = normalizeStatus(status)
  switch (normalizedStatus) {
    case "passed":
      return "border-left: 4px solid var(--wa-color-success-fill-loud)"
    case "failed":
      return "border-left: 4px solid var(--wa-color-danger-fill-loud)"
    case "running":
      return "border-left: 4px solid var(--wa-color-warning-fill-loud)"
    default:
      return "border-left: 4px solid var(--wa-color-neutral-fill-loud)"
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

export function getConnectionVariant(state: string): string {
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

export function formatFailingSince(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`
  }
  return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`
}

export function formatLastSeen(date?: Date): string {
  if (!date) return "Never"

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return "now"
  if (diffMins < 60) return `${diffMins} min ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

// Organization handling utilities
export const ORGANIZATIONS = ["divvun", "giellalt", "necessary-nu", "bbqsrc"] as const
export type Organization = typeof ORGANIZATIONS[number]

export function getOrgFromRepo(repo?: string): string {
  if (!repo || typeof repo !== "string") return "unknown"
  const parts = repo.split("/")
  return parts[0]?.trim() || "unknown"
}

export function getOrgFromPipelineSlug(slug: string): string {
  // Extract org from pipeline slug (format: "org/pipeline" or just "pipeline")
  return slug.includes("/") ? slug.split("/")[0] : "divvun"
}

export function isValidOrganization(org: string): org is Organization {
  return ORGANIZATIONS.includes(org as Organization)
}
