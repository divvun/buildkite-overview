import type { TypedDocumentNode } from "@graphql-typed-document-node/core"
import { makeBadge } from "badge-maker"
import { Context } from "fresh"
import { gql } from "graphql-tag"
import { parse as parseYaml } from "jsr:@std/yaml"
import { getBuildkiteClient } from "~/server/buildkite-client.ts"
import type { BuildkiteBuild, BuildkiteJob, BuildkitePipeline } from "~/types/buildkite.ts"
import { getJobStatus, normalizeStatus } from "~/utils/formatters.ts"
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
      steps: {
        yaml: string
      }
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
      steps {
        yaml
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

// Query to get multiple jobs for child steps
export const GET_BUILD_JOBS: TypedDocumentNode<
  {
    build: {
      jobs: {
        edges: Array<{
          node: BuildkiteJob
        }>
      }
    }
  },
  { buildId: string; stepKeys: string[] }
> = gql`
  query GetBuildJobs($buildId: ID!, $stepKeys: [String!]!) {
    build(uuid: $buildId) {
      jobs(first: 50, step: {key: $stepKeys}) {
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
`

/**
 * Interface for a pipeline step definition
 */
interface PipelineStep {
  key?: string
  label?: string
  group?: string
  steps?: PipelineStep[]
  command?: string | string[]
  wait?: string | null
  block?: string | null
  trigger?: string
  [key: string]: unknown
}

/**
 * Find a group step by key in the pipeline YAML
 */
function findGroupStep(steps: PipelineStep[], targetKey: string): PipelineStep | null {
  for (const step of steps) {
    if (step.key === targetKey && step.group) {
      return step
    }
    if (step.steps) {
      const found = findGroupStep(step.steps, targetKey)
      if (found) return found
    }
  }
  return null
}

/**
 * Extract all child step keys from a group step
 */
function extractChildStepKeys(groupStep: PipelineStep): string[] {
  const keys: string[] = []

  if (!groupStep.steps) return keys

  for (const step of groupStep.steps) {
    if (step.key) {
      keys.push(step.key)
    }
    if (step.steps) {
      keys.push(...extractChildStepKeys(step))
    }
  }

  return keys
}

/**
 * Aggregate job statuses to determine overall group status
 * Priority: failed > running > blocked > waiting/scheduled > passed
 */
function aggregateJobStatuses(jobs: Array<{ state?: string; passed?: boolean; exitStatus?: number | null }>): string {
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

    console.log(`[Step Badge Debug] Pipeline: ${fullPipelineSlug}, Step: ${stepId}`)
    console.log(`[Step Badge Debug] Full result:`, JSON.stringify(result.data, null, 2))

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

    console.log(`[Step Badge Debug] Job found:`, job)

    if (!job) {
      console.log(`[Step Badge Debug] No job found for step key: ${stepId}`)

      // Check if this is a group step by parsing the pipeline YAML
      // Groups in Buildkite don't create jobs themselves - only their child steps do.
      // When a group step key is provided, we need to:
      // 1. Parse the pipeline YAML to find the group definition
      // 2. Extract all child step keys from the group
      // 3. Query jobs for all child steps
      // 4. Aggregate their statuses to determine the overall group status
      try {
        const stepsYaml = pipeline.steps?.yaml
        if (stepsYaml) {
          console.log(`[Step Badge Debug] Parsing pipeline YAML to detect group`)
          const parsedSteps = parseYaml(stepsYaml) as { steps?: PipelineStep[] }
          const steps = parsedSteps?.steps || (Array.isArray(parsedSteps) ? parsedSteps as PipelineStep[] : [])

          const groupStep = findGroupStep(steps, stepId)

          if (groupStep) {
            console.log(`[Step Badge Debug] Found group step:`, groupStep.group)

            // Extract child step keys
            const childStepKeys = extractChildStepKeys(groupStep)
            console.log(`[Step Badge Debug] Child step keys:`, childStepKeys)

            if (childStepKeys.length > 0) {
              // Query jobs for all child steps
              const buildId = latestBuild.id
              const jobsResult = await client.query(GET_BUILD_JOBS, {
                buildId,
                stepKeys: childStepKeys,
              }).toPromise()

              console.log(`[Step Badge Debug] Child jobs result:`, JSON.stringify(jobsResult.data, null, 2))

              const childJobs = jobsResult.data?.build?.jobs?.edges?.map((edge) => edge.node) || []

              if (childJobs.length > 0) {
                // Aggregate child job statuses
                const aggregatedStatus = aggregateJobStatuses(childJobs)
                const groupLabel = customLabel || groupStep.group || stepId

                console.log(`[Step Badge Debug] Aggregated status for group: ${aggregatedStatus}`)

                const groupBadge = generateStepBadgeSvg(groupLabel, aggregatedStatus)
                return new Response(groupBadge, {
                  status: 200,
                  headers: {
                    "Content-Type": "image/svg+xml",
                    "Cache-Control": isPrivate ? "private, max-age=60" : "public, max-age=300",
                  },
                })
              }
            }
          }
        }
      } catch (yamlError) {
        console.error(`[Step Badge Debug] Error parsing YAML:`, yamlError)
      }

      // Step not found in the latest build and not a group
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
    // Use getJobStatus which properly handles job states (FINISHED, RUNNING, etc.)
    const status = getJobStatus(job as { state?: string; passed?: boolean; exitStatus?: number | null })
    const jobLabel = customLabel || ("label" in job ? job.label : null) || stepId

    console.log(`[Step Badge Debug] Job object:`, job)
    console.log(`[Step Badge Debug] Final status: ${status}, label: ${jobLabel}`)

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
