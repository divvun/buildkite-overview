// Buildkite API types - client safe
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
