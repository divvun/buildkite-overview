/// <reference path="../types/webawesome.d.ts" />
import { useCallback, useEffect, useState } from "preact/hooks"
import EmptyState from "~/components/EmptyState.tsx"
import { type AppPipeline } from "~/utils/buildkite-data.ts"
import { getBadgeVariant, getHealthBorderStyle, getStatusIcon } from "~/utils/formatters.ts"

interface PipelinesData {
  pipelines: AppPipeline[]
  statusFilter?: string
  searchQuery?: string
  error?: string
}

interface PipelinesContentProps {
  initialData: PipelinesData
}

export default function PipelinesContent({ initialData }: PipelinesContentProps) {
  const [data, setData] = useState<PipelinesData>(initialData)
  const [isLoading, setIsLoading] = useState(false)

  console.log("PipelinesContent: Component rendered")

  const fetchData = useCallback(async () => {
    try {
      console.log("PipelinesContent: Starting fetch")
      setIsLoading(true)
      
      // Build URL with current filters
      const url = new URL("/api/pipelines", globalThis.location.origin)
      if (data.statusFilter) {
        url.searchParams.set("status", data.statusFilter)
      }
      if (data.searchQuery) {
        url.searchParams.set("search", data.searchQuery)
      }
      
      const response = await fetch(url.toString())
      if (response.ok) {
        const newData = await response.json()
        console.log("PipelinesContent: Fetch successful")
        setData(newData)
      } else {
        console.error("PipelinesContent: Failed to fetch pipelines data:", response.status)
      }
    } catch (error) {
      console.error("PipelinesContent: Error fetching pipelines data:", error)
    } finally {
      console.log("PipelinesContent: Fetch complete, setting loading false")
      setIsLoading(false)
    }
  }, [data.statusFilter, data.searchQuery])

  useEffect(() => {
    console.log("PipelinesContent: Setting up autorefresh event listener")
    
    const handleRefresh = () => {
      console.log("PipelinesContent: Received autorefresh event")
      fetchData()
    }

    // Listen for refresh events from AutoRefresh component
    globalThis.addEventListener("autorefresh", handleRefresh)

    return () => {
      console.log("PipelinesContent: Removing autorefresh event listener")
      globalThis.removeEventListener("autorefresh", handleRefresh)
    }
  }, [])

  const { pipelines, statusFilter, searchQuery, error } = data

  return (
    <>
      {error && (
        <wa-callout variant="danger">
          <wa-icon slot="icon" name="triangle-exclamation"></wa-icon>
          {error}
        </wa-callout>
      )}

      <div
        class="wa-gap-m"
        style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--wa-space-m)"
      >
        {pipelines.length === 0 && !error
          ? (
            <EmptyState
              icon="folder-open"
              title="No pipelines found"
              description={searchQuery || statusFilter
                ? `No pipelines match your current filters. Try adjusting your search or filters.`
                : `No Buildkite pipelines found. Check your API configuration or create your first pipeline.`}
              variant="neutral"
            >
              {(searchQuery || statusFilter) && (
                <wa-button appearance="outlined">
                  <a href="/pipelines" style="text-decoration: none; color: inherit">
                    Clear all filters
                  </a>
                </wa-button>
              )}
            </EmptyState>
          )
          : pipelines.map((pipeline) => (
            <wa-card key={pipeline.id} class="clickable-card" style={getHealthBorderStyle(pipeline.status)}>
              <a
                href={`/pipelines/${pipeline.slug}`}
                style="text-decoration: none; color: inherit; display: block"
              >
                <div class="wa-stack wa-gap-s">
                  <div class="wa-flank">
                    <div class="wa-stack wa-gap-3xs">
                      <div class="wa-flank wa-gap-xs">
                        <wa-icon
                          name={getStatusIcon(pipeline.status)}
                          style={`color: var(--wa-color-${getBadgeVariant(pipeline.status)}-fill-loud)`}
                        >
                        </wa-icon>
                        <span class="wa-heading-s">{pipeline.name}</span>
                      </div>
                      <div class="wa-caption-s wa-color-text-quiet">{pipeline.repo || "No repository"}</div>
                    </div>
                  </div>

                  <wa-badge variant={getBadgeVariant(pipeline.status)}>
                    {pipeline.status}
                  </wa-badge>
                  <div class="wa-cluster wa-gap-xs" style="flex-wrap: wrap; min-height: 24px">
                    {pipeline.tags.map((tag) => <wa-tag key={tag}>{tag}</wa-tag>)}
                  </div>

                  <wa-divider></wa-divider>

                  <div class="wa-flank">
                    <div class="wa-stack wa-gap-3xs">
                      <div class="wa-caption-s">Build Stats</div>
                      <div class="wa-cluster wa-gap-s">
                        <span class="wa-caption-xs">
                          <wa-badge variant="success">{pipeline.builds.passed}</wa-badge> passed
                        </span>
                        <span class="wa-caption-xs">
                          <wa-badge variant="danger">{pipeline.builds.failed}</wa-badge> failed
                        </span>
                      </div>
                    </div>
                    <div class="wa-stack wa-gap-3xs wa-align-items-end">
                      <div class="wa-caption-s">Last Build</div>
                      <div class="wa-caption-xs wa-color-text-quiet">{pipeline.lastBuild}</div>
                    </div>
                  </div>
                </div>
              </a>
            </wa-card>
          ))}
      </div>

      {isLoading && (
        <div
          style="position: fixed; top: 10px; right: 10px; z-index: 1000; background: var(--wa-color-brand-fill-loud); color: white; padding: var(--wa-space-xs) var(--wa-space-s); border-radius: var(--wa-border-radius-s); font-size: var(--wa-font-size-caption-s)"
        >
          Refreshing...
        </div>
      )}
    </>
  )
}