import { Context, page } from "fresh"
import { type AppState } from "~/utils/middleware.ts"
import FullscreenLogs from "~/islands/FullscreenLogs.tsx"

interface LogData {
  url?: string
  content?: string
  contentType?: string
  error?: string
}

interface FullscreenLogsPageProps {
  jobId: string
  buildNumber: string
  pipelineSlug: string
  logData?: LogData
  error?: string
  jobCommand?: string
}

export const handler = {
  async GET(ctx: Context<AppState>) {
    const pipelineSlug = ctx.params.slug
    const buildNumber = ctx.params.number
    const jobId = ctx.params.id

    console.log("Handler params:", { pipelineSlug, buildNumber, jobId })

    // Fetch logs server-side
    let logData: LogData | undefined
    let error: string | undefined
    let jobCommand: string | undefined

    try {
      const params = new URLSearchParams({
        build: buildNumber,
        pipeline: pipelineSlug,
      })

      const logsUrl = `${ctx.url.origin}/api/jobs/${jobId}/logs?${params}`
      console.log("Fetching logs from:", logsUrl)

      const response = await fetch(logsUrl, {
        headers: {
          "Cookie": ctx.req.headers.get("Cookie") || "",
        },
      })

      if (response.ok) {
        logData = await response.json()
        console.log("Logs fetched successfully, content length:", logData?.content?.length || 0)
      } else {
        const errorData = await response.json()
        error = errorData.error || "Failed to fetch logs"
        console.log("Error fetching logs:", error)
      }
    } catch (err) {
      console.error("Handler error fetching logs:", err)
      error = "Error fetching logs"
    }

    // Try to get job command from cache
    try {
      const { getCacheManager } = await import("~/utils/cache/cache-manager.ts")
      const cacheManager = getCacheManager()

      // Extract UUID from GraphQL ID if it's base64 encoded
      let uuid = jobId
      try {
        const decodedId = atob(jobId)
        if (
          decodedId.startsWith("JobTypeCommand---") || decodedId.startsWith("JobTypeBlock---") ||
          decodedId.startsWith("JobTypeTrigger---") || decodedId.startsWith("JobTypeWait---")
        ) {
          uuid = decodedId.replace(/^JobType\w+---/, "")
        }
      } catch (_e) {
        // If not base64, use as is
      }

      const cachedJob = await cacheManager.getCachedJob(pipelineSlug, parseInt(buildNumber), uuid)
      if (cachedJob?.command) {
        jobCommand = cachedJob.command
      } else if (cachedJob?.label) {
        jobCommand = cachedJob.label
      }
    } catch (err) {
      console.error("Error fetching job command:", err)
    }

    return page(
      {
        jobId,
        buildNumber,
        pipelineSlug,
        logData,
        error,
        jobCommand,
      } satisfies FullscreenLogsPageProps,
    )
  },
}

export default function FullscreenLogsPage({ data }: { data: FullscreenLogsPageProps }) {
  const { jobId, buildNumber, pipelineSlug, logData, error, jobCommand } = data

  return (
    <html>
      <head>
        <title>{jobCommand || "Job Logs"} - {pipelineSlug}#{buildNumber}</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          {`
            * {
              box-sizing: border-box;
            }
            
            body {
              margin: 0;
              padding: 0;
              font-family: ui-monospace, 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
              background: #0d1117;
              color: #f8f8f2;
              overflow: hidden;
            }
          `}
        </style>
      </head>
      <body>
        <FullscreenLogs
          jobId={jobId}
          buildNumber={buildNumber}
          pipelineSlug={pipelineSlug}
          initialLogData={logData}
          initialError={error}
          jobCommand={jobCommand}
        />
      </body>
    </html>
  )
}
