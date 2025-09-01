// Application types - client safe
export interface AppPipeline {
  id: string
  name: string
  slug: string
  repo?: string
  status: string
  lastBuild: string
  tags: string[]
  visibility?: string
  builds: {
    total: number
    passed: number
    failed: number
  }
  buildHistory?: BuildHistoryItem[]
  url: string
}

export interface AppBuild {
  name: string
  status: string
  duration: string
  lastRun: string
  repo: string
  url: string
  pipelineSlug?: string
  number?: number
}

export interface BuildHistoryItem {
  status: "passed" | "success" | "failed" | "running" | "cancelled" | "blocked" | "waiting" | "scheduled"
  buildNumber: number
  finishedAt?: string
}

export interface FailingPipeline {
  id: string
  name: string
  slug: string
  repo?: string
  visibility?: string
  tags?: string[]
  failingSince: Date
  last10Builds: BuildHistoryItem[]
  url: string
}

export interface AgentMetrics {
  averageWaitTime: number // in seconds
  p95WaitTime: number // in seconds
  p99WaitTime: number // in seconds
}

export interface AppAgent {
  id: string
  name: string
  hostname?: string
  connectionState: string
  isRunningJob: boolean
  operatingSystem?: string
  version?: string
  ipAddress?: string
  organization: string
  queueKey?: string
  metadata?: Array<{
    key: string
    value: string
  }>
  currentJob?: {
    id: string
    state: string
    url?: string
    pipelineName: string
    pipelineSlug: string
    buildNumber: number
    buildUrl: string
    startedAt?: string
    duration?: string
  }
  createdAt: Date
  connectedAt?: Date
  disconnectedAt?: Date
  lastSeen?: Date
  priority: number
}

export interface QueueStatus {
  queueKey: string
  runningJobs: QueueJob[]
  scheduledJobs: QueueJob[]
  scheduledBuilds: QueueBuild[]
  connectedAgents: number
  availableAgents: number
}

export interface QueueBuild {
  buildId: string
  buildNumber: number
  pipelineName: string
  pipelineSlug: string
  repo?: string
  buildUrl: string
  scheduledAt: string
  jobs: QueueJob[]
}

export interface QueueJob {
  id: string
  buildId: string
  buildNumber: number
  pipelineName: string
  pipelineSlug: string
  repo?: string
  state: string
  createdAt: string
  scheduledAt?: string
  startedAt?: string
  finishedAt?: string
  runnableAt?: string
  label?: string
  buildUrl: string
  command?: string
  agentQueryRules?: string[]
  url?: string
}
