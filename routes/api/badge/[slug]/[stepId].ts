import { makeBadge } from "badge-maker"
import { Context } from "fresh"
import { getCacheManager } from "~/server/cache/cache-manager.ts"
import type { AppPipelineJob } from "~/types/app.ts"
import { getJobStatus, normalizeStatus } from "~/utils/formatters.ts"
import { type AppState, isPrivatePipeline } from "~/server/middleware.ts"

/**
 * Aggregate job statuses to determine overall group status
 * Priority: failed > running > blocked > waiting/scheduled > passed
 */
function aggregateJobStatuses(jobs: AppPipelineJob[]): string {
  if (jobs.length === 0) return "unknown"

  const statuses = jobs.map((job) => getJobStatus(job))

  if (statuses.some((s) => s === "failed")) return "failed"
  if (statuses.some((s) => s === "running")) return "running"
  if (statuses.some((s) => s === "blocked")) return "blocked"
  if (statuses.some((s) => s === "waiting" || s === "scheduled")) return "waiting"
  if (statuses.every((s) => s === "passed")) return "passed"
  if (statuses.some((s) => s === "canceled")) return "canceled"

  return "unknown"
}

// Synthetic statuses produced by this endpoint that are not real build/job
// states — they must not be run through normalizeStatus(), which would collapse
// any unrecognized string to "unknown".
const SYNTHETIC_STATUSES = new Set(["not found", "no builds", "unknown"])

/**
 * Generate an SVG badge for a job/step status
 */
function generateStepBadgeSvg(stepLabel: string, status: string): string {
  const statusNormalized = SYNTHETIC_STATUSES.has(status) ? status : normalizeStatus(status)

  const colorMap: Record<string, string> = {
    "passed": "brightgreen",
    "failed": "red",
    "running": "yellow",
    "blocked": "lightgrey",
    "waiting": "yellow",
    "scheduled": "yellow",
    "canceled": "lightgrey",
    "unknown": "lightgrey",
    "not found": "lightgrey",
    "no builds": "lightgrey",
  }

  const statusText = statusNormalized === "passed" ? "passing" : statusNormalized
  const color = colorMap[statusNormalized] || "lightgrey"

  return makeBadge({
    label: stepLabel,
    message: statusText,
    color: color,
  })
}

/**
 * Check if the request is authorized to view a private pipeline badge
 */
function isAuthorizedForPrivateBadge(request: Request): boolean {
  const origin = request.headers.get("Origin")
  const referer = request.headers.get("Referer")

  if (
    origin === "https://github.com" ||
    origin === "https://giellalt.github.io" ||
    referer?.startsWith("https://github.com/") ||
    referer?.startsWith("https://giellalt.github.io/")
  ) {
    return true
  }

  const hostname = new URL(request.url).hostname
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return true
  }

  return false
}

export const handler = async (ctx: Context<AppState>): Promise<Response> => {
  const req = ctx.req
  const slug = ctx.params.slug as string
  const stepId = ctx.params.stepId as string
  const url = new URL(req.url)
  const customLabel = url.searchParams.get("label")

  try {
    if (!slug || !stepId) {
      return new Response("Pipeline slug and step ID are required", { status: 400 })
    }

    // Get all pipelines from the shared cache (triggers fetch if cache is cold)
    const cacheManager = getCacheManager()
    const pipelines = await cacheManager.getPipelines()

    const pipeline = pipelines.find((p) => p.slug === slug)

    if (!pipeline) {
      const notFoundBadge = generateStepBadgeSvg(customLabel || stepId, "unknown")
      return new Response(notFoundBadge, {
        status: 200,
        headers: { "Content-Type": "image/svg+xml" },
      })
    }

    const isPrivate = isPrivatePipeline({
      repo: pipeline.repo,
      visibility: pipeline.visibility,
      tags: pipeline.tags,
    })

    if (isPrivate && !isAuthorizedForPrivateBadge(req)) {
      return new Response("Forbidden: Private pipeline badge", {
        status: 403,
        headers: { "Content-Type": "text/plain" },
      })
    }

    const cacheControl = isPrivate ? "private, max-age=60" : "public, max-age=120"
    // Shorter cache while the build hasn't produced real step data yet, so the
    // badge picks up the actual step status soon after the build starts.
    const pendingCacheControl = isPrivate ? "private, max-age=30" : "public, max-age=30"

    // Overall status of the latest build (see determinePipelineStatus in
    // cache-manager.ts): "scheduled" | "waiting" | "running" | "blocked" | ...
    const buildStatus = normalizeStatus(pipeline.status || "unknown")
    // A scheduled build hasn't run its bootstrap job yet, so it has no per-step
    // data and any cached jobs belong to the previous build — don't trust them.
    const isPreRun = buildStatus === "scheduled"
    // States where the build-level status is a better answer than "not found" /
    // "no builds" when we cannot resolve the requested step from the jobs.
    const buildStatusIsMeaningfulFallback = isPreRun || buildStatus === "waiting" ||
      buildStatus === "running" || buildStatus === "blocked"

    // If the build is running but the resolved step still reads as pending — its
    // jobs are queued, or the cached job snapshot lags slightly behind live — the
    // badge should track the build rather than show "waiting" next to a running
    // build page.
    const trackRunningBuild = (status: string): string =>
      buildStatus === "running" && (status === "waiting" || status === "scheduled") ? "running" : status

    const jobs = pipeline.latestBuildJobs
    console.log(
      `🏷️ Badge ${slug}/${stepId}: pipeline status=${pipeline.status}, jobs=${jobs?.length || 0}, stepKeys=[${
        jobs?.map((j) => j.stepKey).join(", ") || "none"
      }]`,
    )

    // Dynamic pipelines upload their steps from a bootstrap job, so a build that
    // hasn't started yet has no per-step data (and any cached jobs belong to the
    // previous build). Report the build-level status instead of "unknown".
    if (isPreRun) {
      return new Response(generateStepBadgeSvg(customLabel || stepId, buildStatus), {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": pendingCacheControl,
          "X-Content-Type-Options": "nosniff",
        },
      })
    }

    if (!jobs || jobs.length === 0) {
      const fallbackStatus = buildStatusIsMeaningfulFallback ? buildStatus : "no builds"
      const noBuildsBadge = generateStepBadgeSvg(customLabel || stepId, fallbackStatus)
      return new Response(noBuildsBadge, {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": buildStatusIsMeaningfulFallback ? pendingCacheControl : cacheControl,
        },
      })
    }

    // Try exact step key match first (direct command step)
    const exactMatch = jobs.find((job) => job.stepKey === stepId)
    if (exactMatch) {
      const rawStatus = getJobStatus(exactMatch)
      const status = trackRunningBuild(rawStatus)
      const jobLabel = customLabel || exactMatch.label || stepId
      const badgeSvg = generateStepBadgeSvg(jobLabel, status)
      return new Response(badgeSvg, {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": status === rawStatus ? cacheControl : pendingCacheControl,
          "X-Content-Type-Options": "nosniff",
        },
      })
    }

    // No exact match — likely a group step. Find child jobs by segment convention:
    // child steps within a group keyed "build" have keys containing "-build" as a
    // segment (e.g. "speller-build" or "speller-build-windows")
    const segment = `-${stepId}`
    const childJobs = jobs.filter((job) => job.stepKey?.endsWith(segment) || job.stepKey?.includes(`${segment}-`))

    if (childJobs.length > 0) {
      const rawStatus = aggregateJobStatuses(childJobs)
      const status = trackRunningBuild(rawStatus)
      const displayLabel = customLabel || stepId.charAt(0).toUpperCase() + stepId.slice(1)
      const badgeSvg = generateStepBadgeSvg(displayLabel, status)
      return new Response(badgeSvg, {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": status === rawStatus ? cacheControl : pendingCacheControl,
          "X-Content-Type-Options": "nosniff",
        },
      })
    }

    // Step not found among the build's jobs. If the build is still starting up
    // (steps not uploaded yet) report the build-level status; otherwise the
    // requested step genuinely doesn't exist.
    const fallbackStatus = buildStatusIsMeaningfulFallback ? buildStatus : "not found"
    const notFoundBadge = generateStepBadgeSvg(customLabel || stepId, fallbackStatus)
    return new Response(notFoundBadge, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": buildStatusIsMeaningfulFallback ? pendingCacheControl : "public, max-age=60",
      },
    })
  } catch (error) {
    console.error("Step badge API error:", error)

    const errorBadge = generateStepBadgeSvg(customLabel || stepId || "unknown", "unknown")
    return new Response(errorBadge, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=60",
      },
    })
  }
}
