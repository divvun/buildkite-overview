import type { TypedDocumentNode } from "@graphql-typed-document-node/core"
import { makeBadge } from "badge-maker"
import { Context } from "fresh"
import { gql } from "graphql-tag"
import { getBuildkiteClient } from "~/server/buildkite-client.ts"
import type { BuildkiteBuild, BuildkiteJob, BuildkitePipeline } from "~/types/buildkite.ts"
import { normalizeStatus } from "~/utils/formatters.ts"
import { type AppState, isPrivatePipeline } from "~/server/middleware.ts"

interface BuildWithJobs extends BuildkiteBuild {
  jobs?: {
    edges: Array<{
      node: BuildkiteJob
    }>
  }
}

// Query to get a pipeline with the latest build including filtered job details
export const GET_PIPELINE_WITH_JOBS: TypedDocumentNode<
  {
    pipeline: BuildkitePipeline & {
      builds: {
        edges: Array<{
          node: BuildWithJobs
        }>
      }
    }
  },
  { pipelineSlug: string; stepKey: string[] }
> = gql`
  query GetPipelineWithJobs($pipelineSlug: ID!, $stepKey: [String!]!) {
    pipeline(slug: $pipelineSlug) {
      id
      name
      slug
      url
      visibility
      repository {
        url
      }
      tags {
        label
      }
      builds(first: 1) {
        edges {
          node {
            id
            number
            state
            url
            startedAt
            finishedAt
            createdAt
            jobs(first: 1, step: {key: $stepKey}) {
              edges {
                node {
                  ... on JobTypeCommand {
                    id
                    uuid
                    label
                    state
                    startedAt
                    finishedAt
                    exitStatus
                    passed
                    step {
                      key
                    }
                  }
                  ... on JobTypeBlock {
                    id
                    uuid
                    label
                    state
                    step {
                      key
                    }
                  }
                  ... on JobTypeTrigger {
                    id
                    uuid
                    label
                    state
                  }
                  ... on JobTypeWait {
                    id
                    uuid
                    state
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`

/**
 * Generate an SVG badge for a job/step status
 */
function generateStepBadgeSvg(stepLabel: string, status: string): string {
  const statusNormalized = normalizeStatus(status)

  // Define colors based on status
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

  // Allow requests from GitHub and giellalt GitHub pages
  if (
    origin === "https://github.com" ||
    origin === "https://giellalt.github.io" ||
    referer?.startsWith("https://github.com/") ||
    referer?.startsWith("https://giellalt.github.io/")
  ) {
    return true
  }

  // Allow localhost and development environments
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

    // Fetch pipeline data with jobs from Buildkite
    const fullPipelineSlug = `divvun/${slug}`
    const client = getBuildkiteClient()

    const result = await client.query(GET_PIPELINE_WITH_JOBS, {
      pipelineSlug: fullPipelineSlug,
      stepKey: [stepId],
    }).toPromise()

    if (!result.data?.pipeline) {
      // Return a "not found" badge
      const notFoundBadge = generateStepBadgeSvg(customLabel || stepId, "unknown")
      return new Response(notFoundBadge, {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, max-age=60",
        },
      })
    }

    const pipeline = result.data.pipeline

    // Check if pipeline is private and validate authorization
    const isPrivate = isPrivatePipeline({
      repo: pipeline.repository?.url,
      visibility: pipeline.visibility,
      tags: pipeline.tags?.map((tag) => tag.label) || [],
    })

    if (isPrivate && !isAuthorizedForPrivateBadge(req)) {
      return new Response("Forbidden: Private pipeline badge", {
        status: 403,
        headers: {
          "Content-Type": "text/plain",
        },
      })
    }

    // Get the latest build
    const latestBuild = pipeline.builds?.edges?.[0]?.node
    if (!latestBuild) {
      // No builds yet
      const noBuildsBadge = generateStepBadgeSvg(customLabel || stepId, "no builds")
      return new Response(noBuildsBadge, {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": isPrivate ? "private, max-age=60" : "public, max-age=300",
        },
      })
    }

    // Get the job matching the step key (API filtered it for us)
    const job = latestBuild.jobs?.edges?.[0]?.node

    if (!job) {
      // Step not found in the latest build
      const notFoundBadge = generateStepBadgeSvg(customLabel || stepId, "not found")
      return new Response(notFoundBadge, {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": isPrivate ? "private, max-age=60" : "public, max-age=300",
        },
      })
    }

    // Get the job status and label
    const status = ("state" in job ? job.state : null) || "unknown"
    const jobLabel = customLabel || ("label" in job ? job.label : null) || stepId

    // Generate the SVG badge
    const badgeSvg = generateStepBadgeSvg(jobLabel, status)

    return new Response(badgeSvg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": isPrivate
          ? "private, max-age=60" // Private badges cache for 1 minute
          : "public, max-age=300", // Public badges cache for 5 minutes
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    console.error("Step badge API error:", error)

    // Return an error badge instead of throwing
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
