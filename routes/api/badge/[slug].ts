import type { TypedDocumentNode } from "@graphql-typed-document-node/core"
import { makeBadge } from "badge-maker"
import { Context } from "fresh"
import { gql } from "graphql-tag"
import { type BuildkiteBuild, type BuildkitePipeline, getBuildkiteClient } from "~/utils/buildkite-client.ts"
import { normalizeStatus } from "~/utils/formatters.ts"
import { type AppState, isPrivatePipeline } from "~/utils/middleware.ts"

// Query to get a single pipeline by slug
export const GET_SINGLE_PIPELINE: TypedDocumentNode<
  { pipeline: BuildkitePipeline & { builds: { edges: Array<{ node: BuildkiteBuild }> } } },
  { pipelineSlug: string }
> = gql`
  query GetSinglePipeline($pipelineSlug: ID!) {
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
          }
        }
      }
    }
  }
`

/**
 * Generate an SVG badge for a pipeline's build status
 * Using badge-maker library for professional results
 */
function generateBadgeSvg(pipelineName: string, status: string): string {
  const statusNormalized = normalizeStatus(status)

  // Define colors based on status (badge-maker color names)
  const colorMap: Record<string, string> = {
    "passed": "brightgreen",
    "failed": "red",
    "running": "yellow",
    "blocked": "lightgrey",
    "waiting": "yellow",
    "scheduled": "yellow",
    "canceled": "lightgrey",
    "unknown": "lightgrey",
  }

  const statusText = statusNormalized === "passed" ? "passing" : statusNormalized
  const color = colorMap[statusNormalized] || "lightgrey"

  return makeBadge({
    label: pipelineName,
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
  try {
    const slug = ctx.params.slug as string

    if (!slug) {
      return new Response("Pipeline slug is required", { status: 400 })
    }

    // Fetch pipeline data from Buildkite
    const fullPipelineSlug = `divvun/${slug}`
    const client = getBuildkiteClient()

    const result = await client.query(GET_SINGLE_PIPELINE, {
      pipelineSlug: fullPipelineSlug,
    }).toPromise()

    if (!result.data?.pipeline) {
      // Return a "not found" badge instead of 404 for better UX
      const notFoundBadge = generateBadgeSvg(slug, "unknown")
      return new Response(notFoundBadge, {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, max-age=60", // Cache for 1 minute
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

    // Get the latest build status
    const latestBuild = pipeline.builds?.edges?.[0]?.node
    const status = latestBuild?.state || "unknown"

    // Generate the SVG badge
    const badgeSvg = generateBadgeSvg(pipeline.name, status)

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
    console.error("Badge API error:", error)

    // Return an error badge instead of throwing
    const errorBadge = generateBadgeSvg(ctx.params.slug || "unknown", "unknown")
    return new Response(errorBadge, {
      status: 200, // Still return 200 for better badge service compatibility
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=60",
      },
    })
  }
}
