import type { TypedDocumentNode } from "@graphql-typed-document-node/core"
import { createClient, fetchExchange } from "@urql/preact"
import { gql } from "graphql-tag"
import { $, query } from "./gql/buildkite.ts"

// Only access Deno on the server side
const BUILDKITE_API_KEY = typeof Deno !== "undefined" ? Deno.env.get("BUILDKITE_API_KEY") : ""
const BUILDKITE_API_ENDPOINT = "https://graphql.buildkite.com/v1"

if (typeof Deno !== "undefined" && !BUILDKITE_API_KEY) {
  throw new Error("BUILDKITE_API_KEY environment variable is required")
}

export const buildkiteClient = createClient({
  url: BUILDKITE_API_ENDPOINT,
  exchanges: [fetchExchange],
  fetchOptions: {
    headers: {
      "Authorization": `Bearer ${BUILDKITE_API_KEY}`,
      "Content-Type": "application/json",
    },
  },
})

export interface BuildkiteBuild {
  id: string
  number: number
  state: string
  url: string
  startedAt?: string
  finishedAt?: string
  createdAt: string
  message?: string
  branch?: string
  commit?: string
  jobs?: {
    edges: Array<{
      node: BuildkiteJob
    }>
  }
  pipeline: {
    id: string
    name: string
    slug: string
  }
}

export interface BuildkiteJob {
  id: string
  uuid?: string
  state: string
  label?: string
  url?: string
  startedAt?: string
  finishedAt?: string
  exitStatus?: number // Only available on JobTypeCommand
  command?: string // Only available on JobTypeCommand
  passed?: boolean // Only available on JobTypeCommand
  type: string
  retriedInJobId?: string // Only available on JobTypeCommand
  step?: {
    key?: string
    label?: string
  }
}

export interface BuildkitePipeline {
  id: string
  name: string
  slug: string
  url: string
  visibility: "PUBLIC" | "PRIVATE"
  repository?: {
    url: string
  }
  tags?: Array<{
    label: string
  }>
  builds?: {
    edges: Array<{
      node: {
        id: string
        state: string
        url: string
        startedAt?: string
        finishedAt?: string
        createdAt: string
      }
    }>
  }
}

export interface BuildkiteOrganization {
  id: string
  slug: string
  name: string
  pipelines: {
    edges: Array<{
      node: BuildkitePipeline
    }>
  }
}

export const GET_ORGANIZATION_PIPELINES: TypedDocumentNode<
  { organization: BuildkiteOrganization },
  { slug: string }
> = gql`
  query GetOrganizationPipelines($slug: ID!) {
    organization(slug: $slug) {
      id
      slug
      name
      pipelines(first: 100) {
        edges {
          node {
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
            builds(first: 10) {
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
      }
    }
  }
`

export const GET_ORGANIZATION_PIPELINES_PAGINATED: TypedDocumentNode<
  { organization: BuildkiteOrganization },
  { slug: string; first: number; after?: string }
> = gql`
  query GetOrganizationPipelinesPaginated($slug: ID!, $first: Int!, $after: String) {
    organization(slug: $slug) {
      id
      slug
      name
      pipelines(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
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
            builds(first: 10) {
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
      }
    }
  }
`

export const GET_PIPELINE_BUILDS: TypedDocumentNode<
  { pipeline: { builds: { edges: Array<{ node: BuildkiteBuild }> } } },
  { pipelineSlug: string; first?: number }
> = gql`
  query GetPipelineBuilds($pipelineSlug: ID!, $first: Int = 50) {
    pipeline(slug: $pipelineSlug) {
      builds(first: $first) {
        edges {
          node {
            id
            number
            state
            url
            startedAt
            finishedAt
            createdAt
            message
            branch
            commit
            pipeline {
              id
              name
              slug
            }
          }
        }
      }
    }
  }
`

export const GET_BUILD_DETAILS = query((q) => [
  q.build({ uuid: $("uuid") }, (b) => [
    b.id,
    b.number,
    b.state,
    b.url,
    b.startedAt,
    b.finishedAt,
    b.createdAt,
    b.message,
    b.branch,
    b.commit,
    b.pipeline((p) => [
      p.id,
      p.name,
      p.slug,
    ]),
    b.jobs({ first: 50 }, (j) => [
      j.edges((e) => [
        e.node((n) => [
          n.$on("JobTypeCommand", (c) => [
            c.id,
            c.uuid,
            c.label,
            c.state,
            c.startedAt,
            c.finishedAt,
            c.exitStatus,
            c.passed,
            c.command,
            c.step((s) => [
              s.key,
            ]),
          ]),
          n.$on("JobTypeBlock", (b) => [
            b.id,
            b.uuid,
            b.state,
            b.label,
            b.step((s) => [
              s.key,
            ]),
          ]),
          n.$on("JobTypeTrigger", (t) => [
            t.id,
            t.uuid,
            t.state,
          ]),
          n.$on("JobTypeWait", (w) => [
            w.id,
            w.uuid,
            w.state,
          ]),
        ]),
      ]),
    ]),
  ]),
])

export const GET_JOB_LOG: TypedDocumentNode<
  { job: any },
  { uuid: string }
> = gql`
  query GetJobLog($uuid: ID!) {
    job(uuid: $uuid) {
      ... on JobTypeCommand {
        id
        log {
          url
        }
      }
      ... on JobTypeBlock {
        id
      }
      ... on JobTypeTrigger {
        id
      }
      ... on JobTypeWait {
        id
      }
    }
  }
`

// Note: Agent metrics might not be available in GraphQL API
// This is a placeholder for future implementation or REST API fallback
export interface BuildkiteAgent {
  id: string
  name: string
  hostname?: string
  connectionState: string
  isRunningJob: boolean
  operatingSystem?: {
    name?: string
  }
  version?: string
  ipAddress?: string
  createdAt: string
  connectedAt?: string
  disconnectedAt?: string
  clusterQueue?: {
    key: string
  }
  job?: {
    id: string
    state: string
    url?: string
    startedAt?: string
    build: {
      id: string
      number: number
      pipeline: {
        id: string
        name: string
        slug: string
      }
    }
  }
}

export const GET_ORGANIZATION_AGENTS: TypedDocumentNode<
  { organization: { agents: { edges: Array<{ node: BuildkiteAgent }> } } },
  { slug: string }
> = gql`
  query GetOrganizationAgents($slug: ID!) {
    organization(slug: $slug) {
      agents(first: 50) {
        edges {
          node {
            id
            name
            hostname
            connectionState
            isRunningJob
            operatingSystem {
              name
            }
            version
            ipAddress
            createdAt
            connectedAt
            disconnectedAt
            clusterQueue {
              key
            }
            job {
              ... on JobTypeCommand {
                id
                state
                url
                startedAt
                build {
                  id
                  number
                  pipeline {
                    id
                    name
                    slug
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

export const GET_ORGANIZATION_CLUSTERS_AND_METRICS: TypedDocumentNode<
  {
    organization: {
      clusters: {
        edges: Array<{
          node: {
            id: string
            uuid: string
            name: string
            queues: {
              edges: Array<{
                node: {
                  id: string
                  uuid: string
                  key: string
                  metrics: {
                    connectedAgentsCount: number
                    runningJobsCount: number
                    timestamp: string
                    waitingJobsCount: number
                  }
                }
              }>
            }
          }
        }>
      }
    }
  },
  { slug: string }
> = gql`
  query GetOrganizationClustersAndMetrics($slug: ID!) {
    organization(slug: $slug) {
      clusters(first: 10) {
        edges {
          node {
            id
            uuid
            name
            queues(first: 10) {
              edges {
                node {
                  id
                  uuid
                  key
                  metrics {
                    connectedAgentsCount
                    runningJobsCount
                    timestamp
                    waitingJobsCount
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

// REST API interfaces and functions
export interface BuildkiteBuildRest {
  id: string
  number: number
  state: string
  url: string
  web_url: string
  started_at?: string
  finished_at?: string
  created_at: string
  scheduled_at?: string
  message?: string
  branch?: string
  commit?: string
  pipeline: {
    id: string
    name: string
    slug: string
    url: string
    repository?: {
      url: string
    }
  }
  jobs: BuildkiteJobRest[]
}

export interface BuildkiteJobRest {
  id: string
  type: string
  name?: string
  state: string
  web_url?: string
  started_at?: string
  finished_at?: string
  created_at?: string
  scheduled_at?: string
  step_key?: string
  agent?: {
    id: string
    name: string
    queue?: string
  }
  agent_query_rules?: string[]
}

const BUILDKITE_REST_ENDPOINT = "https://api.buildkite.com/v2"

// REST API client for fetching builds by state
export async function fetchBuildsByState(orgSlug: string, states: string[]): Promise<BuildkiteBuildRest[]> {
  if (!BUILDKITE_API_KEY) {
    throw new Error("BUILDKITE_API_KEY environment variable is required")
  }

  const stateParams = states.map((state) => `state[]=${encodeURIComponent(state)}`).join("&")
  const url =
    `${BUILDKITE_REST_ENDPOINT}/organizations/${orgSlug}/builds?${stateParams}&include_retried_jobs=false&per_page=100`

  console.log(`Fetching builds from REST API: ${url}`)

  try {
    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${BUILDKITE_API_KEY}`,
        "Accept": "application/json",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`REST API Error: ${response.status} ${response.statusText}`, errorText)
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`)
    }

    const builds: BuildkiteBuildRest[] = await response.json()
    console.log(`✅ Fetched ${builds.length} builds with states: ${states.join(", ")}`)

    return builds
  } catch (error) {
    console.error(`❌ Error fetching builds for ${orgSlug}:`, error)
    throw error
  }
}

// Fetch scheduled builds across all organizations
export async function fetchScheduledBuilds(): Promise<BuildkiteBuildRest[]> {
  const allBuilds: BuildkiteBuildRest[] = []

  for (const orgSlug of ["divvun"]) { // Using hardcoded for now, import ORGANIZATIONS from formatters later
    try {
      const builds = await fetchBuildsByState(orgSlug, ["scheduled"])
      allBuilds.push(...builds)
    } catch (error) {
      console.error(`Failed to fetch scheduled builds for ${orgSlug}:`, error)
      // Continue with other orgs even if one fails
    }
  }

  return allBuilds
}

// Fetch running builds across all organizations
export async function fetchRunningBuildsRest(): Promise<BuildkiteBuildRest[]> {
  const allBuilds: BuildkiteBuildRest[] = []

  for (const orgSlug of ["divvun"]) { // Using hardcoded for now, import ORGANIZATIONS from formatters later
    try {
      const builds = await fetchBuildsByState(orgSlug, ["running"])
      allBuilds.push(...builds)
    } catch (error) {
      console.error(`Failed to fetch running builds for ${orgSlug}:`, error)
      // Continue with other orgs even if one fails
    }
  }

  return allBuilds
}
